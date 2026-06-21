import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { uploadToR2, presignGetUrl, getFromR2 } from "../lib/r2.ts";
import { extractReceiptFromImage, suggestCategory } from "../lib/gemini.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { getUserDefaultCostCenter, userCanAccessCC } from "../lib/cc.ts";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

// Rate-limit por usuário pros endpoints caros de IA (OCR/sugestão). In-memory
// (por instância) — não é perfeito em multi-instância, mas freia abuso/custo.
const _aiHits = new Map<string, number[]>();
function aiRateOk(userId: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (_aiHits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    _aiHits.set(userId, arr);
    return false;
  }
  arr.push(now);
  _aiHits.set(userId, arr);
  return true;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/heic": return "heic";
    case "application/pdf": return "pdf";
    default: return "bin";
  }
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  // strip data URL prefix se vier "data:image/jpeg;base64,..."
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ============================================================
// Itens (line items) - cada item tem categoria + CC proprios.
// ============================================================

interface NormalizedItem {
  description: string | null;
  category: string | null;
  cost_center_id: string | null;
  quantity: number | null;
  unit_value: number | null;
  total_value: number;
  position: number;
}

/** Le body.items -> itens normalizados, ou null se nao veio um array. */
function parseItems(raw: unknown): NormalizedItem[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const qtyN = o.quantity != null && o.quantity !== "" ? Number(o.quantity) : null;
    const unitN = o.unit_value != null && o.unit_value !== "" ? Number(o.unit_value) : null;
    let total = Number(o.total_value);
    if (!Number.isFinite(total) && qtyN != null && unitN != null) total = qtyN * unitN;
    return {
      description: typeof o.description === "string" ? o.description : null,
      category: typeof o.category === "string" ? o.category : null,
      cost_center_id:
        typeof o.cost_center_id === "string" ? o.cost_center_id : null,
      quantity: qtyN != null && Number.isFinite(qtyN) ? qtyN : null,
      unit_value: unitN != null && Number.isFinite(unitN) ? unitN : null,
      total_value: total,
      position: typeof o.position === "number" ? o.position : i,
    };
  });
}

/** Soma arredondada UMA vez (evita drift de centavo). */
function sumItems(items: NormalizedItem[]): number {
  return Number(
    items.reduce((s, it) => s + (Number(it.total_value) || 0), 0).toFixed(2),
  );
}

/** Valida itens: limite de quantidade + total de cada item (finito >= 0). */
function validateItems(items: NormalizedItem[]): string | null {
  if (items.length > 200) return "itens_demais"; // teto de sanidade
  for (const it of items) {
    if (!Number.isFinite(it.total_value) || it.total_value < 0) {
      return "item_total_invalido";
    }
  }
  return null;
}

/** Valida acesso por item ao cost_center_id (igual ao header). */
async function itemsCCAccessOk(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  items: NormalizedItem[],
): Promise<boolean> {
  for (const it of items) {
    if (it.cost_center_id) {
      const ok = await userCanAccessCC(admin, userId, it.cost_center_id);
      if (!ok) return false;
    }
  }
  return true;
}

type AnyClient = ReturnType<typeof getUserClient>;

/** Monta as rows pra inserir em farm_receipt_items. */
function itemRowsFor(
  receiptId: string,
  organizationId: string,
  items: NormalizedItem[],
) {
  return items.map((it) => ({
    receipt_id: receiptId,
    organization_id: organizationId,
    position: it.position,
    description: it.description,
    category: it.category,
    cost_center_id: it.cost_center_id,
    quantity: it.quantity,
    unit_value: it.unit_value,
    total_value: it.total_value,
  }));
}

/**
 * Rotas de farm_receipts. Auth via JWT do user; RLS scopes por org/cc.
 *
 * GET /receipts?status=&category=&direction=&cost_center_id=&from=&to=&search=&limit=
 *   -> retorna recibos com `items` embutidos. category/cost_center casam
 *      HEADER OU qualquer ITEM (split).
 * POST /receipts          (aceita items[] -> total/categoria/cc derivados)
 * PATCH /receipts/:id      (items[] = replace total dos itens)
 * DELETE /receipts/:id     (cascade apaga itens)
 * POST /receipts/:id/items/:itemId/promote  (converter item em lançamento)
 * POST /receipts/scan      (OCR)
 * GET /receipts/:id/attachment-url
 */
