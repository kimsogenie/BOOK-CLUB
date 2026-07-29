-- 참여 현황에 "기대 포인트" 필드 추가
alter table participations add column if not exists expectation text;
