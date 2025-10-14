const input = document.getElementById('inputNumero');
const btnAgregar = document.getElementById('btnAgregar');
const btnLimpiar = document.getElementById('btnLimpiar');
const grid = document.getElementById('grid');
const countSalida = document.getElementById('countSalida');
const countLlegada = document.getElementById('countLlegada');
const countAbandonos = document.getElementById('countAbandonos');

const btnAudit = document.getElementById('btnAudit');
const btnAuditClose = document.getElementById('btnAuditClose');
const btnAuditRefresh = document.getElementById('btnAuditRefresh');
const btnAuditCSV = document.getElementById('btnAuditCSV');
const btnStatesCSV = document.getElementById('btnStatesCSV');

const auditPanel = document.getElementById('auditPanel');
const auditList = document.getElementById('auditList');
const auditTramo = document.getElementById('auditTramo');
const auditOperador = document.getElementById('auditOperador');

const btnOperador = document.getElementById('btnOperador');
const btnTramo   = document.getElementById('btnTramo');
const tramoMenu  = document.getElementById('tramoMenu');
const tramoInput = document.getElementById('tramoInput');
const tramoGo    = document.getElementById('tramoGo');
const tramoRecent= document.getElementById('tramoRecent');

function getOperator(){ try { return localStorage.getItem('seced_operator') || ''; } catch { return ''; } }
function setOperator(name){ try { localStorage.setItem('seced_operator', name || ''); } catch {} updateAuditMeta(); }
window.OPERATOR = getOperator();

let items = [];
window._getItems = () => items;
window._onRemoteUpdate = (remoteItems) => { items = Array.isArray(remoteItems) ? remoteItems : []; render(); };

window.MODE = 'LLEGADA';
function applyModeUI(){
  const bJ = document.getElementById('btnModeJefe');
  const bS = document.getElementById('btnModeSalida');
  const bL = document.getElementById('btnModeLlegada');
  if (bJ && bS && bL) {
    bJ.classList.toggle('active', window.MODE === 'JEFE');
    bS.classList.toggle('active', window.MODE === 'SALIDA');
    bL.classList.toggle('active', window.MODE === 'LLEGADA');
  }
  const disableInput = (window.MODE === 'LLEGADA');
  if (input) input.disabled = disableInput;
  if (btnAgregar) btnAgregar.disabled = disableInput;
}
(function initModeButtons(){
  const bJ = document.getElementById('btnModeJefe');
  const bS = document.getElementById('btnModeSalida');
  const bL = document.getElementById('btnModeLlegada');
  if (bJ) bJ.addEventListener('click', ()=>{ window.MODE = 'JEFE'; applyModeUI(); });
  if (bS) bS.addEventListener('click', ()=>{ window.MODE = 'SALIDA'; applyModeUI(); });
  if (bL) bL.addEventListener('click', ()=>{ window.MODE = 'LLEGADA'; applyModeUI(); });
  applyModeUI();
})();

