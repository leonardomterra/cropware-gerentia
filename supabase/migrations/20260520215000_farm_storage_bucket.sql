-- Cropware Farm V1 - storage bucket privado pra anexos de recibos.
--
-- Acesso so via service_role da edge function farm-api:
-- - Upload: cliente envia multipart pra POST /receipts/scan, farm-api
--   sobe usando service_role (path: org-{org_id}/{yyyy-mm}/{uuid}.{ext})
-- - Download: farm-api gera signed URL temporaria (5min default)
--
-- Sem policies pra anon/authenticated -> cliente nunca toca direto.
-- 10MB max por arquivo, MIME allowlist (jpeg/png/webp/heic/pdf).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'farm-receipts',
  'farm-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;
