const $ = (sel, root = document) => root.querySelector(sel);
let rootEl, frameCache = {}, appDom, appMain;

// State & Data
const state = {
  currentElder: null,
  currentListType: null,
  completed: new Set(),
  profiles: [
    { name: "김금자", birth: "19420505", grade: "3등급", img: "https://i.pravatar.cc/150?u=1" },
    { name: "박철수", birth: "19450815", grade: "2등급", img: "https://i.pravatar.cc/150?u=2" }
  ],
  contents: {
    // 십이간지 (html) -> id: cog_xx, url: 01, 02, 03, 04...
    cognitive: Array.from({length:8}, (_, i) => ({
      id: `cog_${i+1}`, title: `십이간지 동물 찾기 ${i+1}`, srcType: 'html', 
      url: `01m_01w_03s_0${(i % 4) + 1}.html` // 01, 02, 03, 04 반복
    })),
    // 체조, 종이접기 (유튜브)
    gym: [
      { id: "gym_1", title: "건강 체조 1강", srcType: "yt", url: "y6120QOlsfU" },
      { id: "gym_2", title: "건강 체조 2강", srcType: "yt", url: "3SzoI798qPY" }
    ],
    origami: [ { id: "ori_1", title: "종이 접기 기초", srcType: "yt", url: "dQw4w9WgXcQ" } ]
  }
};
// Fallback content
state.contents.mind = state.contents.review = state.contents.brain = state.contents.art = state.contents.focus = state.contents.cognitive;

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

export function ShowScreen(tid, data = {}) {
  const temp = document.getElementById(tid);
  if (!temp) return;
  appMain.replaceChildren(temp.content.cloneNode(true));

  if (tid === "t_profile_select") renderProfiles();
  if (tid === "t_person_home") renderHome(data);
  if (tid === "t_content_list") renderContentList(data.type);
  if (tid === "t_content_player") renderPlayer(data.item);

  // PC 드래그 스크롤 활성화
  enableDragScroll();
}

function onAppClick(e) {
  const btn = e.target.closest("[data-action], [data-go]");
  if (!btn) return;
  const { action, go, name, type, id } = btn.dataset;

  // 1. 모달 닫기 (X 버튼)
  if (action === "close_modal") { $(".modal_wrap")?.remove(); return; }
  // 2. 모달 닫기 (배경 클릭)
  if (e.target.classList.contains("modal_bg")) { $(".modal_wrap")?.remove(); return; }

  // 3. 화면 이동
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

    case "plan": openModal("주간 계획안", "/m/assets/plan.png"); break;
    case "calendar_modal": openModal("월간 캘린더", "/m/assets/calendar_full.png"); break;

    case "add_elder": ShowScreen("t_profile_add"); break;
    case "trigger_file": $("#elder_file").click(); break;
    case "save_elder": saveNewElder(); break;

    case "open_list": 
      state.currentListType = type; 
      ShowScreen("t_content_list", { type }); 
      break;
    
    case "play": 
      const item = findContent(state.currentListType, id);
      ShowScreen("t_content_player", { item }); 
      break;

    case "done_content":
      alert("완료되었습니다.");
      ShowScreen("t_content_list", { type: state.currentListType });
      break;
    
    case "close_play": 
    case "back_to_person": 
      ShowScreen("t_person_home", state.currentElder); 
      break;
  }
}

// --- Logic ---

function calcAge(birth) {
  if(!birth || birth.length !== 8) return 0;
  const today = new Date();
  const by = parseInt(birth.substring(0,4)), bm = parseInt(birth.substring(4,6)), bd = parseInt(birth.substring(6,8));
  let age = today.getFullYear() - by;
  if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) age--;
  return age;
}

function renderProfiles() {
  const grid = $(".profile-grid", appMain);
  const html = state.profiles.map(p => `
    <button class="user_card" data-go="t_person_home" data-name="${p.name}" data-birth="${p.birth}">
      <img src="${p.img}" style="width:110px; height:110px;">
      <strong style="font-size:1.3rem;">${p.name}</strong>
      <p style="color:#718096; margin-top:5px;">만 ${calcAge(p.birth)}세</p>
    </button>`).join("");
  grid.insertAdjacentHTML('afterbegin', html);
}

