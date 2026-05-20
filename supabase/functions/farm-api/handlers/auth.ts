import type { Hono } from "npm:hono";

/**
 * Rotas de auth. Por enquanto stubs. Commit 7+ implementa.
 * Signup atual ocorre via supabase.auth.signUp direto no client +
 * trigger handle_new_farm_user. Esta rota vai centralizar isso
 * com idempotencia, email de boas-vindas, e validacoes extras.
 */
export function mountAuthRoutes(app: Hono) {
  app.get("/auth/me", (c) =>
    c.json({ error: "not_implemented", todo: "commit_8" }, 501),
  );

  app.post("/auth/signup", (c) =>
    c.json({ error: "not_implemented", todo: "commit_8" }, 501),
  );
}
