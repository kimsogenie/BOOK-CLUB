// ==========================================================
// 독서모임 대시보드 - 메인 앱 로직
// ==========================================================

const TYPE_LABEL = { quote: "문장 수집", topic: "발제", review: "독후감", reflection: "토론 후 감상" };
const TYPE_FIELDS = {
  quote: [
    { key: "quote_text", label: "인상 깊은 문장", type: "textarea", required: true },
    { key: "quote_page", label: "페이지", type: "number" },
    { key: "quote_reason", label: "선택한 이유", type: "textarea" }
  ],
  topic: [
    { key: "topic_question", label: "질문", type: "textarea", required: true },
    { key: "topic_reason", label: "질문을 던진 이유", type: "textarea" },
    { key: "topic_my_thought", label: "내 생각", type: "textarea" }
  ],
  review: [
    { key: "review_rating", label: "별점 (1~5)", type: "number" },
    { key: "review_one_liner", label: "한 줄 평", type: "text", required: true },
    { key: "review_pros", label: "좋았던 점", type: "textarea" },
    { key: "review_cons", label: "아쉬웠던 점", type: "textarea" },
    { key: "review_quote", label: "오래 기억에 남는 문장", type: "textarea" }
  ],
  reflection: [
    { key: "reflection_story", label: "가장 기억에 남는 이야기", type: "textarea", required: true },
    { key: "reflection_learning", label: "새롭게 알게 된 점", type: "textarea" },
    { key: "reflection_expectation", label: "다음 책에서 기대하는 점", type: "textarea" }
  ]
};
const STATUS_LABEL = { before: "시작 전", reading: "읽는 중", done: "완독" };
const RECO_STATUS_LABEL = { open: "추천중", selected: "선정됨", closed: "종료" };

const state = {
  myName: localStorage.getItem("clubMyName") || "",
  clubId: localStorage.getItem("clubId") || "",
  club: null,
  isOwner: false,
  currentBook: null,
  activeType: "quote",
  sort: "new"
};

// ---------------- 유틸 ----------------
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(d) { return d ? d : "-"; }
function requireName() {
  if (!state.myName) {
    document.getElementById("nameGate").classList.remove("hidden");
    return false;
  }
  return true;
}
function requireOwner() {
  if (!state.isOwner) {
    alert("방장만 할 수 있는 기능이에요.");
    return false;
  }
  return true;
}
function openGenericModal(html) {
  document.getElementById("genericModalBody").innerHTML = html;
  document.getElementById("genericModal").classList.remove("hidden");
}
function closeGenericModal() { document.getElementById("genericModal").classList.add("hidden"); }
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

// ==========================================================
// 부팅: 랜딩(모임 찾기/만들기) vs 대시보드 진입
// ==========================================================
async function boot() {
  if (DB.isDemo) {
    document.getElementById("landingDemoHint").classList.remove("hidden");
    document.getElementById("landingDemoHint").textContent =
      `🧪 데모 모드: "내 독서모임 찾기"에서 초대 코드 ${window.__DEMO_CLUB_CODE || "DEMO01"} 을 입력하면 예시 모임으로 바로 들어갈 수 있어요.`;
  }
  initLandingHandlers();

  if (state.clubId) {
    try {
      const club = await DB.getClubById(state.clubId);
      if (club) { await enterApp(club); return; }
    } catch (e) { /* 무시하고 랜딩으로 */ }
    localStorage.removeItem("clubId");
  }
  showLanding();
}

