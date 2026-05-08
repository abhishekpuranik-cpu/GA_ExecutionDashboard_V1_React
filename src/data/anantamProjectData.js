/** Anantam Signature · E Building — static aggregates (from construction tool extract 09 Apr 2026). */

export const AS_OF = '09 Apr 2026';
export const TASK_COUNT = 659;

export const L1 = [
  { n: 'Excavation', cat: 'Civil', p: 100, s: 'Completed', d: 132 },
  { n: 'Drawing (overall)', cat: 'Design', p: 24.4, s: 'In Progress', d: 228 },
  { n: 'RCC Basement–5th slab', cat: 'Civil', p: 73.74, s: 'In Progress', d: 0 },
  { n: 'Basement Floor', cat: 'Civil', p: 54.25, s: 'In Progress', d: 0 },
  { n: 'Glass Work', cat: 'General', p: 7.69, s: 'In Progress', d: 1 },
  { n: 'BBM / Masonry Work', cat: 'Masonry', p: 0, s: 'Not Started', d: 0 },
  { n: 'External Plaster Work', cat: 'Plaster', p: 0, s: 'Not Started', d: 0 },
  { n: 'Internal Plaster Work', cat: 'Plaster', p: 0, s: 'Not Started', d: 0 },
  { n: 'Waterproofing Work', cat: 'Waterproofing', p: 0, s: 'Not Started', d: 0 },
  { n: 'Electrical Work', cat: 'Electrical', p: 0, s: 'Not Started', d: 0 },
  { n: 'Plumbing Work', cat: 'Plumbing', p: 0, s: 'Not Started', d: 0 },
  { n: 'Tile Work', cat: 'Tiling', p: 0, s: 'Not Started', d: 0 },
  { n: 'Painting Work', cat: 'General', p: 0, s: 'Not Started', d: 0 },
  { n: 'Sliding Door', cat: 'General', p: 0, s: 'Not Started', d: 0 },
  { n: 'Windows', cat: 'General', p: 0, s: 'Not Started', d: 0 },
  { n: 'Wooden Door & Lobby Cladding', cat: 'General', p: 0, s: 'Not Started', d: 0 },
  { n: 'Balcony & Shaft Fins', cat: 'General', p: 0, s: 'Not Started', d: 0 },
  { n: 'Common Building Activities', cat: 'General', p: 0, s: 'Not Started', d: 156 },
  { n: 'Cleaning', cat: 'Cleaning', p: 0, s: 'Not Started', d: 105 },
  { n: 'Pest Control', cat: 'Cleaning', p: 0, s: 'Not Started', d: 99 },
  { n: 'Handover', cat: 'Closing', p: 0, s: 'Not Started', d: 90 }
];

/** c=category, t=total tasks, d=done, i=in progress, n=not started, avg=% complete, ad=avg delay days */
export const CATS = [
  { c: 'Civil', t: 67, d: 26, i: 13, n: 28, avg: 51.2, ad: 46 },
  { c: 'Design', t: 19, d: 4, i: 5, n: 10, avg: 36.8, ad: 85 },
  { c: 'Electrical', t: 72, d: 0, i: 0, n: 72, avg: 0, ad: 110 },
  { c: 'General', t: 212, d: 23, i: 4, n: 185, avg: 11.4, ad: 95 },
  { c: 'Masonry', t: 17, d: 0, i: 0, n: 17, avg: 0, ad: 0 },
  { c: 'Plaster', t: 35, d: 0, i: 0, n: 35, avg: 0, ad: 0 },
  { c: 'Plumbing', t: 62, d: 0, i: 0, n: 62, avg: 0, ad: 0 },
  { c: 'Waterproofing', t: 50, d: 0, i: 0, n: 50, avg: 0, ad: 0 },
  { c: 'Tiling', t: 121, d: 0, i: 0, n: 121, avg: 0, ad: 0 },
  { c: 'Cleaning', t: 3, d: 0, i: 0, n: 3, avg: 0, ad: 98 },
  { c: 'Painting', t: 1, d: 0, i: 0, n: 1, avg: 0, ad: 146 }
];

export const ACTIVE = [
  { n: 'Section drawing all levels', c: 'Design', p: 50, d: 88 },
  { n: '2nd slab design', c: 'Design', p: 65, d: 0 },
  { n: 'Ret wall Drawing', c: 'Design', p: 70, d: 88 },
  { n: 'Water Tank Drawing', c: 'Design', p: 26, d: 88 },
  { n: '1st slab shuttering', c: 'Civil', p: 59.9, d: 9 },
  { n: '1st slab concrete', c: 'Civil', p: 80, d: 11 },
  { n: 'Column steel plinth–1st slab', c: 'Civil', p: 89, d: 8 },
  { n: '2nd slab concrete', c: 'Civil', p: 25, d: 8 },
  { n: '2nd slab shuttering', c: 'Civil', p: 75, d: 12 },
  { n: 'R2 retaining wall concrete E-side', c: 'Civil', p: 44.7, d: 1 },
  { n: 'R2 retaining wall steel', c: 'Civil', p: 73.1, d: 6 },
  { n: 'R2 retaining wall shuttering', c: 'Civil', p: 56, d: 4 },
  { n: 'Soling work', c: 'Civil', p: 70, d: 0 }
];

