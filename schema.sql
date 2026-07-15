-- ============================================
-- 독서모임 관리 사이트 - Supabase 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에서 이 파일 전체를 실행하세요.
-- ============================================

-- 모임 (여러 독서모임을 초대 코드로 구분)
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_name text not null,
  created_at timestamptz not null default now()
);

-- 모임 멤버 (참여 이력 + 방장의 멤버 관리용)
create table club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  member_name text not null,
  joined_at timestamptz not null default now(),
  unique (club_id, member_name)
);

-- 공지사항 (최상단 고정 배너, 모임별)
create table announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- 도서 (독서모임에서 다루는 책, 모임별)
create table books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  title text not null,
  author text,
  cover_url text,
  description text,
  meeting_date date,
  status text not null default 'ongoing', -- ongoing(이번 책) | done(지난 모임)
  created_at timestamptz not null default now()
);

-- 참여 현황 (책 x 참여자)
create table participations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  participant_name text not null,
  reading_status text not null default 'before', -- before | reading | done
  rating int check (rating between 1 and 5),
  one_liner text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  unique (book_id, participant_name)
);

-- 활동 기록 (문장수집 / 발제 / 독후감 / 토론 후 감상 - 하나의 테이블에서 통합 관리)
create table activities (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books(id) on delete cascade,
  type text not null, -- quote | topic | review | reflection
  title text not null,
  author_name text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),

  -- 문장 수집 전용
  quote_text text,
  quote_page int,
  quote_reason text,

  -- 발제 전용
  topic_question text,
  topic_reason text,
  topic_my_thought text,

  -- 독후감 전용
  review_rating int check (review_rating between 1 and 5),
  review_one_liner text,
  review_pros text,
  review_cons text,
  review_quote text,

  -- 토론 후 감상 전용
  reflection_story text,
  reflection_learning text,
  reflection_expectation text
);

-- 좋아요 (사람당 활동 1개에 1번만)
create table activity_likes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id) on delete cascade,
  participant_name text not null,
  created_at timestamptz not null default now(),
  unique (activity_id, participant_name)
);

-- 댓글 (주로 발제에 사용, 다른 활동에도 열어둠)
create table activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id) on delete cascade,
  participant_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 추천 도서 (다음 책 추천 / 부록, 모임별)
create table recommendations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete cascade,
  title text not null,
  author text,
  reason text,
  suggested_by text,
  period_start date,
  period_end date,
  status text not null default 'open', -- open | selected | closed
  created_at timestamptz not null default now()
);

-- 추천 도서 투표 (사람당 추천 1개에 1번만)
create table recommendation_votes (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references recommendations(id) on delete cascade,
  participant_name text not null,
  created_at timestamptz not null default now(),
  unique (recommendation_id, participant_name)
);

-- ============================================
-- 자동 계산 뷰: 책별 평균 별점 / 참여 인원
-- ============================================
create view book_stats as
select
  b.id as book_id,
  count(p.id) as participant_count,
  round(avg(p.rating)::numeric, 1) as avg_rating,
  count(p.id) filter (where p.reading_status = 'done') as finished_count
from books b
left join participations p on p.book_id = b.id
group by b.id;

-- 활동별 좋아요 수 뷰
create view activity_like_counts as
select activity_id, count(*) as like_count
from activity_likes
group by activity_id;

-- 추천 도서별 추천 수 뷰
create view recommendation_vote_counts as
select recommendation_id, count(*) as vote_count
from recommendation_votes
group by recommendation_id;

-- ============================================
-- RLS: 소규모 비공개 모임 전제 - 전체 공개 접근 허용
-- (링크를 아는 사람만 접근한다는 전제. 민감한 개인정보는 저장하지 마세요)
-- ============================================
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table announcements enable row level security;
alter table books enable row level security;
alter table participations enable row level security;
alter table activities enable row level security;
alter table activity_likes enable row level security;
alter table activity_comments enable row level security;
alter table recommendations enable row level security;
alter table recommendation_votes enable row level security;

create policy "public all" on clubs for all using (true) with check (true);
create policy "public all" on club_members for all using (true) with check (true);
create policy "public all" on announcements for all using (true) with check (true);
create policy "public all" on books for all using (true) with check (true);
create policy "public all" on participations for all using (true) with check (true);
create policy "public all" on activities for all using (true) with check (true);
create policy "public all" on activity_likes for all using (true) with check (true);
create policy "public all" on activity_comments for all using (true) with check (true);
create policy "public all" on recommendations for all using (true) with check (true);
create policy "public all" on recommendation_votes for all using (true) with check (true);

-- 초대 코드로 빠르게 조회하기 위한 인덱스
create index idx_clubs_invite_code on clubs (invite_code);
