'use strict';
/* ===================== МЕНЮ РАСЧЁТОВ ===================== */
const CALC_MENU = {
  build: ['solution', 'concrete', 'foundation', 'brick', 'block', 'pps', 'soft', 'balk', 'timbers', 'loose', 'armature', '@fence'],
  finish: ['@gyps', 'tile', 'ceiling', 'wallpaper', 'linoleum', 'laminate', 'panels', 'plinth', 'armstrong', 'dry_floor', 'plasters'],
  other: ['angle', '@volume']
};
const SUBMENUS = {
  fence: { title: 'Забор из профнастила', ids: () => SECTIONS.fence },
  gyps: { title: 'Гипсокартон', ids: () => SECTIONS.gyps },
  volume: { title: 'Объём', ids: () => SECTIONS.volume, img: true },
  area: { title: 'Площадь участка', ids: () => SECTIONS.area, img: true },
  insul: { title: 'Утеплитель', ids: () => SECTIONS.insul }
};
const journalCount = ids => DB.journal.filter(j => ids.includes(j.calc)).length;

function calcTile(id, sm = true) {
  let label, ids, onclick, img = null;
  if (id.startsWith('@')) {
    const k = id.slice(1), sm2 = SUBMENUS[k]; label = sm2.title; ids = sm2.ids(); onclick = () => go('/menu/' + k);
  } else {
    const c = CALCS[id]; label = c.title; ids = [id]; onclick = () => go('/c/' + id);
    if (c.menuImg) img = IMG[c.menuImg];
  }
  const cnt = journalCount(ids);
  const t = h('div', { class: 'tile' + (sm ? ' sm' : ''), onclick, title: 'Долгое нажатие — журнал расчётов' },
    img ? h('img', { src: img, alt: '' }) : null, label, cnt && S().calcBadges ? h('span', { class: 'badge' }, cnt) : null);
  onLong(t, () => go('/journal/' + ids.join(',')));
  return t;
}
route('/calc', (q) => {
  const tab = CURRENT.query.tab || 'build';
  const body = h('div');
  if (tab === 'journal') body.append(journalList(null));
  else body.append(h('div', { class: 'tiles g2' }, CALC_MENU[tab].map(id => calcTile(id))), h('p', { class: 'hint center mt' }, 'Цифра на кнопке — количество сохранённых расчётов. Долгое нажатие (или правый клик) открывает журнал.'));
  screen({ title: 'Расчёты', backTo: '/', body, tabs: tabsBar([['build', 'Стройка'], ['finish', 'Отделка'], ['other', 'Прочее'], ['journal', 'Журнал']], tab, k => go('/calc?tab=' + k)) });
});
route('/menu/:k', k => {
  const m = SUBMENUS[k]; if (!m) return go('/calc');
  const ids = m.ids();
  const body = h('div', { class: 'tiles ' + (m.img ? 'g3' : 'g2') }, ids.map(id => calcTile(id, !m.img)));
  screen({ title: m.title, body });
});
route('/square', () => {
  const body = h('div', { class: 'tiles g2' }, calcTile('room', false), calcTile('room2', false),
    (() => { const t = calcTile('@area', false); t.classList.add('span2'); return t; })());
  screen({ title: 'Площадь', backTo: '/', body });
});

/* ===================== ЭКРАН РАСЧЁТА ===================== */
let PREFILL = null;
function openCalcWith(id, vals) { PREFILL = vals; go('/c/' + id + (CURRENT.query.obj ? '?obj=' + CURRENT.query.obj : '')); }
function fieldLabel(f, v) { return typeof f.l === 'function' ? f.l(v) : f.l; }
function fieldUnit(f, v) { const u = typeof f.u === 'function' ? f.u(v) : f.u; return u === 'р.' ? cur() : u; }
function defaults(c) {
  const v = {};
  for (const f of c.fields) {
    if (!f.k) continue;
    if (f.t === 'vlist') v[f.k] = { rows: [{ s: 1, d: f.dims.map(() => ''), q: 1, desc: '' }] };
    else if (f.t === 'tlist') v[f.k] = { rows: f.k === 'rooms' ? [{ s: 1, q: 1 }] : [] };
    else if (f.t === 'price') { v[f.k] = ''; v[f.k + '_t'] = 0; }
    else v[f.k] = f.d !== undefined ? f.d : (f.t === 'sel' || f.t === 'radio' || f.t === 'imgsel' ? 0 : '');
  }
  return v;
}
function listTotals(f, val) {
  let total = 0, minus = 0;
  for (const r of val.rows) {
    const p = r.d.reduce((a, x) => a * pnum(x), 1) * (isEmpty(r.q) ? 1 : pnum(r.q));
    if (!r.d.every(x => !isEmpty(x))) continue;
    if (r.s === -1 && !f.nosign) { total -= p; minus += p; } else total += p;
  }
  val.total = Math.max(0, total); val.minus = minus;
  return val;
}

