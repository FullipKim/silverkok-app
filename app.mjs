// app.mjs - 실버콕 통합 관리 엔진 (MVP 완결본)
const $ = (sel, root = document) => root.querySelector(sel);

let rootEl = null;
let frameCache = {};
let appDom = null;
let appMain = null;

// 1. 상태 및 데모 데이터
const state = {
	currentElder: null,
	viewMode: 'weekly', // 'weekly' or 'monthly'
	profiles: [
		{ id: "p1", name: "김금자", age: 82, grade: "3등급", img: "https://i.pravatar.cc/150?u=1" },
		{ id: "p2", name: "박철수", age: 79, grade: "2등급", img: "https://i.pravatar.cc/150?u=2" }
	]
};

// 2. 초기 구동
export async function Start() {
	rootEl = document.getElementById("spa_root") || document.body;
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

// 3. 프레임 전환 (로그인 <-> 메인앱)
export async function ShowFrame(kind) {
	rootEl.innerHTML = frameCache[kind];
	if (kind === "login") {
		$("#login_start", rootEl).onclick = () => ShowFrame("app");
	} else {
		appDom = rootEl;
		appMain = $(".app_container", appDom);
		appDom.onclick = onAppClick;
		ShowScreen("t_profile_select");
	}
}

// 4. 스크린 전환 및 렌더링
export function ShowScreen(templateId, data = {}) {
	const temp = document.getElementById(templateId);
	if (!temp) return;

	const node = temp.content.cloneNode(true);
	appMain.replaceChildren(node);
	
	switch(templateId) {
		case "t_profile_select": renderProfiles(); break;
		case "t_person_home": renderHome(data); break;
		case "t_content_player": renderPlayer(data.contentId); break;
	}
	updateTitle(templateId, data);
}

// 5. 통합 이벤트 핸들러
function onAppClick(e) {
	const btn = e.target.closest("[data-action], [data-go]");
	if (!btn) return;

	const { action, value, contentId, go, name } = btn.dataset;

	// 화면 전환 (어르신 선택 등)
	if (go) {
		if (go === "t_person_home") {
			state.currentElder = { name, img: btn.querySelector("img").src };
			ShowScreen(go, state.currentElder);
		} else {
			ShowScreen(go);
		}
		return;
	}

	switch (action) {
		case "home": ShowScreen("t_profile_select"); break;
		case "logout": if(confirm("로그아웃 하시겠습니까?")) ShowFrame("login"); break;
		
		// 스케줄러 제어
		case "view_weekly": state.viewMode = 'weekly'; renderHome(state.currentElder); break;
		case "view_monthly": state.viewMode = 'monthly'; renderHome(state.currentElder); break;
		
		// 모달 (계획안 / 달력)
		case "plan": openImgModal("주간 계획안", "/m/assets/plan.png"); break;
		case "calendar": openImgModal("전체 달력", "/m/assets/calendar_full.png"); break;
		case "close_modal": $(".modal_wrap")?.remove(); break;

		// 어르신 추가 & 사진
		case "add_elder": ShowScreen("t_profile_add"); break;
		case "trigger_file": $("#elder_file").click(); break;
		case "save_elder": saveNewElder(); break;

		// 콘텐츠 계층 구조
		case "open_today_cog": ShowScreen("t_content_list_cognitive_today"); break;
		case "open_review": ShowScreen("t_content_list_review"); break;
		case "play": ShowScreen("t_content_player", { contentId: contentId || value }); break;
		case "done_content": alert("활동이 기록되었습니다."); ShowScreen("t_person_home", state.currentElder); break;
		case "close_play": ShowScreen("t_person_home", state.currentElder); break;
	}
}

// 6. 비즈니스 로직 함수
function renderProfiles() {
	const grid = $(".profile-grid", appMain);
	if (!grid) return;
	const listHtml = state.profiles.map(p => `
		<button class="select_user_card" data-go="t_person_home" data-name="${p.name}">
			<img src="${p.img}">
			<strong>${p.name}</strong>
			<span>${p.age}세 / ${p.grade || '등급없음'}</span>
		</button>`).join("");
	grid.insertAdjacentHTML('afterbegin', listHtml);
}

function renderHome(data) {
	if (!data.name) return;
	$("[data-bind='elder_name']", appMain).textContent = data.name;
	$("[data-bind='elder_img']", appMain).src = data.img;

	// 주간/월간 뷰 스위칭
	const weekly = $(".weekly_view", appMain);
	const monthly = $(".monthly_view", appMain);
	if (state.viewMode === 'monthly') {
		weekly?.classList.add("hidden");
		monthly?.classList.remove("hidden");
	} else {
		weekly?.classList.remove("hidden");
		monthly?.classList.add("hidden");
	}
}

function renderPlayer(id) {
	const area = $("#player_area", appMain);
	if (!area) return;
	// 실제 콘텐츠 ID별 매핑 (예시)
	const vMap = { "today_01": "y6120QOlsfU", "rev_01": "dQw4w9WgXcQ" };
	const vid = vMap[id] || "y6120QOlsfU";
	area.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>`;
}

// 사진 업로드 미리보기 (Global)
window.handleFile = function(input) {
	if (input.files && input.files[0]) {
		const reader = new FileReader();
		reader.onload = e => $("#preview_img").src = e.target.result;
		reader.readAsDataURL(input.files[0]);
	}
};

function saveNewElder() {
	const name = $("#elder_name_input").value;
	if(!name) return alert("이름을 입력해주세요.");
	state.profiles.push({
		id: Date.now(),
		name,
		age: "신규",
		img: $("#preview_img").src
	});
	ShowScreen("t_profile_select");
}

function openImgModal(title, src) {
	const m = document.createElement("div");
	m.className = "modal_wrap";
	m.innerHTML = `
		<div class="modal_backdrop" data-action="close_modal"></div>
		<div class="modal_box" style="max-width:90%; width:800px;">
			<div class="modal_head"><strong>${title}</strong><button data-action="close_modal">✕</button></div>
			<div class="modal_body"><img src="${src}" style="width:100%; border-radius:12px;"></div>
		</div>`;
	appDom.appendChild(m);
}

function updateTitle(tid, data) {
	const tEl = $("[data-role=\"title\"]", appDom);
	const map = { t_profile_select: "어르신 선택", t_person_home: `${data.name} 어르신` };
	if (tEl) tEl.textContent = map[tid] || "실버콕";
}