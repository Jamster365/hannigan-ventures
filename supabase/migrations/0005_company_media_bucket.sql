-- Public bucket for company imagery copied from companies' own websites
-- (with origin and attribution recorded in company_media). Only the service
-- role writes to it; images are public company marketing assets.
-- Guarded so plain-Postgres test databases without Supabase Storage still migrate.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('company-media', 'company-media', true, 4000000, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
