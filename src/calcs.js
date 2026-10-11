'use strict';
/* =====================================================================
   РАСЧЁТЫ. Формулы перенесены из оригинального приложения ПРОраб (Android).
   Описание поля: {k, t, l, u, d, o, show, ph}
   t: num | sel | radio | chk | vlist | tlist | price | h (заголовок) | img | note
   compute(v) -> {rows:[[label,value,unit] | ['#','Раздел'] | ['=',label,value,unit]], note, err, node}
   ===================================================================== */
const CALCS = {};
const SECTIONS = { build: [], finish: [], other: [], square: [], area: [], volume: [], gyps: [], fence: [], insul: [] };
function defCalc(c) { CALCS[c.id] = c; (c.sec || []).forEach(s => SECTIONS[s].push(c.id)); }

const MARK_CONCRETE = ['B7.5 (М-100)', 'B10 (М-150)', 'B12.5 (М-150)', 'B15 (М-200)', 'B20 (М-250)', 'B22.5 (М-300)', 'B25 (М-350)', 'B26.5 (М-350)'];
const MARK_CONCRETE_K = [98, 131, 164, 196, 262, 290, 328, 360];
const OLD_CEM = ['0 – 1 мес.', '1 – 3 мес.', '3 – 6 мес.', '6 – 12 мес.', '12 – 24 мес.'];
const OLD_CEM_K = [1.0, 1.1, 1.2, 1.4, 1.6];
const D_SAND = ['0,7 – 1 мм.', '1 – 1,5 мм.', '1,5 – 2 мм.', '2 – 2,5 мм.', '2,5 – 3 мм.'];
const D_SAND_K = [12, 7, 4, 0, -2];
const D_GRAVEL = ['5 – 10 мм.', '5 – 15 мм.', '5 – 20 мм.', '5 – 30 мм.', '5 – 40 мм.'];
const D_GRAVEL_K = [30, 24, 16, 7, 0];
const FLUIDITY = ['П-1', 'П-2', 'П-3', 'П-4', 'П-5'];
const FLUIDITY_K = [3, 7, 12, 17, 24];
const PRICE_PIECE = 'за шт.', PRICE_M2 = 'за м²', PRICE_M3 = 'за м³', PRICE_PM = 'за п.м.', PRICE_T = 'за тонну';

/** пропорции бетона на 1 м3 (из Concrete.Result) */
function concretePerM3({ betM = 196, cemM = 400, fl = 1, humS = 5, humG = 5, gr = 4, sa = 3, old = 0 }) {
  const cemK = betM / (cemM * 0.52) + 0.5;
  const podSmes = FLUIDITY_K[fl];
  const water = ((podSmes + 12.5) * 300) / (podSmes + 21) - humS - humG + D_GRAVEL_K[gr] + D_SAND_K[sa];
  let cem = cemK * water;
  const sheb = 1000 / ((((Math.sqrt(Math.max(0, cem / 3.12 + water - 170)) * 0.036) + 1) * 0.51) / 1.6 + 1 / 2.7);
  const pes = (1000 - (cem / 3.12 + water + sheb / 2.7)) * 2.66;
  cem = cem * OLD_CEM_K[old];
  return { cem, water, sheb, pes };
}
/** сумма по динамическому списку размеров */
function vsum(list) { return list && list.total ? list.total : 0; }
function priceSum(v, k, map) { const p = pnum(v[k]); if (!p) return null; const t = v[k + '_t'] || 0; return p * map[t]; }

