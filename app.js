// ====== Referencias de UI ======
const input = document.getElementById('inputNumero');
const btnAgregar = document.getElementById('btnAgregar');
const btnLimpiar = document.getElementById('btnLimpiar');
const btnResetRadios = document.getElementById('btnResetRadios');
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

// ====== Utilidad Firestore para limpiar doc de radios de un dorsal ======
async function clearRadioDocFor(value){
  try{
    if (!window.firebase || !firebase.firestore) return;
    const tramo = (window.TRAMO_ID || '1').toString();
    const db = firebase.firestore();
    await db.collection('tramos').doc(tramo)
      .collection('radios').doc(String(value))
      .delete();
  }catch(e){
    // si no existe, no pasa nada
  }
}

// ====== Operador (localStorage) ======
function getOperator(){ try { return localStorage.getItem('seced_operator') || ''; } catch { return ''; } }
function setOperator(name){ try { localStorage.setItem('seced_operator', name || ''); } catch {} updateAuditMeta(); }
window.OPERATOR = getOperator();

// ====== Estado principal de items ======
let items = [];
window._getItems = () => items;
// app.js recibe los items remotos (sync.js) y re-renderiza
window._onRemoteUpdate = (remoteItems) => { items = Array.isArray(remoteItems) ? remoteItems : []; render(); };

// ====== Modo (JEFE/SALIDA/LLEGADA) ======
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

  // Mostrar el botón Reset solo en JEFE
  if (btnResetRadios) {
    btnResetRadios.style.display = (window.MODE === 'JEFE') ? '' : 'none';
  }
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

// ====== Reloj de red ======
const TIMEZONE = 'Europe/Madrid';
const clockTime = document.getElementById('clockTime');
const clockTz   = document.getElementById('clockTz');
const clockSync = document.getElementById('clockSync');
if (clockTz) clockTz.textContent = TIMEZONE;
let timeOffsetMs = 0, tickTimer = null, resyncTimer = null;

// VISOR: respeta window.VIEWER (si viene de viewer.html) o ?viewer
const urlViewerFlag = new URLSearchParams(location.search).has('viewer');
window.VIEWER = (typeof window.VIEWER !== 'undefined') ? !!window.VIEWER : urlViewerFlag;
if (window.VIEWER) document.body.classList.add('viewer');

function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); }
function renderClock(nowMs) { const d = new Date(nowMs + timeOffsetMs); if (clockTime) clockTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
async function syncTime() {
  try {
    if (clockSync) { clockSync.textContent = 'sincronizando…'; clockSync.className = 'sync'; }
    const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(TIMEZONE)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const apiMs = Date.parse(data.datetime);
    const localMs = Date.now();
    timeOffsetMs = apiMs - localMs;
    if (clockSync) { clockSync.textContent = 'ok'; clockSync.className = 'sync ok'; }
  } catch (err) {
    if (clockSync) { clockSync.textContent = 'sin conexión'; clockSync.className = 'sync err'; }
  }
}
function startClock() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => renderClock(Date.now()), 1000);
  renderClock(Date.now());
  if (resyncTimer) clearInterval(resyncTimer);
  resyncTimer = setInterval(syncTime, 5*60*1000);
}
syncTime().then(startClock);

function nowNetMs() { return Date.now() + (typeof timeOffsetMs !== 'undefined' ? timeOffsetMs : 0); }
function existsValue(val) { return items.some(x => x.value === val); }

