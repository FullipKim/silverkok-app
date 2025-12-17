const $ = (sel, root = document) => root.querySelector(sel);
let rootEl, frameCache = {}, appDom, appMain;

// State
const state = {
  currentElder: null,
  currentListType: null, // cognitive, mind, etc.
  completed: new Set(),  // 완료된 콘텐츠 ID 저장용
  profiles: [
    { name: "김금자", birth: "19420505", grade: "3등급", img: "https://i.pravatar.cc/150?u=1" },
    { name: "박철수", birth: "19450815", grade: "2등급", img: "https://i.pravatar.cc/150?u=2" }
  ],
  // 콘텐츠 데이터
  contents: {
    // 십이간지 동물 찾기 시리즈
    cognitive: [
      { id: "cog_01", title: "십이간지 동물 찾기 1", srcType: "html", url: "01m_01w_03s_01.html" },
      { id: "cog_02", title: "십이간지 동물 찾기 2", srcType: "html", url: "01m_01w_03s_02.html" },
      { id: "cog_03", title: "십이간지 동물 찾기 3", srcType: "html", url: "01m_01w_03s_03.html" },
      { id: "cog_04", title: "십이간지 동물 찾기 4", srcType: "html", url: "01m_01w_03s_04.html" }
    ],
    // 유튜브
    gym: [
      { id: "gym_01", title: "건강 체조 1강", srcType: "yt", url: "y6120QOlsfU" },
      { id: "gym_02", title: "건강 체조 2강", srcType: "yt", url: "3SzoI798qPY" }
    ],
    origami: [
      { id: "ori_01", title: "종이 접기 기초", srcType: "yt", url: "dQw4w9WgXcQ" }
    ]
  }
};

// Fallback for other categories
state.contents.mind = state.contents.review = state.contents.cognitive;
state.contents.brain = state.contents.art = state.contents.focus = state.contents.cognitive;


/* --- 1. Init --- */
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

/* --- 2. Frame Logic --- */
export async function ShowFrame(kind) {
  rootEl.innerHTML = frameCache[kind];
  if (kind === "login") {
    $("#login_start", rootEl).onclick = () => ShowFrame("app");
  } else {
    appDom = rootEl;
    appMain = $(".container", appDom);
    appDom.onclick = onAppClick;
    ShowScreen("t_profile_select");
  }
}

/* --- 3. Screen Logic --- */
export function ShowScreen(tid, data = {}) {
  const temp = document.getElementById(tid);
  if (!temp) return;
  
  appMain.replaceChildren(temp.content.cloneNode(true));

  if (tid === "t_profile_select") renderProfiles();
  if (tid === "t_person_home") renderHome(data);
  if (tid === "t_content_list") renderContentList(data.type);
  if (tid === "t_content_player") renderPlayer(data.item);
}

/* --- 4. Event Handler --- */
function onAppClick(e) {
  const btn = e.target.closest("[data-action], [data-go]");
  if (!btn) return;

  const { action, go, name, type, id } = btn.dataset;

  // X 버튼 클릭 (모달 닫기)
  if (action === "close_modal") {
    $(".modal_wrap")?.remove();
    return;
  }

  // 어르신 선택
  if (go === "t_person_home") {
    const img = btn.querySelector("img").src;
    const birth = btn.dataset.birth;
    state.currentElder = { name, img, birth };
    ShowScreen(go, state.currentElder);
    return;
  }

  switch (action) {
    case "home": ShowScreen("t_profile_select"); break;
    case "logout": if(confirm("로그아웃 하시겠습니까?")) ShowFrame("login"); break;

    // 모달들
    case "plan": openModal("주간 계획안", "/m/assets/plan.png"); break;
    case "calendar_modal": openModal("월간 캘린더", "/m/assets/calendar_full.png"); break;

    // 어르신 추가
    case "add_elder": ShowScreen("t_profile_add"); break;
    case "trigger_file": $("#elder_file").click(); break;
    case "save_elder": saveNewElder(); break;

    // 콘텐츠 리스트 -> 플레이어
    case "open_list": 
      state.currentListType = type;
      ShowScreen("t_content_list", { type }); 
      break;
    case "play": 
      // id로 content 아이템 찾기
      const item = findContent(id);
      ShowScreen("t_content_player", { item }); 
      break;

    // 플레이어 완료
    case "done_content":
      // 현재 플레이 중인 아이템 찾아서 완료 처리
      const playerFrame = $("#player_area iframe", appMain);
      if(playerFrame) {
         // ID 추적이 어려우니, 화면 전환 시 넘긴 data를 state로 관리하지 않고
         // 편의상 마지막 플레이 ID를 저장해두거나 해야 함.
         // 여기서는 간단히 리스트 화면으로 돌아가게 함 (완료 마킹은 play 클릭 시점에 ID를 알아야 함)
         // MVP 구현상: play 클릭시 data-id를 알고 있음.
      }
      alert("활동이 완료되었습니다.");
      // 리스트 화면으로 복귀
      ShowScreen("t_content_list", { type: state.currentListType });
      break;

    case "back_to_person": ShowScreen("t_person_home", state.currentElder); break;
  }
}

/* --- 5. Logic Helpers --- */

