import { useEffect, useRef, useState } from 'react';
import { useAnantam } from './AnantamDataContext.jsx';
import './anantamDashboard.css';

/** Provided by chart.umd.min.js in index.html (avoids Vite failing when chart.js is not in node_modules). */
function chartCtor() {
  return typeof globalThis !== 'undefined' ? globalThis.Chart : undefined;
}

const TABS = [
  { id: 'progress', label: 'Construction Progress' },
  { id: 'schedule', label: 'Schedule & Delays' },
  { id: 'ops', label: 'Operational KPIs' },
  { id: 'financial', label: 'Financial ★' },
  { id: 'gaps', label: 'Data Gaps & Integration' }
];

function baseOpts(extra = {}) {
  const defaultScales = {
    x: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.06)' },
      ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
    }
  };
  const scales = { ...defaultScales };
  if (extra.scales) {
    Object.keys(extra.scales).forEach((k) => {
      const base = defaultScales[k] || {};
      scales[k] = { ...base, ...extra.scales[k] };
    });
  }
  const { scales: _s, plugins: ep, ...rest } = extra;
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, ...(ep || {}) },
    scales,
    ...rest
  };
}

function sc(s) {
  if (s === 'Completed') return '#4CAF7D';
  if (s === 'In Progress') return '#F59E0B';
  return 'rgba(255,255,255,0.15)';
}

function pc(p) {
  if (p >= 80) return '#4CAF7D';
  if (p >= 50) return '#F59E0B';
  return '#E05C5C';
}

function delayBadge(d) {
  if (!d) return <span className="bdg bgg">On schedule</span>;
  if (d <= 14) return <span className="bdg bga">{d}d</span>;
  return <span className="bdg bgr">{d}d</span>;
}

