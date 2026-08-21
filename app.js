const subjects = [
  { id:'anatomy', name:'Human Anatomy', icon:'AN', progress:72, lectures:18, grade:91, color:'green' },
  { id:'chemistry', name:'Organic Chemistry', icon:'CH', progress:58, lectures:16, grade:84, color:'amber' },
  { id:'physics', name:'Medical Physics', icon:'PH', progress:43, lectures:14, grade:79, color:'blue' },
  { id:'biology', name:'Cell Biology', icon:'BI', progress:81, lectures:20, grade:93, color:'violet' }
];

const schedule = [
  { time:'09:00', title:'Anatomy — Thorax review', type:'Lecture', room:'Hall B' },
  { time:'11:30', title:'Organic Chemistry practice', type:'Study', room:'Library 2' },
  { time:'14:00', title:'Cell Biology quiz prep', type:'Quiz', room:'Online' }
];

const rooms = [
  { id:1, name:'Anatomy Sprint', topic:'Thorax + Abdomen', members:['SA','MK','LN'], live:true },
  { id:2, name:'Chemistry Problem Lab', topic:'Reaction mechanisms', members:['YA','OM'], live:true },
  { id:3, name:'Quiet Focus 50/10', topic:'Pomodoro study room', members:['AR','NO','AM','+4'], live:false }
];

let posts = [
  { name:'Sara Ahmed', initials:'SA', text:'Does anyone have a good way to remember the branches of the aortic arch?', meta:'12 min ago · Anatomy' },
  { name:'Omar Kareem', initials:'OK', text:'Uploaded my reaction-mechanism summary. It helped me organize SN1/SN2 and E1/E2 in one page.', meta:'38 min ago · Chemistry' }
];

let state = { route:'dashboard', subjectTab:'subjects', joinedRooms:new Set(), manager:false };
const content = document.getElementById('content');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

function toast(message) {
  const el = document.createElement('div'); el.className='toast'; el.textContent=message;
  document.body.appendChild(el); setTimeout(()=>el.remove(),2200);
}

function setRoute(route) {
  state.route = route;
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.route===route));
  render();
}

function sectionHead(eyebrow,title,action='') {
  return `<div class="section-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div>${action}</div>`;
}

function subjectCards() {
  return `<div class="grid grid-4">${subjects.map(s=>`
    <article class="card subject-card" data-subject="${s.id}">
      <div class="subject-icon">${s.icon}</div><h3>${s.name}</h3>
      <div class="muted" style="font-size:11px">${s.lectures} lectures · ${s.grade}% current grade</div>
      <div class="meter"><span style="width:${s.progress}%"></span></div>
      <div class="subject-meta"><span>${s.progress}% complete</span><span>Open →</span></div>
    </article>`).join('')}</div>`;
}

function dashboard() {
  return `
    <div class="manager-banner">Manager mode is active. You can add, edit and remove learning content.</div>
    <div class="hero">
      <section class="hero-card">
        <div class="eyebrow" style="color:#9ed8c2">Friday · Study dashboard</div>
        <h1>Build momentum, one focused session at a time.</h1>
        <p>Your next study block is ready. Continue where you stopped, join classmates, or review today’s schedule.</p>
        <div class="hero-actions"><button class="btn btn-light" data-go="subjects">Continue studying</button><button class="btn btn-ghost" style="color:white;border-color:rgba(255,255,255,.18)" data-go="schedule">View schedule</button></div>
      </section>
      <aside class="focus-card">
        <div class="eyebrow">Today’s focus</div><div class="focus-time">2h 45m</div>
        <p class="muted">3 focused sessions completed. Your weekly target is 15 hours.</p>
        <div class="progress-ring"><span></span></div><small class="muted" style="margin-top:10px">68% of daily study target</small>
      </aside>
    </div>
    ${sectionHead('Your course','Continue your subjects','<button class="btn btn-ghost manager-only" id="addSubject">+ Add subject</button>')}
    ${subjectCards()}
    ${sectionHead('Today','Upcoming schedule','<button class="btn btn-ghost" data-go="schedule">See full schedule</button>')}
    <div class="schedule-list">${schedule.slice(0,2).map(item=>scheduleRow(item)).join('')}</div>
    ${sectionHead('Progress','This week')}
    <div class="grid grid-4">
      <div class="card stat"><span class="muted">Study time</span><b>11.4h</b><span class="tag">+18%</span></div>
      <div class="card stat"><span class="muted">Lessons finished</span><b>14</b><span class="tag">4 this week</span></div>
      <div class="card stat"><span class="muted">Average grade</span><b>86.8%</b><span class="tag">Strong</span></div>
      <div class="card stat"><span class="muted">Study streak</span><b>8 days</b><span class="tag">Best: 12</span></div>
    </div>`;
}

function scheduleRow(item) {
  return `<div class="schedule-item"><div class="time-badge">${item.time}</div><div><strong>${item.title}</strong><div class="muted" style="font-size:11px;margin-top:4px">${item.room} · <span class="tag">${item.type}</span></div></div><button class="btn btn-ghost schedule-done">Mark done</button></div>`;
}

