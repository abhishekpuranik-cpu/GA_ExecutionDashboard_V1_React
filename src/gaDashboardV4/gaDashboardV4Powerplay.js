import * as XLSX from 'xlsx';
import { parseTaskWorkbook } from './gaDashboardV4Import.js';

export function isPOWorkbook(wb) {
  const n = wb.SheetNames.map((s) => s.toLowerCase());
  return n.some((x) => x.includes('material list')) && n.some((x) => x.includes('purchase order'));
}

/**
 * Golden Abodes / PowerPlay PO extract → material rows for Construction Finance table.
 * @param {import('xlsx').WorkBook} wb
 */
export function parsePOWorkbookFromWb(wb) {
  const mlName = wb.SheetNames.find((s) => s.toLowerCase().includes('material list'));
  if (!mlName) throw new Error('PO export: Material List sheet not found.');
  const ws = wb.Sheets[mlName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) return { materials: [], summary: { lines: 0, totalTaxableInr: 0 } };

  const header = rows[0].map((h) => String(h ?? '').trim().toLowerCase());
  const iMat = header.findIndex((h) => h === 'material');
  const iUom = header.findIndex((h) => h === 'uom');
  const iOrd = header.findIndex((h) => h.includes('ordered qty'));
  const iDel = header.findIndex((h) => h.includes('delivered qty'));
  const iTotal = header.findIndex((h) => h.includes('total (inc. taxes)') || h.includes('total(inc'));
  const iPrice = header.findIndex((h) => h === 'unit price');
  const iSpec = header.findIndex((h) => h === 'specification');

  const materials = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const mRaw = iMat >= 0 ? row[iMat] : '';
    if (mRaw == null || String(mRaw).trim() === '') continue;
    const spec = iSpec >= 0 ? String(row[iSpec] ?? '').trim() : '';
    const label = `${String(mRaw).trim()}${spec ? ` (${spec.slice(0, 36)})` : ''}`.slice(0, 90);
    const uom = iUom >= 0 ? String(row[iUom] ?? 'nos').trim().slice(0, 14) : 'nos';
    const ordN = iOrd >= 0 ? Number(row[iOrd]) : 0;
    const delN = iDel >= 0 ? Number(row[iDel]) : 0;
    const totalInr = iTotal >= 0 ? Number(row[iTotal]) : 0;
    const unitPrice = iPrice >= 0 ? Number(row[iPrice]) : 0;
    const ord = Number.isFinite(ordN) ? ordN : 0;
    const del = Number.isFinite(delN) ? delN : 0;
    const ti = Number.isFinite(totalInr) ? totalInr : 0;
    const pend = Math.max(0, ord - del);
    materials.push({
      m: label,
      u: uom || 'nos',
      boq: ord,
      po: ord,
      grn: del,
      pend,
      rate: Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0,
      poval: Math.round(ti / 100000),
      paid: 0,
    });
  }

  let totalTaxableInr = 0;
  const polName = wb.SheetNames.find((s) => s.toLowerCase().includes('purchase order list'));
  if (polName) {
    const ws2 = wb.Sheets[polName];
    const r2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
    if (r2.length) {
      const h2 = r2[0].map((h) => String(h ?? '').trim().toLowerCase());
      const iTax = h2.findIndex((h) => h.includes('total taxable'));
      for (let i = 1; i < r2.length; i++) {
        const row = r2[i];
        if (!row) continue;
        const v = iTax >= 0 ? Number(row[iTax]) : 0;
        if (Number.isFinite(v)) totalTaxableInr += v;
      }
    }
  }

  return {
    materials: materials.slice(0, 40),
    summary: {
      lines: materials.length,
      totalTaxableInr,
      totalTaxableLakh: Math.round(totalTaxableInr / 100000),
    },
  };
}

/**
 * @param {ArrayBuffer} buffer
 */
export function parsePOWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parsePOWorkbookFromWb(wb);
}

/**
 * Task extract vs PO extract (single XLSX read).
 * @param {ArrayBuffer} buffer
 * @param {Date} today
 */
export function parsePowerplayExcel(buffer, today) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (isPOWorkbook(wb)) return { kind: 'po', data: parsePOWorkbookFromWb(wb) };
  return { kind: 'tasks', data: parseTaskWorkbook(wb, today) };
}

/**
 * Rule-based “AI-style” summary from PowerPlay PDF text (getpowerplay.in reports).
 * No external API — extracts KPIs with regex + heuristics.
 */
export function analyzePowerplayPdfText(text) {
  const insight = {
    title: '',
    bullets: [],
    metrics: {},
  };
  const titleM = text.match(/Anantam Signature[^\n]*/);
  if (titleM) insight.title = titleM[0].trim().slice(0, 140);

  const win = text.match(/Start:\s*([^|]+?)\s*\|\s*End:\s*([^\n]+)/i);
  if (win) insight.bullets.push(`Window: ${win[1].trim()} → ${win[2].trim()}`);

  const comp = text.match(/COMPLETED[\s\S]{0,160}?Total\s+(\d+)/i);
  const ip = text.match(/IN PROGRESS[\s\S]{0,160}?Total\s+(\d+)/i);
  const ns = text.match(/NOT STARTED[\s\S]{0,160}?Total\s+(\d+)/i);
  if (comp) insight.metrics.completedTasks = +comp[1];
  if (ip) insight.metrics.inProgressTasks = +ip[1];
  if (ns) insight.metrics.notStartedTasks = +ns[1];

  const updates = text.match(/Task Updates\s+(\d+)/i);
  const issues = text.match(/Issues Created\s+(\d+)/i);
  const att = text.match(/Attendance Logged\s*(\d+)/i);
  if (updates) insight.metrics.taskUpdates = +updates[1];
  if (issues) insight.metrics.issuesCreated = +issues[1];
  if (att) insight.metrics.attendanceLogged = +att[1];

  if (insight.metrics.completedTasks != null)
    insight.bullets.push(`Completed (summary): ${insight.metrics.completedTasks}`);
  if (insight.metrics.inProgressTasks != null)
    insight.bullets.push(`In progress: ${insight.metrics.inProgressTasks}`);
  if (insight.metrics.notStartedTasks != null)
    insight.bullets.push(`Not started: ${insight.metrics.notStartedTasks}`);
  if (insight.metrics.taskUpdates != null)
    insight.bullets.push(`Task updates: ${insight.metrics.taskUpdates}`);

  const delayedSamples = [...text.matchAll(/Delayed by\s+(\d+)\s+days?/gi)].slice(0, 4);
  if (delayedSamples.length) {
    insight.bullets.push(`Delays noted (sample, days): ${delayedSamples.map((x) => x[1]).join(', ')}`);
  }

  return insight;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {number} [maxPages]
 */
export async function extractPdfText(buffer, maxPages = 22) {
  const pdfjs = await import('pdfjs-dist');
  const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const n = Math.min(pdf.numPages, maxPages);
  let text = '';
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items.map((it) => (it && typeof it.str === 'string' ? it.str : '')).join(' ') + '\n';
  }
  return { text, numPages: pdf.numPages };
}

export async function parsePowerplayPdf(buffer) {
  const { text, numPages } = await extractPdfText(buffer);
  const insight = analyzePowerplayPdfText(text);
  return { insight, numPages, textPreview: text.slice(0, 2000) };
}
