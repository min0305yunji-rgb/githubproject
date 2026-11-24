let allRows = [];
let filteredRows = [];
let activeKeyword = '';

const $ = (s) => document.querySelector(s);

function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') { if (quoted && n === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && n === '\n') i++; row.push(field.trim()); if (row.some(v => v)) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(v => v)) rows.push(row); }
  return rows;
}

function normalise(rows) {
  let headerIndex = rows.findIndex(r => r.some(v => /분류|구분|분야|활동명|명칭/.test(v)));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(v => v.trim());
  return rows.slice(headerIndex + 1).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = (r[i] || '').replace(/\n/g, ' ').trim());
    return {
      name: o['명칭'] || o['활동명'] || '',
      type: o['분류'] || o['구분'] || '',
      field: o['분야 (키워드)'] || o['분야'] || '',
      detail: o['상세 키워드'] || '',
      organizer: o['주최/주관'] || o['주최'] || '',
      benefit: o['주요 혜택 및 시상'] || '',
      date: o['접수 기간'] || '',
      link: o['링크'] || ''
    };
  }).filter(r => r.name);
}

async function loadDefaults() {
  const files = ['2020_2026_대학생_공모전_대외활동_통합DB.csv','2020_2026_대학생_공모전_대외활동_DB.csv','Linkareer_Activities_2025_2026.csv'];
  let combined = [];
  for (const file of files) {
    try { const res = await fetch(file); if (res.ok) combined = combined.concat(normalise(parseCSV(await res.text()))); } catch (_) {}
  }
  allRows = dedupe(combined);
  if (!allRows.length) allRows = demoData();
  initialize();
}

function dedupe(rows) { const seen = new Set(); return rows.filter(r => { const k = r.name + r.organizer; if (seen.has(k)) return false; seen.add(k); return true; }); }
function demoData(){return [{name:'데이터를 불러오는 중입니다',type:'-',field:'IT/AI/SW',detail:'AI, 데이터분석',organizer:'-'}];}

function splitKeywords(r) {
  return (r.detail || r.field || '').split(/[,/·]+/).map(v => v.trim()).filter(v => v && v !== '-');
}
function countItems(rows, getter) { const map = {}; rows.forEach(r => getter(r).forEach(v => { if(v) map[v]=(map[v]||0)+1; })); return Object.entries(map).sort((a,b)=>b[1]-a[1]); }

function initialize() {
  const types = [...new Set(allRows.map(r=>r.type).filter(Boolean))].sort();
  const fields = [...new Set(allRows.map(r=>r.field).filter(Boolean))].sort();
  $('#typeFilter').innerHTML = '<option value="">전체 유형</option>' + types.map(v=>`<option>${esc(v)}</option>`).join('');
  $('#fieldFilter').innerHTML = '<option value="">전체 분야</option>' + fields.map(v=>`<option>${esc(v)}</option>`).join('');
  applyFilters();
}

function applyFilters() {
  const q = ($('#searchInput').value || '').toLowerCase().trim();
  const type = $('#typeFilter').value;
  const field = $('#fieldFilter').value;
  filteredRows = allRows.filter(r => (!type || r.type === type) && (!field || r.field === field) && (!q || [r.name,r.field,r.detail,r.organizer].join(' ').toLowerCase().includes(q)) && (!activeKeyword || splitKeywords(r).includes(activeKeyword)));
  renderDashboard();
}

function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function renderDashboard() {
  const rows = filteredRows;
  const keywordCounts = countItems(rows, r => splitKeywords(r));
  const fieldCounts = countItems(rows, r => r.field ? [r.field] : []);
  const typeCounts = countItems(rows, r => r.type ? [r.type] : []);
  $('#totalCount').textContent = rows.length.toLocaleString();
  $('#keywordCount').textContent = new Set(rows.flatMap(splitKeywords)).size.toLocaleString();
  $('#fieldCount').textContent = fieldCounts.length.toLocaleString();
  $('#topKeyword').textContent = keywordCounts[0]?.[0] || '-';
  $('#topKeywordCount').textContent = keywordCounts[0] ? `${keywordCounts[0][1]}회 등장` : '0회 등장';
  $('#totalNote').textContent = '필터 적용 결과';
  drawKeywordChart(keywordCounts.slice(0,10));
  drawTypeChart(typeCounts);
  renderFieldBars(fieldCounts.slice(0,8));
  renderRecent(rows);
  renderTable(rows);
  renderKeywordCloud(keywordCounts);
}

