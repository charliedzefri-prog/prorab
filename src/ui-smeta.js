'use strict';
/* ===================== СМЕТЫ ===================== */
const KIND_NAME = { job: 'Работы', mat: 'Материалы' };
const REPORT_CAT = ['ПРЕДВАРИТЕЛЬНЫЙ', 'ТЕКУЩИЙ', 'ЗАКЛЮЧИТЕЛЬНЫЙ'];
const TAX_MODES = ['Без налога', 'НДС включён в стоимость', 'НДС сверх стоимости', 'НПД (самозанятый, включён)'];
const UNITS = ['шт.', 'м²', 'м.п.', 'м³', 'кг', 'т.', 'л.', 'компл.', 'точка', 'уп.', 'меш.', 'лист', 'рулон', 'услуга', 'час', 'день', 'рейс'];

function newSmeta(name, client, obj) {
  return { id: uid(), name, client: client || '', obj: obj || null, date: today(), created: nowISO(), note: '', items: [], reports: [],
    fin: { kJob: 1, kMat: 1, tax: 0, taxRate: 20, payments: [], convRate: '', convCur: '$' } };
}
const itemSum = it => (pnum(it.qty) * pnum(it.price));
function smetaCalc(s) {
  const f = s.fin; const r = { job: 0, mat: 0, doneJob: 0, doneMat: 0 };
  for (const it of s.items) { const v = itemSum(it); r[it.kind] += v; if (it.done) r[it.kind === 'job' ? 'doneJob' : 'doneMat'] += v; }
  r.jobK = r.job * (pnum(f.kJob) || 1); r.matK = r.mat * (pnum(f.kMat) || 1);
  r.doneJobK = r.doneJob * (pnum(f.kJob) || 1); r.doneMatK = r.doneMat * (pnum(f.kMat) || 1);
  r.sum = r.jobK + r.matK; r.done = r.doneJobK + r.doneMatK;
  const tr = pnum(f.taxRate);
  r.tax = f.tax === 1 ? r.sum * tr / (100 + tr) : f.tax === 2 ? r.sum * tr / 100 : f.tax === 3 ? r.sum * tr / 100 : 0;
  r.total = f.tax === 2 ? r.sum + r.tax : r.sum;
  r.paid = f.payments.reduce((a, p) => a + pnum(p.sum), 0);
  r.toPay = r.total - r.paid;
  r.percent = r.sum ? Math.round(r.done / r.sum * 100) : 0;
  r.fullPaid = f.payments.some(p => p.full) || (r.total > 0 && r.paid >= r.total - 0.005);
  return r;
}
const kShow = k => S().ratioUnit === 'percent' ? num(((pnum(k) || 1) - 1) * 100) + ' %' : '× ' + num(pnum(k) || 1, 3);
function sectionsOf(s, kind) { const out = []; for (const it of s.items) if (it.kind === kind && !out.includes(it.sec)) out.push(it.sec); return out; }
function smetaLocked(s) { if (smetaCalc(s).fullPaid) { toast('Оплаченную смету изменять нельзя! Удалите полную оплату в финансах.'); return true; } return false; }

route('/smetas', () => {
  const main = screen({ title: 'Сметы', backTo: '/', actions: [{ icon: ICONS.more, title: 'Меню', click: smetasMenu }] });
  const q = h('input', { type: 'search', placeholder: 'Поиск сметы…', oninput: () => draw() });
  const listEl = h('div');
  main.append(h('div', { class: 'toolbar' }, q, h('button', { class: 'btn', onclick: () => go('/price/job') }, 'Прайс работ'), h('button', { class: 'btn', onclick: () => go('/price/mat') }, 'Прайс материалов'), h('button', { class: 'btn', onclick: () => go('/clients') }, 'Заказчики')), listEl,
    h('button', { class: 'fab', title: 'Новая смета', onclick: () => addSmeta() }, '+'));
  function draw() {
    listEl.innerHTML = '';
    let arr = DB.smetas.filter(s => !q.value || (s.name + ' ' + s.client).toLowerCase().includes(q.value.toLowerCase()));
    if (!arr.length) { listEl.append(h('div', { class: 'empty' }, DB.smetas.length ? 'Ничего не найдено' : 'Смет пока нет. Нажмите «+», чтобы создать смету.')); return; }
    arr.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    if (S().sortSmeta === 'client') {
      const g = {}; arr.forEach(s => (g[s.client || ''] = g[s.client || ''] || []).push(s));
      Object.keys(g).sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)).forEach(k => { listEl.append(h('div', { class: 'grp' }, h('span', {}, k || 'Без заказчика'), h('span', {}, g[k].length)), smetaList(g[k])); });
    } else listEl.append(smetaList(arr));
  }
  draw();
});
function smetaList(arr) {
  return h('div', { class: 'list' }, arr.map(s => {
    const c = smetaCalc(s); const obj = s.obj && DB.objects.find(o => o.id === s.obj);
    const li = h('div', { class: 'li', onclick: () => go('/smeta/' + s.id) },
      h('div', { class: 'main' }, h('div', { class: 't' }, s.name), h('div', { class: 's' }, [fdate(s.date), s.client, obj ? 'Объект: ' + obj.name : ''].filter(Boolean).join(' · '),
        c.fullPaid ? h('span', { class: 'pill ok' }, 'оплачено') : c.paid ? h('span', { class: 'pill warn' }, 'аванс') : null, c.percent ? h('span', { class: 'pill' }, 'вып. ' + c.percent + '%') : null)),
      h('div', { class: 'r' }, money(c.total)), h('button', { class: 'more', onclick: e => { e.stopPropagation(); smetaItemMenu(s); } }, '⋮'));
    onLong(li, () => smetaItemMenu(s)); return li;
  }));
}
function smetasMenu() {
  menuBox('Сметы', [
    { text: 'Новая смета', click: () => addSmeta() },
    { text: 'Загрузить смету из файла (.json)', click: importSmeta },
    { text: 'Прайс работ', click: () => go('/price/job') },
    { text: 'Прайс материалов', click: () => go('/price/mat') },
    { text: 'Заказчики', click: () => go('/clients') },
    { text: 'Настройки смет', click: () => go('/settings') },
    { text: 'Справка', click: () => go('/help?s=smeta') }
  ]);
}
async function addSmeta(obj) {
  const r = await formBox('Новая смета', [
    { k: 'name', label: 'Название (уникальное)', req: true, ph: 'Объект. Название сметы' },
    { k: 'client', label: 'Заказчик', type: 'select', opts: [['', '— не указан —'], ...DB.clients.map(c => [c.name, c.name]), ['+', '+ Новый заказчик…']] },
    { k: 'obj', label: 'Объект', type: 'select', opts: [['', '— без объекта —'], ...DB.objects.map(o => [o.id, o.name])], value: obj || '' }
  ], 'Создать');
  if (!r) return;
  if (DB.smetas.some(s => s.name.toLowerCase() === r.name.toLowerCase())) { toast('Смета с таким названием уже существует!'); return addSmeta(obj); }
  let client = r.client;
  if (client === '+') { const c = await editClient(); client = c ? c.name : ''; }
  const s = newSmeta(r.name, client, r.obj); DB.smetas.unshift(s); save(); go('/smeta/' + s.id);
}
function smetaItemMenu(s) {
  const c = smetaCalc(s);
  menuBox(s.name, [
    { text: 'Открыть', click: () => go('/smeta/' + s.id) },
    { text: 'Детали', click: () => go('/smeta/' + s.id + '?tab=det') },
    { text: 'Экспорт сметы / акта', click: () => smetaExport(s) },
    { text: 'Дублировать', click: async () => { const n = await prompt2('Копия сметы', 'Название новой сметы', s.name + ' (копия)'); if (!n) return; if (DB.smetas.some(x => x.name === n)) return toast('Такое название уже есть!');
      const cp = clone(s); Object.assign(cp, { id: uid(), name: n, created: nowISO(), date: today(), reports: [] }); cp.fin.payments = []; cp.items.forEach(i => { i.id = uid(); i.done = false; i.doneDate = null; }); DB.smetas.unshift(cp); save(); render(); } },
    { text: 'Поделиться файлом сметы (.json)', click: () => { const data = JSON.stringify({ prorab_smeta: 1, smeta: s }, null, 1); storeFile('Сметы', safeName(s.name) + '.json', 'json', data); download(safeName(s.name) + '.json', data, MIME.json); } },
    { text: 'Переименовать', click: async () => { const n = await prompt2('Переименовать', 'Название', s.name); if (n && !DB.smetas.some(x => x !== s && x.name === n)) { s.name = n; save(); render(); } else if (n) toast('Такое название уже есть!'); } },
    { text: 'Удалить', danger: true, click: async () => {
      if (c.paid > 0) return toast('После аванса смету удалить нельзя! Сначала удалите платежи.');
      if (await confirmBox(`Удалить смету «${s.name}»?`, 'Удалить')) { DB.smetas = DB.smetas.filter(x => x !== s); save(); render(); } } }
  ]);
}
async function importSmeta() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await readFileText(f)); const s = d.smeta || d;
    if (!s.items || !s.name) throw 0;
    s.id = uid(); s.created = nowISO(); s.obj = null;
    s.fin = Object.assign(newSmeta('').fin, s.fin || {}); s.reports = s.reports || [];
    while (DB.smetas.some(x => x.name === s.name)) s.name += ' (имп.)';
    DB.smetas.unshift(s); save(); toast('Смета загружена'); render();
  } catch (e) { toast('Неверный формат файла!'); }
}