const TIMEZONE = 'Europe/Madrid';
const clockTime = document.getElementById('clockTime'); const clockTz = document.getElementById('clockTz'); const clockSync = document.getElementById('clockSync');
if (clockTz) clockTz.textContent = TIMEZONE;
let timeOffsetMs = 0, tickTimer = null, resyncTimer = null;
const VIEWER = new URLSearchParams(window.location.search).has('viewer'); window.VIEWER = VIEWER; if (VIEWER) document.body.classList.add('viewer');
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); }
function renderClock(nowMs) { const d = new Date(nowMs + timeOffsetMs); if (clockTime) clockTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
async function syncTime() { try { if (clockSync) { clockSync.textContent = 'sincronizando…'; clockSync.className = 'sync'; } const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(TIMEZONE)}`, { cache: 'no-store' }); if (!res.ok) throw new Error('HTTP ' + res.status); const data = await res.json(); const apiMs = Date.parse(data.datetime); const localMs = Date.now(); timeOffsetMs = apiMs - localMs; if (clockSync) { clockSync.textContent = 'ok'; clockSync.className = 'sync ok'; } } catch (err) { if (clockSync) { clockSync.textContent = 'sin conexión'; clockSync.className = 'sync err'; } } }
function startClock() { if (tickTimer) clearInterval(tickTimer); tickTimer = setInterval(() => renderClock(Date.now()), 1000); renderClock(Date.now()); if (resyncTimer) clearInterval(resyncTimer); resyncTimer = setInterval(syncTime, 5*60*1000); }
syncTime().then(startClock);

function nowNetMs() { return Date.now() + (typeof timeOffsetMs !== 'undefined' ? timeOffsetMs : 0); }
function existsValue(val) { return items.some(x => x.value === val); }

function logAudit(action, detail){
  try { const entry = { tramo:(window.TRAMO_ID||'').toString(), actor:(window.OPERATOR||'').toString()||'—', action, detail:detail||{}, clientTime:new Date(nowNetMs()).toISOString() }; if (typeof auditSave === 'function') auditSave(entry); } catch (e) { console.warn('Audit log error:', e); }
}
let auditUnlocked = false;
function askAudit(){ const key = prompt('Introduce la clave de auditoría:'); if (key === null) return false; if (key === (window.AUDIT_KEY||'')) { auditUnlocked = true; return true; } alert('Clave incorrecta.'); return false; }
function updateAuditMeta(){ if (auditTramo) auditTramo.textContent = (window.TRAMO_ID||'—'); if (auditOperador) auditOperador.textContent = (window.OPERATOR||'—') || '—'; }
async function openAudit(){ if (!auditUnlocked && !askAudit()) return; updateAuditMeta(); if (auditPanel) auditPanel.classList.remove('hidden'); await refreshAudit(); }
function closeAudit(){ if (auditPanel) auditPanel.classList.add('hidden'); }
async function refreshAudit(){
  try{
    if (!auditList) return;
    auditList.innerHTML = '<div style="opacity:.8">Cargando…</div>';
    const rows = await (typeof auditFetch === 'function' ? auditFetch() : Promise.resolve([]));
    auditList.innerHTML = '';
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'audit-row';
      const ts = document.createElement('div'); ts.className='a-ts'; ts.textContent = r.ts || r.clientTime || '—';
      const actor = document.createElement('div'); actor.className='a-actor'; actor.textContent = r.actor || '—';
      const act = document.createElement('div'); act.className='a-act'; act.textContent = r.action || '—';
      const det = document.createElement('div'); det.className='a-det'; det.textContent = JSON.stringify(r.detail||{});
      row.appendChild(ts); row.appendChild(actor); row.appendChild(act); row.appendChild(det);
      auditList.appendChild(row);
    }
    if (rows.length === 0) { auditList.innerHTML = '<div style="opacity:.8">Sin registros aún.</div>'; }
  }catch(e){
    auditList.innerHTML = '<div style="color:#fca5a5">Error cargando auditoría.</div>';
    console.error(e);
  }
}
function auditCSV(){
  (async ()=>{
    const rows = await (typeof auditFetch === 'function' ? auditFetch() : Promise.resolve([]));
    const headers = ['ts','actor','action','detail_json'];
    const lines = [headers.join(',')];
    for(const r of rows){
      const ts = (r.ts || r.clientTime || '').replace(/,/g,' ');
      const actor = (r.actor||'').replace(/,/g,' ');
      const action = (r.action||'').replace(/,/g,' ');
      const detail = JSON.stringify(r.detail||{}).replace(/"/g,'""');
      lines.push([ts, actor, action, `"${detail}"`].join(','));
    }
    const blob = new Blob([lines.join('\\n')], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria_${(window.TRAMO_ID||'tramo').toString()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  })();
}
function exportStatesCSV(){
  try{
    const arr = (typeof window._getItems==='function') ? window._getItems() : [];
    const headers = ['tramo','valor','status','rNumber','tSalida','tLlegadaActual','llegadasHist','tAbandono'];
    const lines = [headers.join(',')];
    for(const it of arr){
      const row = [
        (window.TRAMO_ID||'').toString().replace(/,/g,' '),
        it.value,
        it.status||'normal',
        (it.rNumber!=null? it.rNumber:''),
        (it.tSalida? new Date(it.tSalida).toISOString():''),
        (it.tLlegada? new Date(it.tLlegada).toISOString():''),
        (Array.isArray(it.llegadasHist)? it.llegadasHist.map(t=>new Date(t).toISOString()).join('|') : ''),
        (it.tAbandono? new Date(it.tAbandono).toISOString(): '')
      ];
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`estados_${(window.TRAMO_ID||'tramo')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(e){ console.error('exportStatesCSV error', e); alert('Error exportando estados.'); }
}

if (btnAudit) btnAudit.addEventListener('click', openAudit);
if (btnAuditClose) btnAuditClose.addEventListener('click', closeAudit);
if (btnAuditRefresh) btnAuditRefresh.addEventListener('click', refreshAudit);
if (btnAuditCSV) btnAuditCSV.addEventListener('click', auditCSV);
if (btnStatesCSV) btnStatesCSV.addEventListener('click', exportStatesCSV);
if (btnOperador) btnOperador.addEventListener('click', ()=>{
  const name = prompt('Nombre o identificador del operador:', window.OPERATOR||'');
  if (name !== null) { window.OPERATOR = (name||'').trim(); setOperator(window.OPERATOR); }
});

function render() {
  if (countSalida) countSalida.textContent = String(items.length);
  if (countLlegada) countLlegada.textContent = String(items.filter(x => x.status !== 'abandon' && x.selected).length);
  if (countAbandonos) countAbandonos.textContent = String(items.filter(x => x.status === 'abandon').length);

  grid.innerHTML = '';
  for (const item of items) {
    const cell = document.createElement('div');
    cell.className = 'cell';

    const card = document.createElement('div');
    card.className = 'card' + (item.status === 'abandon' ? ' abandon' : (item.selected ? ' selected' : ''));
    card.dataset.value = item.value;

    const numberSpan = document.createElement('div');
    numberSpan.textContent = item.value;
    card.appendChild(numberSpan);

    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn'; menuBtn.type = 'button'; menuBtn.textContent = '⋯'; menuBtn.title = 'Menú de opciones';
    if (!VIEWER) menuBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(card); });
    card.appendChild(menuBtn);

    const menu = document.createElement('div');
    menu.className = 'menu hidden';
    const optEdit = document.createElement('div'); optEdit.className = 'menu-item'; optEdit.textContent = 'Editar número';
    if (!VIEWER) optEdit.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.add('hidden'); editNumber(item.value); });
    const optAbandon = document.createElement('div'); optAbandon.className = 'menu-item'; optAbandon.textContent = 'Abandono…';
    if (!VIEWER) optAbandon.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.add('hidden'); setAbandon(item.value); });
    menu.appendChild(optEdit); menu.appendChild(optAbandon);
    card.appendChild(menu);

    if (item.status === 'abandon' && item.rNumber != null) {
      const badge = document.createElement('div');
      badge.className = 'badge-r';
      badge.textContent = 'R' + item.rNumber;
      card.appendChild(badge);
    }

    if (!VIEWER) card.addEventListener('click', () => {
      if (item.status === 'abandon') {
        item.status = 'normal'; item.rNumber = null; item.tAbandono = null; item.selected = false;
        render(); if (typeof syncSave === 'function') syncSave();
        logAudit('undo_abandono', { value:item.value });
        return;
      }
      if (window.MODE === 'SALIDA') return;
      if (!item.selected) {
        item.selected = true; if (!item.tLlegada) item.tLlegada = nowNetMs();
        render(); if (typeof syncSave === 'function') syncSave();
        logAudit('llegada', { value:item.value, tLlegada:item.tLlegada });
      } else {
        item.selected = false; const old = item.tLlegada;
        if (!Array.isArray(item.llegadasHist)) item.llegadasHist = [];
        if (old) item.llegadasHist.push(old);
        item.tLlegada = null;
        render(); if (typeof syncSave === 'function') syncSave();
        logAudit('undo_llegada', { value:item.value, tLlegada_prev:old, llegadasHist:item.llegadasHist });
      }
    });
    if (!VIEWER) document.addEventListener('click', (ev) => { if (!card.contains(ev.target)) menu.classList.add('hidden'); });

    cell.appendChild(card);

    const timeStack = document.createElement('div');
    timeStack.className = 'time-stack';

    if (item.tSalida) {
      const bS = document.createElement('div');
      bS.className = 'timebar-out time-salida';
      const lblS = document.createElement('span'); lblS.className = 'time-label'; lblS.textContent = 'S';
      const valS = document.createElement('span'); valS.className = 'time-value'; valS.textContent = fmtTime(item.tSalida);
      bS.appendChild(lblS); bS.appendChild(valS);
      timeStack.appendChild(bS);
    }

    if (item.tAbandono) {
      const bA = document.createElement('div');
      bA.className = 'timebar-out time-abandono';
      const lblA = document.createElement('span'); lblA.className = 'time-label'; lblA.textContent = 'A';
      const valA = document.createElement('span'); valA.className = 'time-value'; valA.textContent = fmtTime(item.tAbandono);
      bA.appendChild(lblA); bA.appendChild(valA);
      timeStack.appendChild(bA);
    } else if (item.tLlegada) {
      const bL = document.createElement('div');
      bL.className = 'timebar-out time-llegada';
      const lblL = document.createElement('span'); lblL.className = 'time-label'; lblL.textContent = 'LL';
      const valL = document.createElement('span'); valL.className = 'time-value'; valL.textContent = fmtTime(item.tLlegada);
      bL.appendChild(lblL); bL.appendChild(valL);
      timeStack.appendChild(bL);
    }

    cell.appendChild(timeStack);

    // Icono/tooltip historial dentro de la tarjeta (abajo-derecha)
    const histBtn2 = document.createElement('button');
    histBtn2.type='button'; histBtn2.className='hist-btn hidden'; histBtn2.title='Historial S/LL/A'; histBtn2.textContent='🕘';
    const tooltip2 = document.createElement('div'); tooltip2.className='tooltip hidden';
    const tt2 = document.createElement('div'); tt2.className='hist-list'; tooltip2.appendChild(tt2);

    tt2.innerHTML='';
    const secS2 = document.createElement('div'); secS2.className='section';
    const sTitle2 = document.createElement('div'); sTitle2.className='sec-title'; sTitle2.textContent='S (Salida)'; secS2.appendChild(sTitle2);
    if (item.tSalida){ const r=document.createElement('div'); r.className='row'; const tg=document.createElement('span'); tg.className='tag'; tg.textContent='S'; const v=document.createElement('span'); v.textContent=(new Date(item.tSalida)).toTimeString().slice(0,8); r.appendChild(tg); r.appendChild(v); secS2.appendChild(r);} else { const r=document.createElement('div'); r.className='hist-empty'; r.textContent='—'; secS2.appendChild(r); }
    const secLL2 = document.createElement('div'); secLL2.className='section'; const llTitle2 = document.createElement('div'); llTitle2.className='sec-title'; llTitle2.textContent='LL previas'; secLL2.appendChild(llTitle2);
    const histArr2 = Array.isArray(item.llegadasHist) ? item.llegadasHist.slice() : []; histArr2.sort((a,b)=>b-a);
    if (histArr2.length===0){ const r=document.createElement('div'); r.className='hist-empty'; r.textContent='Sin LL previas'; secLL2.appendChild(r);} else { let idx2=1; for (const t of histArr2){ const r=document.createElement('div'); r.className='row'; const tg=document.createElement('span'); tg.className='tag'; tg.textContent='LL-'+(idx2++); const v=document.createElement('span'); v.textContent=(new Date(t)).toTimeString().slice(0,8); r.appendChild(tg); r.appendChild(v); secLL2.appendChild(r); } }
    const secA2 = document.createElement('div'); secA2.className='section'; const aTitle2 = document.createElement('div'); aTitle2.className='sec-title'; aTitle2.textContent='A (Abandono)'; secA2.appendChild(aTitle2);
    if (item.tAbandono){ const r=document.createElement('div'); r.className='row'; const tg=document.createElement('span'); tg.className='tag'; tg.textContent='A'; const v=document.createElement('span'); v.textContent=(new Date(item.tAbandono)).toTimeString().slice(0,8); r.appendChild(tg); r.appendChild(v); secA2.appendChild(r);} else { const r=document.createElement('div'); r.className='hist-empty'; r.textContent='—'; secA2.appendChild(r); }

    tt2.appendChild(secS2); tt2.appendChild(secLL2); tt2.appendChild(secA2);
    if ((histArr2.length===0) && !item.tSalida && !item.tAbandono) { histBtn2.classList.add('hidden'); } else { histBtn2.classList.remove('hidden'); }

    histBtn2.onclick = (ev)=>{ ev.stopPropagation(); tooltip2.classList.toggle('hidden'); };
    document.addEventListener('click', (ev)=>{ if (!card.contains(ev.target)) tooltip2.classList.add('hidden'); }, { once:true });

    card.appendChild(histBtn2);
    card.appendChild(tooltip2);

    grid.appendChild(cell);
  }
}

