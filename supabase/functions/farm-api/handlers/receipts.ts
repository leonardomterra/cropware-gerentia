import type { Hono } from "npm:hono";

/**
 * Rotas de farm_receipts. Stubs no commit 7.
 * Implementacao real (CRUD + upload R2 + scan via Gemini) entra no commit 9.
 */
export function mountReceiptRoutes(app: Hono) {
  app.get("/receipts", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9" }, 501),
  );
  app.post("/receipts", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9" }, 501),
  );
  app.patch("/receipts/:id", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9" }, 501),
  );
  app.delete("/receipts/:id", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9" }, 501),
  );
  app.post("/receipts/scan", (c) =>
    c.json({ error: "not_implemented", todo: "commit_9" }, 501),
  );
}
