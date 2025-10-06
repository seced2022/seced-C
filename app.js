const input = document.getElementById('inputNumero');
const btnAgregar = document.getElementById('btnAgregar');
const btnLimpiar = document.getElementById('btnLimpiar');
const grid = document.getElementById('grid');
const countSalida = document.getElementById('countSalida');
const countLlegada = document.getElementById('countLlegada');
const countAbandonos = document.getElementById('countAbandonos');

/** items: { value:number, selected:boolean, status:'normal'|'abandon', rNumber:number|null, tSalida:number|null, tLlegada:number|null, tAbandono:number|null } */
let items = [];
// Hooks para sincronización (los usa sync.js)
window._getItems = () => items;
window._onRemoteUpdate = (remoteItems) => { items = Array.isArray(remoteItems) ? remoteItems : []; render(); };

// === tiempo (usa offset del reloj de Internet, si está disponible) ===
function nowNetMs() { return Date.now() + (typeof timeOffsetMs !== 'undefined' ? timeOffsetMs : 0); }
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); }

function existsValue(val) { return items.some(x => x.value === val); }

function render() {
  // contadores
  if (countSalida) countSalida.textContent = String(items.length);
  if (countLlegada) countLlegada.textContent = String(items.filter(x => x.status !== 'abandon' && x.selected).length);
  if (countAbandonos) countAbandonos.textContent = String(items.filter(x => x.status === 'abandon').length);

  // grid
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
      if (item.status === 'abandon') return;
      toggle(item.value);
    });
    if (!VIEWER) document.addEventListener('click', (ev) => { if (!card.contains(ev.target)) menu.classList.add('hidden'); });

    cell.appendChild(card);

    // ==== time bars (exactly two: S always if exists, then A if exists else LL if exists) ====
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
    grid.appendChild(cell);
  }
}

function toggleMenu(card) {
  const menu = card.querySelector('.menu');
  const hidden = menu.classList.contains('hidden');
  grid.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  if (hidden) menu.classList.remove('hidden'); else menu.classList.add('hidden');
}

function toggle(value) {
  const idx = items.findIndex(x => x.value === value);
  if (idx !== -1) {
    const wasSelected = items[idx].selected;
    items[idx].selected = !items[idx].selected;
    if (!wasSelected && items[idx].selected) { items[idx].tLlegada = nowNetMs(); }
    render();
    if (typeof syncSave === 'function') syncSave();
  }
}

function addNumber() {
  const raw = (input.value || '').trim().replace(',', '.');
  if (raw === '') return;
  const num = Number(raw);
  if (!Number.isFinite(num)) { alert('Por favor, ingresa un número válido.'); return; }
  if (existsValue(num)) { alert('Ese número ya existe y no se puede repetir.'); input.select(); return; }
  items.push({ value: num, selected: false, status: 'normal', rNumber: null, tSalida: nowNetMs(), tLlegada: null, tAbandono: null });
  render();
  if (typeof syncSave === 'function') syncSave();
  input.value = ''; input.focus();
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
}

function setAbandon(val) {
  const idx = items.findIndex(x => x.value === val);
  if (idx === -1) return;
  const raw = prompt('Indica el número para R (aparecerá como R{n}):');
  if (raw === null) return;
  const r = Number((raw || '').trim());
  if (!Number.isInteger(r) || r < 0) { alert('Introduce un número entero válido (>= 0) para R.'); return; }
  items[idx].status = 'abandon';
  items[idx].selected = false;
  items[idx].rNumber = r;
  items[idx].tAbandono = nowNetMs();
  render();
  if (typeof syncSave === 'function') syncSave();
}

if (btnAgregar) btnAgregar.addEventListener('click', addNumber);
if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addNumber(); });
if (btnLimpiar) btnLimpiar.addEventListener('click', () => {
  if (items.length === 0) return;
  if (confirm('¿Vaciar la lista de tarjetas?')) { items = []; render(); if (typeof syncSave === 'function') syncSave(); input.focus(); }
});

render();

// ===== Exportar a PDF (con título de tramo y contadores) =====
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

// ===== Pantalla completa =====
const btnFullscreen = document.getElementById('btnFullscreen');
function isFullscreen() { return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement; }
async function enterFullscreen(el) { try { if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); else if (el.msRequestFullscreen) await el.msRequestFullscreen(); } catch (e) {} }
async function exitFullscreen() { try { if (document.exitFullscreen) await document.exitFullscreen(); else if (document.webkitExitFullscreen) await document.webkitExitFullscreen(); else if (document.msExitFullscreen) await document.msExitFullscreen(); } catch (e) {} }
function updateFsButton() { if (!btnFullscreen) return; btnFullscreen.textContent = isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'; }
if (btnFullscreen) btnFullscreen.addEventListener('click', () => { if (isFullscreen()) exitFullscreen(); else enterFullscreen(document.documentElement); });
document.addEventListener('fullscreenchange', updateFsButton); document.addEventListener('webkitfullscreenchange', updateFsButton); document.addEventListener('msfullscreenchange', updateFsButton); updateFsButton();

// ===== Reloj sincronizado por Internet (WorldTimeAPI) =====
const TIMEZONE = 'Europe/Madrid';
const clockTime = document.getElementById('clockTime'); const clockTz = document.getElementById('clockTz'); const clockSync = document.getElementById('clockSync');
if (clockTz) clockTz.textContent = TIMEZONE;
let timeOffsetMs = 0, tickTimer = null, resyncTimer = null;
// Hacer VIEWER global para sync.js y para evitar listeners no deseados
const VIEWER = new URLSearchParams(window.location.search).has('viewer'); window.VIEWER = VIEWER;

function renderClock(nowMs) { const d = new Date(nowMs + timeOffsetMs); if (clockTime) clockTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
async function syncTime() { try { if (clockSync) { clockSync.textContent = 'sincronizando…'; clockSync.className = 'sync'; } const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(TIMEZONE)}`, { cache: 'no-store' }); if (!res.ok) throw new Error('HTTP ' + res.status); const data = await res.json(); const apiMs = Date.parse(data.datetime); const localMs = Date.now(); timeOffsetMs = apiMs - localMs; if (clockSync) { clockSync.textContent = 'ok'; clockSync.className = 'sync ok'; } } catch (err) { if (clockSync) { clockSync.textContent = 'sin conexión'; clockSync.className = 'sync err'; } }
}
function startClock() { if (tickTimer) clearInterval(tickTimer); tickTimer = setInterval(() => renderClock(Date.now()), 1000); renderClock(Date.now()); if (resyncTimer) clearInterval(resyncTimer); resyncTimer = setInterval(syncTime, 5*60*1000); }
syncTime().then(startClock);
