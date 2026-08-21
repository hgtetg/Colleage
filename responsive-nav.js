(() => {
  const content = document.getElementById('content');
  const subNav = document.getElementById('subNav');
  const deviceTitle = document.getElementById('devicePageTitle');
  const updatesButton = document.getElementById('updatesButton');
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  let currentRoute = 'dashboard';
  let syncTimer = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  const definitions = {
    dashboard: [
      { label: 'Overview', action: 'top' },
      { label: 'Subjects', action: 'scroll', value: 'Subjects' },
      { label: 'Next up', action: 'scroll', value: 'Schedule' }
    ],
    subjects: [
      { label: 'All', action: 'subjects', value: 'all' },
      { label: 'Incomplete', action: 'subjects', value: 'incomplete' },
      { label: 'Complete', action: 'subjects', value: 'complete' }
    ],
    subjectDetail: [
      { label: 'Lectures', action: 'scroll', value: 'Learning path' },
      { label: 'Grades', action: 'scroll', value: 'Assessment' }
    ],
    schedule: [
      { label: 'All', action: 'schedule', value: 'all' },
      { label: 'Open', action: 'schedule', value: 'open' },
      { label: 'Completed', action: 'schedule', value: 'completed' }
    ],
    rooms: [
      { label: 'All rooms', action: 'rooms', value: 'all' },
      { label: 'Open', action: 'rooms', value: 'open' },
      { label: 'Joined', action: 'rooms', value: 'joined' }
    ],
    roomDetail: [
      { label: 'Overview', action: 'top' },
      { label: 'Messages', action: 'scroll', value: 'Room conversation' }
    ],
    community: [
      { label: 'Latest', action: 'posts', value: 'all' },
      { label: 'My posts', action: 'posts', value: 'mine' }
    ],
    profile: [
      { label: 'Academic profile', action: 'top' },
      { label: 'Courses', action: 'course' }
    ],
    guest: [
      { label: 'Sign in', action: 'auth', value: 'login' },
      { label: 'Create account', action: 'auth', value: 'signup' }
    ]
  };

  function inferRoute() {
    if (content?.querySelector('#backSubjects')) return 'subjects';
    if (content?.querySelector('#backRooms')) return 'rooms';
    const pageTitle = content?.querySelector('.page-title')?.textContent?.trim().toLowerCase();
    if (pageTitle === 'profile') return 'profile';
    const active = document.querySelector('.main-nav [data-route].active');
    if (active?.dataset.route) return active.dataset.route;
    return currentRoute;
  }

  function isGuest() {
    return document.getElementById('profileName')?.textContent?.trim() === 'Guest';
  }

  function contextKey(route) {
    if (isGuest()) return 'guest';
    if (route === 'subjects' && content?.querySelector('#backSubjects')) return 'subjectDetail';
    if (route === 'rooms' && content?.querySelector('#backRooms')) return 'roomDetail';
    return route;
  }

  function sync() {
    currentRoute = inferRoute();
    const pageTitle = content?.querySelector('.page-title')?.textContent?.trim();
    const activeLabel = document.querySelector(`.main-nav [data-route="${CSS.escape(currentRoute)}"] span:last-child`)?.textContent?.trim();
    if (deviceTitle) deviceTitle.textContent = isGuest() ? 'Colleage' : (pageTitle || activeLabel || 'Colleage');
    renderSubnav(contextKey(currentRoute));
  }

  function renderSubnav(key) {
    if (!subNav) return;
    const items = definitions[key] || [];
    subNav.innerHTML = items.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-sub-index="${index}">${esc(item.label)}</button>`).join('');
    subNav.querySelectorAll('[data-sub-index]').forEach(button => {
      button.addEventListener('click', () => {
        const item = items[Number(button.dataset.subIndex)];
        runSubAction(item);
        subNav.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === button));
      });
    });
  }

  function runSubAction(item) {
    if (!item) return;
    if (item.action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (item.action === 'scroll') scrollSection(item.value);
    if (item.action === 'subjects') filterSubjects(item.value);
    if (item.action === 'schedule') filterSchedule(item.value);
    if (item.action === 'rooms') filterRooms(item.value);
    if (item.action === 'posts') filterPosts(item.value);
    if (item.action === 'course') document.getElementById('courseButton')?.click();
    if (item.action === 'auth') document.querySelector(`[data-auth="${item.value}"]`)?.click();
  }

  function scrollSection(term) {
    const wanted = String(term).toLowerCase();
    const sections = [...content.querySelectorAll('.section-head')];
    const target = sections.find(section => {
      const h = section.querySelector('h2')?.textContent?.trim().toLowerCase() || '';
      const k = section.querySelector('.eyebrow')?.textContent?.trim().toLowerCase() || '';
      return h.includes(wanted) || k.includes(wanted);
    });
    (target || content).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filterSubjects(mode) {
    content.querySelectorAll('.subject-card').forEach(card => {
      const text = card.querySelector('.subject-meta span')?.textContent || '0%';
      const progress = Number((text.match(/\d+/) || ['0'])[0]);
      const show = mode === 'all' || (mode === 'complete' ? progress >= 100 : progress < 100);
      card.style.display = show ? '' : 'none';
    });
  }

  function filterSchedule(mode) {
    content.querySelectorAll('.schedule-item').forEach(row => {
      const completed = row.classList.contains('completed');
      row.style.display = mode === 'all' || (mode === 'completed' ? completed : !completed) ? '' : 'none';
    });
  }

  function filterRooms(mode) {
    content.querySelectorAll('.room-card').forEach(card => {
      const open = !!card.querySelector('.tag.green');
      const joined = !!card.querySelector('[data-room-membership][data-joined="1"]');
      const show = mode === 'all' || (mode === 'open' ? open : joined);
      card.style.display = show ? '' : 'none';
    });
  }

  function filterPosts(mode) {
    const me = document.getElementById('profileName')?.textContent?.trim() || '';
    content.querySelectorAll('.post').forEach(post => {
      const author = post.querySelector('.post-head strong')?.textContent?.trim() || '';
      post.style.display = mode === 'all' || author === me ? '' : 'none';
    });
  }

  async function getJson(path) {
    const response = await fetch(path, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function openUpdates() {
    if (!modal || !modalContent || !updatesButton) return;
    updatesButton.disabled = true;
    try {
      const [scheduleData, roomsData] = await Promise.all([getJson('/api/schedule'), getJson('/api/rooms')]);
      const schedule = (scheduleData.items || [])
        .filter(item => !Number(item.completed))
        .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
        .slice(0, 4);
      const rooms = (roomsData.rooms || []).filter(room => Number(room.is_live) === 1).slice(0, 4);
      const scheduleHtml = schedule.length ? schedule.map(item => `<div class="update-row"><div class="update-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg></div><div><strong>${esc(item.title)}</strong><span>${esc(formatDate(item.start_at))}${item.location ? ` · ${esc(item.location)}` : ''}</span></div></div>`).join('') : '<p class="muted">No open schedule items.</p>';
      const roomsHtml = rooms.length ? rooms.map(room => `<div class="update-row"><div class="update-icon"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4.5 4.5 0 0 1 8.5-2"/></svg></div><div><strong>${esc(room.name)}</strong><span>${esc(room.topic || 'Open study room')} · ${Number(room.member_count || 0)} member(s)</span></div></div>`).join('') : '<p class="muted">No open study rooms.</p>';
      modalContent.innerHTML = `<div class="eyebrow">STUDY UPDATES</div><h2>What needs your attention</h2><p class="muted">This panel uses your saved schedule and currently open course rooms. It does not invent unread notifications.</p><div class="section-head"><div><h2 style="font-size:17px">Schedule</h2></div><button class="btn btn-ghost" data-update-route="schedule">Open schedule</button></div><div class="update-list">${scheduleHtml}</div><div class="section-head"><div><h2 style="font-size:17px">Study rooms</h2></div><button class="btn btn-ghost" data-update-route="rooms">Open rooms</button></div><div class="update-list">${roomsHtml}</div>`;
      modal.showModal();
      modalContent.querySelectorAll('[data-update-route]').forEach(button => button.addEventListener('click', () => {
        modal.close();
        navigate(button.dataset.updateRoute);
      }));
    } catch (error) {
      modalContent.innerHTML = `<div class="eyebrow">STUDY UPDATES</div><h2>Updates are unavailable</h2><p class="muted">${esc(error.message)}</p>`;
      modal.showModal();
    } finally {
      updatesButton.disabled = false;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function navigate(routeName) {
    const button = document.querySelector(`.main-nav [data-route="${CSS.escape(routeName)}"]`);
    if (button) button.click();
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton?.dataset.route) {
      currentRoute = routeButton.dataset.route;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(sync, 0);
    }
    if (event.target.closest('#profileLink')) {
      currentRoute = 'profile';
      clearTimeout(syncTimer);
      syncTimer = setTimeout(sync, 0);
    }
  }, true);

  updatesButton?.addEventListener('click', openUpdates);

  if (content) {
    const observer = new MutationObserver(() => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(sync, 12);
    });
    observer.observe(content, { childList: true, subtree: true });
  }

  window.addEventListener('resize', () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 40);
  });

  sync();
})();