/* ---------- экран сметы ---------- */
route('/smeta/:id', id => {
  const s = DB.smetas.find(x => x.id === id); if (!s) return go('/smetas');
  const tab = CURRENT.query.tab || 'job';
  const tabs = tabsBar([['job', 'Работы'], ['mat', 'Материалы'], ['det', 'Детали'], ['fin', 'Финансы'], ['rep', 'Отчёты']], tab, k => { history.replaceState(null, '', '#/smeta/' + id + '?tab=' + k); render(); });
  const main = screen({ title: s.name, sub: s.client || null, tabs, actions: [
    { icon: ICONS.share, title: 'Экспорт сметы / акта', click: () => smetaExport(s) },
    { icon: ICONS.help, title: 'Справка', click: () => modal({ title: 'Сметы', wide: true, body: h('div', { class: 'help' }, h('p', {}, HELP.smeta_help_start || ''), h('p', {}, HELP.smeta_help_details || '')) }) }] });
  if (tab === 'job' || tab === 'mat') smetaItems(main, s, tab);
  else if (tab === 'det') smetaDetails(main, s);
  else if (tab === 'fin') smetaFin(main, s);
  else smetaReports(main, s);
});

function smetaItems(main, s, kind) {
  const filter = CURRENT.query.f || 'all';
  const c = smetaCalc(s); const secs = sectionsOf(s, kind);
  main.append(h('div', { class: 'toolbar' },
    h('select', { style: { width: 'auto' }, onchange: e => { history.replaceState(null, '', `#/smeta/${s.id}?tab=${kind}&f=${e.target.value}`); render(); } },
      [['all', 'Все пункты'], ['done', 'Выполненные'], ['todo', 'Не выполненные']].map(([k, l]) => h('option', { value: k, selected: k === filter }, l))),
    h('span', { class: 'grow' }),
    h('button', { class: 'btn sm', onclick: () => go('/price/' + kind) }, 'Прайс'),
    h('button', { class: 'btn sm', onclick: () => smetaExport(s) }, 'Экспорт')));
  if (!secs.length) main.append(h('div', { class: 'empty' }, `В смете нет ${kind === 'job' ? 'работ' : 'материалов'}. Нажмите «+», чтобы добавить пункт из прайса или вручную.`));
  let n = 0;
  secs.forEach((sec, si) => {
    const items = s.items.filter(i => i.kind === kind && i.sec === sec);
    const secSum = items.reduce((a, i) => a + itemSum(i), 0);
    if (S().numeration === 'sec') n = 0;
    const head = h('div', { class: 'grp', style: { cursor: 'pointer' } }, h('span', {}, (si + 1) + '. ' + (sec || 'Без раздела')), h('span', {}, money(secSum)));
    head.onclick = () => sectionMenu(s, kind, sec);
    onLong(head, () => sectionMenu(s, kind, sec));
    main.append(head);
    items.forEach(it => {
      n++;
      if (filter === 'done' && !it.done) return; if (filter === 'todo' && it.done) return;
      const cb = h('input', { type: 'checkbox', checked: !!it.done, title: 'Выполнено', onclick: e => e.stopPropagation(), onchange: e => {
        if (smetaLocked(s)) { e.target.checked = !!it.done; return; }
        it.done = e.target.checked; it.doneDate = it.done ? today() : null; save(); render(); } });
      const row = h('div', { class: 'sitem' + (it.done ? ' done' : '') },
        h('div', { class: 'n' }, n),
        h('div', { class: 'nm', onclick: () => editItem(s, kind, it) },
          h('div', { class: 't' }, it.name),
          h('div', { class: 's' }, `${num(it.qty, 3)} ${it.unit} × ${fin(it.price)} ${cur()}` + (it.done && it.doneDate && S().showDoneDate ? ` · выполнено ${fdate(it.doneDate)}` : '')),
          it.comment ? h('div', { class: 'cmt' }, it.comment) : null),
        h('div', { class: 'sum' }, fin(itemSum(it))), cb);
      onLong(row, () => itemMenu(s, kind, it));
      main.append(row);
    });
  });
  const k = kind === 'job' ? s.fin.kJob : s.fin.kMat;
  main.append(h('div', { class: 'totals' },
    h('div', {}, h('span', {}, 'Итого ' + KIND_NAME[kind].toLowerCase()), h('b', {}, money(c[kind]))),
    (pnum(k) || 1) !== 1 ? h('div', {}, h('span', {}, 'С учётом коэффициента ' + kShow(k)), h('b', {}, money(c[kind + 'K']))) : null,
    h('div', {}, h('span', {}, 'Выполнено'), h('span', {}, money(kind === 'job' ? c.doneJobK : c.doneMatK))),
    h('div', { class: 'big' }, h('span', {}, 'Всего по смете'), h('b', {}, money(c.total)))),
    h('p', { class: 'hint center' }, 'Клик по пункту — редактирование, долгое нажатие — меню пункта, клик по разделу — меню раздела.'),
    h('div', { style: { height: '70px' } }),
    h('button', { class: 'fab', title: 'Добавить пункт', onclick: () => { if (!smetaLocked(s)) editItem(s, kind, null); } }, '+'));
}
function sectionMenu(s, kind, sec) {
  const secs = sectionsOf(s, kind), i = secs.indexOf(sec);
  const moveSec = d => { const j = i + d; if (j < 0 || j >= secs.length) return; [secs[i], secs[j]] = [secs[j], secs[i]];
    const others = s.items.filter(x => x.kind !== kind); s.items = [...others, ...secs.flatMap(sc => s.items.filter(x => x.kind === kind && x.sec === sc))]; save(); render(); };
  menuBox('Раздел: ' + (sec || 'Без раздела'), [
    { text: '+ Добавить пункт в раздел', click: () => { if (!smetaLocked(s)) editItem(s, kind, null, sec); } },
    { text: 'Переименовать раздел', click: async () => { if (smetaLocked(s)) return; const n = await prompt2('Переименовать раздел', 'Название', sec); if (n) { s.items.forEach(x => { if (x.kind === kind && x.sec === sec) x.sec = n; }); save(); render(); } } },
    { text: 'Отметить всё выполненным', click: () => { if (smetaLocked(s)) return; s.items.forEach(x => { if (x.kind === kind && x.sec === sec && !x.done) { x.done = true; x.doneDate = today(); } }); save(); render(); } },
    i > 0 ? { text: 'Переместить вверх', click: () => moveSec(-1) } : null,
    i < secs.length - 1 ? { text: 'Переместить вниз', click: () => moveSec(1) } : null,
    { text: 'Удалить раздел', danger: true, click: async () => { if (smetaLocked(s)) return; if (await confirmBox(`Удалить раздел «${sec}» со всеми пунктами?`, 'Удалить')) { s.items = s.items.filter(x => !(x.kind === kind && x.sec === sec)); save(); render(); } } }
  ]);
}
function itemMenu(s, kind, it) {
  const arr = s.items.filter(x => x.kind === kind && x.sec === it.sec), i = arr.indexOf(it);
  const move = d => { const other = arr[i + d]; if (!other) return; const a = s.items.indexOf(it), b = s.items.indexOf(other); [s.items[a], s.items[b]] = [s.items[b], s.items[a]]; save(); render(); };
  menuBox(it.name, [
    { text: 'Редактировать', click: () => editItem(s, kind, it) },
    { text: 'Комментарий', click: async () => { const r = await formBox('Комментарий (в экспорт не попадает)', [{ k: 'c', label: 'Комментарий', type: 'textarea', value: it.comment || '' }]); if (r) { it.comment = r.c; save(); render(); } } },
    { text: it.done ? 'Снять отметку «Выполнено»' : 'Выполнено (с датой)…', click: async () => { if (smetaLocked(s)) return;
      if (it.done) { it.done = false; it.doneDate = null; } else { const r = await formBox('Выполнено', [{ k: 'd', label: 'Дата выполнения', type: 'date', value: today() }]); if (!r) return; it.done = true; it.doneDate = r.d || today(); } save(); render(); } },
    i > 0 ? { text: 'Переместить вверх', click: () => move(-1) } : null,
    i < arr.length - 1 ? { text: 'Переместить вниз', click: () => move(1) } : null,
    { text: 'Копировать в другую смету', click: async () => { const others = DB.smetas.filter(x => x !== s); if (!others.length) return toast('Нет других смет');
      const r = await formBox('Копировать пункт', [{ k: 's', label: 'Смета', type: 'select', opts: others.map(x => [x.id, x.name]) }]); if (r) { DB.smetas.find(x => x.id === r.s).items.push({ ...clone(it), id: uid(), done: false, doneDate: null }); save(); toast('Скопировано'); } } },
    { text: 'Добавить в прайс', click: () => { const base = kind === 'job' ? DB.jobPrice : DB.matPrice; const ex = base.find(p => p.name === it.name && p.sec === it.sec);
      if (ex) { ex.price = pnum(it.price); ex.unit = it.unit; toast('Цена в прайсе обновлена'); } else { base.push({ id: uid(), sec: it.sec, name: it.name, unit: it.unit, price: pnum(it.price) }); toast('Добавлено в прайс'); } save(); } },
    { text: 'Удалить', danger: true, click: async () => { if (smetaLocked(s)) return; if (await confirmBox('Удалить пункт?', 'Удалить')) { s.items = s.items.filter(x => x !== it); save(); render(); } } }
  ]);
}
function editItem(s, kind, it, presetSec) {
  const isNew = !it; it = it ? it : { kind, sec: presetSec || sectionsOf(s, kind).slice(-1)[0] || '', name: '', unit: 'м²', qty: '', price: '', comment: '' };
  const base = kind === 'job' ? DB.jobPrice : DB.matPrice;
  const secList = [...new Set([...sectionsOf(s, kind), ...base.map(p => p.sec)])];
  const dlS = h('datalist', { id: 'dl_sec' }, secList.map(x => h('option', { value: x })));
  const dlU = h('datalist', { id: 'dl_unit' }, [...new Set([...UNITS, ...base.map(p => p.unit)])].map(x => h('option', { value: x })));
  const f = {
    sec: h('input', { type: 'text', value: it.sec, list: 'dl_sec', placeholder: 'Например: Стены' }),
    name: h('input', { type: 'text', value: it.name, placeholder: 'Наименование' }),
    unit: h('input', { type: 'text', value: it.unit, list: 'dl_unit' }),
    qty: h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: isEmpty(it.qty) ? '' : String(it.qty).replace('.', ','), placeholder: '0' }),
    price: h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: isEmpty(it.price) ? '' : String(it.price).replace('.', ','), placeholder: '0' }),
    comment: h('input', { type: 'text', value: it.comment || '', placeholder: 'Личная заметка (не экспортируется)' })
  };
  const sumEl = h('b'); const upd = () => sumEl.textContent = money(pnum(f.qty.value) * pnum(f.price.value)); f.qty.oninput = f.price.oninput = upd; upd();
  const toPrice = h('input', { type: 'checkbox' });
  const L = (t, el) => h('div', { style: { margin: '8px 0' } }, h('div', { class: 'fl', style: { marginBottom: '3px' } }, t), el);
  const body = h('div', {}, dlS, dlU,
    h('button', { class: 'btn full', onclick: () => pricePicker(kind, p => { f.sec.value = f.sec.value || p.sec; f.name.value = p.name; f.unit.value = p.unit; f.price.value = String(p.price).replace('.', ','); upd(); f.qty.focus(); }) }, '📋 Выбрать из прайса ' + (kind === 'job' ? 'работ' : 'материалов')),
    L('Раздел', f.sec), L('Наименование', f.name),
    h('div', { class: 'g3', style: { display: 'grid', gap: '8px' } }, L('Ед. изм.', f.unit), L('Количество', f.qty), L('Цена, ' + cur(), f.price)),
    h('div', { class: 'totals' }, h('div', {}, h('span', {}, 'Сумма'), sumEl)),
    L('Комментарий', f.comment), h('label', { class: 'chk' }, toPrice, 'Сохранить / обновить в прайсе'));
  const doSave = (more) => {
    if (isEmpty(f.name.value)) { toast('Введите наименование!'); return false; }
    Object.assign(it, { sec: f.sec.value.trim() || 'Без раздела', name: f.name.value.trim(), unit: f.unit.value.trim(), qty: pnum(f.qty.value), price: pnum(f.price.value), comment: f.comment.value.trim() });
    if (isNew) { it.id = uid(); it.done = false;
      const lastIdx = s.items.map((x, i) => x.kind === kind && x.sec === it.sec ? i : -1).filter(i => i >= 0).pop();
      if (lastIdx !== undefined) s.items.splice(lastIdx + 1, 0, it); else s.items.push(it); }
    if (toPrice.checked) { const ex = base.find(p => p.name === it.name); if (ex) Object.assign(ex, { price: it.price, unit: it.unit }); else base.push({ id: uid(), sec: it.sec, name: it.name, unit: it.unit, price: it.price }); }
    save(); render(); if (more) setTimeout(() => editItem(s, kind, null, it.sec), 50);
  };
  modal({ title: isNew ? 'Новый пункт: ' + KIND_NAME[kind].toLowerCase() : 'Редактирование', body, wide: false, buttons: [
    { text: 'Отмена' }, isNew ? { text: 'Сохранить и ещё', click: () => doSave(true) } : null, { text: 'Сохранить', cls: 'pri', click: () => doSave(false) }].filter(Boolean) });
  setTimeout(() => (isNew ? f.name : f.qty).focus(), 60);
}
function pricePicker(kind, onPick) {
  const base = kind === 'job' ? DB.jobPrice : DB.matPrice;
  const q = h('input', { type: 'search', placeholder: 'Поиск по прайсу…' }), list = h('div', { style: { maxHeight: '58vh', overflow: 'auto' } });
  const m = modal({ title: 'Прайс ' + (kind === 'job' ? 'работ' : 'материалов'), wide: true, body: h('div', {}, q, list) });
  const draw = () => {
    list.innerHTML = ''; const t = q.value.toLowerCase();
    const groups = {}; base.filter(p => !t || (p.name + ' ' + p.sec).toLowerCase().includes(t)).forEach(p => (groups[p.sec] = groups[p.sec] || []).push(p));
    for (const [sec, arr] of Object.entries(groups)) {
      list.append(h('div', { class: 'grp' }, h('span', {}, sec), h('span', {}, arr.length)));
      arr.forEach(p => list.append(h('div', { class: 'li', style: { padding: '8px 10px' }, onclick: () => { m.close(); onPick(p); } }, h('div', { class: 'main' }, h('div', {}, p.name)), h('div', { class: 'r' }, fin(p.price) + ' ' + cur() + '/' + p.unit))));
    }
    if (!list.children.length) list.append(h('div', { class: 'empty' }, 'Не найдено'));
  };
  q.oninput = draw; draw(); setTimeout(() => q.focus(), 50);
}

