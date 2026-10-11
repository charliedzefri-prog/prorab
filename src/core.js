'use strict';
/* ================= УТИЛИТЫ ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pnum = v => { if (v === null || v === undefined) return 0; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const isEmpty = v => v === undefined || v === null || String(v).trim() === '';
/** форматирование числа как в приложении: до 2 знаков, без лишних нулей */
function num(v, d = 2) {
  if (!isFinite(v)) return '—';
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
/** деньги: всегда 2 знака */
function fin(v) { return Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const money = v => fin(v) + ' ' + cur();
const ceil = Math.ceil, floor = Math.floor;
/** Divmod.dm из оригинала: кол-во промежуточных элементов */
const dm = (a, b) => { const q = a / b; const i = Math.floor(q + 1e-9); return Math.abs(q - Math.round(q)) < 1e-9 ? Math.round(q) - 1 : i; };
const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
function fdate(d, time) {
  if (!d) return '';
  const x = new Date(d); if (isNaN(x)) return d;
  const s = x.toLocaleDateString('ru-RU');
  return time ? s + ' ' + x.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : s;
}
function plural(n, one, few, many) {
  n = Math.abs(Math.round(n)); const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

/* ================= ХРАНИЛИЩЕ ================= */
const STORE_KEY = 'prorab_pro_web_v1';
let STORAGE_OK = true;
const DEFAULT_SETTINGS = {
  theme: 'indigo', currency: 'р.', ratioUnit: 'ratio', numeration: 'list', sortSmeta: 'date',
  sortPrice: 'text', showDoneDate: true, contractor: { name: '', address: '', phone: '', requisite: '' },
  logo: '', autoBackup: true, calcBadges: true, lastBackup: null
};
function freshDB() {
  return {
    v: 1, settings: clone(DEFAULT_SETTINGS), journal: [], objects: [], smetas: [], clients: [],
    finLists: [], finEntries: [], notes: [], files: [], calcHistory: [],
    jobPrice: JOB_PRICE.map(r => ({ id: uid(), sec: r[0], name: r[1], unit: r[2], price: r[3] })),
    matPrice: MAT_PRICE.map(r => ({ id: uid(), sec: r[0], name: r[1], unit: r[2], price: r[3] })),
    consBase: CONS_BASE.map(r => ({ id: uid(), group: r[0], unit: r[1], name: r[2], rate: r[3] })),
    consLists: []
  };
}
let DB;
function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    DB = raw ? JSON.parse(raw) : freshDB();
  } catch (e) { STORAGE_OK = false; DB = freshDB(); }
  const f = freshDB();
  for (const k in f) if (DB[k] === undefined) DB[k] = f[k];
  DB.settings = Object.assign(clone(DEFAULT_SETTINGS), DB.settings || {});
  DB.settings.contractor = Object.assign(clone(DEFAULT_SETTINGS.contractor), DB.settings.contractor || {});
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!STORAGE_OK) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
    catch (e) { toast('Нет свободной памяти! Удалите старые файлы или фото.'); }
  }, 120);
}
const S = () => DB.settings;
const cur = () => S().currency || 'р.';

/* ================= UI ПОМОЩНИКИ ================= */
// append() без null/undefined/false (удобно для условных элементов)
{ const _ap = Element.prototype.append; Element.prototype.append = function (...a) { return _ap.apply(this, a.flat(9).filter(x => x !== null && x !== undefined && x !== false)); }; }
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(9)) if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
function toast(msg, ms = 2200) {
  $$('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast' }, msg); document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