function showLanding() {
  document.getElementById("landingScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function initLandingHandlers() {
  document.getElementById("createClubBtn").addEventListener("click", async () => {
    const name = document.getElementById("createClubName").value.trim();
    const myName = document.getElementById("createClubMyName").value.trim();
    const msg = document.getElementById("landingMsg");
    if (!name || !myName) { msg.textContent = "모임 이름과 내 이름을 모두 입력해주세요."; return; }
    msg.textContent = "만드는 중...";
    try {
      const club = await DB.createClub(name, myName);
      state.myName = myName;
      localStorage.setItem("clubMyName", myName);
      msg.textContent = "";
      document.getElementById("createdInviteCode").textContent = club.invite_code;
      document.getElementById("clubCreatedModal").classList.remove("hidden");
      document.getElementById("copyInviteCodeBtn").onclick = () => copyText(club.invite_code);
      document.getElementById("enterDashboardBtn").onclick = () => enterApp(club);
    } catch (e) {
      msg.textContent = "모임 생성에 실패했어요. 잠시 후 다시 시도해주세요.";
    }
  });

  document.getElementById("joinClubBtn").addEventListener("click", async () => {
    const code = document.getElementById("joinClubCode").value.trim();
    const myName = document.getElementById("joinClubMyName").value.trim();
    const msg = document.getElementById("landingMsg");
    if (!code || !myName) { msg.textContent = "초대 코드와 내 이름을 모두 입력해주세요."; return; }
    msg.textContent = "찾는 중...";
    try {
      const club = await DB.getClubByCode(code);
      if (!club) { msg.textContent = "해당 코드의 모임을 찾을 수 없어요. 코드를 다시 확인해주세요."; return; }
      await DB.joinClub(club.id, myName);
      state.myName = myName;
      localStorage.setItem("clubMyName", myName);
      msg.textContent = "";
      await enterApp(club);
    } catch (e) {
      msg.textContent = "참여에 실패했어요. 잠시 후 다시 시도해주세요.";
    }
  });
}

async function enterApp(club) {
  state.club = club;
  state.clubId = club.id;
  localStorage.setItem("clubId", club.id);
  state.isOwner = !!state.myName && state.myName === club.owner_name;

  document.getElementById("clubCreatedModal").classList.add("hidden");
  document.getElementById("landingScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");

  document.getElementById("clubTitle").textContent = club.name;
  const badge = document.getElementById("inviteCodeBadge");
  badge.textContent = club.invite_code;
  badge.classList.remove("hidden");
  badge.title = "클릭하면 코드가 복사돼요";
  badge.onclick = () => copyText(club.invite_code);

  if (DB.isDemo) document.getElementById("demoBanner").classList.remove("hidden");

  updateOwnerUI();
  initNameGate();
  initModals();
  initAnnouncementEditor();
  initAddParticipant();
  initActivityTabs();
  initMemberManagement();
  initBookOwnerActions();
  initLeaveAndDelete();
  renderActivityForm();
  renderRecoForm();

  await loadAnnouncement();
  await loadCurrentBook();
  await loadRecommendations();
  await loadArchive();
  await loadMyPage();
}

function updateOwnerUI() {
  const show = el => el.classList.toggle("hidden", !state.isOwner);
  show(document.getElementById("editAnnouncementBtn"));
  show(document.getElementById("bookOwnerActions"));
  show(document.getElementById("manageMembersBtn"));
  show(document.getElementById("dangerZone"));
}

// ---------------- 이름 게이트 ----------------
function initNameGate() {
  const gate = document.getElementById("nameGate");
  const input = document.getElementById("nameInput");
  if (state.myName) gate.classList.add("hidden"); else gate.classList.remove("hidden");
  input.value = state.myName;
  document.getElementById("whoamiName").textContent = state.myName || "미접속";

  document.getElementById("nameSubmit").onclick = async () => {
    const v = input.value.trim();
    if (!v) return;
    state.myName = v;
    localStorage.setItem("clubMyName", v);
    document.getElementById("whoamiName").textContent = v;
    state.isOwner = !!state.club && v === state.club.owner_name;
    updateOwnerUI();
    if (state.club) await DB.joinClub(state.club.id, v);
    gate.classList.add("hidden");
    await refreshUserDependentViews();
  };
  input.onkeydown = e => { if (e.key === "Enter") document.getElementById("nameSubmit").click(); };

  document.getElementById("switchNameBtn").onclick = () => gate.classList.remove("hidden");
}

async function refreshUserDependentViews() {
  if (state.currentBook) await loadActivities();
  await loadRecommendations();
  await loadMyPage();
}

function initLeaveAndDelete() {
  document.getElementById("leaveClubBtn").onclick = () => {
    if (!confirm("모임에서 나가시겠어요? 초대 코드를 다시 입력하면 언제든 돌아올 수 있어요.")) return;
    localStorage.removeItem("clubId");
    location.reload();
  };
  document.getElementById("deleteClubBtn").onclick = async () => {
    if (!requireOwner()) return;
    if (!confirm("정말로 모임을 삭제할까요? 책, 활동기록, 추천 등 모든 데이터가 사라지고 되돌릴 수 없어요.")) return;
    if (!confirm("마지막 확인이에요. 정말 삭제할까요?")) return;
    await DB.deleteClub(state.clubId);
    localStorage.removeItem("clubId");
    location.reload();
  };
}

// ---------------- 멤버 관리 (방장 전용) ----------------
function initMemberManagement() {
  document.getElementById("manageMembersBtn").onclick = async () => {
    if (!requireOwner()) return;
    const members = await DB.getMembers(state.clubId);
    openGenericModal(`
      <h3>👥 멤버 관리</h3>
      <p style="font-size:12px;color:var(--muted)">초대 코드: <b>${esc(state.club.invite_code)}</b></p>
      ${members.map(m => `
        <div class="member-row">
          <span>${esc(m.member_name)}${m.member_name === state.club.owner_name ? '<span class="owner-tag">방장</span>' : ""}</span>
          ${m.member_name !== state.club.owner_name ? `<button class="ghost-btn small danger" data-kick="${esc(m.member_name)}">강퇴</button>` : ""}
        </div>
      `).join("") || `<p style="color:#999;font-size:13px">멤버가 없어요.</p>`}
    `);
    document.querySelectorAll("[data-kick]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.kick;
        if (!confirm(`${name}님을 모임에서 내보낼까요?`)) return;
        await DB.kickMember(state.clubId, name);
        closeGenericModal();
      });
    });
  };
}

