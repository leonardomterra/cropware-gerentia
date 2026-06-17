# Status — configuração de emails de autenticação (gerentia.app)

_Atualizado: 2026-06-17. Parado porque o dashboard do Supabase estava fora do ar._

Objetivo: emails de auth (convite, reset de senha…) saindo por **SMTP próprio** e com **templates da marca gerentia**.

---

## ✅ Feito

- **Diagnóstico:** o convite "não chegava" não era bug de código — o `inviteUserByEmail` retornava sucesso; o problema era **entrega de email** (o serviço embutido do Supabase é limitado/dev-only).
- **SMTP próprio configurado** (Resend → domínio `cropware.com.br`, que já estava *Verified*). Confirmado funcionando ("deu certo").
- **Código do fluxo de convite** (commit `d43875c`, na `main`, pushed):
  - `src/contexts/AuthContext.tsx` — passou a tratar `type=invite` igual a `recovery` → o link do convite abre a tela **"Nova Senha"**.
  - `supabase/functions/gerentia-api/handlers/admin.ts` — convite agora manda `redirectTo: https://gerentia.app`.
  - Frontend sobe sozinho na Cloudflare no push. **Edge ainda precisa de redeploy** (ver pendências).
- **Templates criados e versionados** em `docs/email-templates/`: `invite.html`, `reset-password.html`, `README.md`. O `invite.html` já está **sem os `{{ if }}`** (saudação genérica, segura).
- **Ícone do email** verificado: `https://gerentia.app/icon.png` retorna `200 / image/png`. O "quebrado" no preview do Supabase é só o sandbox não carregar imagem externa — no email real aparece.

---

## ⏳ Pendente (retomar aqui)

1. **Re-colar o invite corrigido** no Supabase (Authentication → Emails → Templates → **Invite user** → modo **Source**): copiar o `invite.html` atualizado (sem `{{ if }}`). Ajustar o **Subject** de "You've been invited" → **`Seu convite para o gerentia.app`**.
2. **Colar o reset** (template **Reset Password**): conteúdo de `reset-password.html` (pode colar como está). Subject → **`Redefinir sua senha — gerentia.app`**.
3. **Redeploy da edge** (pro `redirectTo` do convite valer):
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # keyring quebrado nesta máquina; usar env
   npx supabase functions deploy gerentia-api --no-verify-jwt --project-ref ttnsywnwjybrrtykoqxr
   ```
4. **Conferir Redirect URLs**: garantir que `https://gerentia.app` está em Auth → URL Configuration (senão o link do convite é recusado).
5. **(Opcional) Subir o rate limit** de emails em Auth → Rate Limits (o padrão é baixo).
6. **Commitar** os arquivos de `docs/email-templates/` (ainda não commitados).
7. **Teste end-to-end**: convidar um email **novo** (não pode já existir) → email chega de `gerentia@cropware.com.br` → clicar no link → abre `gerentia.app` na tela **Nova Senha** → definir senha → entra.

---

## Valores de referência

**SMTP (Supabase → Authentication → Emails → SMTP Settings):**

| Campo | Valor |
|-------|-------|
| Sender email | `gerentia@cropware.com.br` |
| Sender name | `gerentia.app` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a sua **Resend API key** (`re_…`) — *não salva aqui* |

**Links do dashboard (projeto `ttnsywnwjybrrtykoqxr`):**
- Emails/Templates: https://supabase.com/dashboard/project/ttnsywnwjybrrtykoqxr/auth/templates
- URL Configuration: https://supabase.com/dashboard/project/ttnsywnwjybrrtykoqxr/auth/url-configuration
- Rate Limits: https://supabase.com/dashboard/project/ttnsywnwjybrrtykoqxr/auth/rate-limits
- Logs (Auth): https://supabase.com/dashboard/project/ttnsywnwjybrrtykoqxr/logs/auth-logs

**Notas:**
- Templates do **Supabase** (não do Resend) — mesmo enviando por SMTP do Resend, o HTML vem dos templates do Supabase.
- Imagens de email costumam ser bloqueadas por padrão até o usuário clicar "exibir imagens" — normal.
- Auth do Supabase CLI nesta máquina: o keyring não funciona; usar `SUPABASE_ACCESS_TOKEN` (PAT `sbp_`).