function modal({ title, body, buttons = [], wide = false, onClose } = {}) {
  const close = () => { ov.remove(); document.removeEventListener('keydown', key); onClose && onClose(); };
  const key = e => { if (e.key === 'Escape') close(); };
  const mb = h('div', { class: 'mb' }); if (body) mb.append(body);
  const mf = buttons.length ? h('div', { class: 'mf' }, buttons.map(b => h('button', {
    class: 'btn ' + (b.cls || ''), onclick: async () => { const r = b.click ? await b.click() : true; if (r !== false) close(); }
  }, b.text))) : null;
  const ov = h('div', { class: 'ov', onclick: e => { if (e.target === ov) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'mh' }, h('span', {}, title || ''), h('button', { onclick: close, title: 'Закрыть' }, '×')), mb, mf));
  document.body.append(ov); document.addEventListener('keydown', key);
  setTimeout(() => { const i = $('input:not([type=checkbox]):not([type=radio]),textarea', mb); i && i.focus(); }, 30);
  return { close, el: ov, body: mb };
}
function confirmBox(text, okText = 'Да') {
  return new Promise(res => {
    let done = false;
    modal({ title: 'Подтверждение', body: h('div', {}, text), onClose: () => { if (!done) res(false); },
      buttons: [{ text: 'Отмена', click: () => { done = true; res(false); } }, { text: okText, cls: 'pri', click: () => { done = true; res(true); } }] });
  });
}
/** форма в модальном окне. fields: [{k,label,type,value,opts,req,ph}] */
function formBox(title, fields, okText = 'Готово') {
  return new Promise(res => {
    let done = false; const inputs = {};
    const body = h('div', {}, fields.map(f => {
      let inp;
      if (f.type === 'textarea') inp = h('textarea', { placeholder: f.ph || '' }, f.value || '');
      else if (f.type === 'select') { inp = h('select', {}, f.opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(f.value) }, l); })); }
      else if (f.type === 'check') { inp = h('input', { type: 'checkbox', checked: !!f.value }); inputs[f.k] = inp; return h('label', { class: 'chk row' }, inp, f.label); }
      else inp = h('input', { type: f.type || 'text', value: f.value ?? '', placeholder: f.ph || '', class: f.type === 'number' ? 'num' : '', step: 'any', list: f.list || null });
      inputs[f.k] = inp;
      return h('div', { style: { margin: '10px 0' } }, h('div', { class: 'fl', style: { marginBottom: '4px' } }, f.label), inp, f.hint ? h('div', { class: 'hint' }, f.hint) : null);
    }));
    body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { $('.mf .pri', m.el).click(); } });
    const m = modal({ title, body, onClose: () => { if (!done) res(null); },
      buttons: [{ text: 'Отмена' }, { text: okText, cls: 'pri', click: () => {
        const out = {};
        for (const f of fields) {
          const i = inputs[f.k]; out[f.k] = f.type === 'check' ? i.checked : (f.type === 'number' ? pnum(i.value) : i.value.trim());
          if (f.req && isEmpty(i.value)) { toast('Введите данные!'); i.focus(); return false; }
        }
        done = true; res(out);
      } }] });
  });
}
function prompt2(title, label, value = '') { return formBox(title, [{ k: 'v', label, value, req: true }]).then(r => r ? r.v : null); }
function menuBox(title, items) {
  const m = modal({ title, body: h('div', { class: 'menu-list' }, items.filter(Boolean).map(it => h('button', { class: it.danger ? 'danger' : '', onclick: () => { m.close(); it.click(); } }, it.text))) });
}
/** долгое нажатие + правый клик */
function onLong(el, fn) {
  let t; const start = e => { t = setTimeout(() => { t = null; el._longFired = true; fn(e); }, 550); };
  const cancel = () => { if (t) clearTimeout(t); t = null; };
  el.addEventListener('touchstart', start, { passive: true }); el.addEventListener('touchend', cancel); el.addEventListener('touchmove', cancel);
  el.addEventListener('mousedown', e => { if (e.button === 0) start(e); }); el.addEventListener('mouseup', cancel); el.addEventListener('mouseleave', cancel);
  el.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); fn(e); });
  el.addEventListener('click', e => { if (el._longFired) { e.stopImmediatePropagation(); e.preventDefault(); el._longFired = false; } }, true);
}