// ---------------- 공지사항 ----------------
async function loadAnnouncement() {
  const row = await DB.getLatestAnnouncement(state.clubId);
  document.getElementById("announcementBody").textContent = row ? row.content : "등록된 공지사항이 없어요.";
}

function initAnnouncementEditor() {
  document.getElementById("editAnnouncementBtn").onclick = () => {
    if (!requireOwner()) return;
    openGenericModal(`
      <h3>📢 공지사항 편집</h3>
      <label>새 공지 내용</label>
      <textarea id="newAnnouncementText" placeholder="예: 다음 모임은 8월 9일입니다."></textarea>
      <div class="submit-row"><button class="primary-btn" id="submitAnnouncement">등록</button></div>
    `);
    document.getElementById("submitAnnouncement").addEventListener("click", async () => {
      const val = document.getElementById("newAnnouncementText").value.trim();
      if (!val) return;
      await DB.addAnnouncement(state.clubId, val);
      closeGenericModal();
      await loadAnnouncement();
    });
  };
}

// ---------------- 이번 독서모임 책 ----------------
async function loadCurrentBook() {
  const book = await DB.getCurrentBook(state.clubId);
  state.currentBook = book;
  const wrap = document.getElementById("currentBook");
  if (!book) {
    wrap.innerHTML = state.isOwner
      ? "<p>등록된 진행 중인 책이 없어요. 위의 '+ 책 등록' 버튼으로 추가해보세요.</p>"
      : "<p>등록된 진행 중인 책이 없어요.</p>";
    document.getElementById("progressBarWrap").innerHTML = "";
    document.getElementById("participationBody").innerHTML = "";
    return;
  }
  const stats = await DB.getBookStats(book.id);
  wrap.innerHTML = `
    <img src="${esc(book.cover_url) || ""}" onerror="this.style.display='none'" alt="표지">
    <div class="book-meta">
      <div class="book-title">${esc(book.title)}</div>
      <div class="book-author">${esc(book.author || "")}</div>
      <div class="book-desc">${esc(book.description || "")}</div>
      <div class="stat-row">
        <span class="stat-pill">📅 ${fmtDate(book.meeting_date)}</span>
        <span class="stat-pill">⭐ 평균 ${stats.avg_rating != null ? stats.avg_rating : "-"}</span>
        <span class="stat-pill">👥 참여 ${stats.participant_count}명</span>
      </div>
    </div>
  `;
  renderProgressBar(stats);
  await loadParticipation();
  await loadActivities();
}

