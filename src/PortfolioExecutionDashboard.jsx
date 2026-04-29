import { useEffect, useMemo, useState } from 'react';
import { fetchPortfolioData, savePortfolioData, savePortfolioDataSilent } from './api/appApi.js';
import './portfolioGaSupplement.css';

const PROJECTS = [
  { id: 'all', name: 'Portfolio view' },
  { id: 'p1', name: 'GA Residences, Pimpri' },
  { id: 'p2', name: 'GA Heights, Mumbai' },
  { id: 'p3', name: 'GA Villas, Goa' }
];

const LAYERS = [
  { id: 'business', label: 'Business Layer' },
  { id: 'operational', label: 'Operational Layer' },
  { id: 'transactional', label: 'Transactional Layer' }
];

const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

const DEFAULT_DATA = {
  all: {
    monthLabel: 'Apr 2026',
    executive: { completion: 67, cpi: 0.94, spi: 0.92, issues: 12 },
    business: { irr: 18.2, cost_psf: 4850, rev_real: 84, ebitda: 24.1, sales_vel: 8, recv: 73 },
    operational: { spi_op: 0.92, cpi_op: 0.94, prog: 67, quality: 88, co_rate: 6.2, sub_sla: 78, ltifr: 0.8, punch: 62 },
    transactional: { workforce: 94, mat_ot: 76, rfi: 4.2, inv_proc: 8.5, inspection: 91, equip_util: 74 },
    trend: {
      spi: [0.98, 0.97, 0.95, 0.93, 0.92, 0.92],
      cpi: [1.01, 0.99, 0.98, 0.96, 0.95, 0.94]
    },
    completionChart: [
      { name: 'T1 Pimpri', planned: 75, actual: 69 },
      { name: 'T2 Pimpri', planned: 68, actual: 63 },
      { name: 'Mumbai Heights', planned: 80, actual: 74 },
      { name: 'Goa Villas', planned: 55, actual: 52 }
    ]
  },
  p1: {
    monthLabel: 'Apr 2026',
    executive: { completion: 69, cpi: 0.96, spi: 0.94, issues: 5 },
    business: { irr: 19.5, cost_psf: 4720, rev_real: 87, ebitda: 25.8, sales_vel: 4, recv: 76 },
    operational: { spi_op: 0.94, cpi_op: 0.96, prog: 69, quality: 90, co_rate: 5.1, sub_sla: 82, ltifr: 0.6, punch: 70 },
    transactional: { workforce: 97, mat_ot: 80, rfi: 3.8, inv_proc: 8, inspection: 93, equip_util: 79 },
    trend: {
      spi: [1.0, 0.99, 0.97, 0.95, 0.94, 0.94],
      cpi: [1.02, 1.0, 0.99, 0.98, 0.97, 0.96]
    },
    completionChart: [
      { name: 'Tower A', planned: 76, actual: 72 },
      { name: 'Tower B', planned: 70, actual: 66 },
      { name: 'Clubhouse', planned: 61, actual: 58 }
    ]
  },
  p2: {
    monthLabel: 'Apr 2026',
    executive: { completion: 74, cpi: 0.93, spi: 0.91, issues: 4 },
    business: { irr: 17.1, cost_psf: 5120, rev_real: 82, ebitda: 22.4, sales_vel: 3, recv: 70 },
    operational: { spi_op: 0.91, cpi_op: 0.93, prog: 74, quality: 86, co_rate: 7.4, sub_sla: 74, ltifr: 1.1, punch: 55 },
    transactional: { workforce: 91, mat_ot: 71, rfi: 4.8, inv_proc: 9.2, inspection: 88, equip_util: 68 },
    trend: {
      spi: [0.97, 0.95, 0.94, 0.93, 0.92, 0.91],
      cpi: [0.99, 0.97, 0.96, 0.95, 0.94, 0.93]
    },
    completionChart: [
      { name: 'Tower C', planned: 82, actual: 76 },
      { name: 'Tower D', planned: 78, actual: 72 },
      { name: 'Podium', planned: 73, actual: 69 }
    ]
  },
  p3: {
    monthLabel: 'Apr 2026',
    executive: { completion: 52, cpi: 0.97, spi: 0.94, issues: 3 },
    business: { irr: 21.3, cost_psf: 4680, rev_real: 89, ebitda: 27.2, sales_vel: 1, recv: 81 },
    operational: { spi_op: 0.94, cpi_op: 0.97, prog: 52, quality: 91, co_rate: 4.8, sub_sla: 86, ltifr: 0.5, punch: 72 },
    transactional: { workforce: 96, mat_ot: 84, rfi: 3.5, inv_proc: 7.8, inspection: 95, equip_util: 82 },
    trend: {
      spi: [0.95, 0.95, 0.95, 0.94, 0.94, 0.94],
      cpi: [0.98, 0.98, 0.98, 0.97, 0.97, 0.97]
    },
    completionChart: [
      { name: 'Villa Cluster 1', planned: 61, actual: 58 },
      { name: 'Villa Cluster 2', planned: 55, actual: 52 },
      { name: 'Infra', planned: 47, actual: 44 }
    ]
  }
};