function drawKeywordChart(items) {
  const canvas=$('#keywordChart'), ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1, w=canvas.clientWidth, h=230;
  canvas.width=w*dpr; canvas.height=h*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  if(!items.length)return;
  const max=items[0][1], left=86, top=10, chartW=w-left-20, chartH=205, rowH=chartH/items.length;
  ctx.font='11px Segoe UI';
  items.forEach((item,i)=>{const y=top+i*rowH+rowH*.25;ctx.textAlign='right';ctx.fillStyle='#777d90';ctx.fillText(item[0].length>8?item[0].slice(0,8)+'…':item[0],left-10,y+9);ctx.fillStyle='#f1f2f6';ctx.beginPath();ctx.roundRect(left,y,chartW,11,6);ctx.fill();ctx.fillStyle='#7770d7';ctx.beginPath();ctx.roundRect(left,y,Math.max(3,chartW*item[1]/max),11,6);ctx.fill();ctx.textAlign='left';ctx.fillStyle='#9ba0af';ctx.fillText(item[1],left+chartW*item[1]/max+7,y+9);});
}

function drawTypeChart(items) {
  const canvas=$('#typeChart'),ctx=canvas.getContext('2d'),dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=230;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  if(!items.length)return;
  const cx=w/2,cy=105,r=66,total=items.reduce((s,x)=>s+x[1],0),colors=['#7770d7','#65a4dd','#efb66d','#64b69b','#da8aa6','#9d96ac'];
  let start=-Math.PI/2;items.slice(0,6).forEach((x,i)=>{const end=start+(x[1]/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();start=end;});
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy,r*.58,0,Math.PI*2);ctx.fill();ctx.fillStyle='#25283b';ctx.textAlign='center';ctx.font='bold 20px Segoe UI';ctx.fillText(total,cx,cy+2);ctx.fillStyle='#999dac';ctx.font='10px Segoe UI';ctx.fillText('전체 활동',cx,cy+18);
  $('#typeLegend').innerHTML=items.slice(0,6).map((x,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${esc(x[0])} ${x[1]}</div>`).join('');
}

function renderFieldBars(items){const max=items[0]?.[1]||1;$('#fieldBars').innerHTML=items.map(([name,count])=>`<div class="field-row"><span title="${esc(name)}">${esc(name.length>13?name.slice(0,13)+'…':name)}</span><div class="field-track"><div class="field-fill" style="width:${count/max*100}%"></div></div><strong>${count}</strong></div>`).join('')||'<p class="eyebrow">데이터가 없습니다</p>';}

function renderRecent(rows){$('#recentList').innerHTML=(rows.slice(-5).reverse()).map((r,i)=>`<div class="recent-item"><span class="rank">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(r.name)}</strong><span>${esc(r.type||'활동')} · ${esc(r.field||'분야 미분류')}</span></div></div>`).join('')||'<p class="eyebrow">데이터가 없습니다</p>';}

function renderTable(rows){$('#resultCount').textContent=`${rows.length}건`;$('#activityTable').innerHTML=rows.slice(0,100).map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td>${esc(r.field)}</td><td>${esc(r.organizer)}</td><td>${splitKeywords(r).slice(0,4).map(k=>`<span class="tag">${esc(k)}</span>`).join('')}</td></tr>`).join('')||'<tr><td colspan="5">검색 결과가 없습니다</td></tr>';}

function renderKeywordCloud(items){const limit=items.filter(x=>x[0].length>1).slice(0,40);$('#keywordCloud').innerHTML=limit.map(([k,c])=>{const size=Math.min(22,12+c*.8);return `<button class="keyword-chip" data-keyword="${esc(k)}" style="font-size:${size}px">${esc(k)} <small>${c}</small></button>`}).join('')||'<p class="eyebrow">키워드가 없습니다</p>';}

$('#searchInput').addEventListener('input',applyFilters);$('#typeFilter').addEventListener('change',applyFilters);$('#fieldFilter').addEventListener('change',applyFilters);
$('#keywordSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.keyword-chip').forEach(el=>el.style.display=el.dataset.keyword.toLowerCase().includes(q)?'':'none');});
$('#keywordCloud').addEventListener('click',e=>{const chip=e.target.closest('.keyword-chip');if(!chip)return;activeKeyword=activeKeyword===chip.dataset.keyword?'':chip.dataset.keyword;document.querySelectorAll('.keyword-chip').forEach(c=>c.style.opacity=c.dataset.keyword===activeKeyword?'1':'.55');applyFilters();switchView('activities');});

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
function switchView(view){document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const target={overview:'overviewView',keywords:'keywordsView',activities:'activitiesView'}[view];$('#'+target).classList.add('active');$('#pageTitle').textContent={overview:'대시보드',keywords:'키워드 분석',activities:'활동 탐색'}[view];}

$('#csvUpload').addEventListener('change',async e=>{const files=[...e.target.files];let rows=[];for(const file of files){rows=rows.concat(normalise(parseCSV(await file.text())));}if(rows.length){allRows=dedupe(rows);activeKeyword='';initialize();switchView('overview');}});
window.addEventListener('resize',()=>renderDashboard());
loadDefaults();