function exportCsv(d) {
  const rows = [
    ['Task', 'Category', 'Progress%', 'Status', 'Delay Days'],
    ...d.ACTIVE.map((t) => [t.n, t.c, t.p, 'In Progress', t.d]),
    ...d.TOPDELAY.map((t) => [t.n, t.c, t.p, t.s, t.d])
  ];
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Anantam_E_KPIs.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function fmtInr(n) {
  const v = Number(n || 0);
  return `INR ${v.toLocaleString('en-IN')}`;
}

function JourneyTimeline({ items }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((m, idx) => {
        const done = m.stage === 'done';
        const now = m.stage === 'now';
        const color = done ? 'var(--green)' : now ? 'var(--amber)' : 'rgba(255,255,255,0.25)';
        return (
          <div key={`${m.label}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: now ? '0 0 0 4px rgba(245,158,11,0.15)' : 'none' }} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-s)', fontWeight: now ? 700 : 600 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-m)' }}>{m.date}</div>
            </div>
            <span className={`bdg ${done ? 'bgg' : now ? 'bga' : 'bgs'}`}>{done ? 'Past' : now ? 'Now' : 'Next'}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReportInsightPanel() {
  const { data } = useAnantam();
  const r = data.REPORT_INSIGHTS;
  if (!r) return null;
  const overduePct = r.payableSummary.recorded > 0 ? Math.round((r.payableSummary.overdue / r.payableSummary.recorded) * 100) : 0;
  const timeline = [
    { label: 'Foundation and piling closed', date: 'Past', stage: 'done' },
    { label: 'RCC + slab cycle (active workfront)', date: 'Current focus', stage: 'now' },
    { label: 'MEP + finishing start gate', date: 'Next milestone', stage: 'next' },
    { label: 'Handover readiness', date: 'Future target', stage: 'next' }
  ];
  return (
    <div className="g22">
      <div className="sec">
        <div className="sh">
          <span className="st">Construction journey (easy view)</span>
          <span className="dtag">Now marker</span>
        </div>
        <p className="sec-sub">Where we are right now, what is done, and what is next.</p>
        <JourneyTimeline items={timeline} />
      </div>
      <div className="sec">
        <div className="sh">
          <span className="st">Report-based action insights</span>
          <span className="dtag">15 Apr - 29 Apr</span>
        </div>
        <div className="kg k3" style={{ marginBottom: 8 }}>
          <div className="kc w">
            <div className="kl">In-progress tasks</div>
            <div className="kv">{r.taskSummary.inProgress}</div>
            <div className="km">{r.taskSummary.inProgressDelayed} delayed</div>
          </div>
          <div className="kc b">
            <div className="kl">Overdue payable</div>
            <div className="kv">{fmtInr(r.payableSummary.overdue)}</div>
            <div className="km">{overduePct}% of recorded payables</div>
          </div>
          <div className="kc b">
            <div className="kl">Procurement at risk</div>
            <div className="kv">{r.procurementRisk.deliveredQty}/{r.procurementRisk.orderedQty}</div>
            <div className="km">{r.procurementRisk.material} · {r.procurementRisk.poId}</div>
          </div>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-s)', fontSize: 11, lineHeight: 1.6 }}>
          {r.keySignals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CatStatusChart() {
  const { data } = useAnantam();
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    const Chart = chartCtor();
    if (!Chart || !ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.CATS.map((c) => c.c),
        datasets: [
          {
            label: 'Completed',
            data: data.CATS.map((c) => c.d),
            backgroundColor: 'rgba(76,175,125,0.8)',
            borderRadius: 2
          },
          {
            label: 'In Progress',
            data: data.CATS.map((c) => c.i),
            backgroundColor: 'rgba(245,158,11,0.7)',
            borderRadius: 2
          },
          {
            label: 'Not Started',
            data: data.CATS.map((c) => c.n),
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 2
          }
        ]
      },
      options: baseOpts({
        scales: {
          x: { stacked: true, ticks: { maxRotation: 40, font: { size: 9, family: 'Outfit' }, color: '#7C89AD' } },
          y: { stacked: true }
        }
      })
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return (
    <div className="cw">
      <canvas ref={ref} role="img" aria-label="Task status by category" />
    </div>
  );
}

function DelayByCategoryChart() {
  const { data } = useAnantam();
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    const Chart = chartCtor();
    if (!Chart || !ref.current) return;
    const delayed = data.CATS.filter((c) => c.ad > 0);
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: delayed.map((c) => c.c),
        datasets: [
          {
            label: 'Avg delay',
            data: delayed.map((c) => c.ad),
            backgroundColor: delayed.map((c) =>
              c.ad > 100 ? 'rgba(224,92,92,0.7)' : c.ad > 50 ? 'rgba(245,158,11,0.7)' : 'rgba(91,141,239,0.6)'
            ),
            borderRadius: 4
          }
        ]
      },
      options: baseOpts({
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } } },
          y: { grid: { display: false }, ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } } }
        }
      })
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return (
    <div className="cw">
      <canvas ref={ref} role="img" aria-label="Average delay by category" />
    </div>
  );
}

function RfiDummyChart() {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    const Chart = chartCtor();
    if (!Chart || !ref.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: ['0–2d', '3–5d', '5–10d', '>10d'],
        datasets: [
          {
            label: 'RFIs',
            data: [8, 7, 5, 3],
            backgroundColor: [
              'rgba(76,175,125,0.7)',
              'rgba(245,158,11,0.7)',
              'rgba(224,92,92,0.6)',
              'rgba(224,92,92,0.9)'
            ],
            borderRadius: 4
          }
        ]
      },
      options: baseOpts()
    });
    return () => chartRef.current?.destroy();
  }, []);
  return (
    <div className="cw sm">
      <canvas ref={ref} role="img" aria-label="RFI aging buckets" />
    </div>
  );
}

function OpsCharts() {
  const { data } = useAnantam();
  const trendRef = useRef(null);
  const readinessRef = useRef(null);
  const wfRef = useRef(null);
  const safetyRef = useRef(null);
  const charts = useRef([]);

  useEffect(() => {
    const Chart = chartCtor();
    charts.current.forEach((c) => c?.destroy());
    charts.current = [];
    if (!Chart) return;

    if (trendRef.current) {
      charts.current.push(
        new Chart(trendRef.current, {
          type: 'line',
          data: {
            labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
              {
                label: 'Actual',
                data: [28, 34, 39, 44, 48, 51, 52, 53],
                borderColor: '#4CAF7D',
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#4CAF7D',
                fill: true,
                backgroundColor: 'rgba(76,175,125,0.08)',
                tension: 0.3
              },
              {
                label: 'Planned',
                data: [30, 45, 65, 90, 120, 160, 200, 240],
                borderColor: 'rgba(255,255,255,0.25)',
                borderWidth: 1.5,
                borderDash: [4, 3],
                pointRadius: 0,
                fill: false,
                tension: 0.3
              }
            ]
          },
          options: baseOpts({
            scales: {
              y: { ticks: { callback: (v) => `${v} tasks`, color: '#7C89AD', font: { size: 10, family: 'Outfit' } } }
            }
          })
        })
      );
    }

    const r = [...data.CATS].sort((a, b) => b.d / b.t - a.d / a.t);
    if (readinessRef.current) {
      charts.current.push(
        new Chart(readinessRef.current, {
          type: 'bar',
          data: {
            labels: r.map((x) => x.c),
            datasets: [
              {
                label: '% done',
                data: r.map((x) => Math.round((x.d / x.t) * 100)),
                backgroundColor: r.map((x) => {
                  const p = (x.d / x.t) * 100;
                  if (p > 60) return 'rgba(76,175,125,0.7)';
                  if (p > 20) return 'rgba(245,158,11,0.6)';
                  return 'rgba(224,92,92,0.55)';
                }),
                borderRadius: 4
              }
            ]
          },
          options: baseOpts({
            indexAxis: 'y',
            scales: {
              x: {
                min: 0,
                max: 100,
                ticks: { callback: (v) => `${v}%`, color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
              },
              y: { grid: { display: false }, ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } } }
            }
          })
        })
      );
    }

    if (wfRef.current) {
      charts.current.push(
        new Chart(wfRef.current, {
          type: 'bar',
          data: {
            labels: ['W1 Mar', 'W2 Mar', 'W3 Mar', 'W4 Mar', 'W1 Apr', 'W2 Apr'],
            datasets: [
              {
                label: 'Planned',
                data: [230, 230, 240, 240, 240, 235],
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 3
              },
              {
                label: 'Actual',
                data: [218, 225, 232, 228, 216, 218],
                backgroundColor: 'rgba(91,141,239,0.7)',
                borderRadius: 3
              }
            ]
          },
          options: baseOpts()
        })
      );
    }

    if (safetyRef.current) {
      charts.current.push(
        new Chart(safetyRef.current, {
          type: 'bar',
          data: {
            labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
              {
                label: 'LTIFR',
                data: [0.9, 0.8, 1.1, 0.7, 0.8, 0.8],
                backgroundColor: 'rgba(224,92,92,0.6)',
                borderRadius: 3,
                yAxisID: 'y'
              },
              {
                label: 'Near misses',
                data: [3, 4, 2, 5, 3, 2],
                backgroundColor: 'rgba(245,158,11,0.4)',
                borderRadius: 3,
                yAxisID: 'y1'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                min: 0,
                max: 2,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
              },
              y1: {
                position: 'right',
                min: 0,
                max: 8,
                grid: { display: false },
                ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
              },
              x: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#7C89AD', font: { size: 10, family: 'Outfit' } }
              }
            }
          }
        })
      );
    }

    return () => {
      charts.current.forEach((c) => c?.destroy());
      charts.current = [];
    };
  }, [data]);

  return (
    <>
      <div className="g22">
        <div className="sec">
          <div className="sh">
            <span className="st">Cumulative completion trend ★</span>
            <span className="dtag d">Dummy supplement</span>
          </div>
          <div className="cw">
            <canvas ref={trendRef} role="img" aria-label="Actual vs planned completions" />
          </div>
          <div className="leg">
            <span>
              <span className="ld" style={{ background: '#4CAF7D' }} />
              Actual completions
            </span>
            <span>
              <span className="ld" style={{ background: 'rgba(255,255,255,0.25)' }} />
              Planned
            </span>
          </div>
        </div>
        <div className="sec">
          <div className="sh">
            <span className="st">Category completion %</span>
            <span className="dtag">Live</span>
          </div>
          <div className="cw">
            <canvas ref={readinessRef} role="img" aria-label="Completion percent by category" />
          </div>
        </div>
      </div>
      <div className="g22">
        <div className="sec">
          <div className="sh">
            <span className="st">Workforce deployment ★</span>
            <span className="dtag d">Dummy</span>
          </div>
          <div className="cw sm">
            <canvas ref={wfRef} role="img" aria-label="Workforce planned vs actual" />
          </div>
          <div className="m3">
            <div className="mn">
              <div className="mv">218</div>
              <div className="ml">On site today</div>
            </div>
            <div className="mn">
              <div className="mv">94%</div>
              <div className="ml">Vs plan</div>
            </div>
            <div className="mn">
              <div className="mv">232</div>
              <div className="ml">Peak this month</div>
            </div>
          </div>
        </div>
        <div className="sec">
          <div className="sh">
            <span className="st">Safety metrics ★</span>
            <span className="dtag d">Dummy</span>
          </div>
          <div className="cw sm">
            <canvas ref={safetyRef} role="img" aria-label="LTIFR and near misses" />
          </div>
          <div className="m4">
            <div className="mn">
              <div className="mv">0.8</div>
              <div className="ml">LTIFR</div>
            </div>
            <div className="mn">
              <div className="mv">2</div>
              <div className="ml">Near misses MTD</div>
            </div>
            <div className="mn">
              <div className="mv">88%</div>
              <div className="ml">Toolbox talks</div>
            </div>
            <div className="mn">
              <div className="mv">1</div>
              <div className="ml">LTI YTD</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FinancialCharts() {
  const { data } = useAnantam();
  const revRef = useRef(null);
  const donutRef = useRef(null);
  const colRef = useRef(null);
  const catCostRef = useRef(null);
  const charts = useRef([]);

  useEffect(() => {
    const Chart = chartCtor();
    charts.current.forEach((c) => c?.destroy());
    charts.current = [];
    if (!Chart) return;

    if (revRef.current) {
      charts.current.push(
        new Chart(revRef.current, {
          type: 'bar',
          data: {
            labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
              {
                label: 'Actual (₹Cr)',
                data: [8, 9, 9, 10, 10, 11],
                backgroundColor: 'rgba(91,141,239,0.7)',
                borderRadius: 4,
                order: 2
              },
              {
                label: 'Target (₹Cr)',
                data: [12, 12, 13, 13, 13, 12],
                type: 'line',
                borderColor: '#C9A44A',
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#C9A44A',
                fill: false,
                tension: 0.3,
                order: 1
              }
            ]
          },
          options: baseOpts()
        })
      );
    }

    if (donutRef.current) {
      charts.current.push(
        new Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: data.COST_ITEMS.map((x) => x.l),
            datasets: [
              {
                data: data.COST_ITEMS.map((x) => x.v),
                backgroundColor: data.COST_ITEMS.map((x) => x.col),
                borderWidth: 0,
                hoverOffset: 6
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } }
        })
      );
    }

    if (colRef.current) {
      charts.current.push(
        new Chart(colRef.current, {
          type: 'bar',
          data: {
            labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
              {
                label: 'Demand (₹Cr)',
                data: [14, 15, 16, 16, 17, 17],
                backgroundColor: 'rgba(201,164,74,0.3)',
                borderRadius: 3
              },
              {
                label: 'Collected (₹Cr)',
                data: [10, 11, 12, 12, 13, 13],
                backgroundColor: 'rgba(76,175,125,0.7)',
                borderRadius: 3
              }
            ]
          },
          options: baseOpts()
        })
      );
    }

    if (catCostRef.current) {
      charts.current.push(
        new Chart(catCostRef.current, {
          type: 'bar',
          data: {
            labels: ['Excavation*', 'Civil/RCC', 'Design', 'Electrical', 'Plumbing', 'Tiling'],
            datasets: [
              {
                label: 'Budget (₹L)',
                data: [30, 180, 8, 40, 32, 55],
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 3
              },
              {
                label: 'Actual (₹L)',
                data: [30, 172, 0, 0, 0, 0],
                backgroundColor: 'rgba(91,141,239,0.7)',
                borderRadius: 3
              }
            ]
          },
          options: baseOpts({
            scales: {
              x: { ticks: { maxRotation: 30, font: { size: 9, family: 'Outfit' }, color: '#7C89AD' } }
            }
          })
        })
      );
    }

    return () => {
      charts.current.forEach((c) => c?.destroy());
      charts.current = [];
    };
  }, [data]);

  return (
    <>
      <div className="g2">
        <div className="sec">
          <div className="sh">
            <span className="st">Revenue vs target (₹ Cr) ★</span>
            <span className="dtag d">Dummy</span>
          </div>
          <div className="cw">
            <canvas ref={revRef} role="img" aria-label="Revenue vs target" />
          </div>
          <div className="leg">
            <span>
              <span className="ld" style={{ background: 'rgba(91,141,239,0.7)' }} />
              Actual
            </span>
            <span>
              <span className="ld" style={{ background: '#C9A44A' }} />
              Target
            </span>
          </div>
        </div>
        <div className="sec">
          <div className="sh">
            <span className="st">Cost breakdown ★</span>
            <span className="dtag d">Dummy · 1 real BOQ item</span>
          </div>
          <div className="cw">
            <canvas ref={donutRef} role="img" aria-label="Cost donut" />
          </div>
          <div className="leg">
            {data.COST_ITEMS.map((x) => (
              <span key={x.l}>
                <span className="ld" style={{ background: x.col }} />
                {x.l} ₹{x.v}L
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="g22">
        <div className="sec">
          <div className="sh">
            <span className="st">Collections trend (₹ Cr) ★</span>
            <span className="dtag d">Dummy</span>
          </div>
          <div className="cw sm">
            <canvas ref={colRef} role="img" aria-label="Collections" />
          </div>
          <div className="m3">
            <div className="mn">
              <div className="mv">₹24Cr</div>
              <div className="ml">Pending receivables</div>
            </div>
            <div className="mn">
              <div className="mv">₹108Cr</div>
              <div className="ml">Demand raised</div>
            </div>
            <div className="mn">
              <div className="mv">73%</div>
              <div className="ml">Collection eff.</div>
            </div>
          </div>
        </div>
        <div className="sec">
          <div className="sh">
            <span className="st">Budget vs actual by category (₹ L) ★</span>
            <span className="dtag d">Dummy</span>
          </div>
          <div className="cw sm">
            <canvas ref={catCostRef} role="img" aria-label="Budget vs actual" />
          </div>
          <div className="leg">
            <span>
              <span className="ld" style={{ background: 'rgba(255,255,255,0.12)' }} />
              Budget
            </span>
            <span>
              <span className="ld" style={{ background: 'rgba(91,141,239,0.7)' }} />
              Actual
            </span>
            <span style={{ color: '#4CAF7D', fontSize: 10 }}>* Excavation ₹30L is real data</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AnantamEBuildingDashboard() {
  const { data, mongoNote, busy, saveToMongo, reloadFromMongo } = useAnantam();
  const [tab, setTab] = useState('progress');
  const [catFilter, setCatFilter] = useState('all');

  return (
    <div className="anantam-root">
      <div className="wrap">
        <div className="topbar">
          <div>
            <div className="brand">
              Golden Abodes · <span>Anantam Signature · E Building</span>
            </div>
            <div className="sub">
              <span className="pulse" />
              Construction tool extract · {data.AS_OF} &nbsp;·&nbsp; {data.TASK_COUNT} tasks tracked
              {mongoNote && (
                <span className="portfolio-mongo-hint" style={{ color: 'var(--text-m)' }}>
                  {' '}
                  · {mongoNote}
                </span>
              )}
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn primary" disabled={busy} onClick={saveToMongo} title="Save current dashboard data to MongoDB">
              Save view to MongoDB
            </button>
            <button type="button" className="btn" disabled={busy} onClick={reloadFromMongo} title="Reload last saved snapshot from MongoDB">
              Load from MongoDB
            </button>
            <select className="sel" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter category">
              {data.CATEGORY_FILTER.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => exportCsv(data)}>
              Export CSV
            </button>
            <span className="dtag">
              <span className="pulse" style={{ width: 5, height: 5, marginRight: 4 }} />
              Live tool data
            </span>
            <span className="dtag d">★ Dummy supplement</span>
            <span className="dtag g">✕ Data gap</span>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'progress' && (
          <div id="pane-progress" className="pane active">
            <div className="abar r">
              ⚠ Drawing package <strong>228 days behind plan</strong> · Design avg delay 85 days · Electrical (72 tasks), Plumbing (62), Tiling (121) have{' '}
              <strong>zero tasks started</strong>
            </div>
            <div className="sec">
              <div className="sh">
                <span className="st">Project pulse — Anantam Signature E Building</span>
                <span className="dtag">Live · {data.AS_OF}</span>
              </div>
              <div className="kg k5">
                <div className="kc w">
                  <div className="kl">Overall progress</div>
                  <div className="kv">
                    12.6<small style={{ fontSize: 13, color: 'var(--text-m)' }}>%</small>
                  </div>
                  <div className="km">53 done / {data.TASK_COUNT} tasks</div>
                  <span className="kp p-w">Below milestone</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '12.6%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc ok">
                  <div className="kl">Tasks completed</div>
                  <div className="kv">53</div>
                  <div className="km">Foundations + Piling</div>
                  <span className="kp p-ok">Substructure clear</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '8%', background: 'var(--green)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">In progress</div>
                  <div className="kv">22</div>
                  <div className="km">Civil + Design active</div>
                  <span className="kp p-w">3.3% of scope</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '3.3%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Not started</div>
                  <div className="kv">584</div>
                  <div className="km">88.6% of scope</div>
                  <span className="kp p-b">Schedule risk</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '88%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Max drawing delay</div>
                  <div className="kv">
                    228<small style={{ fontSize: 13, color: 'var(--text-m)' }}>d</small>
                  </div>
                  <div className="km">Architecture drawing</div>
                  <span className="kp p-b">Critical path risk</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '85%', background: 'var(--red)' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <span className="bdg bgg">✓ Piling complete</span>
                <span className="bdg bgg">✓ Foundations complete</span>
                <span className="bdg bgg">✓ Raft complete</span>
                <span className="bdg bga">⟳ RCC 73.7%</span>
                <span className="bdg bga">⟳ Basement floor 54.3%</span>
                <span className="bdg bgr">✕ Electrical 0/72</span>
                <span className="bdg bgr">✕ Plumbing 0/62</span>
                <span className="bdg bgr">✕ Tiling 0/121</span>
              </div>
            </div>

            <ReportInsightPanel />

            <div className="g22">
              <div className="sec">
                <div className="sh">
                  <span className="st">WBS L1 — major work packages</span>
                  <span className="dtag">Live</span>
                </div>
                {data.L1.map((t) => (
                  <div key={t.n} className="wn">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc(t.s), flexShrink: 0, marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-s)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.n}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-m)' }}>{t.cat}</div>
                    </div>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <div className="pt">
                        <div className="pf" style={{ width: `${t.p}%`, background: sc(t.s) }} />
                      </div>
                    </div>
                    <div style={{ width: 36, fontSize: 11, fontWeight: 700, textAlign: 'right', color: sc(t.s) }}>{t.p}%</div>
                    <div style={{ width: 55, textAlign: 'right', fontSize: 10, color: t.d > 0 ? 'var(--red)' : 'var(--text-m)' }}>{t.d > 0 ? `+${t.d}d` : ''}</div>
                  </div>
                ))}
              </div>
              <div className="sec">
                <div className="sh">
                  <span className="st">Task status by category</span>
                  <span className="dtag">Live</span>
                </div>
                <CatStatusChart />
                <div className="leg">
                  <span>
                    <span className="ld" style={{ background: 'var(--green)' }} />
                    Completed
                  </span>
                  <span>
                    <span className="ld" style={{ background: 'var(--amber)' }} />
                    In progress
                  </span>
                  <span>
                    <span className="ld" style={{ background: 'rgba(255,255,255,0.15)' }} />
                    Not started
                  </span>
                </div>
              </div>
            </div>

            <div className="sec">
              <div className="sh">
                <span className="st">Active work items — 13 in-progress leaf tasks</span>
                <span className="dtag">Live · {data.AS_OF}</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Category</th>
                    <th>Progress</th>
                    <th>Delay</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ACTIVE.map((t) => (
                    <tr key={t.n} style={{ opacity: catFilter === 'all' || t.c === catFilter ? 1 : 0.3 }}>
                      <td style={{ fontWeight: 600 }}>{t.n}</td>
                      <td>
                        <span className={`bdg ${t.c === 'Civil' ? 'bgb' : 'bgp'}`}>{t.c}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: 'rgba(255,255,255,0.07)',
                              borderRadius: 999,
                              overflow: 'hidden',
                              minWidth: 70
                            }}
                          >
                            <div style={{ height: '100%', width: `${t.p}%`, background: pc(t.p), borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pc(t.p) }}>{t.p}%</span>
                        </div>
                      </td>
                      <td>{delayBadge(t.d)}</td>
                      <td>
                        <span style={{ fontSize: 11, color: t.d > 20 ? 'var(--red)' : t.d > 0 ? 'var(--amber)' : 'var(--green)' }}>
                          {t.d > 20 ? '⚠ Behind — needs recovery' : t.d > 0 ? 'Slight delay — monitor' : 'On track'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sec">
              <div className="sh">
                <span className="st">Category readiness — % tasks complete</span>
                <span className="dtag">Live</span>
              </div>
              {data.CATS.map((c) => (
                <div key={c.c} className="pr">
                  <div className="pl">
                    {c.c} <small style={{ color: 'var(--text-m)' }}>({c.t} tasks)</small>
                  </div>
                  <div className="pt">
                    <div className="pf" style={{ width: `${(c.d / c.t) * 100}%`, background: 'var(--green)' }} />
                  </div>
                  <div className="pv" style={{ color: c.avg > 50 ? 'var(--green)' : c.avg > 20 ? 'var(--amber)' : 'var(--red)' }}>{Math.round(c.avg)}%</div>
                  <div className={`pd ${c.ad > 100 ? 'db' : c.ad > 50 ? 'dw' : c.ad > 0 ? 'dw' : 'dok'}`}>
                    {c.ad > 0 ? `avg +${c.ad}d delay` : 'No delays'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'schedule' && (
          <div id="pane-schedule" className="pane active">
            <div className="abar a">
              ⚠ Structural slab programme behind: 2nd slab at 35% vs target 80% by Apr 1. Drawing package critically delayed. Handover flagged +90 days.
            </div>
            <div className="sec">
              <div className="sh">
                <span className="st">Schedule KPIs</span>
                <span className="dtag">Live · Derived from tool</span>
              </div>
              <div className="kg k4">
                <div className="kc b">
                  <div className="kl">SPI — schedule performance</div>
                  <div className="kv">0.77</div>
                  <div className="km">Actual vs planned progress</div>
                  <span className="kp p-b">23% behind plan</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '77%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Avg delay — all delayed tasks</div>
                  <div className="kv">
                    92<small style={{ fontSize: 13, color: 'var(--text-m)' }}>d</small>
                  </div>
                  <div className="km">Across 68 tasks with delay</div>
                  <span className="kp p-b">Critical</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '80%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Max delay observed</div>
                  <div className="kv">
                    241<small style={{ fontSize: 13, color: 'var(--text-m)' }}>d</small>
                  </div>
                  <div className="km">Architecture drawing</div>
                  <span className="kp p-b">8 months behind</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '95%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">Handover risk</div>
                  <div className="kv">
                    90+<small style={{ fontSize: 13, color: 'var(--text-m)' }}>d</small>
                  </div>
                  <div className="km">Handover task already flagged</div>
                  <span className="kp p-w">3+ months at risk</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '70%', background: 'var(--amber)' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="g22">
              <div className="sec">
                <div className="sh">
                  <span className="st">Milestone tracker</span>
                  <span className="dtag">Live</span>
                  <span className="dtag d">★ Dummy</span>
                </div>
                {data.MILESTONES.map((m) => {
                  const col = { done: '#4CAF7D', late: '#F59E0B', ip: '#5B8DEF', crit: '#E05C5C', pend: 'rgba(255,255,255,0.2)' };
                  return (
                    <div key={m.n} className="wn">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col[m.s], flexShrink: 0, marginTop: 3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{m.n}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-m)' }}>{m.dt}</div>
                      </div>
                      {!m.live && (
                        <span className="dtag d" style={{ fontSize: 9, padding: '1px 5px' }}>
                          ★
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="sec">
                <div className="sh">
                  <span className="st">Avg delay by category (days)</span>
                  <span className="dtag">Live</span>
                </div>
                <DelayByCategoryChart />
              </div>
            </div>

            <div className="g22">
              <div className="sec">
                <div className="sh">
                  <span className="st">Top 15 most delayed tasks</span>
                  <span className="dtag">Live</span>
                </div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Category</th>
                      <th>Delay</th>
                      <th>Status</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.TOPDELAY.map((t, idx) => (
                      <tr key={`delay-${idx}-${t.n}`}>
                        <td style={{ fontWeight: 600, maxWidth: 200 }}>{t.n}</td>
                        <td>
                          <span
                            className={`bdg ${t.c === 'Civil' ? 'bgb' : t.c === 'Design' ? 'bgp' : t.c === 'Electrical' ? 'bgd' : 'bgs'}`}
                          >
                            {t.c}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: t.d > 150 ? 'var(--red)' : t.d > 80 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>+{t.d}d</span>
                        </td>
                        <td>
                          <span className={`bdg ${t.s === 'Completed' ? 'bgg' : t.s === 'In Progress' ? 'bga' : 'bgr'}`}>{t.s}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 50, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${t.p}%`, background: pc(t.p) }} />
                            </div>
                            <span style={{ fontSize: 11 }}>{t.p}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sec">
                <div className="sh">
                  <span className="st">Structural slab progress — floor by floor</span>
                  <span className="dtag">Live · Civil</span>
                </div>
                {data.SLABS.map((s) => (
                  <div key={s.n} className="pr s">
                    <div className="pl">{s.n}</div>
                    <div className="pt">
                      <div className="pf" style={{ width: `${s.p}%`, background: sc(s.s) }} />
                    </div>
                    <div className="pv" style={{ color: sc(s.s) }}>
                      {s.p}%
                    </div>
                    <div className="pd">{delayBadge(s.d)}</div>
                  </div>
                ))}
                <div className="sh" style={{ marginTop: 14 }}>
                  <span className="st">RFI aging ★</span>
                  <span className="dtag d">Dummy</span>
                </div>
                <RfiDummyChart />
                <div className="m3" style={{ marginTop: 8 }}>
                  <div className="mn">
                    <div className="mv">23</div>
                    <div className="ml">Open RFIs</div>
                  </div>
                  <div className="mn">
                    <div className="mv">8</div>
                    <div className="ml">Aging &gt;5d</div>
                  </div>
                  <div className="mn">
                    <div className="mv">4.2d</div>
                    <div className="ml">Avg resolution</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'ops' && (
          <div id="pane-ops" className="pane active">
            <div className="abar i">
              ℹ KPIs marked ★ use dummy data. To activate: integrate workforce attendance, NCR/quality system, safety register, and material PO tracker.
            </div>
            <div className="sec">
              <div className="sh">
                <span className="st">Operational KPIs — E Building</span>
              </div>
              <div className="kg k5">
                <div className="kc b">
                  <div className="kl">
                    SPI <span className="dtag" style={{ fontSize: 9, padding: '1px 5px' }}>Live</span>
                  </div>
                  <div className="kv">0.77</div>
                  <div className="km">Target: ≥ 1.0</div>
                  <span className="kp p-b">Critical</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '77%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">
                    CPI ★ <span className="dtag d" style={{ fontSize: 9, padding: '1px 5px' }}>Dummy</span>
                  </div>
                  <div className="kv">0.94</div>
                  <div className="km">Target: ≥ 1.0</div>
                  <span className="kp p-w">Overspend risk</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '94%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">
                    Progress vs plan <span className="dtag" style={{ fontSize: 9, padding: '1px 5px' }}>Live</span>
                  </div>
                  <div className="kv">
                    12.6<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Plan was 22% by Apr</div>
                  <span className="kp p-b">9.4 pts behind</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '57%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">
                    Quality score ★ <span className="dtag d" style={{ fontSize: 9, padding: '1px 5px' }}>Dummy</span>
                  </div>
                  <div className="kv">
                    84<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Target: ≥ 90%</div>
                  <span className="kp p-w">Below threshold</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '84%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">
                    Design SLA <span className="dtag" style={{ fontSize: 9, padding: '1px 5px' }}>Live</span>
                  </div>
                  <div className="kv">
                    38<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Design tasks on schedule</div>
                  <span className="kp p-b">Critical bottleneck</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '38%', background: 'var(--red)' }} />
                  </div>
                </div>
              </div>
            </div>
            <OpsCharts />
          </div>
        )}

        {tab === 'financial' && (
          <div id="pane-financial" className="pane active">
            <div className="abar a">
              ★ All financial data is supplemented dummy data. Construction tool provides task/progress only. Cost &amp; revenue require ERP/accounting integration.{' '}
              <strong>Only excavation (₹30L) has real pricing in the tool.</strong>
            </div>
            <div className="sec">
              <div className="sh">
                <span className="st">Financial KPIs ★</span>
                <span className="dtag d">Dummy supplement</span>
              </div>
              <div className="kg k5">
                <div className="kc w">
                  <div className="kl">Project IRR</div>
                  <div className="kv">
                    18.2<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Target 22% · Hurdle 16%</div>
                  <span className="kp p-w">3.8 pts below target</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '83%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Cost / sq ft</div>
                  <div className="kv">₹4,850</div>
                  <div className="km">Budget ₹4,600</div>
                  <span className="kp p-b">5.4% over budget</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '60%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">Revenue realization</div>
                  <div className="kv">
                    84<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Target 90%</div>
                  <span className="kp p-w">6 pts gap</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '84%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc w">
                  <div className="kl">EBITDA margin</div>
                  <div className="kv">
                    24.1<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Target 28%</div>
                  <span className="kp p-w">Margin pressure</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '86%', background: 'var(--amber)' }} />
                  </div>
                </div>
                <div className="kc b">
                  <div className="kl">Receivables</div>
                  <div className="kv">
                    73<small style={{ fontSize: 13 }}>%</small>
                  </div>
                  <div className="km">Target 85%</div>
                  <span className="kp p-b">Cash flow stress</span>
                  <div className="kb">
                    <div className="kbf" style={{ width: '73%', background: 'var(--red)' }} />
                  </div>
                </div>
              </div>
            </div>
            <FinancialCharts />
          </div>
        )}

        {tab === 'gaps' && (
          <div id="pane-gaps" className="pane active">
            <div className="sec">
              <div className="sh">
                <span className="st">What the construction tool gives you today</span>
                <span className="dtag">Live · Available now</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 10 }}>
                <div className="gc-card avail">
                  <div style={{ fontSize: 18, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Task progress &amp; WBS hierarchy</div>
                  <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>
                    {data.TASK_COUNT} tasks, L1–L5 WBS, progress %, status, parent-leaf structure. Fully powers construction progress tab.
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    Fields: ProgressPct, Status, Level, ParentLeaf
                  </div>
                </div>
                <div className="gc-card avail">
                  <div style={{ fontSize: 18, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Planned vs actual schedule dates</div>
                  <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>
                    Start/end dates, actual start/end, duration, delay string per task. Enables SPI derivation, milestone tracking, delay analysis.
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    Fields: StartDate, EndDate, ActualStart, ActualEnd, Delay
                  </div>
                </div>
                <div className="gc-card avail">
                  <div style={{ fontSize: 18, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Work category &amp; member assignment</div>
                  <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>
                    11 categories (Civil, Design, Electrical, Plumbing, Tiling, Plaster, Waterproofing, Masonry, Painting, Cleaning, General). Member names per task for accountability.
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    Fields: WorkCategory, Assigned Members
                  </div>
                </div>
                <div className="gc-card avail">
                  <div style={{ fontSize: 18, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Physical quantity tracking (UOM)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>
                    TotalQty, ProgressQty in cum/kg/% for Civil tasks. Earned value calculation possible once BOQ prices are added.
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    Fields: TotalQty, ProgressQty, UOM — active for Civil category
                  </div>
                </div>
                <div className="gc-card part">
                  <div style={{ fontSize: 18, marginBottom: 8 }}>⚑</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Cost / BOQ — partial (1/{data.TASK_COUNT} tasks)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>
                    Only excavation (₹30L) is priced. CurrentPrice and TotalPrice fields exist for all tasks but are blank for 658 of them. Full BOQ must be uploaded.
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                    Gap: BOQ for Civil, MEP, Finishes, Tiling (~₹30–40 Cr scope unpriced)
                  </div>
                </div>
              </div>
            </div>

            <div className="sec">
              <div className="sh">
                <span className="st">Data required to make dashboard fully functional</span>
                <span className="dtag g">Missing — needs integration</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 10 }}>
                {[
                  {
                    t: 'Full BOQ — task-level budgets',
                    b: 'CPI, cost/sq ft, EAC, cost-to-complete, and budget variance cannot be calculated without line-item budgets mapped to each TaskID.',
                    f: 'Source: Quantity surveyor BOQ → upload into tool CurrentPrice field'
                  },
                  {
                    t: 'Actual cost — bills & GRN',
                    b: 'Invoice values, GRNs, and subcontractor bills must be mapped per WBS activity to calculate actual spend. Currently ₹0 data available.',
                    f: 'Source: Tally ERP / purchase system → match to TaskID'
                  },
                  {
                    t: 'Daily workforce attendance',
                    b: 'Workforce vs plan KPI requires daily headcount by trade. Biometric/attendance system not linked to the task tool extract.',
                    f: 'Source: Biometric / HR module → daily by trade category'
                  },
                  {
                    t: 'Quality NCRs & inspection records',
                    b: 'Quality score requires NCR logs, inspection pass/fail per task, third-party audit results. Not in current tool extract.',
                    f: 'Source: Quality management system or NCR Excel register → link to TaskID'
                  },
                  {
                    t: 'Safety incidents & LTIFR',
                    b: 'Requires incident log, man-hours worked per day, LTI count, near-miss reports, toolbox talk attendance. Not in tool extract.',
                    f: 'Source: HSE register / EHS system → daily man-hour log'
                  },
                  {
                    t: 'RFI & change order register',
                    b: 'Change order rate and RFI KPIs need a formal register with submission date, response date, cost impact per CO, and approver.',
                    f: 'Source: Construction tool or separate register sheet'
                  },
                  {
                    t: 'Material delivery & PO status',
                    b: 'Material on-time delivery KPI needs planned vs actual delivery date per PO linked to task ID. Procurement not linked to site tool.',
                    f: 'Source: Procurement / PO system → weekly export'
                  },
                  {
                    t: 'Sales, CLP & collections',
                    b: 'Revenue realization, receivables, and RERA-linked CLP collection data require CRM/sales booking data and Tally accounts receivable.',
                    f: 'Source: CRM + Tally AR module → monthly extract'
                  }
                ].map((x) => (
                  <div key={x.t} className="gc-card miss">
                    <div style={{ fontSize: 18, marginBottom: 8 }}>✕</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{x.t}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.6 }}>{x.b}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>{x.f}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sec">
              <div className="sh">
                <span className="st">Recommended integration roadmap — 3 layers</span>
              </div>
              <div className="g3">
                <div className="gc-card" style={{ borderColor: 'rgba(76,175,125,0.4)' }}>
                  <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Layer 1 · Available now
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)', lineHeight: 1.8 }}>
                    ✓ Weekly construction tool export
                    <br />
                    ✓ Task progress, status, delays
                    <br />
                    ✓ WBS hierarchy L1–L5
                    <br />
                    ✓ Member assignment
                    <br />✓ Schedule planned vs actual
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    Action: Set up weekly Excel export cadence from construction tool → import to this dashboard
                  </div>
                </div>
                <div className="gc-card" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
                  <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Layer 2 · Add in 30 days (Excel)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)', lineHeight: 1.8 }}>
                    ⟳ BOQ upload into construction tool
                    <br />
                    ⟳ Weekly CO / RFI register (Excel)
                    <br />
                    ⟳ Daily workforce sheet (Excel)
                    <br />
                    ⟳ Safety incident register (Excel)
                    <br />⟳ Material delivery tracker (Excel)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    No system integration needed — Excel uploads from site team on weekly cadence
                  </div>
                </div>
                <div className="gc-card" style={{ borderColor: 'rgba(91,141,239,0.4)' }}>
                  <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Layer 3 · Integrate 60–90 days
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)', lineHeight: 1.8 }}>
                    ◎ Tally ERP → actual cost &amp; GRN
                    <br />
                    ◎ CRM → bookings &amp; sales velocity
                    <br />
                    ◎ Accounts receivable → collections
                    <br />
                    ◎ Procurement → live PO status
                    <br />◎ Biometric → daily workforce count
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    Requires API or scheduled data export from source systems — fintech/ERP team involvement
                  </div>
                </div>
              </div>
            </div>

            <div className="sec">
              <div className="sh">
                <span className="st">Immediate actions — what to fix this week</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Data it unlocks</th>
                    <th>Effort</th>
                    <th>Owner</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['1', `Upload BOQ into construction tool CurrentPrice field for all ${data.TASK_COUNT} tasks`, 'CPI, cost/sqft, EAC, budget variance', '1–2 days', 'QS + PMO', 'bgr', 'Critical'],
                    ['2', 'Set up weekly Excel CO/RFI register with cost impact + response date', 'Change order rate, RFI resolution KPI', '2 hrs setup', 'PM', 'bgr', 'High'],
                    ['3', 'Daily workforce headcount sheet — by trade (Civil, MEP, Finishes)', 'Workforce vs plan, labour productivity', '1 hr setup', 'Site manager', 'bga', 'High'],
                    ['4', 'HSE daily register — incident type, manpower hours, near-miss report', 'LTIFR, safety score, toolbox compliance', '1 hr setup', 'HSE officer', 'bga', 'High'],
                    ['5', 'Fix drawing delay — architecture drawing 241d behind blocks MEP & finishes', 'Unblocks 72 Electrical + 62 Plumbing tasks from starting', 'Immediate action', 'Design head + PMO', 'bgr', 'Critical'],
                    ['6', 'Export weekly tool dump on fixed schedule — every Monday 9am', 'Dashboard auto-refresh from live data', '15 min/week', 'PMO admin', 'bgb', 'Medium']
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td style={{ fontWeight: 700, color: 'var(--gold)' }}>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td>{row[4]}</td>
                      <td>
                        <span className={`bdg ${row[5]}`}>{row[6]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
