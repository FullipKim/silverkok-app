const $ = (sel, root = document) => root.querySelector(sel);
let rootEl, frameCache = {}, appDom, appMain;

const state = {
  currentElder: null,
  currentListType: null,
  playingId: null, // ★ 현재 재생중인 ID 추적
  completed: new Set(), // ★ 완료된 ID 저장소
  profiles: [
    { name: "김금자", birth: "19420505", grade: "3등급", img: "https://i.pravatar.cc/150?u=1" },
    { name: "박철수", birth: "19450815", grade: "2등급", img: "https://i.pravatar.cc/150?u=2" }
  ],
  contents: {
    cognitive: Array.from({length:8}, (_, i) => ({
      id: `cog_${i+1}`, title: `십이간지 동물 찾기 ${i+1}`, srcType: 'html', 
      url: `01m_01w_03s_0${(i % 4) + 1}.html`
    })),
    gym: [
      { id: "gym_1", title: "건강 체조 1강", srcType: "yt", url: "y6120QOlsfU" },
      { id: "gym_2", title: "건강 체조 2강", srcType: "yt", url: "3SzoI798qPY" }
    ],
    origami: [ { id: "ori_1", title: "종이 접기 기초", srcType: "yt", url: "dQw4w9WgXcQ" } ]
  }
};
state.contents.mind = state.contents.review = state.contents.brain = state.contents.art = state.contents.focus = state.contents.cognitive;

export async function Start() {
  rootEl = document.getElementById("spa_root");
  await preloadFrames();
  ShowFrame("login");
}

async function preloadFrames() {
  const paths = { login: "/m/login.html", app: "/m/app.html" };
  for (const [key, url] of Object.entries(paths)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      frameCache[key] = await res.text();
    } catch(e) { console.error(e); }
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

  enableDragScroll();
}

function onAppClick(e) {
  const btn = e.target.closest("[data-action], [data-go]");
  if (!btn) return;
  const { action, go, name, type, id } = btn.dataset;

  if (action === "close_modal" || e.target.classList.contains("modal_bg")) { 
    $(".modal_wrap")?.remove(); return; 
  }

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
    case "plan": openModal("주간 계획안", "/m/assets/plan.png", 'img'); break;
    case "calendar_modal": openModal("월간 캘린더", null, 'cal'); break;
    case "add_elder": ShowScreen("t_profile_add"); break;
    case "trigger_file": $("#elder_file").click(); break;
    case "save_elder": saveNewElder(); break;

    case "open_list": 
      state.currentListType = type; 
      ShowScreen("t_content_list", { type }); 
      break;
    
    case "play": 
      const item = findContent(state.currentListType, id);
      state.playingId = id; // ★ 현재 재생 ID 저장
      ShowScreen("t_content_player", { item }); 
      break;

    case "done_content":
      // ★ 완료 버튼 클릭 시 ID 기록
      if(state.playingId) state.completed.add(state.playingId);
      alert("활동이 완료되었습니다.");
      ShowScreen("t_content_list", { type: state.currentListType });
      break;
    
    case "close_play": 
    case "back_to_person": 
      ShowScreen("t_person_home", state.currentElder); 
      break;
  }
}

// Logic Helpers
function calcAge(birth) {
  if(!birth || birth.length !== 8) return 0;
  const today = new Date();
  const by = parseInt(birth.substring(0,4));
  return today.getFullYear() - by;
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

  const calDiv = $("#weekly_cal_area", appMain);
  const days = ['일','월','화','수','목','금','토'];
  const today = new Date();
  let html = `<div class="calendar_row">`;
  for(let i=-3; i<=3; i++) {
     const d = new Date(); d.setDate(today.getDate() + i);
     const isToday = i===0 ? 'today' : '';
     const stamp = (i <= 0 && Math.random() > 0.3) ? `<div class="stamp">출석</div>` : "";
     html += `<div class="day_cell ${isToday}"><div class="day_name">${days[d.getDay()]}</div><div class="day_num">${d.getDate()}</div>${stamp}</div>`;
  }
  calDiv.innerHTML = html + `</div>`;

  const monthArea = $("#month_calendar_placeholder", appMain);
  if(monthArea) monthArea.innerHTML = generateCalendarHTML();
}