function renderProgressBar(stats) {
  const wrap = document.getElementById("progressBarWrap");
  const pct = stats.participant_count ? Math.round((stats.finished_count / stats.participant_count) * 100) : 0;
  wrap.innerHTML = `
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-label">완독 ${stats.finished_count} / ${stats.participant_count}명 (${pct}%)</div>
  `;
}

function initBookOwnerActions() {
  document.getElementById("addBookBtn").onclick = () => {
    if (!requireOwner()) return;
    openGenericModal(`
      <h3>+ 책 등록</h3>
      <label>제목 *</label><input id="newBookTitle">
      <label>저자</label><input id="newBookAuthor">
      <label>표지 이미지 URL</label><input id="newBookCover" placeholder="https://...">
      <label>소개</label><textarea id="newBookDesc"></textarea>
      <label>모임 날짜</label><input type="date" id="newBookDate">
      <p style="font-size:11px;color:var(--muted)">등록하면 기존에 진행 중이던 책은 자동으로 '지난 독서모임'으로 이동해요.</p>
      <div class="submit-row"><button class="primary-btn" id="submitNewBook">등록</button></div>
    `);
    document.getElementById("submitNewBook").addEventListener("click", async () => {
      const title = document.getElementById("newBookTitle").value.trim();
      if (!title) { alert("제목을 입력해주세요."); return; }
      const prev = await DB.getCurrentBook(state.clubId);
      if (prev) await DB.updateBook(prev.id, { status: "done" });
      await DB.addBook(state.clubId, {
        title,
        author: document.getElementById("newBookAuthor").value.trim() || null,
        cover_url: document.getElementById("newBookCover").value.trim() || null,
        description: document.getElementById("newBookDesc").value.trim() || null,
        meeting_date: document.getElementById("newBookDate").value || null
      });
      closeGenericModal();
      await loadCurrentBook();
      await loadArchive();
    });
  };

  document.getElementById("finishBookBtn").onclick = async () => {
    if (!requireOwner()) return;
    if (!state.currentBook) { alert("완료 처리할 책이 없어요."); return; }
    if (!confirm(`'${state.currentBook.title}'을(를) 완료 처리하고 지난 독서모임으로 옮길까요?`)) return;
    await DB.updateBook(state.currentBook.id, { status: "done" });
    await loadCurrentBook();
    await loadArchive();
  };
}

