'use strict';

/* ---------- Settings you can change ---------- */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 8;   // first slot 08:00
const END_HOUR = 21;    // last slot ends 21:00

const CATS = {
  lecture: { name: 'Lecture', emoji: '🎓' },
  study:   { name: 'Study',   emoji: '📚' },
  german:  { name: 'German',  emoji: '🇩🇪' },
  guitar:  { name: 'Guitar',  emoji: '🎸' },
  break:   { name: 'Break',   emoji: '🍽️' },
  other:   { name: 'Other',   emoji: '📝' },
};
const TRACKED = ['study', 'german', 'guitar', 'lecture'];

/* Default timetable. Keys are "day-hour", day 0 = Monday. */
const DEFAULT_SCHEDULE = (() => {
  const s = {};
  const set = (d, h, cat, label) => { s[`${d}-${h}`] = { cat, label }; };
  const deep = 'Deep work', review = 'Review lecture', vocab = 'Vocab + grammar';
  for (const d of [0, 3]) {               // Mon, Thu: no lectures
    set(d, 9, 'study', deep); set(d, 10, 'study', deep);
    set(d, 11, 'german', vocab);
    set(d, 14, 'study', deep); set(d, 15, 'study', deep);
  }
  for (const d of [1, 2, 4]) {            // Tue, Wed, Fri: lectures 10-12
    set(d, 8, 'german', vocab);
    set(d, 10, 'lecture', ''); set(d, 11, 'lecture', '');
  }
  for (const d of [1, 2]) { set(d, 14, 'study', review); set(d, 15, 'study', review); }
  set(4, 14, 'lecture', ''); set(4, 15, 'lecture', '');   // Fri 14-16
  for (const d of [0, 1, 2, 3, 4]) set(d, 12, 'break', 'Lunch');
  for (const d of [0, 1, 2, 3]) set(d, 18, 'guitar', 'Practice');
  set(5, 10, 'study', 'Assignments & review'); set(5, 11, 'study', 'Assignments & review');
  set(5, 14, 'german', 'Speaking / listening');
  set(5, 17, 'guitar', 'Practice');
  set(6, 11, 'german', 'Film / podcast');
  set(6, 17, 'guitar', 'Practice');
  set(6, 20, 'other', 'Plan next week');
  return s;
})();

/* ---------- Storage ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

let schedule = store.get('tt.schedule', null) || structuredClone(DEFAULT_SCHEDULE);
let currentWeek = weekKey();
let done = new Set(store.get('tt.done.' + currentWeek, []));
let remindersOn = store.get('tt.remind', false);

// Ticks are stored per week ("tt.done.2026-W48"), so every Monday starts fresh on its own.
// Old weeks are deleted so storage doesn't fill up.
function cleanOldWeeks() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('tt.done.') && k !== 'tt.done.' + currentWeek) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}
cleanOldWeeks();

const saveSchedule = () => store.set('tt.schedule', schedule);
const saveDone = () => store.set('tt.done.' + currentWeek, [...done]);

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => { const n = new Date(); return { d: (n.getDay() + 6) % 7, h: n.getHours(), m: n.getMinutes(), n }; };
const blockTitle = (b) => `${CATS[b.cat].emoji} ${CATS[b.cat].name}`;
const blockText = (b) => b.label ? `${CATS[b.cat].name} – ${b.label}` : CATS[b.cat].name;

function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} min`;
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} day${d > 1 ? 's' : ''} ${h % 24} h`; }
  return m ? `${h} h ${m} min` : `${h} h`;
}

function findNext(d, h) {
  for (let i = 1; i <= 7 * 24; i++) {
    const total = h + i;
    const dd = (d + Math.floor(total / 24)) % 7, hh = total % 24;
    if (hh < START_HOUR || hh >= END_HOUR) continue;
    const b = schedule[`${dd}-${hh}`];
    if (b) return { d: dd, h: hh, b, hoursAhead: i };
  }
  return null;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Rendering ---------- */
const mobileQuery = matchMedia('(max-width: 720px)');
let selectedDay = now().d;

function renderHeader() {
  const { n } = now();
  $('today-label').textContent = n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('btn-remind').textContent = remindersOn ? '🔔 Reminders on' : '🔕 Reminders off';
}

