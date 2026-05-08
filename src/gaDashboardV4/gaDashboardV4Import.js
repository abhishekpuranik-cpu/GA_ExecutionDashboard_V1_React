import * as XLSX from 'xlsx';
import { saveGaV4ImportPayloadSilent } from '../api/appApi.js';

export const STORAGE_KEY = 'ga_dashboard_v4_task_import_v1';

/** @param {number} n */
function ordinalShort(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function padTaskId(seed) {
  const x = String(seed).replace(/\W/g, '').slice(0, 12) || 'row';
  return `TSK${x}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse DD/MM/YYYY or Date
 * @param {unknown} val
 * @returns {Date | null}
 */
export function parseCellDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    const parse = XLSX.SSF?.parse_date_code;
    if (typeof parse === 'function') {
      const d = parse(val);
      if (d && typeof d.y === 'number') return new Date(d.y, d.m - 1, d.d);
    }
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** e.g. 13-Jun-25, 01-Mar-2026 */
function parseCellDateLoose(val) {
  const d = parseCellDate(val);
  if (d) return d;
  const s = String(val ?? '').trim();
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo == null) return null;
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, mo, parseInt(m[1], 10));
  }
  return null;
}

function parsePercentCell(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return Math.max(0, Math.min(100, val <= 1 && val > 0 ? val * 100 : val));
  const s = String(val).replace(/%/g, '').trim();
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function parseDelayCell(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.round(val));
  const s = String(val).trim();
  const n = parseInt(/\d+/.exec(s)?.[0] ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatusFromCell(val) {
  const u = String(val ?? '').toLowerCase();
  if (u.includes('completed')) return 'Completed';
  if (u.includes('progress')) return 'In Progress';
  if (u.includes('not started')) return 'Not Started';
  return null;
}

/**
 * PowerPlay “flat” export: Task Names + L1/L2… + Progress % + Status (D building style).
 */
function rowsToNormalizedTasksPowerplayFlat(rows, headerIdx, header, today) {
  const col = (name) => header.findIndex((h) => h === name);
  const iTask = col('task id');
  const iNames = col('task names');
  const iLev = col('level');
  const iCat = col('work category');
  const iStart = col('start date');
  const iEnd = col('end date');
  const iAStart = col('actual start date');
  const iAEnd = col('actual end date');
  const iProg = header.findIndex((h) => h.includes('progress percentage'));
  const iStatus = col('status');
  const iDelay = col('delay');
  const iUnit = col('unit of measurement');
  const iTotQty = header.findIndex((h) => h.includes('total qty'));
  const iTags = col('tags');
  const iAssign = col('assigned members');

  if (iTask < 0 || iNames < 0) throw new Error('Flat export: need Task ID and Task Names columns.');

  const stack = ['', '', '', '', '', '', ''];
  const out = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const taskId = String(row[iTask] ?? '').trim();
    if (!taskId) continue;

    const levStr = String(row[iLev] ?? '')
      .trim()
      .toUpperCase();
    const depth = /^L(\d+)$/.test(levStr) ? Math.min(6, parseInt(levStr.replace(/^L/i, ''), 10) - 1) : 0;
    const rawName = String(row[iNames] ?? '').trim();
    if (rawName) {
      stack[depth] = rawName;
      for (let j = depth + 1; j < 7; j++) stack[j] = '';
    }

    const levels = [...stack];
    const leaf = [...levels].reverse().find((x) => x) || taskId;
    const name = levels.filter(Boolean).join(' › ') || leaf;

    const category = iCat >= 0 ? String(row[iCat] ?? '').trim() || 'General' : 'General';
    const unitRaw = iUnit >= 0 ? String(row[iUnit] ?? '').trim() : '';
    let prog = iProg >= 0 ? parsePercentCell(row[iProg]) : 0;

    const ps = (iStart >= 0 ? parseCellDateLoose(row[iStart]) : null) || (iAStart >= 0 ? parseCellDateLoose(row[iAStart]) : null);
    const pe = (iEnd >= 0 ? parseCellDateLoose(row[iEnd]) : null) || (iAEnd >= 0 ? parseCellDateLoose(row[iAEnd]) : null);

    let status = iStatus >= 0 ? normalizeStatusFromCell(row[iStatus]) : null;
    if (!status) status = inferStatus(prog, ps, pe, today);

    let delay = iDelay >= 0 ? parseDelayCell(row[iDelay]) : inferDelay(prog, pe, today);

    const tags = iTags >= 0 ? String(row[iTags] ?? '').trim() : '';
    const assignees = iAssign >= 0 ? String(row[iAssign] ?? '').trim() : '';
    const taskMembers = [assignees, tags].filter(Boolean).join(', ');

    let qty = iTotQty >= 0 ? row[iTotQty] : 0;
    if (typeof qty === 'string') qty = parseFloat(qty.replace(/,/g, ''));
    if (typeof qty !== 'number' || Number.isNaN(qty)) qty = 0;
    if (prog === 0 && (unitRaw.toLowerCase() === '%' || unitRaw === '%')) prog = Math.max(0, Math.min(100, qty));

    out.push({
      id: taskId,
      name,
      levels,
      leaf,
      cat: category,
      ps,
      pe,
      prog,
      status,
      delay,
      unit: unitRaw,
      qty,
      price: '',
      tags: taskMembers,
    });
  }

  return out;
}

function inferStatus(prog, ps, pe, today) {
  const p = Math.max(0, Math.min(100, prog));
  if (p >= 99.5) return 'Completed';
  if (ps && ps > today) return 'Not Started';
  if (pe && pe < today && p < 99) return 'In Progress';
  if (p <= 0 && (!pe || pe >= today)) return 'Not Started';
  return 'In Progress';
}

function inferDelay(prog, pe, today) {
  if (prog >= 99.5 || !pe) return 0;
  if (pe < today) return Math.max(0, Math.round((today - pe) / 86400000));
  return 0;
}

/**
 * Carry forward Level 1–7 like nested WBS in Excel (parent labels repeat implicitly).
 * @param {unknown[][]} rows
 * @param {number} headerIdx
 * @param {number[]} levelColIdx
 * @param {number} iTask
 */
function applyWbsInheritance(rows, headerIdx, levelColIdx, iTask) {
  const stack = ['', '', '', '', '', '', ''];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    if (iTask >= 0 && !String(row[iTask] ?? '').trim()) continue;
    for (let i = 0; i < 7; i++) {
      const ix = levelColIdx[i];
      if (ix < 0) continue;
      const v = row[ix] == null ? '' : String(row[ix]).trim();
      if (v) {
        stack[i] = v;
        for (let j = i + 1; j < 7; j++) stack[j] = '';
      }
      row[ix] = stack[i];
    }
  }
}

/**
 * @param {string[][]} rows
 * @param {Date} today
 */
export function rowsToNormalizedTasks(rows, today) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const joined = row
      .slice(0, 20)
      .map((c) => String(c ?? '').toLowerCase())
      .join('|');
    if (joined.includes('task id')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error('No header row found (expected a column named "Task ID").');

  const header = rows[headerIdx].map((h) => String(h ?? '').trim().toLowerCase());
  const col = (name) => header.findIndex((h) => h === name);

  /* PowerPlay flat export (Task Names + Level L1/L2…) vs multi-column WBS (Level 1…7) */
  if (col('task names') >= 0 && col('level 1') < 0) {
    return rowsToNormalizedTasksPowerplayFlat(rows, headerIdx, header, today);
  }

  const iTask = col('task id');
  const iL = [1, 2, 3, 4, 5, 6, 7].map((n) => col(`level ${n}`));
  const iCat = col('category');
  const iStart = col('start date');
  const iEnd = col('end date');
  const iQty = col('total quantity');
  const iUnit = col('unit');
  const iPrice = col('total price');
  const iTags = col('tags');
  const iAssign = col('assigned members');

  if (iTask < 0) throw new Error('Missing "Task ID" column.');

  applyWbsInheritance(rows, headerIdx, iL, iTask);

  const out = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const taskId = String(row[iTask] ?? '').trim();
    if (!taskId) continue;

    const levels = iL.map((ix) => (ix >= 0 ? String(row[ix] ?? '').trim() : ''));
    const leaf = [...levels].reverse().find((x) => x) || taskId;
    const name = levels.filter(Boolean).join(' › ') || leaf;

    const category = iCat >= 0 ? String(row[iCat] ?? '').trim() || 'General' : 'General';
    const unitRaw = iUnit >= 0 ? String(row[iUnit] ?? '').trim() : '';
    const u = unitRaw.toLowerCase();
    let qty = row[iQty];
    if (typeof qty === 'string') qty = parseFloat(qty.replace(/,/g, ''));
    if (typeof qty !== 'number' || Number.isNaN(qty)) qty = 0;

    let prog = 0;
    if (u === '%' || unitRaw === '%') prog = Math.max(0, Math.min(100, qty));
    else if (u.includes('%')) prog = Math.max(0, Math.min(100, qty));

    const ps = iStart >= 0 ? parseCellDate(row[iStart]) : null;
    const pe = iEnd >= 0 ? parseCellDate(row[iEnd]) : null;

    const status = inferStatus(prog, ps, pe, today);
    const delay = inferDelay(prog, pe, today);

    const price = iPrice >= 0 ? row[iPrice] : '';
    const tags = iTags >= 0 ? String(row[iTags] ?? '').trim() : '';
    const assignees = iAssign >= 0 ? String(row[iAssign] ?? '').trim() : '';
    const taskMembers = [assignees, tags].filter(Boolean).join(', ');

    out.push({
      id: taskId,
      name,
      levels,
      leaf,
      cat: category,
      ps,
      pe,
      prog,
      status,
      delay,
      unit: unitRaw,
      qty,
      price,
      tags: taskMembers,
    });
  }

  return out;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {Date} today
 */
export function parseTaskWorkbook(wb, today = new Date()) {
  const name = wb.SheetNames[0];
  if (!name) throw new Error('Workbook has no sheets.');
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const tasks = rowsToNormalizedTasks(rows, today);
  return { tasks, sheetName: name, rowCount: tasks.length };
}

export function parseTaskSpreadsheet(buffer, today = new Date()) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parseTaskWorkbook(wb, today);
}

/**
 * @param {string} text
 * @param {Date} today
 */
export function parseTaskCSV(text, today = new Date()) {
  const wb = XLSX.read(text, { type: 'string', cellDates: true });
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const tasks = rowsToNormalizedTasks(rows, today);
  return { tasks, sheetName: name, rowCount: tasks.length };
}

/**
 * @param {ReturnType<rowsToNormalizedTasks>} tasks
 * @param {Date} today
 */
export function buildSlicesFromTasks(tasks, today) {
  const normPct = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  };
  const l1Map = new Map();
  for (const t of tasks) {
    const l1 = t.levels[0] || t.levels.find((x) => x) || t.cat || 'General';
    if (!l1Map.has(l1)) l1Map.set(l1, []);
    l1Map.get(l1).push(t);
  }

  const L1 = [];
  for (const [n, arr] of l1Map) {
    const avgP = arr.length ? arr.reduce((s, x) => s + normPct(x.prog), 0) / arr.length : 0;
    const maxD = arr.length ? Math.max(...arr.map((x) => x.delay)) : 0;
    const anyIp = arr.some((x) => x.status === 'In Progress');
    const allDone = arr.every((x) => x.status === 'Completed');
    const s = allDone ? 'Completed' : anyIp ? 'In Progress' : 'Not Started';
    const cat = arr[0]?.cat || 'General';
    L1.push({ n, cat, p: Math.round(avgP * 10) / 10, s, d: maxD });
  }
  L1.sort((a, b) => a.n.localeCompare(b.n));

  const catMap = new Map();
  for (const t of tasks) {
    const c = t.cat || 'General';
    if (!catMap.has(c)) catMap.set(c, { t: 0, d: 0, i: 0, n: 0, sumP: 0, sumD: 0, cntD: 0 });
    const o = catMap.get(c);
    o.t += 1;
    o.sumP += normPct(t.prog);
    if (t.status === 'Completed') o.d += 1;
    else if (t.status === 'In Progress') o.i += 1;
    else o.n += 1;
    if (t.delay > 0) {
      o.sumD += t.delay;
      o.cntD += 1;
    }
  }
  const CATS = [...catMap.entries()].map(([c, o]) => ({
    c,
    t: o.t,
    d: o.d,
    i: o.i,
    n: o.n,
    avg: o.t ? Math.round((o.sumP / o.t) * 10) / 10 : 0,
    ad: o.cntD ? Math.round((o.sumD / o.cntD) * 10) / 10 : 0,
  }));
  CATS.sort((a, b) => a.c.localeCompare(b.c));

  const ACTIVE = tasks
    .filter((t) => t.status === 'In Progress')
    .sort((a, b) => b.delay - a.delay)
    .slice(0, 18)
    .map((t) => ({ n: t.name, c: t.cat, p: Math.round(normPct(t.prog) * 10) / 10, d: t.delay, m: t.tags || 'Unassigned' }));

  const TOPDELAY = [...tasks]
    .filter((t) => t.delay > 0)
    .sort((a, b) => b.delay - a.delay)
    .slice(0, 15)
    .map((t) => ({
      n: t.name,
      c: t.cat,
      p: Math.round(normPct(t.prog) * 10) / 10,
      d: t.delay,
      s: t.status,
    }));

  const UPCOMING = tasks
    .filter((t) => t.ps && t.pe)
    .filter(
      (t) =>
        t.status === 'In Progress' ||
        t.pe >= today ||
        (t.ps <= today && t.pe >= today),
    )
    .map((t) => ({
      id: t.id,
      n: t.name,
      cat: t.cat,
      ps: t.ps,
      pe: t.pe,
      prog: Math.round(normPct(t.prog) * 10) / 10,
      s: t.status,
      delay: t.delay,
      mem: t.tags || '—',
    }))
    .sort((a, b) => a.ps - b.ps)
    .slice(0, 48);

  const slabRe = /(b-?\d+|basement|\d+(st|nd|rd|th))\s*slab|slab/i;
  const slabTasks = tasks.filter((t) => slabRe.test(t.name) || slabRe.test(t.leaf));
  const slabs = slabTasks.slice(0, 24).map((t) => ({
    n: t.leaf || t.name,
    p: Math.round(normPct(t.prog) * 10) / 10,
    s: t.status,
    d: t.delay,
  }));

  const pctRows = tasks.filter((t) => (t.unit || '').toLowerCase() === '%' || t.unit === '%');
  const avgCompletion = pctRows.length
    ? pctRows.reduce((s, t) => s + normPct(t.prog), 0) / pctRows.length
    : tasks.length
      ? tasks.reduce((s, t) => s + normPct(t.prog), 0) / tasks.length
      : 0;

  const maxDelay = tasks.length ? Math.max(0, ...tasks.map((t) => t.delay)) : 0;
  const done = tasks.filter((t) => t.status === 'Completed').length;
  const ip = tasks.filter((t) => t.status === 'In Progress').length;
  const ns = tasks.filter((t) => t.status === 'Not Started').length;

  return {
    L1,
    CATS,
    ACTIVE,
    TOPDELAY,
    UPCOMING,
    slabs,
    projectPatch: {
      tasks: tasks.length,
      completion: Math.round(avgCompletion * 10) / 10,
      maxDelay,
      done,
      ip,
      ns,
    },
  };
}

export function persistImportPayload(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  saveGaV4ImportPayloadSilent(payload);
}

export function loadPersistedImportPayload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPersistedImport() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Work-tree template matching Anantam extract shape (Task ID + Level 1–7 + Category + dates + qty + unit + price + Tags).
 * Slab-related rows repeat for `totalSlabs` typical floors; optional `basementSlabLabels` adds B-1 / basement rows.
 *
 * @param {{ projectId?: string, totalSlabs?: number, basementSlabLabels?: string[] }} opts
 */
export function generateWorkTreeTemplateCSV(opts = {}) {
  const projectId = opts.projectId || 'GA-E-BLDG';
  const totalSlabs = Math.max(1, Math.min(60, parseInt(String(opts.totalSlabs ?? 5), 10) || 5));
  const basementSlabLabels = Array.isArray(opts.basementSlabLabels)
    ? opts.basementSlabLabels
    : ['b-1 slab'];

  const header = [
    'Task ID',
    'Level 1',
    'Level 2',
    'Level 3',
    'Level 4',
    'Level 5',
    'Level 6',
    'Level 7',
    'Category',
    'Start Date',
    'End Date',
    'Total Quantity',
    'Unit',
    'Total Price',
    'Tags',
  ];

  const rows = [header];
  let seed = 0;
  const push = (levels, cat, start, end, qty, unit, price, tags) => {
    seed += 1;
    const tid = padTaskId(`${seed}${projectId}`);
    rows.push([
      tid,
      ...levels,
      cat,
      start,
      end,
      qty,
      unit,
      price,
      tags,
    ]);
  };

  push(['excavation', '', '', '', '', '', ''], 'Civil', '01/03/2025', '28/04/2025', 10000, 'cum', 3000000, projectId);
  push(['Drawing', '', '', '', '', '', ''], 'General', '01/08/2025', '31/03/2026', '', '%', 0, projectId);
  push(['', 'RCC Structure', '', '', '', '', ''], 'General', '01/01/2026', '15/03/2026', '', '%', '', projectId);

  for (const bl of basementSlabLabels) {
    const lab = String(bl).trim();
    if (!lab) continue;
    push(['', '', '', lab, '', '', ''], 'Design', '', '', 100, '%', 0, `${projectId} basement design`);
  }

  push(['', 'RCC Basement to typical slab', '', '', '', '', ''], 'Civil', '30/04/2025', '03/05/2026', 100, '%', '', projectId);

  const SLAB_HEAD = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'];
  for (let s = 1; s <= totalSlabs; s++) {
    const ord = ordinalShort(s);
    const label = s <= SLAB_HEAD.length ? SLAB_HEAD[s - 1] : `${s}TH`;
    push(['', '', `${label} SLAB`, '', '', '', ''], 'Civil', '', '', 100, '%', '', `${projectId} slab ${s}`);
    push(['', '', '', `${ord} slab shuttering`, '', '', ''], 'Civil', '', '', 100, '%', '', projectId);
    push(['', '', '', `${ord} slab steel`, '', '', ''], 'Civil', '', '', 100, '%', '', projectId);
    push(['', '', '', `${ord} slab concrete`, '', '', ''], 'Civil', '', '', 100, '%', '', projectId);
    if (s < totalSlabs) {
      const next = ordinalShort(s + 1);
      push(
        ['', '', '', `${ord} to ${next} slab column concrete`, '', '', ''],
        'Civil',
        '',
        '',
        100,
        '%',
        '',
        projectId,
      );
      push(
        ['', '', '', `${ord} to ${next} slab column steel`, '', '', ''],
        'Civil',
        '',
        '',
        100,
        '%',
        '',
        projectId,
      );
    }
  }

  push(['', 'MEP', '', '', '', '', ''], 'General', '01/01/2026', '31/03/2026', '', '%', '', projectId);
  push(['', '', 'Handover', '', '', '', ''], 'Closing', '01/06/2026', '31/12/2026', 0, '%', 0, projectId);

  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