// ---------------- 참여 현황 ----------------
async function loadParticipation() {
  if (!state.currentBook) return;
  const rows = await DB.getParticipations(state.currentBook.id);
  const tbody = document.getElementById("participationBody");
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td>${esc(r.participant_name)}</td>
      <td>
        <select data-field="reading_status">
          ${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${r.reading_status === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="1" max="5" data-field="rating" value="${r.rating ?? ""}" style="width:50px"></td>
      <td><input type="text" data-field="one_liner" value="${esc(r.one_liner || "")}"></td>
      <td><input type="date" data-field="started_at" value="${r.started_at || ""}"></td>
      <td><input type="date" data-field="finished_at" value="${r.finished_at || ""}"></td>
    </tr>
  `).join("") || `<tr><td colspan="6" style="color:#999">아직 참여자가 없어요.</td></tr>`;

  tbody.querySelectorAll("tr").forEach(tr => {
    const id = tr.dataset.id;
    tr.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("change", async () => {
        if (!requireName()) return;
        const field = el.dataset.field;
        let val = el.value;
        if (field === "rating") val = val ? Number(val) : null;
        if ((field === "started_at" || field === "finished_at") && val === "") val = null;
        await DB.updateParticipation(id, { [field]: val });
        const stats = await DB.getBookStats(state.currentBook.id);
        renderProgressBar(stats);
        await loadCurrentBookStatsOnly(stats);
      });
    });
  });
}

async function loadCurrentBookStatsOnly(stats) {
  const pills = document.querySelectorAll("#currentBook .stat-pill");
  if (pills.length === 3) {
    pills[1].textContent = `⭐ 평균 ${stats.avg_rating != null ? stats.avg_rating : "-"}`;
    pills[2].textContent = `👥 참여 ${stats.participant_count}명`;
  }
}

function initAddParticipant() {
  document.getElementById("addParticipantBtn").onclick = () => {
    if (!requireName()) return;
    if (!state.currentBook) { alert("등록된 책이 없어요."); return; }
    openGenericModal(`
      <h3>+ 참여자 추가</h3>
      <label>이름</label>
      <input id="newParticipantName" placeholder="예: 소진" value="${esc(state.myName)}">
      <div class="submit-row"><button class="primary-btn" id="submitParticipant">추가</button></div>
    `);
    document.getElementById("submitParticipant").addEventListener("click", async () => {
      const name = document.getElementById("newParticipantName").value.trim();
      if (!name) return;
      try { await DB.addParticipant(state.currentBook.id, name); } catch (e) { /* 중복 등 무시 */ }
      await DB.joinClub(state.clubId, name);
      closeGenericModal();
      await loadParticipation();
      const stats = await DB.getBookStats(state.currentBook.id);
      renderProgressBar(stats);
      await loadCurrentBookStatsOnly(stats);
    });
  };
}

// ---------------- 활동 기록 ----------------
function renderActivityForm() {
  const type = state.activeType;
  const fields = TYPE_FIELDS[type];
  const wrap = document.getElementById("activityFormWrap");
  wrap.innerHTML = fields.map(f => `
    <label>${f.label}${f.required ? " *" : ""}</label>
    ${f.type === "textarea"
      ? `<textarea data-field="${f.key}"></textarea>`
      : `<input type="${f.type}" data-field="${f.key}" ${f.type === "number" ? 'min="1" max="5"' : ""}>`}
  `).join("") + `<div class="submit-row"><button class="primary-btn" id="submitActivity">${TYPE_LABEL[type]} 등록</button></div>`;

  document.getElementById("submitActivity").addEventListener("click", async () => {
    if (!requireName()) return;
    if (!state.currentBook) { alert("등록된 책이 없어요."); return; }
    const payload = { book_id: state.currentBook.id, type, author_name: state.myName, is_public: true };
    let missing = false;
    fields.forEach(f => {
      const el = wrap.querySelector(`[data-field="${f.key}"]`);
      let val = el.value.trim();
      if (f.required && !val) missing = true;
      if (f.type === "number" && val !== "") val = Number(val);
      if (val === "") val = null;
      payload[f.key] = val;
    });
    if (missing) { alert("필수 항목을 입력해주세요."); return; }
    payload.title = deriveTitle(type, payload);
    await DB.addActivity(payload);
    renderActivityForm();
    await loadActivities();
  });
}

function deriveTitle(type, payload) {
  const clip = (s, n) => (s || "").slice(0, n);
  if (type === "quote") return clip(payload.quote_text, 24) || "문장 수집";
  if (type === "topic") return clip(payload.topic_question, 30) || "발제";
  if (type === "review") return `${payload.author_name}의 독후감`;
  if (type === "reflection") return `토론 후 감상 - ${payload.author_name}`;
  return TYPE_LABEL[type];
}

async function loadActivities() {
  if (!state.currentBook) return;
  document.getElementById("activityListLabel").textContent = `${TYPE_LABEL[state.activeType]} 목록`;
  const list = await DB.getActivities(state.currentBook.id, state.activeType, state.sort, state.myName);
  renderActivityList(list, state.activeType, "activityList", true);
}

function renderActivityBody(type, a) {
  const rows = [];
  if (type === "quote") {
    rows.push(["문장", a.quote_text]);
    if (a.quote_page) rows.push(["페이지", a.quote_page]);
    if (a.quote_reason) rows.push(["선택한 이유", a.quote_reason]);
  } else if (type === "topic") {
    rows.push(["질문", a.topic_question]);
    if (a.topic_reason) rows.push(["이유", a.topic_reason]);
    if (a.topic_my_thought) rows.push(["내 생각", a.topic_my_thought]);
  } else if (type === "review") {
    if (a.review_rating) rows.push(["별점", "⭐".repeat(a.review_rating)]);
    if (a.review_one_liner) rows.push(["한 줄 평", a.review_one_liner]);
    if (a.review_pros) rows.push(["좋았던 점", a.review_pros]);
    if (a.review_cons) rows.push(["아쉬웠던 점", a.review_cons]);
    if (a.review_quote) rows.push(["기억에 남는 문장", a.review_quote]);
  } else if (type === "reflection") {
    rows.push(["기억에 남는 이야기", a.reflection_story]);
    if (a.reflection_learning) rows.push(["새롭게 알게 된 점", a.reflection_learning]);
    if (a.reflection_expectation) rows.push(["다음 책 기대", a.reflection_expectation]);
  }
  return `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
}

function renderActivityList(list, type, containerId, allowComments) {
  const container = document.getElementById(containerId);
  if (!list.length) {
    container.innerHTML = `<p style="color:#999;font-size:13px">아직 등록된 내용이 없어요.</p>`;
    return;
  }
  container.innerHTML = list.map(a => `
    <div class="activity-item" data-id="${a.id}">
      <div class="a-head">
        <span><span class="a-title">${esc(a.title)}</span> · <span class="a-author">${esc(a.author_name)}</span></span>
        <span>${new Date(a.created_at).toLocaleDateString("ko-KR")}</span>
      </div>
      <div class="a-body">${renderActivityBody(type, a)}</div>
      <div class="a-foot">
        <button class="like-btn ${a.liked_by_me ? "liked" : ""}" data-act="like">❤ ${a.like_count}</button>
        ${allowComments ? `<span class="comment-toggle" data-act="comment-toggle">💬 댓글</span>` : ""}
      </div>
      ${allowComments ? `<div class="comment-box hidden" data-role="comment-box"></div>` : ""}
    </div>
  `).join("");

  container.querySelectorAll(".activity-item").forEach(item => {
    const id = item.dataset.id;
    const likeBtn = item.querySelector('[data-act="like"]');
    likeBtn.addEventListener("click", async () => {
      if (!requireName()) return;
      const res = await DB.toggleLike(id, state.myName);
      likeBtn.textContent = `❤ ${res.count}`;
      likeBtn.classList.toggle("liked", res.liked);
      if (state.sort === "likes") await loadActivities();
    });
    const ctoggle = item.querySelector('[data-act="comment-toggle"]');
    if (ctoggle) ctoggle.addEventListener("click", () => toggleComments(item, id));
  });
}

async function toggleComments(item, activityId) {
  const box = item.querySelector('[data-role="comment-box"]');
  const isHidden = box.classList.contains("hidden");
  if (isHidden) {
    box.classList.remove("hidden");
    await renderComments(box, activityId);
  } else {
    box.classList.add("hidden");
  }
}

async function renderComments(box, activityId) {
  const comments = await DB.getComments(activityId);
  box.innerHTML = comments.map(c => `<div class="comment-line"><b>${esc(c.participant_name)}</b>${esc(c.content)}</div>`).join("")
    + `<div class="comment-input-row"><input placeholder="댓글을 남겨보세요" data-role="comment-input"><button class="ghost-btn small" data-role="comment-submit">등록</button></div>`;
  box.querySelector('[data-role="comment-submit"]').addEventListener("click", async () => {
    if (!requireName()) return;
    const input = box.querySelector('[data-role="comment-input"]');
    const val = input.value.trim();
    if (!val) return;
    await DB.addComment(activityId, state.myName, val);
    input.value = "";
    await renderComments(box, activityId);
  });
}

function initActivityTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeType = btn.dataset.type;
      renderActivityForm();
      await loadActivities();
    });
  });
  document.getElementById("activitySort").addEventListener("change", async e => {
    state.sort = e.target.value;
    await loadActivities();
  });
}