/* ================= ЭКСПОРТ ================= */
function download(name, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
/** сохранить экспорт во внутреннюю "файловую систему" (раздел Файлы) */
function storeFile(folder, name, type, content) {
  const f = { id: uid(), folder, name, type, content, date: nowISO(), size: content.length };
  const ex = DB.files.findIndex(x => x.folder === folder && x.name === name);
  if (ex >= 0) DB.files.splice(ex, 1, f); else DB.files.unshift(f);
  save(); return f;
}
const MIME = { txt: 'text/plain;charset=utf-8', csv: 'text/csv;charset=utf-8', xls: 'application/vnd.ms-excel;charset=utf-8', html: 'text/html;charset=utf-8', json: 'application/json;charset=utf-8', pdf: 'text/html;charset=utf-8' };
function openFile(f) {
  if (f.type === 'pdf' || f.type === 'html') return printHTML(f.content);
  download(f.name, (f.type === 'csv' || f.type === 'xls') ? '\ufeff' + f.content : f.content, MIME[f.type] || MIME.txt);
}
/** печать / сохранение в PDF через системный диалог печати */
function printHTML(html) {
  const fr = h('iframe', { style: { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' } });
  document.body.append(fr);
  const d = fr.contentDocument || fr.contentWindow.document;
  d.open(); d.write(html); d.close();
  setTimeout(() => {
    try { fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch (e) { const w = window.open(''); if (w) { w.document.write(html); w.document.close(); w.print(); } else toast('Печать недоступна в этом окне — скачайте файл'); }
    setTimeout(() => fr.remove(), 60000);
  }, 350);
}
function docHTML(title, inner, extraCss = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  body{font-family:Calibri,Arial,sans-serif;font-size:12pt;color:#000;margin:18mm 14mm}
  h1{font-size:16pt;text-align:center;margin:4px 0 12px}h2{font-size:13pt;margin:14px 0 6px}
  table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #444;padding:4px 6px;font-size:10.5pt;vertical-align:top}
  th{background:#e8e8e8}td.n{text-align:right;white-space:nowrap}tr.sec td{background:#f3f3f3;font-weight:bold}
  tr.tot td{font-weight:bold}.right{text-align:right}.muted{color:#555}.hdr{display:flex;justify-content:space-between;gap:20px;margin-bottom:10px}
  .logo{max-height:70px}pre{font-family:inherit;white-space:pre-wrap}.sign{display:flex;justify-content:space-between;margin-top:40px}
  @page{size:A4;margin:10mm}${extraCss}</style></head><body>${inner}</body></html>`;
}
function xlsHTML(title, inner) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Лист1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>td,th{border:.5pt solid #555;font-family:Calibri;font-size:11pt}th{background:#ddd}.n{mso-number-format:"0.00"}</style></head><body>${inner}</body></html>`;
}
function safeName(s) { return String(s || 'file').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'file'; }
/** универсальный диалог экспорта текста/таблицы */
async function exportDialog({ folder, name, txt, html, xls, csv }) {
  const opts = [];
  if (html) opts.push(['pdf', 'PDF (печать / сохранить как PDF)']);
  if (xls) opts.push(['xls', 'Документ Excel (xls)']);
  if (csv) opts.push(['csv', 'CSV']);
  if (txt) opts.push(['txt', 'Текст (txt)']);
  const r = await formBox('Экспорт', [
    { k: 'fmt', label: 'Формат', type: 'select', opts, value: opts[0][0] },
    { k: 'name', label: 'Имя файла', value: safeName(name), req: true },
    { k: 'keep', label: 'Сохранить копию в разделе «Файлы»', type: 'check', value: true }
  ], 'Экспорт');
  if (!r) return;
  const nm = safeName(r.name);
  const content = r.fmt === 'pdf' ? (typeof html === 'function' ? html() : html) : r.fmt === 'xls' ? (typeof xls === 'function' ? xls() : xls) : r.fmt === 'csv' ? (typeof csv === 'function' ? csv() : csv) : (typeof txt === 'function' ? txt() : txt);
  const ext = r.fmt === 'pdf' ? 'pdf' : r.fmt;
  const f = { folder, name: nm + '.' + (ext === 'pdf' ? 'html' : ext), type: ext, content };
  if (r.keep) storeFile(folder, f.name, f.type, content);
  if (r.fmt === 'pdf') printHTML(content);
  else download(f.name, (ext === 'csv' || ext === 'xls') ? '\ufeff' + content : content, MIME[ext]);
}
function shareText(text, title) {
  if (navigator.share) navigator.share({ title, text }).catch(() => { });
  else copyText(text);
}
function copyText(t) {
  const ok = () => toast('Скопировано');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, () => fallbackCopy(t));
  else fallbackCopy(t);
  function fallbackCopy(t) { const a = h('textarea', { style: { position: 'fixed', opacity: 0 } }, t); document.body.append(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Не получилось скопировать'); } a.remove(); }
}
function pickFile(accept) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.onchange = () => res(i.files[0] || null); document.body.append(i); i.click(); setTimeout(() => i.remove(), 60000);
  });
}
async function readFileText(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('\ufffd')) t = new TextDecoder('windows-1251').decode(buf);
  return t.replace(/^\ufeff/, '');
}
function resizeImage(file, max = 1000, q = .72) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', q)); }; img.onerror = () => res(null); img.src = r.result; };
    r.readAsDataURL(file);
  });
}
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ';') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); if (row.some(x => x !== '')) rows.push(row); row = []; f = ''; }
    else f += c;
  }
  row.push(f); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
const csvCell = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(';')).join('\r\n');

