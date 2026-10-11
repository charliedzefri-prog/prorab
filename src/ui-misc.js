'use strict';
/* ===================== ГЛАВНЫЙ ЭКРАН ===================== */
route('/', () => {
  const T = (label, path, span) => h('div', { class: 'tile', style: { gridColumn: 'span ' + span }, onclick: () => go(path) }, label);
  const body = h('div', { class: 'tiles home' },
    T('Расчёты', '/calc', 3), T('Площадь', '/square', 3), T('Расход материалов', '/cons', 6),
    T('Объекты', '/objects', 2), T('Сметы', '/smetas', 2), T('Финансы', '/fin', 2), T('Заметки', '/notes', 3), T('Файлы', '/files', 3));
  screen({ title: 'ПРОраб pro', body });
  autoBackupTick();
});

/* ===================== РАСХОД МАТЕРИАЛОВ ===================== */
const consGroups = () => [...new Set(DB.consBase.map(m => m.group))];
const isLayer = unit => /сло/i.test(unit);
route('/cons', () => {
  const tab = CURRENT.query.tab || 'calc';
  const tabs = tabsBar([['calc', 'Расчёт'], ['lists', 'Списки'], ['base', 'База']], tab, k => go('/cons?tab=' + k));
  const main = screen({ title: 'Расход материалов', backTo: '/', tabs, actions: [{ icon: ICONS.help, title: 'Справка', click: () => modal({ title: 'Расход материалов', body: h('div', { class: 'help' }, h('p', {}, HELP.dis_help || 'Введите среднюю толщину слоя для смесей и штукатурок или количество слоёв для красок и грунтовок, затем введите площадь.')) }) }] });
  if (tab === 'calc') consCalc(main); else if (tab === 'lists') consListsView(main); else consBaseView(main);
});
const CONS_STATE = { g: 0, m: 0, t: '', a: '', pack: '', price: '' };
function consCalc(main) {
  const st = CONS_STATE, groups = consGroups();
  if (st.g >= groups.length) st.g = 0;
  const mats = DB.consBase.filter(m => m.group === groups[st.g]);
  if (st.m >= mats.length) st.m = 0;
  const m = mats[st.m];
  const res = h('div');
  const upd = () => {
    res.innerHTML = '';
    if (!m) return;
    const t = pnum(st.t), a = pnum(st.a);
    if (!t || !a) { res.append(h('div', { class: 'hint center', style: { padding: '12px' } }, 'Введите ' + (isLayer(m.unit) ? 'количество слоёв' : 'толщину слоя') + ' и площадь')); return; }
    const kg = m.rate * t * a, pack = pnum(st.pack), packs = pack ? Math.ceil(kg / pack - 1e-9) : 0;
    const rows = [['Расход на 1 м²', m.rate * t, 'кг'], ['Общий расход', kg, 'кг']];
    if (pack) rows.push(['Кол-во упаковок по ' + num(pack) + ' кг', packs, 'шт.']);
    if (pack && pnum(st.price)) rows.push(['=', 'Стоимость', money(packs * pnum(st.price))]);
    res.append(resultBlock({ rows }), h('div', { class: 'btns' },
      h('button', { class: 'btn pri', onclick: () => addToConsList({ name: m.name, group: m.group, unit: m.unit, rate: m.rate, t, a, kg, pack, packs, price: pnum(st.price) }) }, 'Добавить в список'),
      h('button', { class: 'btn', onclick: () => copyText(`${m.group}: ${m.name}\n${isLayer(m.unit) ? 'Слоёв' : 'Толщина'}: ${num(t)} ${isLayer(m.unit) ? '' : 'мм'}\nПлощадь: ${num(a)} м²\nРасход: ${num(kg)} кг` + (pack ? `\nУпаковок: ${packs} × ${num(pack)} кг` : '')) }, 'Копировать')));
  };
  const inp = (k, ph) => h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: st[k], placeholder: ph || '0', oninput: e => { st[k] = e.target.value; upd(); } });
  main.append(h('div', { class: 'card' },
    h('div', { class: 'row' }, h('label', {}, 'Вид материала'), h('div', { class: 'fld' }, h('select', { onchange: e => { st.g = +e.target.value; st.m = 0; render(); } }, groups.map((g, i) => h('option', { value: i, selected: i === st.g }, g))))),
    h('div', { class: 'row' }, h('label', {}, 'Материал'), h('div', { class: 'fld' }, h('select', { onchange: e => { st.m = +e.target.value; render(); } }, mats.map((x, i) => h('option', { value: i, selected: i === st.m }, x.name))))),
    m ? h('div', { class: 'hint' }, `Расход: ${num(m.rate, 3)} кг/м² на 1 ${isLayer(m.unit) ? 'слой' : 'мм толщины'}`) : null),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('label', {}, m && isLayer(m.unit) ? 'Кол-во слоёв' : 'Средняя толщина слоя'), h('div', { class: 'fld' }, inp('t'), h('span', { class: 'u' }, m && isLayer(m.unit) ? 'сл.' : 'мм'))),
      h('div', { class: 'row' }, h('label', {}, 'Площадь'), h('div', { class: 'fld' }, inp('a'), h('span', { class: 'u' }, 'м²'))),
      h('div', { class: 'row' }, h('label', {}, 'Кол-во в упаковке'), h('div', { class: 'fld' }, inp('pack', 'необяз.'), h('span', { class: 'u' }, 'кг'))),
      h('div', { class: 'row' }, h('label', {}, 'Цена за упаковку'), h('div', { class: 'fld' }, inp('price', 'необяз.'), h('span', { class: 'u' }, cur())))),
    res);
  upd();
}
async function addToConsList(item) {
  const r = await formBox('Добавить в список', [{ k: 'l', label: 'Список', type: 'select', opts: [...DB.consLists.map(l => [l.id, l.name]), ['+', '+ Новый список…']], value: DB.consLists[0] ? DB.consLists[0].id : '+' }], 'Добавить');
  if (!r) return;
  let list = DB.consLists.find(l => l.id === r.l);
  if (!list) { const n = await prompt2('Новый список', 'Название списка', 'Список ' + (DB.consLists.length + 1)); if (!n) return; list = { id: uid(), name: n, date: nowISO(), items: [] }; DB.consLists.unshift(list); }
  list.items.push({ id: uid(), ...item }); save(); toast('Добавлено в «' + list.name + '»');
}
function consListsView(main) {
  const id = CURRENT.query.l;
  const list = id && DB.consLists.find(l => l.id === id);
  if (list) {
    const txt = () => list.name + '\n\n' + list.items.map((i, n) => `${n + 1}. ${i.name} (${i.group}) — ${num(i.kg)} кг` + (i.pack ? `, ${i.packs} уп. × ${num(i.pack)} кг` : '') + (i.price ? `, ${money(i.packs * i.price)}` : '')).join('\n') + (total ? '\n\nИтого: ' + money(total) : '');
    const total = list.items.reduce((a, i) => a + (i.packs || 0) * (i.price || 0), 0);
    main.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn sm', onclick: () => go('/cons?tab=lists') }, '← Все списки'), h('b', { class: 'grow', style: { color: 'var(--accent)' } }, list.name),
      h('button', { class: 'btn sm', onclick: () => exportDialog({ folder: 'Расчёты', name: list.name, txt: txt(), html: () => docHTML(list.name, `<h1>${esc(list.name)}</h1><table><tr><th>№</th><th>Материал</th><th>Слой</th><th>Площадь, м²</th><th>Расход, кг</th><th>Упаковок</th><th>Сумма</th></tr>${list.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.name)}<br><small>${esc(i.group)}</small></td><td class="n">${num(i.t)} ${isLayer(i.unit) ? 'сл.' : 'мм'}</td><td class="n">${num(i.a)}</td><td class="n">${num(i.kg)}</td><td class="n">${i.pack ? i.packs + ' × ' + num(i.pack) + ' кг' : ''}</td><td class="n">${i.price ? fin(i.packs * i.price) : ''}</td></tr>`).join('')}</table>${total ? `<p><b>Итого: ${money(total)}</b></p>` : ''}`) }) }, 'Экспорт')));
    if (!list.items.length) main.append(h('div', { class: 'empty' }, 'Список пуст'));
    main.append(h('div', { class: 'list' }, list.items.map(i => h('div', { class: 'li' }, h('div', { class: 'main' }, h('div', { class: 't' }, i.name), h('div', { class: 's' }, `${i.group} · ${num(i.t)} ${isLayer(i.unit) ? 'сл.' : 'мм'} · ${num(i.a)} м²` + (i.pack ? ` · ${i.packs} уп. × ${num(i.pack)} кг` : ''))),
      h('div', { class: 'r' }, num(i.kg) + ' кг', i.price ? h('div', { class: 'hint' }, money(i.packs * i.price)) : null), h('button', { class: 'more', onclick: () => { list.items = list.items.filter(x => x !== i); save(); render(); } }, '✕')))));
    if (total) main.append(h('div', { class: 'totals' }, h('div', { class: 'big' }, h('span', {}, 'Итого'), h('b', {}, money(total)))));
    return;
  }
  if (!DB.consLists.length) main.append(h('div', { class: 'empty' }, 'Списков нет. Рассчитайте расход и нажмите «Добавить в список».'));
  main.append(h('div', { class: 'list' }, DB.consLists.map(l => { const li = h('div', { class: 'li', onclick: () => go('/cons?tab=lists&l=' + l.id) }, h('div', { class: 'main' }, h('div', { class: 't' }, l.name), h('div', { class: 's' }, fdate(l.date) + ' · позиций: ' + l.items.length)));
    onLong(li, () => menuBox(l.name, [{ text: 'Переименовать', click: async () => { const n = await prompt2('Переименовать', 'Название', l.name); if (n) { l.name = n; save(); render(); } } },
      { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить список?', 'Удалить')) { DB.consLists = DB.consLists.filter(x => x !== l); save(); render(); } } }])); return li; })));
}
function consBaseView(main) {
  const groups = consGroups();
  const g = CURRENT.query.g && groups.includes(CURRENT.query.g) ? CURRENT.query.g : groups[0];
  main.append(h('div', { class: 'toolbar' }, h('select', { style: { width: 'auto', flex: '1' }, onchange: e => go('/cons?tab=base&g=' + encodeURIComponent(e.target.value)) }, groups.map(x => h('option', { value: x, selected: x === g }, x))),
    h('button', { class: 'btn sm', onclick: () => menuBox('База материалов', [
      { text: 'Экспорт базы (CSV)', click: () => { const c = toCSV(DB.consBase.map(m => [m.group, m.unit, m.name, String(m.rate).replace('.', ',')])); storeFile('Прайс', 'База материалов.csv', 'csv', c); download('База материалов.csv', '\ufeff' + c, MIME.csv); } },
      { text: 'Импорт базы (CSV: Вид;слой|мм.;Название;Расход)', click: async () => { const f = await pickFile('.csv,.txt'); if (!f) return; const rows = parseCSV(await readFileText(f)).filter(r => r.length >= 4 && pnum(r[3]));
        if (!rows.length) return toast('В файле нет данных'); rows.forEach(r => { const ex = DB.consBase.find(m => m.group === r[0] && m.name === r[2]); if (ex) ex.rate = pnum(r[3]); else DB.consBase.push({ id: uid(), group: r[0], unit: r[1], name: r[2], rate: pnum(r[3]) }); }); save(); render(); toast('Импортировано: ' + rows.length); } },
      { text: 'Восстановить базу по умолчанию', danger: true, click: async () => { if (await confirmBox('Восстановить стандартную базу материалов?', 'Да')) { DB.consBase = CONS_BASE.map(r => ({ id: uid(), group: r[0], unit: r[1], name: r[2], rate: r[3] })); save(); render(); } } }]) }, '⋮')));
  let arr = DB.consBase.filter(m => m.group === g);
  if (S().sortPrice === 'text') arr = arr.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  main.append(h('div', { class: 'hint', style: { margin: '4px' } }, `Расход указан в кг/м² на ${arr[0] && isLayer(arr[0].unit) ? '1 слой' : '1 мм толщины'}. Клик — изменить.`),
    h('div', { class: 'list' }, arr.map(m => h('div', { class: 'li', style: { padding: '8px 12px' }, onclick: () => editConsMat(m, g) }, h('div', { class: 'main' }, m.name), h('div', { class: 'r' }, num(m.rate, 3))))),
    h('button', { class: 'fab', onclick: () => editConsMat(null, g) }, '+'));
}
async function editConsMat(m, g) {
  const r = await formBox(m ? 'Материал' : 'Новый материал', [
    { k: 'group', label: 'Вид материала', type: 'select', opts: consGroups(), value: m ? m.group : g },
    { k: 'name', label: 'Название', value: m ? m.name : '', req: true },
    { k: 'rate', label: 'Расход, кг/м² (на 1 мм или 1 слой)', value: m ? String(m.rate).replace('.', ',') : '', req: true },
    m ? { k: 'del', label: 'Удалить материал', type: 'check', value: false } : null
  ].filter(Boolean), 'Сохранить');
  if (!r) return;
  if (r.del) { DB.consBase = DB.consBase.filter(x => x !== m); save(); return render(); }
  const unit = (DB.consBase.find(x => x.group === r.group) || {}).unit || 'мм.';
  if (m) Object.assign(m, { group: r.group, name: r.name, rate: pnum(r.rate), unit }); else DB.consBase.push({ id: uid(), group: r.group, unit, name: r.name, rate: pnum(r.rate) });
  save(); render();
}

/* ===================== ОБЪЕКТЫ ===================== */
route('/objects', () => {
  const main = screen({ title: 'Объекты', backTo: '/', actions: [{ icon: ICONS.help, title: 'Справка', click: () => modal({ title: 'Объекты', body: h('div', { class: 'help' }, h('p', {}, HELP.object_help_start || 'В этом разделе создаются записи смет, расчётов, финансов и заметок по каждому объекту.')) }) }] });
  if (!DB.objects.length) main.append(h('div', { class: 'empty' }, 'Объектов нет. В объекте собираются сметы, расчёты, финансы и заметки по одному адресу.'));
  main.append(h('div', { class: 'list' }, DB.objects.map(o => {
    const sm = DB.smetas.filter(s => s.obj === o.id); const tot = sm.reduce((a, s) => a + smetaCalc(s).total, 0);
    const li = h('div', { class: 'li', onclick: () => go('/object/' + o.id) }, h('div', { class: 'main' }, h('div', { class: 't' }, o.name), h('div', { class: 's' }, [o.address, o.client, 'смет: ' + sm.length].filter(Boolean).join(' · '))), tot ? h('div', { class: 'r' }, money(tot)) : null);
    onLong(li, () => objectMenu(o)); return li;
  })), h('button', { class: 'fab', onclick: () => editObject() }, '+'));
});
async function editObject(o) {
  const r = await formBox(o ? 'Объект' : 'Новый объект', [
    { k: 'name', label: 'Название (уникальное)', value: o ? o.name : '', req: true },
    { k: 'address', label: 'Адрес', value: o ? o.address : '' },
    { k: 'client', label: 'Заказчик', type: 'select', opts: [['', '— не указан —'], ...DB.clients.map(c => [c.name, c.name])], value: o ? o.client : '' },
    { k: 'start', label: 'Дата начала', type: 'date', value: o ? o.start : today() },
    { k: 'note', label: 'Описание', type: 'textarea', value: o ? o.note : '' }
  ], 'Сохранить');
  if (!r) return;
  if (DB.objects.some(x => x !== o && x.name.toLowerCase() === r.name.toLowerCase())) return toast('Объект с таким названием уже существует!');
  if (o) Object.assign(o, r); else { o = { id: uid(), created: nowISO(), ...r }; DB.objects.unshift(o); }
  save(); render();
}
function objectMenu(o) {
  menuBox(o.name, [{ text: 'Открыть', click: () => go('/object/' + o.id) }, { text: 'Изменить', click: () => editObject(o) },
    { text: 'Удалить объект', danger: true, click: async () => {
      if (!await confirmBox(`Удалить объект «${o.name}»? Сметы, расчёты, финансы и заметки останутся в общих разделах.`, 'Удалить')) return;
      ['smetas', 'journal', 'finLists', 'notes'].forEach(k => DB[k].forEach(x => { if (x.obj === o.id) x.obj = null; }));
      DB.objects = DB.objects.filter(x => x !== o); save(); go('/objects'); } }]);
}
route('/object/:id', id => {
  const o = DB.objects.find(x => x.id === id); if (!o) return go('/objects');
  const tab = CURRENT.query.tab || 'smeta';
  const tabs = tabsBar([['smeta', 'Сметы'], ['calc', 'Расчёты'], ['fin', 'Финансы'], ['note', 'Заметки'], ['info', 'Инфо']], tab, k => { history.replaceState(null, '', `#/object/${id}?tab=${k}`); render(); });
  const main = screen({ title: o.name, sub: o.address || null, tabs, backTo: '/objects', actions: [{ icon: ICONS.more, title: 'Меню', click: () => objectMenu(o) }] });
  if (tab === 'smeta') {
    const arr = DB.smetas.filter(s => s.obj === id);
    if (!arr.length) main.append(h('div', { class: 'empty' }, 'Смет по объекту нет'));
    else { main.append(smetaList(arr)); const t = arr.reduce((a, s) => { const c = smetaCalc(s); a.t += c.total; a.p += c.paid; a.d += c.done; return a; }, { t: 0, p: 0, d: 0 });
      main.append(h('div', { class: 'totals' }, h('div', {}, h('span', {}, 'Сумма по сметам'), h('b', {}, money(t.t))), h('div', {}, h('span', {}, 'Выполнено'), h('span', {}, money(t.d))), h('div', {}, h('span', {}, 'Оплачено'), h('span', {}, money(t.p))), h('div', { class: 'big' }, h('span', {}, 'К оплате'), h('b', {}, money(t.t - t.p))))); }
    main.append(h('button', { class: 'fab', onclick: () => addSmeta(id) }, '+'));
  } else if (tab === 'calc') {
    main.append(journalList(null, id), h('button', { class: 'fab', title: 'Новый расчёт для объекта', onclick: () => pickCalcFor(id) }, '+'));
  } else if (tab === 'fin') {
    const arr = DB.finLists.filter(l => l.obj === id);
    if (!arr.length) main.append(h('div', { class: 'empty' }, 'Финансов по объекту нет')); else main.append(finListsEl(arr));
    main.append(h('button', { class: 'fab', onclick: () => editFinList(null, id) }, '+'));
  } else if (tab === 'note') {
    const arr = DB.notes.filter(n => n.obj === id);
    if (!arr.length) main.append(h('div', { class: 'empty' }, 'Заметок по объекту нет')); else main.append(notesEl(arr));
    main.append(h('button', { class: 'fab', onclick: () => newNote(id) }, '+'));
  } else {
    main.append(h('div', { class: 'card' }, h('div', { class: 'kv' }, ...kvRows([['Название', o.name], ['Адрес', o.address], ['Заказчик', o.client], ['Начало работ', o.start ? fdate(o.start) : ''], ['Создан', fdate(o.created)], ['Описание', o.note]])),
      h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: () => editObject(o) }, 'Изменить'))));
  }
});
function pickCalcFor(objId) {
  const ids = Object.keys(CALCS);
  const body = h('div', { class: 'menu-list', style: { maxHeight: '60vh', overflow: 'auto' } }, ids.map(cid => h('button', { onclick: () => { m.close(); go('/c/' + cid + '?obj=' + objId); } }, CALCS[cid].title)));
  const m = modal({ title: 'Выберите расчёт', body });
}