export const TOPDELAY = [
  { n: 'Architecture Drawing', c: 'Design', p: 11.6, d: 241, s: 'In Progress' },
  { n: 'Drawing (overall)', c: 'General', p: 24.4, d: 228, s: 'In Progress' },
  { n: 'Center line drawing', c: 'Design', p: 100, d: 210, s: 'Completed' },
  { n: 'R1 Retaining wall steel', c: 'Civil', p: 100, d: 176, s: 'Completed' },
  { n: 'Common Building Activities', c: 'General', p: 0, d: 156, s: 'Not Started' },
  { n: 'Retaining Wall', c: 'Civil', p: 100, d: 171, s: 'Completed' },
  { n: 'Lift Lobby', c: 'Civil', p: 0, d: 156, s: 'Not Started' },
  { n: 'External Plaster', c: 'Painting', p: 0, d: 146, s: 'Not Started' },
  { n: 'Staircase Finishing', c: 'Civil', p: 0, d: 144, s: 'Not Started' },
  { n: 'Lift Raft Waterproofing', c: 'Civil', p: 100, d: 141, s: 'Completed' },
  { n: 'External Painting', c: 'Civil', p: 0, d: 121, s: 'Not Started' },
  { n: 'Louver Fixing', c: 'Electrical', p: 0, d: 110, s: 'Not Started' },
  { n: 'Lights & LED Fittings', c: 'General', p: 0, d: 105, s: 'Not Started' },
  { n: 'Cleaning', c: 'Cleaning', p: 0, d: 105, s: 'Not Started' },
  { n: 'Section drawing all levels', c: 'Design', p: 50, d: 88, s: 'In Progress' }
];

export const SLABS = [
  { n: 'B1 slab', p: 100, s: 'Completed', d: 14 },
  { n: 'Raft', p: 100, s: 'Completed', d: 18 },
  { n: '1st slab concrete', p: 80, s: 'In Progress', d: 11 },
  { n: '1st slab shuttering', p: 59.9, s: 'In Progress', d: 9 },
  { n: '2nd slab shuttering', p: 75, s: 'In Progress', d: 12 },
  { n: '2nd slab concrete', p: 25, s: 'In Progress', d: 8 },
  { n: '3rd slab', p: 0, s: 'Not Started', d: 0 },
  { n: '4th slab', p: 0, s: 'Not Started', d: 0 },
  { n: '5th slab', p: 0, s: 'Not Started', d: 0 }
];

export const MILESTONES = [
  { n: 'Piling & foundations complete', dt: 'Sep 2025', s: 'done', live: true },
  { n: 'Raft / UG water tank complete', dt: 'Sep 2025', s: 'done', live: true },
  { n: 'Excavation complete', dt: 'Sep 2025 (132d late)', s: 'late', live: true },
  { n: 'RCC basement to 5th slab', dt: 'May 2026 (est)', s: 'ip', live: true },
  { n: 'Basement floor complete', dt: 'May 2026 (est)', s: 'ip', live: true },
  { n: 'Drawing package complete', dt: '228d behind plan', s: 'crit', live: true },
  { n: 'BBM / Masonry work start', dt: 'Not started — no date set', s: 'pend', live: true },
  { n: 'MEP rough-in start', dt: 'Jun 2026 ★', s: 'pend', live: false },
  { n: 'Slab casting all floors', dt: 'Aug 2026 ★', s: 'pend', live: false },
  { n: 'Plastering complete', dt: 'Oct 2026 ★', s: 'pend', live: false },
  { n: 'Tiling & finishes complete', dt: 'Jan 2027 ★', s: 'pend', live: false },
  { n: 'Handover (originally planned)', dt: '90+ days delayed', s: 'crit', live: true }
];

export const COST_ITEMS = [
  { l: 'Civil / RCC', v: 42, col: '#5B8DEF' },
  { l: 'Foundations / Piling', v: 30, col: '#C9A44A' },
  { l: 'MEP (est)', v: 18, col: '#4CAF7D' },
  { l: 'Finishes (est)', v: 22, col: '#8B5CF6' },
  { l: 'Glass / Facade (est)', v: 8, col: '#2DD4BF' },
  { l: 'Other', v: 12, col: 'rgba(255,255,255,0.3)' }
];

export const CATEGORY_FILTER = [
  { value: 'all', label: 'All categories' },
  { value: 'Civil', label: 'Civil' },
  { value: 'Design', label: 'Design' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Tiling', label: 'Tiling' },
  { value: 'Plaster', label: 'Plaster' },
  { value: 'General', label: 'General' }
];

/** Extracted from Powerplay daily report (15 Apr 2026 - 29 Apr 2026) for simple decision-focused insights. */
export const REPORT_INSIGHTS = {
  periodLabel: '15 Apr 2026 - 29 Apr 2026',
  taskSummary: { completed: 0, inProgress: 2, inProgressDelayed: 1, notStarted: 0 },
  payableSummary: { recorded: 259770, paid: 144000, due: 115770, overdue: 115770 },
  procurementRisk: {
    poId: 'PO-E-03-004110',
    material: 'RMC M30',
    orderedQty: 90,
    deliveredQty: 0,
    expectedOn: '29 Apr 2026'
  },
  keySignals: [
    '2nd slab shuttering delayed by 4 days; now 85% complete',
    'Drawing and RCC updates continue, but no completed milestones in this period',
    'Labour attendance logged, but payable capture is incomplete across days',
    'PO due today with zero GRN can block slab continuity if not closed'
  ]
};

/** Single snapshot for MongoDB / context (same fields as named exports above). */
export const ANANTAM_DEFAULTS = {
  AS_OF,
  TASK_COUNT,
  L1,
  CATS,
  ACTIVE,
  TOPDELAY,
  SLABS,
  MILESTONES,
  COST_ITEMS,
  CATEGORY_FILTER,
  REPORT_INSIGHTS
};