export function mountReceiptRoutes(app: Hono) {
  app.get("/receipts", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const q = new URL(c.req.url).searchParams;
      const status = q.get("status");
      const category = q.get("category");
      const statusArr = status
        ? status.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const categoryArr = category
        ? category.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const direction = q.get("direction");
      const costCenterId = q.get("cost_center_id");
      const search = q.get("search")?.trim();
      const from = q.get("from");
      const to = q.get("to");
      // 1000 cobre o Dashboard com período de até 12 meses sem truncar.
      const limit = Math.min(Number(q.get("limit") ?? 100), 1000);

      let query = client
        .from("farm_receipts")
        .select("*, items:farm_receipt_items!receipt_id(*)")
        .order("transaction_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (statusArr.length > 0) query = query.in("status", statusArr);
      if (direction) query = query.eq("direction", direction);
      if (from) query = query.gte("transaction_date", from);
      if (to) query = query.lte("transaction_date", to);
      if (search) {
        const safe = search.replace(/[%,]/g, "");
        query = query.or(
          `vendor.ilike.%${safe}%,description.ilike.%${safe}%,invoice_number.ilike.%${safe}%`,
        );
      }

      // category / cost_center: casa HEADER ou qualquer ITEM. Busca os
      // receipt_ids dos itens que casam e combina via .or(header, id.in(...)).
      // Sanitiza slugs (só [a-z0-9_-]) antes de interpolar no .or() do PostgREST —
      // um slug com vírgula/parêntese corromperia a expressão do filtro.
      const safeCats = categoryArr.filter((cc) => /^[a-z0-9_-]+$/i.test(cc));
      if (safeCats.length > 0) {
        const { data: rows } = await client
          .from("farm_receipt_items")
          .select("receipt_id")
          .in("category", safeCats);
        const ids = [...new Set((rows ?? []).map((r) => r.receipt_id))];
        const ors = [`category.in.(${safeCats.join(",")})`];
        if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
        query = query.or(ors.join(","));
      }
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (costCenterId && UUID_RE.test(costCenterId)) {
        const { data: rows } = await client
          .from("farm_receipt_items")
          .select("receipt_id")
          .eq("cost_center_id", costCenterId);
        const ids = [...new Set((rows ?? []).map((r) => r.receipt_id))];
        const ors = [`cost_center_id.eq.${costCenterId}`];
        if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
        query = query.or(ors.join(","));
      }

      const { data, error } = await query;
      if (error) return c.json({ error: error.message }, 400);

      // ordena itens por position (embed nao garante ordem)
      const receipts = (data ?? []).map((r) => ({
        ...r,
        items: Array.isArray(r.items)
          ? [...r.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          : [],
      }));
      return c.json({ receipts });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/receipts", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }
      if (!body.doc_type) {
        return c.json({ error: "doc_type obrigatorio" }, 400);
      }
      // attachment_key (quando enviado) tem que ser do próprio org — o scan gera
      // "org-<orgId>/...". Bloqueia apontar pro arquivo de outro org.
      if (
        body.attachment_key &&
        !String(body.attachment_key).startsWith(`org-${auth.organizationId}/`)
      ) {
        return c.json({ error: "invalid_attachment_key" }, 400);
      }

      const admin = getSupabaseAdmin();
      const items = parseItems(body.items);
      const hasItems = !!items && items.length > 0;

      // Valida itens + acesso por item; deriva total / zera header cat+cc.
      let totalValue: number;
      let costCenterId: string | null = null;
      let category: string | null = null;
      if (hasItems) {
        const invalid = validateItems(items!);
        if (invalid) return c.json({ error: invalid }, 400);
        if (!(await itemsCCAccessOk(admin, auth.user!.id, items!))) {
          return c.json({ error: "no_access_to_cost_center" }, 403);
        }
        totalValue = sumItems(items!);
        costCenterId = null;
        category = null;
      } else {
        totalValue = Number(body.total_value);
        if (!Number.isFinite(totalValue)) {
          return c.json({ error: "total_value obrigatorio" }, 400);
        }
        category = body.category ?? null;
        // Cost center: usa o que veio ou o default do user (caso simples).
        costCenterId = typeof body.cost_center_id === "string"
          ? body.cost_center_id
          : null;
        if (costCenterId) {
          const ok = await userCanAccessCC(admin, auth.user!.id, costCenterId);
          if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
        } else {
          const def = await getUserDefaultCostCenter(
            admin,
            auth.user!.id,
            auth.organizationId!,
          );
          costCenterId = def?.id ?? null;
        }
      }

      const row = {
        organization_id: auth.organizationId,
        created_by: auth.user!.id,
        farm_id: body.farm_id ?? null,
        cost_center_id: costCenterId,
        doc_type: String(body.doc_type),
        direction: body.direction ?? "expense",
        status: body.status ?? "a_pagar",
        total_value: totalValue,
        currency: body.currency ?? "BRL",
        transaction_date: body.transaction_date ?? null,
        due_date: body.due_date ?? null,
        paid_date: body.paid_date ?? null,
        vendor: body.vendor ?? null,
        vendor_cnpj: body.vendor_cnpj ?? null,
        payment_method: body.payment_method ?? null,
        description: body.description ?? null,
        category,
        invoice_number: body.invoice_number ?? null,
        attachment_key: body.attachment_key ?? null,
        attachment_mime: body.attachment_mime ?? null,
        notes: body.notes ?? null,
        source: body.source ?? "manual",
        ai_confidence: body.ai_confidence ?? null,
        ai_raw: body.ai_raw ?? null,
        item_count: hasItems ? items!.length : 0,
        is_estimated: body.is_estimated === true,
        // "Contabilizar no total": fatura nasce informativa (false); demais true.
        // Body pode sobrescrever (toggle no form).
        counts_in_total:
          typeof body.counts_in_total === "boolean"
            ? body.counts_in_total
            : String(body.doc_type) !== "fatura",
      };

      const { data: receipt, error } = await client
        .from("farm_receipts")
        .insert(row)
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);

      if (hasItems) {
        const { data: insertedItems, error: itemsErr } = await client
          .from("farm_receipt_items")
          .insert(itemRowsFor(receipt.id, auth.organizationId!, items!))
          .select();
        if (itemsErr) {
          // Compensa: sem transacao no PostgREST, desfaz o cabeçalho.
          await client.from("farm_receipts").delete().eq("id", receipt.id);
          return c.json({ error: itemsErr.message }, 400);
        }
        return c.json(
          { receipt: { ...receipt, items: insertedItems ?? [] } },
          201,
        );
      }
      return c.json({ receipt: { ...receipt, items: [] } }, 201);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.patch("/receipts/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }

      const ALLOWED = [
        "farm_id",
        "cost_center_id",
        "doc_type",
        "direction",
        "status",
        "total_value",
        "currency",
        "transaction_date",
        "due_date",
        "paid_date",
        "vendor",
        "vendor_cnpj",
        "payment_method",
        "description",
        "category",
        "invoice_number",
        "notes",
        "ai_confidence",
        "is_estimated",
        "counts_in_total",
      ];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in body) patch[k] = body[k];
      }

      const admin = getSupabaseAdmin();
      const itemsProvided = "items" in body;
      const items = itemsProvided ? parseItems(body.items) ?? [] : null;

      if (items) {
        // items[] presente = replace total dos itens.
        if (items.length > 0) {
          const invalid = validateItems(items);
          if (invalid) return c.json({ error: invalid }, 400);
          if (!(await itemsCCAccessOk(admin, auth.user!.id, items))) {
            return c.json({ error: "no_access_to_cost_center" }, 403);
          }
          patch.total_value = sumItems(items);
          patch.item_count = items.length;
          patch.category = null;
          patch.cost_center_id = null;
        } else {
          // items: [] -> volta a header-only. Exige total_value no body.
          const t = Number(body.total_value);
          if (!Number.isFinite(t)) {
            return c.json({ error: "total_value obrigatorio" }, 400);
          }
          patch.total_value = t;
          patch.item_count = 0;
          // category/cost_center_id ficam o que vier no whitelist (se vier).
        }
      } else if (typeof patch.cost_center_id === "string") {
        // patch legado direto no header: valida acesso ao CC.
        const ok = await userCanAccessCC(
          admin,
          auth.user!.id,
          patch.cost_center_id,
        );
        if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
      }

      // Editar o valor (ou os itens) confirma um lançamento PREVISTO: deixa de
      // ser estimativa e passa a ser "do usuário" (some o ~, e o re-sync da
      // recorrência nao o sobrescreve mais). EXCETO quando o body manda
      // is_estimated explicitamente (o usuário escolheu o estado no form).
      if (
        ("total_value" in body || itemsProvided) &&
        !("is_estimated" in body)
      ) {
        patch.is_estimated = false;
      }

      if (Object.keys(patch).length === 0) {
        return c.json({ error: "no_fields_to_update" }, 400);
      }

      // Itemizado: troca os itens ATIVOS ANTES de mexer no header, com
      // compensação. Se a inserção falhar, restaura os itens antigos — evita
      // deixar o lançamento "itemizado" com zero itens (header já não bate).
      // Itens desmembrados (promoted_to_receipt_id != null) são PRESERVADOS.
      if (items) {
        const { data: oldItems } = await client
          .from("farm_receipt_items")
          .select("*")
          .eq("receipt_id", id)
          .is("promoted_to_receipt_id", null);

        await client
          .from("farm_receipt_items")
          .delete()
          .eq("receipt_id", id)
          .is("promoted_to_receipt_id", null);

        let newItems: unknown[] = [];
        if (items.length > 0) {
          const { data: ins, error: itemsErr } = await client
            .from("farm_receipt_items")
            .insert(itemRowsFor(id, auth.organizationId!, items))
            .select();
          if (itemsErr) {
            // restaura os antigos (compensação) e aborta sem tocar no header
            if (oldItems && oldItems.length > 0) {
              await client.from("farm_receipt_items").insert(oldItems);
            }
            return c.json({ error: itemsErr.message }, 400);
          }
          newItems = ins ?? [];
        }

        const { data: receipt, error } = await client
          .from("farm_receipts")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) return c.json({ error: error.message }, 400);
        if (!receipt) return c.json({ error: "not_found" }, 404);
        return c.json({ receipt: { ...receipt, items: newItems } });
      }

      // Sem mexer em itens: atualiza o header e re-le os itens pra resposta.
      const { data: receipt, error } = await client
        .from("farm_receipts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) return c.json({ error: error.message }, 400);
      if (!receipt) return c.json({ error: "not_found" }, 404);

      const { data: cur } = await client
        .from("farm_receipt_items")
        .select("*")
        .eq("receipt_id", id)
        .order("position");
      return c.json({ receipt: { ...receipt, items: cur ?? [] } });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.delete("/receipts/:id", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const { error, count } = await client
        .from("farm_receipts")
        .delete({ count: "exact" })
        .eq("id", id);

      if (error) return c.json({ error: error.message }, 400);
      if (!count) return c.json({ error: "not_found" }, 404);
      return c.json({ ok: true, deleted: count });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * Converter item em lançamento principal (MOVER/extrair): cria um recibo
   * novo herdando o cabeçalho do pai + categoria/CC/valor do item; remove o
   * item do pai e recalcula total/item_count do pai. So permitido quando o
   * pai tem >= 2 itens (converter o unico deixaria o pai vazio).
   */
  app.post("/receipts/:id/items/:itemId/promote", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const itemId = c.req.param("itemId");

      const { data: parent, error: pErr } = await client
        .from("farm_receipts")
        .select("*")
        .eq("id", id)
        .single();
      if (pErr || !parent) return c.json({ error: "not_found" }, 404);

      const { data: item, error: iErr } = await client
        .from("farm_receipt_items")
        .select("*")
        .eq("id", itemId)
        .eq("receipt_id", id)
        .single();
      if (iErr || !item) return c.json({ error: "item_not_found" }, 404);

      if ((parent.item_count ?? 0) < 2) {
        return c.json({ error: "cannot_promote_last_item" }, 400);
      }

      if (item.cost_center_id) {
        const admin = getSupabaseAdmin();
        const ok = await userCanAccessCC(admin, auth.user!.id, item.cost_center_id);
        if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
      }

      const newRow = {
        organization_id: parent.organization_id,
        created_by: auth.user!.id,
        farm_id: parent.farm_id,
        cost_center_id: item.cost_center_id,
        // Item desmembrado vira um lançamento SIMPLES (não herda o tipo do pai,
        // senão apareceria nas abas Notas/Faturas). Fica só em Lançamentos.
        doc_type: "outro",
        direction: parent.direction,
        status: parent.status,
        total_value: item.total_value,
        currency: parent.currency,
        transaction_date: parent.transaction_date,
        due_date: parent.due_date,
        paid_date: parent.paid_date,
        vendor: parent.vendor,
        vendor_cnpj: parent.vendor_cnpj,
        payment_method: parent.payment_method,
        description: item.description,
        category: item.category,
        invoice_number: parent.invoice_number,
        attachment_key: parent.attachment_key,
        attachment_mime: parent.attachment_mime,
        notes: parent.notes,
        source: parent.source,
        item_count: 0,
        // Desmembrado vira lançamento próprio que SOMA (mesmo vindo de fatura
        // informativa) — é o jeito de "puxar" pro total um gasto da fatura.
        counts_in_total: true,
      };

      const { data: created, error: cErr } = await client
        .from("farm_receipts")
        .insert(newRow)
        .select()
        .single();
      if (cErr) return c.json({ error: cErr.message }, 400);

      // Desmembrar (MOVER, não apagar): marca o item com o lançamento criado.
      // Ele continua na nota/fatura, porém esmaecido e fora do total/contagem.
      await client
        .from("farm_receipt_items")
        .update({ promoted_to_receipt_id: created.id })
        .eq("id", itemId);

      // Recalcula o pai a partir dos itens ATIVOS (ignora desmembrados).
      const { data: remaining } = await client
        .from("farm_receipt_items")
        .select("total_value")
        .eq("receipt_id", id)
        .is("promoted_to_receipt_id", null);
      const remTotal = Number(
        (remaining ?? [])
          .reduce((s, r) => s + (Number(r.total_value) || 0), 0)
          .toFixed(2),
      );
      await client
        .from("farm_receipts")
        .update({ total_value: remTotal, item_count: (remaining ?? []).length })
        .eq("id", id);

      const { data: parentFull } = await client
        .from("farm_receipts")
        .select("*, items:farm_receipt_items!receipt_id(*)")
        .eq("id", id)
        .single();

      return c.json({
        created: { ...created, items: [] },
        parent: parentFull,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * Sugere a melhor categoria (slug) via IA a partir de fornecedor +
   * descricao, escolhendo dentre as categorias que o cliente manda (as que
   * ele ve). Usado pelo botao "Sugerir com IA" do form.
   */
  app.post("/receipts/suggest-category", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      if (!aiRateOk(auth.user!.id)) return c.json({ error: "rate_limited" }, 429);

      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return c.json({ error: "invalid_body" }, 400);
      }
      const direction = body.direction === "income" ? "income" : "expense";
      const cats = Array.isArray(body.categories)
        ? body.categories
            .filter(
              (x: unknown) =>
                x &&
                typeof (x as { slug?: unknown }).slug === "string" &&
                typeof (x as { name?: unknown }).name === "string",
            )
            .map((x: { slug: string; name: string }) => ({
              slug: x.slug,
              name: x.name,
            }))
        : [];

      const res = await suggestCategory(
        {
          vendor: typeof body.vendor === "string" ? body.vendor : null,
          description:
            typeof body.description === "string" ? body.description : null,
          direction,
        },
        cats,
      );
      if (!res.ok) return c.json({ error: res.error }, 502);
      return c.json({ category: res.category });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * Upload imagem + OCR Gemini. NAO cria farm_receipts - so retorna
   * campos extraidos + attachment_key. Cliente revisa e cria via
   * POST /receipts normal com attachment_key referenciado.
   */
  app.post("/receipts/scan", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;
      if (!aiRateOk(auth.user!.id)) return c.json({ error: "rate_limited" }, 429);

      const body = await c.req.json().catch(() => null);
      const imageBase64 = body?.image_base64;
      const mimeType = body?.mime_type;

      if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
        return c.json(
          { error: "image_base64 e mime_type obrigatorios" },
          400,
        );
      }
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return c.json({ error: `mime_type nao permitido: ${mimeType}` }, 400);
      }

      let bytes: Uint8Array;
      try {
        bytes = decodeBase64ToBytes(imageBase64);
      } catch (err) {
        console.error("[scan] base64 decode failed:", err);
        return c.json({ error: "invalid_base64" }, 400);
      }
      if (bytes.byteLength > 10 * 1024 * 1024) {
        return c.json({ error: "image_too_large_10mb_max" }, 413);
      }

      const yyyymm = new Date().toISOString().slice(0, 7);
      const uuid = crypto.randomUUID();
      const ext = extFromMime(mimeType);
      const key = `org-${auth.organizationId}/${yyyymm}/${uuid}.${ext}`;

      try {
        await uploadToR2(key, bytes, mimeType);
      } catch (err) {
        console.error("[scan] R2 upload failed:", err);
        return c.json({ error: "upload_failed" }, 500);
      }

      // Clean base64 (sem data URL prefix) pra Gemini
      const cleanB64 = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      const gemini = await extractReceiptFromImage(cleanB64, mimeType);

      if (!gemini.ok) {
        // Upload feito mas OCR falhou - retorna pra cliente decidir
        return c.json({
          ok: true,
          attachment_key: key,
          attachment_mime: mimeType,
          extracted: null,
          scan_error: gemini.error,
        });
      }

      return c.json({
        ok: true,
        attachment_key: key,
        attachment_mime: mimeType,
        extracted: gemini.data,
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * Presigned URL pra baixar o anexo de um recibo. Bucket R2 e privado, entao
   * o cliente nunca acessa direto. RLS (user client) garante que so o dono da
   * org enxerga o attachment_key; presign tem TTL curto (5min).
   */
  app.get("/receipts/:id/attachment-url", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const { data, error } = await client
        .from("farm_receipts")
        .select("attachment_key")
        .eq("id", id)
        .single();

      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      if (!data.attachment_key) return c.json({ error: "no_attachment" }, 404);

      const url = await presignGetUrl(data.attachment_key, 300);
      return c.json({ url, expires_in: 300 });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  /**
   * GET /receipts/:id/attachment — devolve os BYTES do anexo via o próprio API
   * (proxy server-side do R2). Necessário pro merge em PDF no cliente: o browser
   * não pode `fetch()` o presigned do R2 (sem CORS no bucket); aqui a resposta
   * herda o CORS do edge. RLS garante que só o dono enxerga o attachment_key.
   */
  app.get("/receipts/:id/attachment", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const id = c.req.param("id");
      const { data, error } = await client
        .from("farm_receipts")
        .select("attachment_key, attachment_mime")
        .eq("id", id)
        .single();

      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      if (!data.attachment_key) return c.json({ error: "no_attachment" }, 404);

      const bytes = await getFromR2(data.attachment_key);
      return new Response(bytes, {
        headers: {
          "content-type": data.attachment_mime || "application/octet-stream",
          "cache-control": "private, max-age=300",
        },
      });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });
}