// 나이 계산 (만 나이)
function calcAge(birthStr) {
  if(!birthStr || birthStr.length !== 8) return "0";
  const birthDate = new Date(birthStr.substring(0,4), birthStr.substring(4,6)-1, birthStr.substring(6,8));
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
  }
  return age;
}

// 어르신 목록 렌더링
function renderProfiles() {
  const grid = $(".profile-grid", appMain);
  const html = state.profiles.map(p => {
    const age = calcAge(p.birth);
    return `
    <button class="card_box" data-go="t_person_home" data-name="${p.name}" data-birth="${p.birth}">
      <img src="${p.img}">
      <strong style="font-size:1.2rem;">${p.name}</strong>
      <p style="color:#718096; margin-top:5px;">만 ${age}세 / ${p.grade}</p>
    </button>`;
  }).join("");
  grid.insertAdjacentHTML('afterbegin', html);
}

// 어르신 홈 렌더링
function renderHome(data) {
  $("[data-bind='elder_name']", appMain).textContent = data.name;
  $("[data-bind='elder_img']", appMain).src = data.img;

  // 주간 달력 생성 (오늘 기준 Mon~Sun)
  const calDiv = $("#weekly_cal_area", appMain);
  const today = new Date();
  const dayOfWeek = today.getDay() || 7; // Sun=0 -> make Sun=7 for Mon start calculation if needed, but let's stick to simple
  // 단순화: 오늘 포함 앞뒤 날짜 7개 표시
  let calHtml = `<div class="calendar_row">`;
  const days = ['일','월','화','수','목','금','토'];
  
  for(let i=-3; i<=3; i++) {
     const d = new Date();
     d.setDate(today.getDate() + i);
     const isToday = i === 0 ? "today" : "";
     const dateNum = d.getDate();
     const dayName = days[d.getDay()];
     
     // 랜덤 출석 도장 (오늘 포함 이전 날짜 중 랜덤)
     let stamp = "";
     if(i <= 0 && Math.random() > 0.3) {
       stamp = `<div class="stamp">출석</div>`;
     }
     
     calHtml += `
       <div class="day_cell ${isToday}">
         <div class="day_name">${dayName}</div>
         <div class="day_num">${dateNum}</div>
         ${stamp}
       </div>
     `;
  }
  calHtml += `</div>`;
  calDiv.innerHTML = calHtml;
}

// 콘텐츠 리스트 렌더링
function renderContentList(type) {
  const titleMap = { cognitive: "오늘의 인지콕", mind: "마음 체크리스트", review: "복습 활동", gym: "건강 체조" };
  const title = titleMap[type] || "활동 목록";
  $("[data-bind='list_title']", appMain).textContent = title;

  const list = state.contents[type] || state.contents.cognitive;
  const rail = $(".content_rail", appMain);
  
  rail.innerHTML = list.map(item => {
    const isDone = state.completed.has(item.id);
    const badge = isDone ? `<div class="done_badge">완료됨</div>` : "";
    
    // 썸네일은 타입에 따라 다르게 (여기선 placeholder)
    return `
    <button class="rail_item" style="min-width:260px;" data-action="play" data-id="${item.id}">
      <div class="thumb_box">
         <img src="https://via.placeholder.com/300x169?text=${item.srcType==='yt'?'VIDEO':'HTML'}">
         ${badge}
      </div>
      <strong style="font-size:1.1rem; color:var(--sec);">${item.title}</strong>
    </button>`;
  }).join("");
}

// 플레이어
function renderPlayer(item) {
  if(!item) return;
  // 완료 기록
  state.completed.add(item.id);
  
  const area = $("#player_area", appMain);
  let src = "";
  if(item.srcType === 'yt') {
    src = `https://www.youtube.com/embed/${item.url}?autoplay=1`;
  } else {
    // HTML iframe (요청하신 형식)
    // 01m_01w_03s_xx.html
    src = `http://brand.kidscokmini.com/data/kidscok_data/silver/${item.url}`;
  }
  
  area.innerHTML = `<iframe src="${src}" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
}

function findContent(id) {
  for(const key in state.contents) {
    const found = state.contents[key].find(x => x.id === id);
    if(found) return found;
  }
  return null;
}

function saveNewElder() {
  const name = $("#inp_name").value;
  const birth = $("#inp_birth").value;
  const grade = $("#inp_grade").value;
  
  if(!name || !birth || !grade) return alert("필수 정보를 입력해주세요.");
  
  state.profiles.push({
    name, birth, grade,
    img: $("#preview_img").src
  });
  ShowScreen("t_profile_select");
}

function openModal(title, src) {
  const m = document.createElement("div");
  m.className = "modal_wrap";
  m.innerHTML = `
    <div class="modal_bg" data-action="close_modal"></div>
    <div class="modal_content">
      <div class="modal_head">
        <span>${title}</span>
        <button data-action="close_modal" style="font-size:1.5rem;">&times;</button>
      </div>
      <div style="padding:0; overflow-y:auto; max-height:80vh;">
        <img src="${src}" style="width:100%;">
      </div>
    </div>`;
  appDom.appendChild(m);
}

// File Preview
window.handleFile = function(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = $("#preview_img");
      img.src = e.target.result;
      img.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
};