function toggleMenu(card) {
  const menu = card.querySelector('.menu');
  const hidden = menu.classList.contains('hidden');
  grid.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  if (hidden) menu.classList.remove('hidden'); else menu.classList.add('hidden');
}

function addNumber() {
  if (window.MODE === 'LLEGADA') { alert('En modo LLEGADA no se pueden añadir números nuevos. Cambia a JEFE o SALIDA.'); return; }
  const raw = (input.value || '').trim().replace(',', '.');
  if (raw === '') return;
  const num = Number(raw);
  if (!Number.isFinite(num)) { alert('Por favor, ingresa un número válido.'); return; }
  if (existsValue(num)) { alert('Ese número ya existe y no se puede repetir.'); input.select(); return; }
  const tS = nowNetMs();
  items.push({ value: num, selected: false, status: 'normal', rNumber: null, tSalida: tS, tLlegada: null, tAbandono: null });
  render();
  if (typeof syncSave === 'function') syncSave();
  input.value = ''; input.focus();
  logAudit('alta', { value:num, tSalida:tS });
}

function editNumber(prevVal) {
  const idx = items.findIndex(x => x.value === prevVal);
  if (idx === -1) return;
  const raw = prompt('Nuevo número para reemplazar a ' + prevVal + ':', String(prevVal));
  if (raw === null) return;
  const newNum = Number((raw || '').trim().replace(',', '.'));
  if (!Number.isFinite(newNum)) { alert('Número no válido.'); return; }
  if (newNum === prevVal) return;
  if (existsValue(newNum)) { alert('No se puede cambiar: el número ' + newNum + ' ya existe.'); return; }
  items[idx].value = newNum;
  render();
  if (typeof syncSave === 'function') syncSave();
  logAudit('editar', { from: prevVal, to: newNum });
}

