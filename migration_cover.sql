-- ============================================
-- 모임 대표 커버 이미지 기능 추가 마이그레이션
-- 이 파일을 SQL Editor에서 실행한 다음, 아래 "Storage 설정" 안내도 꼭 따라해주세요.
-- ============================================

alter table clubs add column if not exists cover_url text;

-- ============================================
-- Storage 설정 (SQL Editor 말고, 별도로 해주셔야 해요)
-- 1. Supabase 대시보드 왼쪽 메뉴 Storage → "New bucket"
-- 2. 이름: covers   /   "Public bucket" 토글 ON  → 생성
-- 3. 그 다음, 이 SQL Editor에서 아래 정책만 추가로 실행하세요.
-- ============================================
create policy "public insert covers" on storage.objects
  for insert to public with check (bucket_id = 'covers');