function generateCalendarHTML() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const todayDate = date.getDate();

  let html = `
    <div style="width:100%; max-width:400px; margin:0 auto;">
      <div style="font-weight:800; font-size:1.2rem; margin-bottom:10px; color:var(--sec); text-align:center;">${year}년 ${month+1}월</div>
      <div class="cal_grid_head">
        <div class="cal_head_cell" style="color:#E53E3E">일</div>
        <div class="cal_head_cell">월</div><div class="cal_head_cell">화</div><div class="cal_head_cell">수</div><div class="cal_head_cell">목</div><div class="cal_head_cell">금</div>
        <div class="cal_head_cell" style="color:#3182CE">토</div>
      </div>
      <div class="cal_grid_body">
  `;
  for(let i=0; i<firstDay; i++) html += `<div></div>`;
  for(let i=1; i<=lastDate; i++) {
    const isToday = i === todayDate ? 'today' : '';
    const dot = (i <= todayDate && Math.random() > 0.3) ? `<div class="cal_dot"></div>` : "";
    html += `<div class="cal_cell ${isToday}">${i} ${dot}</div>`;
  }
  return html + `</div></div>`;
}

// ★ 완료 라벨(배지) 렌더링 복구 ★
function renderContentList(type) {
  const titleMap = { cognitive:"오늘의 인지콕", mind:"마음 체크리스트", review:"복습 활동", gym:"건강 체조", origami:"종이 접기" };
  $("[data-bind='list_title']", appMain).textContent = titleMap[type] || "활동 목록";

  const list = state.contents[type] || state.contents.cognitive;
  const rail = $(".content_rail", appMain);
  
  rail.innerHTML = list.map(item => {
    // 완료 여부 체크
    const isDone = state.completed.has(item.id);
    const badge = isDone ? `<div class="done_badge">완료</div>` : "";
    
    return `
    <button class="rail_item" data-action="play" data-id="${item.id}">
      <div class="thumb_box">
        <img src="/m/assets/thumb_${item.id}.png" style="display:none;" onload="this.style.display='block'">
        <span style="font-size:3rem;">▶</span>
        ${badge} </div>
      <strong style="font-size:1.1rem; color:var(--sec);">${item.title}</strong>
    </button>`;
  }).join("");
}

function renderPlayer(item) {
  if(!item) return;
  const area = $("#player_area", appMain);
  // (주의) 여기서는 completed 추가 안 함. 버튼 눌러야 추가됨.

  if(item.srcType === 'yt') {
    area.innerHTML = `<iframe src="https://www.youtube.com/embed/${item.url}?autoplay=1" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
  } else {
    if (location.protocol === 'https:') {
      area.innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; text-align:center;">
          <p style="font-size:1.2rem; margin-bottom:10px;">🔒 HTTPS 보안: 외부 콘텐츠 차단됨</p>
          <a href="http://brand.kidscokmini.com/data/kidscok_data/silver/${item.url}" target="_blank" class="btn_pill btn_primary" style="text-decoration:none;">새 창에서 열기</a>
        </div>`;
    } else {
      area.innerHTML = `<iframe src="http://brand.kidscokmini.com/data/kidscok_data/silver/${item.url}" style="width:100%; height:100%; border:0;" allowfullscreen></iframe>`;
    }
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

function openModal(title, src, type) {
  const m = document.createElement("div");
  m.className = "modal_wrap";
  
  let contentHtml = "";
  if (type === 'cal') {
    contentHtml = `<div style="padding:2rem;">${generateCalendarHTML()}</div>`;
  } else {
    // 이미지 모달
    contentHtml = `<div style="padding:0; max-height:80vh; overflow-y:auto; min-height:300px; background:#f8f9fa; display:flex; align-items:center; justify-content:center;">
        <img src="${src}" onerror="this.parentElement.innerHTML='<div style=\\'padding:2rem; color:#aaa; text-align:center;\\'>이미지가 없습니다<br>(${src})</div>'" style="width:100%;">
      </div>`;
  }

  m.innerHTML = `
    <div class="modal_bg"></div>
    <div class="modal_content">
      <div class="modal_head">
        <span>${title}</span>
        <button data-action="close_modal" style="font-size:1.5rem;">&times;</button>
      </div>
      ${contentHtml}
    </div>`;
  appDom.appendChild(m);
}

function enableDragScroll() {
  document.querySelectorAll('.drag_scroll').forEach(slider => {
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; slider.classList.add('dragging'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('dragging'); });
    slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('dragging'); });
    slider.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; slider.scrollLeft = scrollLeft - (x - startX) * 2; });
  });
}

window.handleFile = function(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => { $("#preview_img").src = e.target.result; $("#preview_img").classList.remove("hidden"); };
    reader.readAsDataURL(input.files[0]);
  }
};