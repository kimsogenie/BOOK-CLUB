-- ============================================
-- 오류 신고 / 의견 보내기 기능 추가 마이그레이션
-- schema.sql, migration_auth.sql을 이미 실행하셨다면 이 파일만 SQL Editor에서 추가로 실행하세요.
-- ============================================

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  submitter_name text,
  submitter_email text,
  page text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- 누구나 보낼 수 있지만(insert), 읽기는 열어두지 않음 — 소진님은 Supabase 대시보드의
-- Table Editor에서 직접 확인하시면 됩니다 (프로젝트 소유자는 RLS와 무관하게 볼 수 있어요).
create policy "public insert" on feedback for insert with check (true);