// ====== Auditoría (UI + helpers) ======
function logAudit(action, detail){
  try {
    const entry = {
      tramo:(window.TRAMO_ID||'').toString(),
      actor:(window.OPERATOR||'').toString()||'—',
      action,
      detail:detail||{},
      clientTime:new Date(nowNetMs()).toISOString()
    };
    if (typeof auditSave === 'function') auditSave(entry);
  } catch (e) {
    console.warn('Audit log error:', e);
  }
}
let auditUnlocked = false;
function askAudit(){
  const key = prompt('Introduce la clave de auditoría:');
  if (key === null) return false;
  if (key === (window.AUDIT_KEY||'')) { auditUnlocked = true; return true; }
  alert('Clave incorrecta.');
  return false;
}
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
    const blob = new Blob([lines.join('\n')], {type: 'text/csv'});
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
    const headers = ['tramo','valor','status','rNumber','tSalidaActual','salidasHist','tLlegadaActual','llegadasHist','tAbandono'];
    const lines = [headers.join(',')];
    for(const it of arr){
      const row = [
        (window.TRAMO_ID||'').toString().replace(/,/g,' '),
        it.value,
        it.status||'normal',
        (it.rNumber!=null? it.rNumber:''),
        (it.tSalida? new Date(it.tSalida).toISOString():''),
        (Array.isArray(it.salidasHist)? it.salidasHist.map(t=>new Date(t).toISOString()).join('|') : ''),
        (it.tLlegada? new Date(it.tLlegada).toISOString():''),
        (Array.isArray(it.llegadasHist)? it.llegadasHist.map(t=>new Date(t).toISOString()).join('|') : ''),
        (it.tAbandono? new Date(it.tAbandono).toISOString(): '')
      ];
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv'});
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

// ====== MARCAS DE RADIOS (bolitas R:n) ======
window._radioMarks = new Map(); // key: String(dorsal) -> Array<number>

// Solo escucha Firestore y actualiza _radioMarks. El render decide si mostrarlas.
(function subscribeRadioMarks(){
  try{
    const tramo = (window.TRAMO_ID || '1').toString();
    const db = firebase.firestore();
    db.collection('tramos').doc(tramo).collection('radios')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          const id = ch.doc.id;
          const data = ch.doc.data() || {};
          const arr = Array.isArray(data.marks) ? data.marks.slice() : [];
          if (ch.type === 'removed') {
            window._radioMarks.delete(id);
          } else {
            const clean = arr
              .map(x => parseInt(x,10))
              .filter(n => Number.isFinite(n) && n>0)
              .sort((a,b)=>a-b);
            window._radioMarks.set(id, clean);
          }
        });
        // re-pinta para que salgan (o desaparezcan) las bolitas según el modo
        if (typeof render === 'function') render();
      }, err => console.warn('radio marks listener error', err));
  }catch(e){
    console.warn('radio marks subscribe error', e);
  }
})();