// ---------------- 추천 도서 ----------------
function renderRecoForm() {
  const wrap = document.getElementById("recoFormWrap");
  wrap.innerHTML = `
    <label>책 제목 *</label><input id="recoTitle">
    <label>저자</label><input id="recoAuthor">
    <label>추천 이유</label><textarea id="recoReason"></textarea>
    <label>추천 기간</label>
    <div style="display:flex;gap:8px">
      <input type="date" id="recoStart" style="flex:1">
      <input type="date" id="recoEnd" style="flex:1">
    </div>
    <div class="submit-row"><button class="primary-btn" id="submitReco">추천 등록</button></div>
  `;
  document.getElementById("submitReco").addEventListener("click", async () => {
    if (!requireName()) return;
    const title = document.getElementById("recoTitle").value.trim();
    if (!title) { alert("책 제목을 입력해주세요."); return; }
    await DB.addRecommendation(state.clubId, {
      title,
      author: document.getElementById("recoAuthor").value.trim() || null,
      reason: document.getElementById("recoReason").value.trim() || null,
      suggested_by: state.myName,
      period_start: document.getElementById("recoStart").value || null,
      period_end: document.getElementById("recoEnd").value || null
    });
    renderRecoForm();
    await loadRecommendations();
  });
}

async function loadRecommendations() {
  const list = await DB.getRecommendations(state.clubId);
  const container = document.getElementById("recoList");
  if (!list.length) {
    container.innerHTML = `<p style="color:#999;font-size:13px">등록된 추천 도서가 없어요.</p>`;
    return;
  }
  const withVoted = await Promise.all(list.map(async r => ({ ...r, voted: await DB.hasVoted(r.id, state.myName) })));
  container.innerHTML = withVoted.map(r => `
    <div class="reco-item" data-id="${r.id}">
      <div>
        <div class="reco-title">${esc(r.title)} ${r.author ? `<span style="font-weight:400;color:var(--muted);font-size:12px">· ${esc(r.author)}</span>` : ""}
          <span class="status-badge ${r.status}">${RECO_STATUS_LABEL[r.status]}</span>
        </div>
        <div class="reco-meta">추천: ${esc(r.suggested_by || "-")} · 기간 ${fmtDate(r.period_start)} ~ ${fmtDate(r.period_end)} · 추천 ${r.vote_count}표</div>
        ${r.reason ? `<div class="reco-reason">${esc(r.reason)}</div>` : ""}
        ${r.status === "open" && state.isOwner ? `<div style="margin-top:8px"><button class="ghost-btn small" data-act="select">이 책으로 선정</button></div>` : ""}
      </div>
      <button class="vote-btn ${r.voted ? "voted" : ""}" data-act="vote">${r.voted ? "추천 취소" : "추천하기"}</button>
    </div>
  `).join("");

  container.querySelectorAll(".reco-item").forEach(item => {
    const id = item.dataset.id;
    item.querySelector('[data-act="vote"]').addEventListener("click", async () => {
      if (!requireName()) return;
      await DB.toggleVote(id, state.myName);
      await loadRecommendations();
    });
    const selectBtn = item.querySelector('[data-act="select"]');
    if (selectBtn) {
      selectBtn.addEventListener("click", async () => {
        if (!requireOwner()) return;
        if (!confirm("이 책을 다음 독서모임 책으로 선정할까요?")) return;
        await DB.setRecommendationStatus(id, "selected");
        await loadRecommendations();
      });
    }
  });
}

