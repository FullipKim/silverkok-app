// app.mjs - 실버콕 통합 관리 엔진 (기능 구현 완비)
const $ = (sel, root = document) => root.querySelector(sel);

let rootEl = null;       // index.html의 최상위 컨테이너
let frameCache = {};     // 불러온 HTML 소스 저장소
let appDom = null;       // 메인 앱 프레임 루트
let appMain = null;      // 메인 콘텐츠 삽입 영역

// ✅ 1. 데모 데이터 정의 (어르신 목록)
const demoProfiles = [
  { id: 1, name: "김금자", age: 82, grade: "3등급", img: "https://via.placeholder.com/150/ED6663/FFFFFF?text=김금자" },
  { id: 2, name: "박철수", age: 79, grade: "2등급", img: "https://via.placeholder.com/150/0F4C81/FFFFFF?text=박철수" },
  { id: 3, name: "이영희", age: 85, grade: "4등급", img: "https://via.placeholder.com/150/F7B731/FFFFFF?text=이영희" },
  { id: 4, name: "최민수", age: 77, grade: "3등급", img: "https://via.placeholder.com/150/20BF6B/FFFFFF?text=최민수" },
];

// =======================
// 🚀 초기화 및 프레임 로드
// =======================
export async function Start() {
  console.log("SilverKok App Start...");
  
  rootEl = document.getElementById("spa_root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "spa_root";
    document.body.replaceChildren(rootEl);
  }

  await preloadFrames();
  ShowFrame("login");
}

async function preloadFrames() {
  const paths = {
    login: "/m/login.html",
    app: "/m/app.html"
  };

  for (const [key, url] of Object.entries(paths)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      frameCache[key] = await res.text();
    } catch (err) {
      console.error(`Error loading ${key}:`, err);
      frameCache[key] = `<div style="padding:20px;">${key} 로드 실패</div>`;
    }
  }
}

// =======================
// 🖼️ 프레임(Frame) 전환
// =======================
export async function ShowFrame(kind) {
  rootEl.innerHTML = frameCache[kind];
  window.scrollTo(0, 0);

  if (kind === "login") {
    // 로그인 버튼 바인딩
    const loginBtn = $("#login_start", rootEl);
    if (loginBtn) loginBtn.onclick = () => ShowFrame("app");
  } else {
    // 앱 진입 시 설정
    appDom = rootEl;
    appMain = $("main", appDom);
    
    // 이벤트 위임 (앱 내 모든 클릭 처리)
    appDom.onclick = onAppClick;

    // 첫 화면 로드
    ShowScreen("t_profile_select");
  }
}

// =======================
// 📱 스크린(Template) 전환
// =======================
export function ShowScreen(templateId, data = {}) {
  if (!appMain) return;

  const temp = document.getElementById(templateId);
  if (!temp) {
    console.error(`Template not found: ${templateId}`);
    return;
  }

  // 템플릿 복제 및 주입
  const node = temp.content.cloneNode(true);
  appMain.replaceChildren(node);
  appMain.scrollTo(0, 0);

  // 상단 타이틀 업데이트
  updateTitle(templateId, data);

  // ✅ 화면별 데이터 채우기 (여기가 핵심!)
  if (templateId === "t_profile_select") {
    renderProfileList(); // 어르신 목록 그리기 호출
  } 
  else if (templateId === "t_person_home") {
    renderPersonHome(data); // 특정 어르신 정보 표시
  }
}