route('/c/:id', (id) => {
  const c = CALCS[id]; if (!c) return go('/calc');
  let v = defaults(c), entry = null;
  if (CURRENT.query.j) { entry = DB.journal.find(j => j.id === CURRENT.query.j); if (entry) v = Object.assign(v, clone(entry.values)); }
  if (PREFILL) { Object.assign(v, clone(PREFILL)); PREFILL = null; }
  const objId = entry ? entry.obj : CURRENT.query.obj || null;
  const actions = [{ icon: ICONS.journal, title: 'Журнал', click: () => go('/journal/' + id) }];
  if (c.help && HELP[c.help]) actions.push({ icon: ICONS.help, title: 'Справка', click: () => modal({ title: c.title, body: h('div', { class: 'help' }, h('p', {}, HELP[c.help])), wide: true }) });
  const main = screen({ title: entry ? entry.name : c.title, sub: entry ? c.title : null, actions });
  const formWrap = h('div'), resWrap = h('div');
  main.append(c.img ? h('div', { class: 'figure' }, h('img', { src: IMG[c.img], alt: '' })) : null, formWrap, resWrap);

  let lastRes = null;
  function recompute() {
    for (const f of c.fields) if (f.t === 'vlist') listTotals(f, v[f.k]);
    let r; try { r = c.compute(v); } catch (e) { console.error(e); r = { err: 'Ошибка расчёта: ' + e.message }; }
    lastRes = r; resWrap.innerHTML = '';
    if (!r) { resWrap.append(h('div', { class: 'hint center', style: { padding: '14px' } }, 'Введите данные для расчёта')); return; }
    if (r.err) { resWrap.append(h('div', { class: 'result' }, h('div', { class: 'err' }, r.err))); return; }
    resWrap.append(resultBlock(r));
    if (r.node) resWrap.append(r.node);
    resWrap.append(h('div', { class: 'btns' },
      (r.actions || []).map(a => h('button', { class: 'btn', onclick: a.click }, a.text)),
      h('button', { class: 'btn pri', onclick: saveJournal }, entry ? 'Сохранить' : 'Сохранить в журнал'),
      entry ? h('button', { class: 'btn', onclick: () => saveJournal(true) }, 'Сохранить новый') : null,
      h('button', { class: 'btn', onclick: () => exportDialog({ folder: 'Расчёты', name: (entry ? entry.name : c.title), txt: calcText(c, v, lastRes, entry), html: () => calcHTML(c, v, lastRes, entry) }) }, 'Экспорт'),
      h('button', { class: 'btn', onclick: () => copyText(calcText(c, v, lastRes, entry)) }, 'Копировать'),
      h('button', { class: 'btn', onclick: () => addCalcToSmeta(c, lastRes) }, 'В смету'),
      h('button', { class: 'btn', onclick: () => { v = defaults(c); drawForm(); } }, 'Сброс')));
  }
  async function saveJournal(asNew) {
    if (entry && asNew !== true) {
      entry.values = clone(v); entry.text = calcText(c, v, lastRes, entry); entry.date = nowISO(); save(); toast('Сохранено!'); return;
    }
    const r = await formBox('Сохранить в журнал', [
      { k: 'name', label: 'Название', value: c.title + ' ' + new Date().toLocaleDateString('ru-RU'), req: true },
      { k: 'obj', label: 'Объект', type: 'select', opts: [['', '— без объекта —'], ...DB.objects.map(o => [o.id, o.name])], value: objId || '' }
    ], 'Сохранить');
    if (!r) return;
    const e = { id: uid(), calc: c.id, name: r.name, obj: r.obj || null, date: nowISO(), values: clone(v) };
    e.text = calcText(c, v, lastRes, e);
    DB.journal.unshift(e); save(); toast('Сохранено!');
    history.replaceState(null, '', '#/c/' + c.id + '?j=' + e.id); render();
  }
  function drawForm() {
    formWrap.innerHTML = '';
    let card = h('div', { class: 'card' }); formWrap.append(card);
    for (const f of c.fields) {
      if (f.show && !f.show(v)) continue;
      if (f.t === 'h') { card = h('div', { class: 'card' }, h('h3', {}, f.l)); formWrap.append(card); continue; }
      card.append(renderField(f));
    }
    recompute();
  }
  function renderField(f) {
    const lab = fieldLabel(f, v), unit = fieldUnit(f, v);
    const onNum = e => { v[f.k] = e.target.value; recompute(); };
    switch (f.t) {
      case 'num': return h('div', { class: 'row' }, h('label', {}, lab), h('div', { class: 'fld' }, h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: v[f.k] ?? '', placeholder: f.ph || '0', oninput: onNum }), h('span', { class: 'u' }, unit || '')));
      case 'sel': return h('div', { class: 'row' }, h('label', {}, lab), h('div', { class: 'fld' }, h('select', { onchange: e => { v[f.k] = +e.target.value; drawForm(); } }, f.o.map((o, i) => h('option', { value: i, selected: +v[f.k] === i }, o)))));
      case 'radio': return h('div', { class: 'row' }, h('label', {}, lab), h('div', { class: 'radios fld' }, f.o.map((o, i) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: f.k, checked: +v[f.k] === i, onchange: () => { v[f.k] = i; drawForm(); } }), o))));
      case 'chk': return h('div', { class: 'row' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!v[f.k], onchange: e => { v[f.k] = e.target.checked; drawForm(); } }), lab));
      case 'price': return h('div', { class: 'row' }, h('label', {}, lab), h('div', { class: 'fld pricebar' },
        h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: v[f.k] ?? '', placeholder: '0', oninput: onNum }), h('span', { class: 'u' }, cur()),
        h('select', { onchange: e => { v[f.k + '_t'] = +e.target.value; recompute(); } }, f.o.map((o, i) => h('option', { value: i, selected: +v[f.k + '_t'] === i }, o)))));
      case 'consSel': {
        const mats = DB.consBase.filter(m => m.group === f.group);
        const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'num', value: v[f.k] ?? f.d, oninput: onNum });
        return h('div', {}, h('div', { class: 'row' }, h('label', {}, lab), h('div', { class: 'fld' }, inp, h('span', { class: 'u' }, 'кг'))),
          h('div', { class: 'row' }, h('label', {}, 'Выбрать из базы'), h('div', { class: 'fld' }, h('select', { onchange: e => { if (e.target.value !== '') { v[f.k] = e.target.value; inp.value = String(e.target.value).replace('.', ','); recompute(); } } },
            h('option', { value: '' }, '— свой расход —'), mats.map(m => h('option', { value: m.rate, selected: false }, `${m.name} — ${num(m.rate)}`))))));
      }
      case 'imgsel': return h('div', {}, h('div', { class: 'fl', style: { margin: '4px 0 8px' } }, lab),
        h('div', { class: 'tiles g3' }, f.o.map((im, i) => h('div', { class: 'tile sm', style: { borderColor: +v[f.k] === i ? 'var(--accent)' : '', borderWidth: +v[f.k] === i ? '3px' : '', minHeight: '0', padding: '6px', fontSize: '14px' }, onclick: () => { v[f.k] = i; drawForm(); } },
          h('img', { src: IMG[im], style: { maxWidth: '100%', maxHeight: '110px' } }), f.labels ? f.labels[i] : ''))),
        h('div', { class: 'figure' }, h('img', { src: IMG[f.o[v[f.k]]], style: { maxHeight: '300px' } })));
      case 'vlist': return vlistEditor(f, v[f.k], recompute, lab);
      case 'tlist': return tlistEditor(f, v[f.k], recompute, lab);
      case 'note': return h('div', { class: 'hint' }, lab);
    }
    return h('div');
  }
  drawForm();
});

