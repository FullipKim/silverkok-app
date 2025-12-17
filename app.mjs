const $ = (sel, root = document) => root.querySelector(sel);

// 전역 상태 및 데이터
let rootEl = null, frameCache = {}, appDom = null, appMain = null;
const state = {
  currentElder: null,
  viewMode: 'weekly',
  // 데모 데이터: 어르신 목록
  profiles: [
    { id: 1, name: "김금자", age: 82, img: "https://i.pravatar.cc/150?u=1" },
    { id: 2, name: "박철수", age: 79, img: "https://i.pravatar.cc/150?u=2" }
  ],
  // 데모 데이터: 콘텐츠 목록
  contents: {
    today: [
      { id: "td_1", title: "단어 기억하기", type: "언어" },
      { id: "td_2", title: "숫자 계산", type: "수리" }
    ],
    review: [
      { id: "rv_1", title: "어제 활동 복습", type: "복습" },
      { id: "rv_2", title: "노래 가사 맞추기", type: "음악" },
      { id: "rv_3", title: "그림 색칠하기", type: "미술" }
    ]
  }
};

// 1. 초기화
export async function Start() {
  rootEl = document.getElementById("spa_root");
  await preloadFrames();
  ShowFrame("login");
}

async function preloadFrames() {
  const paths = { login: "/m/login.html", app: "/m/app.html" };
  for (const [key, url] of Object.entries(paths)) {
    const res = await fetch(url, { cache: "no-store" });
    frameCache[key] = await res.text();
  }
}

// 2. Frame (큰 화면) 전환
export async function ShowFrame(kind) {
  rootEl.innerHTML = frameCache[kind];
  if (kind === "login") {
    $("#login_start", rootEl).onclick = () => ShowFrame("app");
  } else {
    appDom = rootEl;
    appMain = $(".app_content", appDom);
    appDom.onclick = onAppClick; // 이벤트 위임
    ShowScreen("t_profile_select");
  }
}

// 3. Screen (작은 화면) 전환
export function ShowScreen(tid, data = {}) {
  const temp = document.getElementById(tid);
  if (!temp) return;
  
  // 템플릿 복제 및 주입
  const node = temp.content.cloneNode(true);
  appMain.replaceChildren(node);

  // 화면별 렌더링 로직 분기
  if (tid === "t_profile_select") renderProfiles();
  if (tid === "t_person_home") renderHome(data);
  if (tid === "t_content_list") renderContentList(data.type);
  if (tid === "t_content_player") renderPlayer(data.id);
  
  updateTopTitle(tid, data);
}

// 4. 통합 이벤트 핸들러
function onAppClick(e) {
  const btn = e.target.closest("[data-action], [data-go]");
  if (!btn) return;
  const { action, go, name, type, id } = btn.dataset;

  // 1) 화면 이동 (어르신 선택 등)
  if (go === "t_person_home") {
    state.currentElder = { name, img: btn.querySelector("img").src };
    ShowScreen(go, state.currentElder);
    return;
  }

  // 2) 액션 처리
  switch (action) {
    case "home": ShowScreen("t_profile_select"); break;
    case "logout": if(confirm("로그아웃 하시겠습니까?")) ShowFrame("login"); break;
    
    // 어르신 추가 관련
    case "add_elder": ShowScreen("t_profile_add"); break;
    case "trigger_file": $("#elder_file").click(); break;
    case "save_elder": saveNewElder(); break;

    // 홈: 주간/월간 뷰 토글
    case "view_weekly": state.viewMode = 'weekly'; renderHome(state.currentElder); break;
    case "view_monthly": state.viewMode = 'monthly'; renderHome(state.currentElder); break;
    case "back_to_person": ShowScreen("t_person_home", state.currentElder); break;

    // 콘텐츠 흐름: 홈 -> 리스트 -> 플레이어
    case "open_today_cog": ShowScreen("t_content_list", { type: 'today' }); break;
    case "open_review": ShowScreen("t_content_list", { type: 'review' }); break;
    case "play": ShowScreen("t_content_player", { id }); break;
    
    // 플레이어
    case "close_play": ShowScreen("t_person_home", state.currentElder); break;
    case "done_content": alert("활동이 완료되었습니다."); ShowScreen("t_person_home", state.currentElder); break;

    // 모달
    case "plan": openModal("주간 계획안", "/m/assets/plan.png"); break;
    case "calendar": openModal("전체 달력", "/m/assets/calendar_full.png"); break;
    case "close_modal": $(".modal_wrap")?.remove(); break;
  }
}