// ====== Render principal ======
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

    const optEditSalida = document.createElement('div');
    optEditSalida.className = 'menu-item';
    optEditSalida.textContent = 'Editar salida…';
    if (!VIEWER) optEditSalida.addEventListener('click', (e) => {
      e.stopPropagation(); menu.classList.add('hidden'); editSalida(item.value);
    });
    menu.appendChild(optEditSalida);

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

    // ---- Bolitas de radios (mini, sin texto) — SOLO en editor/visor, NO en panel radio ----
    if (!document.body.classList.contains('radio-skin')) {
      const dots = document.createElement('div');
      dots.className = 'radio-dots';

      const m = window._radioMarks && window._radioMarks.get(String(item.value));
      if (Array.isArray(m) && m.length > 0) {
        for (const r of m) {
          const dot = document.createElement('span');
          dot.className = 'radio-dot';
          dot.title = `R:${r}`;
          dot.setAttribute('aria-label', `R${r}`);
          dots.appendChild(dot);
        }
      }
      cell.appendChild(dots);
    }
    // ---- /bolitas ----

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

    const secSPrev = document.createElement('div');
    secSPrev.className = 'section';
    const sPrevTitle = document.createElement('div');
    sPrevTitle.className = 'sec-title';
    sPrevTitle.textContent = 'S previas';
    secSPrev.appendChild(sPrevTitle);

    const sHistArr = Array.isArray(item.salidasHist) ? item.salidasHist.slice() : [];
    sHistArr.sort((a,b)=> b-a);
    if (sHistArr.length === 0){
      const r = document.createElement('div'); r.className = 'hist-empty'; r.textContent = 'Sin S previas';
      secSPrev.appendChild(r);
    } else {
      let idxS = 1;
      for (const t of sHistArr){
        const r = document.createElement('div'); r.className='row';
        const tg = document.createElement('span'); tg.className='tag'; tg.textContent='S-'+(idxS++);
        const v = document.createElement('span'); v.textContent=(new Date(t)).toTimeString().slice(0,8);
        r.appendChild(tg); r.appendChild(v); secSPrev.appendChild(r);
      }
    }

    const secS2 = document.createElement('div'); secS2.className='section';
    const sTitle2 = document.createElement('div'); sTitle2.className='sec-title'; sTitle2.textContent='S (Salida)'; secS2.appendChild(sTitle2);
    if (item.tSalida){
      const r=document.createElement('div'); r.className='row';
      const tg=document.createElement('span'); tg.className='tag'; tg.textContent='S';
      const v=document.createElement('span'); v.textContent=(new Date(item.tSalida)).toTimeString().slice(0,8);
      r.appendChild(tg); r.appendChild(v); secS2.appendChild(r);
    } else {
      const r=document.createElement('div'); r.className='hist-empty'; r.textContent='—'; secS2.appendChild(r);
    }

    const secLL2 = document.createElement('div'); secLL2.className='section';
    const llTitle2 = document.createElement('div'); llTitle2.className='sec-title'; llTitle2.textContent='LL previas';
    secLL2.appendChild(llTitle2);
    const histArr2 = Array.isArray(item.llegadasHist) ? item.llegadasHist.slice() : [];
    histArr2.sort((a,b)=>b-a);
    if (histArr2.length===0){
      const r=document.createElement('div'); r.className='hist-empty'; r.textContent='Sin LL previas';
      secLL2.appendChild(r);
    } else {
      let idx2=1;
      for (const t of histArr2){
        const r=document.createElement('div'); r.className='row';
        const tg=document.createElement('span'); tg.className='tag'; tg.textContent='LL-'+(idx2++);
        const v=document.createElement('span'); v.textContent=(new Date(t)).toTimeString().slice(0,8);
        r.appendChild(tg); r.appendChild(v); secLL2.appendChild(r);
      }
    }

    const secA2 = document.createElement('div'); secA2.className='section';
    const aTitle2 = document.createElement('div'); aTitle2.className='sec-title'; aTitle2.textContent='A (Abandono)';
    secA2.appendChild(aTitle2);
    if (item.tAbandono){
      const r=document.createElement('div'); r.className='row';
      const tg=document.createElement('span'); tg.className='tag'; tg.textContent='A';
      const v=document.createElement('span'); v.textContent=(new Date(item.tAbandono)).toTimeString().slice(0,8);
      r.appendChild(tg); r.appendChild(v); secA2.appendChild(r);
    } else {
      const r=document.createElement('div'); r.className='hist-empty'; r.textContent='—'; secA2.appendChild(r);
    }

    tt2.appendChild(secSPrev);
    tt2.appendChild(secS2);
    tt2.appendChild(secLL2);
    tt2.appendChild(secA2);

    if ((histArr2.length===0) && !item.tSalida && !item.tAbandono) {
      histBtn2.classList.add('hidden');
    } else {
      histBtn2.classList.remove('hidden');
    }

    histBtn2.onclick = (ev)=>{ ev.stopPropagation(); tooltip2.classList.toggle('hidden'); };
    document.addEventListener('click', (ev)=>{ if (!card.contains(ev.target)) tooltip2.classList.add('hidden'); }, { once:true });

    card.appendChild(histBtn2);
    card.appendChild(tooltip2);

    grid.appendChild(cell);
  }
}