/* ================= РОУТЕР ================= */
const ROUTES = [];
function route(pattern, fn) { ROUTES.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), fn }); }
function go(path) { location.hash = '#' + path; }
function back() { if (history.length > 1 && document.referrer !== location.href) history.back(); else go('/'); }
let CURRENT = { path: '/', query: {} };
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [p, q] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(q || ''));
  return { path: decodeURI(p), query };
}
function render() {
  const { path, query } = parseHash(); CURRENT = { path, query };
  $$('.ov').forEach(o => o.remove());
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) { window.scrollTo(0, 0); r.fn(...m.slice(1).map(decodeURIComponent), query); return; }
  }
  go('/');
}
/** каркас экрана */
function screen({ title, sub, backTo, actions = [], tabs, body }) {
  const app = $('#app'); app.innerHTML = '';
  const isRoot = !backTo && CURRENT.path === '/';
  const hdr = h('div', { class: 'hdr' },
    !isRoot ? h('button', { class: 'back', title: 'Назад', onclick: () => backTo ? go(backTo) : back(), html: ICONS.back }) : null,
    h('div', { class: 'title', title: title }, title, sub ? h('small', {}, sub) : null),
    actions.map(a => h('button', { class: 'ib', title: a.title, onclick: a.click, html: a.icon })),
    h('button', { class: 'ib', title: 'Калькулятор', onclick: () => openCalculator(), html: ICONS.calc }),
    h('button', { class: 'ib', title: 'Настройки', onclick: () => go('/settings'), html: ICONS.wrench })
  );
  app.append(hdr);
  if (!STORAGE_OK) app.append(h('div', { class: 'warnbar' }, 'Хранилище браузера недоступно в режиме предпросмотра — данные не сохранятся после перезагрузки. Откройте файл в браузере.'));
  if (tabs) app.append(tabs);
  const main = h('main'); app.append(main);
  if (body) main.append(body);
  document.title = title + ' — ПРОраб pro';
  return main;
}
function tabsBar(items, active, onSel) {
  const bar = h('div', { class: 'tabs' }, items.map(([k, l]) => h('button', { class: k === active ? 'on' : '', onclick: () => onSel(k) }, l)));
  return bar;
}
const ICONS = {
  back: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  calc: '<svg width="46" height="46" viewBox="0 0 48 48"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient></defs><rect x="4" y="3" width="40" height="42" rx="4" fill="url(#cg)" stroke="#555"/><rect x="8" y="7" width="32" height="9" rx="1.5" fill="#1d2b2f"/><text x="37" y="14.5" font-size="7" font-family="monospace" fill="#3ff" text-anchor="end">90</text><g fill="#5b6770"><rect x="8" y="19" width="8" height="7" rx="1"/><rect x="18" y="19" width="8" height="7" rx="1"/><rect x="8" y="28" width="8" height="7" rx="1"/><rect x="18" y="28" width="8" height="7" rx="1"/><rect x="8" y="37" width="8" height="5" rx="1"/><rect x="18" y="37" width="8" height="5" rx="1"/></g><rect x="29" y="19" width="11" height="10" rx="1" fill="#e2e6e9" stroke="#888"/><rect x="29" y="31" width="11" height="11" rx="1" fill="#e2e6e9" stroke="#888"/><g stroke="#fff" stroke-width="1.3"><path d="M10 22.5h4M12 20.5v4M20 22.5h4M10 31.5h4M20 29.5l4 4M24 29.5l-4 4"/></g><path d="M31.5 35.5h6M31.5 38h6" stroke="#666" stroke-width="1.3"/></svg>',
  wrench: '<svg width="40" height="40" viewBox="0 0 48 48"><path d="M41.5 9.5l-6 6-4.5-1-1-4.5 6-6c-3.9-1.3-8.3-.4-11.2 2.6-2.9 2.9-3.8 7-2.7 10.7L6.7 32.7c-1.9 1.9-1.9 4.9 0 6.8l1.8 1.8c1.9 1.9 4.9 1.9 6.8 0L30.7 25.9c3.7 1.1 7.8.2 10.7-2.7 3-2.9 3.9-7.3 2.6-11.2l-2.5-2.5z" fill="#c9c9c9" stroke="#666" stroke-width="1.2"/><circle cx="10.5" cy="37.5" r="2" fill="#666"/></svg>',
  journal: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#ddd"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>',
  help: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#ddd"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>',
  more: '<svg width="28" height="28" viewBox="0 0 24 24" fill="#ddd"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  share: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#ddd"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11A2.99 2.99 0 0 0 21 5a3 3 0 0 0-6 0c0 .24.04.47.09.7L8.04 9.81A2.99 2.99 0 0 0 3 12a3 3 0 0 0 5.04 2.19l7.12 4.16c-.05.21-.08.43-.08.65A2.92 2.92 0 1 0 18 16.08z"/></svg>',
  search: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#ddd"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
};

/* ================= ВСТАВКА ИЗ КАЛЬКУЛЯТОРА ================= */
let CLIP = null; // значение, скопированное из калькулятора (вставка один раз, как в приложении)
document.addEventListener('click', e => {
  const t = e.target;
  if (CLIP !== null && t.matches && t.matches('input.num') && isEmpty(t.value)) {
    t.value = String(CLIP).replace('.', ','); CLIP = null;
    t.dispatchEvent(new Event('input', { bubbles: true })); toast('Вставлено из калькулятора');
  }
});
