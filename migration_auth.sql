-- ============================================
-- 로그인(이메일 매직링크) 기능 추가 마이그레이션
-- schema.sql은 이미 실행하셨으니 다시 실행하지 마시고, 이 파일만 SQL Editor에서 실행하세요.
-- 기존 테이블을 지우지 않고 컬럼만 추가하는 안전한 마이그레이션입니다.
-- ============================================

-- 사용자 프로필 (로그인 후 표시 이름 저장)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "public all" on profiles for all using (true) with check (true);

-- 모임에 방장 계정 연결 (기존 owner_name은 그대로 유지, 표시용)
alter table clubs add column if not exists owner_id uuid references auth.users(id);

-- 모임 멤버에 계정 연결 (로그인하면 기기 상관없이 "내 모임" 조회 가능)
alter table club_members add column if not exists user_id uuid references auth.users(id);
create unique index if not exists idx_club_members_user_club on club_members(club_id, user_id) where user_id is not null;
