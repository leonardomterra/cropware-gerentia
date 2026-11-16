import type { Hono } from "npm:hono";

/**
 * Rotas de users_meta + categories. Stubs no commit 7.
 * Fazendas saíram daqui (16/11/2026): o módulo Field faz o CRUD direto no
 * banco, pela RLS — ver docs/UNIFICACAO-FIELD.md §8.
 */
export function mountUserRoutes(app: Hono) {
  app.get("/categories", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
  app.post("/categories", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
}