// 5. 렌더링 헬퍼 함수들
function renderProfiles() {
  const grid = $(".profile-grid", appMain);
  const html = state.profiles.map(p => `
    <button class="card_box" data-go="t_person_home" data-name="${p.name}">
      <img src="${p.img}" style="width:110px; height:110px; border-radius:50%; object-fit:cover; margin:0 auto 1rem;">
      <strong style="font-size:1.2rem; color:var(--text-main);">${p.name}</strong>
      <p style="color:var(--text-sub); margin-top:5px;">${p.age}세</p>
    </button>
  `).join("");
  grid.insertAdjacentHTML('afterbegin', html); // '신규등록' 버튼 앞에 추가
}

function renderHome(data) {
  if (!data) return;
  $("[data-bind='elder_name']", appMain).textContent = data.name;
  $("[data-bind='elder_img']", appMain).src = data.img;

  // 뷰 모드에 따른 UI 토글
  const wView = $(".view_weekly", appMain);
  const mView = $(".view_monthly", appMain);
  const wBtn = $("[data-action='view_weekly']", appMain);
  const mBtn = $("[data-action='view_monthly']", appMain);

  if (state.viewMode === 'monthly') {
    wView.classList.add("hidden"); mView.classList.remove("hidden");
    wBtn.style.background = "none"; wBtn.style.color = "var(--sec)";
    mBtn.style.background = "var(--sec)"; mBtn.style.color = "#fff";
  } else {
    wView.classList.remove("hidden"); mView.classList.add("hidden");
    wBtn.style.background = "var(--sec)"; wBtn.style.color = "#fff";
    mBtn.style.background = "none"; mBtn.style.color = "var(--sec)";
  }
}

function renderContentList(type) {
  const grid = $(".content_grid", appMain);
  const title = type === 'today' ? "오늘의 인지콕" : "인지콕 복습";
  $("[data-bind='list_title']", appMain).textContent = title;

  const list = state.contents[type] || [];
  grid.innerHTML = list.map(item => `
    <button class="menu_item" data-action="play" data-id="${item.id}">
      <strong>${item.title}</strong>
      <p>분야: ${item.type}</p>
    </button>
  `).join("");
}

function renderPlayer(id) {
  const area = $("#player_area", appMain);
  // 데모용 유튜브 영상 매핑
  const videoId = id === 'td_1' ? "y6120QOlsfU" : "dQw4w9WgXcQ"; 
  area.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" style="width:100%; height:100%; border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}

function saveNewElder() {
  const name = $("#elder_name_input").value;
  if (!name) return alert("성함을 입력해주세요.");
  // 상태에 추가
  state.profiles.push({
    id: Date.now(), name, age: "신규", 
    img: $("#preview_img").src
  });
  ShowScreen("t_profile_select");
}

function openModal(title, src) {
  const m = document.createElement("div");
  m.className = "modal_wrap";
  m.innerHTML = `
    <div class="modal_overlay" data-action="close_modal">
      <div class="modal_box" onclick="event.stopPropagation()">
        <div class="modal_head">
          <span>${title}</span><button data-action="close_modal">✕</button>
        </div>
        <div style="padding:2rem; text-align:center;">
          <img src="${src}" style="width:100%; border-radius:12px;">
        </div>
      </div>
    </div>`;
  appDom.appendChild(m);
}

function updateTopTitle(tid, data) {
  const t = $("[data-role='title']", appDom);
  const map = { t_profile_select: "실버콕 관리자", t_person_home: `${data.name} 님` };
  if(t) t.textContent = map[tid] || "실버콕";
}

// Global Hook for file input
window.handleFile = function(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => $("#preview_img").src = e.target.result;
    reader.readAsDataURL(input.files[0]);
  }
};