function smetaDetails(main, s) {
  const contr = S().contractor;
  const f = {
    name: h('input', { type: 'text', value: s.name }), date: h('input', { type: 'date', value: s.date }),
    client: h('select', {}, h('option', { value: '' }, '— не указан —'), DB.clients.map(c => h('option', { value: c.name, selected: c.name === s.client }, c.name))),
    obj: h('select', {}, h('option', { value: '' }, '— без объекта —'), DB.objects.map(o => h('option', { value: o.id, selected: o.id === s.obj }, o.name))),
    note: h('textarea', { placeholder: 'Примечание отображается в файле экспорта' }, s.note || '')
  };
  if (s.client && !DB.clients.some(c => c.name === s.client)) f.client.append(h('option', { value: s.client, selected: true }, s.client));
  const L = (t, el, extra) => h('div', { class: 'row' }, h('label', {}, t), h('div', { class: 'fld' }, el, extra || null));
  const cl = DB.clients.find(c => c.name === s.client);
  main.append(h('div', { class: 'card' }, h('h3', {}, 'Детали сметы'),
    L('Название', f.name), L('Дата составления', f.date),
    L('Заказчик', f.client, h('button', { class: 'btn sm', onclick: async () => { const c = await editClient(); if (c) { s.client = c.name; save(); render(); } } }, '+')),
    L('Объект', f.obj), h('div', { class: 'fl' }, 'Примечание'), f.note,
    h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: () => {
      const n = f.name.value.trim(); if (!n) return toast('Введите название!');
      if (DB.smetas.some(x => x !== s && x.name.toLowerCase() === n.toLowerCase())) return toast('Смета с таким названием уже существует!');
      Object.assign(s, { name: n, date: f.date.value || today(), client: f.client.value, obj: f.obj.value || null, note: f.note.value }); save(); toast('Сохранено!'); render(); } }, 'Сохранить'))),
    cl ? h('div', { class: 'card' }, h('h3', {}, 'Заказчик'), h('div', { class: 'kv' }, ...kvRows([['Имя', cl.name], ['Телефон', [cl.phone1, cl.phone2, cl.phone3].filter(Boolean).join(', ')], ['Адрес', cl.address], ['Реквизиты', cl.requisite], ['Примечание', cl.note]]))) : null,
    h('div', { class: 'card' }, h('h3', {}, 'Подрядчик'), contr.name || contr.phone ? h('div', { class: 'kv' }, ...kvRows([['Подрядчик', contr.name], ['Адрес', contr.address], ['Телефон', contr.phone], ['Реквизиты', contr.requisite]])) : h('div', { class: 'hint' }, 'Данные подрядчика не заполнены.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: () => go('/settings') }, 'Изменить в настройках'))),
    h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: () => smetaItemMenu(s) }, 'Ещё…')));
}
const withLong = (el, fn) => { onLong(el, fn); return el; };
const kvRows = arr => arr.filter(x => !isEmpty(x[1])).flatMap(([k, v]) => [h('div', {}, k), h('div', { style: { whiteSpace: 'pre-line' } }, v)]);