function setAbandon(val) {
  const idx = items.findIndex(x => x.value === val);
  if (idx === -1) return;
  const raw = prompt('Indica el número para R (aparecerá como R{n}):');
  if (raw === null) return;
  const r = Number((raw || '').trim());
  if (!Number.isInteger(r) || r < 0) { alert('Introduce un número entero válido (>= 0) para R.'); return; }
  const tA = nowNetMs();
  items[idx].status = 'abandon';
  items[idx].selected = false;
  items[idx].rNumber = r;
  items[idx].tAbandono = tA;
  render();
  if (typeof syncSave === 'function') syncSave();
  logAudit('abandono', { value: val, rNumber:r, tAbandono:tA });
}

if (btnAgregar) btnAgregar.addEventListener('click', addNumber);
if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addNumber(); });
if (btnLimpiar) btnLimpiar.addEventListener('click', () => {
  if (items.length === 0) return;
  if (confirm('¿Vaciar la lista de tarjetas?')) {
    items = []; render(); if (typeof syncSave === 'function') syncSave();
    logAudit('limpiar', {});
    input.focus();
  }
});

const btnExportar = document.getElementById('btnExportar');
const printTitle = document.getElementById('printTitle');
function exportarPDF() {
  const tramo = prompt('Nombre del tramo (se usará como título y nombre del archivo):', (window.TRAMO_ID||'SECeD-Control'));
  if (tramo === null) return;
  const name = (tramo || 'SECeD-Control').trim();
  printTitle.textContent = name;
  const app = document.querySelector('.app');
  const h1 = app.querySelector('h1');
  h1.insertAdjacentElement('afterend', printTitle);

  const srcCounters = document.querySelector('.counters');
  const printCounters = document.getElementById('printCounters');
  if (srcCounters && printCounters) { printCounters.innerHTML = ''; printCounters.appendChild(srcCounters.cloneNode(true)); }

  const prevTitle = document.title; document.title = name; window.print(); document.title = prevTitle;
}
if (btnExportar) btnExportar.addEventListener('click', exportarPDF);