function subjectsPage() {
  return `<h1 class="page-title">Subjects</h1><p class="muted">Study resources, grades and learning analytics for your active course.</p>
  <div class="subnav"><button class="${state.subjectTab==='subjects'?'active':''}" data-tab="subjects">Subjects</button><button class="${state.subjectTab==='grades'?'active':''}" data-tab="grades">Degrees</button><button class="${state.subjectTab==='analytics'?'active':''}" data-tab="analytics">Analytics</button></div>
  <div class="manager-banner">Manager mode: create subjects and maintain lectures, grades and resources.</div>
  ${state.subjectTab==='subjects' ? `<div class="toolbar"><input class="search" id="subjectSearch" placeholder="Search your subjects"><button class="btn btn-primary manager-only" id="addSubject">+ New subject</button></div><div id="subjectGrid">${subjectCards()}</div>` : ''}
  ${state.subjectTab==='grades' ? `<div class="grid grid-2">${subjects.map(s=>`<div class="card"><div class="subject-meta"><strong>${s.name}</strong><span class="tag">${s.grade}%</span></div><div class="meter"><span style="width:${s.grade}%"></span></div><p class="muted">Current weighted course degree based on completed assessments.</p></div>`).join('')}</div>`:''}
  ${state.subjectTab==='analytics' ? `<div class="grid grid-3"><div class="card stat"><span class="muted">Best subject</span><b>Cell Biology</b><span class="tag">93%</span></div><div class="card stat"><span class="muted">Needs attention</span><b>Physics</b><span class="tag">79%</span></div><div class="card stat"><span class="muted">Completion</span><b>64%</b><span class="tag">Across course</span></div></div>`:''}`;
}

function subjectDetail(id) {
  const s=subjects.find(x=>x.id===id); if(!s) return;
  content.innerHTML = `<button class="btn btn-ghost" id="backSubjects">← Back</button><div style="height:20px"></div><div class="eyebrow">Subject workspace</div><h1 class="page-title">${s.name}</h1><p class="muted">All lectures, results and progress for this subject.</p>
    <div class="grid grid-3" style="margin:24px 0"><div class="card stat"><span class="muted">Completion</span><b>${s.progress}%</b></div><div class="card stat"><span class="muted">Current degree</span><b>${s.grade}%</b></div><div class="card stat"><span class="muted">Lectures</span><b>${s.lectures}</b></div></div>
    ${sectionHead('Learning','Lectures','<button class="btn btn-primary manager-only" id="addLecture">+ Add lecture</button>')}
    <div class="schedule-list">${['Core concepts and introduction','Clinical applications','Revision and self-test'].map((x,i)=>`<div class="schedule-item"><div class="time-badge">0${i+1}</div><div><strong>${x}</strong><div class="muted" style="font-size:11px">Notes · Flashcards · Mind map</div></div><button class="btn btn-ghost lecture-open">Open</button></div>`).join('')}</div>`;
  bindCommon();
  document.getElementById('backSubjects').onclick=()=>setRoute('subjects');
  document.querySelectorAll('.lecture-open').forEach(b=>b.onclick=()=>toast('Lecture workspace opened'));
}

function schedulePage() {
  return `<h1 class="page-title">Schedule</h1><p class="muted">Plan classes and study sessions around your active course.</p>
  <div class="toolbar"><button class="btn btn-primary" id="addSchedule">+ Add study block</button><button class="btn btn-ghost" id="clearDone">Reset completed</button></div>
  <div class="schedule-list">${schedule.map(scheduleRow).join('')}</div>`;
}

function roomsPage() {
  return `<h1 class="page-title">Study rooms</h1><p class="muted">Focus together in live rooms organized around subjects and goals.</p>
  <div class="toolbar"><button class="btn btn-primary" id="createRoom">+ Create room</button></div>
  <div class="grid grid-3">${rooms.map(r=>`<article class="card room-card"><div class="room-top"><div><span class="tag">${r.live?'Live now':'Open room'}</span><h3 style="margin-top:12px">${r.name}</h3><p class="muted">${r.topic}</p></div></div><div class="room-members">${r.members.map(x=>`<span class="mini-avatar">${x}</span>`).join('')}</div><button class="btn ${state.joinedRooms.has(r.id)?'btn-ghost':'btn-primary'} room-btn" data-room="${r.id}" style="margin-top:18px">${state.joinedRooms.has(r.id)?'Leave room':'Join room'}</button></article>`).join('')}</div>`;
}

function communityPage() {
  return `<h1 class="page-title">Community</h1><p class="muted">Ask questions, share resources and learn with people in your course.</p>
  <div class="toolbar"><button class="btn btn-primary" id="newPost">+ New post</button></div>
  <div class="feed">${posts.map(p=>`<article class="card post"><div class="avatar">${p.initials}</div><div><strong>${p.name}</strong><div class="muted" style="font-size:10px;margin-top:3px">${p.meta}</div><p>${p.text}</p><div class="post-actions"><span>♡ Helpful</span><span>↩ Reply</span><span>⋯ More</span></div></div></article>`).join('')}</div>`;
}