/** редактор списка размеров (объёмы/площади с плюсом/минусом) */
function vlistEditor(f, val, onChange, lab) {
  const wrap = h('div', { class: 'dl' });
  const totalEl = h('div', { class: 'total' });
  const upd = () => { listTotals(f, val); totalEl.textContent = (f.nosign ? 'Итого: ' : 'Итого: ') + num(val.total, 3) + ' ' + f.unit + (val.minus ? `  (в т.ч. вычтено ${num(val.minus, 3)} ${f.unit})` : ''); onChange(); };
  function draw() {
    wrap.innerHTML = '';
    wrap.append(h('div', { class: 'fl', style: { marginBottom: '4px' } }, lab + (f.dims.length > 1 ? ` (${f.dims.join(' × ')}, ${f.u})` : ` (${f.u})`)));
    val.rows.forEach((r, i) => {
      const sumEl = h('span', { class: 'sum' });
      const calcRow = () => { const ok = r.d.every(x => !isEmpty(x)); sumEl.textContent = ok ? (r.s === -1 && !f.nosign ? '−' : '') + num(r.d.reduce((a, x) => a * pnum(x), 1) * (isEmpty(r.q) ? 1 : pnum(r.q)), 3) : ''; };
      const dims = h('div', { class: 'dims' });
      r.d.forEach((x, j) => { if (j) dims.append(h('span', { class: 'x' }, '×')); dims.append(h('input', { type: 'text', inputmode: 'decimal', class: 'num', placeholder: f.dims[j], title: f.dims[j], value: x, oninput: e => { r.d[j] = e.target.value; calcRow(); upd(); } })); });
      dims.append(h('span', { class: 'x' }, 'кол.'), h('input', { type: 'text', inputmode: 'decimal', class: 'num', style: { maxWidth: '54px' }, value: r.q ?? 1, title: 'Количество', oninput: e => { r.q = e.target.value; calcRow(); upd(); } }));
      const sign = f.nosign ? h('span', { class: 'hint' }, (i + 1) + '.') : h('button', { class: 'sign ' + (r.s === -1 ? 'm' : 'p'), title: 'Прибавить / вычесть', onclick: () => { r.s = r.s === -1 ? 1 : -1; draw(); upd(); } }, r.s === -1 ? '−' : '+');
      wrap.append(h('div', { class: 'dr' }, sign, dims, sumEl, h('button', { class: 'del', title: 'Удалить', onclick: () => { val.rows.splice(i, 1); if (!val.rows.length) val.rows.push({ s: 1, d: f.dims.map(() => ''), q: 1 }); draw(); upd(); } }, '✕')),
        h('div', { class: 'dr' }, h('span'), h('input', { type: 'text', class: 'desc', placeholder: 'Описание (необязательно)', value: r.desc || '', style: { padding: '5px 8px', fontSize: '13px' }, oninput: e => r.desc = e.target.value })));
      calcRow();
    });
    wrap.append(h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: () => { val.rows.push({ s: 1, d: f.dims.map(() => ''), q: 1, desc: '' }); draw(); } }, '+ Добавить'),
      !f.nosign ? h('button', { class: 'btn sm', onclick: () => { val.rows.push({ s: -1, d: f.dims.map(() => ''), q: 1, desc: '' }); draw(); } }, '− Вычесть участок') : null), totalEl);
    listTotals(f, val); totalEl.textContent = 'Итого: ' + num(val.total, 3) + ' ' + f.unit + (val.minus ? `  (в т.ч. вычтено ${num(val.minus, 3)} ${f.unit})` : '');
  }
  draw();
  return wrap;
}
/** редактор таблицы со столбцами */
function tlistEditor(f, val, onChange, lab) {
  const wrap = h('div', { class: 'dl' });
  function draw() {
    wrap.innerHTML = '';
    wrap.append(h('div', { class: 'fl', style: { marginBottom: '6px' } }, lab));
    if (f.hint) wrap.append(h('div', { class: 'hint', style: { marginBottom: '6px' } }, f.hint));
    val.rows.forEach((r, i) => {
      const cells = h('div', { class: 'dims' });
      for (const col of f.cols) {
        if (r[col.k] === undefined && (col.d !== undefined || col.t === 'sel')) r[col.k] = col.d !== undefined ? col.d : 0;
        if (col.t === 'sel') cells.append(h('select', { style: { width: (col.w || 100) + 'px', flex: '0 0 auto' }, onchange: e => { r[col.k] = +e.target.value; onChange(); } }, col.o.map((o, j) => h('option', { value: j, selected: +r[col.k] === j }, o))));
        else cells.append(h('input', { type: 'text', inputmode: col.t === 'text' ? 'text' : 'decimal', class: col.t === 'text' ? '' : 'num', placeholder: col.l, title: col.l, value: r[col.k] ?? '', style: col.w ? { maxWidth: col.w + 'px' } : {}, oninput: e => { r[col.k] = e.target.value; onChange(); } }));
      }
      const sign = f.sign ? h('button', { class: 'sign ' + (r.s === -1 ? 'm' : 'p'), title: 'Знак (для «Стена» и «Участок»)', onclick: () => { r.s = r.s === -1 ? 1 : -1; draw(); onChange(); } }, r.s === -1 ? '−' : '+') : h('span', { class: 'hint' }, (i + 1) + '.');
      wrap.append(h('div', { class: 'dr' }, sign, cells, h('span'), h('button', { class: 'del', onclick: () => { val.rows.splice(i, 1); draw(); onChange(); } }, '✕')));
    });
    wrap.append(h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: () => { val.rows.push({ s: 1 }); draw(); } }, '+ Добавить')));
  }
  draw();
  return wrap;
}
function resultBlock(r) {
  const tb = h('table');
  for (const row of r.rows) {
    if (row[0] === '#') { tb.append(h('tr', { class: 'sec' }, h('td', { colspan: 2 }, row[1]))); continue; }
    if (row[0] === '=') { tb.append(h('tr', { class: 'tot' }, h('td', {}, row[1]), h('td', { class: 'v' }, typeof row[2] === 'number' ? num(row[2]) + ' ' + (row[3] || '') : row[2]))); continue; }
    const [l, val, u] = row;
    tb.append(h('tr', {}, h('td', {}, l), h('td', { class: 'v' }, typeof val === 'number' ? num(val, u === 'м³' || u === 'т.' ? 3 : 2) + ' ' + (u || '') : String(val ?? ''))));
  }
  return h('div', { class: 'result' }, tb, r.note ? h('div', { class: 'note' }, r.note) : null);
}
function inputsText(c, v) {
  const out = [];
  for (const f of c.fields) {
    if (!f.k || (f.show && !f.show(v))) continue;
    const lab = fieldLabel(f, v), unit = fieldUnit(f, v) || '', val = v[f.k];
    if (f.t === 'vlist') {
      const rows = (val.rows || []).filter(r => r.d.every(x => !isEmpty(x)));
      if (!rows.length) continue;
      out.push(lab + ':');
      rows.forEach(r => out.push(`  ${f.nosign ? '' : (r.s === -1 ? '− ' : '+ ')}${r.d.join(' × ')}${pnum(r.q) !== 1 && !isEmpty(r.q) ? ' × ' + r.q + ' шт.' : ''} = ${num(r.d.reduce((a, x) => a * pnum(x), 1) * (isEmpty(r.q) ? 1 : pnum(r.q)), 3)} ${f.unit}${r.desc ? ' (' + r.desc + ')' : ''}`));
    } else if (f.t === 'tlist') {
      const rows = (val.rows || []); if (!rows.length) continue;
      out.push(lab + ':');
      rows.forEach(r => out.push('  ' + (f.sign ? (r.s === -1 ? '− ' : '+ ') : '') + f.cols.map(col => col.t === 'sel' ? col.o[+r[col.k] || 0] : (isEmpty(r[col.k]) ? '' : (col.l ? col.l + ' ' : '') + r[col.k])).filter(Boolean).join(', ')));
    } else if (f.t === 'sel' || f.t === 'radio') out.push(`${lab}: ${f.o[+val]}`);
    else if (f.t === 'imgsel') out.push(`${lab}: ${f.labels ? f.labels[+val] : +val + 1}`);
    else if (f.t === 'chk') { if (val) out.push(lab); }
    else if (f.t === 'price') { if (pnum(val)) out.push(`${lab}: ${val} ${cur()} ${f.o[v[f.k + '_t'] || 0]}`); }
    else if (!isEmpty(val)) out.push(`${lab}: ${val} ${f.t === 'consSel' ? 'кг/м²·мм' : unit}`.trim());
  }
  return out;
}
function resultText(r) {
  if (!r || r.err) return r ? r.err : '';
  return r.rows.map(row => row[0] === '#' ? '\n' + row[1] + ':' : row[0] === '=' ? `${row[1]}: ${typeof row[2] === 'number' ? num(row[2]) + ' ' + (row[3] || '') : row[2]}` : `${row[0] ? row[0] + ': ' : '    '}${typeof row[1] === 'number' ? num(row[1], 3) + ' ' + (row[2] || '') : row[1]}`).join('\n') + (r.note ? '\n\n' + r.note : '');
}
function calcText(c, v, r, entry) {
  return [(entry ? entry.name + '\n' : '') + c.head, '', ...inputsText(c, v), '', 'РЕЗУЛЬТАТ:', resultText(r), '', 'ПРОраб pro — ' + new Date().toLocaleString('ru-RU')].join('\n');
}
function calcHTML(c, v, r, entry) {
  const inp = inputsText(c, v).map(l => `<div>${esc(l).replace(/^ {2}/, '&nbsp;&nbsp;&nbsp;&nbsp;')}</div>`).join('');
  const res = r && r.rows ? '<table>' + r.rows.map(row => row[0] === '#' ? `<tr class="sec"><td colspan="2">${esc(row[1])}</td></tr>` : row[0] === '=' ? `<tr class="tot"><td>${esc(row[1])}</td><td class="n">${esc(typeof row[2] === 'number' ? num(row[2]) : row[2])}</td></tr>` : `<tr><td>${esc(row[0])}</td><td class="n">${esc(typeof row[1] === 'number' ? num(row[1], 3) + ' ' + (row[2] || '') : row[1])}</td></tr>`).join('') + '</table>' : '';
  const img = c.img ? `<div style="text-align:center"><img src="${IMG[c.img]}" style="max-height:180px;background:#233f77;padding:6px;border-radius:6px"></div>` : '';
  return docHTML(entry ? entry.name : c.title, `<h1>${esc(entry ? entry.name : c.head)}</h1><div class="muted right">${new Date().toLocaleDateString('ru-RU')}</div>${img}<h2>Исходные данные</h2>${inp}<h2>Результат</h2>${res}${r && r.note ? '<pre>' + esc(r.note) + '</pre>' : ''}${r && r.node && r.node.innerHTML ? r.node.innerHTML : ''}`);
}
/** перенос результатов расчёта в смету материалов (PRO) */
async function addCalcToSmeta(c, r) {
  if (!r || !r.rows) return;
  if (!DB.smetas.length) { toast('Нет смет! Создайте смету в разделе «Сметы».'); return; }
  const cand = r.rows.filter(x => x[0] !== '#' && x[0] !== '=' && x[0] && typeof x[1] === 'number' && x[2] && !/^\s/.test(x[0]));
  const body = h('div');
  const sel = h('select', {}, DB.smetas.map(s => h('option', { value: s.id }, s.name)));
  body.append(h('div', { class: 'fl' }, 'Смета'), sel, h('div', { class: 'fl mt' }, 'Позиции для добавления в материалы:'));
  const checks = cand.map(x => { const cb = h('input', { type: 'checkbox', checked: true }); body.append(h('label', { class: 'chk row' }, cb, `${x[0]} — ${num(x[1])} ${x[2]}`)); return [cb, x]; });
  modal({ title: 'Добавить в смету', body, buttons: [{ text: 'Отмена' }, { text: 'Добавить', cls: 'pri', click: () => {
    const s = DB.smetas.find(x => x.id === sel.value); const sec = 'По расчёту: ' + c.title; let n = 0;
    checks.forEach(([cb, x]) => { if (!cb.checked) return; const m = DB.matPrice.find(p => p.name.toLowerCase() === x[0].toLowerCase());
      s.items.push({ id: uid(), kind: 'mat', sec, name: x[0], unit: x[2], qty: Math.round(x[1] * 1000) / 1000, price: m ? m.price : 0, done: false }); n++; });
    save(); toast('Добавлено позиций: ' + n);
  } }] });
}