// ====== Menú contextual ======
function toggleMenu(card) {
  const menu = card.querySelector('.menu');
  const hidden = menu.classList.contains('hidden');
  grid.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  if (hidden) menu.classList.remove('hidden'); else menu.classList.add('hidden');
}

// ====== Alta / Edición / Abandono / Editar Salida ======
async function addNumber() {
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

  // Espera a que se borre el doc de radios para este dorsal (evita “amarillo fantasma”)
  await clearRadioDocFor(num);

  input.value = ''; input.focus();
  logAudit('alta', { value:num, tSalida:tS });
}

async function editNumber(prevVal) {
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

  // Limpia historiales de radios del dorsal viejo y del nuevo
  await clearRadioDocFor(prevVal);
  await clearRadioDocFor(newNum);

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

async function editSalida(val){
  const idx = items.findIndex(x => x.value === val);
  if (idx === -1) return;

  const prev = items[idx].tSalida || null;
  const raw = prompt(
    'Nueva hora de SALIDA (puedes escribir HH, HHMM, HHMMSS o HH:MM(:SS)).\nDeja vacío para hora actual:',
    ''
  );
  if (raw === null) return;

  let newT;
  const parsed = parseFlexibleTimeToToday(raw);
  if (parsed === null) {
    alert('Formato inválido. Usa HH, HHMM, HHMMSS o HH:MM(:SS)');
    return;
  }
  newT = (parsed === '') ? nowNetMs() : parsed;

  if (prev){
    if (!Array.isArray(items[idx].salidasHist)) items[idx].salidasHist = [];
    items[idx].salidasHist.push(prev);
  }

  items[idx].tSalida = newT;

  render();
  if (typeof syncSave === 'function') syncSave();

  // Al rearmar salida, reinicia el paso por radios de ese dorsal
  await clearRadioDocFor(val);

  logAudit('editar_salida', { value: val, tSalida_prev: prev, tSalida_new: newT, salidasHist: items[idx].salidasHist||[] });
}



// ====== Botones básicos ======
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

// ==== Reset subcolección radios (tramos/{TRAMO}/radios) + marcador global ====
async function resetRadiosForTramo(tramoId){
  if (!window.firebase || !firebase.firestore) {
    alert('Firebase no está disponible en esta página.');
    return;
  }
  const tramo = (tramoId || window.TRAMO_ID || '').toString().trim();
  if (!tramo) { alert('Tramo no determinado.'); return; }

  if (!confirm(`Vas a borrar TODOS los clics de radios del tramo "${tramo}".\n\nEsto NO borra las tarjetas ni tiempos.\n\n¿Continuar?`)) return;
  const key = prompt('Introduce la clave de seguridad para Reset dorsales:');
  if (key === null) return;
  if (key !== '1234') { alert('Clave incorrecta. Operación cancelada.'); return; }

  const db = firebase.firestore();
  const colRef = db.collection('tramos').doc(tramo).collection('radios');

  try {
    // 1) Borrado por lotes de la subcolección
    let snap = await colRef.get();
    let total = 0;
    while (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      total += snap.size;
      snap = await colRef.get();
    }

    // 2) Publicar marcador global en /tramos/{tramo}
    await db.collection('tramos').doc(tramo).set({
      radiosResetAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Auditoría
    try { logAudit('reset_radios', { tramo, total_borrado: total }); } catch {}

    alert(`OK: clics de radios reiniciados en "${tramo}" (${total} docs borrados).`);
  } catch (e) {
    console.error('Error al resetear radios:', e);
    alert('Error al borrar la subcolección de radios. Revisa permisos/Reglas Firestore.');
  }
}
if (btnResetRadios) {
  btnResetRadios.addEventListener('click', () => resetRadiosForTramo(window.TRAMO_ID));
}

// ====== Exportar PDF ======
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

// ====== Pantalla completa ======
const btnFullscreen = document.getElementById('btnFullscreen');
function isFullscreen() { return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement; }
async function enterFullscreen(el) { try { if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); else if (el.msRequestFullscreen) await el.msRequestFullscreen(); } catch (e) {} }
async function exitFullscreen() { try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) await document.webkitExitFullscreen(); else if (document.msExitFullscreen) await document.msExitFullscreen(); } catch (e) {} }
function updateFsButton() { if (!btnFullscreen) return; btnFullscreen.textContent = isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'; }
if (btnFullscreen) btnFullscreen.addEventListener('click', () => { if (isFullscreen()) exitFullscreen(); else enterFullscreen(document.documentElement); });
document.addEventListener('fullscreenchange', updateFsButton);
document.addEventListener('webkitfullscreenchange', updateFsButton);
document.addEventListener('msfullscreenchange', updateFsButton);
updateFsButton();

// ====== Cambios de tramo (UI) ======
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
function parseHHMMSSToToday(str){
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((str||'').trim());
  if(!m) return null;
  const h = Number(m[1]), mi = Number(m[2]), s = Number(m[3]||'0');
  if (h<0||h>23||mi<0||mi>59||s<0||s>59) return null;
  const base = new Date(nowNetMs());
  base.setHours(h, mi, s, 0);
  return base.getTime();
}
// --- Entrada flexible de hora: "HH", "HHMM", "HHMMSS" o "HH:MM(:SS)" ---
function normalizeTimeDigitsOrColon(str){
  const s = (str || '').trim();
  if (!s) return '';                 // vacío = usar hora actual (lo maneja editSalida)
  if (s.includes(':')) {
    // Acepta HH:MM o HH:MM:SS
    const parts = s.split(':').map(x => x.trim());
    if (parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
    if (parts.length === 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
    return null; // formato raro
  }

  // Solo dígitos → HH | HHMM | HHMMSS
  let d = s.replace(/\D/g, '');
  if (d.length === 0) return '';
  if (d.length > 6) d = d.slice(0, 6); // capar a 6 dígitos

  let hh='00', mm='00', ss='00';
  if (d.length <= 2) {
    hh = d.padStart(2,'0');
  } else if (d.length <= 4) {
    hh = d.slice(0, d.length - 2).padStart(2,'0');
    mm = d.slice(-2);
  } else { // 5 o 6 dígitos
    hh = d.slice(0, d.length - 4).padStart(2,'0');
    mm = d.slice(-4, -2);
    ss = d.slice(-2);
  }

  const H = Number(hh), M = Number(mm), S = Number(ss);
  if (H < 0 || H > 23 || M < 0 || M > 59 || S < 0 || S > 59) return null;

  return `${hh}:${mm}:${ss}`;
}

function parseFlexibleTimeToToday(str){
  const norm = normalizeTimeDigitsOrColon(str);
  if (norm === null) return null;   // inválido
  if (norm === '') return '';       // vacío → usar “ahora”
  return parseHHMMSSToToday(norm);  // reutiliza tu parser existente
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

// ====== AVISO de Panel Radio -> Editor (JEFE) (versión robusta) ======

// 1) Resolver el radio “seleccionado” leyendo el DOM del Panel Radio
function resolveSelectedRadioFromUI() {
  const checked = document.querySelector('[name="radio"]:checked');
  if (checked && checked.value) return String(checked.value).trim();

  const activeBtn = document.querySelector('.radio-option.active,[data-radio-selected="true"]');
  if (activeBtn) {
    const v = activeBtn.getAttribute('data-radio-id')
      || activeBtn.getAttribute('data-radio')
      || activeBtn.textContent;
    if (v) return String(v).trim();
  }

  const byIdText = document.getElementById('radioActual');
  if (byIdText && byIdText.textContent) return String(byIdText.textContent).trim();

  const bodyAttr = document.body.getAttribute('data-radio');
  if (bodyAttr) return String(bodyAttr).trim();

  return null;
}

// 2) Fuente de verdad del radio: DOM en vivo -> window.RADIO_ID -> ?radio= -> localStorage
function getRadioId() {
  try {
    const inDom = resolveSelectedRadioFromUI();
    if (inDom) return inDom;

    if (window.RADIO_ID) return String(window.RADIO_ID);

    const qp = new URLSearchParams(location.search).get('radio');
    if (qp) return String(qp).trim();

    const saved = localStorage.getItem('seced_radio_id');
    if (saved) return String(saved).trim();
  } catch {}
  return ''; // vacío => no enviar
}

// 3) Mantener sincronizado window.RADIO_ID y localStorage cuando cambie el radio en Panel Radio
(function bindRadioSelectionTracking(){
  if (!document.body.classList.contains('radio-skin')) return; // solo en el perfil Panel Radio

  function store(id){
    if (!id) return;
    window.RADIO_ID = id;
    try { localStorage.setItem('seced_radio_id', id); } catch {}
  }

  document.addEventListener('change', (e)=>{
    const t = e.target;
    if (t && t.matches && t.matches('[name="radio"]')) {
      store(String(t.value || '').trim());
    }
  });

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.radio-option,[data-radio-id],[data-radio]');
    if (!btn) return;
    const v = (btn.getAttribute('data-radio-id')
            || btn.getAttribute('data-radio')
            || btn.textContent || '').trim();
    if (v) store(v);
  });

  const initial = resolveSelectedRadioFromUI()
               || new URLSearchParams(location.search).get('radio')
               || localStorage.getItem('seced_radio_id');
  if (initial) store(String(initial).trim());
})();

// 4) Publicar un aviso en Firestore para el tramo actual
async function publishRadioAlert() {
  try {
    const radio = getRadioId();
    if (!radio) {
      alert('No se ha detectado el número de RADIO seleccionado.\nSelecciona un radio en el panel e inténtalo de nuevo.');
      return;
    }
    if (!window.firebase || !firebase.firestore) {
      alert('Firestore no está disponible en esta página.');
      return;
    }

    const tramo = (window.TRAMO_ID || '1').toString();
    const db = firebase.firestore();
    const payload = {
      tramo,
      radio,
      actor: (window.OPERATOR || '—'),
      type: 'radio_alert',
      clientTs: Date.now(), // respaldo inmediato
      ts: firebase.firestore.FieldValue.serverTimestamp()
    };

    console.log('[AVISO] Enviando', payload);
    await db.collection('tramos').doc(tramo).collection('alerts').add(payload);
    console.log('[AVISO] Emitido OK desde radio:', radio);

    try { logAudit('radio_alert_emit', { radio }); } catch {}
  } catch (e) {
    console.error('publishRadioAlert error', e);
    alert('Error enviando AVISO.\nRevisa la consola para más detalles.');
  }
}

// --- FIX/Normalizador del botón de BANDERA en panel radio (robusto) ---
(function ensureBanderaButtonRobusto(){
  if (!document.body.classList.contains('radio-skin')) return; // solo en Panel Radio

  const WANT_ID = 'btnBandera';
  const WANT_TEXT = 'BANDERA';

  function wireClick(b){
    if (b._banderaWired) return;
    b._banderaWired = true;
    b.addEventListener('click', (ev)=>{
      ev.preventDefault();
      console.log('[BANDERA] click');
      publishRadioAlert();
    });
    b.setAttribute('aria-label', 'Enviar aviso de BANDERA');
  }

  function styleButton(b){
    Object.assign(b.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: 1000,
      background: '#dc2626',
      color: '#fff',
      border: '1px solid #b91c1c',
      borderRadius: '10px',
      padding: '12px 16px',
      fontWeight: '800',
      letterSpacing: '0.5px',
      boxShadow: '0 8px 18px rgba(0,0,0,.35)',
      cursor: 'pointer'
    });
  }

  function upsert(){
    let btn = document.getElementById(WANT_ID)
           || document.getElementById('btnAviso')
           || document.querySelector('#btnBandera, #btnAviso, button[data-role="aviso"]');

    if (!btn) {
      btn = document.createElement('button');
      btn.id = WANT_ID;
      btn.type = 'button';
      btn.textContent = WANT_TEXT;
      styleButton(btn);
      document.body.appendChild(btn);
      console.log('[BANDERA] botón creado');
    } else {
      if (btn.id !== WANT_ID) btn.id = WANT_ID;
      if (btn.textContent !== WANT_TEXT) btn.textContent = WANT_TEXT;
      styleButton(btn);
      console.log('[BANDERA] botón normalizado (reutilizado)');
    }
    wireClick(btn);
  }

  // Corre ahora…
  upsert();

  // … reintenta durante unos segundos por si otro script lo inyecta tarde
  let tries = 0;
  const maxTries = 15; // ~7.5s
  const iv = setInterval(()=>{
    try { upsert(); } catch {}
    if (++tries >= maxTries) clearInterval(iv);
  }, 500);

  // Observa inyecciones dinámicas
  const mo = new MutationObserver(()=>{ try { upsert(); } catch {} });
  mo.observe(document.body, { childList: true, subtree: true });
})();

// 6) Banner de alerta en editor/visor (NO en panel radio)
function showRadioAlertBanner(radio) {
  if (document.body.classList.contains('radio-skin')) return; // nunca en panel radio
  if (window.MODE !== 'JEFE') return; // solo en modo JEFE en el editor

  let banner = document.getElementById('radioAlertBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'radioAlertBanner';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: '#b91c1c',
      color: '#fff',
      border: '2px solid '#7f1d1d'.replace("'",""),
      borderRadius: '12px',
      padding: '14px 18px',
      fontWeight: '900',
      fontSize: '16px',
      boxShadow: '0 10px 24px rgba(0,0,0,.45)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
    const txt = document.createElement('span');
    txt.id = 'radioAlertBannerText';
    banner.appendChild(txt);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    Object.assign(close.style, {
      background: 'transparent',
      color: '#fff',
      border: 'none',
      fontSize: '18px',
      fontWeight: '900',
      cursor: 'pointer',
      lineHeight: 1
    });
    close.addEventListener('click', () => banner.remove());
    banner.appendChild(close);
    document.body.appendChild(banner);
  }
  const txt = banner.querySelector('#radioAlertBannerText');
  if (txt) txt.textContent = `AVISO RADIO: ${radio}`;
  banner.style.display = 'flex';

  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => {
    if (banner && banner.parentNode) banner.remove();
  }, 15000);
}

