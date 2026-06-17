# Templates de email do gerentia.app

Templates HTML para os emails de autenticação do Supabase, com a marca do gerentia
(símbolo `icon.png`, wordmark "gerent**ia.app**", botão slate-900). Mesmo visual em todos.

## Onde colar

Supabase → **Authentication → Emails → Templates** → escolhe o tipo → cola o HTML no
campo de corpo (modo **Source**) e ajusta o **assunto**. Salva — vale na hora, sem deploy.

| Arquivo | Template do Supabase | Assunto sugerido |
|---------|----------------------|------------------|
| [invite.html](invite.html) | Invite user | Seu convite para o gerentia.app |
| [reset-password.html](reset-password.html) | Reset Password | Redefinir sua senha — gerentia.app |

O mesmo shell serve pra **Confirm signup** e **Magic Link** — é só trocar título/texto/CTA.

## Variáveis (Go template, Supabase)

- `{{ .ConfirmationURL }}` — link de ação (sempre manter)
- `{{ .Email }}` — email do destinatário
- `{{ .Data.full_name }}`, `{{ .Data.farm_name }}` — metadata do usuário (mandado no convite)
- `{{ .SiteURL }}`, `{{ .Token }}` (código OTP), `{{ .RedirectTo }}`

Os templates **não usam `{{ if }}`** de propósito: o preview do Supabase não avalia
condicional e há risco de vazar como texto cru no email real. Saudação fica genérica.
Se quiser personalizar com o nome, dá pra testar `{{ .Data.full_name }}` num envio real
antes de confiar (some/vira "<no value>" se a chave faltar).

## Decisões de email (por que assim)

- **Logo em PNG** (`https://gerentia.app/icon.png`), não SVG: Gmail e outros não renderizam SVG.
- **Sem fonte custom**: o wordmark do app é "Mozilla Headline", que não carrega em cliente de
  email. Usamos stack de sistema (parecido). O símbolo PNG mantém a identidade.
- **CSS inline + layout em `<table>`**: clientes de email ignoram `<style>` externo e flexbox.
- **Botão "bulletproof"** (table + bgcolor + link) pra renderizar igual no Outlook.

## Testar

Manda um convite/reset de verdade pra um email seu e confere render no Gmail + celular.