function smetaFin(main, s) {
  const c = smetaCalc(s), f = s.fin, pct = S().ratioUnit === 'percent';
  const kIn = (key) => h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: pct ? num(((pnum(f[key]) || 1) - 1) * 100) : num(pnum(f[key]) || 1, 3),
    onchange: e => { const v = pnum(e.target.value); f[key] = pct ? 1 + v / 100 : (v || 1); save(); render(); } });
  const T = (l, v, cls) => h('div', { class: cls || '' }, h('span', {}, l), h('b', {}, v));
  main.append(h('div', { class: 'totals' },
    T('Работы', money(c.job)), (pnum(f.kJob) || 1) !== 1 ? T('Работы с коэффициентом ' + kShow(f.kJob), money(c.jobK)) : null,
    T('Материалы', money(c.mat)), (pnum(f.kMat) || 1) !== 1 ? T('Материалы с коэффициентом ' + kShow(f.kMat), money(c.matK)) : null,
    f.tax ? T(TAX_MODES[f.tax] + ' (' + num(f.taxRate) + '%)', money(c.tax)) : null,
    T('СУММА ПО СМЕТЕ', money(c.total), 'big'),
    T('Выполнено работ', money(c.doneJobK)), T('Выполнено материалов', money(c.doneMatK)), T('Процент выполнения', c.percent + ' %'),
    T('Оплачено', money(c.paid)), T(c.toPay >= 0 ? 'К оплате' : 'Переплата', money(Math.abs(c.toPay)), 'big'),
    T('К оплате за выполненное', money(Math.max(0, c.done * (f.tax === 2 ? 1 + pnum(f.taxRate) / 100 : 1) - c.paid))),
    pnum(f.convRate) > 0 ? T(`Сумма в ${f.convCur} (курс ${num(f.convRate, 4)})`, fin(c.total / pnum(f.convRate)) + ' ' + f.convCur) : null));
  main.append(h('div', { class: 'card' }, h('h3', {}, 'Платежи'),
    f.payments.length ? h('div', { class: 'list' }, f.payments.map(p => withLong(h('div', { class: 'li', onclick: () => editPayment(s, p) }, h('div', { class: 'main' }, h('div', { class: 't' }, (p.full ? 'Полная оплата' : 'Аванс / оплата')), h('div', { class: 's' }, fdate(p.date) + (p.note ? ' · ' + p.note : ''))), h('div', { class: 'r' }, money(p.sum))), () => menuBox('Платёж', [{ text: 'Изменить', click: () => editPayment(s, p) }, { text: 'Удалить платёж', danger: true, click: async () => { if (await confirmBox('Удалить платёж?', 'Удалить')) delPayment(s, p); } }])))) : h('div', { class: 'hint' }, 'Платежей нет'),
    f.payments.length ? h('div', { class: 'hint' }, 'Долгое нажатие на платёж — удалить.') : null,
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => editPayment(s, null) }, '+ Аванс / оплата'), h('button', { class: 'btn', onclick: () => editPayment(s, null, true) }, '+ Полная оплата'))));
  const taxSel = h('select', { onchange: e => { f.tax = +e.target.value; if (f.tax === 3 && pnum(f.taxRate) === 20) f.taxRate = 4; save(); render(); } }, TAX_MODES.map((t, i) => h('option', { value: i, selected: i === f.tax }, t)));
  main.append(h('div', { class: 'card' }, h('h3', {}, 'Коэффициенты и налоги'),
    h('div', { class: 'row' }, h('label', {}, pct ? 'Процент на работы, %' : 'Коэффициент на работы'), h('div', { class: 'fld' }, kIn('kJob'))),
    h('div', { class: 'row' }, h('label', {}, pct ? 'Процент на материалы, %' : 'Коэффициент на материалы'), h('div', { class: 'fld' }, kIn('kMat'))),
    h('div', { class: 'hint' }, pct ? 'Отрицательное значение — скидка. Единицу процентовки можно изменить в настройках.' : 'Например 1,2 — наценка 20%, 0,9 — скидка 10%. Единицу процентовки можно изменить в настройках.'),
    h('div', { class: 'row' }, h('label', {}, 'Налог'), h('div', { class: 'fld' }, taxSel)),
    f.tax ? h('div', { class: 'row' }, h('label', {}, 'Ставка, %'), h('div', { class: 'fld' }, h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: num(f.taxRate), onchange: e => { f.taxRate = pnum(e.target.value); save(); render(); } }))) : null));
  main.append(h('div', { class: 'card' }, h('h3', {}, 'Конвертация в другую валюту'),
    h('div', { class: 'row' }, h('label', {}, 'Валюта'), h('div', { class: 'fld' }, h('input', { type: 'text', value: f.convCur || '', onchange: e => { f.convCur = e.target.value; save(); render(); } }))),
    h('div', { class: 'row' }, h('label', {}, `Курс (1 ед. = … ${cur()})`), h('div', { class: 'fld' }, h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: f.convRate ? num(f.convRate, 4) : '', placeholder: 'не задан', onchange: e => { f.convRate = pnum(e.target.value); save(); render(); } })))));
}
async function editPayment(s, p, full) {
  const isNew = !p;
  const c = smetaCalc(s);
  const r = await formBox(isNew ? (full ? 'Полная оплата' : 'Аванс / оплата') : 'Платёж', [
    { k: 'sum', label: 'Сумма, ' + cur(), value: p ? String(p.sum).replace('.', ',') : full ? String(Math.max(0, Math.round(c.toPay * 100) / 100)).replace('.', ',') : '', req: true },
    { k: 'date', label: 'Дата', type: 'date', value: p ? p.date : today() },
    { k: 'note', label: 'Комментарий', value: p ? p.note : '' },
    { k: 'full', label: 'Полная оплата (смета будет закрыта для изменений)', type: 'check', value: p ? p.full : !!full }
  ], 'Сохранить');
  if (!r) return;
  const o = { id: p ? p.id : uid(), sum: pnum(r.sum), date: r.date || today(), note: r.note, full: r.full };
  if (isNew) s.fin.payments.push(o); else Object.assign(p, o);
  save(); render();
  if (!isNew) return;
  if (await confirmBox('Добавить запись о доходе в «Финансы»?', 'Добавить')) {
    let list = DB.finLists.find(l => l.name === s.name);
    if (!list) { list = { id: uid(), name: s.name, obj: s.obj, created: nowISO() }; DB.finLists.unshift(list); }
    DB.finEntries.push({ id: uid(), list: list.id, type: 'in', sum: o.sum, date: o.date, desc: (o.full ? 'Полная оплата' : 'Аванс') + ' по смете' + (o.note ? ': ' + o.note : '') }); save(); toast('Добавлено в финансы');
  }
}
// при удалении платежа
function delPayment(s, p) { s.fin.payments = s.fin.payments.filter(x => x !== p); save(); render(); }

