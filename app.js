/* Recipe Nook — personal recipe app. Everything is stored on this device (IndexedDB). */
'use strict';

const APP = 'recipe-nook';
const VERSION = '1.0.0';
const app = document.getElementById('app');

/* ---------------- settings (small stuff in localStorage) ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(APP + ':' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(APP + ':' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
};
const settings = Object.assign({ units: 'as', motion: true, remind: true, view: 'list', tab: 'cooking', fridge: [], lastBackup: 0 }, LS.get('settings', {}));
function saveSettings() { LS.set('settings', settings); }
function applyMotion() { document.body.classList.toggle('nomotion', !settings.motion); }

/* ---------------- database (recipes, photos, memos) ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(APP, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('recipes', { keyPath: 'id' });
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  all() {
    return new Promise((res, rej) => {
      const q = DB.db.transaction('recipes', 'readonly').objectStore('recipes').getAll();
      q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error);
    });
  },
  put(r) {
    return new Promise((res, rej) => {
      const t = DB.db.transaction('recipes', 'readwrite'); t.objectStore('recipes').put(r);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  },
  del(id) {
    return new Promise((res, rej) => {
      const t = DB.db.transaction('recipes', 'readwrite'); t.objectStore('recipes').delete(id);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }
};

let recipes = [];
const byId = id => recipes.find(r => r.id === id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function saveRecipe(r) {
  r.updated = Date.now();
  await DB.put(r);
  const i = recipes.findIndex(x => x.id === r.id);
  if (i < 0) recipes.push(r); else recipes[i] = r;
}
function newRecipe() {
  return { id: uid(), name: '', section: 'cooking', source: { type: 'me', who: '' }, link: '', status: 'try', fav: false,
    servings: '', time: '', ingredients: [], steps: [], tips: [], notes: '', photo: null, memo: null, log: [], created: Date.now(), updated: Date.now() };
}

/* ---------------- little helpers ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const blobUrls = new WeakMap();
function urlFor(blob) { if (!blob) return ''; if (!blobUrls.has(blob)) blobUrls.set(blob, URL.createObjectURL(blob)); return blobUrls.get(blob); }
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function niceDate(iso) { const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function longDate(iso) { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function safeLink(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return /^https?:\/\/[^\s]+$/i.test(u) ? u : ''; }
let toastT = 0;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------------- icons + doodles ---------------- */
const ic = (p, s = 20, w = 2.6, fill = 'none') => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: ic('<path d="M15 18l-6-6 6-6"/>', 20, 2.8),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>', 18, 2.8),
  plus: ic('<path d="M12 5v14M5 12h14"/>', 22, 3),
  search: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4A3A" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  sliders: ic('<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="#FFFBF5"/><circle cx="15" cy="12" r="2" fill="#FFFBF5"/><circle cx="8" cy="17" r="2" fill="#FFFBF5"/>', 20, 2.5),
  fridge: '<svg aria-hidden="true" width="20" height="22" viewBox="0 0 22 24" fill="#FFFBF5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="16" height="20" rx="3"/><path d="M3 9h16M7 5v2M7 12v4" fill="none"/></svg>',
  heart: on => `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32" fill="${on ? '#B8543C' : '#FFFBF5'}" stroke="#6B4A3A" stroke-width="2.6" stroke-linejoin="round"><path d="M16 27S5 20 5 12.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 11 2.5C27 20 16 27 16 27z"/></svg>`,
  edit: ic('<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>', 20, 2.3),
  chef: '<svg aria-hidden="true" width="26" height="22" viewBox="0 0 32 28" fill="#FFFBF5" stroke="#6B4A3A" stroke-width="2.2" stroke-linejoin="round"><path d="M8 18a6 6 0 0 1 2-11.6A6 6 0 0 1 22 6.4 6 6 0 0 1 24 18z"/><path d="M8 18h16v6H8z"/></svg>',
  trash: ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18, 2.3),
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 17, 2.5),
  cam: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="#FFFBF5" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  link: ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 17, 2.5),
  list: ic('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', 15, 2.8),
  grid: ic('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>', 15, 2.5),
  down: ic('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 20, 2.6),
  share: ic('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>', 18, 2.4),
  clip: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="#FCE1DB" stroke="#6B4A3A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" fill="none"/></svg>',
  pencil: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="#FFFBF5" stroke="#6B4A3A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>'
};
const TAB_ICONS = {
  cooking: '<svg aria-hidden="true" width="30" height="30" viewBox="0 0 32 32" fill="#FFFBF5" stroke="#6B4A3A" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h20c0 6-4.5 10-10 10S4 20 4 14z"/><path d="M24 15l5-3"/><path d="M11 10c0-2 2-2 2-4M16 10c0-2 2-2 2-4" fill="none"/></svg>',
  baking: '<svg aria-hidden="true" width="30" height="30" viewBox="0 0 32 32" fill="#FCE1DB" stroke="#6B4A3A" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4c-5 0-7 6-7 11s3 7 7 7 7-2 7-7-2-11-7-11z"/><path d="M16 22v7" fill="none"/><path d="M13 8c1 4 1 8 0 12M19 8c-1 4-1 8 0 12" fill="none"/></svg>',
  family: '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32" fill="#F7B7AD" stroke="#6B4A3A" stroke-width="2.3" stroke-linejoin="round"><path d="M16 27S5 20 5 12.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 11 2.5C27 20 16 27 16 27z"/></svg>',
  try: '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 32 32" fill="#FBE7B5" stroke="#6B4A3A" stroke-width="2.3" stroke-linejoin="round"><path d="M8 4h16v24l-8-6-8 6z"/></svg>'
};
const D = {
  bowlEgg: '<path d="M10 32h44c0 12-10 20-22 20S10 44 10 32z" fill="#FFFBF5"/><path d="M14 32c2-7 8-9 12-6 3-5 10-5 13 0 4-3 10-1 11 6z" fill="#F9D978"/><circle cx="25" cy="27" r="3.5" fill="#F08A76"/><circle cx="38" cy="26" r="3.5" fill="#F08A76"/><path d="M25 52h14" fill="none"/>',
  greens: '<path d="M10 32h44c0 12-10 20-22 20S10 44 10 32z" fill="#FFFBF5"/><path d="M14 32c3-6 33-6 36 0z" fill="#B9D59A"/><path d="M20 30c2-6 6-11 11-14M32 30c0-6 2-12 6-16M42 30c1-5 4-9 8-11" fill="none"/><path d="M25 52h14" fill="none"/>',
  rice: '<path d="M10 32h44c0 12-10 20-22 20S10 44 10 32z" fill="#FFFBF5"/><path d="M13 32c2-8 36-8 38 0z" fill="#FFFFFF"/><rect x="20" y="22" width="9" height="7" rx="3" fill="#E39A6A"/><rect x="32" y="21" width="9" height="7" rx="3" fill="#E39A6A"/><path d="M25 52h14" fill="none"/>',
  noodles: '<ellipse cx="32" cy="40" rx="25" ry="11" fill="#FFFBF5"/><path d="M17 38c3-9 10-3 14-9s11 0 15 7c-7 6-23 6-29 2z" fill="#F6D58A"/><path d="M24 34c3-2 5 1 8-1M33 31c3 0 5 2 7 4" fill="none"/>',
  pancake: '<ellipse cx="32" cy="40" rx="25" ry="11" fill="#FFFBF5"/><ellipse cx="32" cy="35" rx="18" ry="8" fill="#F2C98A"/><path d="M24 34l3 1M32 32l2 2M38 36l3-1M28 38l2 0" fill="none"/>',
  bun: '<ellipse cx="32" cy="46" rx="24" ry="6" fill="#F2D3A0"/><path d="M12 44c0-14 9-22 20-22s20 8 20 22z" fill="#FFFFFF"/><path d="M27 26c2 3 8 3 10 0" fill="none"/>',
  cookie: '<circle cx="32" cy="34" r="20" fill="#F2C98A"/><circle cx="25" cy="28" r="2.5" fill="#6B4A3A"/><circle cx="37" cy="31" r="2.5" fill="#6B4A3A"/><circle cx="29" cy="40" r="2.5" fill="#6B4A3A"/><circle cx="40" cy="41" r="2" fill="#6B4A3A"/>',
  cake: '<path d="M12 46V30l40-12v28z" fill="#FCE1DB"/><path d="M12 30l40-12" fill="none"/><path d="M12 38c6 3 10-2 14 1s8-2 12 0 8-3 14-1" fill="none"/><circle cx="40" cy="15" r="4" fill="#F08A76"/>',
  bread: '<path d="M12 46V30c0-8 9-12 20-12s20 4 20 12v16z" fill="#F2C98A"/><path d="M24 26l4 4M34 24l4 4" fill="none"/>',
  soup: '<path d="M8 30h48c0 12-11 20-24 20S8 42 8 30z" fill="#FFFBF5"/><path d="M12 30c3-4 37-4 40 0z" fill="#F6D58A"/><path d="M26 22c0-3 3-3 3-6M35 22c0-3 3-3 3-6" fill="none"/><path d="M24 50h16" fill="none"/>',
  dumpling: '<path d="M10 42c4-14 14-20 22-20s18 6 22 20z" fill="#FFFFFF"/><path d="M20 31c2 2 4 2 6 0M29 27c2 2 4 2 6 0M38 31c2 2 4 2 6 0" fill="none"/>'
};
const DOODLE_RULES = [[/cookie|brownie|biscotti|snickerdoodle/, 'cookie'], [/cake|cupcake|muffin|cheesecake|tart|pie\b/, 'cake'], [/bread|loaf|focaccia|bagel|scone|toast/, 'bread'],
  [/\bbun|\bbao|mantou|\broll/, 'bun'], [/dumpling|wonton|gyoza|potsticker|jiaozi/, 'dumpling'], [/soup|stew|broth|congee|porridge|jook|curry/, 'soup'],
  [/pasta|noodle|spaghetti|ramen|udon|lo mein|linguine|mac/, 'noodles'], [/pancake|crepe|waffle|omelet|omelette|frittata/, 'pancake'], [/egg/, 'bowlEgg'],
  [/bean|broccoli|bok choy|spinach|greens|salad|cabbage|veg|kale|choy/, 'greens'], [/rice|bowl|chicken|beef|pork|tofu|fish|shrimp/, 'rice']];