function infoPage(name) {
  const map={jobs:['Find a work','Career opportunities for students will appear here.'],scholarships:['Scholarships','Discover scholarships matched to your stage and field.'],volunteer:['Volunteer','Find meaningful volunteering opportunities and build experience.'],donate:['Donate to us','Support the student community and help us keep resources accessible.'],profile:['Profile','Manage your study identity, active course and learning record.'],settings:['Settings','Control notifications, accessibility, appearance and privacy.']};
  const [title,desc]=map[name]||['Colleage','Student workspace'];
  return `<h1 class="page-title">${title}</h1><p class="muted">${desc}</p><div class="card" style="margin-top:24px"><h3>Workspace ready</h3><p class="muted">This route is wired into the application and ready for backend data integration.</p></div>`;
}

function render() {
  if(state.route==='dashboard') content.innerHTML=dashboard();
  else if(state.route==='subjects') content.innerHTML=subjectsPage();
  else if(state.route==='schedule') content.innerHTML=schedulePage();
  else if(state.route==='rooms') content.innerHTML=roomsPage();
  else if(state.route==='community') content.innerHTML=communityPage();
  else content.innerHTML=infoPage(state.route);
  bindCommon();
}

function openModal(html) { modalContent.innerHTML=html; modal.showModal(); }
function bindCommon() {
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setRoute(b.dataset.go));
  document.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>subjectDetail(b.dataset.subject));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.subjectTab=b.dataset.tab;render();});
  document.querySelectorAll('.schedule-done').forEach(b=>b.onclick=()=>{b.textContent='Completed ✓';b.disabled=true;toast('Study block completed');});
  document.querySelectorAll('.room-btn').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.room); state.joinedRooms.has(id)?state.joinedRooms.delete(id):state.joinedRooms.add(id);render();toast(state.joinedRooms.has(id)?'Joined study room':'Left study room');});
  const search=document.getElementById('subjectSearch'); if(search) search.oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.subject-card').forEach(c=>c.style.display=c.innerText.toLowerCase().includes(q)?'flex':'none');};
  const addSubject=document.getElementById('addSubject'); if(addSubject) addSubject.onclick=()=>openModal(`<div class="eyebrow">Manager tool</div><h2>Add subject</h2><div class="form-grid"><input placeholder="Subject name"><input placeholder="Subject code"><button class="btn btn-primary" id="saveSubject" type="button">Create subject</button></div>`);
  const addSchedule=document.getElementById('addSchedule'); if(addSchedule) addSchedule.onclick=()=>openModal(`<div class="eyebrow">Schedule</div><h2>New study block</h2><div class="form-grid"><input placeholder="Title"><input type="time"><select><option>Study</option><option>Lecture</option><option>Quiz</option></select><button class="btn btn-primary" type="button" id="saveSchedule">Add to schedule</button></div>`);
  const createRoom=document.getElementById('createRoom'); if(createRoom) createRoom.onclick=()=>openModal(`<div class="eyebrow">Study rooms</div><h2>Create a room</h2><div class="form-grid"><input placeholder="Room name"><input placeholder="Topic"><button class="btn btn-primary" type="button" id="saveRoom">Create room</button></div>`);
  const newPost=document.getElementById('newPost'); if(newPost) newPost.onclick=()=>openModal(`<div class="eyebrow">Community</div><h2>Share with your course</h2><div class="form-grid"><textarea id="postText" placeholder="Ask a question or share a useful resource..."></textarea><button class="btn btn-primary" type="button" id="publishPost">Publish post</button></div>`);
  setTimeout(()=>{
    ['saveSubject','saveSchedule','saveRoom'].forEach(id=>{const el=document.getElementById(id);if(el)el.onclick=()=>{modal.close();toast('Saved successfully');};});
    const publish=document.getElementById('publishPost'); if(publish) publish.onclick=()=>{const t=document.getElementById('postText').value.trim();if(t){posts.unshift({name:'Hatem Khalifa',initials:'HK',text:t,meta:'Just now · General'});modal.close();render();toast('Post published');}};
  },0);
}

document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>setRoute(b.dataset.route));
document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));state.route=b.dataset.side;render();document.getElementById('sidebar').classList.remove('open');});
document.getElementById('mobileMenu').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
document.getElementById('roleToggle').onclick=()=>{state.manager=!state.manager;document.body.classList.toggle('manager',state.manager);document.getElementById('roleLabel').textContent=state.manager?'Manager':'Student';toast(`${state.manager?'Manager':'Student'} mode active`);render();};
document.getElementById('searchBtn').onclick=()=>{setRoute('subjects');setTimeout(()=>document.getElementById('subjectSearch')?.focus(),50);};
modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});
render();