function smetaReports(main, s) {
  const c = smetaCalc(s);
  main.append(h('div', { class: 'hint', style: { margin: '6px 4px' } }, `Выполнено ${c.percent}% — категория нового отчёта: ${REPORT_CAT[c.percent <= 0 ? 0 : c.percent >= 100 ? 2 : 1]}`));
  if (!s.reports.length) main.append(h('div', { class: 'empty' }, 'Отчётов нет. Отчёт для заказчика состоит из комментария и фото.'));
  const l = h('div', { class: 'list' });
  s.reports.slice().reverse().forEach(r => {
    const li = h('div', { class: 'li', onclick: () => editReport(s, r) },
      r.photos && r.photos[0] ? h('img', { src: r.photos[0], style: { width: '54px', height: '54px', objectFit: 'cover', borderRadius: '5px' } }) : null,
      h('div', { class: 'main' }, h('div', { class: 't' }, r.cat + ' отчёт'), h('div', { class: 's' }, fdate(r.date, true) + ' · фото: ' + (r.photos || []).length + (r.comment ? ' · ' + r.comment.slice(0, 60) : ''))));
    onLong(li, () => menuBox('Отчёт', [{ text: 'Открыть', click: () => editReport(s, r) }, { text: 'Отправить / экспорт', click: () => reportExport(s, r) },
      { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить отчёт?', 'Удалить')) { s.reports = s.reports.filter(x => x !== r); save(); render(); } } }]));
    l.append(li);
  });
  main.append(l, h('button', { class: 'fab', title: 'Новый отчёт', onclick: () => editReport(s, null) }, '+'));
}
function editReport(s, r) {
  const isNew = !r; const c = smetaCalc(s);
  const rep = r ? clone(r) : { id: uid(), date: nowISO(), cat: REPORT_CAT[c.percent <= 0 ? 0 : c.percent >= 100 ? 2 : 1], comment: '', photos: [], percent: c.percent };
  const ta = h('textarea', { placeholder: 'Комментарий для заказчика' }, rep.comment);
  const grid = h('div', { class: 'photo-grid' });
  const drawPh = () => { grid.innerHTML = ''; rep.photos.forEach((p, i) => { const im = h('img', { src: p, title: 'Клик — просмотр, долгое нажатие — удалить', onclick: () => modal({ title: 'Фото', wide: true, body: h('img', { src: p, style: { width: '100%' } }) }) }); onLong(im, async () => { if (await confirmBox('Удалить фото?', 'Удалить')) { rep.photos.splice(i, 1); drawPh(); } }); grid.append(im); });
    grid.append(h('button', { class: 'btn', style: { width: '96px', height: '96px' }, onclick: async () => { const f = await pickFile('image/*'); if (!f) return; const d = await resizeImage(f, 1000, .7); if (d) { rep.photos.push(d); drawPh(); } } }, '+ Фото')); };
  drawPh();
  modal({ title: rep.cat + ' отчёт', wide: true, body: h('div', {}, h('div', { class: 'hint' }, fdate(rep.date, true) + ' · выполнено ' + rep.percent + '%'), ta, h('div', { class: 'fl mt' }, 'Фото'), grid), buttons: [
    !isNew ? { text: 'Экспорт', click: () => { reportExport(s, rep); return false; } } : null,
    { text: 'Отмена' }, { text: 'Сохранить', cls: 'pri', click: () => { rep.comment = ta.value; if (isNew) s.reports.push(rep); else Object.assign(r, rep); save(); render(); } }].filter(Boolean) });
}
function reportExport(s, r) {
  const txt = `${r.cat} ОТЧЁТ\n${s.name}\n${fdate(r.date, true)}\nВыполнено: ${r.percent}%\n\n${r.comment}`;
  const html = docHTML('Отчёт', `${S().logo ? `<img class="logo" src="${S().logo}">` : ''}<h1>${esc(r.cat)} ОТЧЁТ</h1><p><b>${esc(s.name)}</b><br>${esc(fdate(r.date, true))}<br>Выполнено работ: ${r.percent}%</p><pre>${esc(r.comment)}</pre>${(r.photos || []).map(p => `<img src="${p}" style="max-width:48%;margin:4px;border:1px solid #999">`).join('')}`);
  menuBox('Отчёт', [{ text: 'Отправить текст (поделиться)', click: () => shareText(txt, 'Отчёт') }, { text: 'PDF / печать с фото', click: () => { storeFile('Сметы', safeName(s.name + ' отчёт ' + fdate(r.date)) + '.html', 'pdf', html); printHTML(html); } }, { text: 'Скопировать текст', click: () => copyText(txt) }]);
}

/* ---------- экспорт сметы и акта ---------- */
async function smetaExport(s) {
  const r = await formBox('Экспорт: ' + s.name, [
    { k: 'doc', label: 'Документ', type: 'select', opts: [['smeta', 'Смета'], ['act', 'Акт выполненных работ'], ['list', 'Список (для закупки / бригады)']] },
    { k: 'part', label: 'Состав', type: 'select', opts: [['all', 'Работы и материалы'], ['job', 'Только работы'], ['mat', 'Только материалы']] },
    { k: 'fmt', label: 'Формат', type: 'select', opts: [['pdf', 'PDF (печать / сохранить как PDF)'], ['xls', 'Excel (xls)'], ['txt', 'Текст (txt)'], ['csv', 'CSV']] },
    { k: 'from', label: 'Акт: выполнено с (необязательно)', type: 'date' }, { k: 'to', label: 'Акт: выполнено по (необязательно)', type: 'date' },
    { k: 'prices', label: 'Список: показывать цены', type: 'check', value: false },
    { k: 'keep', label: 'Сохранить копию в разделе «Файлы»', type: 'check', value: true }
  ], 'Экспорт');
  if (!r) return;
  const docName = { smeta: 'Смета', act: 'Акт', list: 'Список' }[r.doc];
  const fname = safeName(docName + ' ' + s.name);
  const content = smetaDoc(s, r);
  const ext = r.fmt === 'pdf' ? 'html' : r.fmt;
  if (r.keep) storeFile('Сметы', fname + '.' + ext, r.fmt, content);
  if (r.fmt === 'pdf') printHTML(content); else download(fname + '.' + ext, (r.fmt === 'csv' || r.fmt === 'xls') ? '\ufeff' + content : content, MIME[r.fmt]);
}
function smetaDoc(s, o) {
  const kinds = o.part === 'all' ? ['job', 'mat'] : [o.part];
  const pick = it => o.doc !== 'act' || (it.done && (!o.from || (it.doneDate || '') >= o.from) && (!o.to || (it.doneDate || '') <= o.to));
  const showPrice = o.doc !== 'list' || o.prices;
  const blocks = kinds.map(kind => {
    const k = pnum(kind === 'job' ? s.fin.kJob : s.fin.kMat) || 1;
    const secs = sectionsOf(s, kind).map(sec => ({ sec, items: s.items.filter(i => i.kind === kind && i.sec === sec && pick(i)).map(i => ({ ...i, price: pnum(i.price) * k, sum: itemSum(i) * k })) })).filter(x => x.items.length);
    return { kind, secs, total: secs.reduce((a, x) => a + x.items.reduce((b, i) => b + i.sum, 0), 0) };
  }).filter(b => b.secs.length);
  const grand = blocks.reduce((a, b) => a + b.total, 0);
  const f = s.fin, tr = pnum(f.taxRate);
  const tax = f.tax === 1 ? grand * tr / (100 + tr) : f.tax ? grand * tr / 100 : 0;
  const total = f.tax === 2 ? grand + tax : grand;
  const c = smetaCalc(s);
  const title = { smeta: 'СМЕТА', act: 'АКТ ВЫПОЛНЕННЫХ РАБОТ', list: 'СПИСОК' }[o.doc];
  const cl = DB.clients.find(x => x.name === s.client), contr = S().contractor;
  const period = o.doc === 'act' && (o.from || o.to) ? `за период ${o.from ? 'с ' + fdate(o.from) : ''} ${o.to ? 'по ' + fdate(o.to) : ''}` : '';
  // общий список строк
  const lines = []; let n = 0;
  blocks.forEach(b => {
    lines.push({ t: 'kind', text: KIND_NAME[b.kind].toUpperCase() });
    b.secs.forEach(sc => { if (S().numeration === 'sec') n = 0; lines.push({ t: 'sec', text: sc.sec, sum: sc.items.reduce((a, i) => a + i.sum, 0) });
      sc.items.forEach(i => lines.push({ t: 'it', n: ++n, ...i })); });
    lines.push({ t: 'tot', text: 'Итого ' + KIND_NAME[b.kind].toLowerCase(), sum: b.total });
  });
  const foot = [];
  if (showPrice) {
    foot.push(['ВСЕГО', grand]);
    if (f.tax === 1) foot.push(['в т.ч. НДС ' + num(tr) + '%', tax]); if (f.tax === 2) foot.push(['НДС ' + num(tr) + '%', tax], ['ВСЕГО с НДС', total]); if (f.tax === 3) foot.push(['в т.ч. НПД ' + num(tr) + '%', tax]);
    if (o.doc === 'smeta' && c.paid) foot.push(['Оплачено', c.paid], ['К оплате', total - c.paid]);
    if (pnum(f.convRate) > 0) foot.push([`Всего в ${f.convCur}`, total / pnum(f.convRate), f.convCur]);
  }
  if (o.fmt === 'txt') {
    const out = [title + (period ? ' ' + period : ''), s.name, 'Дата: ' + fdate(s.date), contr.name ? 'Подрядчик: ' + contr.name + (contr.phone ? ', ' + contr.phone : '') : '', s.client ? 'Заказчик: ' + s.client : '', ''];
    lines.forEach(l => { if (l.t === 'kind') out.push('', '=== ' + l.text + ' ==='); else if (l.t === 'sec') out.push('', '-- ' + l.text + (showPrice ? ' (' + fin(l.sum) + ' ' + cur() + ')' : '') + ' --');
      else if (l.t === 'it') out.push(`${l.n}. ${l.name} — ${num(l.qty, 3)} ${l.unit}` + (showPrice ? ` × ${fin(l.price)} = ${fin(l.sum)} ${cur()}` : ''));
      else if (showPrice) out.push(`${l.text}: ${fin(l.sum)} ${cur()}`); });
    out.push(''); foot.forEach(([a, b, u]) => out.push(`${a}: ${fin(b)} ${u || cur()}`)); if (s.note) out.push('', 'Примечание: ' + s.note);
    return out.filter((x, i) => x !== '' || i > 5).join('\n');
  }
  if (o.fmt === 'csv') {
    const rows = [[title, s.name, fdate(s.date)], ['№', 'Наименование', 'Ед. изм.', 'Кол-во', ...(showPrice ? ['Цена', 'Сумма'] : [])]];
    lines.forEach(l => { if (l.t === 'it') rows.push([l.n, l.name, l.unit, num(l.qty, 3), ...(showPrice ? [fin(l.price), fin(l.sum)] : [])]); else rows.push(['', l.text, '', '', '', showPrice && l.sum !== undefined ? fin(l.sum) : '']); });
    foot.forEach(([a, b]) => rows.push(['', a, '', '', '', fin(b)]));
    return toCSV(rows);
  }
  const th = `<tr><th>№</th><th>Наименование</th><th>Ед. изм.</th><th>Кол-во</th>${showPrice ? `<th>Цена, ${esc(cur())}</th><th>Сумма, ${esc(cur())}</th>` : ''}</tr>`;
  const cols = showPrice ? 6 : 4;
  const body = lines.map(l => l.t === 'kind' ? `<tr class="sec"><td colspan="${cols}" style="text-align:center">${esc(l.text)}</td></tr>`
    : l.t === 'sec' ? `<tr class="sec"><td colspan="${showPrice ? 5 : 4}">${esc(l.text)}</td>${showPrice ? `<td class="n">${fin(l.sum)}</td>` : ''}</tr>`
      : l.t === 'it' ? `<tr><td class="n">${l.n}</td><td>${esc(l.name)}</td><td>${esc(l.unit)}</td><td class="n">${num(l.qty, 3)}</td>${showPrice ? `<td class="n">${fin(l.price)}</td><td class="n">${fin(l.sum)}</td>` : ''}</tr>`
        : showPrice ? `<tr class="tot"><td colspan="5">${esc(l.text)}</td><td class="n">${fin(l.sum)}</td></tr>` : '').join('');
  const footH = foot.map(([a, b, u]) => `<tr class="tot"><td colspan="5" class="right">${esc(a)}</td><td class="n">${fin(b)}${u ? ' ' + esc(u) : ''}</td></tr>`).join('');
  const table = `<table>${th}${body}${footH}</table>`;
  if (o.fmt === 'xls') return xlsHTML(title, `<table><tr><td colspan="6"><b>${title} ${esc(period)}</b></td></tr><tr><td colspan="6">${esc(s.name)} от ${fdate(s.date)}</td></tr>${contr.name ? `<tr><td colspan="6">Подрядчик: ${esc(contr.name)} ${esc(contr.phone)}</td></tr>` : ''}${s.client ? `<tr><td colspan="6">Заказчик: ${esc(s.client)}</td></tr>` : ''}</table>${table}`);
  const party = (lbl, p) => p && (p.name || p.phone) ? `<div><b>${lbl}:</b> ${esc(p.name)}${p.address ? '<br>' + esc(p.address) : ''}${p.phone || p.phone1 ? '<br>тел. ' + esc(p.phone || [p.phone1, p.phone2, p.phone3].filter(Boolean).join(', ')) : ''}${p.requisite ? '<br><span class="muted">' + esc(p.requisite).replace(/\n/g, '<br>') + '</span>' : ''}</div>` : '';
  return docHTML(title + ' ' + s.name, `<div class="hdr"><div>${S().logo ? `<img class="logo" src="${S().logo}">` : ''}${party('Подрядчик', contr)}</div><div class="right">${party('Заказчик', cl || (s.client ? { name: s.client } : null))}<div class="muted">Дата: ${fdate(s.date)}</div></div></div>
  <h1>${title}<br><small>${esc(s.name)}${period ? ' ' + esc(period) : ''}</small></h1>${table}
  ${showPrice ? `<p><b>Итого: ${fin(total)} ${esc(cur())}</b>${o.doc === 'act' ? ` (${esc(sumWords(total))})` : ''}</p>` : ''}
  ${s.note ? `<p><b>Примечание:</b> ${esc(s.note)}</p>` : ''}
  ${o.doc === 'act' ? '<p>Вышеперечисленные работы выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.</p><div class="sign"><div>Исполнитель ____________________</div><div>Заказчик ____________________</div></div>' : o.doc === 'smeta' ? '<div class="sign"><div>Составил ____________________</div><div>Согласовано ____________________</div></div>' : ''}`);
}
/** сумма прописью (рубли/копейки, для остальных валют — без единиц) */
function sumWords(v) {
  const r = Math.floor(v + 1e-6), k = Math.round((v - r) * 100);
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'], onesF = ['', 'одна', 'две'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hund = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const tri = (n, fem) => { const o = []; o.push(hund[Math.floor(n / 100)]); const t = n % 100; if (t >= 10 && t < 20) o.push(teens[t - 10]); else { o.push(tens[Math.floor(t / 10)]); const u = t % 10; o.push(fem && u < 3 ? onesF[u] : ones[u]); } return o.filter(Boolean).join(' '); };
  if (r === 0) return 'ноль ' + (cur() === 'р.' ? 'рублей' : cur());
  const parts = []; const groups = [['', '', '', false], ['тысяча', 'тысячи', 'тысяч', true], ['миллион', 'миллиона', 'миллионов', false], ['миллиард', 'миллиарда', 'миллиардов', false]];
  let n = r, gi = 0;
  while (n > 0 && gi < 4) { const g = n % 1000; if (g) parts.unshift(tri(g, groups[gi][3]) + (gi ? ' ' + plural(g, groups[gi][0], groups[gi][1], groups[gi][2]) : '')); n = Math.floor(n / 1000); gi++; }
  let s = parts.join(' ');
  if (cur() === 'р.') s += ' ' + plural(r, 'рубль', 'рубля', 'рублей') + ' ' + String(k).padStart(2, '0') + ' ' + plural(k, 'копейка', 'копейки', 'копеек');
  else s += ' ' + cur() + (k ? ' ' + String(k).padStart(2, '0') : '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ===================== ПРАЙС ===================== */
route('/price/:kind', kind => {
  if (!['job', 'mat'].includes(kind)) return go('/smetas');
  const key = kind === 'job' ? 'jobPrice' : 'matPrice';
  const title = kind === 'job' ? 'Прайс работ' : 'Прайс материалов';
  const main = screen({ title, actions: [{ icon: ICONS.more, title: 'Меню', click: () => menuBox(title, [
    { text: '+ Новая позиция', click: () => editPrice(kind, null) },
    { text: 'Экспорт прайса', click: () => exportDialog({ folder: 'Прайс', name: title, csv: () => toCSV(DB[key].map(p => [p.sec, p.name, p.unit, String(p.price).replace('.', ',')])),
      xls: () => xlsHTML(title, '<table><tr><th>Раздел</th><th>Наименование</th><th>Ед. изм.</th><th>Цена</th></tr>' + DB[key].map(p => `<tr><td>${esc(p.sec)}</td><td>${esc(p.name)}</td><td>${esc(p.unit)}</td><td class="n">${p.price}</td></tr>`).join('') + '</table>'),
      html: () => docHTML(title, `<h1>${title}</h1><table><tr><th>Наименование</th><th>Ед. изм.</th><th>Цена, ${esc(cur())}</th></tr>` + priceGroups(DB[key]).map(([sec, arr]) => `<tr class="sec"><td colspan="3">${esc(sec)}</td></tr>` + arr.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.unit)}</td><td class="n">${fin(p.price)}</td></tr>`).join('')).join('') + '</table>') }) },
    { text: 'Импорт из CSV (Раздел;Наименование;Ед.;Цена)', click: () => importPrice(kind) },
    { text: 'Изменить все цены на %', click: async () => { const r = await formBox('Изменить цены', [{ k: 'p', label: 'Процент (например 10 или -5)', req: true }]); if (!r) return; const k = 1 + pnum(r.p) / 100; DB[key].forEach(p => p.price = Math.round(p.price * k * 100) / 100); save(); render(); } },
    { text: 'Восстановить прайс по умолчанию', danger: true, click: async () => { if (await confirmBox('Заменить текущий прайс стандартным? Ваши изменения будут потеряны.', 'Заменить')) { DB[key] = (kind === 'job' ? JOB_PRICE : MAT_PRICE).map(r => ({ id: uid(), sec: r[0], name: r[1], unit: r[2], price: r[3] })); save(); render(); } } }]) }] });
  const q = h('input', { type: 'search', placeholder: 'Поиск…', value: CURRENT.query.q || '', oninput: () => draw() });
  const listEl = h('div');
  main.append(h('div', { class: 'toolbar' }, q, h('button', { class: 'btn', onclick: () => go('/price/' + (kind === 'job' ? 'mat' : 'job')) }, kind === 'job' ? 'Материалы →' : 'Работы →')), listEl,
    h('button', { class: 'fab', title: 'Новая позиция', onclick: () => editPrice(kind, null) }, '+'));
  function draw() {
    listEl.innerHTML = ''; const t = q.value.toLowerCase();
    const arr = DB[key].filter(p => !t || (p.name + ' ' + p.sec).toLowerCase().includes(t));
    if (!arr.length) { listEl.append(h('div', { class: 'empty' }, 'Нет позиций')); return; }
    priceGroups(arr).forEach(([sec, items]) => {
      const g = h('div', { class: 'grp', style: { cursor: 'pointer' }, title: 'Клик — переименовать раздел' }, h('span', {}, sec), h('span', {}, items.length));
      g.onclick = async () => { const n = await prompt2('Переименовать раздел', 'Название раздела', sec); if (n) { DB[key].forEach(p => { if (p.sec === sec) p.sec = n; }); save(); render(); } };
      listEl.append(g, h('div', { class: 'list' }, items.map(p => { const li = h('div', { class: 'li', style: { padding: '8px 12px' }, onclick: () => editPrice(kind, p) }, h('div', { class: 'main' }, h('div', {}, p.name)), h('div', { class: 'r' }, fin(p.price) + ' ' + cur() + ' / ' + p.unit));
        onLong(li, () => menuBox(p.name, [{ text: 'Редактировать', click: () => editPrice(kind, p) }, { text: 'Удалить', danger: true, click: () => { DB[key] = DB[key].filter(x => x !== p); save(); render(); } }])); return li; })));
    });
  }
  draw();
});
function priceGroups(arr) {
  const g = {}; arr.forEach(p => (g[p.sec] = g[p.sec] || []).push(p));
  const ent = Object.entries(g);
  if (S().sortPrice === 'text') { ent.sort((a, b) => a[0].localeCompare(b[0], 'ru')); ent.forEach(e => e[1] = e[1].slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'))); }
  return ent;
}
async function editPrice(kind, p) {
  const key = kind === 'job' ? 'jobPrice' : 'matPrice';
  const secs = [...new Set(DB[key].map(x => x.sec))];
  const r = await formBox(p ? 'Редактирование' : 'Новая позиция', [
    { k: 'sec', label: 'Раздел', value: p ? p.sec : (secs[0] || ''), req: true, list: 'dl_psec' },
    { k: 'name', label: 'Наименование', value: p ? p.name : '', req: true },
    { k: 'unit', label: 'Ед. изм.', value: p ? p.unit : 'м²', list: 'dl_punit' },
    { k: 'price', label: 'Цена, ' + cur(), value: p ? String(p.price).replace('.', ',') : '' }
  ], 'Сохранить');
  if (!r) return;
  const o = { sec: r.sec, name: r.name, unit: r.unit, price: pnum(r.price) };
  if (p) Object.assign(p, o); else DB[key].push({ id: uid(), ...o });
  save(); render();
}
document.addEventListener('DOMContentLoaded', () => {
  document.body.append(h('datalist', { id: 'dl_punit' }, UNITS.map(u => h('option', { value: u }))), h('datalist', { id: 'dl_psec' }));
});
// обновлять список разделов для формы прайса
document.addEventListener('focusin', e => { if (e.target.getAttribute && e.target.getAttribute('list') === 'dl_psec') { const dl = $('#dl_psec'); const k = CURRENT.path.includes('/mat') ? 'matPrice' : 'jobPrice'; dl.innerHTML = ''; [...new Set(DB[k].map(x => x.sec))].forEach(s => dl.append(h('option', { value: s }))); } });
async function importPrice(kind) {
  const key = kind === 'job' ? 'jobPrice' : 'matPrice';
  const f = await pickFile('.csv,.txt,text/csv'); if (!f) return;
  const rows = parseCSV(await readFileText(f)).filter(r => r.length >= 2 && r[1]);
  const items = rows.map(r => ({ id: uid(), sec: r[0] || 'Без раздела', name: r[1], unit: r[2] || 'шт.', price: pnum(r[3]) })).filter(x => !/^наименование$/i.test(x.name));
  if (!items.length) return toast('В файле нет позиций');
  menuBox(`Найдено позиций: ${items.length}`, [
    { text: 'Добавить к текущему прайсу (обновить совпадающие)', click: () => { items.forEach(it => { const ex = DB[key].find(p => p.name === it.name && p.sec === it.sec); if (ex) Object.assign(ex, { unit: it.unit, price: it.price }); else DB[key].push(it); }); save(); render(); toast('Импортировано'); } },
    { text: 'Заменить текущий прайс', danger: true, click: () => { DB[key] = items; save(); render(); toast('Прайс заменён'); } }
  ]);
}

/* ===================== ЗАКАЗЧИКИ ===================== */
route('/clients', () => {
  const main = screen({ title: 'Заказчики', backTo: '/smetas' });
  if (!DB.clients.length) main.append(h('div', { class: 'empty' }, 'База заказчиков пуста. Данные о заказчике отображаются в файлах экспорта смет.'));
  main.append(h('div', { class: 'list' }, DB.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(c => {
    const cnt = DB.smetas.filter(s => s.client === c.name).length;
    const li = h('div', { class: 'li', onclick: () => editClient(c) }, h('div', { class: 'main' }, h('div', { class: 't' }, c.name), h('div', { class: 's' }, [c.phone1, c.address].filter(Boolean).join(' · ') || '—')), h('span', { class: 'pill' }, 'смет: ' + cnt));
    onLong(li, () => menuBox(c.name, [{ text: 'Изменить', click: () => editClient(c) }, c.phone1 ? { text: 'Позвонить ' + c.phone1, click: () => location.href = 'tel:' + c.phone1 } : null,
      { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить заказчика?', 'Удалить')) { DB.clients = DB.clients.filter(x => x !== c); save(); render(); } } }]));
    return li;
  })), h('button', { class: 'fab', onclick: () => editClient() }, '+'));
});
async function editClient(c) {
  const r = await formBox(c ? 'Заказчик' : 'Новый заказчик', [
    { k: 'name', label: 'Имя / организация', value: c ? c.name : '', req: true },
    { k: 'phone1', label: 'Телефон 1', type: 'tel', value: c ? c.phone1 : '' }, { k: 'phone2', label: 'Телефон 2', type: 'tel', value: c ? c.phone2 : '' }, { k: 'phone3', label: 'Телефон 3', type: 'tel', value: c ? c.phone3 : '' },
    { k: 'address', label: 'Адрес', value: c ? c.address : '' }, { k: 'requisite', label: 'Реквизиты', type: 'textarea', value: c ? c.requisite : '' }, { k: 'note', label: 'Примечание', type: 'textarea', value: c ? c.note : '' }
  ], 'Сохранить');
  if (!r) return null;
  if (DB.clients.some(x => x !== c && x.name.toLowerCase() === r.name.toLowerCase())) { toast('Такой заказчик уже есть!'); return null; }
  if (c) { const old = c.name; Object.assign(c, r); if (old !== r.name) DB.smetas.forEach(s => { if (s.client === old) s.client = r.name; }); }
  else { c = { id: uid(), ...r }; DB.clients.push(c); }
  save(); if (CURRENT.path === '/clients') render(); return c;
}
