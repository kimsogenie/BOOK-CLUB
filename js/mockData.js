// ==========================================================
// 데모 모드용 목업 시드 데이터
// config.js 에 Supabase 키를 채우면 이 파일은 사용되지 않습니다.
// ==========================================================
function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}

const demoClubId = uid();
const bookOngoingId = uid();
const bookPastId = uid();

window.__mockSeed = {
  clubs: [
    {
      id: demoClubId,
      name: "독서에 정진",
      invite_code: "DEMO01",
      owner_name: "소진",
      created_at: new Date().toISOString()
    }
  ],
  club_members: [
    { id: uid(), club_id: demoClubId, member_name: "소진", joined_at: new Date().toISOString() },
    { id: uid(), club_id: demoClubId, member_name: "민지", joined_at: new Date().toISOString() },
    { id: uid(), club_id: demoClubId, member_name: "현우", joined_at: new Date().toISOString() }
  ],
  announcements: [
    {
      id: uid(),
      club_id: demoClubId,
      content: "제 1회 '독서에 정진'은 7월 26일 일요일입니다.\n읽어야 할 책: 아직 못 읽으신 분들은 서둘러주세요 🙏",
      created_at: new Date().toISOString()
    }
  ],
  books: [
    {
      id: bookOngoingId,
      club_id: demoClubId,
      title: "아몬드",
      author: "손원평",
      cover_url: "",
      description: "감정을 느끼지 못하는 소년 '윤재'가 세상과 부딪히며 성장하는 이야기.",
      meeting_date: "2026-07-26",
      status: "ongoing",
      created_at: new Date().toISOString()
    },
    {
      id: bookPastId,
      club_id: demoClubId,
      title: "달러구트 꿈 백화점",
      author: "이미예",
      cover_url: "",
      description: "잠이 든 사람들이 찾아오는 신비한 꿈 백화점 이야기.",
      meeting_date: "2026-05-10",
      status: "done",
      created_at: new Date().toISOString()
    }
  ],
  participations: [
    { id: uid(), book_id: bookOngoingId, participant_name: "소진", reading_status: "reading", rating: null, one_liner: "", started_at: "2026-07-10", finished_at: null, created_at: new Date().toISOString() },
    { id: uid(), book_id: bookOngoingId, participant_name: "민지", reading_status: "done", rating: 5, one_liner: "울면서 봤어요", started_at: "2026-07-05", finished_at: "2026-07-14", created_at: new Date().toISOString() },
    { id: uid(), book_id: bookOngoingId, participant_name: "현우", reading_status: "before", rating: null, one_liner: "", started_at: null, finished_at: null, created_at: new Date().toISOString() },
    { id: uid(), book_id: bookPastId, participant_name: "소진", reading_status: "done", rating: 4, one_liner: "따뜻한 위로가 되는 책", started_at: "2026-04-20", finished_at: "2026-05-01", created_at: new Date().toISOString() },
    { id: uid(), book_id: bookPastId, participant_name: "민지", reading_status: "done", rating: 4, one_liner: "잔잔하고 좋았음", started_at: "2026-04-22", finished_at: "2026-05-02", created_at: new Date().toISOString() }
  ],
  activities: [
    {
      id: uid(), book_id: bookOngoingId, type: "quote", title: "윤재의 첫 대사",
      author_name: "민지", is_public: true, created_at: new Date().toISOString(),
      quote_text: "감정을 모른다고 마음이 없는 건 아니었다.", quote_page: 42,
      quote_reason: "이 문장에서 윤재를 다시 보게 됐어요."
    },
    {
      id: uid(), book_id: bookOngoingId, type: "topic", title: "감정과 공감의 관계",
      author_name: "소진", is_public: true, created_at: new Date().toISOString(),
      topic_question: "감정을 느끼지 못해도 타인을 이해할 수 있을까?",
      topic_reason: "윤재의 행동을 보면서 궁금해졌어요.",
      topic_my_thought: "저는 공감이 감정보다 학습된 태도에 가깝다고 생각해요."
    },
    {
      id: uid(), book_id: bookOngoingId, type: "review", title: "소진의 독후감",
      author_name: "소진", is_public: true, created_at: new Date().toISOString(),
      review_rating: 5, review_one_liner: "성장이란 무엇인가를 다시 생각하게 함",
      review_pros: "담백한 문장", review_cons: "후반 전개가 조금 급함",
      review_quote: "괴물이라 불려도 상관없었다."
    }
  ],
  activity_likes: [],
  activity_comments: [],
  recommendations: [
    {
      id: uid(), club_id: demoClubId, title: "불편한 편의점", author: "김호연", reason: "가볍게 읽기 좋고 위로가 됨",
      suggested_by: "현우", period_start: "2026-07-01", period_end: "2026-07-31", status: "open",
      created_at: new Date().toISOString()
    }
  ],
  recommendation_votes: [],
  feedback: []
};

// 데모 모드에서 "코드로 찾기"를 바로 체험할 수 있도록 코드 안내
window.__DEMO_CLUB_CODE = "DEMO01";