function fmt(value, suffix = '', prefix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  if (Number.isInteger(value)) return `${prefix}${value.toLocaleString()}${suffix}`;
  return `${prefix}${value.toFixed(1)}${suffix}`;
}

function statusClass(good, warn) {
  if (good) return 'green';
  if (warn) return 'amber';
  return 'red';
}

function toNumericIfPossible(text) {
  const n = Number(text);
  if (!Number.isNaN(n) && text !== '') return n;
  return text;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2) return [];
  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split(',').map((h) => h.trim());
  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    return row;
  });
}

function flattenDataToCsvRows(data) {
  const rows = [];
  Object.entries(data).forEach(([projectId, payload]) => {
    Object.entries(payload.executive).forEach(([k, v]) => rows.push(`${projectId},executive,${k},${v}`));
    Object.entries(payload.business).forEach(([k, v]) => rows.push(`${projectId},business,${k},${v}`));
    Object.entries(payload.operational).forEach(([k, v]) => rows.push(`${projectId},operational,${k},${v}`));
    Object.entries(payload.transactional).forEach(([k, v]) => rows.push(`${projectId},transactional,${k},${v}`));
    payload.trend.spi.forEach((v, idx) => rows.push(`${projectId},trend,spi_${MONTHS[idx]},${v}`));
    payload.trend.cpi.forEach((v, idx) => rows.push(`${projectId},trend,cpi_${MONTHS[idx]},${v}`));
    payload.completionChart.forEach((point, idx) => {
      rows.push(`${projectId},completion,label_${idx},${point.name}`);
      rows.push(`${projectId},completion,planned_${idx},${point.planned}`);
      rows.push(`${projectId},completion,actual_${idx},${point.actual}`);
    });
  });
  return ['projectId,section,key,value', ...rows].join('\n');
}

function mergeFromCsv(data, rows) {
  const next = structuredClone(data);
  rows.forEach((row) => {
    const project = next[row.projectId];
    if (!project) return;
    const n = Number(row.value);

    if (row.section === 'executive' && row.key in project.executive) project.executive[row.key] = n;
    if (row.section === 'business' && row.key in project.business) project.business[row.key] = n;
    if (row.section === 'operational' && row.key in project.operational) project.operational[row.key] = n;
    if (row.section === 'transactional' && row.key in project.transactional) project.transactional[row.key] = n;

    if (row.section === 'trend') {
      const [metric, month] = row.key.split('_');
      const idx = MONTHS.indexOf(month);
      if (idx >= 0 && metric === 'spi') project.trend.spi[idx] = n;
      if (idx >= 0 && metric === 'cpi') project.trend.cpi[idx] = n;
    }

    if (row.section === 'completion') {
      const [kind, rawIdx] = row.key.split('_');
      const idx = Number(rawIdx);
      if (!project.completionChart[idx]) project.completionChart[idx] = { name: `Work Package ${idx + 1}`, planned: 0, actual: 0 };
      if (kind === 'label') project.completionChart[idx].name = row.value;
      if (kind === 'planned') project.completionChart[idx].planned = n;
      if (kind === 'actual') project.completionChart[idx].actual = n;
    }
  });
  return next;
}