/* ===================== ЖУРНАЛ ===================== */
function journalList(ids, objId) {
  let list = DB.journal.filter(j => (!ids || ids.includes(j.calc)) && (objId === undefined || j.obj === objId));
  const wrap = h('div');
  if (!list.length) { wrap.append(h('div', { class: 'empty' }, 'Журнал пуст. Сохраните расчёт кнопкой «Сохранить в журнал».')); return wrap; }
  const groups = {};
  list.forEach(j => (groups[j.calc] = groups[j.calc] || []).push(j));
  for (const [cid, items] of Object.entries(groups)) {
    wrap.append(h('div', { class: 'grp' }, h('span', {}, CALCS[cid] ? CALCS[cid].title : cid), h('span', {}, items.length)));
    const l = h('div', { class: 'list' });
    items.forEach(j => {
      const obj = j.obj && DB.objects.find(o => o.id === j.obj);
      const li = h('div', { class: 'li', onclick: () => go('/c/' + j.calc + '?j=' + j.id) },
        h('div', { class: 'main' }, h('div', { class: 't' }, j.name), h('div', { class: 's' }, fdate(j.date, true) + (obj ? ' · ' + obj.name : ''))),
        h('button', { class: 'more', onclick: e => { e.stopPropagation(); journalMenu(j); } }, '⋮'));
      onLong(li, () => journalMenu(j)); l.append(li);
    });
    wrap.append(l);
  }
  return wrap;
}
function journalMenu(j) {
  menuBox(j.name, [
    { text: 'Открыть', click: () => go('/c/' + j.calc + '?j=' + j.id) },
    { text: 'Переименовать', click: async () => { const n = await prompt2('Переименовать', 'Название', j.name); if (n) { j.name = n; save(); render(); } } },
    { text: 'Дублировать', click: () => { DB.journal.unshift({ ...clone(j), id: uid(), name: j.name + ' (копия)', date: nowISO() }); save(); render(); } },
    { text: 'Экспорт / отправить', click: () => exportDialog({ folder: 'Расчёты', name: j.name, txt: j.text || '', html: docHTML(j.name, `<pre>${esc(j.text || '')}</pre>`) }) },
    { text: 'Копировать текст', click: () => copyText(j.text || '') },
    { text: 'Переместить в объект', click: async () => { const r = await formBox('Переместить в объект', [{ k: 'o', label: 'Объект', type: 'select', opts: [['', '— без объекта —'], ...DB.objects.map(o => [o.id, o.name])], value: j.obj || '' }]); if (r) { j.obj = r.o || null; save(); render(); } } },
    { text: 'Удалить', danger: true, click: async () => { if (await confirmBox('Удалить запись?', 'Удалить')) { DB.journal = DB.journal.filter(x => x !== j); save(); render(); } } }
  ]);
}
route('/journal/:ids', ids => {
  const arr = ids.split(',');
  const title = arr.length === 1 && CALCS[arr[0]] ? CALCS[arr[0]].title : 'Журнал';
  screen({ title: 'Журнал', sub: title, body: journalList(arr) });
  if (arr.length === 1 && CALCS[arr[0]]) $('main').append(h('button', { class: 'fab', title: 'Новый расчёт', onclick: () => go('/c/' + arr[0]) }, '+'));
});
