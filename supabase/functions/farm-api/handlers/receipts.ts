import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser } from "../lib/userClient.ts";
import { uploadToR2, presignGetUrl } from "../lib/r2.ts";
import { extractReceiptFromImage } from "../lib/gemini.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import { getUserDefaultCostCenter, userCanAccessCC } from "../lib/cc.ts";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

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

/**
 * Rotas de farm_receipts. Auth via JWT do user; RLS scopes por org.
 *
 * GET /receipts?status=&category=&direction=&from=&to=&search=&limit=
 * POST /receipts
 * PATCH /receipts/:id
 * DELETE /receipts/:id
 *
 * Scan via /receipts/scan vem no commit 8c.
 */
export function mountReceiptRoutes(app: Hono) {
  app.get("/receipts", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

      const q = new URL(c.req.url).searchParams;
      // status e category aceitam CSV ("a_pagar,vencido") pra multi-select.
      // split(",") e .in() no supabase. Valor unico tb funciona em .in().
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
      const limit = Math.min(Number(q.get("limit") ?? 100), 500);

      let query = client
        .from("farm_receipts")
        .select("*")
        .order("transaction_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (statusArr.length > 0) query = query.in("status", statusArr);
      if (categoryArr.length > 0) query = query.in("category", categoryArr);
      if (direction) query = query.eq("direction", direction);
      if (costCenterId) query = query.eq("cost_center_id", costCenterId);
      if (from) query = query.gte("transaction_date", from);
      if (to) query = query.lte("transaction_date", to);
      if (search) {
        const safe = search.replace(/[%,]/g, "");
        query = query.or(
          `vendor.ilike.%${safe}%,description.ilike.%${safe}%,invoice_number.ilike.%${safe}%`,
        );
      }

      const { data, error } = await query;
      if (error) return c.json({ error: error.message }, 400);
      return c.json({ receipts: data ?? [] });
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

      const totalValue = Number(body.total_value);
      if (!body.doc_type || !Number.isFinite(totalValue)) {
        return c.json(
          { error: "doc_type e total_value sao obrigatorios" },
          400,
        );
      }

      // Cost center: usa o que veio, ou default do user. Valida acesso pra cortar
      // erro feio de RLS depois.
      const admin = getSupabaseAdmin();
      let costCenterId: string | null = typeof body.cost_center_id === "string"
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
        category: body.category ?? null,
        invoice_number: body.invoice_number ?? null,
        attachment_key: body.attachment_key ?? null,
        attachment_mime: body.attachment_mime ?? null,
        notes: body.notes ?? null,
        source: body.source ?? "manual",
        ai_confidence: body.ai_confidence ?? null,
        ai_raw: body.ai_raw ?? null,
      };

      const { data, error } = await client
        .from("farm_receipts")
        .insert(row)
        .select()
        .single();

      if (error) return c.json({ error: error.message }, 400);
      return c.json({ receipt: data }, 201);
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

      // Whitelist - nao deixa user trocar org_id, created_by, id, timestamps
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
      ];
      const patch: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in body) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "no_fields_to_update" }, 400);
      }

      // Valida acesso ao novo cost_center_id se sendo trocado.
      if (typeof patch.cost_center_id === "string") {
        const admin = getSupabaseAdmin();
        const ok = await userCanAccessCC(
          admin,
          auth.user!.id,
          patch.cost_center_id,
        );
        if (!ok) return c.json({ error: "no_access_to_cost_center" }, 403);
      }

      const { data, error } = await client
        .from("farm_receipts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) return c.json({ error: error.message }, 400);
      if (!data) return c.json({ error: "not_found" }, 404);
      return c.json({ receipt: data });
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
   * Upload imagem + OCR Gemini. NAO cria farm_receipts - so retorna
   * campos extraidos + attachment_key. Cliente revisa e cria via
   * POST /receipts normal com attachment_key referenciado.
   */
  app.post("/receipts/scan", async (c) => {
    try {
      const client = getUserClient(c.req.raw);
      const auth = await requireFarmUser(client);
      if (auth.error) return auth.error;

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
}