// 7) Suscripción a avisos del tramo (solo editor/visor)
(function subscribeRadioAlerts(){
  if (document.body.classList.contains('radio-skin')) return; // no escuchar en panel radio
  try{
    if (!window.firebase || !firebase.firestore) return;
    const tramo = (window.TRAMO_ID || '1').toString();
    const db = firebase.firestore();
    const lastKey = `seced_last_alert_${tramo}`;

    let lastSeen = 0;
    try { lastSeen = Number(localStorage.getItem(lastKey) || '0'); } catch {}

    db.collection('tramos').doc(tramo).collection('alerts')
      .orderBy('ts','desc').limit(20)
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          const data = ch.doc.data() || {};
          // usar ts de servidor si existe, si no clientTs, si no ahora
          const ts = (data.ts && data.ts.toMillis) ? data.ts.toMillis()
                    : (typeof data.clientTs === 'number' ? data.clientTs : Date.now());
          const radio = data.radio || 'RADIO';
          if (ts > lastSeen) {
            lastSeen = ts; // evita duplicados en la sesión
            try { localStorage.setItem(lastKey, String(ts)); } catch {}
            try { logAudit('radio_alert_recv', { radio, ts }); } catch {}
            showRadioAlertBanner(radio);
          }
        });
      }, err => console.warn('alerts listener error', err));
  }catch(e){
    console.warn('subscribeRadioAlerts error', e);
  }
})();
