// app.mjs - 실버콕 통합 관리 엔진 (수정본)
const $ = (sel, root = document) => root.querySelector(sel);

let rootEl = null;       // index.html의 최상위 컨테이너
let frameCache = {};     // 불러온 HTML 소스 저장소
let appDom = null;       // 메인 앱 프레임 루트
let appMain = null;      // 메인 콘텐츠 삽입 영역

// 1. 실행 시작
export async function Start() {
  console.log("SilverKok Initializing...");
  
  // 루트 컨테이너 확보
  rootEl = document.getElementById("spa_root");
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "spa_root";
    document.body.replaceChildren(rootEl);
  }

  // 프레임 소스(HTML 조각) 미리 로드
  await preloadFrames();

  // 초기 화면은 무조건 로그인
  ShowFrame("login");
}

// 2. 프레임 로드 (경로 에러 해결)
async function preloadFrames() {
  // 파일이 m 폴더 안에 있으므로 경로를 명확히 지정합니다.
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
      console.error(`[Frame Load Error] ${key}:`, err);
      frameCache[key] = `<div style="padding:20px; color:red;">${key}.html 로드 실패 (경로: ${url})</div>`;
    }
  }
}

// 3. 큰 액자(Frame) 교체
export async function ShowFrame(kind) {
  rootEl.innerHTML = frameCache[kind];
  window.scrollTo(0, 0);

  if (kind === "login") {
    // 로그인 화면일 때: 버튼 수동 바인딩
    const loginBtn = rootEl.querySelector("#login_start");
    if (loginBtn) {
      loginBtn.onclick = () => ShowFrame("app");
    }
  } else {
    // 메인 앱 화면일 때: 
    appDom = rootEl;
    appMain = rootEl.querySelector("main");
    
    // 이벤트 위임 처리 (앱 안의 모든 클릭 관리)
    appDom.onclick = onAppClick;

    // 첫 화면으로 어르신 프로필 선택 템플릿 로드
    ShowScreen("t_profile_select");
  }
}

// 4. 작은 액자(Screen) 교체
export function ShowScreen(templateId) {
  if (!appMain) return;

  const temp = document.getElementById(templateId);
  if (!temp) {
    console.error(`Template not found: ${templateId}`);
    return;
  }

  const node = temp.content.cloneNode(true);
  appMain.replaceChildren(node);
  appMain.scrollTo(0, 0);

  // 상단바 타이틀 자동 업데이트 (선택 사항)
  updateTitle(templateId);
}

// 5. 앱 내 클릭 이벤트 통합 관리 (위임 방식)
function onAppClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const val = btn.dataset.value;

  console.log("App Action:", action, val);

  switch (action) {
    case "logout":
      if (confirm("로그아웃 하시겠습니까?")) ShowFrame("login");
      break;
    
    case "go_screen":
      if (val) ShowScreen(val);
      break;

    case "play":
      // 콘텐츠 재생화면으로 이동 (t_player 템플릿이 있다고 가정)
      ShowScreen("t_player");
      break;

    case "close_play":
      ShowScreen("t_category_select");
      break;
  }
}

// 유틸리티: 타이틀 변경
function updateTitle(tempId) {
  const titleEl = rootEl.querySelector("[data-role='title']");
  if (!titleEl) return;

  const titles = {
    "t_profile_select": "어르신 선택",
    "t_category_select": "과목 선택",
    "t_profile_add": "어르신 등록"
  };
  
  if (titles[tempId]) titleEl.textContent = titles[tempId];
}