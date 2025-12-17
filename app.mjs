// app.mjs - 실버콕 MVP 통합 관리 스크립트
const $ = (sel, root = document) => root.querySelector(sel);

let rootEl = null;      // SPA 최상위 컨테이너 (#spa_root)
let frameCache = {};    // login.html, app.html 소스 캐시
let currentFrame = "";  // "login" 또는 "app"
let appDom = null;      // app.html이 주입된 후의 내부 DOM
let appMain = null;     // app.html 내의 콘텐츠 삽입 영역 (<main>)

/**
 * 1. 초기 실행
 */
export async function Start() {
  console.log("SilverKok App Start...");
  
  if (!rootEl) {
    rootEl = document.createElement("div");
    rootEl.id = "spa_root";
    document.body.replaceChildren(rootEl);
  }

  // 전역 이벤트 리스너 등록 (한 번만 실행)
  initGlobalEvents();

  // 프레임 소스 로드
  await preloadFrames();

  // 초기 화면: 로그인
  ShowFrame("login");
}

/**
 * 2. 프레임 소스 미리 가져오기
 */
async function preloadFrames() {
  const paths = {
    login: "/login.html", // 경로가 틀리다면 "./login.html" 등으로 수정 필요
    app: "/app.html"
  };

  for (const [key, url] of Object.entries(paths)) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${url}`);
      frameCache[key] = await res.text();
    } catch (err) {
      console.error(`Frame [${key}] load error:`, err);
      frameCache[key] = `<div style="padding:20px;">Frame '${key}' 로드 실패. 서버 경로를 확인하세요.</div>`;
    }
  }
}

/**
 * 3. 큰 액자(Frame) 교체: 로그인 vs 메인 앱
 */
export async function ShowFrame(kind) {
  currentFrame = kind;
  rootEl.innerHTML = frameCache[kind];
  
  if (kind === "login") {
    // 로그인 애니메이션 강제 트리거
    const loginMain = $("main", rootEl);
    if (loginMain) {
      loginMain.style.display = "flex";
      loginMain.style.opacity = "0";
      requestAnimationFrame(() => {
        loginMain.style.transition = "opacity 0.5s";
        loginMain.style.opacity = "1";
      });
    }
  } else {
    // 앱 프레임 로드 시 초기 세팅
    appDom = rootEl; 
    appMain = $("main", appDom);
    // 첫 화면으로 어르신 프로필 선택 템플릿 표시
    ShowScreen("t_profile_select", { title: "어르신 선택" });
  }
}

/**
 * 4. 작은 액자(Screen) 교체: main 영역에 template 주입
 */
export function ShowScreen(templateId, data = {}) {
  if (!appMain) return;

  const temp = $(`#${templateId}`, appDom);
  if (!temp) {
    console.error(`Template not found: ${templateId}`);
    return;
  }

  // 템플릿 복제 및 주입
  const node = temp.content.cloneNode(true);
  appMain.replaceChildren(node);
  
  // 상단바 타이틀 업데이트
  updateTopBar(data);

  // 화면 전환 시 부드러운 효과 (선택사항)
  appMain.scrollTo(0, 0);
}

/**
 * 5. 전역 이벤트 위임 (중요: 여기서 모든 클릭을 관리)
 */
function initGlobalEvents() {
  document.addEventListener("click", (e) => {
    // data-action 속성을 가진 요소를 찾음 (자식 요소 클릭 시에도 부모 탐색)
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const val = btn.dataset.value || "";

    console.log(`Action Triggered: ${action}`, val);

    switch (action) {
      case "login_start":
        ShowFrame("app");
        break;
      
      case "logout":
        if(confirm("로그아웃 하시겠습니까?")) ShowFrame("login");
        break;

      case "go_screen": // 템플릿 전환 (data-value에 템플릿 ID 저장)
        ShowScreen(val, { title: btn.innerText });
        break;

      case "play": // 콘텐츠 재생 (iframe 템플릿으로 전환)
        ShowScreen("t_player", { title: "콘텐츠 재생", contentId: val });
        // 여기서 실제로 iframe src를 바꿔주는 로직을 추가할 수 있습니다.
        break;

      case "open_plan":
        openPlanModal();
        break;

      case "close_plan":
        const modal = $("[data-plan-modal]", appDom);
        if (modal) modal.remove();
        break;

      case "add_profile":
        alert("어르신 등록 화면으로 이동합니다.");
        ShowScreen("t_profile_add", { title: "어르신 등록" });
        break;
    }
  });
}

/**
 * 6. UI 유틸리티
 */
function updateTopBar(data) {
  const titleEl = $("[data-role='title']", appDom) || $("nav div:first-child", appDom);
  if (titleEl && data.title) {
    titleEl.textContent = data.title;
  }
}

function openPlanModal() {
  if ($("[data-plan-modal]", appDom)) return;

  const wrap = document.createElement("div");
  wrap.setAttribute("data-plan-modal", "1");
  wrap.className = "modal_wrap"; // CSS에서 처리
  wrap.innerHTML = `
    <div class="modal_backdrop" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100;"></div>
    <div class="modal_panel" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:20px;z-index:101;width:90%;max-width:500px;">
      <div class="modal_head" style="display:flex;justify-content:space-between;margin-bottom:15px;">
        <strong>주간 계획안</strong>
        <button data-action="close_plan">닫기</button>
      </div>
      <div class="modal_body">
        <img src="/m/assets/plan.png" style="width:100%;" alt="계획안">
      </div>
    </div>
  `;
  appDom.appendChild(wrap);
}