function renderHome(data) {
  $("[data-bind='elder_name']", appMain).textContent = data.name;
  $("[data-bind='elder_img']", appMain).src = data.img;

  // 주간 달력
  const calDiv = $("#weekly_cal_area", appMain);
  let html = `<div class="calendar_row">`;
  const days = ['일','월','화','수','목','금','토'];
  const today = new Date();
  for(let i=-3; i<=3; i++) {
     const d = new Date(); d.setDate(today.getDate() + i);
     const isToday = i===0 ? 'today' : '';
     // 랜덤 출석 표시
     const stamp = (i <= 0 && Math.random() > 0.3) ? `<div class="stamp">출석</div>` : "";
     html += `<div class="day_cell ${isToday}"><div class="day_name">${days[d.getDay()]}</div><div class="day_num">${d.getDate()}</div>${stamp}</div>`;
  }
  calDiv.innerHTML = html + `</div>`;
}

function renderContentList(type) {
  const titleMap = { cognitive:"오늘의 인지콕", mind:"마음 체크리스트", review:"복습 활동", gym:"건강 체조", origami:"종이 접기" };
  $("[data-bind='list_title']", appMain).textContent = titleMap[type] || "활동 목록";

  const list = state.contents[type] || state.contents.cognitive;
  const rail = $(".content_rail", appMain);
  
  rail.innerHTML = list.map(item => `
    <button class="rail_item" data-action="play" data-id="${item.id}">
      <div class="thumb_box">
        <img src="/m/assets/thumb_${item.id}.png" onerror="this.src='https://via.placeholder.com/300x170?text=SilverKok'">
      </div>
      <strong style="font-size:1.1rem; color:var(--sec);">${item.title}</strong>
    </button>`).join("");
}

function renderPlayer(item) {
  if(!item) return;
  const area = $("#player_area", appMain);
  let src = "";
  if(item.srcType === 'yt') src = `https://www.youtube.com/embed/${item.url}?autoplay=1`;
  else src = `http://brand.kidscokmini.com/data/kidscok_data/silver/${item.url}`;

  // iframe
  area.innerHTML = `<iframe src="${src}" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
  
  // HTTP 경고 (콘솔)
  if(item.srcType === 'html' && location.protocol === 'https:') {
    console.warn("HTTPS 환경에서는 HTTP 콘텐츠가 차단될 수 있습니다.");
    // 필요 시 대체 UI 표시 가능
  }
}

function findContent(type, id) {
  return (state.contents[type] || state.contents.cognitive).find(x => x.id === id);
}

function saveNewElder() {
  const name = $("#inp_name").value;
  const birth = $("#inp_birth").value;
  if(!name || !birth) return alert("필수 정보를 입력해주세요.");
  state.profiles.push({ name, birth, img: $("#preview_img").src });
  ShowScreen("t_profile_select");
}

function openModal(title, src) {
  const m = document.createElement("div");
  m.className = "modal_wrap";
  m.innerHTML = `
    <div class="modal_bg"></div>
    <div class="modal_content">
      <div class="modal_head"><span>${title}</span><button data-action="close_modal" style="font-size:1.5rem;">&times;</button></div>
      <div style="padding:0; max-height:80vh; overflow-y:auto; text-align:center;">
        <img src="${src}" onerror="this.src='https://via.placeholder.com/800x600?text=이미지없음'" style="width:100%;">
      </div>
    </div>`;
  appDom.appendChild(m);
}

// PC 드래그 스크롤 (마우스로 스와이프)
function enableDragScroll() {
  const sliders = document.querySelectorAll('.drag_scroll');
  sliders.forEach(slider => {
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => {
      isDown = true; slider.classList.add('dragging');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('dragging'); });
    slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('dragging'); });
    slider.addEventListener('mousemove', (e) => {
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2; // 스크롤 속도
      slider.scrollLeft = scrollLeft - walk;
    });
  });
}

window.handleFile = function(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = $("#preview_img"); img.src = e.target.result; img.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
};