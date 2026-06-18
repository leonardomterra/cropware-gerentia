# Deploy — gerentia.app

Projeto Supabase: **`ttnsywnwjybrrtykoqxr`**. Domínio: **gerentia.app**.

## Frontend (Cloudflare Pages)
Deploy **automático no `git push` pra `main`** — o Cloudflare builda e publica. Não precisa de comando manual.
- Build local de verificação: `npm run build` (saída em `build/`).
- Assets em `public/` são servidos na raiz (ex.: `https://gerentia.app/icon-name-gerentia-02.png`).

## Edge function (`gerentia-api`)
**NÃO** sobe sozinha no push — precisa de deploy manual quando algo em `supabase/functions/**` muda
(handlers, prompts de OCR/IA, libs como `gemini.ts`, etc.).

```powershell
# Hidrata o token do registro (User env var) e deploya — sem reiniciar o VS Code.
$env:SUPABASE_ACCESS_TOKEN = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","User")
npx supabase functions deploy gerentia-api --no-verify-jwt --project-ref ttnsywnwjybrrtykoqxr
```

- **`--no-verify-jwt` é obrigatório** (a função tem webhooks públicos: WhatsApp/cron).
- O aviso `Docker is not running` é **inofensivo** — Docker só é usado no `serve` local, não no deploy.
- Inspecionar: https://supabase.com/dashboard/project/ttnsywnwjybrrtykoqxr/functions

### Token de acesso (CLI)
O keyring do Supabase CLI está **quebrado nesta máquina**, então o `supabase login` não persiste — usa-se
o env `SUPABASE_ACCESS_TOKEN` (PAT que começa com `sbp_`, gerado em Account → Access Tokens).

- Persistir uma vez (silencioso): `[Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","sbp_...","User")`.
  Vale pra **processos novos**; a sessão/terminal atuais só enxergam após reiniciar — **por isso** o comando de
  deploy acima lê o valor do registro com `GetEnvironmentVariable(...,"User")` e hidrata na hora.
- Conferir se gravou (sem expor): `$v=[Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","User"); if($v){"SET len=$($v.Length)"}else{"NOT SET"}`.
- **Segurança:** o token fica só na env var de usuário do Windows (registro `HKCU\Environment`), texto plano,
  local à sua conta. **Não vai pro repo, nem pra `.env`, nem pro git.** Tem escopo de conta — se vazar, revogue/rotacione
  no dashboard (Account → Access Tokens).

## Migrations / secrets
- Migrations: `npx supabase db push` (usa `link` + senha do banco). Conferir com `npx supabase migration list`.
- Secrets: painel do dashboard (Settings → Edge Functions → Secrets) ou `npx supabase secrets set` (exige o token).
- Detalhes de setup de projeto novo: ver [FARM-MIGRATION-NEW-PROJECT.md](./FARM-MIGRATION-NEW-PROJECT.md).

## Quando deployar o quê
| Mudou | Ação |
|-------|------|
| `src/**` (frontend) | `git push` → Cloudflare automático |
| `supabase/functions/**` (edge) | `functions deploy gerentia-api --no-verify-jwt` |
| `supabase/migrations/**` | `db push` |
| Templates de email (`docs/email-templates/`) | colar manual no dashboard (Auth → Emails), ~2 min p/ propagar |
