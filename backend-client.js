(() => {
  const api = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  };

  window.ColleageAPI = { request: api, user: null, activeCourseId: null };

  const authButton = document.getElementById('authButton');
  const roleToggle = document.getElementById('roleToggle');

  function initials(name = '') {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || 'ST';
  }

  function showToast(message) {
    if (typeof toast === 'function') toast(message);
    else console.info(message);
  }

  function setUser(user) {
    window.ColleageAPI.user = user || null;
    if (authButton) authButton.innerHTML = user ? `<span class="auth-dot"></span>${escapeHtml(user.fullName.split(' ')[0])}` : 'Sign in';

    const profileName = document.querySelector('.profile-copy strong');
    const profileAvatar = document.querySelector('.profile-card .avatar');
    const roleLabel = document.getElementById('roleLabel');
    if (user) {
      if (profileName) profileName.textContent = user.fullName;
      if (profileAvatar) profileAvatar.textContent = initials(user.fullName);
      if (roleLabel) roleLabel.textContent = user.role === 'manager' ? 'Manager' : 'Student';
      if (roleToggle) {
        roleToggle.disabled = user.role !== 'manager';
        roleToggle.title = user.role === 'manager' ? 'Toggle manager editing view' : 'Manager tools require a manager account';
      }
    } else {
      if (roleLabel) roleLabel.textContent = 'Guest';
      if (roleToggle) roleToggle.disabled = true;
    }
  }

  async function loadSession() {
    try {
      const data = await api('/api/auth/me');
      setUser(data.user);
      await hydrateApp();
    } catch (error) {
      if (error.status === 401) setUser(null);
      else console.warn('Backend is not ready yet:', error.message);
    }
  }

  async function hydrateApp() {
    if (!window.ColleageAPI.user) return;
    const results = await Promise.allSettled([
      api('/api/courses'),
      api('/api/subjects'),
      api('/api/schedule'),
      api('/api/rooms'),
      api('/api/posts')
    ]);

    const [coursesResult, subjectsResult, scheduleResult, roomsResult, postsResult] = results;
    if (coursesResult.status === 'fulfilled') {
      const active = coursesResult.value.enrolled?.find(x => x.is_active) || coursesResult.value.enrolled?.[0];
      window.ColleageAPI.activeCourseId = active?.id || null;
    }

    try {
      if (subjectsResult.status === 'fulfilled' && typeof subjects !== 'undefined') {
        const mapped = subjectsResult.value.subjects.map((s, i) => ({
          id: s.id,
          name: s.name,
          code: s.code || 'SUBJ',
          icon: s.icon || ['book', 'flask', 'atom', 'dna'][i % 4],
          progress: Number(s.progress || 0),
          lectures: Number(s.lectures || 0),
          grade: Number(s.grade || 0),
          tone: ['#ecfdf3', '#fff7ed', '#eff6ff', '#f5f3ff'][i % 4],
          ink: ['#047857', '#c2410c', '#1d4ed8', '#6d28d9'][i % 4]
        }));
        subjects.splice(0, subjects.length, ...mapped);
      }

      if (scheduleResult.status === 'fulfilled' && typeof schedule !== 'undefined') {
        const mapped = scheduleResult.value.items.map(item => {
          const date = new Date(item.start_at);
          return {
            id: item.id,
            time: Number.isNaN(date.getTime()) ? item.start_at : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: item.title,
            type: item.type || 'Study',
            room: item.location || 'Not set',
            completed: !!item.completed
          };
        });
        schedule.splice(0, schedule.length, ...mapped);
      }

      if (roomsResult.status === 'fulfilled' && typeof rooms !== 'undefined') {
        const mapped = roomsResult.value.rooms.map(room => ({
          id: room.id,
          name: room.name,
          topic: room.topic || 'General study',
          members: room.member_count ? [`+${room.member_count}`] : [],
          live: !!room.is_live
        }));
        rooms.splice(0, rooms.length, ...mapped);
        if (typeof state !== 'undefined') {
          state.joinedRooms = new Set(roomsResult.value.rooms.filter(r => r.joined).map(r => r.id));
        }
      }

      if (postsResult.status === 'fulfilled' && typeof posts !== 'undefined') {
        posts.splice(0, posts.length, ...postsResult.value.posts.map(post => ({
          id: post.id,
          name: post.full_name,
          initials: initials(post.full_name),
          text: post.body,
          meta: `${relativeTime(post.created_at)} · Community`
        })));
      }

      if (typeof render === 'function') render();
    } catch (error) {
      console.warn('Could not hydrate the current UI:', error);
    }
  }

  function openAuth(mode = 'login') {
    const overlay = ensureAuthOverlay();
    overlay.dataset.mode = mode;
    overlay.querySelector('.auth-login').hidden = mode !== 'login';
    overlay.querySelector('.auth-signup').hidden = mode !== 'signup';
    overlay.classList.add('show');
  }

  function ensureAuthOverlay() {
    let overlay = document.getElementById('authOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-panel" role="dialog" aria-modal="true" aria-label="Account">
        <button class="auth-close" type="button" aria-label="Close">×</button>
        <div class="auth-brand"><span>C</span><strong>Colleage</strong></div>
        <section class="auth-login">
          <div class="eyebrow">Welcome back</div><h2>Sign in</h2>
          <p>Sync your courses, schedule, rooms and community activity.</p>
          <form id="loginForm" class="auth-form">
            <label>Email<input name="email" type="email" autocomplete="email" required></label>
            <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
            <div class="auth-error" aria-live="polite"></div>
            <button class="btn btn-primary" type="submit">Sign in</button>
          </form>
          <button class="auth-switch" type="button" data-auth-mode="signup">Create an account</button>
        </section>
        <section class="auth-signup" hidden>
          <div class="eyebrow">Get started</div><h2>Create account</h2>
          <p>Your academic profile can automatically match you to a course.</p>
          <form id="signupForm" class="auth-form">
            <label>Full name<input name="fullName" autocomplete="name" required></label>
            <label>Email<input name="email" type="email" autocomplete="email" required></label>
            <label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
            <div class="auth-grid-2"><label>Stage<input name="stage" placeholder="Second Stage"></label><label>Field<input name="field" placeholder="Medicine"></label></div>
            <div class="auth-grid-2"><label>Institution type<select name="institutionType"><option value="">Select</option><option value="university">University</option><option value="school">School</option></select></label><label>Institution<input name="institutionName" placeholder="University name"></label></div>
            <label>Account type<select name="role" id="signupRole"><option value="student">Student</option><option value="manager">Manager</option></select></label>
            <label id="managerCodeRow" hidden>Manager invite code<input name="managerCode" autocomplete="off"></label>
            <div class="auth-error" aria-live="polite"></div>
            <button class="btn btn-primary" type="submit">Create account</button>
          </form>
          <button class="auth-switch" type="button" data-auth-mode="login">I already have an account</button>
        </section>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.auth-close').onclick = () => overlay.classList.remove('show');
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.classList.remove('show'); });
    overlay.querySelectorAll('[data-auth-mode]').forEach(button => button.onclick = () => openAuth(button.dataset.authMode));
    overlay.querySelector('#signupRole').onchange = event => {
      overlay.querySelector('#managerCodeRow').hidden = event.target.value !== 'manager';
    };
    overlay.querySelector('#loginForm').onsubmit = login;
    overlay.querySelector('#signupForm').onsubmit = signup;
    return overlay;
  }

  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('.auth-error');
    error.textContent = '';
    const values = Object.fromEntries(new FormData(form));
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
      setUser(data.user);
      document.getElementById('authOverlay')?.classList.remove('show');
      await hydrateApp();
      showToast('Signed in successfully');
    } catch (err) { error.textContent = err.message; }
  }

  async function signup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('.auth-error');
    error.textContent = '';
    const values = Object.fromEntries(new FormData(form));
    try {
      const data = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(values) });
      setUser(data.user);
      document.getElementById('authOverlay')?.classList.remove('show');
      await hydrateApp();
      showToast('Account created');
    } catch (err) { error.textContent = err.message; }
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
    setUser(null);
    location.reload();
  }

  async function syncInteraction(event) {
    if (!window.ColleageAPI.user) return;
    const button = event.target.closest('button');
    if (!button) return;

    try {
      if (button.classList.contains('schedule-done')) {
        const row = button.closest('.schedule-item');
        const time = row?.querySelector('.time-badge')?.textContent.trim();
        const title = row?.querySelector('strong')?.textContent.trim();
        const item = typeof schedule !== 'undefined' ? schedule.find(x => x.time === time && x.title === title) : null;
        if (item?.id) await api(`/api/schedule/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) });
      }

      if (button.classList.contains('room-btn')) {
        const id = button.dataset.room;
        const joined = typeof state !== 'undefined' && state.joinedRooms.has(id);
        await api(`/api/rooms/${encodeURIComponent(id)}/join`, { method: joined ? 'POST' : 'DELETE', body: '{}' });
      }

      if (button.id === 'publishPost') {
        const text = document.getElementById('postText')?.value.trim();
        if (text) {
          await api('/api/posts', { method: 'POST', body: JSON.stringify({ body: text }) });
          await hydrateApp();
        }
      }
    } catch (error) {
      console.warn('Background sync failed:', error.message);
      showToast(error.message);
    }
  }

  if (authButton) authButton.onclick = () => window.ColleageAPI.user ? showAccountMenu() : openAuth('login');
  document.addEventListener('click', syncInteraction);

  function showAccountMenu() {
    const existing = document.getElementById('accountMenu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'accountMenu';
    menu.className = 'account-menu';
    menu.innerHTML = `<strong>${escapeHtml(window.ColleageAPI.user.fullName)}</strong><span>${escapeHtml(window.ColleageAPI.user.email)}</span><button type="button" id="accountProfile">Open profile</button><button type="button" id="accountLogout">Sign out</button>`;
    document.body.appendChild(menu);
    document.getElementById('accountProfile').onclick = () => { if (typeof setRoute === 'function') setRoute('profile'); menu.remove(); };
    document.getElementById('accountLogout').onclick = logout;
    setTimeout(() => document.addEventListener('click', function close(e) { if (!menu.contains(e.target) && e.target !== authButton) { menu.remove(); document.removeEventListener('click', close); } }), 0);
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} d ago`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch]);
  }

  loadSession();
})();