const btnFullscreen = document.getElementById('btnFullscreen');
function isFullscreen() { return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement; }
async function enterFullscreen(el) { try { if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); else if (el.msRequestFullscreen) await el.msRequestFullscreen(); } catch (e) {} }
async function exitFullscreen() { try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) await document.webkitExitFullscreen(); else if (document.msExitFullscreen) await document.msExitFullscreen(); } catch (e) {} }
function updateFsButton() { if (!btnFullscreen) return; btnFullscreen.textContent = isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'; }
if (btnFullscreen) btnFullscreen.addEventListener('click', () => { if (isFullscreen()) exitFullscreen(); else enterFullscreen(document.documentElement); });
document.addEventListener('fullscreenchange', updateFsButton); document.addEventListener('webkitfullscreenchange', updateFsButton); document.addEventListener('msfullscreenchange', updateFsButton); updateFsButton();

function sanitizeTramo(t){ return (t||'').trim().toLowerCase().replace(/[^\w-]+/g,'-').slice(0,64); }
function getParams(){ return new URLSearchParams(location.search); }
function goToTramo(t){
  const tramo = sanitizeTramo(t);
  if(!tramo) return;
  try{
    const k='seced_tramos_recent'; const list=JSON.parse(localStorage.getItem(k)||'[]');
    const next=[tramo, ...list.filter(x=>x!==tramo)].slice(0,10);
    localStorage.setItem(k, JSON.stringify(next));
  }catch{}
  const p = getParams();
  p.set('tramo', tramo);
  location.search = p.toString();
}
function fillRecent(){
  if(!tramoRecent) return;
  tramoRecent.innerHTML = '';
  let list=[];
  try{ list = JSON.parse(localStorage.getItem('seced_tramos_recent')||'[]'); }catch{}
  const curr = (window.TRAMO_ID||'').toString();
  if(curr && !list.includes(curr)) list = [curr, ...list].slice(0,10);
  for(const t of list){
    const li=document.createElement('li');
    const b=document.createElement('button');
    b.type='button'; b.textContent=t || '—';
    b.addEventListener('click', ()=> goToTramo(t));
    li.appendChild(b); tramoRecent.appendChild(li);
  }
}
function toggleTramoMenu(){
  if(!tramoMenu) return;
  const hidden = tramoMenu.classList.contains('hidden');
  document.querySelectorAll('.tramo-menu').forEach(m=>m.classList.add('hidden'));
  if(hidden){ fillRecent(); tramoMenu.classList.remove('hidden'); tramoInput && tramoInput.focus(); }
  else { tramoMenu.classList.add('hidden'); }
}
if (btnTramo) btnTramo.addEventListener('click', (e)=>{ e.stopPropagation(); toggleTramoMenu(); });
if (tramoGo) tramoGo.addEventListener('click', ()=> goToTramo(tramoInput && tramoInput.value));
if (tramoInput) tramoInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') goToTramo(tramoInput.value); });

function setTramoBadge(name){
  const t = (name || window.TRAMO_ID || '').toString();
  if (typeof btnTramo !== 'undefined' && btnTramo) btnTramo.textContent = `TRAMO: ${t || '—'} ▾`;
}
setTramoBadge(window.TRAMO_ID);