function metricCatalog(layer, current) {
  const maps = {
    business: [
      ['irr', 'Project IRR (%)', current.business.irr],
      ['cost_psf', 'Blended cost / sq ft', current.business.cost_psf],
      ['rev_real', 'Revenue realization (%)', current.business.rev_real],
      ['ebitda', 'EBITDA margin (%)', current.business.ebitda],
      ['sales_vel', 'Sales velocity (/mo)', current.business.sales_vel],
      ['recv', 'Receivables collection (%)', current.business.recv]
    ],
    operational: [
      ['spi_op', 'Schedule perf. index', current.operational.spi_op],
      ['cpi_op', 'Cost perf. index', current.operational.cpi_op],
      ['prog', 'Construction progress (%)', current.operational.prog],
      ['quality', 'Quality score (%)', current.operational.quality],
      ['co_rate', 'Change order rate (%)', current.operational.co_rate],
      ['sub_sla', 'Subcontractor SLA (%)', current.operational.sub_sla],
      ['ltifr', 'Safety LTIFR', current.operational.ltifr],
      ['punch', 'Punch list closure (%)', current.operational.punch]
    ],
    transactional: [
      ['workforce', 'Workforce vs plan (%)', current.transactional.workforce],
      ['mat_ot', 'Material on-time delivery (%)', current.transactional.mat_ot],
      ['rfi', 'Avg RFI resolution (days)', current.transactional.rfi],
      ['inv_proc', 'Invoice processing (days)', current.transactional.inv_proc],
      ['inspection', 'Site inspection pass rate (%)', current.transactional.inspection],
      ['equip_util', 'Equipment utilization (%)', current.transactional.equip_util]
    ]
  };
  return maps[layer];
}

function KpiCard({ label, value, meta, badge, tone }) {
  const kc = tone === 'green' ? 'ok' : tone === 'amber' ? 'w' : 'b';
  const p = tone === 'green' ? 'p-ok' : tone === 'amber' ? 'p-w' : 'p-b';
  return (
    <div className={`kc ${kc}`}>
      <div className="kl">{label}</div>
      <div className="kv">{value}</div>
      <div className="km">{meta}</div>
      <span className={`kp ${p}`}>{badge}</span>
    </div>
  );
}

function LineChart({ data, onHoverPoint }) {
  const width = 580;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 38 };
  const xStep = (width - padding.left - padding.right) / (MONTHS.length - 1);
  const yMin = 0.85;
  const yMax = 1.05;
  const y = (v) => padding.top + ((yMax - v) / (yMax - yMin)) * (height - padding.top - padding.bottom);
  const x = (i) => padding.left + i * xStep;

  const pathFor = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <div className="svg-wrap">
      <svg width={width} height={height} role="img" aria-label="SPI and CPI trend">
        <line x1={padding.left} y1={y(1)} x2={width - padding.right} y2={y(1)} stroke="var(--b2)" strokeDasharray="4 3" />
        <path d={pathFor(data.spi)} stroke="var(--navy)" fill="none" strokeWidth="2" />
        <path d={pathFor(data.cpi)} stroke="var(--gold)" fill="none" strokeDasharray="5 4" strokeWidth="2" />
        {data.spi.map((v, idx) => (
          <circle
            key={`spi-${MONTHS[idx]}`}
            className="line-point"
            cx={x(idx)}
            cy={y(v)}
            r="4"
            fill="var(--navy)"
            onMouseEnter={() => onHoverPoint(`SPI ${MONTHS[idx]}: ${v.toFixed(2)}`)}
          />
        ))}
        {data.cpi.map((v, idx) => (
          <circle
            key={`cpi-${MONTHS[idx]}`}
            className="line-point"
            cx={x(idx)}
            cy={y(v)}
            r="4"
            fill="var(--gold)"
            onMouseEnter={() => onHoverPoint(`CPI ${MONTHS[idx]}: ${v.toFixed(2)}`)}
          />
        ))}
        {MONTHS.map((m, idx) => (
          <text key={m} x={x(idx)} y={height - 10} textAnchor="middle" fontSize="11" fill="var(--t3)">
            {m}
          </text>
        ))}
      </svg>
    </div>
  );
}

