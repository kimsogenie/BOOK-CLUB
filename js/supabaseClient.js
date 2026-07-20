// ==========================================================
// DB 추상화 레이어
// - config.js 에 Supabase 키가 채워져 있으면 실제 Supabase에 연결
// - 비어있으면 mockData.js 의 시드 데이터로 "데모 모드" 동작
// app.js 는 이 파일이 제공하는 DB.* 함수만 호출하면 됩니다.
// ==========================================================

const DEMO_MODE = !CLUB_CONFIG.SUPABASE_URL || !CLUB_CONFIG.SUPABASE_ANON_KEY;

let sb = null;
if (!DEMO_MODE) {
  sb = window.supabase.createClient(CLUB_CONFIG.SUPABASE_URL, CLUB_CONFIG.SUPABASE_ANON_KEY);
}

// ---- 데모 모드용 인메모리 스토어 (새로고침하면 초기화됨) ----
let mockStore = null;
function getMockStore() {
  if (!mockStore) {
    mockStore = JSON.parse(JSON.stringify(window.__mockSeed));
  }
  return mockStore;
}
function mockUid() {
  return "id-" + Math.random().toString(36).slice(2, 10);
}
function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const DB = {
  isDemo: DEMO_MODE,
  authEnabled: !DEMO_MODE,

  // ================= 인증 (이메일 매직링크) =================
  async getSession() {
    if (DEMO_MODE) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  },
  onAuthChange(callback) {
    if (DEMO_MODE) return;
    sb.auth.onAuthStateChange((_event, session) => callback(session));
  },
  async sendMagicLink(email) {
    if (DEMO_MODE) throw new Error("데모 모드에서는 로그인이 필요 없어요");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  },
  async signOut() {
    if (DEMO_MODE) return;
    await sb.auth.signOut();
  },
  async getProfile(userId) {
    if (DEMO_MODE) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async createProfile(userId, displayName) {
    if (DEMO_MODE) return null;
    const { data, error } = await sb.from("profiles").insert({ id: userId, display_name: displayName }).select().single();
    if (error) throw error;
    return data;
  },
  async getMyClubs(userId) {
    if (DEMO_MODE || !userId) return [];
    const { data, error } = await sb.from("club_members").select("clubs(id,name,invite_code,owner_id,owner_name,cover_url)").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map(r => r.clubs).filter(Boolean);
  },

  // ================= 모임 커버 이미지 =================
  async uploadCoverImage(file) {
    if (DEMO_MODE) {
      // 데모 모드는 실제 저장소가 없으니, 이 브라우저 세션 동안만 미리보기용으로 보여줘요
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `club-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("covers").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from("covers").getPublicUrl(path);
    return data.publicUrl;
  },

  async updateClub(clubId, fields) {
    if (DEMO_MODE) {
      const row = getMockStore().clubs.find(c => c.id === clubId);
      if (row) Object.assign(row, fields);
      return row;
    }
    const { data, error } = await sb.from("clubs").update(fields).eq("id", clubId).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 오류 신고 / 의견 =================
  async submitFeedback(message, name, email, page) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), message, submitter_name: name || null, submitter_email: email || null, page: page || null, created_at: new Date().toISOString() };
      getMockStore().feedback.push(row);
      return row;
    }
    const { data, error } = await sb.from("feedback").insert({
      message, submitter_name: name || null, submitter_email: email || null, page: page || null
    }).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 모임 (clubs) =================
  async createClub(name, ownerName, ownerId) {
    const invite_code = genInviteCode();
    let club;
    if (DEMO_MODE) {
      club = { id: mockUid(), name, invite_code, owner_name: ownerName, owner_id: ownerId || null, created_at: new Date().toISOString() };
      getMockStore().clubs.push(club);
    } else {
      const payload = { name, invite_code, owner_name: ownerName };
      if (ownerId) payload.owner_id = ownerId;
      const { data, error } = await sb.from("clubs").insert(payload).select().single();
      if (error) throw error;
      club = data;
    }
    await this.joinClub(club.id, ownerName, ownerId);
    return club;
  },

  async getClubByCode(code) {
    const normalized = code.trim().toUpperCase();
    if (DEMO_MODE) {
      return getMockStore().clubs.find(c => c.invite_code === normalized) || null;
    }
    const { data, error } = await sb.from("clubs").select("*").eq("invite_code", normalized).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getClubById(id) {
    if (DEMO_MODE) {
      return getMockStore().clubs.find(c => c.id === id) || null;
    }
    const { data, error } = await sb.from("clubs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async deleteClub(clubId) {
    if (DEMO_MODE) {
      const store = getMockStore();
      const bookIds = store.books.filter(b => b.club_id === clubId).map(b => b.id);
      const actIds = store.activities.filter(a => bookIds.includes(a.book_id)).map(a => a.id);
      store.activity_likes = store.activity_likes.filter(l => !actIds.includes(l.activity_id));
      store.activity_comments = store.activity_comments.filter(c => !actIds.includes(c.activity_id));
      store.activities = store.activities.filter(a => !bookIds.includes(a.book_id));
      store.participations = store.participations.filter(p => !bookIds.includes(p.book_id));
      store.books = store.books.filter(b => b.club_id !== clubId);
      const recoIds = store.recommendations.filter(r => r.club_id === clubId).map(r => r.id);
      store.recommendation_votes = store.recommendation_votes.filter(v => !recoIds.includes(v.recommendation_id));
      store.recommendations = store.recommendations.filter(r => r.club_id !== clubId);
      store.announcements = store.announcements.filter(a => a.club_id !== clubId);
      store.club_members = store.club_members.filter(m => m.club_id !== clubId);
      store.clubs = store.clubs.filter(c => c.id !== clubId);
      return true;
    }
    const { error } = await sb.from("clubs").delete().eq("id", clubId);
    if (error) throw error;
    return true;
  },

  // ================= 멤버 =================
  async joinClub(clubId, name, userId) {
    if (DEMO_MODE) {
      const store = getMockStore();
      const exists = store.club_members.some(m => m.club_id === clubId && m.member_name === name);
      if (!exists) store.club_members.push({ id: mockUid(), club_id: clubId, member_name: name, joined_at: new Date().toISOString() });
      return true;
    }
    if (userId) {
      // 1) 이미 이 계정으로 연결된 멤버십이 있으면 이름만 갱신
      const { data: byUser } = await sb.from("club_members").select("id").eq("club_id", clubId).eq("user_id", userId).maybeSingle();
      if (byUser) {
        await sb.from("club_members").update({ member_name: name }).eq("id", byUser.id);
        return true;
      }
      // 2) 로그인 기능 도입 전, 이름만으로 만들어진 예전 멤버십이 있으면 계정과 연결
      const { data: byName } = await sb.from("club_members").select("id").eq("club_id", clubId).eq("member_name", name).is("user_id", null).maybeSingle();
      if (byName) {
        await sb.from("club_members").update({ user_id: userId }).eq("id", byName.id);
        return true;
      }
      // 3) 둘 다 없으면 새로 추가
      await sb.from("club_members").insert({ club_id: clubId, member_name: name, user_id: userId });
    } else {
      const { data } = await sb.from("club_members").select("id").eq("club_id", clubId).eq("member_name", name).maybeSingle();
      if (!data) await sb.from("club_members").insert({ club_id: clubId, member_name: name });
    }
    return true;
  },

  async getMembers(clubId) {
    if (DEMO_MODE) {
      return getMockStore().club_members.filter(m => m.club_id === clubId).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    }
    const { data, error } = await sb.from("club_members").select("*").eq("club_id", clubId).order("joined_at");
    if (error) throw error;
    return data || [];
  },

  async kickMember(clubId, name) {
    if (DEMO_MODE) {
      const store = getMockStore();
      store.club_members = store.club_members.filter(m => !(m.club_id === clubId && m.member_name === name));
      return true;
    }
    const { error } = await sb.from("club_members").delete().eq("club_id", clubId).eq("member_name", name);
    if (error) throw error;
    return true;
  },

  // ================= 모임 갤러리 =================
  async uploadGalleryPhoto(file) {
    if (DEMO_MODE) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from("gallery").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from("gallery").getPublicUrl(path);
    return data.publicUrl;
  },

  async addGalleryPhoto(clubId, imageUrl, uploaderName, caption) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), club_id: clubId, image_url: imageUrl, uploader_name: uploaderName || null, caption: caption || null, created_at: new Date().toISOString() };
      getMockStore().gallery_photos.push(row);
      return row;
    }
    const { data, error } = await sb.from("gallery_photos").insert({
      club_id: clubId, image_url: imageUrl, uploader_name: uploaderName || null, caption: caption || null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async getGalleryPhotos(clubId) {
    if (DEMO_MODE) {
      return getMockStore().gallery_photos.filter(p => p.club_id === clubId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    const { data, error } = await sb.from("gallery_photos").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async deleteGalleryPhoto(photoId) {
    if (DEMO_MODE) {
      const store = getMockStore();
      store.gallery_photos = store.gallery_photos.filter(p => p.id !== photoId);
      return true;
    }
    const { error } = await sb.from("gallery_photos").delete().eq("id", photoId);
    if (error) throw error;
    return true;
  },

  // ================= 공지사항 =================
  async getLatestAnnouncement(clubId) {
    if (DEMO_MODE) {
      const list = getMockStore().announcements.filter(a => a.club_id === clubId);
      if (!list.length) return null;
      return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    }
    const { data, error } = await sb.from("announcements").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  },

  async addAnnouncement(clubId, content) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), club_id: clubId, content, created_at: new Date().toISOString() };
      getMockStore().announcements.push(row);
      return row;
    }
    const { data, error } = await sb.from("announcements").insert({ club_id: clubId, content }).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 도서 =================
  async getCurrentBook(clubId) {
    if (DEMO_MODE) {
      const list = getMockStore().books.filter(b => b.club_id === clubId && b.status === "ongoing");
      if (!list.length) return null;
      return [...list].sort((a, b) => (b.meeting_date || "").localeCompare(a.meeting_date || ""))[0];
    }
    const { data, error } = await sb.from("books").select("*").eq("club_id", clubId).eq("status", "ongoing")
      .order("meeting_date", { ascending: false }).limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  },

  async getPastBooks(clubId) {
    if (DEMO_MODE) {
      return getMockStore().books.filter(b => b.club_id === clubId && b.status === "done")
        .sort((a, b) => (b.meeting_date || "").localeCompare(a.meeting_date || ""));
    }
    const { data, error } = await sb.from("books").select("*").eq("club_id", clubId).eq("status", "done").order("meeting_date", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getBookById(id) {
    if (DEMO_MODE) {
      return getMockStore().books.find(b => b.id === id) || null;
    }
    const { data, error } = await sb.from("books").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  async addBook(clubId, payload) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), club_id: clubId, status: "ongoing", created_at: new Date().toISOString(), ...payload };
      getMockStore().books.push(row);
      return row;
    }
    const { data, error } = await sb.from("books").insert({ club_id: clubId, status: "ongoing", ...payload }).select().single();
    if (error) throw error;
    return data;
  },

  async updateBook(id, fields) {
    if (DEMO_MODE) {
      const row = getMockStore().books.find(b => b.id === id);
      if (row) Object.assign(row, fields);
      return row;
    }
    const { data, error } = await sb.from("books").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async getBookStats(bookId) {
    if (DEMO_MODE) {
      const parts = getMockStore().participations.filter(p => p.book_id === bookId);
      const rated = parts.filter(p => p.rating != null);
      const avg = rated.length ? rated.reduce((s, p) => s + p.rating, 0) / rated.length : null;
      return {
        book_id: bookId,
        participant_count: parts.length,
        avg_rating: avg != null ? Math.round(avg * 10) / 10 : null,
        finished_count: parts.filter(p => p.reading_status === "done").length
      };
    }
    const { data, error } = await sb.from("book_stats").select("*").eq("book_id", bookId).maybeSingle();
    if (error) throw error;
    return data || { book_id: bookId, participant_count: 0, avg_rating: null, finished_count: 0 };
  },

  // ================= 참여 현황 =================
  async getParticipations(bookId) {
    if (DEMO_MODE) {
      return getMockStore().participations.filter(p => p.book_id === bookId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    const { data, error } = await sb.from("participations").select("*").eq("book_id", bookId).order("created_at");
    if (error) throw error;
    return data || [];
  },

  async addParticipant(bookId, name) {
    if (DEMO_MODE) {
      const row = {
        id: mockUid(), book_id: bookId, participant_name: name, reading_status: "before",
        rating: null, one_liner: "", started_at: null, finished_at: null, created_at: new Date().toISOString()
      };
      getMockStore().participations.push(row);
      return row;
    }
    const { data, error } = await sb.from("participations").insert({ book_id: bookId, participant_name: name }).select().single();
    if (error) throw error;
    return data;
  },

  async updateParticipation(id, fields) {
    if (DEMO_MODE) {
      const row = getMockStore().participations.find(p => p.id === id);
      if (row) Object.assign(row, fields);
      return row;
    }
    const { data, error } = await sb.from("participations").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 활동 기록 =================
  async getActivities(bookId, type, sort, meName) {
    let acts;
    if (DEMO_MODE) {
      acts = getMockStore().activities.filter(a => a.book_id === bookId && a.type === type);
    } else {
      const { data, error } = await sb.from("activities").select("*").eq("book_id", bookId).eq("type", type)
        .order("created_at", { ascending: false });
      if (error) throw error;
      acts = data || [];
    }
    acts = acts.map(a => ({ ...a }));
    for (const a of acts) {
      a.like_count = await this._likeCount(a.id);
      a.liked_by_me = await this._isLiked(a.id, meName);
    }
    if (sort === "likes") {
      acts.sort((a, b) => b.like_count - a.like_count || b.created_at.localeCompare(a.created_at));
    } else {
      acts.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return acts;
  },

  async getActivityCountsByAuthor(bookId) {
    let acts;
    if (DEMO_MODE) {
      acts = getMockStore().activities.filter(a => a.book_id === bookId);
    } else {
      const { data, error } = await sb.from("activities").select("author_name").eq("book_id", bookId);
      if (error) throw error;
      acts = data || [];
    }
    const counts = {};
    for (const a of acts) {
      const name = a.author_name || "익명";
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  },

  async addActivity(payload) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), created_at: new Date().toISOString(), is_public: true, ...payload };
      getMockStore().activities.push(row);
      return row;
    }
    const { data, error } = await sb.from("activities").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async _likeCount(activityId) {
    if (DEMO_MODE) {
      return getMockStore().activity_likes.filter(l => l.activity_id === activityId).length;
    }
    const { count, error } = await sb.from("activity_likes").select("*", { count: "exact", head: true }).eq("activity_id", activityId);
    if (error) throw error;
    return count || 0;
  },

  async _isLiked(activityId, name) {
    if (!name) return false;
    if (DEMO_MODE) {
      return getMockStore().activity_likes.some(l => l.activity_id === activityId && l.participant_name === name);
    }
    const { data, error } = await sb.from("activity_likes").select("id").eq("activity_id", activityId).eq("participant_name", name).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async toggleLike(activityId, name) {
    if (!name) throw new Error("이름이 필요해요");
    if (DEMO_MODE) {
      const store = getMockStore();
      const idx = store.activity_likes.findIndex(l => l.activity_id === activityId && l.participant_name === name);
      if (idx >= 0) store.activity_likes.splice(idx, 1);
      else store.activity_likes.push({ id: mockUid(), activity_id: activityId, participant_name: name, created_at: new Date().toISOString() });
    } else {
      const { data } = await sb.from("activity_likes").select("id").eq("activity_id", activityId).eq("participant_name", name).maybeSingle();
      if (data) {
        await sb.from("activity_likes").delete().eq("id", data.id);
      } else {
        await sb.from("activity_likes").insert({ activity_id: activityId, participant_name: name });
      }
    }
    return { liked: await this._isLiked(activityId, name), count: await this._likeCount(activityId) };
  },

  async getComments(activityId) {
    if (DEMO_MODE) {
      return getMockStore().activity_comments.filter(c => c.activity_id === activityId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    const { data, error } = await sb.from("activity_comments").select("*").eq("activity_id", activityId).order("created_at");
    if (error) throw error;
    return data || [];
  },

  async addComment(activityId, name, content) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), activity_id: activityId, participant_name: name, content, created_at: new Date().toISOString() };
      getMockStore().activity_comments.push(row);
      return row;
    }
    const { data, error } = await sb.from("activity_comments").insert({ activity_id: activityId, participant_name: name, content }).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 추천 도서 =================
  async getRecommendations(clubId) {
    let recos;
    if (DEMO_MODE) {
      recos = getMockStore().recommendations.filter(r => r.club_id === clubId).map(r => ({ ...r }));
    } else {
      const { data, error } = await sb.from("recommendations").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
      if (error) throw error;
      recos = data || [];
    }
    for (const r of recos) {
      r.vote_count = await this._voteCount(r.id);
    }
    recos.sort((a, b) => b.vote_count - a.vote_count);
    return recos;
  },

  async _voteCount(recoId) {
    if (DEMO_MODE) {
      return getMockStore().recommendation_votes.filter(v => v.recommendation_id === recoId).length;
    }
    const { count, error } = await sb.from("recommendation_votes").select("*", { count: "exact", head: true }).eq("recommendation_id", recoId);
    if (error) throw error;
    return count || 0;
  },

  async hasVoted(recoId, name) {
    if (!name) return false;
    if (DEMO_MODE) {
      return getMockStore().recommendation_votes.some(v => v.recommendation_id === recoId && v.participant_name === name);
    }
    const { data, error } = await sb.from("recommendation_votes").select("id").eq("recommendation_id", recoId).eq("participant_name", name).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async addRecommendation(clubId, payload) {
    if (DEMO_MODE) {
      const row = { id: mockUid(), club_id: clubId, status: "open", created_at: new Date().toISOString(), ...payload };
      getMockStore().recommendations.push(row);
      return row;
    }
    const { data, error } = await sb.from("recommendations").insert({ club_id: clubId, ...payload }).select().single();
    if (error) throw error;
    return data;
  },

  async toggleVote(recoId, name) {
    if (!name) throw new Error("이름이 필요해요");
    if (DEMO_MODE) {
      const store = getMockStore();
      const idx = store.recommendation_votes.findIndex(v => v.recommendation_id === recoId && v.participant_name === name);
      if (idx >= 0) store.recommendation_votes.splice(idx, 1);
      else store.recommendation_votes.push({ id: mockUid(), recommendation_id: recoId, participant_name: name, created_at: new Date().toISOString() });
    } else {
      const { data } = await sb.from("recommendation_votes").select("id").eq("recommendation_id", recoId).eq("participant_name", name).maybeSingle();
      if (data) await sb.from("recommendation_votes").delete().eq("id", data.id);
      else await sb.from("recommendation_votes").insert({ recommendation_id: recoId, participant_name: name });
    }
    return { voted: await this.hasVoted(recoId, name), count: await this._voteCount(recoId) };
  },

  async setRecommendationStatus(id, status) {
    if (DEMO_MODE) {
      const row = getMockStore().recommendations.find(r => r.id === id);
      if (row) row.status = status;
      return row;
    }
    const { data, error } = await sb.from("recommendations").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // ================= 마이페이지 =================
  async getMyData(clubId, name) {
    if (DEMO_MODE) {
      const store = getMockStore();
      const clubBookIds = new Set(store.books.filter(b => b.club_id === clubId).map(b => b.id));
      const books = Object.fromEntries(store.books.map(b => [b.id, b]));
      const participations = store.participations.filter(p => p.participant_name === name && clubBookIds.has(p.book_id))
        .map(p => ({ ...p, book_title: books[p.book_id]?.title || "" }));
      const activities = store.activities.filter(a => a.author_name === name && clubBookIds.has(a.book_id))
        .map(a => ({ ...a, book_title: books[a.book_id]?.title || "" }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { participations, activities };
    }
    const [{ data: participations, error: e1 }, { data: activities, error: e2 }] = await Promise.all([
      sb.from("participations").select("*, books!inner(title, club_id)").eq("participant_name", name).eq("books.club_id", clubId),
      sb.from("activities").select("*, books!inner(title, club_id)").eq("author_name", name).eq("books.club_id", clubId).order("created_at", { ascending: false })
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    return {
      participations: (participations || []).map(p => ({ ...p, book_title: p.books?.title || "" })),
      activities: (activities || []).map(a => ({ ...a, book_title: a.books?.title || "" }))
    };
  }
};