/* ===================== ФИНАНСЫ ===================== */
function finTotals(listId) {
  const e = DB.finEntries.filter(x => x.list === listId);
  const inc = e.filter(x => x.type === 'in').reduce((a, x) => a + pnum(x.sum), 0), exp = e.filter(x => x.type !== 'in').reduce((a, x) => a + pnum(x.sum), 0);
  return { inc, exp, bal: inc - exp, n: e.length };
}
route('/fin', () => {
  const main = screen({ title: 'Финансы', backTo: '/', actions: [{ icon: ICONS.help, title: 'Справка', click: () => modal({ title: 'Финансы', body: h('div', { class: 'help' }, h('p', {}, HELP.finance_help || 'Здесь можно контролировать ваши доходы и расходы. К примеру, вести отчёт по закупке материалов.')) }) }] });
  if (!DB.finLists.length) main.append(h('div', { class: 'empty' }, 'Здесь можно контролировать доходы и расходы — например, вести отчёт по закупке материалов. Нажмите «+», чтобы создать список.'));
  else {
    main.append(finListsEl(DB.finLists));
    const all = DB.finLists.reduce((a, l) => { const t = finTotals(l.id); a.i += t.inc; a.e += t.exp; return a; }, { i: 0, e: 0 });
    main.append(h('div', { class: 'totals' }, h('div', {}, h('span', {}, 'Доходы всего'), h('b', { style: { color: 'var(--ok)' } }, money(all.i))), h('div', {}, h('span', {}, 'Расходы всего'), h('b', { style: { color: 'var(--danger)' } }, money(all.e))), h('div', { class: 'big' }, h('span', {}, 'Баланс'), h('b', {}, money(all.i - all.e)))));
  }
  main.append(h('button', { class: 'fab', onclick: () => editFinList() }, '+'));
});
function finListsEl(arr) {
  return h('div', { class: 'list' }, arr.map(l => { const t = finTotals(l.id); const obj = l.obj && DB.objects.find(o => o.id === l.obj);
    const li = h('div', { class: 'li', onclick: () => go('/fin/' + l.id) }, h('div', { class: 'main' }, h('div', { class: 't' }, l.name), h('div', { class: 's' }, `записей: ${t.n}` + (obj ? ' · ' + obj.name : '') + ` · +${fin(t.inc)} / −${fin(t.exp)}`)), h('div', { class: 'r', style: { color: t.bal < 0 ? 'var(--danger)' : 'var(--ok)' } }, money(t.bal)));
    onLong(li, () => menuBox(l.name, [{ text: 'Изменить', click: () => editFinList(l) }, { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить список со всеми записями?', 'Удалить')) { DB.finLists = DB.finLists.filter(x => x !== l); DB.finEntries = DB.finEntries.filter(x => x.list !== l.id); save(); render(); } } }])); return li; }));
}
async function editFinList(l, objId) {
  const r = await formBox(l ? 'Список' : 'Новый список', [{ k: 'name', label: 'Название', value: l ? l.name : '', req: true, ph: 'Например: Закупка материалов' },
    { k: 'obj', label: 'Объект', type: 'select', opts: [['', '— без объекта —'], ...DB.objects.map(o => [o.id, o.name])], value: l ? l.obj || '' : objId || '' }], 'Сохранить');
  if (!r) return;
  if (l) Object.assign(l, { name: r.name, obj: r.obj || null }); else { l = { id: uid(), name: r.name, obj: r.obj || null, created: nowISO() }; DB.finLists.unshift(l); save(); return go('/fin/' + l.id); }
  save(); render();
}
route('/fin/:id', id => {
  const l = DB.finLists.find(x => x.id === id); if (!l) return go('/fin');
  const flt = CURRENT.query.f || 'all';
  const tabs = tabsBar([['all', 'Все'], ['in', 'Доходы'], ['out', 'Расходы']], flt, k => { history.replaceState(null, '', `#/fin/${id}?f=${k}`); render(); });
  const main = screen({ title: l.name, sub: 'Финансы', tabs, backTo: '/fin', actions: [{ icon: ICONS.share, title: 'Отчёт', click: () => finExport(l) }] });
  const t = finTotals(id);
  main.append(h('div', { class: 'totals' }, h('div', {}, h('span', {}, 'Доходы'), h('b', { style: { color: 'var(--ok)' } }, money(t.inc))), h('div', {}, h('span', {}, 'Расходы'), h('b', { style: { color: 'var(--danger)' } }, money(t.exp))), h('div', { class: 'big' }, h('span', {}, 'Баланс'), h('b', {}, money(t.bal)))));
  const arr = DB.finEntries.filter(e => e.list === id && (flt === 'all' || (flt === 'in' ? e.type === 'in' : e.type !== 'in'))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!arr.length) main.append(h('div', { class: 'empty' }, 'Записей нет'));
  main.append(h('div', { class: 'list' }, arr.map(e => { const li = h('div', { class: 'li', onclick: () => editFinEntry(l, e) }, h('div', { class: 'main' }, h('div', { class: 't' }, e.desc || (e.type === 'in' ? 'Доход' : 'Расход')), h('div', { class: 's' }, fdate(e.date))),
    h('div', { class: 'r', style: { color: e.type === 'in' ? 'var(--ok)' : 'var(--danger)' } }, (e.type === 'in' ? '+' : '−') + money(e.sum)));
    onLong(li, () => menuBox('Запись', [{ text: 'Изменить', click: () => editFinEntry(l, e) }, { text: 'Дублировать', click: () => { DB.finEntries.push({ ...e, id: uid(), date: today() }); save(); render(); } },
      { text: 'Переместить в другой список', click: async () => { const others = DB.finLists.filter(x => x !== l); if (!others.length) return toast('Нет других списков'); const r = await formBox('Переместить', [{ k: 'l', label: 'Список', type: 'select', opts: others.map(x => [x.id, x.name]) }]); if (r) { e.list = r.l; save(); render(); } } },
      { text: 'Удалить', danger: true, click: () => { DB.finEntries = DB.finEntries.filter(x => x !== e); save(); render(); } }])); return li; })),
    h('div', { class: 'btns', style: { justifyContent: 'center', marginBottom: '80px' } }, h('button', { class: 'btn', style: { color: 'var(--ok)' }, onclick: () => editFinEntry(l, null, 'in') }, '+ Доход'), h('button', { class: 'btn', style: { color: 'var(--danger)' }, onclick: () => editFinEntry(l, null, 'out') }, '− Расход')),
    h('button', { class: 'fab', onclick: () => editFinEntry(l, null, 'out') }, '+'));
});
async function editFinEntry(l, e, type) {
  const r = await formBox(e ? 'Запись' : (type === 'in' ? 'Новый доход' : 'Новый расход'), [
    { k: 'type', label: 'Тип', type: 'select', opts: [['out', 'Расход'], ['in', 'Доход']], value: e ? e.type : type },
    { k: 'sum', label: 'Сумма, ' + cur(), value: e ? String(e.sum).replace('.', ',') : '', req: true },
    { k: 'date', label: 'Дата', type: 'date', value: e ? e.date : today() },
    { k: 'desc', label: 'Описание', value: e ? e.desc : '', ph: 'Например: Штукатурка 10 мешков' }
  ], 'Сохранить');
  if (!r) return;
  const o = { type: r.type, sum: pnum(r.sum), date: r.date || today(), desc: r.desc };
  if (e) Object.assign(e, o); else DB.finEntries.push({ id: uid(), list: l.id, ...o });
  save(); render();
}
async function finExport(l) {
  const r = await formBox('Отчёт: ' + l.name, [{ k: 'from', label: 'С даты (необязательно)', type: 'date' }, { k: 'to', label: 'По дату (необязательно)', type: 'date' }], 'Далее');
  if (!r) return;
  const arr = DB.finEntries.filter(e => e.list === l.id && (!r.from || e.date >= r.from) && (!r.to || e.date <= r.to)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const inc = arr.filter(e => e.type === 'in').reduce((a, e) => a + e.sum, 0), exp = arr.filter(e => e.type !== 'in').reduce((a, e) => a + e.sum, 0);
  const period = (r.from ? 'с ' + fdate(r.from) + ' ' : '') + (r.to ? 'по ' + fdate(r.to) : '');
  exportDialog({ folder: 'Финансы', name: l.name + ' отчёт',
    txt: `${l.name}${period ? ' (' + period + ')' : ''}\n\n` + arr.map(e => `${fdate(e.date)}  ${e.type === 'in' ? '+' : '−'}${fin(e.sum)}  ${e.desc || ''}`).join('\n') + `\n\nДоходы: ${money(inc)}\nРасходы: ${money(exp)}\nБаланс: ${money(inc - exp)}`,
    html: () => docHTML(l.name, `<h1>${esc(l.name)}<br><small>${esc(period)}</small></h1><table><tr><th>Дата</th><th>Описание</th><th>Доход</th><th>Расход</th></tr>${arr.map(e => `<tr><td>${fdate(e.date)}</td><td>${esc(e.desc)}</td><td class="n">${e.type === 'in' ? fin(e.sum) : ''}</td><td class="n">${e.type !== 'in' ? fin(e.sum) : ''}</td></tr>`).join('')}<tr class="tot"><td colspan="2">Итого</td><td class="n">${fin(inc)}</td><td class="n">${fin(exp)}</td></tr><tr class="tot"><td colspan="2">Баланс</td><td class="n" colspan="2">${money(inc - exp)}</td></tr></table>`),
    xls: () => xlsHTML(l.name, `<table><tr><th>Дата</th><th>Описание</th><th>Доход</th><th>Расход</th></tr>${arr.map(e => `<tr><td>${fdate(e.date)}</td><td>${esc(e.desc)}</td><td class="n">${e.type === 'in' ? e.sum : ''}</td><td class="n">${e.type !== 'in' ? e.sum : ''}</td></tr>`).join('')}<tr><td></td><td><b>Итого</b></td><td class="n">${inc}</td><td class="n">${exp}</td></tr></table>`),
    csv: () => toCSV([['Дата', 'Описание', 'Тип', 'Сумма'], ...arr.map(e => [fdate(e.date), e.desc, e.type === 'in' ? 'Доход' : 'Расход', String(e.sum).replace('.', ',')])]) });
}

/* ===================== ЗАМЕТКИ ===================== */
route('/notes', () => {
  const main = screen({ title: 'Заметки', backTo: '/' });
  const q = h('input', { type: 'search', placeholder: 'Поиск…', oninput: () => { box.innerHTML = ''; box.append(notesEl(DB.notes.filter(n => (n.title + ' ' + n.text).toLowerCase().includes(q.value.toLowerCase())))); } });
  const box = h('div');
  if (DB.notes.length) main.append(h('div', { class: 'toolbar' }, q));
  if (!DB.notes.length) main.append(h('div', { class: 'empty' }, 'Заметок нет'));
  box.append(notesEl(DB.notes)); main.append(box, h('button', { class: 'fab', onclick: () => newNote() }, '+'));
});
function notesEl(arr) {
  return h('div', { class: 'list' }, arr.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(n => { const obj = n.obj && DB.objects.find(o => o.id === n.obj);
    const li = h('div', { class: 'li', onclick: () => go('/note/' + n.id) }, h('div', { class: 'main' }, h('div', { class: 't' }, n.title || (n.text || '').split('\n')[0].slice(0, 60) || 'Без названия'), h('div', { class: 's' }, fdate(n.date, true) + (obj ? ' · ' + obj.name : '') + ' · ' + (n.text || '').replace(/\n/g, ' ').slice(0, 80))));
    onLong(li, () => menuBox(n.title || 'Заметка', [{ text: 'Открыть', click: () => go('/note/' + n.id) }, { text: 'Поделиться', click: () => shareText((n.title ? n.title + '\n\n' : '') + n.text, n.title) },
      { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить заметку?', 'Удалить')) { DB.notes = DB.notes.filter(x => x !== n); save(); render(); } } }])); return li; }));
}
function newNote(obj) { const n = { id: uid(), title: '', text: '', date: nowISO(), obj: obj || null }; DB.notes.unshift(n); save(); go('/note/' + n.id); }
route('/note/:id', id => {
  const n = DB.notes.find(x => x.id === id); if (!n) return go('/notes');
  const main = screen({ title: n.title || 'Заметка', backTo: n.obj ? '/object/' + n.obj + '?tab=note' : '/notes', actions: [{ icon: ICONS.share, title: 'Поделиться / экспорт', click: () => menuBox('Заметка', [
    { text: 'Поделиться', click: () => shareText((n.title ? n.title + '\n\n' : '') + n.text, n.title) },
    { text: 'Сохранить файлом', click: () => exportDialog({ folder: 'Заметки', name: n.title || 'Заметка', txt: (n.title ? n.title + '\n\n' : '') + n.text, html: () => docHTML(n.title, `<h1>${esc(n.title)}</h1><pre>${esc(n.text)}</pre>`) }) },
    { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить заметку?', 'Удалить')) { DB.notes = DB.notes.filter(x => x !== n); save(); go('/notes'); } } }]) }] });
  const t = h('input', { type: 'text', value: n.title, placeholder: 'Заголовок', style: { fontSize: '19px', marginBottom: '8px' }, oninput: e => { n.title = e.target.value; n.date = nowISO(); save(); } });
  const ta = h('textarea', { placeholder: 'Текст заметки…', style: { minHeight: '55vh' }, oninput: e => { n.text = e.target.value; n.date = nowISO(); save(); } }, n.text);
  const objSel = h('select', { onchange: e => { n.obj = e.target.value || null; save(); } }, h('option', { value: '' }, '— без объекта —'), DB.objects.map(o => h('option', { value: o.id, selected: o.id === n.obj }, o.name)));
  main.append(h('div', { class: 'card' }, t, ta, h('div', { class: 'row' }, h('label', {}, 'Объект'), h('div', { class: 'fld' }, objSel)), h('div', { class: 'hint' }, 'Сохраняется автоматически.')));
  if (!n.text && !n.title) setTimeout(() => t.focus(), 50);
});

/* ===================== ФАЙЛЫ ===================== */
const FOLDERS = ['Расчёты', 'Сметы', 'Прайс', 'Финансы', 'Заметки', 'Бэкап'];
route('/files', () => {
  const fld = CURRENT.query.f;
  const main = screen({ title: fld ? fld : 'Файлы', sub: fld ? 'Файлы' : null, backTo: fld ? '/files' : '/' });
  if (!fld) {
    main.append(h('div', { class: 'hint', style: { margin: '6px 4px 10px' } }, 'Здесь хранятся копии всех экспортированных файлов (расчёты, сметы, акты, прайсы, отчёты, бэкапы). Их можно повторно скачать, распечатать или удалить.'),
      h('div', { class: 'tiles g2' }, FOLDERS.map(f => { const n = DB.files.filter(x => x.folder === f).length; return h('div', { class: 'tile sm', onclick: () => go('/files?f=' + encodeURIComponent(f)) }, '📁 ' + f, h('span', { class: 'sub' }, n + ' ' + plural(n, 'файл', 'файла', 'файлов'))); })));
    const size = DB.files.reduce((a, f) => a + (f.size || 0), 0);
    main.append(h('p', { class: 'hint center mt' }, `Занято файлами: ${num(size / 1024, 0)} КБ`));
    return;
  }
  const arr = DB.files.filter(x => x.folder === fld);
  if (!arr.length) main.append(h('div', { class: 'empty' }, 'Папка пуста'));
  main.append(h('div', { class: 'list' }, arr.map(f => { const li = h('div', { class: 'li', onclick: () => fileMenu(f) }, h('div', { class: 'main' }, h('div', { class: 't' }, f.name), h('div', { class: 's' }, fdate(f.date, true) + ' · ' + num((f.size || 0) / 1024, 1) + ' КБ · ' + (f.type === 'pdf' ? 'PDF (печать)' : f.type.toUpperCase()))));
    onLong(li, () => fileMenu(f)); return li; })));
  if (arr.length) main.append(h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Удалить все файлы в папке «' + fld + '»?', 'Удалить')) { DB.files = DB.files.filter(x => x.folder !== fld); save(); render(); } } }, 'Очистить папку')));
});
function fileMenu(f) {
  menuBox(f.name, [
    f.type === 'pdf' || f.type === 'html' ? { text: 'Печать / сохранить как PDF', click: () => printHTML(f.content) } : null,
    f.type === 'pdf' || f.type === 'html' ? { text: 'Просмотр', click: () => { const fr = h('iframe', { style: { width: '100%', height: '70vh', background: '#fff', border: '0' } }); modal({ title: f.name, wide: true, body: fr }); fr.srcdoc = f.content; } } : null,
    f.type === 'txt' ? { text: 'Просмотр', click: () => modal({ title: f.name, wide: true, body: h('pre', { style: { whiteSpace: 'pre-wrap' } }, f.content) }) } : null,
    { text: 'Скачать', click: () => download(f.name, (f.type === 'csv' || f.type === 'xls') ? '\ufeff' + f.content : f.content, MIME[f.type] || MIME.txt) },
    f.type === 'txt' ? { text: 'Поделиться текстом', click: () => shareText(f.content, f.name) } : null,
    f.folder === 'Бэкап' ? { text: 'Восстановить из этого бэкапа', click: () => restoreBackup(f.content) } : null,
    { text: 'Переименовать', click: async () => { const n = await prompt2('Переименовать', 'Имя файла', f.name); if (n) { f.name = safeName(n); save(); render(); } } },
    { text: 'Удалить', danger: true, click: () => { DB.files = DB.files.filter(x => x !== f); save(); render(); } }
  ]);
}

/* ===================== НАСТРОЙКИ, БЭКАП ===================== */
const CURRENCIES = ['р.', 'BYN', '₽', '$', '€', 'у.е.', 'тнг.', 'грн.', 'сом', 'сум', 'лари', 'zł'];
function applyTheme() { document.body.classList.toggle('dark', S().theme === 'dark'); }
function backupData() { const d = clone(DB); d.files = d.files.filter(f => f.folder !== 'Бэкап'); return JSON.stringify({ app: 'prorab_pro_web', date: nowISO(), db: d }); }
function makeBackup(dl = true) {
  const name = 'PROrab_backup_' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.json';
  const data = backupData(); S().lastBackup = nowISO();
  DB.files = DB.files.filter(f => f.folder !== 'Бэкап' || DB.files.filter(x => x.folder === 'Бэкап').indexOf(f) < 2); // хранить 3 последних
  storeFile('Бэкап', name, 'json', data);
  if (dl) download(name, data, MIME.json);
  toast('Резервная копия создана');
}
async function restoreBackup(text) {
  try {
    const d = JSON.parse(text); const db = d.db || d;
    if (!db.settings || !Array.isArray(db.smetas)) throw 0;
    if (!await confirmBox('Восстановить данные из резервной копии? Текущие данные будут заменены.', 'Восстановить')) return;
    const keepBk = DB.files.filter(f => f.folder === 'Бэкап');
    DB = db; const f = freshDB(); for (const k in f) if (DB[k] === undefined) DB[k] = f[k];
    DB.settings = Object.assign(clone(DEFAULT_SETTINGS), DB.settings);
    DB.files = [...DB.files.filter(x => x.folder !== 'Бэкап'), ...keepBk];
    save(); applyTheme(); toast('Данные восстановлены'); go('/');
  } catch (e) { toast('Неверный файл резервной копии!'); }
}
function autoBackupTick() {
  if (!S().autoBackup || !STORAGE_OK) return;
  const last = S().lastBackup ? new Date(S().lastBackup) : null;
  if (last && Date.now() - last < 24 * 3600e3) return;
  const has = DB.smetas.length || DB.journal.length || DB.notes.length || DB.finEntries.length;
  if (has) { try { makeBackup(false); } catch (e) { } }
}
route('/settings', () => {
  const s = S(), main = screen({ title: 'Настройки', backTo: '/' });
  const sel = (label, key, opts, after) => h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'fld' }, h('select', { onchange: e => { s[key] = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value; save(); after && after(); } }, opts.map(([v, l]) => h('option', { value: String(v), selected: String(s[key]) === String(v) }, l)))));
  const curSel = h('select', { onchange: async e => { if (e.target.value === '+') { const c = await prompt2('Своя валюта', 'Обозначение', ''); if (c) s.currency = c; } else s.currency = e.target.value; save(); render(); } },
    [...new Set([...CURRENCIES, s.currency])].map(c => h('option', { value: c, selected: c === s.currency }, c)), h('option', { value: '+' }, 'Своя…'));
  const ct = s.contractor;
  const ci = (k, ph, ta) => ta ? h('textarea', { placeholder: ph, style: { minHeight: '70px' }, oninput: e => { ct[k] = e.target.value; save(); } }, ct[k]) : h('input', { type: 'text', placeholder: ph, value: ct[k], oninput: e => { ct[k] = e.target.value; save(); } });
  main.append(
    h('div', { class: 'card' }, h('h3', {}, 'Общие'),
      sel('Оформление', 'theme', [['indigo', 'Индиго (как в приложении)'], ['dark', 'Тёмная']], applyTheme),
      h('div', { class: 'row' }, h('label', {}, 'Валюта'), h('div', { class: 'fld' }, curSel)),
      sel('Счётчики на кнопках расчётов', 'calcBadges', [[true, 'Показывать'], [false, 'Скрыть']])),
    h('div', { class: 'card' }, h('h3', {}, 'Сметы'),
      sel('Единица процентовки', 'ratioUnit', [['ratio', 'Коэффициент'], ['percent', 'Процент']]),
      sel('Нумерация в смете', 'numeration', [['list', 'Общая'], ['sec', 'По разделам']]),
      sel('Сортировка смет', 'sortSmeta', [['date', 'По дате'], ['client', 'По заказчикам']]),
      sel('Сортировка прайса и базы', 'sortPrice', [['text', 'По алфавиту'], ['add', 'По добавлению']]),
      sel('Дата в отметке «Выполнено»', 'showDoneDate', [[true, 'Показывать'], [false, 'Скрыть']])),
    h('div', { class: 'card' }, h('h3', {}, 'Подрядчик (для файлов экспорта)'),
      ci('name', 'Имя / организация'), h('div', { style: { height: '6px' } }), ci('address', 'Адрес'), h('div', { style: { height: '6px' } }), ci('phone', 'Телефон'), h('div', { style: { height: '6px' } }), ci('requisite', 'Реквизиты (УНП/ИНН, р/с, банк…)', true),
      h('div', { class: 'row' }, h('label', {}, 'Логотип'), h('div', { class: 'fld' }, s.logo ? h('img', { src: s.logo, style: { maxHeight: '50px', background: '#fff', borderRadius: '4px', padding: '2px' } }) : h('span', { class: 'hint' }, 'не задан'),
        h('button', { class: 'btn sm', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; s.logo = await resizeImage(f, 400, .85); save(); render(); } }, 'Выбрать'),
        s.logo ? h('button', { class: 'btn sm danger', onclick: () => { s.logo = ''; save(); render(); } }, 'Удалить') : null))),
    h('div', { class: 'card' }, h('h3', {}, 'Резервная копия'),
      h('div', { class: 'hint' }, 'Все данные хранятся в этом браузере. Сохраните резервную копию в файл, чтобы перенести данные на другое устройство или восстановить их. ' + (s.lastBackup ? 'Последняя копия: ' + fdate(s.lastBackup, true) + '.' : '')),
      h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: () => makeBackup(true) }, 'Сохранить бэкап'),
        h('button', { class: 'btn', onclick: async () => { const f = await pickFile('.json,application/json'); if (f) restoreBackup(await readFileText(f)); } }, 'Восстановить из файла'),
        h('button', { class: 'btn', onclick: () => go('/files?f=' + encodeURIComponent('Бэкап')) }, 'Локальные копии')),
      sel('Автоматический локальный бэкап (раз в сутки)', 'autoBackup', [[true, 'Включён'], [false, 'Выключен']])),
    h('div', { class: 'card' }, h('h3', {}, 'Данные'),
      h('div', { class: 'hint' }, `Смет: ${DB.smetas.length}, расчётов в журнале: ${DB.journal.length}, объектов: ${DB.objects.length}, заметок: ${DB.notes.length}, файлов: ${DB.files.length}. Объём: ${num(JSON.stringify(DB).length / 1024, 0)} КБ.`),
      h('div', { class: 'btns' }, h('button', { class: 'btn danger', onclick: async () => {
        if (!await confirmBox('Удалить ВСЕ данные приложения (сметы, расчёты, объекты, финансы, заметки, файлы, прайсы)? Рекомендуем сначала сохранить бэкап.', 'Удалить всё')) return;
        DB = freshDB(); save(); applyTheme(); toast('Данные сброшены'); go('/'); } }, 'Сбросить все данные'))),
    h('div', { class: 'card' }, h('h3', {}, 'О приложении'),
      h('div', { class: 'flex' }, IMG.icon ? h('img', { src: IMG.icon, style: { width: '56px', height: '56px', borderRadius: '10px' } }) : null,
        h('div', {}, h('b', { style: { color: 'var(--accent)', fontSize: '19px', fontStyle: 'italic' } }, 'ПРОраб pro — веб-версия'), h('div', { class: 'hint' }, 'Строительные расчёты, сметы, объекты, финансы и заметки для строителей. Версия 1.0 (web).'))),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => go('/help') }, 'Справка'))));
});

/* ===================== СПРАВКА ===================== */
route('/help', () => {
  const sec = CURRENT.query.s;
  const P = (title, text) => text ? [h('h3', {}, title), h('p', {}, text)] : [];
  const body = h('div', { class: 'help card' },
    ...P('Расчёты', HELP.help_text1 || ''), ...P('Площадь', HELP.help_text2 || ''),
    ...P('Калькулятор', HELP.help_text_calc || 'Все вычисления сохраняются в истории. Клик по пункту в истории помещает значение в поле ввода калькулятора. Долгое нажатие на пункт удаляет его из истории. Долгое нажатие кнопки «C» очищает всю историю.\nКлик по полю результата копирует значение. Скопированное значение можно вставить в любое пустое числовое поле приложения — просто кликните по нему. Вставка выполняется один раз.'),
    ...P('Расход материалов', HELP.dis_help || 'Введите среднюю толщину слоя для смесей и штукатурок или количество слоёв для красок и грунтовок, затем введите площадь.'),
    ...P('Объекты', HELP.object_help_start), ...P('Сметы', HELP.smeta_help_start), ...P('Детали сметы', HELP.smeta_help_details),
    ...P('Прайс', HELP.smeta_help_price), ...P('Заказчики', HELP.smeta_help_clients), ...P('Настройки смет', HELP.smeta_help_prefs),
    ...P('Финансы', HELP.finance_help),
    ...P('Бэкап', 'Все данные веб-версии хранятся в памяти браузера (localStorage). В настройках можно сохранить резервную копию в файл .json и восстановить её на любом устройстве. Автоматический локальный бэкап делается раз в сутки и хранится в разделе «Файлы → Бэкап».'),
    ...P('Файлы', 'Каждый экспорт (PDF, XLS, TXT, CSV) сохраняет копию в разделе «Файлы» в соответствующей папке. PDF создаётся через системный диалог печати — выберите «Сохранить как PDF».'));
  screen({ title: 'Справка', body });
  if (sec) setTimeout(() => { const el = [...$$('.help h3')].find(x => x.textContent.toLowerCase().startsWith(sec === 'smeta' ? 'сметы' : sec)); el && el.scrollIntoView(); }, 50);
});

/* ===================== КАЛЬКУЛЯТОР ===================== */
function evalExpr(src) {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s/g, '');
  let i = 0;
  const peek = () => s[i];
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const t = term(); v = op === '+' ? v + t : v - t; } return v; }
  function term() { let v = factor(); while (peek() === '*' || peek() === '/') { const op = s[i++]; const f = factor(); if (op === '/' && f === 0) throw new Error('div0'); v = op === '*' ? v * f : v / f; } return v; }
  function factor() {
    if (peek() === '-') { i++; return -factor(); } if (peek() === '+') { i++; return factor(); }
    let v;
    if (peek() === '√') { i++; v = Math.sqrt(factor()); }
    else if (peek() === '(') { i++; v = expr(); if (peek() === ')') i++; }
    else { const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?|^\d+\./); if (!m) throw new Error('syntax'); i += m[0].length; v = parseFloat(m[0]); }
    while (peek() === '%' || peek() === '²') { v = s[i] === '%' ? v / 100 : v * v; i++; }
    return v;
  }
  const v = expr(); if (i < s.length) throw new Error('syntax');
  return v;
}
function openCalculator() {
  let expr = '', result = null;
  const exEl = h('div', { class: 'expr' }), resEl = h('div', { class: 'res' }, '0'), hist = h('div', { class: 'hist' });
  const fmt = v => { const r = Math.round(v * 1e10) / 1e10; return String(r).replace('.', ','); };
  const live = () => { exEl.textContent = expr || ' '; try { if (expr) { const v = evalExpr(expr); if (isFinite(v)) resEl.textContent = fmt(v); } else resEl.textContent = '0'; } catch (e) { } };
  const drawHist = () => { hist.innerHTML = ''; DB.calcHistory.forEach((hh, idx) => { const d = h('div', { title: 'Клик — вставить, долгое нажатие — удалить', onclick: () => { expr += hh.r; live(); } }, hh.e + ' = ' + hh.r); onLong(d, () => { DB.calcHistory.splice(idx, 1); save(); drawHist(); }); hist.append(d); }); if (!DB.calcHistory.length) hist.append(h('span', { class: 'hint' }, 'История пуста')); };
  const press = k => {
    if (k === 'C') { expr = ''; result = null; }
    else if (k === '⌫') expr = expr.slice(0, -1);
    else if (k === '=') {
      try { const v = evalExpr(expr); if (!isFinite(v)) throw 0; const r = fmt(v); DB.calcHistory.unshift({ e: expr, r }); DB.calcHistory = DB.calcHistory.slice(0, 50); save(); drawHist(); expr = r; result = r; }
      catch (e) { resEl.textContent = 'Ошибка'; return; }
    } else {
      if (result !== null && /[\d,]/.test(k)) expr = '';
      result = null; expr += k;
    }
    live();
  };
  const K = (k, cls) => { const b = h('button', { class: cls || '', onclick: () => press(k) }, k); if (k === 'C') onLong(b, () => { DB.calcHistory = []; save(); drawHist(); toast('История очищена'); }); return b; };
  const keys = h('div', { class: 'keys' },
    K('C', 'op'), K('('), K(')'), K('÷', 'op'), K('7'), K('8'), K('9'), K('×', 'op'), K('4'), K('5'), K('6'), K('−', 'op'),
    K('1'), K('2'), K('3'), K('+', 'op'), K('√', 'op'), K('0'), K(','), K('%', 'op'), K('²', 'op'), K('⌫', 'op'), h('button', { class: 'eq', style: { gridColumn: 'span 2' }, onclick: () => press('=') }, '='));
  const disp = h('div', { class: 'disp', title: 'Клик — скопировать результат', onclick: () => { const v = resEl.textContent; if (v === 'Ошибка') return; CLIP = pnum(v); copyText(v.replace(/\s/g, '')); toast('Скопировано. Кликните по пустому числовому полю, чтобы вставить.'); m.close(); } }, exEl, resEl);
  const m = modal({ title: 'Калькулятор', body: h('div', { class: 'calc' }, disp, keys, h('div', { class: 'fl' }, 'История'), hist) });
  const keyH = e => { if (!document.body.contains(m.el)) return document.removeEventListener('keydown', keyH);
    const map = { '*': '×', '/': '÷', '-': '−', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Delete': 'C', '.': ',' };
    const k = map[e.key] || e.key; if (/^[\d,+()%]$/.test(k) || ['×', '÷', '−', '=', '⌫', 'C'].includes(k)) { e.preventDefault(); press(k); } };
  document.addEventListener('keydown', keyH);
  drawHist(); live();
}

/* ===================== ЗАПУСК ===================== */
function boot() {
  loadDB(); applyTheme();
  window.addEventListener('hashchange', render);
  render();
  window.addEventListener('beforeunload', () => { if (STORAGE_OK) try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { } });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
