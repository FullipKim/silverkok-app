// app.mjs
// - index.html에서 Start() 실행
// - /m/app.html을 불러오고, 그 안의 <template>들을 main에 꽂아 화면 전환
// - 템플릿 내부의 h1 텍스트를 nav.topbar strong에 자동으로 넣음 (h1은 화면에서 제거)

let view = "profile_select";
let state = {
	selectedElder: null,
	profiles: [
		{ id:"p1", name:"김영자", img:"https://images.unsplash.com/photo-1520975958224-8ec3280b75ef?auto=format&fit=crop&w=400&q=60" },
		{ id:"p2", name:"이순자", img:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=60" },
		{ id:"p3", name:"박춘자", img:"https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=60" },
		{ id:"p4", name:"정말례", img:"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=60" },
		{ id:"p5", name:"최금순", img:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=60" },
		{ id:"p6", name:"한복례", img:"https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=60" }
	],
	attendance: {}, // yyyy-mm-dd: true/false
	completed: {}   // contentKey: true
};

// ---------- tiny helpers ----------
const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

function mainEl(){ return $("main"); }
function topTitleEl(){ return $("nav.topbar .topbar-left strong"); }
function tpl(id){ return document.getElementById(id).content.cloneNode(true); }

function setTopTitle(txt=""){
	const el = topTitleEl();
	if(el) el.textContent = txt || "";
}

function mountTemplate(tid, titleFallback=""){
	const t = document.getElementById(tid);
	const frag = t.content.cloneNode(true);

	// 1. data-title
	let title = t.dataset.title || "";

	// 2. h1 (있으면)
	if(!title){
		const h1 = frag.querySelector("h1");
		if(h1){
			title = h1.textContent.trim();
			h1.remove(); // 화면 중복 방지
		}
	}

	// 3. fallback
	if(!title) title = titleFallback || "";

	mainEl().replaceChildren(frag);
	if(title) setTopTitle(title);
}

// ---------- storage ----------
const LS_KEY = "silverkok_mvp_state_v1";
function saveState(){
	try{ localStorage.setItem(LS_KEY, JSON.stringify({ profiles: state.profiles, attendance: state.attendance, completed: state.completed })); }catch(e){}
}
function loadState(){
	try{
		const raw = localStorage.getItem(LS_KEY);
		if(!raw) return;
		const s = JSON.parse(raw);
		if(s?.profiles) state.profiles = s.profiles;
		if(s?.attendance) state.attendance = s.attendance;
		if(s?.completed) state.completed = s.completed;
	}catch(e){}
}

// ---------- date helpers ----------
function pad(n){ return String(n).padStart(2,"0"); }
function ymd(d){
	return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function startOfWeek(d){ // 월요일 시작
	const x = new Date(d);
	const day = (x.getDay()+6)%7; // Mon=0
	x.setDate(x.getDate()-day);
	x.setHours(0,0,0,0);
	return x;
}

// ---------- Frame load ----------
async function ShowFrame(){
	const res = await fetch("/m/app.html", { cache:"no-store" });
	const html = await res.text();

	// index.html <body> 가 비어있으니 app.html 전체를 body에 꽂음
	document.body.innerHTML = html;

	// 이벤트는 1회만 바인딩
	bindAppEvents();
}

// ---------- View ----------
function ShowView(next, payload={}){
	view = next;

	// login은 m/login.html로 이동 (SPA 밖)
	if(next==="login"){
		setTopTitle("");
		mainEl().replaceChildren();
		location.href = "/m/login.html";
		return;
	}

	// 프로필 선택
	if(next==="profile_select"){
		mountTemplate("t_profile_select","프로필 선택");
		renderProfileGrid();
		return;
	}

	// 어르신 추가 폼
	if(next==="profile_add"){
		mountTemplate("t_profile_add","어르신 추가");
		bindAddForm();
		return;
	}

	// 어르신 홈(개인 프로필/주간/과목)
	if(next==="elder_home"){
		mountTemplate("t_elder_home", payload?.name ? payload.name : "어르신");
		renderElderHome(payload);
		return;
	}

	// 과목 들어가서 콘텐츠 리스트
	if(next==="content_list"){
		mountTemplate("t_content_list", payload?.title || "콘텐츠");
		renderContentList(payload);
		return;
	}

	// 콘텐츠 플레이어
	if(next==="content_player"){
		mountTemplate("t_content_player", payload?.title || "콘텐츠");
		renderContentPlayer(payload);
		return;
	}

	console.warn("Unknown view:", next);
}

// ---------- Events (delegation) ----------
function bindAppEvents(){
	// topbar 버튼들
	document.addEventListener("click", (e)=>{
		const btn = e.target.closest("button,[data-action],[data-go]");
		if(!btn) return;

		// topbar: home/logout
		const act = btn.dataset.action;
		if(act==="home"){
			state.selectedElder = null;
			ShowView("profile_select");
			return;
		}
		if(act==="logout"){
			state.selectedElder = null;
			ShowView("login");
			return;
		}

		// 프로필 선택: 계획안/추가
		if(act==="plan"){ openPlanModal(); return; }
		if(act==="add"){ ShowView("profile_add"); return; }

		// 모달 닫기
		if(act==="close_plan"){ closePlanModal(); return; }
		if(act==="close_month"){ closeMonthModal(); return; }

		// 프로필 카드 클릭
		const pid = btn.dataset.goProfile;
		if(pid){
			const p = state.profiles.find(x=>x.id===pid);
			if(!p) return;
			state.selectedElder = p;
			ShowView("elder_home", p);
			return;
		}

		// 과목(카드) 클릭 -> 리스트로
		const subject = btn.dataset.goSubject;
		if(subject){
			const title = btn.dataset.title || subject;
			ShowView("content_list", { subject, title });
			return;
		}

		// 리스트에서 콘텐츠 클릭 -> 플레이어
		const contentKey = btn.dataset.goContent;
		if(contentKey){
			const title = btn.dataset.title || "콘텐츠";
			const url = btn.dataset.url || "";
			ShowView("content_player", { contentKey, title, url });
			return;
		}

		// 플레이어 완료 처리
		if(act==="complete"){
			const key = btn.dataset.contentKey;
			if(key){
				state.completed[key] = true;
				saveState();
				// 뒤로(리스트로) 복귀
				const backSubject = btn.dataset.backSubject;
				const backTitle = btn.dataset.backTitle;
				ShowView("content_list", { subject: backSubject, title: backTitle });
			}
			return;
		}

		// 뒤로가기
		if(act==="back_elder"){
			if(state.selectedElder) ShowView("elder_home", state.selectedElder);
			return;
		}
	});
}

// ---------- Profile select ----------
function renderProfileGrid(){
	const grid = $(".profile-grid");
	if(!grid) return;

	grid.innerHTML = state.profiles.map(p=>`
		<button class="profile-card" type="button" data-go-profile="${p.id}">
			<img class="avatar" src="${p.img}" alt="">
			<div class="name">${p.name}</div>
		</button>
	`).join("");
}

// ---------- Plan modal ----------
function openPlanModal(){
	const host = document.body;
	if($("#plan_modal")) return;

	const el = document.createElement("div");
	el.id = "plan_modal";
	el.innerHTML = `
		<div class="modal-dim" data-action="close_plan"></div>
		<div class="modal-card">
			<div class="modal-head">
				<strong>계획안</strong>
				<button class="pill" data-action="close_plan" type="button">닫기</button>
			</div>
			<div class="modal-body">
				<img src="https://images.unsplash.com/photo-1581091870627-3af39f5c7b5f?auto=format&fit=crop&w=1200&q=60" alt="plan" style="width:100%;border-radius:12px;">
			</div>
		</div>
	`;
	host.appendChild(el);
}
function closePlanModal(){
	const el = $("#plan_modal");
	if(el) el.remove();
}

// ---------- Add form ----------
function bindAddForm(){
	const form = $("#add_form");
	if(!form) return;

	form.addEventListener("submit", (e)=>{
		e.preventDefault();

		const fd = new FormData(form);
		const name = (fd.get("name")||"").toString().trim() || "새 어르신";
		const img = "https://images.unsplash.com/photo-1520975683890-05f1f4e8d4c6?auto=format&fit=crop&w=400&q=60";

		const id = "p" + Math.random().toString(16).slice(2,8);
		state.profiles.push({ id, name, img });

		saveState();
		ShowView("profile_select");
	});
}

// ---------- Elder home (weekly + subjects swipe) ----------
function renderElderHome(p){
	// 상단 프로필 영역
	const nameEl = $("#elder_name");
	if(nameEl) nameEl.textContent = p?.name || "";

	// 출석 데모: 이번 주 2~4일 랜덤 true
	seedAttendanceForThisWeek();

	// 주간 캘린더 렌더
	renderWeekBar();

	// 월간 모달 버튼
	const monthBtn = $("#btn_month");
	if(monthBtn){
		monthBtn.onclick = ()=>openMonthModal();
	}

	// 과목 스와이프(2페이지)
	renderSubjectPages();
}

function seedAttendanceForThisWeek(){
	const today = new Date();
	const mon = startOfWeek(today);
	for(let i=0;i<7;i++){
		const d = new Date(mon); d.setDate(mon.getDate()+i);
		const key = ymd(d);
		if(state.attendance[key]===undefined){
			state.attendance[key] = Math.random() < 0.45; // 임의
		}
	}
	saveState();
}

function renderWeekBar(){
	const wrap = $("#weekbar");
	if(!wrap) return;

	const today = new Date();
	const mon = startOfWeek(today);
	const days = ["월","화","수","목","금","토","일"];

	let html = "";
	for(let i=0;i<7;i++){
		const d = new Date(mon); d.setDate(mon.getDate()+i);
		const key = ymd(d);
		const ok = !!state.attendance[key];
		const isToday = ymd(d)===ymd(today);

		html += `
			<div class="day ${isToday?"today":""}">
				<div class="md">${d.getMonth()+1}/${d.getDate()}</div>
				<div class="dw">${days[i]}</div>
				${ok ? `<img class="stamp" src="/m/complete.svg" alt="">` : ``}
			</div>
		`;
	}
	wrap.innerHTML = html;
}

// 2행 2열을 "페이지"로 묶어서 가로 스와이프
function renderSubjectPages(){
	const host = $("#subjects_pages");
	if(!host) return;

	const pages = [
		[
			{ key:"cog_today", title:"오늘의 인지콕" },
			{ key:"mind", title:"마음체크리스트" },
			{ key:"review", title:"복습활동(인지콕)" },
			{ key:"exercise", title:"건강체조" }
		],
		[
			{ key:"paper", title:"종이접기" },
			{ key:"brain", title:"두뇌콕" },
			{ key:"art", title:"미술콕" },
			{ key:"focus", title:"집중콕" }
		]
	];

	host.innerHTML = pages.map((group, idx)=>`
		<div class="subpage" aria-label="page-${idx+1}">
			${group.map(item=>`
				<button class="subcard" type="button" data-go-subject="${item.key}" data-title="${item.title}">
					<span>${item.title}</span>
				</button>
			`).join("")}
		</div>
	`).join("");
}

// ---------- Month modal ----------
function openMonthModal(){
	if($("#month_modal")) return;

	const today = new Date();
	const y = today.getFullYear();
	const m = today.getMonth(); // 0-based
	const first = new Date(y,m,1);
	const last = new Date(y,m+1,0);
	const start = new Date(first);
	start.setDate(first.getDate() - ((first.getDay()+6)%7)); // 월요일 시작으로 맞춤

	let cells = "";
	for(let i=0;i<42;i++){
		const d = new Date(start); d.setDate(start.getDate()+i);
		const key = ymd(d);
		const inMonth = d.getMonth()===m;
		const ok = !!state.attendance[key];
		const isToday = ymd(d)===ymd(today);

		cells += `
			<div class="mcell ${inMonth?"in":"out"} ${isToday?"today":""}">
				<div class="num">${d.getDate()}</div>
				${ok ? `<img class="stamp" src="/m/complete.svg" alt="">` : ``}
			</div>
		`;
	}

	const el = document.createElement("div");
	el.id = "month_modal";
	el.innerHTML = `
		<div class="modal-dim" data-action="close_month"></div>
		<div class="modal-card">
			<div class="modal-head">
				<strong>${y}년 ${m+1}월</strong>
				<button class="pill" data-action="close_month" type="button">닫기</button>
			</div>
			<div class="month-grid">${cells}</div>
		</div>
	`;
	document.body.appendChild(el);
}
function closeMonthModal(){
	const el = $("#month_modal");
	if(el) el.remove();
}

// ---------- Content list ----------
function renderContentList({subject, title}){
	// subject별로 URL 규칙 적용 (예: 멀티콘텐츠 / 유튜브)
	// 멀티콘텐츠 예시: .../01m_01w_03s_04.html  같은 패턴으로 번호만 바꿔서 나열
	// 영상은 건강체조면 유튜브로 고정

	const list = $("#content_grid");
	if(!list) return;

	const items = [];

	if(subject==="exercise"){
		// 건강체조: 유튜브 하나로 모두 대체 (8개 동일)
		for(let i=1;i<=8;i++){
			items.push({
				key:`${subject}_${i}`,
				title:`콘텐츠 ${i}`,
				url:`https://www.youtube.com/embed/yKn0RgwS8QM`
			});
		}
	}else{
		// 기본: 멀티콘텐츠 8개 (week/step/seq 일부만 변경)
		// 예시 기반: 01m_01w_03s_04.html
		// 여기서는 s(단계)와 마지막 번호를 바꿔서 데모로 구성
		const base = "http://brand.kidscokmini.com/data/kidscok_data/silver";
		const w = "01w";
		const s = "03s";
		for(let i=1;i<=8;i++){
			const n = pad(i); // 01..08
			items.push({
				key:`${subject}_${i}`,
				title:`콘텐츠 ${i}`,
				url:`${base}/01m_${w}_${s}_${n}.html`
			});
		}
	}

	list.innerHTML = items.map(it=>{
		const done = !!state.completed[it.key];
		return `
			<button class="content-card" type="button"
				data-go-content="${it.key}"
				data-title="${title}"
				data-url="${it.url}">
				${done ? `<span class="done">완료</span>` : ``}
				<strong>${it.title}</strong>
			</button>
		`;
	}).join("");

	// 상단 back 버튼에 subject/title를 실어둠
	const back = $("#btn_back_elder");
	if(back){
		back.dataset.action = "back_elder";
	}
}

// ---------- Content player ----------
function renderContentPlayer({contentKey, title, url}){
	const frame = $("#player_iframe");
	if(frame) frame.src = url;

	const doneBtn = $("#btn_complete");
	if(doneBtn){
		doneBtn.dataset.action = "complete";
		doneBtn.dataset.contentKey = contentKey;
		doneBtn.dataset.backSubject = (contentKey||"").split("_")[0];
		doneBtn.dataset.backTitle = title || "콘텐츠";
	}
}

// ---------- Start ----------
export async function Start(){
	loadState();
	await ShowFrame();
	// 첫 화면은 프로필 선택(로그인은 별도 페이지에서 app.html로 들어온다고 가정)
	ShowView("profile_select");
}