function renderNow() {
  const { d, h, m } = now();
  const key = `${d}-${h}`;
  const cur = h >= START_HOUR && h < END_HOUR ? schedule[key] : null;
  const todayKeys = Object.keys(schedule).filter((k) => k.startsWith(`${d}-`) && TRACKED.includes(schedule[k].cat));
  const todayDone = todayKeys.filter((k) => done.has(k)).length;

  let html = '<div>';
  if (cur) {
    html += `<div class="label">Now · until ${pad(h + 1)}:00</div>
      <div class="current cat-${cur.cat}">${blockTitle(cur)}${cur.label ? ` <span class="pill">${esc(cur.label)}</span>` : ''}</div>
      <div class="sub">${60 - m} min left</div>
      <div class="timebar cat-${cur.cat}"><div style="width:${Math.round((m / 60) * 100)}%"></div></div>`;
  } else {
    html += `<div class="label">Now</div><div class="current">☕ Free time</div>
      <div class="sub">Nothing planned for this hour.</div>`;
  }
  html += '</div>';

  if (cur && TRACKED.includes(cur.cat)) {
    const isDone = done.has(key);
    html += `<button class="${isDone ? 'ghost' : 'primary'}" data-toggle="${key}">${isDone ? '↺ Undo' : '✓ Mark done'}</button>`;
  } else {
    html += '<span></span>';
  }

  const next = findNext(d, h);
  html += '<div class="next">';
  if (next) {
    const mins = next.hoursAhead * 60 - m;
    const when = next.d === d ? `at ${pad(next.h)}:00` : `${DAYS[next.d]} at ${pad(next.h)}:00`;
    html += `Next: <strong>${CATS[next.b.cat].emoji} ${esc(blockText(next.b))}</strong> ${when} · in ${fmtDuration(mins)}`;
  } else {
    html += 'Nothing else planned.';
  }
  html += '</div>';

  // Today's plan: a strip of today's blocks; tap a tracked one to tick it off
  const agenda = [];
  for (let hh = START_HOUR; hh < END_HOUR; hh++) {
    const k = `${d}-${hh}`, b = schedule[k];
    if (!b) continue;
    const state = done.has(k) ? 'done' : hh < h ? 'past' : hh === h ? 'live' : '';
    const tracked = TRACKED.includes(b.cat);
    agenda.push(`<button type="button" class="chip cat-${b.cat} ${state}" ${tracked ? `data-toggle="${k}"` : 'disabled'}
      title="${esc(blockText(b))}${tracked ? (done.has(k) ? ' · tap to undo' : ' · tap to mark done') : ''}">
      <span class="chip-time">${pad(hh)}:00</span><span>${CATS[b.cat].emoji} ${esc(CATS[b.cat].name)}</span>
    </button>`);
  }
  html += `<div class="agenda"><div class="agenda-head"><span class="label">Today's plan</span>` +
    (todayKeys.length ? `<span class="muted">${todayDone} of ${todayKeys.length} done · ticks reset every Monday</span>` : '') + '</div>' +
    (agenda.length ? `<div class="chips">${agenda.join('')}</div>` : '<p class="muted">Nothing planned today. Enjoy the rest! 🌿</p>') +
    '</div>';

  const card = $('now');
  card.className = 'card now' + (cur ? ` busy cat-${cur.cat}` : '');
  card.innerHTML = html;
}


function renderTabs() {
  const { d: today } = now();
  $('day-tabs').innerHTML = DAYS.map((name, i) =>
    `<button type="button" data-day="${i}" class="${i === selectedDay ? 'active' : ''}">${name.slice(0, 3)}${i === today ? ' •' : ''}</button>`
  ).join('');
}

function renderGrid() {
  const { d: today, h: hour } = now();
  const days = mobileQuery.matches ? [selectedDay] : [0, 1, 2, 3, 4, 5, 6];
  const grid = $('grid');
  grid.style.setProperty('--cols', days.length);

  let html = '<div class="cell head"></div>' + days.map((d) =>
    `<div class="cell head ${d === today ? 'today' : ''}">${DAYS[d].slice(0, 3)}</div>`).join('');

  for (let h = START_HOUR; h < END_HOUR; h++) {
    html += `<div class="cell time ${h === hour ? 'now-row' : ''}">${pad(h)}:00</div>`;
    for (const d of days) {
      const key = `${d}-${h}`, b = schedule[key];
      const cls = ['cell', 'slot'];
      if (d === today) cls.push('today');
      if (d === today && h === hour) cls.push('current');
      if (b) cls.push('cat-' + b.cat);
      if (b && done.has(key)) cls.push('done');
      const label = `${DAYS[d]} ${pad(h)}:00, ${b ? blockText(b) : 'free'}`;
      html += `<button type="button" class="${cls.join(' ')}" data-key="${key}" aria-label="${esc(label)}">` +
        (b ? `<span class="t">${blockTitle(b)}</span>${b.label ? `<span class="l">${esc(b.label)}</span>` : ''}` : '') +
        '</button>';
    }
  }
  grid.innerHTML = html;
}

