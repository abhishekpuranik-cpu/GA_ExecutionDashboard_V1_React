import {
  parseTaskCSV,
  buildSlicesFromTasks,
  persistImportPayload,
  loadPersistedImportPayload,
  clearPersistedImport,
  generateWorkTreeTemplateCSV,
} from './gaDashboardV4Import.js';
import { parsePowerplayExcel, parsePowerplayPdf } from './gaDashboardV4Powerplay.js';

/* ═══════════════════════════════════════════════
   CHART PALETTE — designed for white backgrounds
════════════════════════════════════════════════ */
const C={
  navy:'#1e3a5f',navyF:'rgba(30,58,95,.12)',
  blue:'#1d4ed8',blueF:'rgba(29,78,216,.1)',
  green:'#0f6d50',greenF:'rgba(15,109,80,.12)',
  amber:'#a16207',amberF:'rgba(161,98,7,.1)',
  red:'#b91c1c',redF:'rgba(185,28,28,.08)',
  gold:'#96690b',goldF:'rgba(150,105,11,.1)',
  teal:'#0d7a6e',purple:'#6d28d9',
  gray:'#9ca3af',grid:'rgba(0,0,0,.07)',tick:'#9ca3af',
  f:'DM Sans,system-ui,sans-serif'
};
const tt={backgroundColor:'#fff',titleColor:'#111827',bodyColor:'#374151',borderColor:'#e4e2dc',borderWidth:1,padding:10,titleFont:{weight:'600',family:C.f},bodyFont:{family:C.f}};
const gO=(ex={})=>({responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tt},scales:{x:{grid:{color:C.grid},ticks:{color:C.tick,font:{size:11,family:C.f}},...(ex.sx||{})},y:{grid:{color:C.grid},ticks:{color:C.tick,font:{size:11,family:C.f}},...(ex.sy||{})}},...ex});
const R={};
function dc(id){if(R[id]){R[id].destroy();delete R[id]}}
function rc(id,ch){R[id]=ch;return ch}

/** Shorten long category / WBS names so bar charts stay readable */
function chartLbl(s, max = 24) {
  const t = String(s ?? '');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Chart.js measures canvas while `display:none` → broken layout; call after view switch or DOM update */
function resizeAllCharts() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Object.keys(R).forEach((k) => {
        try {
          const ch = R[k];
          if (ch && typeof ch.resize === 'function') ch.resize();
        } catch {
          /* ignore */
        }
      });
    });
  });
}

/* ═══════════════════════════════════════════════
   PROJECT DATA
════════════════════════════════════════════════ */
const PROJECTS={
  p1:{name:'Anantam Signature',sub:'E Building',tasks:659,done:53,ip:22,ns:584,spi:0.77,cpi:0.94,completion:12.6,boq:148,spent:112,maxDelay:241,color:'#1e3a5f'},
  p2:{name:'GA Residences',sub:'Pimpri',tasks:420,done:182,ip:38,ns:200,spi:0.94,cpi:0.96,completion:69,boq:95,spent:62,maxDelay:45,color:'#96690b'},
  p3:{name:'GA Heights',sub:'Mumbai',tasks:310,done:198,ip:25,ns:87,spi:0.91,cpi:0.93,completion:74,boq:120,spent:82,maxDelay:67,color:'#0f6d50'},
  p4:{name:'GA Villas',sub:'Goa',tasks:180,done:82,ip:18,ns:80,spi:0.94,cpi:0.97,completion:52,boq:68,spent:34,maxDelay:28,color:'#6d28d9'}
};
const PROJECTS_DEFAULT_P1={...PROJECTS.p1};

const L1_DEFAULT=[
  {n:'Excavation',cat:'Civil',p:100,s:'Completed',d:132},
  {n:'Drawing (overall)',cat:'Design',p:24.4,s:'In Progress',d:228},
  {n:'RCC Basement–5th slab',cat:'Civil',p:73.74,s:'In Progress',d:0},
  {n:'Basement Floor',cat:'Civil',p:54.25,s:'In Progress',d:0},
  {n:'Glass Work',cat:'General',p:7.69,s:'In Progress',d:1},
  {n:'BBM / Masonry Work',cat:'Masonry',p:0,s:'Not Started',d:0},
  {n:'External Plaster Work',cat:'Plaster',p:0,s:'Not Started',d:0},
  {n:'Internal Plaster Work',cat:'Plaster',p:0,s:'Not Started',d:0},
  {n:'Waterproofing Work',cat:'Waterproofing',p:0,s:'Not Started',d:0},
  {n:'Electrical Work',cat:'Electrical',p:0,s:'Not Started',d:0},
  {n:'Plumbing Work',cat:'Plumbing',p:0,s:'Not Started',d:0},
  {n:'Tile Work',cat:'Tiling',p:0,s:'Not Started',d:0},
  {n:'Painting Work',cat:'General',p:0,s:'Not Started',d:0},
  {n:'Sliding Door',cat:'General',p:0,s:'Not Started',d:0},
  {n:'Windows',cat:'General',p:0,s:'Not Started',d:0},
  {n:'Wooden Door & Lobby Cladding',cat:'General',p:0,s:'Not Started',d:0},
  {n:'Common Building Activities',cat:'General',p:0,s:'Not Started',d:156},
  {n:'Cleaning',cat:'Cleaning',p:0,s:'Not Started',d:105},
  {n:'Handover',cat:'Closing',p:0,s:'Not Started',d:90}
];
let L1=L1_DEFAULT.map((x)=>({...x}));
const CATS_DEFAULT=[
  {c:'Civil',t:67,d:26,i:13,n:28,avg:51.2,ad:46},
  {c:'Design',t:19,d:4,i:5,n:10,avg:36.8,ad:85},
  {c:'Electrical',t:72,d:0,i:0,n:72,avg:0,ad:110},
  {c:'General',t:212,d:23,i:4,n:185,avg:11.4,ad:95},
  {c:'Masonry',t:17,d:0,i:0,n:17,avg:0,ad:0},
  {c:'Plaster',t:35,d:0,i:0,n:35,avg:0,ad:0},
  {c:'Plumbing',t:62,d:0,i:0,n:62,avg:0,ad:0},
  {c:'Waterproofing',t:50,d:0,i:0,n:50,avg:0,ad:0},
  {c:'Tiling',t:121,d:0,i:0,n:121,avg:0,ad:0},
  {c:'Cleaning',t:3,d:0,i:0,n:3,avg:0,ad:98},
  {c:'Painting',t:1,d:0,i:0,n:1,avg:0,ad:146}
];
let CATS=CATS_DEFAULT.map((x)=>({...x}));
const ACTIVE_DEFAULT=[
  {n:'Section drawing all levels',c:'Design',p:50,d:88},{n:'2nd slab design',c:'Design',p:65,d:0},
  {n:'Ret wall Drawing',c:'Design',p:70,d:88},{n:'Water Tank Drawing',c:'Design',p:26,d:88},
  {n:'1st slab shuttering',c:'Civil',p:59.9,d:9},{n:'1st slab concrete',c:'Civil',p:80,d:11},
  {n:'Column steel plinth–1st slab',c:'Civil',p:89,d:8},{n:'2nd slab concrete',c:'Civil',p:25,d:8},
  {n:'2nd slab shuttering',c:'Civil',p:75,d:12},{n:'R2 retaining wall concrete',c:'Civil',p:44.7,d:1},
  {n:'R2 retaining wall steel',c:'Civil',p:73.1,d:6},{n:'R2 retaining wall shuttering',c:'Civil',p:56,d:4},
  {n:'Soling work',c:'Civil',p:70,d:0}
];
let ACTIVE=ACTIVE_DEFAULT.map((x)=>({...x}));
const TOPDELAY_DEFAULT=[
  {n:'Architecture Drawing',c:'Design',p:11.6,d:241,s:'In Progress'},
  {n:'Drawing (overall)',c:'General',p:24.4,d:228,s:'In Progress'},
  {n:'Center line drawing',c:'Design',p:100,d:210,s:'Completed'},
  {n:'R1 Retaining wall steel',c:'Civil',p:100,d:176,s:'Completed'},
  {n:'Common Building Activities',c:'General',p:0,d:156,s:'Not Started'},
  {n:'Lift Lobby',c:'Civil',p:0,d:156,s:'Not Started'},
  {n:'External Plaster',c:'Painting',p:0,d:146,s:'Not Started'},
  {n:'Staircase Finishing',c:'Civil',p:0,d:144,s:'Not Started'},
  {n:'External Painting',c:'Civil',p:0,d:121,s:'Not Started'},
  {n:'Louver Fixing',c:'Electrical',p:0,d:110,s:'Not Started'},
  {n:'Lights & LED Fittings',c:'General',p:0,d:105,s:'Not Started'},
  {n:'Cleaning',c:'Cleaning',p:0,d:105,s:'Not Started'},
  {n:'Section drawing all levels',c:'Design',p:50,d:88,s:'In Progress'},
  {n:'Ret wall Drawing',c:'Design',p:70,d:88,s:'In Progress'},
  {n:'Water Tank Drawing',c:'Design',p:26,d:88,s:'In Progress'}
];
let TOPDELAY=TOPDELAY_DEFAULT.map((x)=>({...x}));
const CONTRACTORS=[
  {name:'Namdev Shingulwar & Co.',cat:'Civil / RCC',boq:4200,cert:3960,paid:3600,ret:198},
  {name:'Krunal Thorat Const.',cat:'Civil / Structural',boq:1800,cert:1620,paid:1440,ret:81},
  {name:'MEP Systems Pvt Ltd',cat:'MEP (Electrical)',boq:1200,cert:0,paid:0,ret:0},
  {name:'AquaTech Plumbing',cat:'Plumbing',boq:680,cert:0,paid:0,ret:0},
  {name:'Flooring Solutions',cat:'Tiling / Flooring',boq:920,cert:0,paid:0,ret:0},
  {name:'Minal Firake Associates',cat:'Design / Drawings',boq:180,cert:120,paid:100,ret:6},
  {name:'GlassTech Facades',cat:'Glass / Facade',boq:320,cert:22,paid:18,ret:1}
];
const MATERIALS_DEFAULT=[
  {m:'Ready Mix Concrete (M30)',u:'cum',boq:2400,po:2400,grn:1820,pend:580,rate:7800,poval:1872,paid:1420},
  {m:'TMT Steel Fe500 (12mm)',u:'MT',boq:280,po:280,grn:198,pend:82,rate:62000,poval:1736,paid:1228},
  {m:'TMT Steel Fe500 (16mm)',u:'MT',boq:180,po:180,grn:122,pend:58,rate:62000,poval:1116,paid:756},
  {m:'River Sand (plaster grade)',u:'brass',boq:420,po:300,grn:180,pend:240,rate:4200,poval:1764,paid:756},
  {m:'AAC Blocks (6")',u:'cum',boq:890,po:0,grn:0,pend:890,rate:4800,poval:0,paid:0},
  {m:'Vitrified Tiles (600x600)',u:'sqft',boq:48000,po:0,grn:0,pend:48000,rate:65,poval:0,paid:0},
  {m:'CPVC Plumbing Pipes',u:'rmt',boq:8400,po:0,grn:0,pend:8400,rate:180,poval:0,paid:0},
  {m:'PVC Conduits (electrical)',u:'rmt',boq:12000,po:0,grn:0,pend:12000,rate:42,poval:0,paid:0}
];
let MATERIALS=MATERIALS_DEFAULT.map((m)=>({...m}));
const CO_CATS=['Soil condition','Design revision','Client change','Regulatory','Supply chain'];
const CO_VALS=[32,28,21,15,12];
const BOQ_CATS=['Civil / RCC','Foundations','MEP Electrical','Plumbing','Tiling','Plaster','Glass / Facade','Design','Other'];
const BOQ_BUDGET=[4200,1800,1200,680,920,540,320,180,160];
const BOQ_CERT  =[3960,1620,   0,  0,  0,  0, 22,120, 80];
const BOQ_PAID  =[3600,1440,   0,  0,  0,  0, 18,100, 60];

