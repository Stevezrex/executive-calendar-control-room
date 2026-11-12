import {
  STAGES, EVENTS, MEMO, HELP, TEMPLATES, MAX_ATTEMPTS, RULES, GRID,
  T, hhmm, dayName, dayShort, dayLong, dayMid, parseSlot, slotValue,
} from './data.js';

// ------------------------------------------------------------------ small helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NY = 360; // New York is 6 hours behind WAT on the dates in this week
const range = (start) => `${hhmm(start)} to ${hhmm(start + RULES.len)}`;

const ICONS = {
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12.5" r=".8" fill="currentColor"/>',
  car: '<path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="18" r=".8" fill="currentColor"/><circle cx="16.5" cy="18" r=".8" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checks: '<path d="M2.5 12.5l4.5 4.5L16 8"/><path d="M11 16l.5.5L21 7"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  memo: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5.6 15a8 8 0 1 0 .9-6.6L4 10"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// Sizes and positions are set here, not in markup, so the page needs no inline styles.
function place(root) {
  root.querySelectorAll('[data-y]').forEach((el) => {
    el.style.top = `calc(var(--row) * ${el.dataset.y})`;
    if (el.dataset.n) el.style.height = `calc(var(--row) * ${el.dataset.n})`;
  });
  root.querySelectorAll('[data-pw]').forEach((el) => { el.style.width = el.dataset.pw + '%'; });
  root.querySelectorAll('[data-gc]').forEach((el) => {
    el.style.gridTemplateColumns = el.dataset.gc;
    el.style.setProperty('--rows', el.dataset.gr);
  });
}

// ------------------------------------------------------------------ state
const S = {
  screen: 'login', // login | memo | work | end | done
  user: null,      // { name, email, device }
  info: { used: 0, max: MAX_ATTEMPTS, next: 1 },
  attempt: null,   // { n, stage, answers, rev }
  day: null,
  ny: false,
  net: 'saved',    // saved | saving | offline | taken
  busy: false,
  loginError: '',
  done: false,     // every task in the last stage is answered
};

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage can be blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const stageOf = () => STAGES[S.attempt.stage - 1];
const ans = () => S.attempt.answers;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36));

// ------------------------------------------------------------------ answers and progress
function fieldDone(f, a) {
  const v = a[f.key];
  if (v === undefined) return false;
  if (f.kind === 'classify' || f.kind === 'checks') return f.options.every((o) => v && v[o.id]);
  return true;
}
const taskDone = (task, a) => task.fields.every((f) => fieldDone(f, a));
const stageProgress = (st, a) => ({ done: st.tasks.filter((t) => taskDone(t, a)).length, total: st.tasks.length });
const totalProgress = (a) => STAGES.reduce((n, st) => { const p = stageProgress(st, a); return { done: n.done + p.done, total: n.total + p.total }; }, { done: 0, total: 0 });

// The attempt is finished when the last stage is open and every task in it is answered.
const isDone = () => {
  if (!S.attempt || S.attempt.stage !== STAGES.length) return false;
  const p = stageProgress(stageOf(), ans());
  return p.done === p.total;
};

function taskLocked(st, task, a) {
  if (!task.lockedUntil) return false;
  return !st.tasks.slice(0, task.lockedUntil).every((t) => taskDone(t, a));
}
function clockNow() {
  const st = stageOf();
  const later = st.laterClock && st.tasks.some((t) => t.lockedUntil && !taskLocked(st, t, ans()));
  return later ? st.laterClock : st.clock;
}

// ------------------------------------------------------------------ network and saving
async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { code: res.status, body: data };
}
const ident = () => ({ name: S.user.name, email: S.user.email, device: S.user.device });

let saveTimer = null;
let flying = false;