function renderLegend() {
  const hours = {};
  for (const b of Object.values(schedule)) hours[b.cat] = (hours[b.cat] || 0) + 1;
  $('legend').innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<span class="pill cat-${k}">${c.emoji} ${c.name}${hours[k] ? ` <b>${hours[k]} h</b>` : ''}</span>`).join('') +
    '<span class="muted legend-note">hours per week</span>';
}

function renderAll() {
  const wk = weekKey();
  if (wk !== currentWeek) {           // new week: fresh ticks, automatically
    currentWeek = wk;
    done = new Set(store.get('tt.done.' + currentWeek, []));
    cleanOldWeeks();
  }
  renderHeader(); renderNow(); renderTabs(); renderGrid(); renderLegend();
}

/* ---------- Interactions ---------- */
function toggleDone(key) {
  if (done.has(key)) done.delete(key); else done.add(key);
  saveDone();
  renderAll();
}

let editingKey = null;
function openEditor(key) {
  editingKey = key;
  const [d, h] = key.split('-').map(Number);
  const b = schedule[key];
  $('edit-title').textContent = `${b ? 'Edit' : 'Add'} · ${DAYS[d]}, ${pad(h)}:00–${pad(h + 1)}:00`;
  $('edit-save').textContent = b ? 'Save' : 'Add';
  $('edit-clear').hidden = !b;
  $('edit-cat').value = b ? b.cat : 'study';
  $('edit-label').value = b ? b.label : '';
  $('edit-done').checked = done.has(key);
  $('edit-done').closest('label').hidden = !b;
  $('edit').showModal();
}

$('edit-cat').innerHTML = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.emoji} ${c.name}</option>`).join('');

$('edit-form').addEventListener('submit', (e) => {
  const action = e.submitter ? e.submitter.value : 'save';
  if (!editingKey) return;
  if (action === 'save') {
    schedule[editingKey] = { cat: $('edit-cat').value, label: $('edit-label').value.trim() };
    if ($('edit-done').checked && TRACKED.includes(schedule[editingKey].cat)) done.add(editingKey);
    else done.delete(editingKey);
    saveSchedule(); saveDone(); renderAll();
  } else if (action === 'clear') {
    delete schedule[editingKey];
    done.delete(editingKey);
    saveSchedule(); saveDone(); renderAll();
    toast('Block removed');
  }
  editingKey = null;
});

$('grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-key]');
  if (btn) openEditor(btn.dataset.key);
});
$('now').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle]');
  if (btn) { toggleDone(btn.dataset.toggle); toast(done.has(btn.dataset.toggle) ? 'Nice work! ✓' : 'Undone'); }
});
$('day-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-day]');
  if (btn) { selectedDay = Number(btn.dataset.day); renderTabs(); renderGrid(); }
});
mobileQuery.addEventListener('change', renderGrid);

/* Menu: export / import / reset */
$('btn-menu').addEventListener('click', () => $('menu').showModal());

$('m-export').addEventListener('click', () => {
  const data = { app: 'my-week', version: 1, schedule, done: { [currentWeek]: [...done] } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `my-week-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
});

$('m-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.schedule || typeof data.schedule !== 'object') throw new Error('bad file');
    const clean = {};
    for (const [k, v] of Object.entries(data.schedule)) {
      if (/^[0-6]-\d{1,2}$/.test(k) && v && CATS[v.cat]) clean[k] = { cat: v.cat, label: String(v.label || '').slice(0, 40) };
    }
    schedule = clean;
    if (data.done && Array.isArray(data.done[currentWeek])) done = new Set(data.done[currentWeek]);
    saveSchedule(); saveDone(); renderAll();
    $('menu').close();
    toast('Backup imported');
  } catch {
    toast('That file is not a My Week backup');
  }
  e.target.value = '';
});

$('m-reset-week').addEventListener('click', () => {
  if (!confirm("Clear all ticks for this week?")) return;
  done.clear(); saveDone(); renderAll(); $('menu').close(); toast('Week cleared');
});
$('m-reset-all').addEventListener('click', () => {
  if (!confirm('Restore the original timetable? Your edits will be lost.')) return;
  schedule = structuredClone(DEFAULT_SCHEDULE);
  saveSchedule(); renderAll(); $('menu').close(); toast('Original timetable restored');
});

/* ---------- Reminders (work while the app is open) ---------- */
$('btn-remind').addEventListener('click', async () => {
  if (!('Notification' in window)) { toast('Notifications are not supported here'); return; }
  if (!remindersOn) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications were blocked'); return; }
  }
  remindersOn = !remindersOn;
  store.set('tt.remind', remindersOn);
  renderHeader();
  toast(remindersOn ? "You'll get a ping 5 min before each block" : 'Reminders off');
});

let lastReminder = store.get('tt.lastReminder', '');
async function notify(title, body) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'my-week' });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch { /* ignore */ }
}
function checkReminder() {
  if (!remindersOn || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const { d, h, m, n } = now();
  if (m < 55) return;
  const nh = h + 1, nd = nh >= 24 ? (d + 1) % 7 : d, hh = nh % 24;
  const b = schedule[`${nd}-${hh}`];
  const id = `${n.toDateString()}-${hh}`;
  if (!b || lastReminder === id) return;
  lastReminder = id;
  store.set('tt.lastReminder', id);
  notify(`${blockTitle(b)} in ${60 - m} min`, b.label || `Starts at ${pad(hh)}:00`);
}

/* ---------- Start ---------- */
renderAll();
setInterval(() => { renderAll(); checkReminder(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