/* ═══════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
function scC(s){return s==='Completed'?C.green:s==='In Progress'?C.amber:'#d1d5db'}
function pc(p){return p>=80?C.green:p>=50?C.amber:C.red}
function db(d){if(!d)return'<span class="bdg bgg">On schedule</span>';if(d<=14)return`<span class="bdg bga">${d}d</span>`;return`<span class="bdg bgr">${d}d</span>`}
function fL(v){return v.toLocaleString('en-IN')}

/* ═══════════════════════════════════════════════
   VIEW SWITCHING
════════════════════════════════════════════════ */
const rendered=new Set();
function showView(id,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-view-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('view-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='portfolio'&&!rendered.has('portfolio')){renderPortfolio();rendered.add('portfolio');}
  if(id==='project'&&!rendered.has('project-progress')){renderProgress();rendered.add('project-progress');}
  resizeAllCharts();
}

/* ═══════════════════════════════════════════════
   PROJECT DROPDOWN
════════════════════════════════════════════════ */
let currentProject = 'p1';
let TREE = [
  { id: 't1', project: 'Anantam Signature', phase: 'Phase I', building: 'E Building', projectId: 'p1', buildingKey: 'e' },
  { id: 't2', project: 'Anantam Signature', phase: 'Phase I', building: 'D Building', projectId: 'p1', buildingKey: 'd' },
  { id: 't3', project: 'GA Residences', phase: 'Phase I', building: 'Pimpri', projectId: 'p2', buildingKey: 'all' },
  { id: 't4', project: 'GA Heights', phase: 'Phase I', building: 'Mumbai', projectId: 'p3', buildingKey: 'all' },
  { id: 't5', project: 'GA Villas', phase: 'Phase I', building: 'Goa', projectId: 'p4', buildingKey: 'all' },
];
let treeSelection = { project: 'all', phase: 'all', building: 'all' };
function treeId() { return `t${Math.random().toString(36).slice(2, 9)}`; }
function uniqSorted(arr) { return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }
function treeNodes(project = 'all', phase = 'all', building = 'all') {
  return TREE.filter(
    (n) => (project === 'all' || n.project === project) && (phase === 'all' || n.phase === phase) && (building === 'all' || n.building === building)
  );
}
function syncTreeSelectors() {
  const pSel = document.getElementById('treeProjSel');
  const phSel = document.getElementById('treePhaseSel');
  const bSel = document.getElementById('treeBldSel');
  if (!pSel || !phSel || !bSel) return;
  const pVals = uniqSorted(TREE.map((n) => n.project));
  if (!pVals.includes(treeSelection.project)) treeSelection.project = 'all';
  pSel.innerHTML = ['<option value="all">All Projects</option>', ...pVals.map((v) => `<option value="${v}">${v}</option>`)].join('');
  pSel.value = treeSelection.project;
  const phVals = uniqSorted(treeNodes(treeSelection.project).map((n) => n.phase));
  if (!phVals.includes(treeSelection.phase)) treeSelection.phase = 'all';
  phSel.innerHTML = ['<option value="all">All Phases</option>', ...phVals.map((v) => `<option value="${v}">${v}</option>`)].join('');
  phSel.value = treeSelection.phase;
  const bVals = uniqSorted(treeNodes(treeSelection.project, treeSelection.phase).map((n) => n.building));
  if (!bVals.includes(treeSelection.building)) treeSelection.building = 'all';
  bSel.innerHTML = ['<option value="all">All Buildings</option>', ...bVals.map((v) => `<option value="${v}">${v}</option>`)].join('');
  bSel.value = treeSelection.building;
}
function applyTreeSelectionToDashboard() {
  const node = treeNodes(treeSelection.project, treeSelection.phase, treeSelection.building)[0];
  if (!node) return;
  const ps = document.getElementById('projSel');
  const bs = document.getElementById('bldSel');
  if (ps) ps.value = node.projectId;
  if (bs) bs.value = node.buildingKey || 'all';
  currentProject = node.projectId;
  currentBuilding = node.buildingKey || 'all';
  onProjChange(node.projectId);
}
function onTreeProjectChange(v) {
  treeSelection.project = v || 'all';
  treeSelection.phase = 'all';
  treeSelection.building = 'all';
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function onTreePhaseChange(v) {
  treeSelection.phase = v || 'all';
  treeSelection.building = 'all';
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function onTreeBuildingChange(v) {
  treeSelection.building = v || 'all';
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function addProjectTreeNode() {
  const project = String(window.prompt('Project name', '') || '').trim();
  if (!project) return;
  const phase = String(window.prompt('Phase name', 'Phase I') || '').trim();
  if (!phase) return;
  const building = String(window.prompt('Building name', '') || '').trim();
  if (!building) return;
  const pid = `p_${Math.random().toString(36).slice(2, 7)}`;
  PROJECTS[pid] = { ...PROJECTS.p1, name: project, sub: building, completion: 0, tasks: 0, done: 0, ip: 0, ns: 0, maxDelay: 0, spi: 1, cpi: 1 };
  TREE.push({ id: treeId(), project, phase, building, projectId: pid, buildingKey: 'all' });
  const projSel = document.getElementById('projSel');
  if (projSel) {
    const op = document.createElement('option');
    op.value = pid;
    op.textContent = `${project} — ${building}`;
    projSel.appendChild(op);
  }
  treeSelection = { project, phase, building };
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function editProjectTreeNode() {
  const node = treeNodes(treeSelection.project, treeSelection.phase, treeSelection.building)[0];
  if (!node) return window.alert('Select one Project > Phase > Building first.');
  const project = String(window.prompt('Project name', node.project) || '').trim();
  const phase = String(window.prompt('Phase name', node.phase) || '').trim();
  const building = String(window.prompt('Building name', node.building) || '').trim();
  if (!project || !phase || !building) return;
  node.project = project; node.phase = phase; node.building = building;
  if (PROJECTS[node.projectId]) { PROJECTS[node.projectId].name = project; PROJECTS[node.projectId].sub = building; }
  treeSelection = { project, phase, building };
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function deleteProjectTreeNode() {
  const node = treeNodes(treeSelection.project, treeSelection.phase, treeSelection.building)[0];
  if (!node) return window.alert('Select one Project > Phase > Building first.');
  if (!window.confirm(`Delete "${node.project} > ${node.phase} > ${node.building}"?`)) return;
  TREE = TREE.filter((x) => x.id !== node.id);
  treeSelection = { project: 'all', phase: 'all', building: 'all' };
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
}
function onProjChange(v){
  currentProject = v;
  const p=PROJECTS[v];
  document.getElementById('proj-brand').innerHTML=`${p.name} · <span>${p.sub}</span>`;
  document.getElementById('proj-sub').innerHTML=`<span class="pulse"></span>Construction data · 09 Apr 2026 · ${p.tasks} tasks`;
  if (v !== 'p1') {
    const factor = Math.max(0.25, Math.min(1.4, p.completion / 55));
    L1 = L1_DEFAULT.map((x) => ({ ...x, p: Math.max(0, Math.min(100, Math.round(x.p * factor * 10) / 10)), d: Math.max(0, Math.round(x.d * (1.2 - factor / 1.6))) }));
    CATS = CATS_DEFAULT.map((x) => ({
      ...x,
      d: Math.max(0, Math.min(x.t, Math.round(x.d * factor))),
      i: Math.max(0, Math.min(x.t, Math.round(x.i * (1 + (1 - factor) * 0.4)))),
      n: Math.max(0, x.t - Math.max(0, Math.min(x.t, Math.round(x.d * factor))) - Math.max(0, Math.min(x.t, Math.round(x.i * (1 + (1 - factor) * 0.4))))),
      avg: Math.max(0, Math.min(100, Math.round(x.avg * factor * 10) / 10)),
      ad: Math.max(0, Math.round(x.ad * (1.15 - factor / 2))),
    }));
    ACTIVE = ACTIVE_DEFAULT.map((x) => ({ ...x, p: Math.max(0, Math.min(100, Math.round(x.p * factor * 10) / 10)), d: Math.max(0, Math.round(x.d * (1.2 - factor / 2))) }));
    TOPDELAY = TOPDELAY_DEFAULT.map((x) => ({ ...x, d: Math.max(0, Math.round(x.d * (1.2 - factor / 2))), p: Math.max(0, Math.min(100, Math.round(x.p * factor * 10) / 10)) }));
    SCHEDULE_SLABS = SCHEDULE_SLABS_DEFAULT.map((x) => ({ ...x, p: Math.max(0, Math.min(100, Math.round(x.p * factor * 10) / 10)), d: Math.max(0, Math.round(x.d * (1.15 - factor / 2))) }));
  } else {
    applyP1BuildingContext(currentBuilding);
  }
  rerunAfterTaskImport();
}

/* ═══════════════════════════════════════════════
   TAB SWITCHING (project)
════════════════════════════════════════════════ */
const PROJ_RENDER={progress:renderProgress,schedule:renderSchedule,ops:renderOps,performance:renderPerformance,finance:renderFinance,gaps:null};

/* ═══════════════════════════════════════════════
   PORTFOLIO RENDER
════════════════════════════════════════════════ */
function renderPortfolio(){
  const pids=['p1','p2','p3','p4'];
  const pnames=['Anantam E Bldg','GA Residences','GA Heights','GA Villas'];

  // project cards
  document.getElementById('proj-cards').innerHTML=pids.map(pid=>{
    const p=PROJECTS[pid];
    const cls=pid;
    return`<div class="proj-card ${cls}" onclick="drillProject('${pid}')">
      <div class="proj-card-name">${p.name}</div>
      <div class="proj-card-meta">${p.sub} · ${p.tasks} tasks</div>
      <div class="proj-card-stat"><span class="proj-stat-label">Completion</span><span class="proj-stat-val" style="color:${p.completion>60?C.green:p.completion>40?C.amber:C.red}">${p.completion}%</span></div>
      <div class="pt" style="margin-bottom:10px"><div class="pf" style="width:${p.completion}%;background:${p.color}"></div></div>
      <div class="proj-card-stat"><span class="proj-stat-label">SPI</span><span class="proj-stat-val" style="color:${p.spi>=1?C.green:p.spi>=0.90?C.amber:C.red}">${p.spi}</span></div>
      <div class="proj-card-stat"><span class="proj-stat-label">CPI ★</span><span class="proj-stat-val" style="color:${p.cpi>=1?C.green:p.cpi>=0.93?C.amber:C.red}">${p.cpi}</span></div>
      <div class="proj-card-stat" style="margin-top:8px"><span class="proj-stat-label">BOQ ★</span><span class="proj-stat-val">₹${p.boq} Cr</span></div>
      <div class="proj-card-stat"><span class="proj-stat-label">Spent ★</span><span class="proj-stat-val">₹${p.spent} Cr</span></div>
    </div>`;
  }).join('');

  // SPI/CPI chart
  dc('port-spi-chart');
  rc('port-spi-chart',new window.Chart(document.getElementById('port-spi-chart'),{
    type:'bar',
    data:{labels:pnames,datasets:[
      {label:'SPI',data:pids.map(p=>PROJECTS[p].spi),backgroundColor:'rgba(30,58,95,.7)',borderRadius:4},
      {label:'CPI',data:pids.map(p=>PROJECTS[p].cpi),backgroundColor:'rgba(150,105,11,.6)',borderRadius:4},
      {label:'Target',data:[1,1,1,1],type:'line',borderColor:'rgba(185,28,28,.5)',borderWidth:1.5,borderDash:[4,3],pointRadius:0,fill:false}
    ]},
    options:gO({sy:{min:0.7,max:1.1,sx:{callback:v=>v.toFixed(2)}}})
  }));

  // Completion chart
  dc('port-prog-chart');
  rc('port-prog-chart',new window.Chart(document.getElementById('port-prog-chart'),{
    type:'bar',
    data:{labels:pnames,datasets:[
      {label:'Completion %',data:pids.map(p=>PROJECTS[p].completion),backgroundColor:pids.map(p=>PROJECTS[p].color+'bb'),borderRadius:4}
    ]},
    options:gO({sy:{min:0,max:100,callback:v=>v+'%'}})
  }));

  // Cost chart
  dc('port-cost-chart');
  rc('port-cost-chart',new window.Chart(document.getElementById('port-cost-chart'),{
    type:'bar',
    data:{labels:pnames,datasets:[
      {label:'BOQ Budget',data:pids.map(p=>PROJECTS[p].boq),backgroundColor:'rgba(0,0,0,.1)',borderRadius:3},
      {label:'Actual Spent',data:pids.map(p=>PROJECTS[p].spent),backgroundColor:'rgba(30,58,95,.65)',borderRadius:3}
    ]},
    options:gO({sy:{ticks:{callback:v=>'₹'+v+' Cr'}}})
  }));

  // Delay chart
  dc('port-delay-chart');
  rc('port-delay-chart',new window.Chart(document.getElementById('port-delay-chart'),{
    type:'bar',
    data:{labels:pnames,datasets:[{label:'Max delay (days)',data:pids.map(p=>PROJECTS[p].maxDelay),backgroundColor:pids.map(p=>PROJECTS[p].maxDelay>100?'rgba(185,28,28,.65)':p.maxDelay>50?'rgba(161,98,7,.6)':'rgba(15,109,80,.65)').map((x,i)=>PROJECTS[pids[i]].maxDelay>100?'rgba(185,28,28,.65)':PROJECTS[pids[i]].maxDelay>50?'rgba(161,98,7,.6)':'rgba(15,109,80,.65)'),borderRadius:4}]},
    options:gO({sy:{ticks:{callback:v=>v+'d'}}})
  }));

  // Portfolio table
  document.getElementById('port-table').innerHTML=`<thead><tr><th>Project</th><th>Tasks</th><th>Completion</th><th>SPI</th><th>CPI ★</th><th>BOQ ★ (₹ Cr)</th><th>Spent ★ (₹ Cr)</th><th>Max Delay</th><th>Action</th></tr></thead><tbody>${
    pids.map(pid=>{const p=PROJECTS[pid];return`<tr>
      <td>${p.name} — ${p.sub}</td>
      <td>${p.tasks}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:5px;background:var(--b1);border-radius:99px;overflow:hidden"><div style="height:100%;width:${p.completion}%;background:${p.color};border-radius:99px"></div></div><span>${p.completion}%</span></div></td>
      <td style="font-weight:700;color:${p.spi>=1?C.green:p.spi>=0.90?C.amber:C.red}">${p.spi}</td>
      <td style="font-weight:700;color:${p.cpi>=1?C.green:p.cpi>=0.93?C.amber:C.red}">${p.cpi}</td>
      <td>${p.boq}</td><td>${p.spent}</td>
      <td style="color:${p.maxDelay>100?C.red:p.maxDelay>50?C.amber:C.green};font-weight:700">+${p.maxDelay}d</td>
      <td><button class="btn" style="padding:4px 10px;font-size:10px;height:26px" onclick="drillProject('${pid}')">View →</button></td>
    </tr>`}).join('')
  }</tbody>`;
}

function drillProject(pid){
  document.getElementById('projSel').value=pid;
  const node = TREE.find((n) => n.projectId === pid);
  if (node) {
    treeSelection = { project: node.project, phase: node.phase, building: node.building };
    syncTreeSelectors();
  }
  onProjChange(pid);
  showView('project',document.querySelector('.nav-view-btn:nth-child(3)'));
}

/* ═══════════════════════════════════════════════
   PROGRESS RENDER
════════════════════════════════════════════════ */
function renderProgress(){
  dc('catChart');
  rc('catChart',new window.Chart(document.getElementById('catChart'),{
    type:'bar',
    data:{labels:CATS.map(c=>chartLbl(c.c)),datasets:[
      {label:'Completed',data:CATS.map(c=>c.d),backgroundColor:C.green,borderRadius:3,stack:'s'},
      {label:'In Progress',data:CATS.map(c=>c.i),backgroundColor:C.amber,stack:'s'},
      {label:'Not started',data:CATS.map(c=>c.n),backgroundColor:'#e5e7eb',stack:'s'}
    ]},
    options:gO({sx:{stacked:true,ticks:{maxRotation:45,font:{size:9,family:C.f},autoSkip:true,maxTicksLimit:16}},sy:{stacked:true}})
  }));

  document.getElementById('active-body').innerHTML=ACTIVE.map(t=>`
    <tr data-cat="${t.c}">
      <td>${t.n}</td>
      <td><span class="bdg ${t.c==='Civil'?'bgb':'bgp'}">${t.c}</span></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:5px;background:var(--b1);border-radius:99px;overflow:hidden;min-width:60px"><div style="height:100%;width:${t.p}%;background:${pc(t.p)};border-radius:99px"></div></div><span style="font-size:11px;font-weight:700;color:${pc(t.p)};min-width:36px">${t.p}%</span></div></td>
      <td>${db(t.d)}</td>
      <td style="color:${t.d>20?C.red:t.d>0?C.amber:C.green}">${t.d>20?'⚠ Recovery needed':t.d>0?'Watch':'On track'}</td>
    </tr>`).join('');

  document.getElementById('cat-prog-list').innerHTML=CATS.map(c=>`
    <div class="pr">
      <div class="pl">${c.c} <small style="color:var(--t4)">(${c.t})</small></div>
      <div class="pt"><div class="pf" style="width:${c.t ? (c.d/c.t*100) : 0}%;background:var(--G)"></div></div>
      <div class="pv" style="color:${c.avg>50?C.green:c.avg>20?C.amber:C.red}">${Math.round(c.avg)}%</div>
      <div class="pd ${c.ad>100?'db':c.ad>50?'dw':c.ad>0?'dw':'dok'}">${c.ad>0?`avg +${c.ad}d`:'No delays'}</div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════
   SCHEDULE RENDER
════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   UPCOMING ACTIVITIES DATA
   Reference date: 09 Apr 2026 = new Date(2026,3,9)
   Month index is 0-based: Jan=0, Apr=3, May=4
════════════════════════════════════════════════ */
const TODAY = new Date(2026,3,9);
const UPCOMING_DEFAULT = [
  /* ── CIVIL ── */
  {id:'TSK000044',n:'1st slab shuttering',cat:'Civil',ps:new Date(2026,3,1),pe:new Date(2026,3,16),prog:59.9,s:'In Progress',delay:9,mem:'Namdev S'},
  {id:'TSK000045',n:'1st slab concrete (M30)',cat:'Civil',ps:new Date(2026,3,5),pe:new Date(2026,3,12),prog:80,s:'In Progress',delay:11,mem:'Namdev S'},
  {id:'TSK000049',n:'Column steel — plinth to 1st slab',cat:'Civil',ps:new Date(2026,3,1),pe:new Date(2026,3,10),prog:89,s:'In Progress',delay:8,mem:'Krunal T'},
  {id:'TSK000051',n:'2nd slab programme (overall)',cat:'Civil',ps:new Date(2026,3,8),pe:new Date(2026,3,28),prog:35.2,s:'In Progress',delay:14,mem:'Namdev S'},
  {id:'TSK000052',n:'2nd slab concrete pour',cat:'Civil',ps:new Date(2026,3,10),pe:new Date(2026,3,20),prog:25,s:'In Progress',delay:8,mem:'Namdev S'},
  {id:'TSK000054',n:'2nd slab shuttering',cat:'Civil',ps:new Date(2026,3,8),pe:new Date(2026,3,18),prog:75,s:'In Progress',delay:12,mem:'Krunal T'},
  {id:'TSK000076',n:'R2 retaining wall concrete (E-side)',cat:'Civil',ps:new Date(2026,3,6),pe:new Date(2026,3,14),prog:44.7,s:'In Progress',delay:1,mem:'Namdev S'},
  {id:'TSK000077',n:'R2 retaining wall steel',cat:'Civil',ps:new Date(2026,3,1),pe:new Date(2026,3,12),prog:73.1,s:'In Progress',delay:6,mem:'Krunal T'},
  {id:'TSK000078',n:'R2 retaining wall shuttering',cat:'Civil',ps:new Date(2026,3,3),pe:new Date(2026,3,13),prog:56,s:'In Progress',delay:4,mem:'Namdev S'},
  {id:'TSK000082',n:'Basement floor slab (overall)',cat:'Civil',ps:new Date(2026,3,1),pe:new Date(2026,3,30),prog:54.25,s:'In Progress',delay:0,mem:'Namdev S'},
  {id:'TSK000085',n:'Soling work',cat:'Civil',ps:new Date(2026,2,28),pe:new Date(2026,3,15),prog:70,s:'In Progress',delay:0,mem:'Krunal T'},
  {id:'TSK-N-001',n:'2nd slab — column steel work',cat:'Civil',ps:new Date(2026,3,12),pe:new Date(2026,3,22),prog:0,s:'Not Started',delay:0,mem:'Namdev S'},
  {id:'TSK-N-002',n:'Basement waterproofing — lift pit',cat:'Civil',ps:new Date(2026,3,15),pe:new Date(2026,3,25),prog:0,s:'Not Started',delay:0,mem:'Waterproofing sub'},
  {id:'TSK-N-003',n:'3rd slab shuttering preparation',cat:'Civil',ps:new Date(2026,3,20),pe:new Date(2026,4,5),prog:0,s:'Not Started',delay:0,mem:'Krunal T'},
  {id:'TSK-N-004',n:'Plinth beam — B1 to GF level',cat:'Civil',ps:new Date(2026,3,18),pe:new Date(2026,3,28),prog:0,s:'Not Started',delay:0,mem:'Krunal T'},
  {id:'TSK-N-005',n:'Column concreting — GF level',cat:'Civil',ps:new Date(2026,3,22),pe:new Date(2026,4,2),prog:0,s:'Not Started',delay:0,mem:'Namdev S'},
  {id:'TSK-N-006',n:'Staircase concrete — B1 to GF',cat:'Civil',ps:new Date(2026,3,25),pe:new Date(2026,4,5),prog:0,s:'Not Started',delay:0,mem:'Krunal T'},
  {id:'TSK-N-007',n:'Lift pit concrete lining',cat:'Civil',ps:new Date(2026,3,28),pe:new Date(2026,4,8),prog:0,s:'Not Started',delay:0,mem:'Namdev S'},
  /* ── DESIGN ── */
  {id:'TSK001007',n:'Section drawing — all levels',cat:'Design',ps:new Date(2026,2,29),pe:new Date(2026,3,20),prog:50,s:'In Progress',delay:88,mem:'Minal F'},
  {id:'TSK001591',n:'2nd slab design drawing',cat:'Design',ps:new Date(2026,2,29),pe:new Date(2026,3,15),prog:65,s:'In Progress',delay:0,mem:'Nishigandha P'},
  {id:'TSK001004',n:'Retaining wall drawing',cat:'Design',ps:new Date(2026,2,29),pe:new Date(2026,3,25),prog:70,s:'In Progress',delay:88,mem:'Minal F'},
  {id:'TSK001003',n:'Water tank drawing',cat:'Design',ps:new Date(2026,2,29),pe:new Date(2026,3,30),prog:26,s:'In Progress',delay:88,mem:'Nishigandha P'},
  {id:'TSK-N-008',n:'3rd slab structural drawing',cat:'Design',ps:new Date(2026,3,12),pe:new Date(2026,3,25),prog:0,s:'Not Started',delay:0,mem:'Minal F'},
  {id:'TSK-N-009',n:'Column schedule drawing — GF to 1F',cat:'Design',ps:new Date(2026,3,10),pe:new Date(2026,3,20),prog:0,s:'Not Started',delay:0,mem:'Nishigandha P'},
  {id:'TSK001009',n:'Plumbing drawing (overdue)',cat:'Design',ps:new Date(2026,0,1),pe:new Date(2026,3,30),prog:0,s:'Not Started',delay:99,mem:'Nishigandha P'},
  {id:'TSK001008',n:'Electrical drawing (overdue)',cat:'Design',ps:new Date(2026,0,1),pe:new Date(2026,3,20),prog:0,s:'Not Started',delay:99,mem:'Minal F'},
  {id:'TSK-N-010',n:'Facade elevation drawing',cat:'Design',ps:new Date(2026,3,20),pe:new Date(2026,4,5),prog:0,s:'Not Started',delay:0,mem:'Minal F'},
  /* ── GENERAL ── */
  {id:'TSK000582',n:'Glass work (overall)',cat:'General',ps:new Date(2026,3,1),pe:new Date(2026,5,30),prog:7.69,s:'In Progress',delay:1,mem:'Glass facade sub'},
  {id:'TSK-N-011',n:'Safety barricading — upper floors',cat:'General',ps:new Date(2026,3,12),pe:new Date(2026,3,20),prog:0,s:'Not Started',delay:0,mem:'HSE officer'},
  {id:'TSK-N-012',n:'Hoist installation (construction lift)',cat:'General',ps:new Date(2026,3,18),pe:new Date(2026,3,30),prog:0,s:'Not Started',delay:0,mem:'Site manager'},
  {id:'TSK-N-013',n:'Tower crane height extension',cat:'General',ps:new Date(2026,3,20),pe:new Date(2026,3,22),prog:0,s:'Not Started',delay:0,mem:'Crane operator'},
  {id:'TSK-N-014',n:'Temporary power upgrade (DG set)',cat:'General',ps:new Date(2026,3,14),pe:new Date(2026,3,16),prog:0,s:'Not Started',delay:0,mem:'Electrical sub'},
  {id:'TSK-N-025',n:'Site survey and TBM shifting',cat:'General',ps:new Date(2026,3,10),pe:new Date(2026,3,11),prog:0,s:'Not Started',delay:0,mem:'Site manager'},
  /* ── WATERPROOFING ── */
  {id:'TSK-N-015',n:'UG water tank waterproofing',cat:'Waterproofing',ps:new Date(2026,3,15),pe:new Date(2026,3,25),prog:0,s:'Not Started',delay:0,mem:'Waterproofing sub'},
  {id:'TSK-N-016',n:'Lift pit waterproofing',cat:'Waterproofing',ps:new Date(2026,3,20),pe:new Date(2026,3,28),prog:0,s:'Not Started',delay:0,mem:'Waterproofing sub'},
  {id:'TSK-N-017',n:'Basement floor waterproofing — coat 1',cat:'Waterproofing',ps:new Date(2026,3,25),pe:new Date(2026,4,5),prog:0,s:'Not Started',delay:0,mem:'Waterproofing sub'},
  /* ── MASONRY ── */
  {id:'TSK-N-018',n:'AAC block work — basement walls',cat:'Masonry',ps:new Date(2026,3,25),pe:new Date(2026,4,15),prog:0,s:'Not Started',delay:0,mem:'Mason sub'},
  {id:'TSK-N-019',n:'Internal partition — B1 level',cat:'Masonry',ps:new Date(2026,3,28),pe:new Date(2026,4,20),prog:0,s:'Not Started',delay:0,mem:'Mason sub'},
  /* ── ELECTRICAL ── */
  {id:'TSK-N-020',n:'Electrical drawing (awaited — overdue)',cat:'Electrical',ps:new Date(2026,0,1),pe:new Date(2026,3,25),prog:0,s:'Not Started',delay:99,mem:'Minal F'},
  {id:'TSK-N-021',n:'Earthing layout — basement',cat:'Electrical',ps:new Date(2026,3,28),pe:new Date(2026,4,8),prog:0,s:'Not Started',delay:0,mem:'MEP sub'},
  /* ── PLUMBING ── */
  {id:'TSK-N-022',n:'Plumbing drawing (awaited — overdue)',cat:'Plumbing',ps:new Date(2026,0,1),pe:new Date(2026,4,9),prog:0,s:'Not Started',delay:99,mem:'Nishigandha P'},
  {id:'TSK-N-023',n:'Underground drainage layout drawing',cat:'Plumbing',ps:new Date(2026,3,20),pe:new Date(2026,4,5),prog:0,s:'Not Started',delay:0,mem:'Plumbing sub'},
  {id:'TSK-N-024',n:'UGD pipeline — basement level',cat:'Plumbing',ps:new Date(2026,3,28),pe:new Date(2026,4,12),prog:0,s:'Not Started',delay:0,mem:'Plumbing sub'}
];
let UPCOMING = UPCOMING_DEFAULT.map((u) => ({ ...u, ps: new Date(u.ps), pe: new Date(u.pe) }));

const SCHEDULE_SLABS_DEFAULT = [
  {n:'B1 slab',p:100,s:'Completed',d:14},{n:'Raft',p:100,s:'Completed',d:18},{n:'1st slab concrete',p:80,s:'In Progress',d:11},{n:'1st slab shuttering',p:59.9,s:'In Progress',d:9},{n:'2nd slab shuttering',p:75,s:'In Progress',d:12},{n:'2nd slab concrete',p:25,s:'In Progress',d:8},{n:'3rd slab',p:0,s:'Not Started',d:0},{n:'4th slab',p:0,s:'Not Started',d:0},{n:'5th slab',p:0,s:'Not Started',d:0}
];
let SCHEDULE_SLABS = SCHEDULE_SLABS_DEFAULT.map((s) => ({ ...s }));
let currentBuilding = 'e';
const buildingTaskStore = { d: null, e: null };

function detectBuildingKey(text) {
  const s = String(text || '').toLowerCase();
  if (/\bd[\s_-]*building\b/.test(s) || /\banantam signature[\s_-]*d\b/.test(s)) return 'd';
  if (/\be[\s_-]*building\b/.test(s) || /\banantam signature[\s_-]*e\b/.test(s)) return 'e';
  return null;
}

function resetDashboardToDefaults() {
  L1 = L1_DEFAULT.map((x) => ({ ...x }));
  CATS = CATS_DEFAULT.map((x) => ({ ...x }));
  ACTIVE = ACTIVE_DEFAULT.map((x) => ({ ...x }));
  TOPDELAY = TOPDELAY_DEFAULT.map((x) => ({ ...x }));
  UPCOMING = UPCOMING_DEFAULT.map((u) => ({ ...u, ps: new Date(u.ps), pe: new Date(u.pe) }));
  SCHEDULE_SLABS = SCHEDULE_SLABS_DEFAULT.map((s) => ({ ...s }));
  Object.assign(PROJECTS.p1, PROJECTS_DEFAULT_P1);
  MATERIALS = MATERIALS_DEFAULT.map((m) => ({ ...m }));
  clearPersistedImport();
  const ins = document.getElementById('ga-powerplay-insight');
  if (ins) {
    ins.style.display = 'none';
    ins.innerHTML = '';
  }
  buildingTaskStore.d = null;
  buildingTaskStore.e = null;
  currentBuilding = 'e';
  const bs = document.getElementById('bldSel');
  if (bs) bs.value = 'e';
}

function serializeTasksForStorage(tasks) {
  return tasks.map((t) => ({
    ...t,
    ps: t.ps ? t.ps.toISOString() : null,
    pe: t.pe ? t.pe.toISOString() : null,
  }));
}

function deserializeTasksFromStorage(rows) {
  return rows.map((t) => ({
    ...t,
    ps: t.ps ? new Date(t.ps) : null,
    pe: t.pe ? new Date(t.pe) : null,
  }));
}

function applyImportedNormalizedTasks(tasks, today = TODAY, buildingKey = null) {
  if (!tasks || !tasks.length) return;
  const slices = buildSlicesFromTasks(tasks, today);
  L1 = slices.L1;
  CATS = slices.CATS;
  ACTIVE = slices.ACTIVE;
  TOPDELAY = slices.TOPDELAY;
  UPCOMING = slices.UPCOMING.map((u) => ({
    ...u,
    ps: u.ps instanceof Date ? u.ps : new Date(u.ps),
    pe: u.pe instanceof Date ? u.pe : new Date(u.pe),
  }));
  SCHEDULE_SLABS =
    slices.slabs && slices.slabs.length
      ? slices.slabs.map((s) => ({ ...s }))
      : SCHEDULE_SLABS_DEFAULT.map((s) => ({ ...s }));
  const patch = slices.projectPatch;
  PROJECTS.p1.tasks = patch.tasks;
  PROJECTS.p1.completion = patch.completion;
  PROJECTS.p1.maxDelay = patch.maxDelay;
  if (patch.done != null) PROJECTS.p1.done = patch.done;
  if (patch.ip != null) PROJECTS.p1.ip = patch.ip;
  if (patch.ns != null) PROJECTS.p1.ns = patch.ns;
  const prev = loadPersistedImportPayload() || {};
  const tasksByBuilding = { ...(prev.tasksByBuilding || {}) };
  if (buildingKey) {
    tasksByBuilding[buildingKey] = serializeTasksForStorage(tasks);
    buildingTaskStore[buildingKey] = serializeTasksForStorage(tasks);
    currentBuilding = buildingKey;
  }
  persistImportPayload({
    ...prev,
    tasks: serializeTasksForStorage(tasks),
    tasksByBuilding,
    activeBuilding: currentBuilding,
    savedAt: new Date().toISOString(),
  });
}

function applyP1BuildingContext(v) {
  if (v === 'all') {
    const p = PROJECTS_DEFAULT_P1;
    PROJECTS.p1.sub = p.sub;
    return;
  }
  PROJECTS.p1.sub = `${String(v).toUpperCase()} Building`;
  const cached = buildingTaskStore[v];
  if (cached && cached.length) {
    applyImportedNormalizedTasks(deserializeTasksFromStorage(cached), TODAY, v);
  }
}

function onBuildingChange(v) {
  currentBuilding = v;
  const selectedProj = document.getElementById('projSel')?.value || 'p1';
  if (selectedProj === 'p1') applyP1BuildingContext(v);
  onProjChange(selectedProj);
  rerunAfterTaskImport();
}

function applyPOImport(poData) {
  if (poData.materials && poData.materials.length) {
    MATERIALS = poData.materials.map((m) => ({ ...m }));
  }
  const prev = loadPersistedImportPayload() || {};
  persistImportPayload({
    ...prev,
    materials: MATERIALS.map((m) => ({ ...m })),
    poSummary: poData.summary,
    savedAt: new Date().toISOString(),
  });
}

function renderPowerplayInsight(insight) {
  const el = document.getElementById('ga-powerplay-insight');
  if (!el || !insight) return;
  el.style.display = 'block';
  const title = insight.title || 'PowerPlay report (auto-summary)';
  const bullets = Array.isArray(insight.bullets) ? insight.bullets : [];
  el.innerHTML = `<div style="font-weight:700;color:var(--navy);margin-bottom:6px">${title}</div><div style="color:var(--t2);font-size:11px;margin-bottom:6px">Rule-based KPI extraction from PDF text (no external AI API).</div><ul style="margin:0 0 0 18px;color:var(--t2)">${bullets.map((b) => `<li style="margin-bottom:4px">${b}</li>`).join('')}</ul>`;
}

function applyPdfInsight(insight, doPersist = true) {
  const m = insight.metrics || {};
  if (
    m.completedTasks != null &&
    m.inProgressTasks != null &&
    m.notStartedTasks != null
  ) {
    const sum = m.completedTasks + m.inProgressTasks + m.notStartedTasks;
    if (sum > 0 && sum < 100000) {
      PROJECTS.p1.tasks = sum;
      PROJECTS.p1.done = m.completedTasks;
      PROJECTS.p1.ip = m.inProgressTasks;
      PROJECTS.p1.ns = m.notStartedTasks;
      PROJECTS.p1.completion = Math.round((m.completedTasks / sum) * 1000) / 10;
    }
  }
  renderPowerplayInsight(insight);
  if (doPersist) {
    const prev = loadPersistedImportPayload() || {};
    persistImportPayload({
      ...prev,
      insight,
      savedAt: new Date().toISOString(),
    });
  }
}

function tryRestorePersistedImport() {
  const payload = loadPersistedImportPayload();
  if (!payload) return;
  if (payload.tasksByBuilding) {
    if (payload.tasksByBuilding.d) buildingTaskStore.d = payload.tasksByBuilding.d;
    if (payload.tasksByBuilding.e) buildingTaskStore.e = payload.tasksByBuilding.e;
  }
  if (payload.activeBuilding) currentBuilding = payload.activeBuilding;
  if (payload.materials && payload.materials.length) {
    MATERIALS = payload.materials.map((m) => ({ ...m }));
  }
  if (payload.insight) renderPowerplayInsight(payload.insight);
  if (payload.tasks && payload.tasks.length) {
    const tasks = deserializeTasksFromStorage(payload.tasks);
    applyImportedNormalizedTasks(tasks, TODAY, currentBuilding === 'all' ? null : currentBuilding);
  } else if (payload.insight?.metrics) {
    applyPdfInsight(payload.insight, false);
  }
  const bs = document.getElementById('bldSel');
  if (bs) bs.value = currentBuilding;
  onBuildingChange(currentBuilding);
}

function rerunAfterTaskImport() {
  if (document.getElementById('proj-cards')) renderPortfolio();
  if (document.getElementById('wbs-list')) renderProgress();
  if (document.getElementById('milestone-list')) renderSchedule();
  if (document.getElementById('trendChart')) renderOps();
  if (document.getElementById('perf-kpi-cards')) renderPerformance();
  if (document.getElementById('boqChart')) renderFinance();
  resizeAllCharts();
}

async function handlePowerplayFile(file) {
  const msg = document.getElementById('ga-upload-task-msg');
  const setMsg = (t, ok) => {
    if (!msg) return;
    msg.textContent = t;
    msg.style.color = ok ? 'var(--G)' : 'var(--R)';
  };
  if (!file) {
    setMsg('Choose a file first.', false);
    return;
  }
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.pdf')) {
      const { insight, numPages } = await parsePowerplayPdf(await file.arrayBuffer());
      applyPdfInsight(insight);
      const portBtn = document.querySelector('.nav-view-btn');
      if (portBtn) showView('portfolio', portBtn);
      rerunAfterTaskImport();
      setMsg(`PDF (${numPages} pages): KPI summary extracted — see panel below.`, true);
      return;
    }
    if (name.endsWith('.csv')) {
      const text = await file.text();
      const tasks = parseTaskCSV(text, TODAY).tasks;
      if (!tasks.length) {
        setMsg('No task rows found.', false);
        return;
      }
      const bk = detectBuildingKey(file.name);
      applyImportedNormalizedTasks(tasks, TODAY, bk);
      const portBtn = document.querySelector('.nav-view-btn');
      if (portBtn) showView('portfolio', portBtn);
      rerunAfterTaskImport();
      setMsg(`Loaded ${tasks.length} tasks from CSV.`, true);
      return;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const parsed = parsePowerplayExcel(buf, TODAY);
      if (parsed.kind === 'po') {
        applyPOImport(parsed.data);
        const portBtn = document.querySelector('.nav-view-btn');
        if (portBtn) showView('portfolio', portBtn);
        rerunAfterTaskImport();
        setMsg(
          `PO extract: ${parsed.data.summary.lines} lines · ~₹${parsed.data.summary.totalTaxableLakh}L taxable (PO list). Open Project → Finance for materials.`,
          true,
        );
        return;
      }
      const tasks = parsed.data.tasks;
      if (!tasks.length) {
        setMsg('No task rows found.', false);
        return;
      }
      const bk = detectBuildingKey(`${file.name} ${parsed.data.sheetName || ''}`);
      applyImportedNormalizedTasks(tasks, TODAY, bk);
      const portBtn = document.querySelector('.nav-view-btn');
      if (portBtn) showView('portfolio', portBtn);
      rerunAfterTaskImport();
      setMsg(`Loaded ${tasks.length} tasks (WBS / PowerPlay extract).`, true);
      return;
    }
    setMsg('Use .pdf, .xlsx, .xls, or .csv (PowerPlay exports).', false);
  } catch (e) {
    setMsg(e instanceof Error ? e.message : String(e), false);
  }
}

function downloadWorkTreeTemplate() {
  const n = parseInt(String(document.getElementById('ga-slab-count')?.value ?? '5'), 10);
  const basementRaw = document.getElementById('ga-basement-labels')?.value ?? 'b-1 slab';
  const basementSlabLabels = basementRaw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pid = document.getElementById('ga-project-code')?.value?.trim() || 'GA-E-BLDG';
  const csv = generateWorkTreeTemplateCSV({
    totalSlabs: Number.isFinite(n) ? n : 5,
    basementSlabLabels: basementSlabLabels.length ? basementSlabLabels : ['b-1 slab'],
    projectId: pid,
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `GA_WorkTree_${pid}_slabs_${n}.csv`;
  a.click();
}

function clearImportedTaskData() {
  resetDashboardToDefaults();
  const msg = document.getElementById('ga-upload-task-msg');
  if (msg) {
    msg.textContent = 'Restored built-in demo data.';
    msg.style.color = 'var(--t3)';
  }
  const portBtn = document.querySelector('.nav-view-btn');
  if (portBtn) showView('portfolio', portBtn);
  rerunAfterTaskImport();
}

let gaV4ActiveSavedId = null;

function escapeHtmlGa(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

function captureCurrentImportPayloadForSave() {
  const prev = loadPersistedImportPayload() || {};
  return {
    ...prev,
    tasksByBuilding: {
      ...(prev.tasksByBuilding || {}),
      d: buildingTaskStore.d,
      e: buildingTaskStore.e,
    },
    activeBuilding: currentBuilding,
    materials: MATERIALS.map((m) => ({ ...m })),
    savedAt: new Date().toISOString(),
  };
}

function updateGaV4ActiveSavedHint() {
  const el = document.getElementById('ga-dash-active-hint');
  if (!el) return;
  if (gaV4ActiveSavedId) {
    el.textContent =
      'Loaded saved snapshot — Save updates this entry (rename optional). Or use New dashboard for a blank session.';
  } else {
    el.textContent = 'Fresh session — import data below, then enter a name and click Save dashboard.';
  }
}

function initDashboardLibraryPanel() {
  const msgEl = document.getElementById('ga-dash-lib-msg');
  const listEl = document.getElementById('ga-dash-saved-list');
  const nameInput = document.getElementById('ga-dash-save-name');
  const saveBtn = document.getElementById('ga-dash-save-btn');
  const newBtn = document.getElementById('ga-dash-new-btn');

  const setLibMsg = (t, ok) => {
    if (!msgEl) return;
    msgEl.textContent = t;
    msgEl.style.color = ok ? 'var(--G)' : 'var(--R)';
  };

  const findUploadNavBtn = () =>
    [...document.querySelectorAll('.nav-view-btn')].find((b) => (b.textContent || '').includes('Data Upload'));

  async function refreshSavedList() {
    if (!listEl) return;
    try {
      const r = await fetch('/api/ga-v4-dashboards');
      if (r.status === 503) {
        const j = await r.json().catch(() => ({}));
        listEl.innerHTML = `<p style="color:#b91c1c;font-size:12px;margin:0">${escapeHtmlGa(j.error || 'MongoDB unavailable. Start the MongoDB service (mongod), then refresh.')}</p>`;
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const hint = j.hint || j.error || '';
        if (r.status === 404) {
          listEl.innerHTML = `<p style="color:#b91c1c;font-size:12px;margin:0"><strong>404</strong> — This API is too old or the wrong process is on port 3001. Stop it, then from the project folder run <code>npm run server</code> again.</p>`;
          return;
        }
        if (r.status === 502 || r.status === 504) {
          listEl.innerHTML =
            '<p style="color:#b91c1c;font-size:12px;margin:0"><strong>502/504</strong> — Nothing is answering on port 3001. In a terminal: <code>npm run server</code>. Keep <code>npm run dev</code> running for the UI.</p>';
          return;
        }
        listEl.innerHTML = `<p style="color:#b91c1c;font-size:12px;margin:0"><strong>HTTP ${r.status}</strong>${hint ? ` — ${escapeHtmlGa(hint)}` : ''}. Confirm <code>npm run server</code> (port 3001) and <code>npm run dev</code> (proxies <code>/api</code>). Do not open the built HTML file directly.</p>`;
        return;
      }
      const data = await r.json().catch(() => ({}));
      const dashboards = Array.isArray(data.dashboards) ? data.dashboards : [];
      if (!dashboards.length) {
        listEl.innerHTML =
          '<p style="color:#9ca3af;font-size:12px;margin:0">No saved dashboards yet. Import task data (tab 1), then save with a name.</p>';
        return;
      }
      listEl.innerHTML = dashboards
        .map((d) => {
          const when = d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '';
          const active = gaV4ActiveSavedId === d.id;
          return `<div class="ga-dash-saved-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#faf9f7;border:1px solid ${
            active ? '#0f6d50' : '#e4e2dc'
          };border-radius:10px;flex-wrap:wrap">
          <button type="button" class="btn primary" style="padding:6px 14px;font-size:12px" data-ga-load-dash="${d.id}">Load</button>
          <span style="font-weight:700;color:#1e3a5f">${escapeHtmlGa(d.name)}</span>
          ${active ? '<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(15,109,80,.15);color:#0f6d50">current</span>' : ''}
          <span style="font-size:11px;color:#9ca3af">${escapeHtmlGa(when)}</span>
          <button type="button" class="btn" style="margin-left:auto;padding:6px 12px;font-size:12px;color:#b91c1c" data-ga-del-dash="${d.id}">Delete</button>
        </div>`;
        })
        .join('');
      listEl.querySelectorAll('[data-ga-load-dash]').forEach((btn) => {
        btn.addEventListener('click', () => loadNamedDashboard(btn.getAttribute('data-ga-load-dash')));
      });
      listEl.querySelectorAll('[data-ga-del-dash]').forEach((btn) => {
        btn.addEventListener('click', () => deleteNamedDashboard(btn.getAttribute('data-ga-del-dash')));
      });
    } catch {
      listEl.innerHTML =
        '<p style="color:#b91c1c;font-size:12px;margin:0">Cannot reach <code>/api</code> (connection refused). Start the API: <code>npm run server</code> on port 3001. Use <code>npm run dev</code> for the UI (Vite proxies /api). Do not open <code>index.html</code> as a file.</p>';
    }
  }

  async function loadNamedDashboard(id) {
    setLibMsg('Loading…', true);
    try {
      const r = await fetch(`/api/ga-v4-dashboards/${id}`);
      if (!r.ok) throw new Error('Not found');
      const data = await r.json();
      resetDashboardToDefaults();
      persistImportPayload(data.payload);
      tryRestorePersistedImport();
      rerunAfterTaskImport();
      gaV4ActiveSavedId = id;
      updateGaV4ActiveSavedHint();
      const uploadNav = findUploadNavBtn();
      if (uploadNav) showView('upload', uploadNav);
      if (nameInput) nameInput.value = data.name || '';
      setLibMsg(`Loaded “${data.name}”.`, true);
      await refreshSavedList();
    } catch (e) {
      setLibMsg(e?.message || 'Load failed', false);
    }
  }

  async function deleteNamedDashboard(id) {
    if (!confirm('Delete this saved dashboard from MongoDB?')) return;
    setLibMsg('Deleting…', true);
    try {
      const r = await fetch(`/api/ga-v4-dashboards/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Delete failed');
      if (gaV4ActiveSavedId === id) {
        gaV4ActiveSavedId = null;
        updateGaV4ActiveSavedHint();
      }
      await refreshSavedList();
      setLibMsg('Deleted.', true);
    } catch {
      setLibMsg('Delete failed', false);
    }
  }

  async function saveCurrentDashboard() {
    const payload = captureCurrentImportPayloadForSave();
    const name = nameInput?.value?.trim();
    try {
      if (gaV4ActiveSavedId) {
        const r = await fetch(`/api/ga-v4-dashboards/${gaV4ActiveSavedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || undefined, payload }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || 'Save failed');
        }
        setLibMsg('Dashboard updated.', true);
        await refreshSavedList();
        return;
      }
      if (!name) {
        setLibMsg('Enter a name for this dashboard.', false);
        return;
      }
      const r = await fetch('/api/ga-v4-dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, payload }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Save failed');
      }
      const out = await r.json();
      if (out.id) gaV4ActiveSavedId = out.id;
      if (nameInput) nameInput.value = '';
      updateGaV4ActiveSavedHint();
      setLibMsg(`Saved “${name}”.`, true);
      await refreshSavedList();
    } catch (e) {
      setLibMsg(e?.message || 'Save failed', false);
    }
  }

  function newDashboardSession() {
    gaV4ActiveSavedId = null;
    resetDashboardToDefaults();
    const msg = document.getElementById('ga-upload-task-msg');
    if (msg) {
      msg.textContent = 'New dashboard — demo data restored. Import files under Task Progress to continue.';
      msg.style.color = 'var(--t3)';
    }
    const uploadNav = findUploadNavBtn();
    if (uploadNav) showView('upload', uploadNav);
    if (nameInput) nameInput.value = '';
    rerunAfterTaskImport();
    updateGaV4ActiveSavedHint();
    setLibMsg('Started a new dashboard session.', true);
    refreshSavedList();
  }

  if (saveBtn) saveBtn.onclick = () => saveCurrentDashboard();
  if (newBtn) newBtn.onclick = () => newDashboardSession();
  gaV4ActiveSavedId = null;
  updateGaV4ActiveSavedHint();
  refreshSavedList();
}

/* ═══════════════════════════════════════════════
   UPCOMING ACTIVITIES — RENDER
════════════════════════════════════════════════ */
let currentWindow = 7;

function fmtD(d){
  const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate()+' '+mo[d.getMonth()];
}
function durD(ps,pe){return Math.round((pe-ps)/(1000*60*60*24))+'d'}
function scC2(s){return s==='Completed'?C.green:s==='In Progress'?C.amber:'#9ca3af'}
function statCls(s){return s==='Completed'?'bgg':s==='In Progress'?'bga':'bgs'}

function filterUpcoming(days){
  const end = new Date(TODAY); end.setDate(end.getDate()+days);
  return UPCOMING.filter(t => t.ps <= end && t.pe >= TODAY);
}

function renderUpcomingActivities(days){
  currentWindow = days;
  const tasks = filterUpcoming(days);

  // Summary chips
  const ip = tasks.filter(t=>t.s==='In Progress').length;
  const ns = tasks.filter(t=>t.s==='Not Started').length;
  const dl = tasks.filter(t=>t.delay>0).length;
  const ending = tasks.filter(t=>{
    const wEnd=new Date(TODAY); wEnd.setDate(wEnd.getDate()+days);
    return t.pe>=TODAY && t.pe<=wEnd;
  }).length;
  document.getElementById('win-summary').innerHTML=
    `<span class="win-chip chip-ip">${ip} in progress</span>`+
    `<span class="win-chip chip-ns">${ns} starting</span>`+
    `<span class="win-chip chip-dl">${dl} delayed</span>`+
    `<span class="win-chip chip-ok">${ending} completing</span>`;

  // Group by category in a fixed display order
  const CAT_ORDER=['Civil','Design','General','Waterproofing','Masonry','Electrical','Plumbing','Tiling','Plaster','Cleaning'];
  const grouped={};
  tasks.forEach(t=>{ if(!grouped[t.cat]) grouped[t.cat]=[]; grouped[t.cat].push(t); });

  const cats = [...CAT_ORDER.filter(c=>grouped[c]), ...Object.keys(grouped).filter(c=>!CAT_ORDER.includes(c))];

  if(cats.length===0){
    document.getElementById('upcoming-activities').innerHTML=`<div class="no-tasks">No scheduled activities found for this window.</div>`;
    return;
  }

  const CAT_COLORS={Civil:'#1d4ed8',Design:'#6d28d9',General:'#0f6d50',Waterproofing:'#0d7a6e',Masonry:'#a16207',Electrical:'#b91c1c',Plumbing:'#96690b',Tiling:'#374151',Plaster:'#6b7280',Cleaning:'#9ca3af'};
  const CAT_BDG={Civil:'bgb',Design:'bgp',General:'bgg',Waterproofing:'bgt',Masonry:'bga',Electrical:'bgr',Plumbing:'bgd',Tiling:'bgs',Plaster:'bgs',Cleaning:'bgs'};

  document.getElementById('upcoming-activities').innerHTML = cats.map(cat=>{
    const tl = grouped[cat];
    const ipC = tl.filter(t=>t.s==='In Progress').length;
    const dlC = tl.filter(t=>t.delay>0).length;
    const nsC = tl.filter(t=>t.s==='Not Started').length;
    const catCol = CAT_COLORS[cat]||'#6b7280';
    // Sort: In Progress first, then by start date
    tl.sort((a,b)=>{
      const order={Completed:2,'In Progress':0,'Not Started':1};
      return (order[a.s]||1)-(order[b.s]||1)||(a.ps-b.ps);
    });

    const rows = tl.map(t=>{
      const sc = scC2(t.s);
      const ppct = pc(t.prog);
      const completing = t.pe >= TODAY && t.pe <= new Date(TODAY.getTime()+days*86400000);
      const today_flag = t.ps <= TODAY && t.pe >= TODAY && t.s==='In Progress';
      return `<div class="act-row">
        <div><div class="act-swatch" style="background:${sc}"></div></div>
        <div class="act-name" title="${t.n}">
          ${today_flag?'<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:'+C.amber+';margin-right:5px;vertical-align:middle"></span>':''}
          ${t.n}
        </div>
        <div class="act-dates">${fmtD(t.ps)} → ${fmtD(t.pe)}</div>
        <div class="act-dur">${durD(t.ps,t.pe)}</div>
        <div class="act-bar-wrap">
          <div class="act-bar-track"><div class="act-bar-fill" style="width:${t.prog}%;background:${t.prog>0?ppct:'#e5e7eb'}"></div></div>
          <span class="act-pct" style="color:${t.prog>0?ppct:'var(--t4)'}">${t.prog}%</span>
        </div>
        <div class="act-delay">${t.delay>0?`<span style="color:${t.delay>30?C.red:C.amber};font-weight:700">+${t.delay}d</span>`:`<span style="color:var(--t4)">—</span>`}</div>
        <div class="act-mem">${t.mem}</div>
        <div class="act-stat">
          ${completing&&t.s!=='Completed'?'<span class="bdg bgg" style="font-size:9px">Completing</span>':''}
          ${!completing?`<span class="bdg ${statCls(t.s)}" style="font-size:9px">${t.s==='Not Started'?'Starting':t.s}</span>`:''}
        </div>
      </div>`;
    }).join('');

    const isOpenByDefault = ipC > 0;
    const uid = 'cat-'+cat.replace(/[^a-z]/gi,'').toLowerCase();
    return `<div class="cat-group">
      <div class="cat-header" onclick="toggleCat('${uid}')">
        <span class="cat-arrow ${isOpenByDefault?'open':''}">▶</span>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:2px;background:${catCol};flex-shrink:0"></div>
          <span class="cat-name">${cat}</span>
          <span style="font-size:11px;color:var(--t4)">${tl.length} task${tl.length!==1?'s':''}</span>
        </div>
        <div class="cat-pills">
          ${ipC>0?`<span class="bdg bga">${ipC} active</span>`:''}
          ${nsC>0?`<span class="bdg bgb">${nsC} starting</span>`:''}
          ${dlC>0?`<span class="bdg bgr">${dlC} delayed</span>`:''}
          ${ipC===0&&nsC===0?`<span class="bdg bgs">on plan</span>`:''}
        </div>
      </div>
      <div class="cat-body ${isOpenByDefault?'open':''}" id="${uid}">
        <div class="act-hdr">
          <div></div><div>Task</div><div>Dates</div><div>Dur</div><div>Progress</div><div>Delay</div><div>Assigned</div><div>Status</div>
        </div>
        ${rows}
      </div>
    </div>`;
  }).join('');
}

function toggleCat(uid){
  const body=document.getElementById(uid);
  const hdr=body.previousElementSibling;
  const arrow=hdr.querySelector('.cat-arrow');
  const open=body.classList.toggle('open');
  arrow.classList.toggle('open',open);
}

function renderSchedule(){
  const ms=[
    {n:'Piling & foundations complete',dt:'Sep 2025',s:'done'},{n:'Raft / UG water tank complete',dt:'Sep 2025',s:'done'},
    {n:'Excavation complete',dt:'Sep 2025 (+132d late)',s:'late'},{n:'RCC basement to 5th slab',dt:'May 2026 (est)',s:'ip'},
    {n:'Basement floor complete',dt:'May 2026 (est)',s:'ip'},{n:'Drawing package complete',dt:'+228d behind plan',s:'crit'},
    {n:'BBM / Masonry start',dt:'Not started — no date',s:'pend'},{n:'MEP rough-in ★',dt:'Jun 2026',s:'pend'},
    {n:'Handover (originally planned)',dt:'90+ days delayed',s:'crit'}
  ];
  const col={done:C.green,late:C.amber,ip:C.blue,crit:C.red,pend:'#d1d5db'};
  document.getElementById('milestone-list').innerHTML=ms.map(m=>`<div class="wn"><div style="width:8px;height:8px;border-radius:50%;background:${col[m.s]};flex-shrink:0;margin-top:4px"></div><div style="flex:1"><div class="wn-name">${m.n}</div><div class="wn-cat">${m.dt}</div></div></div>`).join('');

  dc('delayChart');
  const delRaw=CATS.filter(c=>c.ad>0);
  const del=delRaw.length?delRaw:[{c:'No category delays (avg)',ad:0,t:0,d:0,i:0,n:0,avg:0}];
  rc('delayChart',new window.Chart(document.getElementById('delayChart'),{type:'bar',data:{labels:del.map(c=>chartLbl(c.c)),datasets:[{label:'Avg delay (d)',data:del.map(c=>c.ad),backgroundColor:del.map(c=>c.ad>100?'rgba(185,28,28,.65)':c.ad>50?'rgba(161,98,7,.6)':'rgba(29,78,216,.55)'),borderRadius:4}]},options:gO({indexAxis:'y',sx:{grid:{display:false}}})}));

  document.getElementById('delay-body').innerHTML=TOPDELAY.map(t=>`<tr>
    <td>${t.n}</td><td><span class="bdg ${t.c==='Civil'?'bgb':t.c==='Design'?'bgp':t.c==='Electrical'?'bgd':'bgs'}">${t.c}</span></td>
    <td style="font-weight:700;color:${t.d>150?C.red:t.d>80?C.amber:C.green}">+${t.d}d</td>
    <td><span class="bdg ${t.s==='Completed'?'bgg':t.s==='In Progress'?'bga':'bgr'}">${t.s}</span></td>
    <td><div style="display:flex;align-items:center;gap:5px"><div style="width:44px;height:4px;background:var(--b1);border-radius:99px;overflow:hidden"><div style="height:100%;width:${t.p}%;background:${pc(t.p)};border-radius:99px"></div></div><span>${t.p}%</span></div></td>
  </tr>`).join('');

  const slabs=SCHEDULE_SLABS;
  document.getElementById('slab-list').innerHTML=slabs.map(s=>`<div class="pr s"><div class="pl">${s.n}</div><div class="pt"><div class="pf" style="width:${s.p}%;background:${scC(s.s)}"></div></div><div class="pv" style="color:${scC(s.s)}">${s.p}%</div><div class="pd">${db(s.d)}</div></div>`).join('');

  dc('rfiChart');
  rc('rfiChart',new window.Chart(document.getElementById('rfiChart'),{type:'bar',data:{labels:['0–2d','3–5d','5–10d','>10d'],datasets:[{label:'RFIs',data:[8,7,5,3],backgroundColor:['rgba(15,109,80,.65)','rgba(161,98,7,.65)','rgba(185,28,28,.55)','rgba(185,28,28,.85)'],borderRadius:4}]},options:gO()}));

  // Upcoming activities - init with 7 days
  renderUpcomingActivities(7);

}

/* ═══════════════════════════════════════════════
   OPS RENDER
════════════════════════════════════════════════ */
function renderOps(){
  dc('trendChart');
  rc('trendChart',new window.Chart(document.getElementById('trendChart'),{type:'line',data:{labels:['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Actual',data:[28,34,39,44,48,51,52,53],borderColor:C.green,borderWidth:2.5,pointRadius:4,pointBackgroundColor:C.green,fill:true,backgroundColor:C.greenF,tension:.3},{label:'Planned',data:[30,45,65,90,120,160,200,240],borderColor:'#d1d5db',borderWidth:2,borderDash:[5,3],pointRadius:0,fill:false,tension:.3}]},options:gO()}));
  dc('readinessChart');
  const pct=(x)=> (x.t ? x.d/x.t : 0);
  const r=[...CATS].sort((a,b)=>pct(b)-pct(a));
  rc('readinessChart',new window.Chart(document.getElementById('readinessChart'),{type:'bar',data:{labels:r.map(x=>chartLbl(x.c)),datasets:[{label:'% done',data:r.map(x=>Math.round(pct(x)*100)),backgroundColor:r.map(x=>{const p=pct(x)*100;return p>60?'rgba(15,109,80,.7)':p>20?'rgba(161,98,7,.65)':'rgba(185,28,28,.5)'}),borderRadius:4}]},options:gO({indexAxis:'y',sx:{min:0,max:100,ticks:{callback:v=>v+'%',color:C.tick,font:{size:11,family:C.f}}},sy:{grid:{display:false}}})}));
  dc('wfChart');
  rc('wfChart',new window.Chart(document.getElementById('wfChart'),{type:'bar',data:{labels:['W1 Mar','W2 Mar','W3 Mar','W4 Mar','W1 Apr','W2 Apr'],datasets:[{label:'Planned',data:[230,230,240,240,240,235],backgroundColor:'rgba(0,0,0,.1)',borderRadius:3},{label:'Actual',data:[218,225,232,228,216,218],backgroundColor:'rgba(29,78,216,.65)',borderRadius:3}]},options:gO()}));
  dc('safetyChart');
  rc('safetyChart',new window.Chart(document.getElementById('safetyChart'),{type:'bar',data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'LTIFR',data:[0.9,0.8,1.1,0.7,0.8,0.8],backgroundColor:'rgba(185,28,28,.6)',borderRadius:3,yAxisID:'y'},{label:'Near misses',data:[3,4,2,5,3,2],backgroundColor:'rgba(161,98,7,.5)',borderRadius:3,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tt},scales:{y:{min:0,max:2,grid:{color:C.grid},ticks:{color:C.tick,font:{size:11,family:C.f}}},y1:{position:'right',min:0,max:8,grid:{display:false},ticks:{color:C.tick,font:{size:11,family:C.f}}},x:{grid:{color:C.grid},ticks:{color:C.tick,font:{size:11,family:C.f}}}}}}));
}

function renderPerformance(){
  const rows = [];
  ACTIVE.forEach((t, i) => rows.push({ id:`a-${i}`, s:'In Progress', p:t.p, d:t.d, m:t.m || 'Unassigned' }));
  UPCOMING.forEach((t, i) => rows.push({ id:t.id || `u-${i}`, s:t.s, p:t.prog, d:t.delay, m:t.mem || 'Unassigned' }));
  const uniq = new Map();
  rows.forEach((r) => { if (!uniq.has(r.id)) uniq.set(r.id, r); });
  const all = [...uniq.values()];
  const member = new Map();
  all.forEach((t) => {
    String(t.m || 'Unassigned').split(',').map((x) => x.trim()).filter(Boolean).forEach((nm) => {
      if (!member.has(nm)) member.set(nm, { nm, total:0, ip:0, done:0, delay:0, sumP:0 });
      const o = member.get(nm);
      o.total += 1; if (t.s === 'In Progress') o.ip += 1; if (t.s === 'Completed') o.done += 1;
      if ((t.d || 0) > 0) o.delay += 1; o.sumP += Number(t.p || 0);
    });
  });
  const emps = [...member.values()].map((o) => ({ ...o, avgP: o.total ? Math.round((o.sumP / o.total) * 10) / 10 : 0, onTime: o.total ? Math.round(((o.total - o.delay) / o.total) * 100) : 0 })).sort((a,b)=>(b.avgP-a.avgP)||(b.total-a.total));
  const totalTasks = all.length, delayed = all.filter((x)=>x.d>0).length, done = all.filter((x)=>x.s==='Completed').length, ip = all.filter((x)=>x.s==='In Progress').length;
  const teamOnTime = totalTasks ? Math.round(((totalTasks-delayed)/totalTasks)*100) : 0;
  const teamAvg = totalTasks ? Math.round((all.reduce((s,x)=>s+Number(x.p||0),0)/totalTasks)*10)/10 : 0;
  const perfCards = document.getElementById('perf-kpi-cards');
  if (!perfCards) return;
  perfCards.innerHTML = `
    <div class="kc i"><div class="kl">Team members</div><div class="kv">${emps.length}</div><div class="km">Assigned in uploaded tasks</div><span class="kp p-i">Live</span><div class="kb"><div class="kbf" style="width:${Math.min(100, emps.length*12)}%;background:var(--navy)"></div></div></div>
    <div class="kc ok"><div class="kl">Completed tasks</div><div class="kv">${done}</div><div class="km">Across active scope</div><span class="kp p-ok">${totalTasks?Math.round(done/totalTasks*100):0}%</span><div class="kb"><div class="kbf" style="width:${totalTasks?Math.round(done/totalTasks*100):0}%;background:var(--G)"></div></div></div>
    <div class="kc w"><div class="kl">In progress</div><div class="kv">${ip}</div><div class="km">Execution underway</div><span class="kp p-w">Current cycle</span><div class="kb"><div class="kbf" style="width:${totalTasks?Math.round(ip/totalTasks*100):0}%;background:var(--A)"></div></div></div>
    <div class="kc ${teamOnTime>=80?'ok':teamOnTime>=60?'w':'b'}"><div class="kl">On-time ratio</div><div class="kv">${teamOnTime}<small style="font-size:12px">%</small></div><div class="km">${delayed} delayed tasks</div><span class="kp ${teamOnTime>=80?'p-ok':teamOnTime>=60?'p-w':'p-b'}">${teamOnTime>=80?'Healthy':teamOnTime>=60?'Watch':'Risk'}</span><div class="kb"><div class="kbf" style="width:${teamOnTime}%;background:${teamOnTime>=80?'var(--G)':teamOnTime>=60?'var(--A)':'var(--R)'}"></div></div></div>
    <div class="kc ${teamAvg>=60?'ok':teamAvg>=35?'w':'b'}"><div class="kl">Avg progress</div><div class="kv">${teamAvg}<small style="font-size:12px">%</small></div><div class="km">Weighted by assigned tasks</div><span class="kp ${teamAvg>=60?'p-ok':teamAvg>=35?'p-w':'p-b'}">${teamAvg>=60?'Strong':'Improvement needed'}</span><div class="kb"><div class="kbf" style="width:${Math.max(1,teamAvg)}%;background:${teamAvg>=60?'var(--G)':teamAvg>=35?'var(--A)':'var(--R)'}"></div></div></div>
  `;
  const top = emps.slice(0,8);
  dc('perfMemberChart');
  rc('perfMemberChart',new window.Chart(document.getElementById('perfMemberChart'),{type:'bar',data:{labels:top.map((x)=>chartLbl(x.nm,16)),datasets:[{label:'Avg progress %',data:top.map((x)=>x.avgP),backgroundColor:'rgba(30,58,95,.72)',borderRadius:4}]},options:gO({sy:{min:0,max:100,ticks:{callback:v=>v+'%'}},sx:{ticks:{font:{size:10,family:C.f}}}})}));
  document.getElementById('perf-team-list').innerHTML = emps.slice(0,10).map((e)=>`<div class="pr"><div class="pl">${e.nm} <small style="color:var(--t4)">(${e.total} tasks)</small></div><div class="pt"><div class="pf" style="width:${e.avgP}%;background:${e.avgP>=60?C.green:e.avgP>=35?C.amber:C.red}"></div></div><div class="pv" style="color:${e.avgP>=60?C.green:e.avgP>=35?C.amber:C.red}">${e.avgP}%</div><div class="pd ${e.onTime>=80?'dok':e.onTime>=60?'dw':'db'}">${e.onTime}% on-time</div></div>`).join('') || '<div style="color:var(--t4);font-size:12px">No assigned-member data found in uploaded tasks.</div>';
  document.getElementById('perf-emp-body').innerHTML = emps.map((e)=>{ const sig = e.avgP>=60 && e.onTime>=80 ? 'Strong' : e.avgP>=35 && e.onTime>=60 ? 'Watch' : 'Needs support'; const sigCls = sig==='Strong' ? 'bgg' : sig==='Watch' ? 'bga' : 'bgr'; return `<tr><td>${e.nm}</td><td>${e.total}</td><td>${e.ip}</td><td>${e.done}</td><td>${e.avgP}%</td><td style="color:${e.delay>0?C.red:C.green}">${e.delay}</td><td>${e.onTime}%</td><td><span class="bdg ${sigCls}">${sig}</span></td></tr>`; }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--t4)">No employee assignments found. Include Assigned Members in imports.</td></tr>';
}

/* ═══════════════════════════════════════════════
   FINANCE RENDER
════════════════════════════════════════════════ */
function renderFinance(){
  // BOQ vs certified vs paid
  dc('boqChart');
  rc('boqChart',new window.Chart(document.getElementById('boqChart'),{
    type:'bar',
    data:{labels:BOQ_CATS,datasets:[
      {label:'BOQ Budget',data:BOQ_BUDGET,backgroundColor:'rgba(0,0,0,.1)',borderRadius:3},
      {label:'Work Certified',data:BOQ_CERT,backgroundColor:'rgba(30,58,95,.7)',borderRadius:3},
      {label:'Paid to Contractor',data:BOQ_PAID,backgroundColor:'rgba(15,109,80,.65)',borderRadius:3}
    ]},
    options:gO({sx:{ticks:{maxRotation:30,font:{size:10,family:C.f},color:C.tick}},sy:{ticks:{callback:v=>'₹'+v+'L'}}})
  }));

  // Cost pie
  const ci=[{l:'Civil/RCC',v:42,c:'#1e3a5f'},{l:'Foundations',v:18,c:'#0d7a6e'},{l:'MEP Elec',v:0,c:'#d1d5db'},{l:'Plumbing',v:0,c:'#e5e7eb'},{l:'Tiling',v:0,c:'#f4f3f0'},{l:'Design',v:8,c:'#6d28d9'},{l:'Facade',v:2,c:'#96690b'},{l:'Other',v:6,c:'#9ca3af'}].filter(x=>x.v>0);
  dc('costPieChart');
  rc('costPieChart',new window.Chart(document.getElementById('costPieChart'),{type:'doughnut',data:{labels:ci.map(x=>x.l),datasets:[{data:ci.map(x=>x.v),backgroundColor:ci.map(x=>x.c),borderWidth:2,borderColor:'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false},tooltip:tt}}}));
  document.getElementById('cost-pie-leg').innerHTML=ci.map(x=>`<span><span class="ld" style="background:${x.c}"></span>${x.l}</span>`).join('');

  // Contractor table
  document.getElementById('contractor-table').innerHTML=`<thead><tr><th>Contractor / Package</th><th>Category</th><th>BOQ (₹L)</th><th>Certified (₹L)</th><th>Paid (₹L)</th><th>Outstanding (₹L)</th><th>Retention (₹L)</th><th>Status</th></tr></thead><tbody>${
    CONTRACTORS.map(c=>{
      const out=c.cert-c.paid;
      const pct=c.boq>0?Math.round(c.cert/c.boq*100):0;
      const sc=pct>80?'bgg':pct>40?'bga':c.cert===0?'bgr':'bga';
      return`<tr><td>${c.name}</td><td><span class="bdg bgs">${c.cat}</span></td><td>${fL(c.boq)}</td><td>${fL(c.cert)}</td><td>${fL(c.paid)}</td><td style="color:${out>100?C.red:C.amber};font-weight:700">${fL(out)}</td><td>${fL(c.ret)}</td><td><span class="bdg ${sc}">${pct>80?'Active':pct>0?'Partial':'Not started'}</span></td></tr>`;
    }).join('')
  }</tbody>`;

  // Cash flow
  dc('cashflowChart');
  rc('cashflowChart',new window.Chart(document.getElementById('cashflowChart'),{
    type:'line',
    data:{labels:['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],
      datasets:[
        {label:'Planned spend',data:[400,600,800,900,1000,1100,1200,1300,1400,1450,1480,1500,1480],borderColor:'#d1d5db',borderWidth:2,borderDash:[5,3],pointRadius:0,fill:false,tension:.3},
        {label:'Actual spend',data:[350,480,620,740,860,960,1040,1100,1150,1080,1100,1120,1120],borderColor:C.navy,borderWidth:2.5,pointRadius:4,pointBackgroundColor:C.navy,fill:true,backgroundColor:C.navyF,tension:.3}
      ]
    },
    options:gO({sy:{ticks:{callback:v=>'₹'+v+'L',color:C.tick,font:{size:11,family:C.f}}}})
  }));

  // Change orders
  dc('coChart');
  rc('coChart',new window.Chart(document.getElementById('coChart'),{
    type:'bar',
    data:{labels:CO_CATS,datasets:[{label:'CO Value (₹L)',data:CO_VALS,backgroundColor:['rgba(185,28,28,.65)','rgba(161,98,7,.6)','rgba(30,58,95,.6)','rgba(109,40,217,.55)','rgba(15,109,80,.6)'],borderRadius:4}]},
    options:gO({sy:{ticks:{callback:v=>'₹'+v+'L'}}})
  }));

  // Material table
  document.getElementById('material-table').innerHTML=`<thead><tr><th>Material</th><th>Unit</th><th>BOQ Qty</th><th>PO Raised</th><th>GRN Received</th><th>Pending</th><th>Rate (₹)</th><th>PO Value (₹L)</th><th>Paid (₹L)</th></tr></thead><tbody>${
    MATERIALS.map(m=>{
      const pc2=m.boq>0?Math.round(m.grn/m.boq*100):0;
      return`<tr><td>${m.m}</td><td><span class="bdg bgs">${m.u}</span></td><td>${fL(m.boq)}</td><td>${m.po>0?fL(m.po):'<span class="bdg bgr">Not raised</span>'}</td><td>${m.grn>0?fL(m.grn):'—'}</td><td style="color:${m.pend>m.boq*.5?C.red:C.amber}">${fL(m.pend)}</td><td>₹${fL(m.rate)}</td><td>${m.poval>0?fL(m.poval):'—'}</td><td>${m.paid>0?fL(m.paid):'—'}</td></tr>`;
    }).join('')
  }</tbody>`;
}

/* ═══════════════════════════════════════════════
   UPLOAD TEMPLATE RENDER
════════════════════════════════════════════════ */
const UPLOAD_SCHEMAS={
  task:{
    title:'Task Progress Upload',
    desc:'Weekly export from your construction management tool. Maps directly to the Construction Progress and Schedule tabs.',
    source:'Construction tool (weekly export) → Upload every Monday',
    freq:'Weekly',
    fields:[
      {n:'project_id',t:'Text',d:'Unique project code e.g. GA-E-BLDG',req:true,ex:'GA-E-BLDG'},
      {n:'task_id',t:'Text',d:'Tool task ID e.g. TSK000001',req:true,ex:'TSK000001'},
      {n:'task_name',t:'Text',d:'Full task name from WBS',req:true,ex:'1st slab concrete'},
      {n:'level',t:'Text',d:'WBS hierarchy level: L1, L2, L3, L4, L5',req:true,ex:'L2'},
      {n:'parent_leaf',t:'Text',d:'Parent or Leaf node',req:true,ex:'Leaf'},
      {n:'work_category',t:'Text',d:'Category: Civil, Design, MEP, Electrical, Plumbing, Tiling, Plaster, Masonry, General',req:true,ex:'Civil'},
      {n:'assigned_members',t:'Text',d:'Comma-separated names',req:false,ex:'Namdev S, Krunal T'},
      {n:'planned_start',t:'Date DD-MMM-YY',d:'Planned start date',req:true,ex:'30-Apr-25'},
      {n:'planned_end',t:'Date DD-MMM-YY',d:'Planned end date',req:true,ex:'03-May-26'},
      {n:'actual_start',t:'Date DD-MMM-YY',d:'Actual start date',req:false,ex:'22-Apr-25'},
      {n:'actual_end',t:'Date DD-MMM-YY',d:'Actual completion date',req:false,ex:'07-Sep-25'},
      {n:'duration_days',t:'Number',d:'Planned duration in days',req:false,ex:'369'},
      {n:'uom',t:'Text',d:'Unit of measurement: cum, kg, sqft, rmt, nos, %',req:false,ex:'cum'},
      {n:'total_qty',t:'Number',d:'Total quantity as per plan',req:false,ex:'10000'},
      {n:'progress_qty',t:'Number',d:'Quantity completed to date',req:false,ex:'7400'},
      {n:'progress_pct',t:'Number (0–100)',d:'Percentage completion',req:true,ex:'74'},
      {n:'status',t:'Text',d:'Completed / In Progress / Not Started',req:true,ex:'In Progress'},
      {n:'delay_days',t:'Number',d:'Days behind plan (positive = delayed)',req:false,ex:'13'},
      {n:'boq_rate',t:'Number',d:'Rate per unit from BOQ (₹)',req:false,ex:'7800'},
      {n:'boq_amount',t:'Number',d:'Total BOQ value for this task (₹)',req:false,ex:'3000000'},
      {n:'extract_date',t:'Date',d:'Date this export was pulled',req:true,ex:'09-Apr-26'}
    ]
  },
  boq:{
    title:'BOQ & Budget Upload',
    desc:'Bill of Quantities mapped to WBS task IDs. This is the most critical missing data — activates CPI, EAC, EVM, and cost variance across all financial KPIs.',
    source:'Quantity Surveyor BOQ document → upload once, then update for revisions',
    freq:'Once + on revision',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'boq_line_ref',t:'Text',d:'Your internal BOQ line reference number',req:true,ex:'BOQ-001-A'},
      {n:'task_id',t:'Text',d:'Linked construction tool TaskID',req:true,ex:'TSK000005'},
      {n:'work_package',t:'Text',d:'High-level package: Structure, MEP, Finishes etc.',req:true,ex:'Structure'},
      {n:'description',t:'Text',d:'Item description from BOQ',req:true,ex:'RCC M30 column concrete'},
      {n:'uom',t:'Text',d:'cum / MT / sqft / rmt / nos / LS',req:true,ex:'cum'},
      {n:'boq_qty',t:'Number',d:'Tendered quantity',req:true,ex:'450'},
      {n:'rate_inr',t:'Number',d:'Agreed rate per unit (₹)',req:true,ex:'8200'},
      {n:'boq_value_inr',t:'Number',d:'Total BOQ value (qty × rate)',req:true,ex:'3690000'},
      {n:'contractor_id',t:'Text',d:'Linked contractor code',req:false,ex:'CON-001'},
      {n:'revision_no',t:'Number',d:'BOQ revision number (0 = original)',req:false,ex:'0'},
      {n:'approved_date',t:'Date',d:'Date BOQ was approved / signed',req:false,ex:'15-Mar-25'}
    ]
  },
  contractor:{
    title:'Contractor Payment Upload',
    desc:'Monthly billing and payment status per contractor and work package. Powers the contractor payment ledger and cash flow charts.',
    source:'Accounts payable / Tally ERP → monthly extract',
    freq:'Monthly (by 5th of each month)',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'contractor_id',t:'Text',d:'Unique contractor code',req:true,ex:'CON-001'},
      {n:'contractor_name',t:'Text',d:'Registered firm name',req:true,ex:'Namdev Shingulwar & Co.'},
      {n:'work_package',t:'Text',d:'Package: Civil, MEP, Electrical, etc.',req:true,ex:'Civil / RCC'},
      {n:'bill_no',t:'Text',d:'RA bill or invoice number',req:true,ex:'RA-007'},
      {n:'bill_date',t:'Date',d:'Date of bill submission',req:true,ex:'31-Mar-26'},
      {n:'boq_value_inr',t:'Number',d:'Total contracted BOQ value (₹)',req:true,ex:'42000000'},
      {n:'work_done_value_inr',t:'Number',d:'Cumulative work done value (₹)',req:true,ex:'39600000'},
      {n:'bill_amount_inr',t:'Number',d:'Amount in this RA bill (₹)',req:true,ex:'2400000'},
      {n:'certified_amount_inr',t:'Number',d:'Amount certified by engineer (₹)',req:true,ex:'2200000'},
      {n:'paid_amount_inr',t:'Number',d:'Amount released as payment (₹)',req:true,ex:'2000000'},
      {n:'payment_date',t:'Date',d:'Date payment was released',req:false,ex:'08-Apr-26'},
      {n:'retention_pct',t:'Number',d:'Retention % (typically 5–10%)',req:false,ex:'5'},
      {n:'retention_held_inr',t:'Number',d:'Retention amount withheld (₹)',req:false,ex:'1980000'},
      {n:'deductions_inr',t:'Number',d:'Any deductions (penalty, material recovery)',req:false,ex:'0'}
    ]
  },
  workforce:{
    title:'Daily Workforce Upload',
    desc:'Daily headcount by trade and contractor. Powers workforce vs plan KPI and productivity analysis. Can be submitted as a single weekly batch.',
    source:'Site manager daily attendance register → upload daily or weekly batch',
    freq:'Daily (or weekly batch every Monday)',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'date',t:'Date DD-MMM-YY',d:'Date of attendance',req:true,ex:'09-Apr-26'},
      {n:'trade',t:'Text',d:'Trade: Mason, Carpenter, Steel fixer, Helper, Supervisor, MEP fitter',req:true,ex:'Mason'},
      {n:'contractor_id',t:'Text',d:'Contractor supplying this trade',req:false,ex:'CON-001'},
      {n:'planned_count',t:'Number',d:'Planned headcount for this trade today',req:true,ex:'25'},
      {n:'actual_count',t:'Number',d:'Actual headcount present on site',req:true,ex:'22'},
      {n:'man_hours_worked',t:'Number',d:'Total man-hours worked (count × hours)',req:false,ex:'176'},
      {n:'remarks',t:'Text',d:'Any absenteeism reason or note',req:false,ex:'3 absent — local holiday'}
    ]
  },
  material:{
    title:'Material & PO Status Upload',
    desc:'Procurement and delivery tracking per material category. Powers material on-time delivery KPI and procurement cash flow.',
    source:'Procurement / store team → weekly update',
    freq:'Weekly',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'material_code',t:'Text',d:'Internal material code',req:true,ex:'MAT-001'},
      {n:'material_name',t:'Text',d:'Full description',req:true,ex:'TMT Steel Fe500 16mm'},
      {n:'uom',t:'Text',d:'Unit: MT, cum, sqft, rmt, nos',req:true,ex:'MT'},
      {n:'boq_qty',t:'Number',d:'Total required as per BOQ',req:true,ex:'180'},
      {n:'po_no',t:'Text',d:'Purchase order number',req:false,ex:'PO-2025-044'},
      {n:'po_date',t:'Date',d:'Date PO was issued',req:false,ex:'10-Feb-26'},
      {n:'po_qty',t:'Number',d:'Quantity ordered in PO',req:false,ex:'180'},
      {n:'rate_inr',t:'Number',d:'Rate per unit (₹) in PO',req:false,ex:'62000'},
      {n:'po_value_inr',t:'Number',d:'Total PO value (₹)',req:false,ex:'11160000'},
      {n:'planned_delivery_date',t:'Date',d:'Committed delivery date',req:false,ex:'01-Mar-26'},
      {n:'grn_qty',t:'Number',d:'Quantity received (GRN)',req:false,ex:'122'},
      {n:'grn_date',t:'Date',d:'Date of last GRN',req:false,ex:'28-Mar-26'},
      {n:'paid_value_inr',t:'Number',d:'Amount paid to supplier (₹)',req:false,ex:'7564000'},
      {n:'pending_qty',t:'Number',d:'Quantity still pending delivery',req:false,ex:'58'}
    ]
  },
  safety:{
    title:'Daily Safety Register Upload',
    desc:'HSE daily log. Powers LTIFR, near-miss tracking, toolbox talk compliance. Required to calculate man-hours and incident rate.',
    source:'HSE officer → daily entry, weekly batch upload',
    freq:'Daily / Weekly batch',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'date',t:'Date DD-MMM-YY',d:'Date of record',req:true,ex:'09-Apr-26'},
      {n:'total_manpower',t:'Number',d:'Total workers on site that day',req:true,ex:'218'},
      {n:'man_hours_worked',t:'Number',d:'Total man-hours (manpower × working hours)',req:true,ex:'1744'},
      {n:'lti_count',t:'Number',d:'Lost Time Injuries on this date',req:true,ex:'0'},
      {n:'first_aid_count',t:'Number',d:'First aid cases on this date',req:false,ex:'1'},
      {n:'near_miss_count',t:'Number',d:'Near misses reported',req:false,ex:'0'},
      {n:'toolbox_talk_held',t:'Yes/No',d:'Was toolbox talk conducted today?',req:false,ex:'Yes'},
      {n:'toolbox_attendance',t:'Number',d:'Number attending toolbox talk',req:false,ex:'195'},
      {n:'incident_description',t:'Text',d:'Description if any incident occurred',req:false,ex:''},
      {n:'corrective_action',t:'Text',d:'Action taken for any incident',req:false,ex:''}
    ]
  },
  rfi:{
    title:'RFI & Change Order Register Upload',
    desc:'RFIs and change orders affect schedule and cost. This register tracks resolution time and CO cost impact — powers change order rate and RFI aging KPIs.',
    source:'PM / PMO → update on each RFI submission or CO approval',
    freq:'As-and-when (minimum weekly)',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'ref_type',t:'Text',d:'RFI or CO',req:true,ex:'RFI'},
      {n:'ref_no',t:'Text',d:'Sequential reference number',req:true,ex:'RFI-2026-018'},
      {n:'date_raised',t:'Date DD-MMM-YY',d:'Date submitted',req:true,ex:'01-Apr-26'},
      {n:'raised_by',t:'Text',d:'Person or team who raised it',req:false,ex:'Site manager'},
      {n:'description',t:'Text',d:'Short description of the query or change',req:true,ex:'Clarification on column detailing B2–B5'},
      {n:'linked_task_id',t:'Text',d:'Affected WBS task ID',req:false,ex:'TSK000052'},
      {n:'category',t:'Text',d:'Design / Soil / Client change / Regulatory / Supply chain',req:false,ex:'Design'},
      {n:'date_responded',t:'Date DD-MMM-YY',d:'Date response / decision received',req:false,ex:'05-Apr-26'},
      {n:'resolution_days',t:'Number',d:'Days from raised to responded',req:false,ex:'4'},
      {n:'status',t:'Text',d:'Open / Responded / Closed',req:true,ex:'Closed'},
      {n:'cost_impact_inr',t:'Number',d:'Cost impact (₹) — 0 if no cost change (CO only)',req:false,ex:'280000'},
      {n:'schedule_impact_days',t:'Number',d:'Schedule impact in days (positive = delay)',req:false,ex:'3'},
      {n:'approval_status',t:'Text',d:'Pending / Approved / Rejected (CO only)',req:false,ex:'Approved'}
    ]
  },
  sales:{
    title:'Sales & Collections Upload',
    desc:'CRM bookings and Accounts Receivable data. Powers revenue realization, receivables, and CLP collection KPIs in the Financial tab.',
    source:'CRM export + Tally AR module → monthly',
    freq:'Monthly (by 5th)',
    fields:[
      {n:'project_id',t:'Text',d:'Project code',req:true,ex:'GA-E-BLDG'},
      {n:'unit_no',t:'Text',d:'Flat/Villa/Unit number',req:true,ex:'E-1204'},
      {n:'unit_type',t:'Text',d:'1BHK / 2BHK / 3BHK / Villa etc.',req:false,ex:'3BHK'},
      {n:'carpet_area_sqft',t:'Number',d:'Carpet area in sqft',req:false,ex:'1240'},
      {n:'booking_date',t:'Date DD-MMM-YY',d:'Date of booking',req:false,ex:'12-Jun-25'},
      {n:'agreement_value_inr',t:'Number',d:'Total agreement value (₹)',req:true,ex:'12500000'},
      {n:'buyer_name',t:'Text',d:'Buyer registered name',req:false,ex:'Rahul Patil'},
      {n:'clp_milestone',t:'Text',d:'Current CLP milestone triggered',req:true,ex:'Slab 2 completion'},
      {n:'demand_raised_inr',t:'Number',d:'Total demand raised to this buyer (₹)',req:true,ex:'6250000'},
      {n:'demand_date',t:'Date DD-MMM-YY',d:'Date of last demand letter',req:false,ex:'01-Apr-26'},
      {n:'collected_inr',t:'Number',d:'Total amount collected to date (₹)',req:true,ex:'5000000'},
      {n:'last_collection_date',t:'Date DD-MMM-YY',d:'Date of last payment received',req:false,ex:'28-Mar-26'},
      {n:'outstanding_inr',t:'Number',d:'Amount outstanding (demand – collected)',req:false,ex:'1250000'},
      {n:'overdue_days',t:'Number',d:'Days since demand without full payment',req:false,ex:'31'},
      {n:'rera_no',t:'Text',d:'RERA registration number',req:false,ex:'P52100012345'}
    ]
  }
};

function renderUploadPane(id){
  const s=UPLOAD_SCHEMAS[id];
  if(!s) return;
  const req_count=s.fields.filter(f=>f.req).length;
  const opt_count=s.fields.filter(f=>!f.req).length;
  const uploadBlock = id === 'task' ? `
      <div class="sec" style="border-left-color:var(--G);margin-bottom:16px">
        <div class="sh"><span class="st">Task data</span><span class="dtag i" style="background:var(--G-lt);border-color:rgba(15,109,80,.22);color:var(--G)">.xlsx / .csv</span></div>
        <div class="sec-sub">PowerPlay / Golden Abodes: task extract (.xlsx), PO extract, or period PDF report. Data is analysed in-browser (tasks → KPIs & charts; PO → materials table; PDF → summary KPIs from text — no cloud AI).</div>
        <label class="ga-drop" style="display:block;margin:12px 0;padding:16px;border:1px dashed var(--b2);border-radius:10px;background:var(--s2);cursor:pointer;text-align:center;font-size:13px;color:var(--t2)">
          <input type="file" id="ga-upload-task-file" accept=".pdf,.xlsx,.xls,.csv" style="display:none" />
          <span id="ga-upload-task-label">Click or drop file (.pdf / .xlsx / .csv), then Import</span>
        </label>
        <div id="ga-powerplay-insight" style="display:none;margin-top:10px;padding:12px;border-radius:10px;background:var(--s2);border:1px solid var(--b1);font-size:12px"></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
          <button type="button" class="btn primary" id="ga-upload-task-btn">Import</button>
          <button type="button" class="btn" id="ga-upload-task-clear">Reset demo data</button>
        </div>
        <div id="ga-upload-task-msg" style="font-size:12px;color:var(--t3);min-height:18px;margin-bottom:10px"></div>
        <details style="font-size:12px;color:var(--t2)">
          <summary style="cursor:pointer;color:var(--navy);font-weight:600">Optional: blank work-tree CSV (slab rows × N)</summary>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px">
            <label>Slabs</label>
            <input type="number" id="ga-slab-count" min="1" max="60" value="5" style="width:52px;padding:6px 8px;border:1px solid var(--b1);border-radius:6px" />
            <label>Basement</label>
            <input type="text" id="ga-basement-labels" value="b-1 slab" style="width:140px;padding:6px 8px;border:1px solid var(--b1);border-radius:6px" />
            <label>Code</label>
            <input type="text" id="ga-project-code" value="GA-E-BLDG" style="width:100px;padding:6px 8px;border:1px solid var(--b1);border-radius:6px" />
            <button type="button" class="btn" id="ga-download-worktree-btn">↓ Download CSV</button>
          </div>
        </details>
      </div>` : '';
  document.getElementById('upane-'+id).innerHTML=`
    ${uploadBlock}
    <div class="sec" style="border-left-color:var(--navy)">
      <div class="sh"><span class="st">${s.title}</span><span class="dtag i" style="background:var(--navy-lt);border-color:rgba(30,58,95,.22);color:var(--navy)">Freq: ${s.freq}</span></div>
      <div class="sec-sub">${s.desc}</div>
      <div class="abar g">📁 Source: ${s.source}</div>
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div class="mn"><div class="mv">${s.fields.length}</div><div class="ml">Total fields</div></div>
        <div class="mn"><div class="mv" style="color:var(--R)">${req_count}</div><div class="ml">Required</div></div>
        <div class="mn"><div class="mv" style="color:var(--G)">${opt_count}</div><div class="ml">Optional</div></div>
      </div>
      <div class="field-group">
        <div class="field-group-header"><span class="field-group-title">Field definitions</span><span style="font-size:11px;color:var(--t4)"><span class="req">REQ</span> = required &nbsp;·&nbsp; <span class="opt">OPT</span> = optional</span></div>
        <div class="field-row hdr"><div>Field name</div><div>Data type</div><div>Description</div><div>Example</div><div>Required</div></div>
        ${s.fields.map(f=>`<div class="field-row"><div style="font-family:monospace;font-size:11px;color:var(--navy)">${f.n}</div><div style="color:var(--t3)">${f.t}</div><div style="color:var(--t2)">${f.d}</div><div style="color:var(--t4);font-family:monospace;font-size:10px">${f.ex}</div><div><span class="${f.req?'req':'opt'}">${f.req?'REQ':'OPT'}</span></div></div>`).join('')}
      </div>
    </div>`;
  if (id === 'task') {
    const fileInput = document.getElementById('ga-upload-task-file');
    const importBtn = document.getElementById('ga-upload-task-btn');
    const clearBtn = document.getElementById('ga-upload-task-clear');
    const workTreeBtn = document.getElementById('ga-download-worktree-btn');
    const labelEl = document.getElementById('ga-upload-task-label');
    const dz = document.querySelector('#upane-task .ga-drop');
    if (importBtn && fileInput) importBtn.onclick = () => handlePowerplayFile(fileInput.files?.[0]);
    if (fileInput && labelEl) {
      fileInput.onchange = () => {
        const f = fileInput.files?.[0];
        labelEl.textContent = f ? f.name : 'Click or drop a file, then Import';
      };
    }
    if (dz && fileInput && labelEl) {
      ['dragenter', 'dragover'].forEach((ev) =>
        dz.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
        }),
      );
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (!f) return;
        try {
          const dt = new DataTransfer();
          dt.items.add(f);
          fileInput.files = dt.files;
          labelEl.textContent = f.name;
        } catch {
          /* ignore */
        }
      });
    }
    if (clearBtn) clearBtn.onclick = () => clearImportedTaskData();
    if (workTreeBtn) workTreeBtn.onclick = () => downloadWorkTreeTemplate();
  }
}

/* ═══════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════════ */
function exportCSV(type){
  let rows,fn;
  if(type==='portfolio'){
    rows=[['Project','Sub','Tasks','Completion%','SPI','CPI','BOQ_Cr','Spent_Cr','MaxDelay_d'],...Object.entries(PROJECTS).map(([k,p])=>[p.name,p.sub,p.tasks,p.completion,p.spi,p.cpi,p.boq,p.spent,p.maxDelay])];
    fn='GA_Portfolio_KPIs.csv';
  }else{
    rows=[['Task','Category','Progress%','Status','Delay'],
      ...ACTIVE.map(t=>[t.n,t.c,t.p,'In Progress',t.d]),
      ...TOPDELAY.map(t=>[t.n,t.c,t.p,t.s,t.d])];
    fn='Anantam_E_KPIs.csv';
  }
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
  a.download=fn; a.click();
}

function downloadTemplate(){
  const id=document.querySelector('#uploadTabBar .tab.active').dataset.utab;
  const s=UPLOAD_SCHEMAS[id];
  if(!s) return;
  const rows=[s.fields.map(f=>f.n),s.fields.map(f=>f.ex)];
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
  a.download=`GA_Template_${id}.csv`; a.click();
}

/* ═══════════════════════════════════════════════
   REACT MOUNT — wire DOM + globals (HTML is injected by GADashboardV4.jsx)
════════════════════════════════════════════════ */
export function mountGADashboardV4() {
  if (typeof window === 'undefined' || !window.Chart) {
    return () => {};
  }
  window.showView = showView;
  window.onProjChange = onProjChange;
  window.onBuildingChange = onBuildingChange;
  window.onTreeProjectChange = onTreeProjectChange;
  window.onTreePhaseChange = onTreePhaseChange;
  window.onTreeBuildingChange = onTreeBuildingChange;
  window.addProjectTreeNode = addProjectTreeNode;
  window.editProjectTreeNode = editProjectTreeNode;
  window.deleteProjectTreeNode = deleteProjectTreeNode;
  window.exportCSV = exportCSV;
  window.downloadTemplate = downloadTemplate;
  window.downloadWorkTreeTemplate = downloadWorkTreeTemplate;
  window.drillProject = drillProject;
  window.toggleCat = toggleCat;

  const onProjTab = (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const id = btn.dataset.pane;
    document.querySelectorAll('#view-project .pane').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('#projTabBar .tab').forEach((b) => b.classList.remove('active'));
    const pane = document.getElementById('pane-' + id);
    if (pane) pane.classList.add('active');
    btn.classList.add('active');
    const key = 'project-' + id;
    if (!rendered.has(key) && PROJ_RENDER[id]) {
      setTimeout(() => {
        PROJ_RENDER[id]();
        rendered.add(key);
        resizeAllCharts();
      }, 30);
    }
  };
  const onUploadTab = (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const id = btn.dataset.utab;
    document.querySelectorAll('#view-upload .pane').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('#uploadTabBar .tab').forEach((b) => b.classList.remove('active'));
    const up = document.getElementById('upane-' + id);
    if (up) up.classList.add('active');
    btn.classList.add('active');
    if (!rendered.has('upload-' + id)) {
      renderUploadPane(id);
      rendered.add('upload-' + id);
    }
  };
  const onCatFilter = function () {
    const v = this.value;
    document.querySelectorAll('#active-body tr').forEach((r) => {
      r.style.opacity = v === 'all' || r.dataset.cat === v ? '1' : '0.2';
    });
  };
  const onWinBtns = (e) => {
    const btn = e.target.closest('.win-btn');
    if (!btn) return;
    document.querySelectorAll('.win-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderUpcomingActivities(parseInt(btn.dataset.days, 10));
  };

  const ptEl = document.getElementById('projTabBar');
  const utEl = document.getElementById('uploadTabBar');
  const cfEl = document.getElementById('catFilter');
  const wbEl = document.getElementById('win-btns');
  if (ptEl) ptEl.addEventListener('click', onProjTab);
  if (utEl) utEl.addEventListener('click', onUploadTab);
  if (cfEl) cfEl.addEventListener('change', onCatFilter);
  if (wbEl) wbEl.addEventListener('click', onWinBtns);

  let winResizeT = null;
  const onWinResize = () => {
    clearTimeout(winResizeT);
    winResizeT = setTimeout(() => resizeAllCharts(), 160);
  };
  window.addEventListener('resize', onWinResize);

  tryRestorePersistedImport();
  syncTreeSelectors();
  applyTreeSelectionToDashboard();
  initDashboardLibraryPanel();
  renderPortfolio();
  rendered.add('portfolio');
  renderUploadPane('task');
  rendered.add('upload-task');

  return () => {
    if (ptEl) ptEl.removeEventListener('click', onProjTab);
    if (utEl) utEl.removeEventListener('click', onUploadTab);
    if (cfEl) cfEl.removeEventListener('change', onCatFilter);
    if (wbEl) wbEl.removeEventListener('click', onWinBtns);
    window.removeEventListener('resize', onWinResize);
    Object.keys(R).forEach((k) => {
      try {
        R[k].destroy();
      } catch {
        /* ignore */
      }
      delete R[k];
    });
    delete window.showView;
    delete window.onProjChange;
    delete window.onBuildingChange;
    delete window.onTreeProjectChange;
    delete window.onTreePhaseChange;
    delete window.onTreeBuildingChange;
    delete window.addProjectTreeNode;
    delete window.editProjectTreeNode;
    delete window.deleteProjectTreeNode;
    delete window.exportCSV;
    delete window.downloadTemplate;
    delete window.downloadWorkTreeTemplate;
    delete window.drillProject;
    delete window.toggleCat;
    rendered.clear();
  };
}