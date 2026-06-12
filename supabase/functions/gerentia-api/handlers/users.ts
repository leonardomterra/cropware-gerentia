import type { Hono } from "npm:hono";

/**
 * Rotas de users_meta + farms + categories. Stubs no commit 7.
 * CRUD real entra junto com as telas correspondentes (V2+).
 */
export function mountUserRoutes(app: Hono) {
  app.get("/farms", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
  app.post("/farms", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
  app.get("/categories", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
  app.post("/categories", (c) =>
    c.json({ error: "not_implemented", todo: "commit_V2" }, 501),
  );
}
