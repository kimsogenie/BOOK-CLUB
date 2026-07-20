-- 모임 갤러리 기능: 사진 테이블 + Storage 버킷 정책
-- Supabase SQL Editor에서 실행하세요.

create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  image_url text not null,
  uploader_name text,
  caption text,
  created_at timestamptz not null default now()
);

alter table gallery_photos enable row level security;
create policy "public all" on gallery_photos for all using (true) with check (true);

-- Storage: "gallery"라는 이름으로 Public 버킷을 먼저 만들어주세요.
-- (Supabase 대시보드 → Storage → New bucket → 이름 gallery, Public bucket 체크)
create policy "public insert gallery" on storage.objects
  for insert to public with check (bucket_id = 'gallery');