function doodleKey(r) {
  const n = String(r.name || '').toLowerCase();
  for (const [re, k] of DOODLE_RULES) if (re.test(n)) return k;
  const ing = (r.ingredients || []).map(i => i.name).join(' ').toLowerCase();
  for (const [re, k] of DOODLE_RULES) if (re.test(ing)) return k;
  return r.section === 'baking' ? 'cookie' : 'rice';
}
function doodle(r, size, label) {
  const k = typeof r === 'string' ? r : doodleKey(r);
  return `<svg class="doodle" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} width="${size}" height="${size}" viewBox="0 0 64 64">${D[k]}</svg>`;
}
function thumb(r, cls) {
  return r.photo ? `<img class="${cls}" src="${urlFor(r.photo)}" alt="">` : doodle(r, 62);
}

/* ---------------- labels ---------------- */
function sourceChip(r) {
  const s = r.source || {};
  if (s.type === 'family') return `<span class="chip c-fam">From ${esc(s.who || 'family')}</span>`;
  if (s.type === 'reel') return '<span class="chip c-reel">From a reel</span>';
  if (s.type === 'web') return '<span class="chip c-web">From a website</span>';
  return '';
}
function statusChip(r) { return r.status === 'try' ? '<span class="chip c-try">Want to try</span>' : ''; }
function madeCount(r) { return (r.log || []).length; }

/* ---------------- routing ---------------- */
let lastRoute = '';
let wakeLock = null;
function parts() { return (location.hash.slice(1) || '/').split('/').filter(Boolean); }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
window.addEventListener('hashchange', () => render());

function render() {
  const p = parts(), v = p[0] || '';
  const routeKey = location.hash;
  let html;
  switch (v) {
    case 'add': html = vLibrary(true); break;
    case 'r': html = vRecipe(p[1]); break;
    case 'cook': html = vCook(p[1], parseInt(p[2], 10) || 0); break;
    case 'done': html = vDone(p[1]); break;
    case 'paste': html = vPaste(); break;
    case 'edit': html = vEdit(p[1]); break;
    case 'fridge': html = vFridge(); break;
    case 'settings': html = vSettings(); break;
    default: html = vLibrary(false);
  }
  app.innerHTML = html;
  if (routeKey !== lastRoute) {
    const isLib = h => h === '' || h === '#' || h === '#/' || h === '#/add';
    if (!(isLib(routeKey) && isLib(lastRoute))) {
      window.scrollTo(0, 0);
      if (settings.motion) { app.classList.remove('fade'); void app.offsetWidth; app.classList.add('fade'); }
    }
    lastRoute = routeKey;
  }
  if (v === 'cook') keepAwake(); else releaseAwake();
  if (v === 'settings') fillStorage();
}
async function keepAwake() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* not allowed */ } }
function releaseAwake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && parts()[0] === 'cook') keepAwake(); });