function HorizontalBars({ rows }) {
  const width = 500;
  const rowHeight = 34;
  const height = rows.length * rowHeight + 34;
  const barBaseX = 170;
  const barMaxW = 300;

  return (
    <div className="svg-wrap">
      <svg width={width} height={height} role="img" aria-label="Completion planned vs actual">
        {rows.map((row, idx) => {
          const y = idx * rowHeight + 10;
          return (
            <g key={row.name}>
              <text x="8" y={y + 15} fontSize="11" fill="var(--t2)">
                {row.name}
              </text>
              <rect x={barBaseX} y={y} width={(row.planned / 100) * barMaxW} height="10" fill="var(--b1)" rx="1" />
              <rect x={barBaseX} y={y + 12} width={(row.actual / 100) * barMaxW} height="10" fill="var(--navy)" rx="1" />
              <text x={barBaseX + barMaxW + 6} y={y + 9} fontSize="10" fill="var(--t4)">
                {row.planned}%
              </text>
              <text x={barBaseX + barMaxW + 6} y={y + 22} fontSize="10" fill="var(--navy)">
                {row.actual}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function PortfolioExecutionDashboard() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [activeProject, setActiveProject] = useState('all');
  const [activeLayer, setActiveLayer] = useState('business');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mongoNote, setMongoNote] = useState('');
  const [mongoBusy, setMongoBusy] = useState(false);
  const [hoverPoint, setHoverPoint] = useState('Hover data points for SPI and CPI by month.');
  const [draftEdits, setDraftEdits] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchPortfolioData();
        if (cancelled) return;
        if (r?.data) {
          setData(r.data);
          const t = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '';
          setMongoNote(t ? `MongoDB · loaded snapshot (${t})` : 'MongoDB · loaded snapshot');
        } else {
          setMongoNote('MongoDB · no document yet — click Save to store KPIs');
        }
      } catch {
        if (!cancelled) {
          setMongoNote('MongoDB API offline — using defaults (start mongod + npm run server)');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaveMongo = async () => {
    setMongoBusy(true);
    setError('');
    try {
      await savePortfolioData(data);
      setMessage('Portfolio KPIs saved to MongoDB.');
      setMongoNote('MongoDB · last save just now');
    } catch (e) {
      setError(e?.message || 'Could not save to MongoDB.');
      setMessage('');
    } finally {
      setMongoBusy(false);
    }
  };

  const onReloadMongo = async () => {
    setMongoBusy(true);
    setError('');
    try {
      const r = await fetchPortfolioData();
      if (r?.data) {
        setData(r.data);
        const t = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '';
        setMessage(t ? `Reloaded from MongoDB (${t}).` : 'Reloaded from MongoDB.');
        setMongoNote(t ? `MongoDB · snapshot (${t})` : 'MongoDB · snapshot');
      } else {
        setMessage('No document in MongoDB yet — nothing to reload.');
      }
    } catch (e) {
      setError(e?.message || 'Could not load from MongoDB.');
      setMessage('');
    } finally {
      setMongoBusy(false);
    }
  };

  const current = useMemo(() => data[activeProject] ?? data.all, [data, activeProject]);

  const executiveCards = [
    {
      label: 'Portfolio completion',
      value: fmt(current.executive.completion, '%'),
      meta: 'Target: 72% this period',
      badge: `${Math.max(0, 72 - current.executive.completion)} pts behind plan`,
      tone: statusClass(current.executive.completion >= 72, current.executive.completion >= 65)
    },
    {
      label: 'Cost performance index',
      value: current.executive.cpi.toFixed(2),
      meta: 'Target: >= 1.0',
      badge: current.executive.cpi >= 1 ? 'Cost in control' : 'Overspend risk',
      tone: statusClass(current.executive.cpi >= 1, current.executive.cpi >= 0.95)
    },
    {
      label: 'Schedule performance index',
      value: current.executive.spi.toFixed(2),
      meta: 'Target: >= 1.0',
      badge: current.executive.spi >= 1 ? 'On schedule' : 'Behind plan',
      tone: statusClass(current.executive.spi >= 1, current.executive.spi >= 0.95)
    },
    {
      label: 'Open critical issues',
      value: fmt(current.executive.issues),
      meta: 'Lower is better',
      badge: current.executive.issues <= 5 ? 'Under control' : 'Action needed',
      tone: statusClass(current.executive.issues <= 5, current.executive.issues <= 9)
    }
  ];

  const achievement = Math.max(
    0,
    Math.round(((current.executive.completion + current.business.rev_real + current.operational.quality + current.transactional.inspection) / 4) * 10) / 10
  );
  const recoveryGap = Math.max(0, Math.round((1 - current.executive.spi) * 100));
  const riskCount =
    Number(current.executive.cpi < 0.95) +
    Number(current.executive.spi < 0.95) +
    Number(current.operational.co_rate > 5) +
    Number(current.transactional.mat_ot < 80);

  const layerCards = {
    business: [
      ['Project IRR', fmt(current.business.irr, '%'), 'Target: 22%', `${(22 - current.business.irr).toFixed(1)} pts below target`, statusClass(current.business.irr >= 22, current.business.irr >= 18)],
      ['Blended cost per sq ft', fmt(current.business.cost_psf, '', 'INR '), 'Budget: INR 4,600', current.business.cost_psf <= 4600 ? 'Within budget' : 'Over budget', statusClass(current.business.cost_psf <= 4600, current.business.cost_psf <= 4850)],
      ['Revenue realization', fmt(current.business.rev_real, '%'), 'Target: 90%', current.business.rev_real >= 90 ? 'On track' : 'Gap to target', statusClass(current.business.rev_real >= 90, current.business.rev_real >= 84)],
      ['EBITDA margin', fmt(current.business.ebitda, '%'), 'Target: 28%', current.business.ebitda >= 28 ? 'Healthy margin' : 'Margin erosion risk', statusClass(current.business.ebitda >= 28, current.business.ebitda >= 24)],
      ['Sales velocity', `${fmt(current.business.sales_vel)} /mo`, 'Target: 12 units / month', current.business.sales_vel >= 12 ? 'Strong absorption' : 'Demand pressure', statusClass(current.business.sales_vel >= 12, current.business.sales_vel >= 8)],
      ['Receivables collection', fmt(current.business.recv, '%'), 'Target: 85%', current.business.recv >= 85 ? 'Cash healthy' : 'Cash flow stress', statusClass(current.business.recv >= 85, current.business.recv >= 75)]
    ],
    operational: [
      ['Schedule perf. index', current.operational.spi_op.toFixed(2), 'Target: >= 1.0', current.operational.spi_op >= 1 ? 'On track' : 'Recovery needed', statusClass(current.operational.spi_op >= 1, current.operational.spi_op >= 0.94)],
      ['Cost perf. index', current.operational.cpi_op.toFixed(2), 'Target: >= 1.0', current.operational.cpi_op >= 1 ? 'Healthy trend' : 'Overspend risk', statusClass(current.operational.cpi_op >= 1, current.operational.cpi_op >= 0.95)],
      ['Construction progress', fmt(current.operational.prog, '%'), 'Plan this period: 72%', current.operational.prog >= 72 ? 'On track' : 'Behind plan', statusClass(current.operational.prog >= 72, current.operational.prog >= 67)],
      ['Quality score', fmt(current.operational.quality, '%'), 'Target: >= 90%', current.operational.quality >= 90 ? 'Strong quality' : 'Near threshold', statusClass(current.operational.quality >= 90, current.operational.quality >= 85)],
      ['Change order rate', fmt(current.operational.co_rate, '%'), 'Threshold: < 5%', current.operational.co_rate < 5 ? 'Controlled scope' : 'Scope creep signal', statusClass(current.operational.co_rate < 5, current.operational.co_rate <= 6)],
      ['Subcontractor SLA', fmt(current.operational.sub_sla, '%'), 'Target: 90%', current.operational.sub_sla >= 90 ? 'SLA stable' : 'Contractor gap', statusClass(current.operational.sub_sla >= 90, current.operational.sub_sla >= 80)],
      ['Safety LTIFR', current.operational.ltifr.toFixed(1), 'Threshold: < 1.0', current.operational.ltifr < 1 ? 'Within threshold' : 'Safety concern', statusClass(current.operational.ltifr < 1, current.operational.ltifr <= 1.2)],
      ['Punch list closure', fmt(current.operational.punch, '%'), 'Target: >= 80%', current.operational.punch >= 80 ? 'Strong closure' : 'Backlog risk', statusClass(current.operational.punch >= 80, current.operational.punch >= 68)]
    ],
    transactional: [
      ['Workforce vs plan', fmt(current.transactional.workforce, '%'), 'Target: >= 90%', current.transactional.workforce >= 90 ? 'On track' : 'Staffing risk', statusClass(current.transactional.workforce >= 90, current.transactional.workforce >= 85)],
      ['Material on-time delivery', fmt(current.transactional.mat_ot, '%'), 'Target: 90%', current.transactional.mat_ot >= 90 ? 'Supply stable' : 'Delivery slippage', statusClass(current.transactional.mat_ot >= 90, current.transactional.mat_ot >= 78)],
      ['Avg RFI resolution', `${current.transactional.rfi.toFixed(1)}d`, 'Target: <= 3 days', current.transactional.rfi <= 3 ? 'Fast turnaround' : 'Aging RFIs', statusClass(current.transactional.rfi <= 3, current.transactional.rfi <= 4)],
      ['Invoice processing', `${current.transactional.inv_proc.toFixed(1)}d`, 'Target: <= 7 days', current.transactional.inv_proc <= 7 ? 'Payment cycle healthy' : 'Delayed cycle', statusClass(current.transactional.inv_proc <= 7, current.transactional.inv_proc <= 8.5)],
      ['Site inspection pass rate', fmt(current.transactional.inspection, '%'), 'Target: >= 90%', current.transactional.inspection >= 90 ? 'On track' : 'Quality issue', statusClass(current.transactional.inspection >= 90, current.transactional.inspection >= 86)],
      ['Equipment utilization', fmt(current.transactional.equip_util, '%'), 'Target: 85%', current.transactional.equip_util >= 85 ? 'Utilization healthy' : 'Idle asset cost', statusClass(current.transactional.equip_util >= 85, current.transactional.equip_util >= 75)]
    ]
  };

  const onDownloadTemplate = () => {
    const csv = flattenDataToCsvRows(DEFAULT_DATA);
    downloadTextFile('construction_execution_template.csv', csv);
    setError('');
    setMessage('Template downloaded. Update values in CSV and upload.');
  };

  const onDownloadCurrent = () => {
    const csv = flattenDataToCsvRows(data);
    downloadTextFile('construction_execution_current_data.csv', csv);
    setError('');
    setMessage('Current source data downloaded.');
  };

  const onUploadCsv = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsvRows(reader.result?.toString() || '');
        if (!rows.length) {
          setError('No usable CSV rows found. Use the template format.');
          setMessage('');
          return;
        }
        const merged = mergeFromCsv(data, rows);
        setData(merged);
        savePortfolioDataSilent(merged);
        setError('');
        setMessage(`Upload successful: ${rows.length} rows processed · synced to MongoDB`);
      } catch (_e) {
        setError('Upload failed. Ensure CSV matches template columns: projectId, section, key, value.');
        setMessage('');
      }
    };
    reader.readAsText(file);
  };

  const editableRows = metricCatalog(activeLayer, current);

  const onEditCell = (metricKey, val) => {
    setDraftEdits((prev) => ({ ...prev, [`${activeLayer}.${metricKey}`]: val }));
  };

  const onApplyEdits = () => {
    const editedKeys = Object.keys(draftEdits).filter((k) => k.startsWith(`${activeLayer}.`));
    if (!editedKeys.length) {
      setError('No edits to apply for this layer.');
      setMessage('');
      return;
    }
    const cloned = structuredClone(data);
    const project = cloned[activeProject];
    if (!project) return;

    const targetSection = project[activeLayer];
    editedKeys.forEach((composite) => {
      const metricKey = composite.split('.')[1];
      if (metricKey in targetSection) {
        targetSection[metricKey] = toNumericIfPossible(draftEdits[composite]);
      }
    });
    setData(cloned);
    savePortfolioDataSilent(cloned);
    setError('');
    setMessage(`Applied ${editedKeys.length} inline edit(s) to ${activeLayer} layer · synced to MongoDB`);
  };

  const onResetEdits = () => {
    setDraftEdits({});
    setError('');
    setMessage('Inline edits were cleared.');
  };

  return (
    <div className="ga-dash-v4">
      <div className="wrap">
        <div className="topbar">
          <div>
            <div className="brand">
              Golden Abodes · <span>Construction execution</span>
            </div>
            <div className="sub">
              <span className="pulse" aria-hidden="true" />
              Portfolio view of schedule, cost, and site performance. CSV import or inline edits.
              {mongoNote && (
                <span className="portfolio-mongo-hint" title="Persisted in MongoDB via local API">
                  {' '}
                  · {mongoNote}
                </span>
              )}
            </div>
          </div>
          <div className="actions">
            <select className="sel" value={activeProject} onChange={(e) => setActiveProject(e.target.value)} aria-label="Project">
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--t3)', alignSelf: 'center', whiteSpace: 'nowrap' }}>As of {current.monthLabel}</span>
            <button type="button" className="btn primary" onClick={onDownloadTemplate}>
              Template
            </button>
            <button type="button" className="btn" onClick={onSaveMongo} disabled={mongoBusy} title="Writes current KPIs to MongoDB">
              Save to MongoDB
            </button>
            <button type="button" className="btn" onClick={onReloadMongo} disabled={mongoBusy} title="Overwrites the screen with the last snapshot from MongoDB">
              Load from MongoDB
            </button>
            <button type="button" className="btn" onClick={onDownloadCurrent}>
              Export data
            </button>
            <input id="csv-import-portfolio" type="file" accept=".csv,text/csv" className="visually-hidden-input" onChange={onUploadCsv} />
            <label htmlFor="csv-import-portfolio" className="btn">
              Import CSV
            </label>
          </div>
        </div>

        {message && (
          <p className="portfolio-msg ok" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="portfolio-msg err" role="alert">
            {error}
          </p>
        )}

        <div className="sec">
          <div className="sh">
            <span className="st">Summary indicators</span>
          </div>
          <div className="kg k3">
            <div className="kc i">
              <div className="kl">Overall achievement</div>
              <div className="kv">{achievement}%</div>
              <div className="km">Derived from completion, quality, realization, inspection</div>
            </div>
            <div className="kc i">
              <div className="kl">Schedule recovery gap</div>
              <div className="kv">{recoveryGap} pts</div>
              <div className="km">Points required to reach SPI 1.00</div>
            </div>
            <div className="kc i">
              <div className="kl">Risk alerts</div>
              <div className="kv">{riskCount}</div>
              <div className="km">Auto-flagged from KPI threshold breaches</div>
            </div>
          </div>
        </div>

        <div className="sec">
          <div className="sh">
            <span className="st">Executive pulse</span>
          </div>
          <p className="sec-sub">Key outcomes vs plan</p>
          <div className="kg k4">
            {executiveCards.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Performance layer">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              role="tab"
              aria-selected={activeLayer === layer.id}
              className={`tab ${activeLayer === layer.id ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <div className="sec">
          <div className="sh">
            <span className="st">{LAYERS.find((layer) => layer.id === activeLayer)?.label}</span>
          </div>
          <p className="sec-sub">Layer-specific metrics</p>
          <div className="kg k4">
            {layerCards[activeLayer].map(([label, value, meta, badge, tone]) => (
              <KpiCard key={label} label={label} value={value} meta={meta} badge={badge} tone={tone} />
            ))}
          </div>
        </div>

        <div className="g22" aria-label="Charts">
          <div className="sec">
            <div className="sh">
              <span className="st">SPI and CPI trend</span>
            </div>
            <p className="sec-sub">Nov 2025 – Apr 2026 · vs target 1.0</p>
            <div className="leg">
              <span>
                <span className="ld" style={{ background: 'var(--navy)' }} />
                SPI
              </span>
              <span>
                <span className="ld" style={{ background: 'var(--gold)', opacity: 0.75 }} />
                CPI
              </span>
              <span>
                <span className="ld" style={{ background: '#d1d5db' }} />
                Target 1.0
              </span>
            </div>
            <LineChart data={current.trend} onHoverPoint={setHoverPoint} />
            <div className="chart-hint">{hoverPoint}</div>
          </div>
          <div className="sec">
            <div className="sh">
              <span className="st">Completion · planned vs actual</span>
            </div>
            <p className="sec-sub">By work package or project</p>
            <div className="leg">
              <span>
                <span className="ld" style={{ background: '#d1d5db' }} />
                Planned
              </span>
              <span>
                <span className="ld" style={{ background: 'var(--navy)' }} />
                Actual
              </span>
            </div>
            <HorizontalBars rows={current.completionChart} />
          </div>
        </div>

        <div className="sec">
          <div className="sh" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 0 }}>
            <div>
              <span className="st">Source data · {LAYERS.find((layer) => layer.id === activeLayer)?.label}</span>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={onApplyEdits}>
                Apply edits
              </button>
              <button type="button" className="btn" onClick={onResetEdits}>
                Clear draft
              </button>
            </div>
          </div>
          <p className="sec-sub">Edit below and apply, or use CSV import for bulk updates.</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Current Value</th>
                  <th>Draft Value</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map(([key, label, value]) => {
                  const editKey = `${activeLayer}.${key}`;
                  const draft = draftEdits[editKey] ?? value;
                  return (
                    <tr key={editKey}>
                      <td>{label}</td>
                      <td>{String(value)}</td>
                      <td>
                        <input value={String(draft)} onChange={(e) => onEditCell(key, e.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="foot">
          Golden Abodes · Construction execution · Portfolio KPIs · CSV / inline edits · optional MongoDB sync (local API)
        </footer>
      </div>
    </div>
  );
}