function persistLocal(dirty) {
  if (!S.attempt) return;
  store.set('ecr.work', { email: S.user.email, ...S.attempt, dirty });
}
function touch() {
  S.attempt.rev += 1;
  persistLocal(true);
  setNet('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 2000);
}
async function flush() {
  if (flying || !S.attempt) return;
  flying = true;
  const sent = S.attempt.rev;
  const a = S.attempt;
  try {
    const r = await api('/api/save', { ...ident(), attempt: a.n, rev: sent, stage: a.stage, answers: a.answers });
    if (r.code === 409 && r.body.error === 'taken') { setNet('taken'); showTaken(); flying = false; return; }
    if (r.code >= 400) throw new Error('save');
    if (S.attempt === a && Number.isInteger(r.body.rev)) a.base = r.body.rev; // the server revision this device last confirmed
    if (S.attempt && S.attempt.rev === sent) { persistLocal(false); setNet('saved'); }
    else { flying = false; flush(); return; }
  } catch {
    setNet('offline'); // no retry timer: the next change, or the signal returning, sends it
  }
  flying = false;
}
window.addEventListener('online', () => { if (S.attempt && S.net === 'offline') flush(); });

function setNet(s) {
  S.net = s;
  const el = $('#save');
  if (!el) return;
  el.dataset.s = s;
  el.textContent = { saved: 'Saved', saving: 'Saving', offline: 'Waiting for signal', taken: 'Open on another device' }[s];
}

// ------------------------------------------------------------------ boot and login
async function boot() {
  const sess = store.get('ecr.session');
  if (sess && sess.email && sess.device) {
    S.user = sess;
    const ok = await enter(false, true);
    if (ok) return;
  }
  render();
}

async function enter(begin, silent = false) {
  S.busy = true;
  try {
    const r = await api('/api/start', { ...ident(), begin });
    S.busy = false;
    if (r.code >= 400) { if (!silent) { S.loginError = r.body.error || 'Something went wrong.'; render(); } return false; }
    const b = r.body;
    S.user.name = b.name || S.user.name;
    store.set('ecr.session', S.user);
    S.info = { used: b.used, max: b.max, next: b.next || b.used };
    if (b.status === 'open') {
      const local = store.get('ecr.work');
      let st = b.state;
      // The saved copy is used only if nobody else has saved since. If another device held the attempt
      // and the server has moved past the revision this copy was based on, the copy is dropped.
      const unsent = !!(local && local.email === S.user.email && local.n === st.attempt && local.dirty && local.rev > st.rev);
      const stale = unsent && !!b.took && local.base !== st.rev;
      const replay = unsent && !stale;
      if (replay) st = { attempt: local.n, stage: local.stage, answers: local.answers, rev: local.rev, reset: b.state.reset };
      S.attempt = { n: st.attempt, stage: st.stage, answers: st.answers || {}, rev: st.rev, base: b.state.rev, reset: !!(st.reset || b.state.reset) };
      S.day = stageOf().startDay;
      S.ny = false;
      S.screen = 'work';
      persistLocal(false);
      if (replay) { setNet('saving'); flush(); } else setNet('saved');
      if (stale) setTimeout(() => toast('Another device saved newer work. Changes on this device that were not sent were not applied.'), 0);
    } else if (b.status === 'ready') {
      S.screen = 'memo';
    } else {
      S.screen = 'done';
    }
    render();
    return true;
  } catch {
    S.busy = false;
    // No signal at start: carry on from the copy kept on this device.
    const local = store.get('ecr.work');
    if (silent && local && local.email === S.user.email) {
      S.attempt = { n: local.n, stage: local.stage, answers: local.answers || {}, rev: local.rev, base: local.base, reset: !!local.reset };
      S.day = stageOf().startDay;
      S.screen = 'work';
      setNet('offline');
      render();
      return true;
    }
    if (!silent) { S.loginError = 'No signal. Check your connection and try again.'; render(); }
    return false;
  }
}

async function login(form) {
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  if (!name) { S.loginError = 'Enter your name.'; return render(); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { S.loginError = 'Enter a valid email address.'; return render(); }
  const prev = store.get('ecr.session');
  S.user = { name, email, device: prev && prev.email === email ? prev.device : uid() };
  S.loginError = '';
  store.set('ecr.session', S.user);
  S.busy = true;
  render();
  await enter(false);
}

function logout() {
  clearTimeout(saveTimer);
  store.del('ecr.session'); store.del('ecr.work');
  S.user = null; S.attempt = null; S.screen = 'login'; S.loginError = ''; S.net = 'saved';
  document.body.removeAttribute('data-sheet');
  closeModal();
  render();
}

// ------------------------------------------------------------------ rendering: screens
function render() {
  const app = $('#app');
  if (S.screen === 'login') app.innerHTML = loginHtml();
  else if (S.screen === 'memo') app.innerHTML = memoScreenHtml();
  else if (S.screen === 'end') app.innerHTML = endHtml();
  else if (S.screen === 'done') app.innerHTML = doneHtml();
  else { S.done = isDone(); app.innerHTML = workHtml(); refreshCal(true); }
  place(app);
  window.scrollTo(0, 0);
}

const brandHtml = () => `<div class="brand"><span class="mark">${ic('calendar')}</span><div><b>KestrelPoint Advisory</b><small>Executive Calendar Control Room</small></div></div>`;

function artSvg() {
  const col = (x, blocks) => blocks.map(([y, h, c]) => {
    const fills = { c: '#0F766E', i: '#64748B', p: '#F3D793', t: '#FDE6DA', r: '#F3E8F7' };
    const extra = c === 'p' ? 'stroke="#E2B866"' : c === 't' ? 'stroke="#E8946D" stroke-dasharray="4 3"' : c === 'r' ? 'stroke="#A66BB8"' : '';
    return `<rect x="${x}" y="${y}" width="62" height="${h}" rx="8" fill="${fills[c]}" ${extra}/>`;
  }).join('');
  return `<svg class="art-svg" viewBox="0 0 400 300" aria-hidden="true"><rect x="0" y="0" width="400" height="300" rx="22" fill="#FFFFFF" opacity=".08"/><rect x="0.5" y="0.5" width="399" height="299" rx="21.5" fill="none" stroke="#fff" opacity=".25"/>
    ${col(14, [[20, 54, 'c'], [90, 36, 'i'], [150, 70, 'c']])}${col(86, [[20, 36, 'i'], [72, 54, 'c'], [150, 40, 'p'], [206, 50, 'c']])}${col(158, [[30, 70, 'c'], [116, 36, 'r'], [170, 54, 'c']])}${col(230, [[20, 36, 'c'], [70, 46, 't'], [130, 36, 'i'], [186, 54, 'c']])}${col(302, [[30, 54, 'c'], [100, 36, 'i'], [160, 70, 'p']])}</svg>`;
}

function loginHtml() {
  return `<div class="screen login">
    <section class="login-art">
      ${brandHtml()}
      <div>
        <h1>Run the executive’s week.</h1>
        <p class="lead">Book, reschedule, repair a conflict and apply a policy in one week of a real calendar.</p>
      </div>
      <div class="facts-row"><div><b>4</b><span>stages</span></div><div><b>1</b><span>working week</span></div><div><b>${MAX_ATTEMPTS}</b><span>attempts</span></div></div>
      ${artSvg()}
    </section>
    <section class="login-card-wrap" id="main" tabindex="-1">
      <form class="login-card" data-form="login" novalidate>
        <h2>Start your shift</h2>
        <p class="sub">Use the same name and email each time. They are fixed after your first login. Your work follows you to any phone or laptop.</p>
        <label class="field"><span>Name</span><input name="name" autocomplete="name" value="${esc(S.user ? S.user.name : '')}" required></label>
        <label class="field"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(S.user ? S.user.email : '')}" required></label>
        <p class="notice">${ic('info')}<span>Your name, email and scores are kept to mark the Calendar test.</span></p>
        <p class="err" role="alert">${esc(S.loginError)}</p>
        <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Opening' : 'Continue'}</button>
      </form>
    </section></div>`;
}

function memoBlock() {
  return `<div class="memo-sheet">
    <span class="memo-tag">${ic('memo')} Memo</span>
    <h2>${esc(MEMO.subject)}</h2>
    <dl class="memo-meta"><dt>To</dt><dd>${esc(MEMO.to)}</dd><dt>From</dt><dd>${esc(MEMO.from)}</dd><dt>Date</dt><dd>${esc(MEMO.date)}</dd></dl>
    <p>${esc(MEMO.intro)}</p>
    <ol class="rules">${MEMO.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
    <p class="memo-out">${esc(MEMO.outro)}</p></div>`;
}

function memoScreenHtml() {
  const n = S.info.next || S.info.used + 1;
  return `<div class="center"><div class="memo-card">
    <div class="band">${brandHtml()}<span class="attempt-chip">Attempt ${n} of ${S.info.max}</span></div>
    <div class="inner" id="main" tabindex="-1">${memoBlock()}
      <div class="go"><p>Read the memo, then start your shift. The memo stays open to you all week.</p>
      <button class="btn primary" data-act="begin" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Starting' : 'Start shift'}</button></div></div></div></div>`;
}

function endHtml() {
  const first = (S.user && S.user.name ? S.user.name : '').split(' ')[0];
  const left = S.info.max - S.info.used;
  return `<div class="center"><div class="end-card" id="main" tabindex="-1">
    <div class="ok">${ic('check')}</div>
    <h1>Thank you${first ? ', ' + esc(first) : ''}.</h1>
    <p>Your calendar has gone to the executive’s office.</p>
    <div class="used">Attempts used: ${S.info.used} of ${S.info.max}</div>
    ${left > 0 ? '<p class="small-note">Log in again to start another attempt.</p>' : ''}
    <div class="end-act"><button class="btn primary" data-act="logout">Log out</button></div></div></div>`;
}

function doneHtml() {
  return `<div class="center"><div class="end-card" id="main" tabindex="-1">
    <div class="ok">${ic('check')}</div>
    <h1>All attempts used.</h1>
    <p>You have used ${S.info.used} of ${S.info.max} attempts.</p>
    <div class="end-act"><button class="btn primary" data-act="logout">Log out</button></div></div></div>`;
}

// ------------------------------------------------------------------ rendering: work screen
function workHtml() {
  return `<div class="app">${headerHtml()}
  <main class="work" id="main" tabindex="-1">
    <aside class="pane memo" id="paneMemo" aria-label="Memo"><div class="sheet-bar"><span>Memo</span><button class="btn quiet small" data-act="close-sheet">Close</button></div>${memoBlock()}</aside>
    <section class="pane cal" id="paneCal" aria-label="Calendar">${calHtml()}</section>
    <section class="pane tasks" id="paneTasks" aria-label="Tasks"><div class="sheet-bar"><span>Stage ${stageOf().n}: tasks</span><button class="btn quiet small" data-act="close-sheet">Done</button></div>${tasksHtml()}</section>
  </main></div>
  <div class="backdrop" data-act="close-sheet"></div>
  <nav class="dock" aria-label="Panels">
    <button data-act="open-memo">${ic('memo')}Memo</button>
    <button class="main" data-act="open-tasks">${ic('tasks')}Tasks ${stageProgress(stageOf(), ans()).done}/${stageProgress(stageOf(), ans()).total}</button>
    <button data-act="help">${ic('help')}Help</button>
    <button data-act="reset" class="rst" ${S.attempt.reset ? 'disabled' : ''}>${ic('reset')}${S.attempt.reset ? 'Reset used' : 'Reset'}</button>
  </nav>`;
}

function clockText() {
  const c = clockNow();
  return `${dayShort(c.day)} ${c.day} Nov, ${c.time}`;
}

function headerHtml() {
  const cur = S.attempt.stage;
  const steps = STAGES.map((st) => {
    const cls = st.n < cur ? 'done' : st.n === cur ? 'now' : '';
    return `<li class="${cls}" ${st.n === cur ? 'aria-current="step"' : ''}><span class="n">${st.n < cur ? ic('check') : st.n}</span><span class="lbl">${esc(st.short)}</span></li>`;
  }).join('');
  return `<header class="top" id="top">
    ${brandHtml()}
    <ol class="stepper" aria-label="Stages">${steps}</ol>
    <div class="tools">
      <span class="attempt">Attempt ${S.attempt.n} of ${MAX_ATTEMPTS}</span>
      <span class="save" id="save" data-s="${S.net}">${{ saved: 'Saved', saving: 'Saving', offline: 'Waiting for signal', taken: 'Open on another device' }[S.net]}</span>
      <div class="clock" title="Simulated time">${ic('clock')}<div><small>Simulated time</small><b id="clock">${esc(clockText())} WAT</b></div></div>
      <button class="btn ghost only-mid" data-act="open-memo">Memo</button>
      <button class="btn ghost" data-act="help">Help</button>
      <button class="btn ghost rst" data-act="reset" ${S.attempt.reset ? 'disabled title="Reset is used in this attempt"' : ''}>${S.attempt.reset ? 'Reset used' : 'Reset'}</button>
      <button class="btn exit${S.done ? ' ready' : ''}" data-act="exit">${S.done ? 'Submit and log out' : 'Log out'}</button>
    </div></header>`;
}

function refreshHeader() {
  const top = $('#top');
  if (top) top.outerHTML = headerHtml();
}

// ---------------- calendar
const BLOCKING = ['client', 'internal', 'protected', 'travel'];
const eventsOn = (day) => EVENTS.filter((e) => e.day === day);
const clientCount = (day) => EVENTS.filter((e) => e.day === day && e.type === 'client').length;

function pickOf(st) {
  return parseSlot(ans()[st.slotKey]);
}
function overlapsExisting(day, start) {
  const end = start + RULES.len;
  return eventsOn(day).some((e) => BLOCKING.includes(e.type) && start < e.b && end > e.a);
}

function calHtml() {
  const st = stageOf();
  const pick = pickOf(st);
  const dayEvents = eventsOn(S.day);
  const allday = dayEvents.find((e) => e.type === 'allday');
  const pill = (d) => {
    const n = clientCount(d);
    return `<button class="day" data-act="day" data-day="${d}" aria-pressed="${d === S.day}">${pick && pick.day === d ? '<i class="pin" title="Your pick"></i>' : ''}<b>${dayShort(d)} ${d}</b><span>${n} of ${RULES.dailyLimit}<em> clients</em></span></button>`;
  };
  const nyChip = st.nyChip ? `<button class="chip" data-act="ny" aria-pressed="${S.ny}">${ic('clock')} WAT and New York</button>` : '';
  const rowsN = (GRID.to - GRID.from) / GRID.step;

  const res = [];
  if (st.attendee) {
    res.push({ title: st.attendee.name, sub: 'free or busy only', blocks: st.attendee.busy.filter((b) => b.day === S.day).map((b) => ({ a: T(b.from), b: T(b.to), cls: 'busy', label: 'Busy' })) });
  }
  if (st.rooms) {
    for (const r of st.rooms) res.push({ title: r.name, sub: `seats ${r.seats}`, blocks: r.blocks.filter((b) => b.day === S.day).map((b) => ({ a: T(b.from), b: T(b.to), cls: b.kind, label: b.label })) });
  }
  const cols = [`${S.ny ? '48px 48px' : '52px'}`, 'minmax(0,1fr)', ...res.map(() => 'minmax(62px, 88px)')].join(' ');
  const at = (a, b) => `data-y="${(a - GRID.from) / GRID.step}"${b === undefined ? '' : ` data-n="${(b - a) / GRID.step}"`}`;

  const axis = (ny) => {
    let h = '';
    for (let m = GRID.from; m < GRID.to; m += GRID.step) {
      const t = ny ? m - NY : m;
      h += `<div class="${m % 60 === 0 ? 'h' : ''}">${hhmm(t)}</div>`;
    }
    return h;
  };

  let rows = '';
  for (let m = GRID.from; m < GRID.to; m += GRID.step) {
    const closed = m >= RULES.close;
    rows += `<button class="row ${m % 60 === 0 ? 'h' : ''}" data-act="row" data-start="${m}" data-t="${hhmm(m)}" ${closed ? 'disabled' : ''} aria-label="${esc(dayLong(S.day))}, ${hhmm(m)}"></button>`;
  }

  let ev = '';
  for (const e of dayEvents) {
    if (e.type === 'allday') continue;
    if (e.type === 'client' || e.type === 'internal') ev += `<div class="ev buffer" ${at(e.b, e.b + RULES.buffer)} title="Buffer, 15 minutes"></div>`;
  }
  for (const e of dayEvents) {
    if (e.type === 'allday') continue;
    const icon = e.type === 'protected' ? ic('lock') : e.type === 'travel' ? ic('car') : '';
    const times = `${hhmm(e.a)} to ${hhmm(e.b)}`;
    const lines = [`<b>${esc(e.title)}</b>`];
    if (e.b - e.a >= 45) { if (e.sub) lines.push(`<span>${esc(e.sub)}</span>`); lines.push(`<span>${times}</span>`); }
    else lines.push(`<span>${esc(e.sub || times)}</span>`);
    const shares = e.type !== 'proposed' && dayEvents.some((p) => p.type === 'proposed' && p.a < e.b && p.b > e.a);
    ev += `<div class="ev ${e.type} ${e.series ? 'series' : ''} ${shares ? 'half' : ''}" ${at(e.a, e.b)} title="${esc(e.title + ', ' + times)}">${icon}<div class="t">${lines.join('')}</div></div>`;
  }
  if (pick && pick.day === S.day) {
    const bad = overlapsExisting(pick.day, pick.start);
    ev += `<div class="ev pick-buffer" ${at(pick.start + RULES.len, pick.start + RULES.len + RULES.buffer)}></div>`;
    ev += `<div class="ev pick ${bad ? 'bad' : ''}" ${at(pick.start, pick.start + RULES.len)}><div class="t"><b>Your pick</b><span>${range(pick.start)}</span></div>${bad ? '<span class="flag">Overlap</span>' : ''}</div>`;
  }

  const resCols = res.map((r) => {
    const b = r.blocks.map((x) => {
      const inner = x.cls === 'booked' ? `${ic('door')}<span>${esc(x.label)}</span>` : x.cls === 'busy' ? esc(x.label) : esc(x.label);
      return `<div class="ev ${x.cls}" ${at(x.a, x.b)}>${inner}</div>`;
    }).join('');
    return `<div class="col res"><div class="layer">${b}</div></div>`;
  }).join('');
  const resHeads = res.map((r) => `<div class="gh"><b>${esc(r.title)}</b>${esc(r.sub)}</div>`).join('');

  const pickBar = pick
    ? `<div class="pickbar">${ic('pin')}<span>Your pick: <b>${esc(dayMid(pick.day))}, ${range(pick.start)} WAT</b></span><button data-act="clear-pick">Clear</button></div>`
    : `<div class="pickbar empty">${ic('pin')}<span>${stageHasSlot(st) ? 'Tap a quarter hour to choose a start time.' : ''}</span></div>`;

  return `<div class="cal-head">
    <div class="cal-top"><div class="who"><span class="avatar">DA</span><div><b>Damilola Akinwale</b><small>Chief Executive Officer, WAT (UTC+1)</small></div></div>${nyChip}</div>
    ${st.days.length > 1 ? `<div class="days" role="group" aria-label="Day">${st.days.map(pill).join('')}</div>` : '<div class="spacer"></div>'}
    ${allday ? `<div class="allday">${ic('calendar')}<span><b>All day:</b> ${esc(allday.title)}, shown as ${allday.free ? 'Free' : 'Busy'}</span></div>` : ''}
  </div>
  <div class="gridwrap" id="gridwrap"><div class="grid" data-gc="${cols}" data-gr="${rowsN}">
    <div class="gh ax">WAT</div>${S.ny ? '<div class="gh ax ny">New York</div>' : ''}<div class="gh mn"><b>${esc(dayLong(S.day))}</b></div>${resHeads}
    <div class="ax-col">${axis(false)}</div>${S.ny ? `<div class="ax-col ny">${axis(true)}</div>` : ''}
    <div class="col"><div class="rows">${rows}</div><span class="closed-tag" ${at(RULES.close)}>Closed</span><div class="layer">${ev}</div></div>${resCols}
  </div></div>
  <div class="cal-foot">${stageHasSlot(st) ? pickBar : ''}
    <div class="legend"><span><i class="sw client"></i>Client</span><span><i class="sw internal"></i>Internal</span><span><i class="sw protected"></i>Protected</span><span><i class="sw buffer"></i>Buffer</span>${st.rooms ? '<span><i class="sw room"></i>Room hold</span>' : ''}<span><i class="sw travel"></i>Travel</span><span><i class="sw overlap"></i>Overlap</span></div>
  </div>`;
}
const stageHasSlot = (st) => st.tasks.some((t) => t.fields.some((f) => f.kind === 'slot'));

const FOCUS = { 1: '13:00', 2: '13:00', 3: '11:00', 4: '09:00' };
function refreshCal(reset = false) {
  const pane = $('#paneCal');
  if (!pane) return;
  const gw = $('#gridwrap');
  const top = gw ? gw.scrollTop : 0;
  pane.innerHTML = calHtml();
  place(pane);
  const g = $('#gridwrap');
  if (!g) return;
  if (reset) {
    const row = parseFloat(getComputedStyle(g).getPropertyValue('--row')) || 26;
    g.scrollTop = ((T(FOCUS[stageOf().n]) - GRID.from) / GRID.step) * row;
  } else g.scrollTop = top;
}

// ---------------- tasks
function tokensFor(slotKey) {
  const s = parseSlot(ans()[slotKey]);
  if (!s) return null;
  return { day: dayLong(s.day), start: hhmm(s.start), end: hhmm(s.start + RULES.len), nyStart: hhmm(s.start - NY), nyEnd: hhmm(s.start + RULES.len - NY) };
}
function fillText(text, tk) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (tk ? esc(tk[k]) : `<span class="tok">your time</span>`));
}
const initials = (n) => n.replace(/\b(Mr|Mrs|Ms|Dr)\b\.?/g, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function requestHtml(st) {
  const r = st.request;
  if (r.kind === 'chat') {
    return `<div class="card req"><div class="req-h"><span class="ava">${esc(initials(r.from))}</span><div><b>${esc(r.from)}</b><small>${esc(r.role)}</small></div><span class="tm"><span class="req-kind">${ic('chat')} Chat</span><br>${esc(r.time)}</span></div>
      <div class="req-b">${r.messages.map((m) => `<div class="bubble">${esc(m)}</div>`).join('')}</div></div>`;
  }
  if (r.kind === 'note') {
    return `<div class="card req note-card"><div class="req-h"><span class="ava">${esc(initials(r.from))}</span><div><b>${esc(r.from)}</b><small>${esc(r.role)}</small></div><span class="tm"><span class="req-kind">${ic('info')} Note</span></span></div>
      <div class="req-b">${r.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
  }
  return `<div class="card req"><div class="req-h"><span class="ava">${esc(initials(r.from))}</span><div><b>${esc(r.from)}</b><small>${esc(r.role)}</small></div><span class="tm"><span class="req-kind">${ic('mail')} Email</span><br>${esc(r.time)}</span></div>
    <div class="subj">${esc(r.subject)}</div><div class="req-b">${r.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
}

function infoHtml(st) {
  return (st.info || []).map((b) => {
    if (b.kind === 'waitlist') {
      return `<div class="card facts"><h3>${esc(b.title)}</h3><table class="wl">${b.rows.map((r) => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td></tr>`).join('')}</table></div>`;
    }
    return `<div class="card facts"><h3>${esc(b.title)}</h3><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  }).join('');
}

function fieldHtml(f, st) {
  const a = ans();
  const v = a[f.key];
  const lab = f.label && f.kind !== 'select' ? `<span class="flabel">${esc(f.label)}</span>` : '';
  switch (f.kind) {
    case 'radio':
      return `<div>${lab}<fieldset class="opts"><legend class="sr">${esc(f.label || 'Choose one')}</legend>${f.options.map((o) => `<label class="opt"><input type="radio" name="${f.key}" value="${o.id}" data-k="${f.key}" data-fid="${f.key}|${o.id}" ${v === o.id ? 'checked' : ''}><span class="box"></span><span class="txt">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span></label>`).join('')}</fieldset></div>`;
    case 'multi':
      return `<div>${lab}<fieldset class="opts ${f.columns ? 'cols' : ''}"><legend class="sr">${esc(f.label || 'Choose all that apply')}</legend>${f.options.map((o) => `<label class="opt m"><input type="checkbox" value="${o.id}" data-k="${f.key}" data-fid="${f.key}|${o.id}" ${Array.isArray(v) && v.includes(o.id) ? 'checked' : ''}><span class="box"></span><span class="txt">${esc(o.label)}</span></label>`).join('')}</fieldset></div>`;
    case 'select':
      return `<label class="fld"><span>${esc(f.label)}</span><select data-k="${f.key}" data-fid="${f.key}" class="${v ? 'set' : ''}"><option value="">Select</option>${f.options.map((o) => `<option value="${o.id}" ${v === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    case 'slot': {
      const s = parseSlot(v);
      const tk = tokensFor(f.key);
      const body = s
        ? `<div class="ic">${ic('calendar')}</div><div><b>${esc(dayMid(s.day))}, ${range(s.start)} WAT</b><small>${st.nyChip ? `${hhmm(s.start - NY)} to ${hhmm(s.start + RULES.len - NY)} New York time` : 'Buffer follows on the calendar'}</small></div><button class="btn quiet small only-phone" data-act="open-cal">Change</button>`
        : `<div class="ic">${ic('calendar')}</div><div><b>No time picked yet</b><small>Tap a quarter hour on the calendar.</small></div><button class="btn primary small only-phone" data-act="open-cal">Open calendar</button>`;
      return `<div class="pick-sum ${s ? 'set' : ''}">${body}</div>`;
    }
    case 'classify':
    case 'checks':
      return `<div class="cls">${f.options.map((o) => `<div class="cls-row"><span class="txt">${esc(o.label)}</span><div class="seg" role="radiogroup" aria-label="${esc(o.label)}">${f.choices.map((c) => `<label><input type="radio" name="${f.key}.${o.id}" value="${c.id}" data-k="${f.key}" data-sub="${o.id}" data-fid="${f.key}.${o.id}|${c.id}" ${v && v[o.id] === c.id ? 'checked' : ''}><span>${esc(c.label)}</span></label>`).join('')}</div></div>`).join('')}</div>`;
    case 'template': {
      const set = TEMPLATES[f.key];
      const tk = tokensFor(f.slotKey);
      const late = st.laterClock && !taskLocked(st, st.tasks.find((t) => t.lockedUntil) || {}, a);
      return `<div class="msgs">${f.options.map((o) => {
        const email = f.channel === 'email';
        const head = email ? `<div class="m-h">${ic('mail')}<span>To <b>${esc(f.to)}</b> &nbsp;Subject <b>${esc(f.subject)}</b></span></div>` : `<div class="m-h">${ic('chat')}<span>To <b>${esc(f.to)}</b></span></div>`;
        const ticks = late && f.key === 's2.notice'
          ? `<div class="ticks nore">${ic('checks')}Delivered. No reply after 2 hours</div>`
          : `<div class="ticks">${ic('checks')}Sent and delivered</div>`;
        return `<label class="msg ${f.channel}"><input type="radio" name="${f.key}" value="${o.id}" data-k="${f.key}" data-fid="${f.key}|${o.id}" ${v === o.id ? 'checked' : ''}>${head}<div class="m-b">${fillText(set[o.id], tk)}</div>${ticks}</label>`;
      }).join('')}</div>`;
    }
    default: return '';
  }
}

function taskHtml(st, task, i) {
  const a = ans();
  const locked = taskLocked(st, task, a);
  const done = !locked && taskDone(task, a);
  const ev = task.evidence
    ? `<div class="evidence"><div class="eh">${esc(task.evidence.title)}</div><div class="banner">${ic('alert')}${esc(task.evidence.banner)}</div><table>${task.evidence.rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table></div>`
    : '';
  const body = `<div class="lockmsg">${ic('lock')}<span>${esc(task.lockedText || '')}</span></div>`;
  const inner = locked ? body : `${ev}${fieldsHtml(st, task)}`;
  return `<article class="task ${locked ? 'locked' : ''}" data-done="${done ? 1 : 0}"><header><span class="num">${done ? ic('check') : i + 1}</span><div><h3>${esc(task.title)}</h3><p class="prompt">${esc(task.prompt)}</p></div></header><div class="tbody">${inner}</div></article>`;
}

function fieldsHtml(st, task) {
  let out = '';
  let group = [];
  const flush = () => {
    if (!group.length) return;
    if (task.fields.some((f) => f.key === 's1.rec.date') && group.length > 1) out += recordPreview(st, task);
    out += `<div class="form ${group.length === 1 ? 'one' : ''}">${group.join('')}</div>`;
    group = [];
  };
  for (const f of task.fields) {
    if (f.kind === 'select') group.push(fieldHtml(f, st));
    else { flush(); out += fieldHtml(f, st); }
  }
  flush();
  return out;
}

function recordPreview(st, task) {
  if (!st.nyChip) return '';
  const tk = tokensFor(st.slotKey);
  if (!tk || !task.fields.some((f) => f.key === 's1.rec.date')) return '';
  return `<div class="pick-sum set"><div class="ic">${ic('clock')}</div><div><b>${esc(tk.start)} to ${esc(tk.end)} WAT</b><small>${esc(tk.nyStart)} to ${esc(tk.nyEnd)} New York time, from your pick</small></div></div>`;
}

function tasksHtml() {
  const st = stageOf();
  const p = stageProgress(st, ans());
  const last = st.n === STAGES.length;
  return `<div class="stage-head"><div class="eyebrow">Stage ${st.n} of ${STAGES.length}</div><h2>${esc(st.title)}</h2>
    <div class="meta"><span class="t">${ic('clock')}<span id="clock2">${esc(clockText())} WAT</span></span><span>${p.done} of ${p.total} tasks answered</span></div>
    <div class="progress"><i data-pw="${(p.done / p.total) * 100}"></i></div></div>
  <div class="stage-body">
    ${requestHtml(st)}
    ${infoHtml(st)}
    ${st.tasks.map((t, i) => taskHtml(st, t, i)).join('')}
    <div class="stage-foot">${last
      ? (S.done
        ? '<p>Every task is answered. Submit your shift when you are ready.</p><button class="btn primary" data-act="exit">Submit and log out</button>'
        : '<p>Answer every task to finish. Log out at any time to end this attempt early.</p>')
      : `<p>Continue locks this stage. You cannot return to it.</p><button class="btn primary" data-act="continue">Continue to Stage ${st.n + 1}</button>`}</div>
  </div>`;
}

function refreshTasks() {
  const pane = $('#paneTasks');
  if (!pane) return;
  const top = pane.scrollTop;
  const active = document.activeElement;
  const fid = active && pane.contains(active) ? active.dataset.fid : null;
  pane.innerHTML = `<div class="sheet-bar"><span>Stage ${stageOf().n}: tasks</span><button class="btn quiet small" data-act="close-sheet">Done</button></div>${tasksHtml()}`;
  place(pane);
  pane.scrollTop = top;
  if (fid) { const el = pane.querySelector(`[data-fid="${CSS.escape(fid)}"]`); if (el) el.focus({ preventScroll: true }); }
  const dock = $('.dock .main');
  if (dock) { const q = stageProgress(stageOf(), ans()); dock.innerHTML = `${ic('tasks')}Tasks ${q.done}/${q.total}`; }
}

// ------------------------------------------------------------------ answers
function setAnswer(key, value) {
  ans()[key] = value;
  afterChange(key);
}
function afterChange(key) {
  touch();
  const was = S.done;
  S.done = isDone();
  if (was !== S.done) refreshHeader();
  const wasClock = $('#clock') ? $('#clock').textContent : '';
  refreshTasks();
  if (key && key.endsWith('.slot')) refreshCal();
  const c = $('#clock');
  if (c) { c.textContent = clockText() + ' WAT'; if (wasClock && wasClock !== c.textContent) toast('The clock moved on to ' + clockText()); }
}

// ------------------------------------------------------------------ modal, toast, sheets
function openModal(html, lock = false) {
  $('#modal').innerHTML = `<div class="scrim" data-act="scrim"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  modalClose = !lock;
  const b = $('#modal .btn.primary, #modal .btn');
  if (b) b.focus();
}
let modalClose = false;
function closeModal() { $('#modal').innerHTML = ''; modalClose = false; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}
const setSheet = (name) => { if (name) document.body.dataset.sheet = name; else document.body.removeAttribute('data-sheet'); };

function showHelp() {
  openModal(`<h2>How to use this page</h2><ul>${HELP.map((h) => `<li>${esc(h)}</li>`).join('')}</ul><div class="acts"><button class="btn primary" data-act="modal-close">Got it</button></div>`);
}
function showTaken() {
  openModal('<h2>Open on another device</h2><p>This attempt is now open on another phone or laptop. Log in again here to take it back.</p><div class="acts"><button class="btn primary" data-act="logout">Log in again</button></div>', true);
}
function askContinue() {
  const st = stageOf();
  const p = stageProgress(st, ans());
  openModal(`<h2>Continue to Stage ${st.n + 1}?</h2><p>Stage ${st.n} locks and you cannot change its answers. You have answered ${p.done} of ${p.total} tasks.</p><div class="acts"><button class="btn quiet" data-act="modal-close">Stay here</button><button class="btn primary" data-act="do-continue">Continue</button></div>`);
}
// Log out and Submit are one action: the work is submitted. Reset is separate and saves nothing.
function askExit(err) {
  const p = totalProgress(ans());
  const n = S.attempt.n;
  const last = n >= MAX_ATTEMPTS ? ' This is your last attempt.' : '';
  const body = S.done
    ? `<h2>Submit and log out?</h2><p>You have answered every task. Your shift is submitted and you cannot change it. This uses attempt ${n} of ${MAX_ATTEMPTS}.${last}</p>`
    : `<h2>Log out and end this attempt?</h2><p>Your work so far is submitted and scored. You have answered ${p.done} of ${p.total} tasks. Blank tasks score nothing. This uses attempt ${n} of ${MAX_ATTEMPTS}.${last}</p><p>To carry on later or on another device, do not log out. Close this page, or log in on the other device. Your work is saved.</p>`;
  openModal(`${body}${err ? `<p class="warn">${esc(err)}</p>` : ''}<div class="acts"><button class="btn quiet" data-act="modal-close">Keep working</button><button class="btn danger" data-act="do-submit">${S.done ? 'Submit and log out' : 'Log out and submit'}</button></div>`);
}
function askReset(err) {
  openModal(`<h2>Reset your shift?</h2><p>Reset clears all your work and starts you again from the beginning. Nothing is saved. It does not use an attempt. You can reset once in each attempt.</p>${err ? `<p class="warn">${esc(err)}</p>` : ''}<div class="acts"><button class="btn quiet" data-act="modal-close">Keep working</button><button class="btn danger" data-act="do-reset">Reset</button></div>`);
}

async function doReset() {
  const btn = $('#modal [data-act="do-reset"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Resetting'; }
  clearTimeout(saveTimer);
  try {
    const r = await api('/api/reset', { ...ident(), attempt: S.attempt.n, rev: S.attempt.rev });
    if (r.code === 409 && r.body.error === 'taken') { closeModal(); showTaken(); return; }
    if (r.code === 409 && r.body.error === 'used') { S.attempt.reset = true; closeModal(); render(); return; }
    if (r.code >= 400) throw new Error('reset');
    const st = r.body.state;
    S.attempt = { n: st.attempt, stage: st.stage, answers: st.answers || {}, rev: st.rev, base: st.rev, reset: true };
    S.day = stageOf().startDay; S.ny = false;
    persistLocal(false);
    setNet('saved');
    setSheet(null);
    closeModal();
    render();
    toast('Shift reset. Stage 1 is open.');
  } catch {
    askReset('No signal. Nothing was reset. Try again when you are online.');
  }
}

async function doSubmit() {
  const btn = $('#modal [data-act="do-submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting'; }
  clearTimeout(saveTimer);
  try {
    const r = await api('/api/submit', { ...ident(), attempt: S.attempt.n, rev: S.attempt.rev, answers: S.attempt.answers });
    if (r.code === 409 && r.body.error === 'taken') { closeModal(); showTaken(); return; }
    if (r.code >= 400) throw new Error('submit');
    S.info.used = r.body.used; S.info.max = r.body.max;
    store.del('ecr.work'); store.del('ecr.session');
    S.attempt = null;
    setSheet(null);
    closeModal();
    S.screen = 'end';
    render();
  } catch {
    askExit('No signal. Your work is kept. Try again when you are online.');
  }
}

function doContinue() {
  S.attempt.stage += 1;
  const st = stageOf();
  S.day = st.startDay; S.ny = false;
  closeModal();
  touch();
  clearTimeout(saveTimer); flush(); // the stage lock is sent now, not after the pause
  S.done = isDone();
  refreshHeader();
  refreshCal(true);
  refreshTasks();
  const pane = $('#paneTasks'); if (pane) pane.scrollTop = 0;
  toast(`Stage ${st.n} is open. Stage ${st.n - 1} is locked.`);
}

// ------------------------------------------------------------------ events
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form="login"]');
  if (f) { e.preventDefault(); login(f); }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'scrim') { if (e.target === el && modalClose) closeModal(); return; }
  switch (act) {
    case 'begin': if (!S.busy) { S.busy = true; render(); enter(true); } break;
    case 'logout': logout(); break;
    case 'help': showHelp(); break;
    case 'modal-close': closeModal(); break;
    case 'exit': askExit(); break;
    case 'do-submit': doSubmit(); break;
    case 'reset': if (!S.attempt.reset) askReset(); break;
    case 'do-reset': doReset(); break;
    case 'continue': askContinue(); break;
    case 'do-continue': doContinue(); break;
    case 'open-memo': setSheet('memo'); break;
    case 'open-tasks': setSheet('tasks'); break;
    case 'open-cal': case 'close-sheet': setSheet(null); break;
    case 'ny': S.ny = !S.ny; refreshCal(); break;
    case 'day': S.day = Number(el.dataset.day); refreshCal(true); break;
    case 'clear-pick': { const st = stageOf(); delete ans()[st.slotKey]; afterChange(st.slotKey); break; }
    case 'row': {
      const st = stageOf();
      const start = Number(el.dataset.start);
      setAnswer(st.slotKey, slotValue(S.day, start));
      if (window.matchMedia('(max-width: 779px)').matches) toast(`Picked ${dayMid(S.day)}, ${range(start)}`);
      break;
    }
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-k]');
  if (!el) return;
  const key = el.dataset.k;
  const f = FIELD(key);
  if (!f) return;
  if (el.type === 'checkbox') {
    const cur = Array.isArray(ans()[key]) ? [...ans()[key]] : [];
    const i = cur.indexOf(el.value);
    if (el.checked && i < 0) cur.push(el.value);
    if (!el.checked && i >= 0) cur.splice(i, 1);
    setAnswer(key, cur);
  } else if (el.dataset.sub) {
    setAnswer(key, { ...(ans()[key] || {}), [el.dataset.sub]: el.value });
  } else if (el.tagName === 'SELECT') {
    if (el.value) setAnswer(key, el.value);
    else { delete ans()[key]; afterChange(key); }
  } else {
    setAnswer(key, el.value);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (modalClose) closeModal(); else if (!$('#modal').innerHTML) setSheet(null); }
});

const FIELD = (key) => {
  for (const st of STAGES) for (const t of st.tasks) for (const f of t.fields) if (f.key === key) return f;
  return null;
};

boot();
