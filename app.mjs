// app.mjs (ROOT)
// index.html 안에서만 동작하는 SPA 관리자
// - index가 "큰 액자"
// - m/login.html, m/app.html은 "끼워 넣는 화면 조각"
// - template들은 m/app.html 안에 있고, main에 갈아끼움

const $ = (sel, root = document) => root.querySelector(sel);

let rootEl = null;       // index <body>에 만들어둘 컨테이너
let frameEl = null;      // 현재 꽂힌 m/login 또는 m/app 프레임 DOM
let frameCache = {};     // { login: "<html...>", app: "<html...>" }

let appDom = null;       // m/app.html이 꽂힌 뒤의 "현재 프레임" 루트
let appMain = null;      // m/app.html 안의 <main>
let appNav = null;       // m/app.html 안의 <nav>

// ===============
// Public entry
// ===============
export async function Start() {
  // 1) index.html body에 컨테이너 만들기
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "spa_root";
    document.body.replaceChildren(rootEl);
  }

  // 2) 프레임(로그인/앱) 소스 미리 로드
  await preloadFrames();

  // 3) 항상 "로그인부터" 시작 (꼬임 방지: 세션/해시 무시)
  await ShowFrame("login");
}

// ===================
// Frame loader
// ===================
async function preloadFrames() {
  // 경로는 "루트 index 기준" 절대경로로 고정(배포/로컬 모두 안정)
  // - 네가 m 폴더를 쓰니까 /m/login.html, /m/app.html
  const map = { login: "/m/login.html", app: "/m/app.html" };

  for (const k of Object.keys(map)) {
    if (frameCache[k]) continue;
    const res = await fetch(map[k], { cache: "no-store" });
    frameCache[k] = await res.text();
  }
}

async function ShowFrame(kind) {
  // kind: "login" | "app"
  rootEl.innerHTML = frameCache[kind];

  // rootEl 안에 실제 첫 엘리먼트를 frameEl로 잡음
  frameEl = rootEl.firstElementChild;

  // login/app 공통: 기본 스크롤/포커스 정리
  window.scrollTo(0, 0);

  if (kind === "login") {
    bindLoginFrame();
  } else {
    bindAppFrame();
    ShowScreen("t_profile_select"); // app 들어오면 첫 템플릿 고정
  }
}

// ===================
// Login
// ===================
function bindLoginFrame() {
  // login.html 내부 요소는 여기에서만 다룸
  const startBtn = $("#login_start", rootEl);

  // 혹시 login_start가 없으면(파일 수정 실수) 앱으로 넘어가버리는 꼬임 방지
  if (!startBtn) return;

  // introView/loginView 같은 구조를 쓰면 여기에서 토글 가능
  // 지금은 "CSS로만" 애니메이션 한다는 전제라 JS는 최소만:
  startBtn.addEventListener("click", async () => {
    await ShowFrame("app");
  }, { once: true });
}

// ===================
// App
// ===================
function bindAppFrame() {
  appDom = rootEl;                 // m/app.html이 rootEl 안에 그대로 들어옴
  appMain = $("main", appDom);
  appNav = $("nav", appDom);

  // main이 없으면 템플릿을 꽂을 곳이 없어서 오류남 (너가 겪은 innerHTML null)
  if (!appMain) throw new Error("m/app.html 안에 <main>이 없습니다.");

  // (중요) 이벤트는 전부 "위임"으로 1번만 바인딩 (템플릿 갈아껴도 안죽음)
  appDom.addEventListener("click", onAppClick);
}

function onAppClick(e) {
  const btn = e.target.closest("button,[data-action],[data-go]");
  if (!btn) return;

  // 1) nav 영역 버튼들
  const action = btn.getAttribute("data-action");
  if (action) {
    if (action === "logout") return ShowFrame("login");
    if (action === "home") return ShowScreen("t_profile_select");
    if (action === "plan") return openPlanModal();
    if (action === "add") return ShowScreen("t_profile_add");
    if (action === "close_plan") return closePlanModal();
    return;
  }

  // 2) 템플릿 내 이동(프로필 카드 클릭 등)
  const go = btn.getAttribute("data-go");
  if (go) {
    // 예: data-go="t_person_home"
    //     data-name="김영자"
    const name = btn.getAttribute("data-name") || "";
    return ShowScreen(go, { name });
  }
}

function ShowScreen(templateId, data = {}) {
  // templateId는 m/app.html 내부 <template id="..."> 를 의미
  const t = $(`#${cssEscape(templateId)}`, appDom);
  if (!t) return;

  // 템플릿 복제해서 main에 꽂기
  const node = t.content.cloneNode(true);
  appMain.replaceChildren(node);

  // 제목 자동 반영:
  // - 템플릿 안에 h1이 있으면 그 텍스트를 nav의 strong(또는 첫 div)에 복사
  // - h1이 없다면, data.title 또는 기존 유지
  syncTopbarTitle(data);

  // 화면별 데이터 주입(최소만)
  // - 어르신 홈 화면에 이름 표시 같은 것들
  if (templateId === "t_person_home" && data.name) {
    const nameEl = $("[data-bind='elder_name']", appMain);
    if (nameEl) nameEl.textContent = data.name;
  }
}

function syncTopbarTitle(data = {}) {
  // nav.topbar-left strong 우선, 없으면 nav 첫 div로 폴백
  const strong = $(".topbar-left strong", appDom) || $("nav strong", appDom);
  const leftBox = strong || $("nav div:first-child", appDom);

  if (!leftBox) return;

  // 1) data-title가 있으면 우선 사용
  if (data.title) {
    leftBox.textContent = data.title;
    return;
  }

  // 2) 현재 main 안의 첫 h1 텍스트를 제목으로 사용
  const h1 = $("main h1", appDom);
  if (h1 && h1.textContent.trim()) {
    leftBox.textContent = h1.textContent.trim();
    return;
  }

  // 3) h1이 없으면 "그대로 둠" (너가 말한 케이스)
}

// ===================
// Plan modal (데모)
// ===================
function openPlanModal() {
  // 이미 떠있으면 중복 생성 방지
  if ($("[data-plan-modal]", appDom)) return;

  const wrap = document.createElement("div");
  wrap.setAttribute("data-plan-modal", "1");
  wrap.innerHTML = `
    <div class="modal_backdrop"></div>
    <div class="modal_panel">
      <div class="modal_head">
        <strong>계획안</strong>
        <button class="pill" data-action="close_plan" type="button">닫기</button>
      </div>
      <div class="modal_body">
        <img src="/m/assets/plan.png" alt="plan" style="width:100%;height:auto;display:block;border-radius:12px">
      </div>
    </div>
  `;

  // CSS는 app.css에서 .modal_backdrop/.modal_panel 등으로 이미 갖고 있다는 전제
  appDom.appendChild(wrap);
}

function closePlanModal() {
  const m = $("[data-plan-modal]", appDom);
  if (m) m.remove();
}

// ===================
// Utils
// ===================
function cssEscape(id) {
  // 간단 escape (template id에 특수문자 거의 없을 거라 이 정도면 충분)
  return id.replace(/([#.;,[\]()>:+*~'"\\])/g, "\\$1");
}