// =======================
// 👆 이벤트 핸들러 (버튼 기능)
// =======================
function onAppClick(e) {
  // data-action 또는 data-go 속성이 있는 요소 찾기
  const btn = e.target.closest("[data-action], [data-go]");
  if (!btn) return;

  const action = btn.dataset.action; // 기능 이름
  const val = btn.dataset.value;     // 추가 값 (템플릿ID 등)
  const go = btn.dataset.go;         // 어르신 클릭 시 이동 타겟

  // 1. 어르신 프로필 카드 클릭 시 (화면 이동)
  if (go) {
    const name = btn.dataset.name;
    const img = btn.querySelector("img")?.src;
    ShowScreen(go, { name, img });
    return;
  }

  // 2. 일반 버튼 액션 처리
  console.log(`Action: ${action}, Value: ${val}`);

  switch (action) {
    case "logout":
      if (confirm("로그아웃 하시겠습니까?")) ShowFrame("login");
      break;

    case "home":
    case "back_person": // 뒤로가기 등도 홈으로 (간소화)
      ShowScreen("t_profile_select");
      break;

    case "plan": // 계획안 모달 열기
      openPlanModal();
      break;
    
    case "close_plan": // 계획안 닫기
      const modal = $("[data-plan-modal]", appDom);
      if (modal) modal.remove();
      break;

    case "add": // 어르신 추가 화면
      ShowScreen("t_profile_add");
      break;
    
    case "cancel_add": // 취소 시 목록으로
      ShowScreen("t_profile_select");
      break;

    case "save_add": // 저장 시 (데모는 알림만 뜨고 목록으로)
      alert("저장되었습니다 (데모)");
      ShowScreen("t_profile_select");
      break;
      
    case "go_screen": // 단순 화면 이동
    case "play":      // 콘텐츠 재생 화면 등
    case "open_today_cog":
    case "open_review":
      // data-value가 있으면 그 화면으로, 없으면 val 변수 확인
      const targetScreen = val || (action === "play" ? "t_content_player" : 
                                   action === "open_review" ? "t_content_list_review" : 
                                   "t_content_list_cognitive_today");
      ShowScreen(targetScreen);
      break;

    case "done_content":
      alert("활동을 완료했습니다.");
      ShowScreen("t_person_home", { title: "어르신 활동" }); // 이름 유지가 필요하지만 일단 홈으로
      break;
  }
}

// =======================
// 🎨 UI 렌더링 헬퍼 함수들
// =======================

// 1. 어르신 목록 그리기 (t_profile_select)
function renderProfileList() {
  const grid = $(".profile-grid", appMain);
  if (!grid) return;

  // 데모 데이터 루프
  grid.innerHTML = demoProfiles.map(p => `
    <div class="profile-card" data-go="t_person_home" data-name="${p.name}">
      <img src="${p.img}" alt="${p.name}">
      <div class="name">${p.name}</div>
      <div style="font-size:12px; color:#666;">${p.age}세 / ${p.grade}</div>
    </div>
  `).join("");
}

// 2. 어르신 홈 정보 표시 (t_person_home)
function renderPersonHome(data) {
  if (data.name) {
    const nameEl = $("[data-bind='elder_name']", appMain);
    if (nameEl) nameEl.textContent = data.name;
  }
  if (data.img) {
    const imgEl = $("[data-bind='elder_img']", appMain);
    if (imgEl) imgEl.src = data.img;
  }
}

// 3. 상단 타이틀 업데이트
function updateTitle(tempId, data) {
  const titleEl = $(".topbar-left strong", appDom);
  if (!titleEl) return;

  const titles = {
    "t_profile_select": "어르신 선택",
    "t_profile_add": "어르신 등록",
    "t_person_home": data.name ? `${data.name} 님` : "어르신 활동",
    "t_content_list_cognitive_today": "오늘의 인지콕",
    "t_content_list_review": "인지콕 복습",
    "t_content_player": "활동 진행 중"
  };

  titleEl.textContent = titles[tempId] || "실버콕";
}

// 4. 계획안 모달
function openPlanModal() {
  if ($("[data-plan-modal]", appDom)) return;

  const wrap = document.createElement("div");
  wrap.setAttribute("data-plan-modal", "1");
  wrap.innerHTML = `
    <div class="modal">
      <div class="modal-box">
        <div class="modal-head">
          <strong>이번 주 계획안</strong>
          <button data-action="close_plan" style="border:0;background:none;font-size:20px;cursor:pointer;">&times;</button>
        </div>
        <div class="modal-body">
          <div style="padding:40px; text-align:center; background:#eee; border-radius:12px;">
             계획안 이미지 영역
          </div>
        </div>
      </div>
    </div>
  `;
  appDom.appendChild(wrap);
}