// ---------------- 지난 독서모임 ----------------
async function loadArchive() {
  const books = await DB.getPastBooks(state.clubId);
  const container = document.getElementById("archiveList");
  if (!books.length) {
    container.innerHTML = `<p style="color:#999;font-size:13px">아직 지난 독서모임 기록이 없어요.</p>`;
    return;
  }
  const withStats = await Promise.all(books.map(async b => ({ ...b, stats: await DB.getBookStats(b.id) })));
  container.innerHTML = withStats.map(b => `
    <div class="archive-item" data-id="${b.id}">
      <img src="${esc(b.cover_url) || ""}" onerror="this.style.display='none'">
      <div>
        <div class="archive-title">${esc(b.title)}</div>
        <div class="archive-meta">${esc(b.author || "")} · ⭐ ${b.stats.avg_rating ?? "-"} · 👥 ${b.stats.participant_count}명 · ${fmtDate(b.meeting_date)}</div>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".archive-item").forEach(item => {
    item.addEventListener("click", () => openBookDetail(item.dataset.id));
  });
}

async function openBookDetail(bookId) {
  const book = await DB.getBookById(bookId);
  const stats = await DB.getBookStats(bookId);
  const parts = await DB.getParticipations(bookId);
  const types = ["review", "topic", "quote", "reflection"];
  const sections = await Promise.all(types.map(async t => ({ t, list: await DB.getActivities(bookId, t, "new", state.myName) })));

  const body = document.getElementById("bookDetailBody");
  body.innerHTML = `
    <h2>${esc(book.title)}</h2>
    <p style="color:var(--muted);font-size:13px">${esc(book.author || "")} · ${fmtDate(book.meeting_date)} · ⭐ 평균 ${stats.avg_rating ?? "-"} · 👥 ${stats.participant_count}명</p>
    <p style="font-size:13px">${esc(book.description || "")}</p>
    <h4>참여 기록</h4>
    <table class="data-table"><thead><tr><th>참여자</th><th>별점</th><th>한 줄 평</th></tr></thead>
      <tbody>${parts.map(p => `<tr><td>${esc(p.participant_name)}</td><td>${p.rating ? "⭐".repeat(p.rating) : "-"}</td><td>${esc(p.one_liner || "")}</td></tr>`).join("") || `<tr><td colspan="3" style="color:#999">기록 없음</td></tr>`}</tbody>
    </table>
    ${sections.map(s => `
      <h4 style="margin-top:16px">${TYPE_LABEL[s.t]}</h4>
      <div id="archive-${s.t}"></div>
    `).join("")}
  `;
  sections.forEach(s => renderActivityList(s.list, s.t, `archive-${s.t}`, false));
  document.getElementById("bookDetailModal").classList.remove("hidden");
}

// ---------------- 마이페이지 ----------------
async function loadMyPage() {
  const container = document.getElementById("myPage");
  if (!state.myName) {
    container.innerHTML = `<p style="color:#999;font-size:13px">이름을 입력하면 내가 남긴 활동을 모아볼 수 있어요.</p>`;
    return;
  }
  const { participations, activities } = await DB.getMyData(state.clubId, state.myName);
  const grouped = { quote: [], topic: [], review: [], reflection: [] };
  activities.forEach(a => { if (grouped[a.type]) grouped[a.type].push(a); });

  container.innerHTML = `
    <div class="my-section">
      <h4>📖 내가 읽은 책 (${participations.length})</h4>
      ${participations.map(p => `<div style="font-size:13px;margin-bottom:4px">· ${esc(p.book_title)} — ${STATUS_LABEL[p.reading_status] || p.reading_status}${p.rating ? " · ⭐" + p.rating : ""}</div>`).join("") || `<p style="color:#999;font-size:13px">아직 참여 기록이 없어요.</p>`}
    </div>
    ${Object.entries(grouped).map(([t, list]) => `
      <div class="my-section">
        <h4>${TYPE_LABEL[t]} (${list.length})</h4>
        ${list.map(a => `<div style="font-size:13px;margin-bottom:4px">· [${esc(a.book_title)}] ${esc(a.title)}</div>`).join("") || `<p style="color:#999;font-size:13px">작성한 내용이 없어요.</p>`}
      </div>
    `).join("")}
  `;
}

// ---------------- 모달 닫기 ----------------
function initModals() {
  document.getElementById("closeBookDetail").onclick = () => document.getElementById("bookDetailModal").classList.add("hidden");
  document.getElementById("closeGenericModal").onclick = closeGenericModal;
  [document.getElementById("bookDetailModal"), document.getElementById("genericModal")].forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  });
}

document.addEventListener("DOMContentLoaded", boot);