/* ================= LIBRARY ================= */
const state = { q: '' };
function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = recipes.slice();
  if (q) {
    list = list.filter(r => [r.name, (r.source || {}).who, r.notes, ...(r.ingredients || []).map(i => i.name)].join(' ').toLowerCase().includes(q));
  } else {
    const t = settings.tab;
    list = list.filter(r => t === 'cooking' ? r.section !== 'baking' : t === 'baking' ? r.section === 'baking' : t === 'family' ? (r.source || {}).type === 'family' : r.status === 'try');
  }
  return list.sort((a, b) => (b.fav - a.fav) || (b.updated - a.updated));
}
function libItems() {
  const list = filtered();
  if (!recipes.length) return '';
  if (!list.length) return `<p class="hint" style="padding:8px 16px">${state.q ? 'No recipes match that.' : 'Nothing here yet.'}</p>`;
  if (settings.view === 'grid') {
    return `<div class="rgrid">${list.map(r => `
      <a class="gtile" href="#/r/${r.id}">
        ${r.photo ? `<img src="${urlFor(r.photo)}" alt="">` : doodle(r, 78)}
        <span class="gname">${esc(r.name || 'Untitled')}</span>
        ${sourceChip(r) || statusChip(r)}
      </a>`).join('')}</div>`;
  }
  return `<div class="rlist">${list.map(r => `
    <div class="card ritem">
      ${thumb(r, 'thumb')}
      <a class="rinfo" href="#/r/${r.id}">
        <span class="rname">${r.fav ? '<span class="sr">Favorite: </span>' : ''}${esc(r.name || 'Untitled')}</span>
        <span class="row gap6" style="flex-wrap:wrap">${sourceChip(r)}${statusChip(r)}${r.time ? `<span class="chip c-plain">${esc(r.time)}</span>` : ''}</span>
      </a>
      <a class="cookbtn chunk press" href="#/cook/${r.id}" aria-label="Cook ${esc(r.name)}">${I.chef}Cook</a>
    </div>`).join('')}</div>`;
}
function backupDue() {
  if (!settings.remind || !recipes.length) return false;
  if (!settings.lastBackup) return recipes.length >= 3;
  return Date.now() - settings.lastBackup > 7 * 864e5;
}
function vLibrary(sheet) {
  const tabs = [['cooking', 'Cooking'], ['baking', 'Baking'], ['family', 'Family'], ['try', 'To try']];
  const days = settings.lastBackup ? Math.floor((Date.now() - settings.lastBackup) / 864e5) : 0;
  return `
  <header class="lhead ging">
    <div class="row" style="justify-content:space-between;gap:8px">
      <h1 class="logo">Recipe <span>Nook</span></h1>
      <div class="row gap8">
        <a class="ibtn chunk press" href="#/settings" aria-label="Settings and backup">${I.sliders}</a>
        <a class="ibtn sky chunk press" href="#/fridge" aria-label="What can I make with what I have">${I.fridge}</a>
        <a class="ibtn pink chunk press" href="#/add" aria-label="Add a recipe">${I.plus}</a>
      </div>
    </div>
    <label class="search">${I.search}<span class="sr">Search recipes</span>
      <input id="q" type="search" placeholder="Search recipes or ingredients…" value="${esc(state.q)}" autocomplete="off">
    </label>
  </header>
  <nav class="tabs" aria-label="Recipe sections">
    ${tabs.map(([k, l]) => `<button class="tab ${settings.tab === k && !state.q ? 'on' : ''}" data-act="tab" data-v="${k}" aria-pressed="${settings.tab === k}"><span class="tb">${TAB_ICONS[k]}</span>${l}</button>`).join('')}
  </nav>
  ${backupDue() ? `<div class="pad" style="margin-top:18px"><a href="#/settings" class="note" style="display:block;text-decoration:none">${settings.lastBackup ? `It's been ${days} days since your last backup.` : 'Your recipes only live on this phone.'} Tap to save a backup.</a></div>` : ''}
  ${recipes.length ? `
  <div class="lbar">
    <span class="hint" id="count">${filtered().length} recipe${filtered().length === 1 ? '' : 's'}</span>
    <div class="seg" role="group" aria-label="Layout">
      <button class="${settings.view === 'list' ? 'on' : ''}" data-act="view" data-v="list" aria-pressed="${settings.view === 'list'}">${I.list}List</button>
      <button class="${settings.view === 'grid' ? 'on' : ''}" data-act="view" data-v="grid" aria-pressed="${settings.view === 'grid'}">${I.grid}Grid</button>
    </div>
  </div>
  <div id="libItems">${libItems()}</div>` : `
  <div class="box col gap12 empty">
    ${doodle('soup', 96)}
    <h2 style="color:var(--salmon)">Your kitchen is empty</h2>
    <p class="hint">Paste a caption from a reel, a text from Mom, or type a recipe in.</p>
    <a class="btn chunk press" href="#/add" style="align-self:stretch">${I.plus} Add your first recipe</a>
    <button class="btn plain press" data-act="samples" style="align-self:stretch;border:2.5px solid var(--line)">Try it with sample recipes</button>
  </div>`}
  ${sheet ? vAddSheet() : ''}`;
}
function vAddSheet() {
  return `
  <a class="sheetbg" href="#/" aria-label="Close"></a>
  <div class="sheet fade" role="dialog" aria-modal="true" aria-labelledby="addTitle">
    <div class="grab"></div>
    <h2 id="addTitle" style="font-size:22px;color:var(--salmon);text-align:center">Add a recipe</h2>
    <a href="#/paste" class="opt chunk press" style="background:var(--pink)">
      <span class="oi" style="background:var(--white)">${I.clip}</span>
      <span class="col" style="gap:2px"><span class="fd" style="font-size:17px">Paste anything</span><span style="font-size:13px;font-weight:700">A caption, a text from Mom, or a recipe from a website</span></span>
    </a>
    <a href="#/edit/new" data-act="typeIn" class="opt chunk press" style="background:var(--white)">
      <span class="oi" style="background:var(--butter)">${I.pencil}</span>
      <span class="col" style="gap:2px"><span class="fd" style="font-size:17px">Type it in</span><span style="font-size:13px;font-weight:700;color:#6B5444">For recipes you're learning in person</span></span>
    </a>
    <div class="row gap10" style="background:var(--sky);border-radius:14px;padding:12px 14px;align-items:flex-start;color:#234B60">
      <span style="flex-shrink:0;margin-top:1px">${I.share}</span>
      <span style="font-size:13px;line-height:1.45;font-weight:700">Tip: on Instagram, tap Share on a reel and pick Recipe Nook. The link saves itself.</span>
    </div>
    <a href="#/" style="align-self:center;min-height:44px;display:flex;align-items:center;font-size:14.5px;font-weight:800;color:var(--soft);text-decoration:none">Cancel</a>
  </div>`;
}

