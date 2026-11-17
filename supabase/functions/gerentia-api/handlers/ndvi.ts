import type { Hono } from "npm:hono";
import { getUserClient, requireFarmUser, requireModule } from "../lib/userClient.ts";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.ts";
import {
  INDICES,
  comCache,
  datasDisponiveis,
  estatisticasDoIndice,
  imagemDoIndice,
  noCache,
  type Anel,
  type Indice,
} from "../lib/planetaryComputer.ts";

/**
 * NDVI e índices de vegetação do módulo Field (fase 5 da unificação).
 *
 * Quem pode: tem o módulo Field (requireModule). Sem plano por enquanto
 * (decisão de 16/11/2026): o teto é de TETO imagens por mês por ORGANIZAÇÃO,
 * conferido aqui. Só a rota de imagem conta (datas e estatísticas não).
 *
 * O contorno do talhão é lido com o client do USUÁRIO (RLS): ninguém pede NDVI
 * de talhão que não enxerga.
 */
const TETO = 120;
const UMA_HORA = 3600e3;
const TRES_DIAS = 72 * UMA_HORA;

// deno-lint-ignore no-explicit-any
async function anelDoTalhao(client: any, plotId: unknown): Promise<Anel | Response> {
  if (typeof plotId !== "string") return Response.json({ error: "plot_id obrigatorio" }, { status: 400 });
  const { data } = await client.from("farm_plots").select("geometry").eq("id", plotId).maybeSingle();
  if (!data) return Response.json({ error: "talhao_nao_encontrado" }, { status: 404 });
  const g = data.geometry;
  if (!g || g.type !== "Polygon" || !Array.isArray(g.coordinates?.[0]) || g.coordinates[0].length < 4) {
    return Response.json(
      { error: "talhao_sem_contorno", detalhe: "Desenhe o contorno do talhão para ver o NDVI." },
      { status: 400 },
    );
  }
  return g.coordinates[0] as Anel;
}

const indiceValido = (v: unknown): v is Indice =>
  v === "RGB" || (typeof v === "string" && (INDICES as readonly string[]).includes(v));

export function mountNdviRoutes(app: Hono) {
  // Autenticação + módulo, numa função só para as 4 rotas.
  // deno-lint-ignore no-explicit-any
  const entrar = async (c: any) => {
    const client = getUserClient(c.req.raw);
    const auth = await requireFarmUser(client);
    if (auth.error) return { erro: auth.error };
    const semModulo = await requireModule(client, "field");
    if (semModulo) return { erro: semModulo };
    return { client, auth };
  };

  app.get("/campo/ndvi/uso", async (c) => {
    try {
      const e = await entrar(c);
      if ("erro" in e) return e.erro;
      const { data } = await getSupabaseAdmin().rpc("farm_uso_ndvi_no_mes", {
        p_org: e.auth.organizationId,
      });
      return c.json({ usado: Number(data ?? 0), teto: TETO });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      throw resp;
    }
  });

  app.post("/campo/ndvi/datas", async (c) => {
    try {
      const e = await entrar(c);
      if ("erro" in e) return e.erro;
      const body = await c.req.json().catch(() => ({}));
      const anel = await anelDoTalhao(e.client, body.plot_id);
      if (anel instanceof Response) return anel;
      const ate = typeof body.ate === "string" ? body.ate : undefined;
      const datas = await comCache(`datas:${body.plot_id}:${ate ?? ""}:${JSON.stringify(anel)}`, UMA_HORA, () =>
        datasDisponiveis(anel, ate)
      );
      return c.json({ datas });
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[ndvi/datas]", resp);
      return c.json({ error: "satelite_indisponivel" }, 502);
    }
  });

  app.post("/campo/ndvi/imagem", async (c) => {
    try {
      const e = await entrar(c);
      if ("erro" in e) return e.erro;
      const body = await c.req.json().catch(() => ({}));
      if (typeof body.scene_id !== "string") return c.json({ error: "scene_id obrigatorio" }, 400);
      if (!indiceValido(body.indice)) return c.json({ error: "indice_invalido" }, 400);
      const anel = await anelDoTalhao(e.client, body.plot_id);
      if (anel instanceof Response) return anel;

      const chave = `img:${body.scene_id}:${body.indice}:${JSON.stringify(anel)}`;
      // Do cache não conta: a org já pagou por essa imagem.
      if (!noCache(chave)) {
        const { data: uso, error } = await getSupabaseAdmin().rpc("farm_registrar_uso_ndvi", {
          p_org: e.auth.organizationId,
          p_teto: TETO,
        });
        if (error) {
          console.error("[ndvi/imagem] cota:", error.message);
          return c.json({ error: "cota_indisponivel" }, 503);
        }
        if (!uso?.permitido) {
          return c.json({ error: "teto_atingido", usado: uso?.usado, teto: TETO }, 429);
        }
      }
      const r = await comCache(chave, TRES_DIAS, () => imagemDoIndice(anel, body.scene_id, body.indice));
      return c.json(r);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      console.error("[ndvi/imagem]", resp);
      return c.json({ error: "satelite_indisponivel" }, 502);
    }
  });

  app.post("/campo/ndvi/estatisticas", async (c) => {
    try {
      const e = await entrar(c);
      if ("erro" in e) return e.erro;
      const body = await c.req.json().catch(() => ({}));
      if (typeof body.scene_id !== "string") return c.json({ error: "scene_id obrigatorio" }, 400);
      if (!indiceValido(body.indice) || body.indice === "RGB") {
        return c.json({ error: "indice_invalido" }, 400);
      }
      const anel = await anelDoTalhao(e.client, body.plot_id);
      if (anel instanceof Response) return anel;
      const r = await comCache(`stats:${body.scene_id}:${body.indice}:${JSON.stringify(anel)}`, TRES_DIAS, () =>
        estatisticasDoIndice(anel, body.scene_id, body.indice)
      );
      return c.json(r);
    } catch (resp) {
      if (resp instanceof Response) return resp;
      // Erro de verdade (o Flag Field devolvia números inventados aqui).
      console.error("[ndvi/estatisticas]", resp);
      return c.json({ error: "estatistica_indisponivel" }, 502);
    }
  });
}
