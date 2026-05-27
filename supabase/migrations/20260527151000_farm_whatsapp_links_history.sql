-- Cropware Farm - historico curto de conversa do bot financeiro (Fase B).
--
-- O bot conversacional (lib/farmAi.ts) guarda as ultimas ~12 mensagens por
-- telefone aqui pra dar contexto multi-turno ao Gemini. jsonb de
-- [{ role: 'user'|'model', text: string }].

alter table public.farm_whatsapp_links
  add column if not exists history jsonb not null default '[]'::jsonb;