/* ================= RECIPE ================= */
function notFound() { return `<div class="box col gap12 empty" style="margin-top:60px"><h2>Couldn't find that recipe</h2><a class="btn chunk press" href="#/" style="align-self:stretch">Back to my recipes</a></div>`; }
function unitSeg() {
  return `<div class="seg" role="group" aria-label="Units">
    ${[['as', 'as written'], ['g', 'grams'], ['cups', 'cups']].map(([k, l]) => `<button class="${settings.units === k ? 'on' : ''}" data-act="units" data-v="${k}" aria-pressed="${settings.units === k}">${l}</button>`).join('')}
  </div>`;
}
function ingTile(g) {
  const conv = Parser.convert(g, settings.units);
  const q = g.qty ? (conv ? '≈ ' + conv : g.qty) : 'amount?';
  return `<div class="tile ${g.loose ? 'loose' : ''} ${g.guess ? 'guess' : ''}">
    <span class="q">${esc(q)}${g.guess && g.qty ? '?' : ''}</span>
    <span class="n">${esc(g.name)}</span>
    ${conv ? `<span class="o">(${esc(g.qty)})</span>` : ''}
  </div>`;
}
function vRecipe(id) {
  const r = byId(id);
  if (!r) return notFound();
  const link = safeLink(r.link);
  const made = madeCount(r);
  const meta = [r.time, r.servings ? 'serves ' + r.servings : '', made ? 'made ' + made + '×' : ''].filter(Boolean);
  const guesses = (r.ingredients || []).filter(g => g.guess).length;
  return `
  <div class="rtop">
    <div class="bar">
      <a class="ibtn round chunk press" href="#/" aria-label="Back to recipes">${I.back}</a>
      <div class="row gap8">
        <a class="ibtn round chunk press" href="#/edit/${r.id}" aria-label="Edit recipe">${I.edit}</a>
        <button class="ibtn round pink chunk press" data-act="fav" data-id="${r.id}" aria-pressed="${!!r.fav}" aria-label="${r.fav ? 'Remove from favorites' : 'Add to favorites'}">${I.heart(r.fav)}</button>
      </div>
    </div>
  </div>
  <article class="arch">
    ${r.photo ? `<img class="hero" src="${urlFor(r.photo)}" alt="Photo of ${esc(r.name)}">` : `<div style="margin-top:-22px">${doodle(r, 150, 'Doodle of ' + (r.name || 'this dish'))}</div>`}
    <div class="row gap6" style="flex-wrap:wrap;justify-content:center">${sourceChip(r)}${statusChip(r)}${r.fav ? '<span class="chip c-fav">Favorite</span>' : ''}</div>
    <h1 class="rtitle">${esc(r.name || 'Untitled')}</h1>
    ${meta.length ? `<div class="meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
    ${(r.tips || []).length ? `<div class="note" style="align-self:stretch;margin-top:8px"><h3>${(r.source || {}).type === 'family' && r.source.who ? esc(r.source.who) + "'s tips" : 'Tips'}</h3>${r.tips.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
    <div class="sec"><h2>Ingredients</h2>${unitSeg()}</div>
    ${guesses ? `<p class="hint" style="align-self:stretch">Dashed ones are guesses. Fix them in Edit when you know.</p>` : ''}
    ${(r.ingredients || []).length ? `<div class="tiles">${r.ingredients.map(ingTile).join('')}</div>` : '<p class="hint" style="align-self:stretch">No ingredients yet.</p>'}
    <div class="sec"><h2>Steps</h2></div>
    ${(r.steps || []).length ? `<ol class="steps">${r.steps.map((s, i) => `<li><span class="num">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>` : '<p class="hint" style="align-self:stretch">No steps yet.</p>'}
    ${r.memo ? `<div class="sec"><h2>Voice memo</h2></div><audio controls src="${urlFor(r.memo)}"></audio>` : ''}
    ${r.notes ? `<div class="sec"><h2>Notes</h2></div><p style="align-self:stretch;font-size:15px;line-height:1.5;white-space:pre-line">${esc(r.notes)}</p>` : ''}
    ${link ? `<a class="btn plain chunk press small" style="align-self:stretch;margin-top:6px" href="${esc(link)}" target="_blank" rel="noopener">${I.link} Open the original</a>` : ''}
    <div class="sec"><h2>Made it log</h2><a class="pill on press" href="#/done/${r.id}" style="text-decoration:none">+ I made this</a></div>
    ${made ? `<div class="logl">${r.log.map(l => `<div class="li"><span class="d">${esc(niceDate(l.date))}</span><span>${esc(l.note || 'No note')}</span></div>`).join('')}</div>` : '<p class="hint" style="align-self:stretch">Not made yet.</p>'}
    <button data-act="delRecipe" data-id="${r.id}" class="row gap6" style="margin:22px 0 10px;color:var(--soft);font-size:13.5px;font-weight:800;min-height:44px">${I.trash} Delete recipe</button>
  </article>
  <a class="big chunk press" href="#/cook/${r.id}">${I.chef} Start cooking</a>`;
}

/* ================= COOKING MODE ================= */
const STOP = new Set(['fresh', 'chopped', 'minced', 'large', 'small', 'medium', 'ripe', 'and', 'the', 'of', 'for', 'diced', 'sliced', 'whole', 'unsalted', 'salted', 'extra', 'virgin', 'finely', 'roughly', 'divided', 'optional', 'room', 'temperature', 'packed', 'light', 'dark', 'cold', 'warm', 'hot', 'boneless', 'skinless']);
function stem(w) { return w.replace(/(oes|es|s)$/, m => m === 'oes' ? 'o' : ''); }
function keyWords(name) { return String(name).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem); }
function mentions(text, name) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).map(stem).join(' ') + ' ';
  return keyWords(name).some(w => t.includes(' ' + w + ' '));
}
function vCook(id, i) {
  const r = byId(id);
  if (!r) return notFound();
  const steps = (r.steps || []).length ? r.steps : ['No steps saved yet. Tap Edit on the recipe to add some.'];
  i = Math.max(0, Math.min(i, steps.length - 1));
  const step = steps[i];
  const used = (r.ingredients || []).filter(g => g.name && mentions(step, g.name));
  const last = i === steps.length - 1;
  return `
  <div class="cook ging">
    <div class="row" style="justify-content:space-between">
      <a class="ibtn round chunk press" href="#/r/${r.id}" aria-label="Exit cooking mode">${I.x}</a>
      <span style="background:var(--white);border:2.5px solid var(--line);border-radius:100px;padding:6px 14px;font-size:13px;font-weight:800">${'wakeLock' in navigator ? 'Screen stays on' : 'Cooking mode'}</span>
    </div>
    <section class="ccard chunk" aria-live="polite">
      <div class="row" style="justify-content:space-between;gap:8px">
        <span class="fd" style="font-size:15px;font-weight:500;color:var(--soft)">${esc(r.name)}</span>
        <span class="chip c-fam">Step ${i + 1} of ${steps.length}</span>
      </div>
      <div class="prog" aria-hidden="true">${steps.length <= 14 ? steps.map((s, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('') : `<i class="on" style="flex:${i + 1}"></i><i style="flex:${steps.length - i - 1 || 0.001}"></i>`}</div>
      <p class="stepbig">${esc(step)}</p>
      ${used.length ? `<div class="col" style="gap:2px"><span class="fd" style="font-size:15px;color:var(--salmon)">Used in this step</span>
        ${used.map((g, k) => `<label class="usechk"><input type="checkbox" data-chk="${r.id}:${i}:${k}" ${cookChecks[r.id + ':' + i + ':' + k] ? 'checked' : ''}><span>${esc((Parser.convert(g, settings.units) || g.qty) + ' ' + g.name).trim()}</span></label>`).join('')}</div>` : ''}
      ${(r.tips || []).length ? `<details class="note"><summary>${(r.source || {}).type === 'family' && r.source.who ? esc(r.source.who) + "'s tips" : 'Tips'} (${r.tips.length})</summary>${r.tips.map(t => `<p style="margin-top:6px;font-size:16px">${esc(t)}</p>`).join('')}</details>` : ''}
    </section>
  </div>
  <nav class="cnav">
    <a class="btn plain chunk press" href="${i === 0 ? '#/r/' + r.id : '#/cook/' + r.id + '/' + (i - 1)}">Back</a>
    <a class="btn chunk press" href="${last ? '#/done/' + r.id : '#/cook/' + r.id + '/' + (i + 1)}">${last ? 'Finish' : 'Next step'}</a>
  </nav>`;
}
const cookChecks = {};

/* ================= MADE IT ================= */
function vDone(id) {
  const r = byId(id);
  if (!r) return notFound();
  return `
  <div class="cook ging" style="padding-top:calc(36px + env(safe-area-inset-top))">
    <section class="box chunk col gap10" style="align-items:center;border-radius:24px">
      ${doodle(r, 84)}
      <h1 style="font-size:24px;color:var(--salmon)">You made it!</h1>
      <p style="font-size:14px;font-weight:700;color:var(--soft);text-align:center">${esc(r.name)} · time #${madeCount(r) + 1}</p>
      <span class="chip c-fam">Today, ${esc(longDate(todayISO()))}</span>
      <label class="field" style="align-self:stretch;margin-top:4px">
        <span class="label">Note for next time (optional)</span>
        <textarea id="logNote" class="inp" rows="2" placeholder="e.g. a little less sugar, more scallion"></textarea>
      </label>
      <button class="btn chunk press" data-act="saveLog" data-id="${r.id}" style="align-self:stretch">Save to log</button>
      <a href="#/r/${r.id}" style="min-height:44px;display:flex;align-items:center;font-size:14px;font-weight:800;color:var(--soft);text-decoration:none">Skip</a>
    </section>
    ${madeCount(r) ? `<section class="box col"><h2 style="font-size:17px;margin-bottom:6px">Past times</h2><div class="logl">${r.log.map(l => `<div class="li"><span class="d">${esc(niceDate(l.date))}</span><span>${esc(l.note || 'No note')}</span></div>`).join('')}</div></section>` : ''}
  </div>`;
}

/* ================= PASTE ================= */
const pasteState = { text: '', link: '' };
function vPaste() {
  return `
  <div class="pad col gap12" style="padding-top:calc(22px + env(safe-area-inset-top))">
    <div class="row" style="justify-content:space-between">
      <a class="ibtn round chunk press" href="#/" aria-label="Cancel">${I.x}</a>
      <h1 style="font-size:22px;color:var(--salmon)">Paste anything</h1>
      <span style="width:44px"></span>
    </div>
    <label class="field">
      <span class="label">Caption, notes, or a text from Mom</span>
      <textarea id="pasteText" class="inp" rows="9" placeholder="Paste the whole messy thing here. Hashtags, emojis and 'link in bio' get cleaned out.">${esc(pasteState.text)}</textarea>
    </label>
    <label class="field">
      <span class="label">Link (optional)</span>
      <input id="pasteLink" class="inp" type="url" inputmode="url" placeholder="instagram.com/reel/… or a recipe site" value="${esc(pasteState.link)}">
    </label>
    <p class="hint">The app can't open links by itself, so for a website, copy the recipe part of the page and paste it above.</p>
    <a class="row gap6" href="#/edit/new" data-act="typeIn" style="min-height:44px;font-size:14px;font-weight:800;color:var(--soft);text-decoration:none">${I.pencil} Type it in instead</a>
  </div>
  <button class="big wide chunk press" data-act="findRecipe">Find the recipe</button>`;
}

/* ================= EDIT / TYPE IN ================= */
let draft = null, draftFor = null, pendingDraft = null, pendingFromParse = false, draftFromParse = false;
let recorder = null;
function srcKey(d) {
  const s = d.source || {};
  if (s.type === 'family') return ['Mom', 'Dad'].includes(s.who) ? s.who : 'other';
  return s.type === 'reel' ? 'reel' : s.type === 'web' ? 'web' : 'me';
}
function vEdit(id) {
  if (!draft || draftFor !== id) {
    if (id === 'new') { draft = pendingDraft || newRecipe(); draftFromParse = pendingFromParse; pendingDraft = null; pendingFromParse = false; }
    else { const r = byId(id); if (!r) return notFound(); draft = Object.assign({}, r, { source: Object.assign({}, r.source), ingredients: r.ingredients.map(g => Object.assign({}, g)), steps: r.steps.slice(), tips: (r.tips || []).slice(), log: (r.log || []).slice() }); draftFromParse = false; }
    draftFor = id;
  }
  const d = draft;
  const sk = srcKey(d);
  const guesses = d.ingredients.filter(g => g.guess).length;
  const title = draftFromParse ? 'Check it over' : id === 'new' ? 'New recipe' : 'Edit recipe';
  return `
  <div class="pad col gap12" style="padding-top:calc(22px + env(safe-area-inset-top))">
    <div class="row" style="justify-content:space-between">
      <button class="ibtn round chunk press" data-act="cancelEdit" aria-label="Cancel">${I.back}</button>
      <h1 style="font-size:22px;color:var(--salmon)">${title}</h1>
      <button class="ibtn round butter chunk press" data-act="pickPhoto" aria-label="${d.photo ? 'Change photo' : 'Add photo'}">${I.cam}</button>
    </div>
    ${draftFromParse ? `<div class="note"><p><b>Found ${d.ingredients.length} ingredient${d.ingredients.length === 1 ? '' : 's'} and ${d.steps.length} step${d.steps.length === 1 ? '' : 's'}.</b> ${guesses ? `Dashed amounts are my guesses, so double-check them.` : 'Give it a quick look before saving.'}</p></div>` : ''}
    ${d.photo ? `<div class="col gap6"><img class="photoprev" src="${urlFor(d.photo)}" alt="Recipe photo"><button data-act="delPhoto" class="hint" style="align-self:flex-start;min-height:36px;text-decoration:underline">Remove photo</button></div>` : ''}
    <label class="field"><span class="label">Name</span>
      <input class="inp" data-k="name" value="${esc(d.name)}" placeholder="What's it called?" autocomplete="off"></label>

    <div class="field"><span class="label">Where's it from?</span>
      <div class="pills">
        ${[['Mom', 'Mom'], ['Dad', 'Dad'], ['me', 'Me'], ['reel', 'A reel'], ['web', 'A website'], ['other', 'Someone else']].map(([k, l]) => `<button class="pill ${sk === k ? 'on' : ''}" data-act="src" data-v="${k}" aria-pressed="${sk === k}">${l}</button>`).join('')}
      </div>
      ${sk === 'other' ? `<input class="inp" data-k="source.who" value="${esc(d.source.who === 'family' ? '' : d.source.who)}" placeholder="Who? (Grandma, a friend…)">` : ''}
    </div>

    <div class="row gap12" style="flex-wrap:wrap">
      <div class="field"><span class="label">Section</span><div class="pills">
        <button class="pill ${d.section !== 'baking' ? 'on' : ''}" data-act="section" data-v="cooking" aria-pressed="${d.section !== 'baking'}">Cooking</button>
        <button class="pill ${d.section === 'baking' ? 'on' : ''}" data-act="section" data-v="baking" aria-pressed="${d.section === 'baking'}">Baking</button></div></div>
      <div class="field"><span class="label">Status</span><div class="pills">
        <button class="pill ${d.status === 'made' ? 'on' : ''}" data-act="status" data-v="made" aria-pressed="${d.status === 'made'}">Made it</button>
        <button class="pill ${d.status === 'try' ? 'on' : ''}" data-act="status" data-v="try" aria-pressed="${d.status === 'try'}">Want to try</button></div></div>
    </div>

    <div class="row gap8">
      <label class="field" style="flex:1"><span class="label">Time</span><input class="inp" data-k="time" value="${esc(d.time)}" placeholder="20 min"></label>
      <label class="field" style="flex:1"><span class="label">Serves</span><input class="inp" data-k="servings" value="${esc(d.servings)}" placeholder="2" inputmode="numeric"></label>
    </div>

    <div class="field">
      <div class="row" style="justify-content:space-between"><span class="label">Ingredients</span><span class="hint">"a splash" is fine</span></div>
      ${d.ingredients.map((g, i) => `
        <div class="irow">
          <input class="inp sm qty ${g.guess ? 'guess' : ''}" data-k="ingredients.${i}.qty" value="${esc(g.qty)}" placeholder="${g.guess ? 'amount?' : 'amount'}" aria-label="Amount for ${esc(g.name || 'ingredient ' + (i + 1))}">
          <input class="inp sm" data-k="ingredients.${i}.name" value="${esc(g.name)}" placeholder="ingredient" aria-label="Ingredient ${i + 1}">
          <button class="del" data-act="delIng" data-i="${i}" aria-label="Remove ${esc(g.name || 'ingredient')}">${I.trash}</button>
          ${g.guess && g.qty ? `<button class="ok" data-act="okGuess" data-i="${i}">Looks right</button>` : ''}
        </div>`).join('')}
      <button class="addrow" data-act="addIng">+ ingredient</button>
    </div>

    <div class="field">
      <span class="label">Steps</span>
      ${d.steps.map((s, i) => `
        <div class="srow">
          <span class="fd" style="margin-top:10px;text-align:center;color:var(--salmon)">${i + 1}</span>
          <textarea class="inp sm" style="padding:8px 10px;line-height:1.4" rows="2" data-k="steps.${i}" aria-label="Step ${i + 1}">${esc(s)}</textarea>
          <button class="del" data-act="delStep" data-i="${i}" aria-label="Remove step ${i + 1}">${I.trash}</button>
        </div>`).join('')}
      <button class="addrow" data-act="addStep">+ step</button>
    </div>

    <div class="field">
      <span class="label">Tips</span>
      ${d.tips.map((t, i) => `
        <div class="srow" style="grid-template-columns:minmax(0,1fr) 40px">
          <textarea class="inp sm" style="padding:8px 10px;line-height:1.4;background:var(--butter)" rows="2" data-k="tips.${i}" aria-label="Tip ${i + 1}">${esc(t)}</textarea>
          <button class="del" data-act="delTip" data-i="${i}" aria-label="Remove tip ${i + 1}">${I.trash}</button>
        </div>`).join('')}
      <button class="addrow" data-act="addTip" style="background:var(--butter);border-color:#D9C07A">+ tip (like "oil really hot first")</button>
    </div>

    <div class="field">
      <span class="label">Voice memo</span>
      ${recorder ? `<button class="btn chunk press small" data-act="memoStop" style="background:var(--sky)"><span class="rec">● Recording…</span> tap to stop</button>`
        : d.memo ? `<audio controls src="${urlFor(d.memo)}"></audio><div class="row gap8"><button class="pill" data-act="memoStart">${I.mic} Record again</button><button class="pill" data-act="delMemo">${I.trash} Remove</button></div>`
        : `<button class="btn plain chunk press small" data-act="memoStart" style="background:var(--sky);color:#234B60">${I.mic} Record a memo</button>`}
    </div>

    <label class="field"><span class="label">Link</span><input class="inp" data-k="link" type="url" inputmode="url" value="${esc(d.link)}" placeholder="optional"></label>
    <label class="field"><span class="label">Notes</span><textarea class="inp" rows="3" data-k="notes" placeholder="Anything else to remember">${esc(d.notes)}</textarea></label>
  </div>
  <button class="big wide chunk press" data-act="saveDraft">Save recipe</button>`;
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[/^\d+$/.test(ks[i]) ? +ks[i] : ks[i]];
  const last = ks[ks.length - 1];
  o[/^\d+$/.test(last) ? +last : last] = val;
}
function rerenderKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function cleanDraft(d) {
  d.name = d.name.trim();
  d.ingredients = d.ingredients.map(g => ({ qty: String(g.qty || '').trim(), name: String(g.name || '').trim(), loose: !!g.loose, guess: !!g.guess })).filter(g => g.name);
  d.ingredients.forEach(g => { if (!g.guess) g.loose = !!g.qty && !/\d/.test(g.qty); });
  d.steps = d.steps.map(s => String(s).trim()).filter(Boolean);
  d.tips = d.tips.map(s => String(s).trim()).filter(Boolean);
  d.link = String(d.link || '').trim();
  return d;
}

/* photo + memo */
function pickFile(accept, cb) {
  const f = document.getElementById('filePick');
  f.value = ''; f.accept = accept;
  f.onchange = () => { if (f.files && f.files[0]) cb(f.files[0]); };
  f.click();
}
async function shrinkImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1200, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', 0.82));
  } catch (e) { return file; }
}
async function memoStart() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast("Recording isn't supported here"); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (draft) draft.memo = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      recorder = null;
      if (parts()[0] === 'edit') rerenderKeepScroll();
    };
    recorder.start();
    rerenderKeepScroll();
  } catch (e) { recorder = null; toast('Microphone access was blocked'); }
}

/* ================= FRIDGE SEARCH ================= */
const STAPLES = /^(salt|pepper|black pepper|white pepper|salt and pepper|salt & pepper|sugar|white sugar|granulated sugar|water|oil|olive oil|vegetable oil|cooking oil|neutral oil|ice|ice water)$/i;
function fridgeResults() {
  const have = settings.fridge.map(h => keyWords(h)).filter(k => k.length);
  if (!have.length) return [];
  const out = [];
  recipes.forEach(r => {
    const ings = (r.ingredients || []).filter(g => g.name && !STAPLES.test(g.name.trim()));
    if (!ings.length) return;
    const got = [], need = [];
    ings.forEach(g => {
      const kw = keyWords(g.name);
      (have.some(h => h.some(w => kw.includes(w))) ? got : need).push(g);
    });
    if (got.length) out.push({ r, got, need });
  });
  return out.sort((a, b) => (a.need.length - b.need.length) || (b.got.length - a.got.length));
}
function vFridge() {
  const res = fridgeResults();
  return `
  <div class="pad col gap12" style="padding-top:calc(22px + env(safe-area-inset-top))">
    <div class="row gap12">
      <a class="ibtn round chunk press" href="#/" aria-label="Back">${I.back}</a>
      <h1 style="font-size:24px;color:var(--salmon)">What can I make?</h1>
    </div>
    <section class="col gap10" style="background:var(--sky);border:2.5px solid var(--line);border-radius:18px;padding:12px">
      <span class="label">I have…</span>
      ${settings.fridge.length ? `<div class="pills">${settings.fridge.map((h, i) => `<span class="fchip">${esc(h)}<button data-act="fridgeDel" data-i="${i}" aria-label="Remove ${esc(h)}">${ic('<path d="M18 6 6 18M6 6l12 12"/>', 10, 4)}</button></span>`).join('')}</div>` : ''}
      <div class="row gap8">
        <label style="flex:1"><span class="sr">Add an ingredient</span><input id="fridgeIn" class="inp sm" style="background:#fff" placeholder="eggs, tomatoes…" autocomplete="off" enterkeyhint="done"></label>
        <button class="btn chunk press small" data-act="fridgeAdd" style="min-height:42px">Add</button>
      </div>
      ${settings.fridge.length ? `<button data-act="fridgeClear" class="hint" style="align-self:flex-start;min-height:32px;text-decoration:underline">Clear all</button>` : ''}
    </section>
    ${settings.fridge.length ? `
      <div class="row" style="justify-content:space-between;padding:0 2px"><h2 style="font-size:18px">You can make</h2><span class="hint">salt, pepper, sugar, oil and water assumed</span></div>
      ${res.length ? res.map(({ r, got, need }) => `
        <a href="#/r/${r.id}" class="card col gap8" style="padding:12px 14px;text-decoration:none;color:inherit">
          <span class="row" style="justify-content:space-between;gap:8px"><span class="rname" style="font-size:16.5px">${esc(r.name)}</span>
            <span class="chip ${need.length ? 'c-try' : 'c-web'}">${need.length ? 'Missing ' + need.length : 'Have everything'}</span></span>
          <span class="match" aria-hidden="true">${got.map(() => '<i class="on"></i>').join('')}${need.map(() => '<i></i>').join('')}</span>
          <span class="hint">${need.length ? 'Need: ' + esc(need.map(g => g.name.toLowerCase()).join(', ')) : 'Uses ' + esc(got.map(g => g.name.toLowerCase()).join(', '))}</span>
        </a>`).join('') : '<p class="hint">None of your recipes use those yet.</p>'}` : '<p class="hint">Add what\'s in your fridge and your recipes get ranked by how little you\'re missing.</p>'}
  </div>`;
}

/* ================= SETTINGS + BACKUP ================= */
function vSettings() {
  const days = settings.lastBackup ? Math.floor((Date.now() - settings.lastBackup) / 864e5) : null;
  const canShareFiles = !!(navigator.canShare && (() => { try { return navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }); } catch (e) { return false; } })());
  return `
  <div class="pad col gap12" style="padding-top:calc(22px + env(safe-area-inset-top))">
    <div class="row gap12">
      <a class="ibtn round chunk press" href="#/" aria-label="Back">${I.back}</a>
      <h1 style="font-size:24px;color:var(--salmon)">Settings</h1>
    </div>
    ${backupDue() ? `<div class="note"><p style="font-weight:700">${days != null ? `It's been ${days} days since your last backup.` : "You haven't saved a backup yet."}</p></div>` : ''}
    <section class="box col gap12">
      <div class="row" style="justify-content:space-between"><h2 style="font-size:18px">Backup</h2><span class="hint">${days == null ? 'Never' : 'Last: ' + new Date(settings.lastBackup).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
      <p style="font-size:13.5px;line-height:1.45;color:#6B5444">Your ${recipes.length} recipe${recipes.length === 1 ? '' : 's'} only live on this phone. Save a backup file to Google Drive or email it to yourself so you never lose them.</p>
      ${canShareFiles ? `<button class="btn chunk press" data-act="shareBackup">${I.share} Send backup to Drive / email</button>` : ''}
      <button class="btn ${canShareFiles ? 'plain' : ''} chunk press" data-act="downloadBackup" ${canShareFiles ? 'style="border:2.5px solid var(--line);box-shadow:none"' : ''}>${I.down} Download backup file</button>
      <button class="btn plain press" data-act="restore" style="border:2.5px solid var(--line)">Restore from a file</button>
      <label class="switch" style="border-top:2px dashed #EAD9C6;padding-top:8px"><span>Remind me weekly</span><input type="checkbox" data-set="remind" ${settings.remind ? 'checked' : ''}></label>
    </section>
    <section class="box col gap10">
      <h2 style="font-size:18px">Units</h2>
      <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700">Show amounts</span>${unitSeg()}</div>
      <p class="hint">Grams and cups only convert for ingredients the app knows the weight of (flour, sugar, butter, rice, milk…). Everything else shows as written.</p>
    </section>
    <section class="box col gap6">
      <h2 style="font-size:18px">Comfort</h2>
      <label class="switch"><span>Little animations (button press, fades)</span><input type="checkbox" data-set="motion" ${settings.motion ? 'checked' : ''}></label>
    </section>
    <section class="box col gap8">
      <h2 style="font-size:18px">Storage</h2>
      <p class="hint" id="storageInfo">Checking…</p>
      ${recipes.length ? '' : '<button class="pill" data-act="samples" style="align-self:flex-start">Add sample recipes</button>'}
    </section>
    <p class="hint" style="text-align:center;margin:8px 0 20px">Recipe Nook ${VERSION} · everything stays on this device</p>
  </div>`;
}
async function fillStorage() {
  const el = document.getElementById('storageInfo');
  if (!el) return;
  let txt = '';
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      txt = `Using about ${(e.usage / 1048576).toFixed(1)} MB.`;
    }
    if (navigator.storage && navigator.storage.persisted) txt += (await navigator.storage.persisted()) ? ' Protected from automatic cleanup.' : ' Your browser may clear this if the phone runs low on space, so keep backups.';
  } catch (e) { /* ignore */ }
  el.textContent = txt || 'Storage info isn\'t available here.';
}
function blobToDataURL(b) { return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }); }
async function dataURLToBlob(u) { if (!u || typeof u !== 'string' || !u.startsWith('data:')) return null; try { return await (await fetch(u)).blob(); } catch (e) { return null; } }
async function buildBackup() {
  const out = [];
  for (const r of recipes) {
    const c = Object.assign({}, r);
    c.photo = r.photo ? await blobToDataURL(r.photo) : null;
    c.memo = r.memo ? await blobToDataURL(r.memo) : null;
    out.push(c);
  }
  const json = JSON.stringify({ app: APP, version: 1, exported: new Date().toISOString(), recipes: out });
  const name = `recipe-nook-backup-${todayISO()}.json`;
  return { blob: new Blob([json], { type: 'application/json' }), name };
}
function markBackedUp() { settings.lastBackup = Date.now(); saveSettings(); }
async function restoreFrom(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast("That file isn't a Recipe Nook backup"); return; }
  if (!data || data.app !== APP || !Array.isArray(data.recipes)) { toast("That file isn't a Recipe Nook backup"); return; }
  const existing = data.recipes.filter(r => byId(r.id)).length;
  if (!confirm(`Restore ${data.recipes.length} recipe${data.recipes.length === 1 ? '' : 's'}?${existing ? `\n\n${existing} already on this phone will be replaced with the backup version.` : ''}\nOther recipes on this phone stay.`)) return;
  for (const r of data.recipes) {
    if (!r || !r.id) continue;
    const rec = Object.assign(newRecipe(), r);
    rec.photo = await dataURLToBlob(r.photo);
    rec.memo = await dataURLToBlob(r.memo);
    rec.ingredients = Array.isArray(rec.ingredients) ? rec.ingredients : [];
    rec.steps = Array.isArray(rec.steps) ? rec.steps : [];
    rec.tips = Array.isArray(rec.tips) ? rec.tips : [];
    rec.log = Array.isArray(rec.log) ? rec.log : [];
    await DB.put(rec);
  }
  recipes = await DB.all();
  toast('Restored!');
  render();
}

/* ================= SAMPLES ================= */
function samples() {
  const a = newRecipe();
  Object.assign(a, { name: 'Tomato & egg stir-fry', section: 'cooking', source: { type: 'family', who: 'Mom' }, status: 'made', fav: true, time: '15 min', servings: '2',
    ingredients: [{ qty: '3', name: 'Eggs' }, { qty: '2 medium', name: 'Tomatoes' }, { qty: '1 stalk', name: 'Scallion' }, { qty: 'a pinch', name: 'Sugar', loose: true }, { qty: 'to taste', name: 'Salt', loose: true }, { qty: 'a splash', name: 'Oil', loose: true }].map(g => Object.assign({ loose: false, guess: false }, g)),
    steps: ['Beat the eggs with a pinch of salt.', 'Heat oil until really hot, then scramble the eggs until just set. Take them out.', 'Add the tomatoes and a pinch of sugar. Cook until they break down and get saucy.', 'Add the eggs back and toss.', 'Top with scallion and serve over rice.'],
    tips: ['Get the oil really hot before the eggs go in.', 'Take the eggs out while still soft, they finish cooking later.'],
    log: [{ date: todayISO(), note: 'Sample entry' }] });
  const b = newRecipe();
  Object.assign(b, { name: 'Gochujang chicken bowls', section: 'cooking', source: { type: 'reel', who: '' }, status: 'try', time: '~20 min', servings: '2', link: 'instagram.com/reel/example',
    ingredients: [{ qty: '1 lb', name: 'Chicken thighs' }, { qty: '2 tbsp', name: 'Gochujang' }, { qty: '1 tbsp', name: 'Honey' }, { qty: '1 tbsp', name: 'Soy sauce', guess: true }, { qty: '2 cloves', name: 'Garlic', guess: true }, { qty: 'to serve', name: 'Rice', loose: true }].map(g => Object.assign({ loose: false, guess: false }, g)),
    steps: ['Sear chicken 5 min each side.', 'Toss in the sauce.', 'Serve over rice.'] });
  const c = newRecipe();
  Object.assign(c, { name: 'Brown butter chocolate chip cookies', section: 'baking', source: { type: 'web', who: '' }, status: 'try', time: '~30 min', servings: '24',
    ingredients: [{ qty: '1 cup', name: 'Butter' }, { qty: '2 1/4 cups', name: 'All-purpose flour' }, { qty: '3/4 cup', name: 'Brown sugar' }, { qty: '1/2 cup', name: 'Sugar' }, { qty: '2', name: 'Eggs' }, { qty: '1 tsp', name: 'Vanilla extract' }, { qty: '1 tsp', name: 'Baking soda' }, { qty: '1 tsp', name: 'Salt' }, { qty: '2 cups', name: 'Chocolate chips' }].map(g => Object.assign({ loose: false, guess: false }, g)),
    steps: ['Brown the butter and let it cool 10 minutes.', 'Whisk the sugars into the butter, then add eggs and vanilla.', 'Fold in flour, baking soda and salt. Stir in the chips.', 'Bake at 350°F for 11 minutes.'],
    tips: ['Chill the dough 30 min for thicker cookies.'] });
  return [a, b, c];
}

/* ================= EVENTS ================= */
const actions = {
  tab(b) { settings.tab = b.dataset.v; state.q = ''; saveSettings(); render(); },
  view(b) { settings.view = b.dataset.v; saveSettings(); render(); },
  units(b) { settings.units = b.dataset.v; saveSettings(); rerenderKeepScroll(); },
  async fav(b) { const r = byId(b.dataset.id); if (!r) return; r.fav = !r.fav; await saveRecipe(r); rerenderKeepScroll(); toast(r.fav ? 'Added to favorites' : 'Removed from favorites'); },
  async delRecipe(b) { const r = byId(b.dataset.id); if (!r) return; if (!confirm(`Delete "${r.name || 'this recipe'}"? This can't be undone unless you have a backup.`)) return; await DB.del(r.id); recipes = recipes.filter(x => x.id !== r.id); toast('Deleted'); go('#/'); },
  async samples() { for (const r of samples()) await saveRecipe(r); toast('Added 3 sample recipes'); go('#/'); },
  typeIn(b, e) { e.preventDefault(); pendingDraft = newRecipe(); pendingDraft.status = 'made'; pendingFromParse = false; draft = null; draftFor = null; go('#/edit/new'); },
  findRecipe() {
    pasteState.text = (document.getElementById('pasteText') || {}).value || pasteState.text;
    pasteState.link = (document.getElementById('pasteLink') || {}).value || pasteState.link;
    if (!pasteState.text.trim()) { toast('Paste some text first'); return; }
    const res = Parser.parseRecipe(pasteState.text, pasteState.link.trim());
    const r = newRecipe();
    Object.assign(r, { name: res.name, ingredients: res.ingredients, steps: res.steps, tips: res.tips, servings: res.servings, time: res.time, section: res.section, link: res.link, status: 'try' });
    const l = res.link.toLowerCase();
    r.source = l.includes('instagram.com') || l.includes('tiktok.com') ? { type: 'reel', who: '' } : l ? { type: 'web', who: '' } : { type: 'me', who: '' };
    if (!res.ingredients.length && !res.steps.length) toast("Couldn't find much. Fill in the rest below.");
    pendingDraft = r; pendingFromParse = true; draft = null; draftFor = null;
    pasteState.text = ''; pasteState.link = '';
    go('#/edit/new');
  },
  cancelEdit() {
    const id = draftFor;
    if (recorder) { try { recorder.stop(); } catch (e) { /* ignore */ } }
    if (!confirm('Leave without saving?')) return;
    draft = null; draftFor = null;
    go(id && id !== 'new' ? '#/r/' + id : '#/');
  },
  src(b) { const v = b.dataset.v; draft.source = ['Mom', 'Dad'].includes(v) ? { type: 'family', who: v } : v === 'other' ? { type: 'family', who: '' } : { type: v, who: '' }; if (v === 'Mom' || v === 'Dad' || v === 'other') { if (draft.status === 'try' && !draftFromParse) draft.status = 'made'; } rerenderKeepScroll(); },
  section(b) { draft.section = b.dataset.v; rerenderKeepScroll(); },
  status(b) { draft.status = b.dataset.v; rerenderKeepScroll(); },
  addIng() { draft.ingredients.push({ qty: '', name: '', loose: false, guess: false }); rerenderKeepScroll(); focusLast('[data-k$=".qty"]'); },
  delIng(b) { draft.ingredients.splice(+b.dataset.i, 1); rerenderKeepScroll(); },
  okGuess(b) { draft.ingredients[+b.dataset.i].guess = false; rerenderKeepScroll(); },
  addStep() { draft.steps.push(''); rerenderKeepScroll(); focusLast('[data-k^="steps."]'); },
  delStep(b) { draft.steps.splice(+b.dataset.i, 1); rerenderKeepScroll(); },
  addTip() { draft.tips.push(''); rerenderKeepScroll(); focusLast('[data-k^="tips."]'); },
  delTip(b) { draft.tips.splice(+b.dataset.i, 1); rerenderKeepScroll(); },
  pickPhoto() { pickFile('image/*', async f => { draft.photo = await shrinkImage(f); rerenderKeepScroll(); }); },
  delPhoto() { draft.photo = null; rerenderKeepScroll(); },
  memoStart() { memoStart(); },
  memoStop() { if (recorder) recorder.stop(); },
  delMemo() { draft.memo = null; rerenderKeepScroll(); },
  async saveDraft() {
    if (recorder) { toast('Stop the recording first'); return; }
    const d = cleanDraft(draft);
    if (!d.name) { toast('Give it a name first'); const n = document.querySelector('[data-k="name"]'); if (n) { n.focus(); n.scrollIntoView({ block: 'center' }); } return; }
    if (d.source.type === 'family' && !d.source.who) d.source.who = 'family';
    await saveRecipe(d);
    draft = null; draftFor = null;
    toast('Saved!');
    go('#/r/' + d.id);
  },
  async saveLog(b) {
    const r = byId(b.dataset.id); if (!r) return;
    const note = (document.getElementById('logNote') || {}).value || '';
    r.log = [{ date: todayISO(), note: note.trim() }].concat(r.log || []);
    r.status = 'made';
    await saveRecipe(r);
    Object.keys(cookChecks).forEach(k => { if (k.startsWith(r.id + ':')) delete cookChecks[k]; });
    toast('Saved to your log');
    go('#/r/' + r.id);
  },
  fridgeAdd() {
    const el = document.getElementById('fridgeIn');
    const vals = (el && el.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!vals.length) return;
    vals.forEach(v => { if (!settings.fridge.includes(v)) settings.fridge.push(v); });
    saveSettings(); render();
    const n = document.getElementById('fridgeIn'); if (n) n.focus();
  },
  fridgeDel(b) { settings.fridge.splice(+b.dataset.i, 1); saveSettings(); render(); },
  fridgeClear() { settings.fridge = []; saveSettings(); render(); },
  async downloadBackup() {
    const { blob, name } = await buildBackup();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    markBackedUp(); toast('Backup saved to Downloads'); rerenderKeepScroll();
  },
  async shareBackup() {
    const { blob, name } = await buildBackup();
    try {
      await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: 'Recipe Nook backup' });
      markBackedUp(); toast('Backup sent'); rerenderKeepScroll();
    } catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't share. Try Download instead."); }
  },
  restore() { pickFile('.json,application/json', restoreFrom); }
};
function focusLast(sel) { const els = app.querySelectorAll(sel); if (els.length) els[els.length - 1].focus(); }

app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || !app.contains(b)) return;
  const fn = actions[b.dataset.act];
  if (fn) { if (b.tagName === 'BUTTON') e.preventDefault(); fn(b, e); }
});
app.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k && draft) {
    setPath(draft, t.dataset.k, t.value);
    const m = t.dataset.k.match(/^ingredients\.(\d+)\.qty$/);
    if (m && draft.ingredients[+m[1]].guess) { draft.ingredients[+m[1]].guess = false; t.classList.remove('guess'); }
    return;
  }
  if (t.id === 'q') {
    state.q = t.value;
    const box = document.getElementById('libItems'); if (box) box.innerHTML = libItems();
    const c = document.getElementById('count'); if (c) { const n = filtered().length; c.textContent = n + ' recipe' + (n === 1 ? '' : 's'); }
    app.querySelectorAll('.tab').forEach(tb => tb.classList.toggle('on', !state.q && tb.dataset.v === settings.tab));
    return;
  }
  if (t.id === 'pasteText') pasteState.text = t.value;
  if (t.id === 'pasteLink') pasteState.link = t.value;
});
app.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.set) { settings[t.dataset.set] = t.checked; saveSettings(); applyMotion(); }
  if (t.dataset.chk) cookChecks[t.dataset.chk] = t.checked;
});
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'fridgeIn') { e.preventDefault(); actions.fridgeAdd(); }
});

/* ================= START ================= */
async function start() {
  applyMotion();
  try { await DB.open(); recipes = await DB.all(); }
  catch (e) { app.innerHTML = '<div class="box empty col gap10" style="margin-top:60px"><h2>Storage is blocked</h2><p class="hint">This browser isn\'t letting the app save data. Try opening it in Chrome (not a private tab).</p></div>'; return; }
  recipes.forEach(r => { r.ingredients = r.ingredients || []; r.steps = r.steps || []; r.tips = r.tips || []; r.log = r.log || []; r.source = r.source || { type: 'me', who: '' }; });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  /* arrived from the Android share menu? */
  const qs = new URLSearchParams(location.search);
  if (qs.has('text') || qs.has('url') || qs.has('title')) {
    const text = [qs.get('title'), qs.get('text')].filter(Boolean).join('\n').trim();
    let link = qs.get('url') || '';
    const found = text.match(/https?:\/\/[^\s]+/);
    if (!link && found) link = found[0];
    pasteState.link = link;
    pasteState.text = text.replace(link, '').trim();
    history.replaceState(null, '', location.pathname + '#/paste');
    if (!pasteState.text) setTimeout(() => toast('Link saved. Now paste the caption.'), 400);
  }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