/* ============================ СТРОЙКА ============================ */
defCalc({
  id: 'solution', sec: ['build'], title: 'Раствор', head: 'РАСЧЁТ РАСТВОРА', help: 'cement_help',
  fields: [
    { k: 'vol', t: 'vlist', l: 'Объём раствора', dims: ['Длина', 'Ширина', 'Высота'], u: 'м', unit: 'м³' },
    { k: 'mark', t: 'sel', l: 'Марка раствора', o: ['М-50', 'М-75', 'М-100', 'М-150', 'М-200', 'М-300'], d: 3 },
    { k: 'cemM', t: 'radio', l: 'Марка цемента', o: ['М-400', 'М-500'], d: 0 },
    { k: 'bag', t: 'num', l: 'Вес мешка цемента', u: 'кг', d: 50 },
    { t: 'h', l: 'Поправки' },
    { k: 'old', t: 'sel', l: 'Возраст цемента', o: OLD_CEM, d: 0 },
    { k: 'sa', t: 'sel', l: 'Фракция песка', o: D_SAND, d: 3 },
    { k: 'humS', t: 'num', l: 'Влажность песка', u: '%', d: 5 }
  ],
  compute(v) {
    const V = vsum(v.vol); if (!V) return null;
    const M = [50, 75, 100, 150, 200, 300][v.mark], m400 = v.cemM == 0;
    const cemK = { 50: [175, 140], 75: [240, 195], 100: [300, 250], 150: [400, 330], 200: [490, 410], 300: [600, 510] }[M][m400 ? 0 : 1];
    const waterK = { 50: 171, 75: 175, 100: 178, 150: 185, 200: 190, 300: 198 }[M];
    const cem1 = cemK * OLD_CEM_K[v.old];
    const w1 = waterK + 10 - pnum(v.humS) + D_SAND_K[v.sa];
    const pes1 = (1000 - (cem1 / 3.12 + w1)) * 2.0;
    const cem = cem1 * V, pes = pes1 * V, water = w1 * V, bag = pnum(v.bag) || 50;
    return { rows: [['Объём', V, 'м³'], ['#', 'На весь объём'], ['Цемент', cem, 'кг'], ['  мешков по ' + num(bag) + ' кг', ceil(cem / bag), 'шт.'], ['Песок', pes, 'кг'], ['  в объёме (≈1500 кг/м³)', pes / 1500, 'м³'], ['Вода', water, 'л.'],
      ['#', 'На 1 м³'], ['Цемент', cem1, 'кг'], ['Песок', pes1, 'кг'], ['Вода', w1, 'л.']] };
  }
});
defCalc({
  id: 'concrete', sec: ['build'], title: 'Бетон', head: 'РАСЧЁТ БЕТОНА', help: 'cement_help',
  fields: [
    { k: 'vol', t: 'vlist', l: 'Объём бетона', dims: ['Длина', 'Ширина', 'Высота'], u: 'м', unit: 'м³' },
    { k: 'mark', t: 'sel', l: 'Класс и марка бетона', o: MARK_CONCRETE, d: 2 },
    { k: 'cemM', t: 'radio', l: 'Марка цемента', o: ['М-400', 'М-500'], d: 0 },
    { k: 'bag', t: 'num', l: 'Вес мешка цемента', u: 'кг', d: 50 },
    { k: 'price', t: 'num', l: 'Цена бетона (готового) за м³', u: 'р.', d: '' },
    { t: 'h', l: 'Поправки' },
    { k: 'old', t: 'sel', l: 'Возраст цемента', o: OLD_CEM, d: 0 },
    { k: 'fl', t: 'sel', l: 'Подвижность смеси', o: FLUIDITY, d: 1 },
    { k: 'gr', t: 'sel', l: 'Фракция щебня', o: D_GRAVEL, d: 4 },
    { k: 'humG', t: 'num', l: 'Влажность щебня', u: '%', d: 5 },
    { k: 'sa', t: 'sel', l: 'Фракция песка', o: D_SAND, d: 3 },
    { k: 'humS', t: 'num', l: 'Влажность песка', u: '%', d: 5 },
    { k: 'arm', t: 'num', l: 'Объём арматуры', u: 'м³', d: '' }
  ],
  compute(v) {
    const V = vsum(v.vol); if (!V) return null;
    const p = concretePerM3({ betM: MARK_CONCRETE_K[v.mark], cemM: v.cemM == 0 ? 400 : 500, fl: +v.fl, humS: pnum(v.humS), humG: pnum(v.humG), gr: +v.gr, sa: +v.sa, old: +v.old });
    const Vn = V - pnum(v.arm), bag = pnum(v.bag) || 50;
    const rows = [['Объём', V, 'м³']];
    if (pnum(v.arm)) rows.push(['Объём без арматуры', Vn, 'м³']);
    rows.push(['#', 'Компоненты'], ['Цемент', p.cem * Vn, 'кг'], ['  мешков по ' + num(bag) + ' кг', ceil(p.cem * Vn / bag), 'шт.'],
      ['Песок', p.pes * Vn, 'кг'], ['  в объёме', p.pes * Vn / 1500, 'м³'], ['Щебень', p.sheb * Vn, 'кг'], ['  в объёме', p.sheb * Vn / 1600, 'м³'], ['Вода', p.water * Vn, 'л.'],
      ['#', 'На 1 м³'], ['Цемент', p.cem, 'кг'], ['Песок', p.pes, 'кг'], ['Щебень', p.sheb, 'кг'], ['Вода', p.water, 'л.'], ['Вес бетона', V * 2.35, 'т.']);
    if (pnum(v.price)) rows.push(['=', 'Стоимость готового бетона', money(V * pnum(v.price))]);
    return { rows };
  }
});
defCalc({
  id: 'foundation', sec: ['build'], title: 'Фундамент', head: 'ФУНДАМЕНТ',
  fields: [
    { k: 'var', t: 'imgsel', l: 'Тип фундамента', o: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'], labels: ['Лента', 'Лента + перемычка', 'Лента + 2 перемычки', 'Лента + крест', 'Внешняя и внутр. лента', 'Плита'], d: 0 },
    { k: 'a', t: 'num', l: v => v.var == 4 ? 'Длина ленты L' : 'Сторона A', u: 'м' },
    { k: 'b', t: 'num', l: v => v.var == 4 ? 'Длина ленты L1' : 'Сторона B', u: 'м' },
    { k: 'c', t: 'num', l: 'Сторона C', u: 'м', show: v => v.var == 2 },
    { k: 'h', t: 'num', l: 'Высота H', u: 'см' },
    { k: 'w', t: 'num', l: 'Ширина W', u: 'см', show: v => v.var != 5 },
    { k: 'w1', t: 'num', l: 'Ширина W1', u: 'см', show: v => v.var >= 1 && v.var <= 4 },
    { k: 'mark', t: 'sel', l: 'Класс и марка бетона', o: MARK_CONCRETE, d: 3 },
    { k: 'price', t: 'num', l: 'Цена за м³', u: 'р.' }
  ],
  compute(v) {
    const t = +v.var + 1, a = pnum(v.a), b = pnum(v.b), c = pnum(v.c), H = pnum(v.h) / 100, w = pnum(v.w) / 100, w1 = pnum(v.w1) / 100;
    if (!a || !b || !H || (t !== 6 && !w) || (t >= 2 && t <= 5 && !w1)) return null;
    if (t !== 5 && t !== 6 && c > b - (w * 2 + w1)) return { err: 'Неверная длина C!' };
    const f6 = w * 2; let per = (a + b) * 2, sBok = per * H, l, l1 = 0, sLen;
    const f10 = a - f6, f11 = c * w1, f12 = (b - f6) - w1, f13 = (a + (b - f6)) * 2;
    switch (t) {
      case 1: l = f13; sLen = f13 * w; break;
      case 2: l = f13; l1 = f10; sLen = f13 * w + f10 * w1; break;
      case 3: l = f13; l1 = f10 + c; sLen = f13 * w + f10 * w1 + f11; break;
      case 4: l = f13; l1 = f10 + f12; sLen = f13 * w + (f10 + f12) * w1; break;
      case 5: l = a - f6 * 2; l1 = b; sBok = a * H; sLen = (a - f6 * 2) * w + b * w1; per = a; break;
      case 6: l = a; sLen = a * b; per = (a + b) * 2; sBok = per * H; break;
    }
    const V = sLen * H, weight = V * 2.35, z = (weight / sLen) / 10;
    const rows = [];
    if (t !== 6) { rows.push(['Периметр', per, 'м'], ['Длина ленты (по оси) L', l, 'м']); if (l1) rows.push(['Длина внутренних лент L1', l1, 'м']); }
    rows.push(['Площадь подошвы', sLen, 'м²'], ['Площадь боковой поверхности (опалубка)', sBok * (t === 6 ? 1 : 2), 'м²'], ['Объём бетона', V, 'м³'], ['Вес бетона', weight, 'т.'], ['Нагрузка на грунт', z, 'кг/см²']);
    if (pnum(v.price)) rows.push(['=', 'Стоимость', money(V * pnum(v.price))]);
    return { rows, actions: [{ text: 'Рассчитать бетон', click: () => openCalcWith('concrete', { mark: v.mark, vol: { rows: [{ s: 1, d: [num(sLen, 3), '1', num(H, 3)], q: 1, desc: 'Фундамент' }] } }) }] };
  }
});
const BRICK_SIZES = [[250, 120, 65], [250, 120, 88], [250, 120, 138], [250, 100, 65], [250, 85, 65]];
defCalc({
  id: 'brick', sec: ['build'], title: 'Кирпич', head: 'РАСЧЁТ КИРПИЧА', help: 'brick_help', img: 'brick_size',
  fields: [
    { k: 'area', t: 'vlist', l: 'Площадь стен (окна и двери — со знаком «−»)', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { k: 'size', t: 'sel', l: 'Вид кирпича', o: ['250*120*65 (Одинарный)', '250*120*88 (Полуторный)', '250*120*138 (Двойной)', '250*100*65 (Облицовочный)', '250*85*65 (Евро)', 'Другой размер'], d: 0 },
    { k: 'L', t: 'num', l: 'Длина кирпича', u: 'мм', d: 250, show: v => v.size == 5 },
    { k: 'W', t: 'num', l: 'Ширина кирпича', u: 'мм', d: 120, show: v => v.size == 5 },
    { k: 'H', t: 'num', l: 'Высота кирпича', u: 'мм', d: 65, show: v => v.size == 5 },
    { k: 'wall', t: 'sel', l: 'Толщина стены', o: ['Половина кирпича', 'Один кирпич', 'Полтора кирпича', 'Два кирпича', 'Два с половиной кирпича', 'Три кирпича'], d: 1 },
    { k: 'seam', t: 'num', l: 'Толщина раствора', u: 'мм', d: 10 },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_PIECE, PRICE_M3] }
  ],
  compute(v) {
    const S = vsum(v.area); if (!S) return null;
    const [L, W, H] = (v.size == 5 ? [pnum(v.L), pnum(v.W), pnum(v.H)] : BRICK_SIZES[v.size]).map(x => x / 1000);
    const s = pnum(v.seam) / 1000; if (s > 0.02) return { err: 'Нереальная толщина раствора!' };
    if (!L || !W || !H) return null;
    const varWall = +v.wall + 1, koef = [1, 1.12, 1.13, 1.14, 1.15, 1.16][v.wall];
    const bricks = ceil(S / ((L + s) * (H + s))) * varWall;
    const bV = bricks * L * W * H;
    const seamV = bricks * (L * W * s + W * H * s) * koef;
    const rows = [['Площадь кладки', S, 'м²'], ['Кол-во кирпича', bricks, 'шт.'], ['Объём кирпича', bV, 'м³']];
    if (s) rows.push(['Объём раствора', seamV, 'м³']);
    const sum = priceSum(v, 'price', [bricks, bV]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows, actions: s ? [{ text: 'Рассчитать раствор', click: () => openCalcWith('solution', { vol: { rows: [{ s: 1, d: [num(seamV, 3), '1', '1'], q: 1, desc: 'Кладка' }] } }) }] : [] };
  }
});
const BLOCK_SIZES = ['390*190*188', '400*200*200', '600*100*250', '600*100*300', '600*150*250', '600*200*200', '600*200*250', '600*200*300', '600*240*250', '600*300*200', '600*300*250', '600*400*250', '600*400*300'];
defCalc({
  id: 'block', sec: ['build'], title: 'Блоки', head: 'РАСЧЁТ БЛОКОВ',
  fields: [
    { k: 'area', t: 'vlist', l: 'Площадь стен (проёмы — со знаком «−»)', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { k: 'size', t: 'sel', l: 'Размер блока (Д*Ш*В), мм', o: [...BLOCK_SIZES, 'Другой размер'], d: 6 },
    { k: 'L', t: 'num', l: 'Длина блока', u: 'мм', d: 600, show: v => v.size == 13 },
    { k: 'W', t: 'num', l: 'Ширина блока', u: 'мм', d: 200, show: v => v.size == 13 },
    { k: 'H', t: 'num', l: 'Высота блока', u: 'мм', d: 250, show: v => v.size == 13 },
    { k: 'wall', t: 'sel', l: 'Толщина стены', o: ['Половина блока', 'Один блок'], d: 0 },
    { k: 'seam', t: 'num', l: 'Толщина шва (раствор / клей)', u: 'мм', d: 3 },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_PIECE, PRICE_M3] }
  ],
  compute(v) {
    const S = vsum(v.area); if (!S) return null;
    const [L, W, H] = (v.size == 13 ? [pnum(v.L), pnum(v.W), pnum(v.H)] : BLOCK_SIZES[v.size].split('*').map(Number)).map(x => x / 1000);
    if (!L || !W || !H) return null;
    const s = pnum(v.seam) / 1000; if (s > 0.03) return { err: 'Нереальная толщина раствора!' };
    const varWall = +v.wall + 1, koef = varWall === 1 ? 1 : 1.12;
    const n = ceil(S / ((L + s) * (H + s))) * varWall, bV = n * L * W * H;
    const seamV = n * (L * W * s + W * H * s) * koef;
    const rows = [['Площадь кладки', S, 'м²'], ['Кол-во блоков', n, 'шт.'], ['Объём блоков', bV, 'м³']];
    if (s) rows.push(['Объём раствора (клея)', seamV, 'м³'], ['  клея ≈ (1,5 кг/м²·мм)', seamV * 1500, 'кг']);
    const sum = priceSum(v, 'price', [n, bV]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'pps', sec: ['build', 'insul'], title: 'Пенополистирол', head: 'УТЕПЛИТЕЛЬ — ПЕНОПОЛИСТИРОЛ',
  fields: [
    { k: 'area', t: 'vlist', l: 'Площадь утепления', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { t: 'h', l: 'Плиты' },
    { k: 'pl', t: 'num', l: 'Длина плиты', u: 'мм', d: 1000 }, { k: 'pw', t: 'num', l: 'Ширина плиты', u: 'мм', d: 500 },
    { k: 'th', t: 'num', l: 'Толщина плиты', u: 'мм', d: 50 },
    { k: 'layers', t: 'num', l: 'Кол-во слоёв', u: 'шт.', d: 1 }, { k: 'pack', t: 'num', l: 'Кол-во в упаковке', u: 'шт.', d: 10 },
    { k: 'pprice', t: 'price', l: 'Цена плит', o: [PRICE_PIECE, 'за упаковку'] },
    { t: 'h', l: 'Дюбель-гриб' },
    { k: 'dow', t: 'sel', l: 'Кол-во на плиту', o: ['2 шт.', '3 шт.', '4 шт.', '5 шт.'], d: 3 },
    { k: 'dprice', t: 'num', l: 'Цена дюбеля за шт.', u: 'р.' },
    { t: 'h', l: 'Штукатурно-клеевая смесь' },
    { k: 'pc', t: 'num', l: 'Расход смеси (клей + базовый слой)', u: 'кг/м²', d: 10 },
    { k: 'plprice', t: 'num', l: 'Цена мешка 25 кг', u: 'р.' },
    { t: 'h', l: 'Сетка штукатурная (ширина 1 м)' },
    { k: 'gl', t: 'num', l: 'Длина рулона', u: 'м', d: 50 }, { k: 'gprice', t: 'num', l: 'Цена рулона', u: 'р.' },
    { t: 'h', l: 'Грунтовка' },
    { k: 'prc', t: 'num', l: 'Расход грунтовки', u: 'мл/м²', d: 150 }, { k: 'prl', t: 'num', l: 'Кол-во слоёв', u: 'шт.', d: 1 },
    { k: 'prv', t: 'num', l: 'Объём канистры', u: 'л.', d: 10 }, { k: 'prprice', t: 'num', l: 'Цена канистры', u: 'р.' }
  ],
  compute(v) {
    const S = vsum(v.area); if (!S) return null;
    const sp = pnum(v.pl) * pnum(v.pw) * 1e-6; if (!sp) return null;
    const plates = ceil(S / sp) * (pnum(v.layers) || 1), packs = ceil(plates / (pnum(v.pack) || 1));
    const dowCons = +v.dow + 2, dowels = plates * dowCons;
    const plaster = ceil(pnum(v.pc) * S / 25), grid = ceil(S / ((pnum(v.gl) || 50) * 0.9));
    const primer = ceil(pnum(v.prc) * S * (pnum(v.prl) || 1) / 1000 / (pnum(v.prv) || 10));
    const sP = priceSum(v, 'pprice', [plates, packs]) || 0, sD = dowels * pnum(v.dprice), sPl = plaster * pnum(v.plprice), sG = grid * pnum(v.gprice), sPr = primer * pnum(v.prprice);
    const rows = [['Площадь', S, 'м²'], ['Пенополистирол', plates, 'шт.'], ['  упаковок', packs, 'шт.'], ['  объём', S * pnum(v.th) / 1000 * (pnum(v.layers) || 1), 'м³'],
      ['Дюбель-гриб', dowels, 'шт.'], ['Штукатурно-клеевая смесь (25 кг)', plaster, 'меш.'], ['Сетка штукатурная', grid, 'рул.'], ['Грунтовка', primer, 'канистр']];
    const tot = sP + sD + sPl + sG + sPr;
    if (tot) { rows.push(['#', 'Стоимость']); [['Плиты', sP], ['Дюбели', sD], ['Смесь', sPl], ['Сетка', sG], ['Грунтовка', sPr]].forEach(([l, s]) => s && rows.push([l, money(s)])); rows.push(['=', 'Итого', money(tot)]); }
    return { rows };
  }
});
defCalc({
  id: 'soft', sec: ['build', 'insul'], title: 'Мягкий утеплитель', head: 'МЯГКИЙ УТЕПЛИТЕЛЬ',
  fields: [
    { k: 'area', t: 'vlist', l: 'Площадь утепления', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { k: 'type', t: 'radio', l: 'Вид утеплителя', o: ['Листовой', 'Рулонный'], d: 0 },
    { k: 'L', t: 'num', l: 'Длина', u: 'мм', d: 1200 }, { k: 'W', t: 'num', l: 'Ширина', u: 'мм', d: 600 },
    { k: 'H', t: 'num', l: 'Толщина', u: 'мм', d: 50 },
    { k: 'layers', t: 'num', l: 'Кол-во слоёв', u: 'шт.', d: 1 },
    { k: 'pack', t: 'num', l: 'Кол-во в упаковке', u: 'шт.', d: 8 },
    { k: 'price', t: 'price', l: 'Цена', o: ['за упаковку', PRICE_PIECE] }
  ],
  compute(v) {
    const S = vsum(v.area); if (!S) return null;
    const st = pnum(v.L) * pnum(v.W) * 1e-6; if (!st || !pnum(v.H)) return null;
    const n = ceil(S / st) * (pnum(v.layers) || 1), packs = ceil(n / (pnum(v.pack) || 1));
    const vol = n * st * pnum(v.H) / 1000;
    const rows = [['Площадь', S, 'м²'], [v.type == 1 ? 'Рулонов' : 'Плит (листов)', n, 'шт.'], ['Упаковок', packs, 'шт.'], ['Объём утеплителя', vol, 'м³'], ['Площадь утеплителя', n * st, 'м²']];
    const sum = priceSum(v, 'price', [packs, n]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'balk', sec: ['build'], title: 'Доска, брус', head: 'ДОСКА, БРУС',
  fields: [
    { k: 'L', t: 'num', l: 'Длина', u: 'мм', d: 6000 }, { k: 'W', t: 'num', l: 'Ширина', u: 'мм', d: 150 }, { k: 'H', t: 'num', l: 'Толщина', u: 'мм', d: 50 },
    { k: 'mode', t: 'radio', l: 'Расчёт через:', o: ['Количество (шт.)', 'Объём (м³)'], d: 0 },
    { k: 'K', t: 'num', l: v => v.mode == 1 ? 'Объём' : 'Количество', u: v => v.mode == 1 ? 'м³' : 'шт.' },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_M3, PRICE_PIECE] }
  ],
  compute(v) {
    const vol1 = pnum(v.L) * pnum(v.W) * pnum(v.H) * 1e-9, K = pnum(v.K); if (!vol1 || !K) return null;
    let cnt, vol; if (v.mode == 1) { vol = K; cnt = ceil(K / vol1); } else { cnt = K; vol = vol1 * K; }
    const rows = [['Объём 1 шт.', vol1, 'м³'], ['Штук в 1 м³', 1 / vol1, 'шт.'], ['Количество', cnt, 'шт.'], ['Общий объём', v.mode == 1 ? cnt * vol1 : vol, 'м³'], ['Погонаж', cnt * pnum(v.L) / 1000, 'п.м.'], ['Площадь (по ширине)', cnt * pnum(v.L) * pnum(v.W) * 1e-6, 'м²']];
    const sum = priceSum(v, 'price', [v.mode == 1 ? cnt * vol1 : vol, cnt]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'timbers', sec: ['build'], title: 'Брёвна', head: 'БРЁВНА',
  fields: [
    { k: 'D', t: 'num', l: 'Диаметр бревна', u: 'см', d: 20 }, { k: 'L', t: 'num', l: 'Длина бревна', u: 'м', d: 6 },
    { k: 'mode', t: 'radio', l: 'Расчёт через:', o: ['Количество (шт.)', 'Объём (м³)'], d: 0 },
    { k: 'K', t: 'num', l: v => v.mode == 1 ? 'Объём' : 'Количество', u: v => v.mode == 1 ? 'м³' : 'шт.' },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_M3, PRICE_PIECE] }
  ],
  compute(v) {
    const vol1 = Math.pow(pnum(v.D) * 0.01 / 2, 2) * Math.PI * pnum(v.L), K = pnum(v.K); if (!vol1 || !K) return null;
    let cnt, vol; if (v.mode == 1) { vol = K; cnt = K / vol1; } else { cnt = K; vol = vol1 * K; }
    const rows = [['Объём 1 бревна', vol1, 'м³'], ['Брёвен в 1 м³', 1 / vol1, 'шт.'], ['Количество', cnt, 'шт.'], ['Общий объём', vol, 'м³']];
    const sum = priceSum(v, 'price', [vol, cnt]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
const LOOSE = ['Щебень гранитный', 'Щебень песчаник', 'Щебень мраморный', 'Щебень известняковый', 'Щебень шлаковый', 'Гравий', 'ПГС - песчано-гравийная смесь', 'Песок строительный (ГОСТ 8736—93)', 'Песок речной', 'Керамзит', 'Вермикулит вспученный (ГОСТ 12865—67)'];
const LOOSE_W = [1470, 1300, 1500, 1300, 1500, 1400, 1600, 1625, 1630, 500, 150];
defCalc({
  id: 'loose', sec: ['build'], title: 'Сыпучие материалы', head: 'СЫПУЧИЕ МАТЕРИАЛЫ',
  fields: [
    { k: 'mat', t: 'sel', l: 'Вид материала', o: LOOSE.map((x, i) => x + ' — ' + LOOSE_W[i] + ' кг/м³'), d: 0 },
    { k: 'vol', t: 'vlist', l: 'Объём (площадь × толщина)', dims: ['Длина', 'Ширина', 'Толщина'], u: 'м', unit: 'м³' },
    { k: 'ram', t: 'chk', l: 'Учесть трамбовку', d: false },
    { k: 'k', t: 'num', l: 'Коэффициент уплотнения', d: 1.2, show: v => v.ram },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_M3, PRICE_T] }
  ],
  compute(v) {
    const V = vsum(v.vol); if (!V) return null;
    const k = v.ram ? (pnum(v.k) || 1) : 1, Vk = V * k, w = Vk * LOOSE_W[v.mat];
    const rows = [['Объём', V, 'м³']]; if (k !== 1) rows.push(['Объём с учётом уплотнения', Vk, 'м³']);
    rows.push(['Вес материала', w, 'кг'], ['', w / 1000, 'т.']);
    const sum = priceSum(v, 'price', [Vk, w / 1000]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
const ARM_D = [5.5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50];
const ARM_KG = [0.187, 0.222, 0.395, 0.617, 0.888, 1.21, 1.58, 2.0, 2.47, 2.98, 3.85, 4.83, 6.31, 7.99, 9.87, 12.48, 15.41];
defCalc({
  id: 'armature', sec: ['build'], title: 'Арматура', head: 'РАСЧЁТ АРМАТУРЫ',
  fields: [
    { k: 'd', t: 'sel', l: 'Диаметр арматуры', o: ARM_D.map(x => num(x) + ' мм. — ' + num(ARM_KG[ARM_D.indexOf(x)], 3) + ' кг/м'), d: 4 },
    { k: 'L', t: 'num', l: 'Длина стержня', u: 'м', d: 11.7 },
    { k: 'mode', t: 'radio', l: 'Расчёт через:', o: ['Количество (шт.)', 'Вес (т.)'], d: 0 },
    { k: 'K', t: 'num', l: v => v.mode == 1 ? 'Вес' : 'Количество', u: v => v.mode == 1 ? 'т.' : 'шт.' },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_T, PRICE_PIECE] }
  ],
  compute(v) {
    const L = pnum(v.L), K = pnum(v.K); if (!L || !K) return null;
    const kg = ARM_KG[v.d], one = kg * L, dd = ARM_D[v.d] / 1000;
    let cnt, t; if (v.mode == 1) { t = K; cnt = K * 1000 / one; } else { cnt = K; t = one * K / 1000; }
    const rows = [['Вес 1 п.м.', kg, 'кг'], ['Вес одного прута', one, 'кг'], ['Количество', cnt, 'шт.'], ['Общий вес', t, 'т.'], ['Погонаж арматуры', cnt * L, 'п.м.'], ['Объём арматуры', Math.PI * dd * dd / 4 * L * cnt, 'м³']];
    const sum = priceSum(v, 'price', [t, cnt]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
/* ---------- заборы ---------- */
function fenceFields(type) {
  const f = [
    { k: 'sides', t: 'vlist', l: 'Длина сторон забора', dims: ['Длина'], u: 'м', unit: 'м', nosign: true },
    { k: 'H', t: 'num', l: 'Высота забора', u: 'м', d: 2 },
    { t: 'h', l: type === 'brick' ? 'Кирпичные столбы' : 'Столбы' },
    { k: 'pi', t: 'num', l: 'Интервал столбов', u: 'м', d: type === 'brick' ? 3 : 2.5 },
    { k: 'pl', t: 'num', l: type === 'brick' ? 'Длина металлической трубы (сердечник)' : 'Длина столба', u: 'м', d: 3 },
    { k: 'pp', t: 'price', l: 'Цена столба', o: [PRICE_PM, PRICE_PIECE] }
  ];
  if (type === 'brick') f.push(
    { k: 'bs', t: 'sel', l: 'Сечение столба', o: ['380×380 (1,5 × 1,5 кирпича)', '510×510 (2 × 2 кирпича)', '250×250 (1 × 1 кирпич)'], d: 0 },
    { k: 'bprice', t: 'num', l: 'Цена кирпича за шт.', u: 'р.' });
  f.push({ t: 'h', l: 'Лаги (поперечины)' },
    { k: 'jr', t: 'sel', l: 'Кол-во рядов', o: ['2 ряда', '3 ряда'], d: type === 'picket' ? 0 : 0 },
    { k: 'jl', t: 'num', l: 'Длина лаги', u: 'м', d: 6 },
    { k: 'jp', t: 'price', l: 'Цена лаги', o: [PRICE_PM, PRICE_PIECE] });
  if (type === 'picket') f.push({ t: 'h', l: 'Евроштакетник' },
    { k: 'kw', t: 'num', l: 'Ширина штакетины', u: 'мм', d: 118 }, { k: 'kg', t: 'num', l: 'Интервал между штакетинами', u: 'мм', d: 40 },
    { k: 'k2', t: 'chk', l: 'Двухсторонний монтаж (шахматка)', d: false },
    { k: 'kp', t: 'num', l: 'Цена штакетины', u: 'р.' });
  else f.push({ t: 'h', l: 'Профлист' },
    { k: 'ww', t: 'num', l: 'Рабочая ширина листа', u: 'м', d: 1.15 },
    { k: 'lp', t: 'price', l: 'Цена профлиста', o: ['за лист', PRICE_M2] });
  f.push({ t: 'h', l: 'Саморезы и бетонирование' },
    { k: 'sp', t: 'num', l: 'Цена самореза', u: 'р.' },
    { k: 'hd', t: 'num', l: 'Диаметр скважины', u: 'см', d: 20 }, { k: 'hh', t: 'num', l: 'Глубина скважины', u: 'м', d: 1 },
    { k: 'cp', t: 'num', l: 'Цена мешка цемента (50 кг)', u: 'р.' },
    { k: 'job', t: 'num', l: 'Цена работы за п.м.', u: 'р.' });
  return f;
}
function fenceCompute(type, v) {
  const sides = (v.sides && v.sides.rows || []).map(r => pnum(r.d[0]) * (pnum(r.q) || 1)).filter(x => x > 0);
  const all = sides.reduce((a, b) => a + b, 0), H = pnum(v.H), pi = pnum(v.pi);
  if (!all || !H || !pi) return null;
  let pillars = 0; sides.forEach((l, i) => pillars += i === 0 ? ceil(l / pi) + 1 : ceil(l / pi));
  const pl = pnum(v.pl), rowsJ = +v.jr + 2, jl = pnum(v.jl) || 6;
  const lagM = all * rowsJ, lagPcs = ceil(lagM / jl);
  const rows = [['Длина забора', all, 'м'], ['Кол-во сторон', sides.length, 'шт.'], ['#', 'Материалы']];
  const sums = [];
  rows.push([type === 'brick' ? 'Столбы (труба-сердечник)' : 'Столбы', pillars, 'шт.'], ['  погонаж столбов', pillars * pl, 'п.м.']);
  sums.push(['Столбы', priceSum(v, 'pp', [pillars * pl, pillars])]);
  rows.push(['Лаги', lagM, 'п.м.'], ['  кол-во по ' + num(jl) + ' м', lagPcs, 'шт.']);
  sums.push(['Лаги', priceSum(v, 'jp', [lagM, lagPcs])]);
  let screws;
  if (type === 'picket') {
    const step = (pnum(v.kw) + pnum(v.kg)) / 1000; if (!step) return null;
    let pk = ceil(all / step); if (v.k2) pk *= 2;
    screws = ceil(rowsJ * pk * 2);
    rows.push(['Евроштакетник', pk, 'шт.'], ['  погонаж', pk * H, 'п.м.']);
    sums.push(['Штакетник', pk * pnum(v.kp)]);
  } else {
    const ww = pnum(v.ww) || 1.15; const sheets = sides.reduce((a, l) => a + ceil(l / ww), 0);
    screws = ceil(lagM / 0.3);
    rows.push(['Профлист', sheets, 'лист.'], ['  площадь', sheets * ww * H, 'м²']);
    sums.push(['Профлист', priceSum(v, 'lp', [sheets, sheets * ww * H])]);
  }
  rows.push(['Саморезы кровельные', screws, 'шт.']); sums.push(['Саморезы', screws * pnum(v.sp)]);
  if (type === 'brick') {
    const perRow = [4.5, 8, 2][v.bs], brows = ceil((H + 0.2) / 0.077), bricks = ceil(perRow * brows * pillars);
    rows.push(['Кирпич на столбы', bricks, 'шт.'], ['  рядов в столбе', brows, 'шт.']);
    sums.push(['Кирпич', bricks * pnum(v.bprice)]);
  }
  const r = pnum(v.hd) / 200, Vc = Math.PI * r * r * pnum(v.hh) * pillars;
  if (Vc) {
    const p = concretePerM3({ betM: 196, cemM: 400 });
    const cem = p.cem * Vc, bags = ceil(cem / 50);
    rows.push(['#', 'Бетонирование столбов (B15 М-200)'], ['Объём бетона', Vc, 'м³'], ['Цемент М-400', cem, 'кг'], ['  мешков по 50 кг', bags, 'шт.'], ['Песок', p.pes * Vc, 'кг'], ['Щебень', p.sheb * Vc, 'кг'], ['Вода', p.water * Vc, 'л.']);
    sums.push(['Цемент', bags * pnum(v.cp)]);
  }
  sums.push(['Работа', all * pnum(v.job)]);
  const tot = sums.reduce((a, [, s]) => a + (s || 0), 0);
  if (tot) { rows.push(['#', 'Стоимость']); sums.forEach(([l, s]) => s && rows.push([l, money(s)])); rows.push(['=', 'Итого', money(tot)]); }
  return { rows };
}
defCalc({ id: 'fence_l', sec: ['fence'], title: 'Сплошной забор', head: 'ЗАБОР ИЗ ПРОФЛИСТА', help: 'instruction_fence_l', fields: fenceFields('light'), compute: v => fenceCompute('light', v) });
defCalc({ id: 'fence_b', sec: ['fence'], title: 'Забор с кирпичными столбами', head: 'ЗАБОР С КИРПИЧНЫМИ СТОЛБАМИ', help: 'instruction_fence_b', fields: fenceFields('brick'), compute: v => fenceCompute('brick', v) });
defCalc({ id: 'fence_p', sec: ['fence'], title: 'Забор из евроштакетника', head: 'ЗАБОР ИЗ ЕВРОШТАКЕТНИКА', help: 'instruction_fence_p', fields: fenceFields('picket'), compute: v => fenceCompute('picket', v) });

/* ============================ ОТДЕЛКА ============================ */
const GKL_FORMATS = ['3000 x 1200 мм.', '2500 x 1200 мм.', '2000 x 1200 мм.', '1500 x 1200 мм.', '1500 x 600 мм.', 'Другой размер'];
const GKL_W = [1.2, 1.2, 1.2, 1.2, 0.6], GKL_L = [3.0, 2.5, 2.0, 1.5, 1.5];
const gklFmtFields = [
  { k: 'fmt', t: 'sel', l: 'Формат листов', o: GKL_FORMATS, d: 1 },
  { k: 'gl', t: 'num', l: 'Длина листа', u: 'мм', d: 2500, show: v => v.fmt == 5 },
  { k: 'gw', t: 'num', l: 'Ширина листа', u: 'мм', d: 1200, show: v => v.fmt == 5 },
  { k: 'layer', t: 'radio', l: 'Слои', o: ['Один слой', 'Два слоя'], d: 0 }
];
const gklSize = v => v.fmt == 5 ? [pnum(v.gw) / 1000 || 1.2, pnum(v.gl) / 1000 || 2.5] : [GKL_W[v.fmt], GKL_L[v.fmt]];
function gklRows(o) {
  const rows = [['Площадь', o.s, 'м²'], ['ГКЛ', o.gkl, 'лист.']];
  if (o.pn !== undefined) rows.push([o.pnName || 'Профиль ПН 28/27 (UD 28), 3 м', o.pn, 'шт.']);
  if (o.pp !== undefined) rows.push([o.ppName || 'Профиль ПП 60/27 (CD 60), 3 м', o.pp, 'шт.']);
  if (o.pd) rows.push(['Подвес прямой', o.pd, 'шт.']);
  if (o.kr) rows.push(['Краб (соединитель)', o.kr, 'шт.']);
  if (o.udl) rows.push(['Удлинитель профилей 60/27', o.udl, 'шт.']);
  rows.push(['Дюбель-гвоздь 6×40', o.db, 'шт.'], ['Саморез ПШ 4,2×13 (клоп)', o.pw, 'шт.'], ['Саморез 3,5×25', o.sm25, 'шт.']);
  if (o.sm35) rows.push(['Саморез 3,5×35', o.sm35, 'шт.']);
  rows.push(['Лента для швов (серпянка)', o.band, 'п.м.'], ['Шпаклёвка для швов (≈0,25 кг/п.м.)', o.band * 0.25, 'кг']);
  return rows;
}
defCalc({
  id: 'gyps_roof', sec: ['gyps'], title: 'ГКЛ (Потолок)', head: 'ГИПСОКАРТОН — ПОТОЛОК', help: 'gyps_roof_help', img: 'gyps_roof',
  fields: [{ k: 'a', t: 'num', l: 'Длина потолка (по длине ГКЛ)', u: 'м' }, { k: 'b', t: 'num', l: 'Ширина потолка', u: 'м' }, ...gklFmtFields,
    { k: 'cell', t: 'sel', l: 'Формат ячеек каркаса', o: ['600 x 500 мм.', '600 x 600 мм.', '400 x 400 мм.', '400 x 500 мм.', '400 x 600 мм.', '400 x L листа мм.'], d: 1 }],
  compute(v) {
    const l = pnum(v.a), w = pnum(v.b); if (!l || !w) return null;
    const [gw, gL] = gklSize(v), layer = +v.layer + 1, st = +v.cell, lenPP = 3, lenPN = 3;
    const wc = [0.6, 0.6, 0.4, 0.4, 0.4, 0.4][st], hc = [0.5, 0.6, 0.4, 0.5, 0.6, gL][st];
    const s = l * w; let gkl = ceil(s / (gL * gw));
    const per = (l + w) * 2, pn = ceil(per / lenPN);
    let kh, kw, f3;
    if (st < 5) { kh = dm(l, hc); kw = dm(w, wc); f3 = kh * w + kw * l; }
    else { kw = dm(w, wc); kh = dm(l, gL); f3 = l > gL ? kw * l + w : kw * l; if (layer === 2) f3 += w; }
    const udl = l > lenPP ? dm(l, lenPP) * kw : 0;
    const pp = ceil(f3 / lenPP), pd = kw * dm(l, 0.7), kr = kh * kw;
    const db = ceil(pd * 2 + per / 0.4 + 2), pw = ceil(pd * 2 + kr * 8 + (kh + kw) * 2);
    let sm25, sm35 = 0;
    if (layer === 2) { gkl *= 2; sm25 = ceil((per + f3 + lenPP) / 0.7); sm35 = ceil((per + f3 + lenPP) / 0.22 + l * (l > gL && st < 2 ? 6 : 3)); }
    else sm25 = ceil((per + f3 + lenPP) / 0.22);
    let band = dm(w, gw) * l; if (l >= gL) band += w * dm(l, gL);
    return { rows: [['Периметр', per, 'м'], ...gklRows({ s, gkl, pn, pp, pd, kr, udl, db, pw, sm25, sm35, band })] };
  }
});
defCalc({
  id: 'gyps_wall', sec: ['gyps'], title: 'ГКЛ (Обшивка стен)', head: 'ГИПСОКАРТОН — ОБШИВКА СТЕН', help: 'gyps_wall_help', img: 'gyps_wall',
  fields: [{ k: 'a', t: 'num', l: 'Ширина стены', u: 'м' }, { k: 'b', t: 'num', l: 'Высота стены', u: 'м' }, ...gklFmtFields,
    { k: 'step', t: 'radio', l: 'Шаг стоек', o: ['400 мм.', '600 мм.'], d: 1 }],
  compute(v) {
    const w = pnum(v.a), hh = pnum(v.b); if (!w || !hh) return null;
    const [gw, gL] = gklSize(v), layer = +v.layer + 1, step = v.step == 0 ? 0.4 : 0.6, lenPP = 3;
    const s = hh * w, gkl = ceil(s * layer / (gL * gw));
    const kw = dm(w, step), per = (hh + w) * 2, pn = ceil(per / 3), kh = dm(w, gL);
    let f4 = kw * hh; if (hh > gL) f4 += w; if (layer === 2) f4 += w;
    const pp = ceil(f4 / lenPP); let kr = kh * kw; const pd = kw * dm(hh, 0.7);
    const db = ceil(pd * 2 + per / 0.4 + 2); let pw = ceil(pd * 2 + kr * 8 + (kw + kh) * 2);
    let sm25, sm35 = 0;
    if (layer === 2) { if (hh > gL) { pw += ceil(kw * 4); kr *= 2; } sm25 = ceil((per + f4 + lenPP) / 0.7); sm35 = ceil((per + f4 + lenPP) / 0.22 + w * (hh > gL && step === 0.6 ? 6 : 3)); }
    else sm25 = ceil((per + f4 + lenPP) / 0.22);
    const udl = hh > lenPP ? floor((hh / lenPP) * kw) : 0;
    let band = dm(w, gw) * hh; if (hh > gL) band += w;
    return { rows: gklRows({ s, gkl, pn, pp, pd, kr, udl, db, pw, sm25, sm35, band }) };
  }
});
defCalc({
  id: 'gyps_part', sec: ['gyps'], title: 'ГКЛ (Перегородки)', head: 'ГИПСОКАРТОН — ПЕРЕГОРОДКА', help: 'gyps_divider_help', img: 'gyps_part',
  fields: [{ k: 'a', t: 'num', l: 'Длина перегородки', u: 'м' }, { k: 'b', t: 'num', l: 'Высота перегородки', u: 'м' }, ...gklFmtFields,
    { k: 'step', t: 'radio', l: 'Шаг стоек', o: ['300 мм.', '400 мм.', '600 мм.'], d: 2 },
    { k: 'prof', t: 'sel', l: 'Профиль', o: ['ПН/ПС 50 (UW/CW 50)', 'ПН/ПС 75 (UW/CW 75)', 'ПН/ПС 100 (UW/CW 100)'], d: 0 },
    { k: 'doors', t: 'num', l: 'Кол-во дверных проёмов', u: 'шт.', d: 0 }],
  compute(v) {
    const w = pnum(v.a), hh = pnum(v.b); if (!w || !hh) return null;
    const [gw, gL] = gklSize(v), layer = +v.layer + 1, step = [0.3, 0.4, 0.6][v.step], lenPP = 3, lenPN = 3;
    const s = w * hh, gkl = ceil(s * layer * 2 / (gL * gw)), kpp = dm(w, step), per = (w + hh) * 2;
    const pn = ceil((per + pnum(v.doors) * 0.9) / lenPN);
    let f5 = kpp * hh; if (hh > gL) f5 += w;
    if (hh > gL && layer === 2 && step === 0.6) f5 += w * 2; if (hh > gL && layer === 1 && step === 0.6) f5 += w;
    f5 += pnum(v.doors) * (hh * 2 + 1.2); // стойки и перемычки проёмов
    const pp = ceil(f5 / lenPP), db = ceil(((w + hh) * 2) / 0.4 + 2);
    let pw = ceil(hh > gL ? kpp * 7 : kpp * 4), sm25, sm35 = 0;
    if (layer === 2) { if (hh > gL) pw += ceil(kpp * 2); sm25 = ceil((per + f5) / 0.7 * 2); sm35 = ceil((per + f5) / 0.22 * 2 + w * (hh > gL && step === 0.6 ? 6 : 3)); }
    else sm25 = ceil((per + f5) / 0.22 * 2 + w * (hh > gL && step === 0.6 ? 6 : 3));
    let band = dm(w, gw) * hh; if (hh > gL) band += w; band *= 2;
    const pr = ['50', '75', '100'][v.prof];
    return { rows: [...gklRows({ s, gkl, pn, pnName: `Профиль ПН ${pr} (UW ${pr}), 3 м`, pp, ppName: `Профиль ПС ${pr} (CW ${pr}), 3 м`, db, pw, sm25, sm35, band }), ['Утеплитель (звукоизоляция)', s, 'м²']] };
  }
});
const SPIN_GROUT = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 6, 7, 8, 10];
defCalc({
  id: 'tile', sec: ['finish'], title: 'Керамическая плитка', head: 'ПЛИТКА', help: 'tile_help',
  fields: [
    { k: 'area', t: 'vlist', l: 'Площадь укладки', dims: ['Длина', 'Ширина'], u: 'м', unit: 'м²' },
    { k: 'L', t: 'num', l: 'Длина плитки', u: 'см', d: 30 }, { k: 'W', t: 'num', l: 'Ширина плитки', u: 'см', d: 30 },
    { k: 'res', t: 'num', l: 'Запас', u: '%', d: 10 },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_M2, PRICE_PIECE] },
    { t: 'h', l: 'Плиточный клей' },
    { k: 'layer', t: 'num', l: 'Толщина слоя клея', u: 'мм', d: 4 },
    { k: 'glue', t: 'consSel', group: 'Плиточный клей', l: 'Клей (расход кг/м² на 1 мм)', d: 1.3 },
    { k: 'gbag', t: 'num', l: 'Вес мешка клея', u: 'кг', d: 25 },
    { t: 'h', l: 'Затирка' },
    { k: 'seam', t: 'sel', l: 'Ширина швов', o: SPIN_GROUT.map(x => num(x) + ' мм.'), d: 3 },
    { k: 'th', t: 'sel', l: 'Толщина плитки', o: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(x => x + ' мм.'), d: 6 },
    { k: 'pg', t: 'num', l: 'Плотность затирки', u: 'кг/дм³', d: 1.8 }, { k: 'pac', t: 'num', l: 'Фасовка затирки', u: 'кг', d: 2 },
    { k: 'svp', t: 'chk', l: 'Расчёт СВП (системы выравнивания плитки)', d: false }
  ],
  compute(v) {
    const S = vsum(v.area), l = pnum(v.L), w = pnum(v.W); if (!S || !l || !w) return null;
    const st = l * w / 10000, n = ceil(S / st + pnum(v.res) / 100 * (S / st));
    const rows = [['Площадь', S, 'м²'], ['Площадь плитки', st, 'м²'], ['Кол-во плитки', n, 'шт.'], ['  площадь с запасом', n * st, 'м²']];
    if (pnum(v.layer)) { const g = pnum(v.layer) * (pnum(v.glue) || 1.3) * S; rows.push(['Расход клея', g, 'кг'], ['  мешков по ' + num(pnum(v.gbag) || 25) + ' кг', ceil(g / (pnum(v.gbag) || 25)), 'шт.']); }
    const seam = SPIN_GROUT[v.seam], th = +v.th + 2;
    if (seam) { const kg = ((l + w) * th * seam * (pnum(v.pg) || 1.8)) / (l * w) * (S / 10); rows.push(['Расход затирки', kg, 'кг'], ['  упаковок по ' + num(pnum(v.pac) || 2) + ' кг', ceil(kg / (pnum(v.pac) || 2)), 'шт.']); }
    if (v.svp) rows.push(['СВП (зажимы), ≈3,9 на плитку', ceil(n * 3.9), 'шт.']);
    const sum = priceSum(v, 'price', [n * st, n]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'ceiling', sec: ['finish'], title: 'Реечный потолок', head: 'РЕЕЧНЫЙ ПОТОЛОК', help: 'ceiling_help',
  fields: [{ k: 'x', t: 'num', l: 'Длина потолка (вдоль реек, до 4 м)', u: 'м' }, { k: 'y', t: 'num', l: 'Ширина потолка', u: 'м' },
    { k: 'a', t: 'num', l: 'Ширина рейки', u: 'мм', d: 100 }, { k: 'b', t: 'num', l: 'Ширина вставки', u: 'мм', d: 0 },
    { k: 'pp', t: 'num', l: 'Цена рейки за п.м.', u: 'р.' }],
  compute(v) {
    const x = pnum(v.x), y = pnum(v.y), a = pnum(v.a), b = pnum(v.b); if (!x || !y || !a) return null;
    if (x > 4) return { err: 'Длина потолка превышает длину панели!' }; if (a > 600) return { err: 'Неправильная ширина панели!' };
    const s = x * y, p = (x + y) * 2, d = (a + b) * 0.001, w = ceil(y / d), wr = floor(y / d);
    const variant = L => { const per = Math.max(1, floor(L / x)); const pn = ceil(w / per), vv = b ? ceil(wr / per) : 0; const waste = pn * L - w * x; return { L, pn, vv, waste, per }; };
    const v3 = variant(3), v4 = variant(4); let best = x > 3 ? v4 : (v3.waste <= v4.waste ? v3 : v4);
    const ug = ceil(p / 3);
    const shRows = Math.max(2, ceil((x - 0.6) / 1.0) + 1), shLen = shRows * y;
    const rows = [['Площадь', s, 'м²'], ['Периметр', p, 'м'], ['Рейки по ' + best.L + ' м', best.pn, 'шт.'], ['  из одной рейки', best.per, 'отрезков'], ['  остатки от реек', best.waste, 'м']];
    if (b) rows.push(['Вставки по ' + best.L + ' м', best.vv, 'шт.']);
    rows.push(['Уголок (пристенный) 3 м', ug, 'шт.'], ['  остатки от уголка', ug * 3 - p, 'м'], ['Шина (стрингер), рядов', shRows, 'шт.'], ['  общая длина шины', shLen, 'м'], ['  шина по 4 м', ceil(shLen / 4), 'шт.'], ['Подвесы (шаг 1 м)', shRows * ceil(y / 1), 'шт.']);
    if (pnum(v.pp)) rows.push(['=', 'Сумма за рейки', money(best.pn * best.L * pnum(v.pp))]);
    return { rows };
  }
});
const WP_SIZES = [[0.53, 10], [1.06, 10], [0.53, 15], [1.06, 25], [0.7, 10]];
defCalc({
  id: 'wallpaper', sec: ['finish'], title: 'Обои', head: 'ОБОИ', help: 'wallpaper_help',
  fields: [{ k: 'p', t: 'num', l: 'Длина стен (периметр)', u: 'м' }, { k: 'h', t: 'num', l: 'Высота стен', u: 'м', d: 2.7 },
    { k: 'size', t: 'sel', l: 'Размер обоев', o: ['0,53 х 10 м.', '1,06 х 10 м.', '0,53 х 15 м.', '1,06 х 25 м.', '0,7 х 10 м.', 'Другой размер'], d: 1 },
    { k: 'rw', t: 'num', l: 'Ширина рулона', u: 'м', d: 1.06, show: v => v.size == 5 }, { k: 'rl', t: 'num', l: 'Длина рулона', u: 'м', d: 10, show: v => v.size == 5 },
    { k: 'step', t: 'num', l: 'Шаг рисунка (раппорт)', u: 'см', d: 0 }, { k: 'price', t: 'num', l: 'Цена за рулон', u: 'р.' }],
  compute(v) {
    const p = pnum(v.p), hh = pnum(v.h); if (!p || !hh) return null; if (hh > 10) return { err: 'Нереальная высота стен!' };
    const [wr, lr] = v.size == 5 ? [pnum(v.rw), pnum(v.rl)] : WP_SIZES[v.size]; if (!wr || !lr) return null;
    let ll = hh, obr = 0; const st = pnum(v.step) / 100;
    if (st) { ll = ceil(hh / st - 1e-9) * st; obr = ll - hh; }
    const c = floor(lr / ll + 1e-9); if (!c) return { err: 'Высота стены больше длины рулона!' };
    const strips = ceil(p / wr - 1e-9), rem = strips % c, rolls = rem ? floor(strips / c) + 1 : strips / c;
    const ost = rem ? lr - rem * ll : 0, ost3 = lr - c * ll;
    const rows = [['Площадь стен', p * hh, 'м²'], ['Полос (листов)', strips, 'шт.'], ['Длина полосы', ll, 'м'], ['Полос из одного рулона', c, 'шт.'], ['Рулонов', rolls, 'шт.']];
    if (obr > 0.01) rows.push(['Обрезок от полосы (подгонка рисунка)', obr, 'м']);
    if (ost3 > 0.01) rows.push(['Остаток от рулона', ost3, 'м']);
    if (ost > 0.01) rows.push(['Остаток от последнего рулона', ost, 'м']);
    rows.push(['Обрезок по ширине последней полосы', strips * wr - p, 'м']);
    if (pnum(v.price)) rows.push(['=', 'Сумма', money(rolls * pnum(v.price))]);
    return { rows };
  }
});
defCalc({
  id: 'linoleum', sec: ['finish'], title: 'Линолеум', head: 'ЛИНОЛЕУМ', help: 'lin_help',
  fields: [{ k: 'a', t: 'num', l: 'Сторона A (ширина, до 5 м)', u: 'м' }, { k: 'b', t: 'num', l: 'Сторона B (длина раската)', u: 'м' },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_PM, PRICE_M2] }],
  compute(v) {
    const w = pnum(v.a), l = pnum(v.b); if (!w || !l) return null; if (w > 5) return { err: 'Ширина больше 5 м — разделите на несколько полотен' };
    let wr = Number.isInteger(w) ? w : (w - floor(w) <= 0.5 ? floor(w) + 0.5 : floor(w) + 1); if (w > 4) wr = 5; if (wr < 1.5) wr = 1.5;
    const lr = l + 0.1, sl = wr * lr;
    const rows = [['Площадь помещения', w * l, 'м²'], ['Периметр', (w + l) * 2, 'м'], ['Ширина рулона', wr, 'м'], ['Длина отреза (+10 см)', lr, 'м'], ['Площадь линолеума', sl, 'м²'], ['Обрезки', sl - w * l, 'м²']];
    const sum = priceSum(v, 'price', [lr, sl]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'laminate', sec: ['finish'], title: 'Ламинат', head: 'ЛАМИНАТ', help: 'laminate_help',
  fields: [{ k: 'a', t: 'num', l: 'Сторона A помещения', u: 'м' }, { k: 'b', t: 'num', l: 'Сторона B помещения', u: 'м' },
    { k: 'dir', t: 'radio', l: 'Монтаж', o: ['Вдоль стороны A', 'Вдоль стороны B'], d: 0 },
    { k: 'pl', t: 'num', l: 'Длина панели', u: 'мм', d: 1380 }, { k: 'pw', t: 'num', l: 'Ширина панели', u: 'мм', d: 193 },
    { k: 'gap', t: 'num', l: 'Отступ от стены', u: 'мм', d: 10 }, { k: 'min', t: 'num', l: 'Минимальный отрезок / разбежка', u: 'мм', d: 300 },
    { k: 'pack', t: 'num', l: 'Кол-во в упаковке', u: 'шт.', d: 8 },
    { k: 'price', t: 'price', l: 'Цена', o: ['за упаковку', PRICE_M2, PRICE_PIECE] }],
  compute(v) {
    const A = pnum(v.a), B = pnum(v.b), pl = pnum(v.pl), pw = pnum(v.pw); if (!A || !B || !pl || !pw) return null;
    const gap = pnum(v.gap), minC = pnum(v.min) || 300, saw = 3;
    const along = (v.dir == 0 ? A : B) * 1000 - gap * 2, across = (v.dir == 0 ? B : A) * 1000 - gap * 2;
    if (along <= 0 || across <= 0) return null;
    const nRows = ceil(across / pw - 1e-9), lastW = across - (nRows - 1) * pw;
    let panels = 0, leftover = 0, prevS = null; const pool = []; const schema = [];
    const shiftOK = s => prevS === null || (Math.abs(s - prevS) >= minC && Math.abs(Math.abs(s - prevS) - pl) >= minC);
    for (let r = 0; r < nRows; r++) {
      let s;
      if (leftover >= minC && shiftOK(leftover)) { s = leftover; leftover = 0; }
      else {
        if (leftover > 0) pool.push(leftover); leftover = 0;
        s = r === 0 ? pl : null;
        if (s === null) { for (const k of [pl, pl - minC * 1.2, pl * 2 / 3, pl / 2, pl / 3]) { const c = Math.round(k); if (c >= minC && shiftOK(c)) { s = c; break; } } if (s === null) s = pl; }
        const pi = pool.findIndex(x => x >= s && x - s < minC); // подходящий остаток
        if (s < pl && pi >= 0) pool.splice(pi, 1); else { panels++; if (s < pl && pl - s - saw >= minC) pool.push(pl - s - saw); }
      }
      if (s > along) s = along;
      let rest = along - s, full = floor(rest / pl + 1e-9), e = Math.round(rest - full * pl);
      if (e > 0 && e < minC && s - (minC - e) >= minC) { s -= (minC - e); full = floor((along - s) / pl + 1e-9); e = Math.round(along - s - full * pl); }
      panels += full;
      if (e > 0) {
        pool.sort((x, y) => x - y); const pi = pool.findIndex(x => x >= e);
        if (pi >= 0) { const from = pool.splice(pi, 1)[0]; if (from - e - saw >= minC) pool.push(from - e - saw); }
        else { panels++; leftover = pl - e - saw; }
      }
      schema.push({ s: Math.round(s), full, e: Math.round(e), w: r === nRows - 1 ? lastW : pw });
      prevS = s;
    }
    const area = A * B, packs = ceil(panels / (pnum(v.pack) || 1)), pArea = panels * pl * pw * 1e-6;
    const rows = [['Площадь помещения', area, 'м²'], ['Рядов ламината', nRows, 'шт.'], ['Ширина последнего ряда', lastW, 'мм'], ['Панелей', panels, 'шт.'], ['Упаковок', packs, 'шт.'], ['Площадь ламината', pArea, 'м²'], ['Отходы', pArea - area, 'м²'], ['Подложка', area * 1.05, 'м²'], ['Плинтус (периметр)', (A + B) * 2, 'п.м.']];
    const sum = priceSum(v, 'price', [packs, packs * (pnum(v.pack) || 1) * pl * pw * 1e-6, panels]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    if (lastW < pw && lastW < 50) rows.push(['', 'Последний ряд узкий — сместите первый ряд', '']);
    const note = schema.map((r, i) => `${i + 1}-й: ${r.s === pl ? 'цел.' : r.s + ' мм.'}${r.full ? ' / ' + r.full + ' цел.' : ''}${r.e ? ' / ' + r.e + ' мм.' : ''}${r.w < pw ? '  (ширина ' + num(r.w) + ' мм.)' : ''}`).join('\n');
    return { rows, note: 'Раскладка по рядам:\n' + note, node: laminateSVG(schema, along, pl) };
  }
});
function laminateSVG(schema, along, pl) {
  const k = 900 / along; let y = 4, out = '';
  const pal = ['#d7b98a', '#c9a874', '#e3c99c', '#bf9b66'];
  schema.forEach((r, i) => {
    const hh = Math.max(8, r.w * k); let x = 4; const pieces = [r.s, ...Array(r.full).fill(pl), r.e].filter(z => z > 0);
    pieces.forEach((len, j) => { const ww = len * k; out += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${pal[(i + j) % 4]}" stroke="#6b4f2a" stroke-width="1"/>`; if (ww > 34 && hh > 12) out += `<text x="${x + ww / 2}" y="${y + hh / 2 + 4}" font-size="11" text-anchor="middle" fill="#3b2a12">${len === pl ? 'цел.' : Math.round(len)}</text>`; x += ww; });
    y += hh;
  });
  const div = h('div', { class: 'schema', html: `<svg viewBox="0 0 908 ${y + 4}" width="908" height="${y + 4}">${out}</svg>` });
  return div;
}
defCalc({
  id: 'panels', sec: ['finish'], title: 'Панели', head: 'ПАНЕЛИ (МДФ, ПВХ)', help: 'panels_help',
  fields: [{ k: 'area', t: 'vlist', l: 'Площадь обшивки', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { k: 'L', t: 'num', l: 'Длина панели', u: 'мм', d: 2700 }, { k: 'W', t: 'num', l: 'Ширина панели', u: 'мм', d: 250 },
    { k: 'res', t: 'num', l: 'Запас', u: '%', d: 0 }, { k: 'price', t: 'price', l: 'Цена', o: [PRICE_PIECE, PRICE_M2] }],
  compute(v) {
    const S = vsum(v.area), sp = pnum(v.L) * pnum(v.W) * 1e-6; if (!S || !sp) return null;
    const n = ceil(S * (1 + pnum(v.res) / 100) / sp);
    const rows = [['Площадь', S, 'м²'], ['Площадь панели', sp, 'м²'], ['Кол-во панелей', n, 'шт.']];
    const sum = priceSum(v, 'price', [n, S]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows };
  }
});
defCalc({
  id: 'plinth', sec: ['finish'], title: 'Плинтус', head: 'ПЛИНТУС', help: 'plinth_help',
  fields: [{ k: 'per', t: 'num', l: 'Периметр', u: 'м' }, { k: 'L', t: 'num', l: 'Длина плинтуса', u: 'м', d: 2.5 },
    { k: 'price', t: 'price', l: 'Цена', o: [PRICE_PIECE, PRICE_PM] }],
  compute(v) {
    const pr = pnum(v.per), l = pnum(v.L); if (!pr || !l) return null;
    const n = ceil(pr / l - 1e-9), sov = l / (n * l - pr);
    const rows = [['Кол-во плинтусов', n, 'шт.'], ['Погонаж', n * l, 'п.м.'], ['Остаток', n * l - pr, 'м'], ['Углы / заглушки (ориентир.)', 4, 'шт.']];
    const sum = priceSum(v, 'price', [n, n * l]); if (sum) rows.push(['=', 'Сумма', money(sum)]);
    return { rows, note: sov > 4 ? 'Совет: при таком периметре лучше взять плюс один плинтус на запас.' : '' };
  }
});
defCalc({
  id: 'armstrong', sec: ['finish'], title: 'Армстронг', head: 'ПОТОЛОК АРМСТРОНГ', help: 'armstrong_help',
  fields: [{ k: 'a', t: 'num', l: 'Длина потолка', u: 'м' }, { k: 'b', t: 'num', l: 'Ширина потолка', u: 'м' },
    { k: 'cell', t: 'radio', l: 'Формат ячеек', o: ['600 x 600 мм.', '1200 x 600 мм.'], d: 0 }],
  compute(v) {
    const a = pnum(v.a), b = pnum(v.b); if (!a || !b) return null;
    const s = a * b, p = (a + b) * 2, pu = ceil(p / 3 - 1e-9);
    const plt = v.cell == 0 ? ceil(s / 0.36 - 1e-9) : ceil(s / 0.72 - 1e-9);
    const mainRows = dm(b, 1.2) + 0, prLen = Math.max(1, mainRows) * a, pr = ceil(prLen / 3.7 - 1e-9);
    const p12 = dm(a, 0.6) * ceil(b / 1.2 - 1e-9), p06 = v.cell == 0 ? ceil(a / 0.6 - 1e-9) * ceil(b / 1.2 - 1e-9) : 0;
    const pd = ceil(prLen / 1.1), dg = pd + ceil(p / 0.4);
    const rows = [['Площадь', s, 'м²'], ['Периметр', p, 'м'], ['Плиты', plt, 'шт.'], ['Профиль несущий 3,7 м', pr, 'шт.'], ['Профиль поперечный 1,2 м', p12, 'шт.']];
    if (p06) rows.push(['Профиль поперечный 0,6 м', p06, 'шт.']);
    rows.push(['Профиль угловой 3 м', pu, 'шт.'], ['Подвесы', pd, 'шт.'], ['Дюбель-гвозди', dg, 'шт.']);
    return { rows };
  }
});
defCalc({
  id: 'dry_floor', sec: ['finish'], title: 'Насыпные полы', head: 'НАСЫПНЫЕ ПОЛЫ', help: 'dry_floor_help',
  fields: [{ k: 'w', t: 'num', l: 'Ширина', u: 'м' }, { k: 'l', t: 'num', l: 'Длина', u: 'м' }, { k: 't', t: 'num', l: 'Толщина пола (мин. 35)', u: 'мм', d: 50 }],
  compute(v) {
    const w = pnum(v.w), l = pnum(v.l), t = pnum(v.t); if (!w || !l || !t) return null;
    if (t < 35) return { err: 'Минимальная толщина пола - 35 мм.' };
    const S = w * l, P = (w + l) * 2, V = S * ((t - 20) / 1000), gvl = ceil(S / 0.72), add = t > 100 ? ceil(S / 3) : 0;
    const rows = [['Площадь пола', S, 'м²'], ['Периметр', P, 'м'], ['Элементы пола (1200×600)', gvl, 'шт.']];
    if (add) rows.push(['ГВЛ (2500 х 1200 х 10)', add, 'лист.']);
    rows.push(['Засыпка', V, 'м³'], ['  мешков по 50 л.', ceil(V / 0.05), 'шт.'], ['  мешков по 40 л.', ceil(V / 0.04), 'шт.'], ['Саморезы 3,5×19', gvl * 8 * 2, 'шт.'], ['Клей для фальцев (≈20 г/м²)', S * 20 / 1000, 'кг'], ['Лента кромочная', P, 'п.м.'], ['Гидроизоляция (плёнка, +15%)', S * 1.15, 'м²']);
    return { rows };
  }
});
defCalc({
  id: 'plasters', sec: ['finish'], title: 'Декоративная штукатурка и жидкие обои', head: 'ДЕКОРАТИВКА И ЖИДКИЕ ОБОИ',
  fields: [{ k: 'area', t: 'vlist', l: 'Площадь', dims: ['Длина', 'Высота'], u: 'м', unit: 'м²' },
    { k: 'dis', t: 'num', l: 'Расход на 1 м² (по данным производителя)', u: 'гр.', d: 1000 },
    { k: 'pack', t: 'num', l: 'Фасовка (вес упаковки)', u: 'кг', d: 15 }, { k: 'price', t: 'num', l: 'Цена за упаковку', u: 'р.' }],
  compute(v) {
    const S = vsum(v.area); if (!S || !pnum(v.dis)) return null;
    const kg = S * pnum(v.dis) / 1000, packs = pnum(v.pack) ? ceil(kg / pnum(v.pack)) : 0;
    const rows = [['Площадь', S, 'м²'], ['Кол-во материала', kg, 'кг']]; if (packs) rows.push(['Упаковок', packs, 'шт.']);
    if (packs && pnum(v.price)) rows.push(['=', 'Сумма', money(packs * pnum(v.price))]);
    return { rows };
  }
});

/* ============================ ПРОЧЕЕ ============================ */
defCalc({
  id: 'angle', sec: ['other'], title: 'Углы', head: 'ПРЯМОУГОЛЬНЫЙ / ПРОИЗВОЛЬНЫЙ ТРЕУГОЛЬНИК', help: 'angle_help', img: 'triangle_',
  fields: [{ k: 'var', t: 'sel', l: 'Известны', o: ['три стороны', 'две стороны A, B и угол c', 'две стороны B, C и угол a', 'две стороны A, C и угол b', 'два угла a, b и сторону C', 'два угла a, c и сторону B', 'два угла b, c и сторону A'], d: 0 },
    { k: 'A', t: 'num', l: 'Сторона A', u: 'м', show: v => [0, 1, 3, 6].includes(+v.var) }, { k: 'B', t: 'num', l: 'Сторона B', u: 'м', show: v => [0, 1, 2, 5].includes(+v.var) },
    { k: 'C', t: 'num', l: 'Сторона C', u: 'м', show: v => [0, 2, 3, 4].includes(+v.var) },
    { k: 'a', t: 'num', l: 'Угол a', u: '°', show: v => [2, 4, 5].includes(+v.var) }, { k: 'b', t: 'num', l: 'Угол b', u: '°', show: v => [3, 4, 6].includes(+v.var) },
    { k: 'c', t: 'num', l: 'Угол c', u: '°', show: v => [1, 5, 6].includes(+v.var) }],
  compute(v) {
    const R = Math.PI / 180; let A = pnum(v.A), B = pnum(v.B), C = pnum(v.C), a = pnum(v.a) * R, b = pnum(v.b) * R, c = pnum(v.c) * R;
    const lawC = (x, y, ang) => Math.sqrt(x * x + y * y - 2 * x * y * Math.cos(ang));
    const angC = (x, y, z) => Math.acos(Math.max(-1, Math.min(1, (x * x + y * y - z * z) / (2 * x * y)))); // угол против z
    switch (+v.var) {
      case 0: if (!A || !B || !C) return null; if (A + B <= C || A + C <= B || B + C <= A) return { err: 'Неправильный треугольник' }; a = angC(B, C, A); b = angC(A, C, B); c = Math.PI - a - b; break;
      case 1: if (!A || !B || !c) return null; C = lawC(A, B, c); a = angC(B, C, A); b = Math.PI - a - c; break;
      case 2: if (!B || !C || !a) return null; A = lawC(B, C, a); b = angC(A, C, B); c = Math.PI - a - b; break;
      case 3: if (!A || !C || !b) return null; B = lawC(A, C, b); a = angC(B, C, A); c = Math.PI - a - b; break;
      case 4: if (!a || !b || !C) return null; c = Math.PI - a - b; break;
      case 5: if (!a || !c || !B) return null; b = Math.PI - a - c; break;
      case 6: if (!b || !c || !A) return null; a = Math.PI - b - c; break;
    }
    if (a <= 0 || b <= 0 || c <= 0) return { err: 'Неправильный треугольник' };
    const k = A ? A / Math.sin(a) : B ? B / Math.sin(b) : C / Math.sin(c);
    A = k * Math.sin(a); B = k * Math.sin(b); C = k * Math.sin(c);
    const S = 0.5 * A * B * Math.sin(c);
    return { rows: [['Сторона A', A, 'м'], ['Сторона B', B, 'м'], ['Сторона C', C, 'м'], ['Угол a', a / R, '°'], ['Угол b', b / R, '°'], ['Угол c', c / R, '°'], ['Площадь', S, 'м²'], ['Периметр', A + B + C, 'м'], ['Высота к стороне C', 2 * S / C, 'м']] };
  }
});
/* объёмы ёмкостей (размеры в мм, как в приложении) */
const volRows = (V, V1, S) => { const r = [['Объём ёмкости', V, 'м³'], ['', V * 1000, 'л.']]; if (S) r.unshift(['Площадь дна', S, 'м²']); if (V1 !== null) r.push(['Объём жидкости', V1, 'м³'], ['', V1 * 1000, 'л.'], ['Свободный объём', V - V1, 'м³'], ['', (V - V1) * 1000, 'л.']); return r; };
defCalc({ id: 'vol_b', sec: ['volume'], title: 'Объём бочки', head: 'ОБЪЁМ БОЧКИ', img: 'vol_b', menuImg: 'vol_b_menu',
  fields: [{ k: 'D', t: 'num', l: 'Диаметр D', u: 'мм' }, { k: 'L', t: 'num', l: 'Высота L', u: 'мм' }, { k: 'H', t: 'num', l: 'Уровень жидкости H', u: 'мм' }],
  compute(v) { const d = pnum(v.D) / 1000, l = pnum(v.L) / 1000, hh = pnum(v.H) / 1000; if (!d || !l) return null; if (hh > l) return { err: 'Жидкости больше чем объём!' };
    const S = Math.PI * d * d / 4; return { rows: volRows(S * l, hh ? S * hh : null, S) }; } });
defCalc({ id: 'vol_4', sec: ['volume'], title: 'Объём ведра', head: 'ОБЪЁМ ВЕДРА', img: 'vol_4', menuImg: 'vol_4_menu',
  fields: [{ k: 'D', t: 'num', l: 'Диаметр D (верх)', u: 'мм' }, { k: 'D1', t: 'num', l: 'Диаметр D1 (дно)', u: 'мм' }, { k: 'L', t: 'num', l: 'Высота L', u: 'мм' }, { k: 'H', t: 'num', l: 'Уровень жидкости H', u: 'мм' }],
  compute(v) { const r = pnum(v.D) / 2000, r1 = pnum(v.D1) / 2000, l = pnum(v.L) / 1000, hh = pnum(v.H) / 1000; if (!r || !r1 || !l) return null; if (hh > l) return { err: 'Жидкости больше чем объём!' };
    const V = Math.PI * l / 3 * (r * r + r1 * r1 + r * r1); const rx = r1 + (r - r1) * hh / l; const V1 = hh ? Math.PI * hh / 3 * (r1 * r1 + rx * rx + r1 * rx) : null;
    return { rows: volRows(V, V1, Math.PI * r1 * r1) }; } });
defCalc({ id: 'vol_c', sec: ['volume'], title: 'Объём цистерны', head: 'ОБЪЁМ ЦИСТЕРНЫ', img: 'vol_c', menuImg: 'vol_c_menu',
  fields: [{ k: 'D', t: 'num', l: 'Диаметр D', u: 'мм' }, { k: 'L', t: 'num', l: 'Длина L', u: 'мм' }, { k: 'H', t: 'num', l: 'Уровень жидкости H', u: 'мм' }],
  compute(v) { const d = pnum(v.D) / 1000, l = pnum(v.L) / 1000, hh = pnum(v.H) / 1000; if (!d || !l) return null; if (hh > d) return { err: 'Жидкости больше чем объём!' };
    const r = d / 2, V = Math.PI * r * r * l; let V1 = null;
    if (hh) { const seg = x => { const th = 2 * Math.acos(1 - x / r); return r * r / 2 * (th - Math.sin(th)); }; V1 = hh <= r ? seg(hh) * l : V - seg(d - hh) * l; }
    return { rows: volRows(V, V1) }; } });
defCalc({ id: 'vol_p', sec: ['volume'], title: 'Объём прямоугольной ёмкости', head: 'ОБЪЁМ ПРЯМОУГОЛЬНОЙ ЁМКОСТИ', img: 'vol_p', menuImg: 'vol_p_menu',
  fields: [{ k: 'L', t: 'num', l: 'Длина L', u: 'мм' }, { k: 'W', t: 'num', l: 'Ширина W', u: 'мм' }, { k: 'H', t: 'num', l: 'Высота H', u: 'мм' }, { k: 'X', t: 'num', l: 'Уровень жидкости X', u: 'мм' }],
  compute(v) { const l = pnum(v.L) / 1000, w = pnum(v.W) / 1000, hh = pnum(v.H) / 1000, x = pnum(v.X) / 1000; if (!l || !w || !hh) return null; if (x > hh) return { err: 'Жидкости больше чем объём!' };
    return { rows: volRows(l * w * hh, x ? l * w * x : null, l * w) }; } });
defCalc({ id: 'vol_5', sec: ['volume'], title: 'Объём усечённой ёмкости', head: 'ОБЪЁМ ПРЯМОУГОЛЬНОЙ УСЕЧЁННОЙ ЁМКОСТИ', img: 'vol_5', menuImg: 'vol_5_menu',
  fields: [{ k: 'A', t: 'num', l: 'Сторона A (верх)', u: 'мм' }, { k: 'B', t: 'num', l: 'Сторона B (верх)', u: 'мм' }, { k: 'A1', t: 'num', l: 'Сторона A1 (дно)', u: 'мм' }, { k: 'B1', t: 'num', l: 'Сторона B1 (дно)', u: 'мм' }, { k: 'H', t: 'num', l: 'Высота H', u: 'мм' }, { k: 'X', t: 'num', l: 'Уровень жидкости X', u: 'мм' }],
  compute(v) { const a = pnum(v.A) / 1000, b = pnum(v.B) / 1000, a1 = pnum(v.A1) / 1000, b1 = pnum(v.B1) / 1000, hh = pnum(v.H) / 1000, x = pnum(v.X) / 1000;
    if (!a || !b || !a1 || !b1 || !hh) return null; if (x > hh) return { err: 'Жидкости больше чем объём!' };
    const s1 = a * b, s2 = a1 * b1, V = hh / 3 * (s1 + s2 + Math.sqrt(s1 * s2));
    let V1 = null; if (x) { const ax = a1 + (a - a1) * x / hh, bx = b1 + (b - b1) * x / hh, sx = ax * bx; V1 = x / 3 * (sx + s2 + Math.sqrt(sx * s2)); }
    return { rows: volRows(V, V1, s2) }; } });

/* ============================ ПЛОЩАДЬ ============================ */
const ROOM_TYPES = ['Дверь', 'Ниша', 'Окно', 'Проём', 'Стена', 'Участок'];
/** учёт дополнительных участков и проёмов */
function applyOpenings(rows, acc) {
  for (const r of rows || []) {
    const A = pnum(r.a), B = pnum(r.b), D = pnum(r.dep), q = pnum(r.q) || 1, sgn = r.s === -1 ? -1 : 1, t = +r.type;
    if (!A) continue;
    if (t === 0 || t === 2 || t === 3) { // дверь, окно, проём
      acc.walls -= A * B * q; acc.wallsMin += A * B * q;
      if (t !== 2) acc.perFloor -= A * q;
      const sl = (2 * B + A) * q; acc.slopePm += sl; acc.slopeM2 += sl * D;
    } else if (t === 1) { const add = (2 * B * D + A * D) * q; acc.walls += add; acc.wallsAdd += add; }
    else if (t === 4) { acc.walls += sgn * A * B * q; if (sgn > 0) acc.wallsAdd += A * B * q; else acc.wallsMin += A * B * q; }
    else if (t === 5) { acc.floor += sgn * A * B * q; acc.roof += sgn * A * B * q; acc.perFloor += sgn * 0; }
  }
  return acc;
}
const OPEN_COLS = [{ k: 'type', t: 'sel', o: ROOM_TYPES, w: 96 }, { k: 'a', l: 'A ширина' }, { k: 'b', l: 'B высота' }, { k: 'dep', l: 'Глуб. откоса' }, { k: 'q', l: 'Кол.', d: 1, w: 56 }];
defCalc({
  id: 'room', sec: ['square'], title: 'Площадь помещения (I)', head: 'ПЛОЩАДЬ ПОМЕЩЕНИЯ', help: 'help_text2',
  fields: [{ k: 'L', t: 'num', l: 'Длина помещения', u: 'м' }, { k: 'W', t: 'num', l: 'Ширина помещения', u: 'м' }, { k: 'H', t: 'num', l: 'Высота стен', u: 'м' },
    { k: 'op', t: 'tlist', l: 'Дополнительные участки и проёмы', cols: OPEN_COLS, sign: true, hint: 'Дверь/окно/проём вычитаются из стен и дают откосы. Ниша добавляет боковые стенки. «Стена» и «Участок» (пол/потолок) — со знаком ±.' }],
  compute(v) {
    const L = pnum(v.L), W = pnum(v.W), H = pnum(v.H); if (!L || !W) return null;
    const acc = applyOpenings(v.op && v.op.rows, { floor: L * W, roof: L * W, walls: (L + W) * 2 * H, perFloor: (L + W) * 2, perRoof: (L + W) * 2, slopePm: 0, slopeM2: 0, wallsAdd: 0, wallsMin: 0 });
    if (acc.walls < 0) return { err: 'Участок больше или равен площади стен!' };
    const rows = [['Пол', acc.floor, 'м²'], ['Потолок', acc.roof, 'м²']];
    if (H) rows.push(['Стены', acc.walls, 'м²']);
    if (acc.wallsMin) rows.push(['  в т.ч. мин. участки', acc.wallsMin, 'м²']); if (acc.wallsAdd) rows.push(['  в т.ч. доп. участки', acc.wallsAdd, 'м²']);
    rows.push(['Периметр пола', acc.perFloor, 'м'], ['Периметр потолка', acc.perRoof, 'м']);
    if (acc.slopePm) rows.push(['Откосы', acc.slopePm, 'п.м.'], ['Откосы', acc.slopeM2, 'м²']);
    if (H) rows.push(['Объём помещения', L * W * H, 'м³']);
    return { rows, actions: H ? [
      { text: 'Обои →', click: () => openCalcWith('wallpaper', { p: num(acc.perFloor), h: num(H) }) },
      { text: 'Ламинат →', click: () => openCalcWith('laminate', { a: num(L), b: num(W) }) },
      { text: 'Плинтус →', click: () => openCalcWith('plinth', { per: num(acc.perFloor) }) }] : [] };
  }
});
defCalc({
  id: 'room2', sec: ['square'], title: 'Площадь помещения (II)', head: 'ПЛОЩАДЬ ПОМЕЩЕНИЙ', help: 'help_text2',
  fields: [{ k: 'rooms', t: 'tlist', l: 'Помещения', cols: [{ k: 'n', t: 'text', l: 'Название', w: 110 }, { k: 'l', l: 'Длина' }, { k: 'w', l: 'Ширина' }, { k: 'h', l: 'Высота' }, { k: 'q', l: 'Кол.', d: 1, w: 56 }] },
    { k: 'op', t: 'tlist', l: 'Дополнительные участки и проёмы (для всех помещений)', cols: OPEN_COLS, sign: true }],
  compute(v) {
    const rr = (v.rooms && v.rooms.rows || []).filter(r => pnum(r.l) && pnum(r.w)); if (!rr.length) return null;
    const acc = { floor: 0, roof: 0, walls: 0, perFloor: 0, perRoof: 0, slopePm: 0, slopeM2: 0, wallsAdd: 0, wallsMin: 0 }; let vol = 0;
    const rows = [['#', 'По помещениям']];
    rr.forEach((r, i) => { const l = pnum(r.l), w = pnum(r.w), hh = pnum(r.h), q = pnum(r.q) || 1; acc.floor += l * w * q; acc.roof += l * w * q; acc.walls += (l + w) * 2 * hh * q; acc.perFloor += (l + w) * 2 * q; acc.perRoof += (l + w) * 2 * q; vol += l * w * hh * q;
      rows.push([(r.n || 'Помещение ' + (i + 1)) + (q > 1 ? ' ×' + q : ''), l * w * q, 'м²']); });
    applyOpenings(v.op && v.op.rows, acc);
    rows.push(['#', 'Итого'], ['Площадь пола', acc.floor, 'м²'], ['Площадь потолка', acc.roof, 'м²'], ['Площадь стен', acc.walls, 'м²'], ['Периметр пола', acc.perFloor, 'м'], ['Периметр потолка', acc.perRoof, 'м']);
    if (acc.slopePm) rows.push(['Откосы', acc.slopePm, 'п.м.'], ['Откосы', acc.slopeM2, 'м²']);
    rows.push(['Объём', vol, 'м³']);
    return { rows };
  }
});
/* площади участков (фигуры) */
function areaCalc(id, title, img, menuImg, letters, fn) {
  defCalc({ id, sec: ['area'], title, head: 'ПЛОЩАДЬ УЧАСТКА', img, menuImg,
    fields: letters.map(([k, l]) => ({ k, t: 'num', l, u: 'м' })),
    compute(v) { const x = {}; for (const [k] of letters) { x[k] = pnum(v[k]); if (!x[k]) return null; } const r = fn(x); if (!r || r.err) return r; const rows = [['Площадь', r.s, 'м²'], ['', r.s / 100, 'сот.'], ['Периметр', r.p, 'м']]; if (r.l) rows.push(['Длина дуги', r.l, 'м']); return { rows }; } });
}
const segment = (chord, hh) => { const R = hh / 2 + chord * chord / (8 * hh); let th = 2 * Math.asin(Math.min(1, chord / 2 / R)); if (hh > R) th = 2 * Math.PI - th; return { s: R * R / 2 * (th - Math.sin(th)), l: th * R }; };
areaCalc('a_bevel', 'Скошенный угол', 'skosh_ugol', 'skoshugol_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C']], x => ({ s: (x.a + x.b) / 2 * x.c, p: x.a + x.b + x.c + Math.hypot(x.a - x.b, x.c) }));
areaCalc('a_arc', 'Арка', 'arka', 'arka_menu', [['a', 'Сторона A (ширина)'], ['b', 'Сторона B (высота стенки)'], ['h', 'Высота H (дуги)']], x => { if (x.h > x.a) return { err: 'Высота больше хорды!' }; const g = segment(x.a, x.h); return { s: x.a * x.b + g.s, p: g.l + x.a + 2 * x.b, l: g.l }; });
areaCalc('a_circle', 'Круг', 'circle', 'circle_menu', [['r', 'Радиус R']], x => ({ s: Math.PI * x.r * x.r, p: 2 * Math.PI * x.r }));
areaCalc('a_triangle', 'Треугольник', 'triangle', 'triangle_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C']], x => { const p = (x.a + x.b + x.c) / 2; const q = p * (p - x.a) * (p - x.b) * (p - x.c); if (q <= 0) return { err: 'Неправильный треугольник' }; return { s: Math.sqrt(q), p: p * 2 }; });
areaCalc('a_parallelogram', 'Трапеция', 'parallelogram', 'parallelogram_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C']], x => ({ s: (x.a + x.b) / 2 * x.c, p: x.a + x.b + 2 * Math.hypot(Math.abs(x.a - x.b), x.c) }));
areaCalc('a_half', 'Сегмент круга', 'half_circle', 'half_circle_menu', [['l', 'Сторона L (хорда)'], ['h', 'Высота H']], x => { if (x.h > x.l) return { err: 'Высота больше хорды!' }; const g = segment(x.l, x.h); return { s: g.s, p: g.l + x.l, l: g.l }; });
areaCalc('a_house', 'Домик', 'house', 'house_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D']], x => { const p = (x.a + x.c + x.d) / 2; const q = p * (p - x.a) * (p - x.c) * (p - x.d); if (q <= 0) return { err: 'Неправильный треугольник' }; return { s: Math.sqrt(q) + x.a * x.b, p: x.a + 2 * x.b + x.c + x.d }; });
areaCalc('a_card', 'Срезанный угол', 'card', 'card_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D']], x => ({ s: x.a * x.b - (x.a - x.c) * (x.b - x.d) / 2, p: x.a + x.b + x.c + x.d + Math.hypot(x.a - x.c, x.b - x.d) }));
areaCalc('a_g', 'Г-образный', 'g', 'g_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D']], x => ({ s: x.a * x.d + (x.b - x.d) * x.c, p: (x.a + x.b) * 2 }));
areaCalc('a_oriel', 'Эркер', 'erker', 'erker_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D']], x => { const f5 = x.d - x.b; return { s: x.a * x.b + (x.a + x.c) / 2 * f5, p: x.a + x.c + 2 * x.b + 2 * Math.sqrt(f5 * f5 + Math.pow(x.a - x.c, 2) / 4) }; });
areaCalc('a_p', 'П-образный', 'p', 'p_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D'], ['e', 'Сторона E']], x => { const f3 = (x.a - x.d) / 2; return { s: x.a * x.b + f3 * x.c + f3 * x.e, p: (x.a + x.b) * 2 + x.c * 2 + x.e * 2 - 0 }; });
areaCalc('a_t', 'Т-образный', 't', 't_menu', [['a', 'Сторона A'], ['b', 'Сторона B'], ['c', 'Сторона C'], ['d', 'Сторона D']], x => ({ s: x.a * x.b + x.d * x.c, p: (x.a + x.b) * 2 + x.c * 2 }));
