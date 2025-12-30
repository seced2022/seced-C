/* ====== DC (Director de Carrera) ====== */

/** Reutiliza la misma config de Firebase que tu app (config.js define window.FIREBASE_CONFIG) **/
firebase.initializeApp(window.FIREBASE_CONFIG);
const db = firebase.firestore();

/** ====== Config declarativa de TRAMOS (puedes editar aquí) ======
 *  - id:      string del tramo (ej. "1")
 *  - name:    nombre visible
 *  - kmz:     URL pública del KMZ/KML en GitHub Pages (o KML/KMZ externo)
 *  - center:  [lat, lng] para centrar el mapa inicialmente
 *  - zoom:    zoom inicial
 *  - radios:  array de puntos { id, name, lat, lng }
 *
 *  IMPORTANTE: si tu archivo es KML en vez de KMZ, también funciona.
 *  Si el KMZ no carga por CORS, sube el KML/KMZ a este mismo repo de GitHub Pages.
 */
window.DC_CONFIG = {
  timezone: 'Europe/Madrid',
  tramos: [
    {
      id: '1',
      name: 'Tramo 1',
      kmz: 'https://seced2022.github.io/seced-C/tracks/tramo1.kmz',
      center: [40.4169, -3.7033],
      zoom: 12,
      radios: [
        { id: '1', name: 'R1', lat: 40.4201, lng: -3.7059 },
        { id: '2', name: 'R2', lat: 40.4109, lng: -3.6991 },
      ],
    },
    {
      id: '2',
      name: 'Tramo 2',
      kmz: 'https://seced2022.github.io/seced-C/tracks/tramo2.kmz',
      center: [40.45, -3.70],
      zoom: 12,
      radios: [
        { id: '1', name: 'R1', lat: 40.46, lng: -3.71 },
        { id: '3', name: 'R3', lat: 40.44, lng: -3.69 },
      ],
    },
  ],
};

/** ====== Reloj sincronizado ====== */
const TIMEZONE = window.DC_CONFIG.timezone || 'Europe/Madrid';
const clockTime = document.getElementById('clockTime');
const clockTz   = document.getElementById('clockTz');
const clockSync = document.getElementById('clockSync');
if (clockTz) clockTz.textContent = TIMEZONE;
let timeOffsetMs = 0, tickTimer = null, resyncTimer = null;

function pad(n){ return String(n).padStart(2,'0'); }
function nowNetMs(){ return Date.now() + (typeof timeOffsetMs!=='undefined' ? timeOffsetMs : 0); }
function renderClock(){ const d=new Date(nowNetMs()); if (clockTime) clockTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
async function syncTime(){
  try{
    if (clockSync) { clockSync.textContent='sincronizando…'; clockSync.className='sync'; }
    const res = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(TIMEZONE)}`, { cache:'no-store' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const apiMs = Date.parse(data.datetime);
    const localMs = Date.now();
    timeOffsetMs = apiMs - localMs;
    if (clockSync) { clockSync.textContent='ok'; clockSync.className='sync ok'; }
  }catch{
    if (clockSync) { clockSync.textContent='sin conexión'; clockSync.className='sync err'; }
  }
}
(function startClock(){
  syncTime().then(()=>{
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(()=>renderClock(),1000);
    renderClock();
    if (resyncTimer) clearInterval(resyncTimer);
    resyncTimer = setInterval(syncTime, 5*60*1000);
  });
})();

/** ====== UI: contenedor de tramos ====== */
const container = document.getElementById('tramosContainer');

/** Mapa + markers por tramo, y estado de último dorsal por radio */
const tramoRefs = new Map(); // tramoId -> { map, kmzLayer, markers: Map<radioId, L.Marker>, lastByRadio: Map<radioId, dorsal> }

function createTramoCard(cfg){
  const card = document.createElement('div');
  card.className = 'tramo-card';
  card.dataset.tramo = cfg.id;

  // header
  const head = document.createElement('div');
  head.className = 'tramo-head';

  const title = document.createElement('div');
  title.className = 'tramo-title';
  title.textContent = `TRAMO ${cfg.id} · ${cfg.name}`;

  const actions = document.createElement('div');
  actions.className = 'tramo-actions';

  const btnStop = document.createElement('button');
  btnStop.className = 'btn btn-danger';
  btnStop.textContent = 'PARADA SALIDA';
  btnStop.title = 'Emitir aviso de parada de salida para este tramo';
  btnStop.addEventListener('click', ()=> emitParadaSalida(cfg.id));

  const btnCenter = document.createElement('button');
  btnCenter.className = 'btn btn-primary';
  btnCenter.textContent = 'Centrar mapa';
  btnCenter.addEventListener('click', ()=> centerMap(cfg.id));

  actions.appendChild(btnStop);
  actions.appendChild(btnCenter);

  head.appendChild(title);
  head.appendChild(actions);

  // mapa
  const mapWrap = document.createElement('div');
  mapWrap.className = 'map-wrap';
  const mapDiv = document.createElement('div');
  mapDiv.className = 'map';
  mapDiv.id = `map_${cfg.id}`;
  mapWrap.appendChild(mapDiv);

  // lista radios
  const rlist = document.createElement('div');
  rlist.className = 'radio-list';
  for (const r of cfg.radios){
    const pill = document.createElement('div');
    pill.className = 'radio-pill';
    pill.dataset.radio = r.id;

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${r.name} `;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `R${r.id}`;
    name.appendChild(badge);

    const last = document.createElement('div');
    last.className = 'last';
    last.textContent = '—';

    pill.appendChild(name);
    pill.appendChild(last);
    rlist.appendChild(pill);
  }

  card.appendChild(head);
  card.appendChild(mapWrap);
  card.appendChild(rlist);

  // inicializa leaflet
  const map = L.map(mapDiv.id, {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView(cfg.center, cfg.zoom);

  // tile oscuro (gratis)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19
  }).addTo(map);

  // carga KMZ/KML
  const kmzLayer = new L.KMZ();
  kmzLayer.on('loaded', e => {
    map.addLayer(kmzLayer);
    // Si quieres ajustar la vista al track:
    try { map.fitBounds(e.layer.getBounds(), { padding: [20,20] }); } catch{}
  });
  kmzLayer.load(cfg.kmz);

  // crea markers radios
  const markers = new Map();
  for (const r of cfg.radios){
    const m = L.marker([r.lat, r.lng]).addTo(map);
    m.bindPopup(`<b>${r.name}</b><br/>R${r.id}<div class="last-dorsal">—</div>`);
    markers.set(r.id, m);
  }

  // guarda referencias
  tramoRefs.set(cfg.id, {
    map, kmzLayer, markers,
    lastByRadio: new Map()
  });

  return card;
}

/** Montar todos los tramos */
function buildUI(){
  container.innerHTML = '';
  for (const t of window.DC_CONFIG.tramos){
    const card = createTramoCard(t);
    container.appendChild(card);
    subscribeAlertsFor(t.id); // escucha los avisos de ese tramo
  }
}

/** Center map helper */
function centerMap(tramoId){
  const cfg = window.DC_CONFIG.tramos.find(t=>t.id===tramoId);
  const ref = tramoRefs.get(tramoId);
  if (!cfg || !ref) return;
  ref.map.setView(cfg.center, cfg.zoom);
}

/** ====== Alertas: escuchar radio_alert y actualizar “último dorsal” ======
 *  - Se asume que el emisor manda: { type:'radio_alert', radio, dorsal?, ts } en /tramos/{id}/alerts
 *  - Actualizamos:
 *      - marker popup (div .last-dorsal)
 *      - pill .radio-pill correspondiente
 */
function setLastDorsalInUI(tramoId, radioId, dorsal){
  const card = document.querySelector(`.tramo-card[data-tramo="${tramoId}"]`);
  if (!card) return;

  // pill
  const pill = card.querySelector(`.radio-pill[data-radio="${radioId}"] .last`);
  if (pill) pill.textContent = dorsal || '—';

  // marker popup
  const tref = tramoRefs.get(tramoId);
  if (tref){
    const mk = tref.markers.get(radioId);
    if (mk){
      const name = `R${radioId}`;
      const html = `<b>${name}</b><br/>Último dorsal: <div class="last-dorsal"><b>${dorsal || '—'}</b></div>`;
      mk.bindPopup(html);
    }
    tref.lastByRadio.set(radioId, dorsal || '');
  }
}

function subscribeAlertsFor(tramoId){
  db.collection('tramos').doc(tramoId).collection('alerts')
    .orderBy('ts','desc').limit(100)
    .onSnapshot(snap=>{
      snap.docChanges().forEach(ch=>{
        if (ch.type !== 'added') return;
        const data = ch.doc.data() || {};
        const type = (data.type||'').trim();

        // radio_alert con dorsal
        if (type === 'radio_alert'){
          const radio = (data.radio||'').toString().trim();
          const dorsal = (data.dorsal||'').toString().trim();
          if (radio){
            setLastDorsalInUI(tramoId, radio, dorsal || '—');
          }
        }

        // salida_parada (si quieres, mostramos banner en DC también)
        if (type === 'salida_parada'){
          showBanner(`SALIDA PARADA · TRAMO ${tramoId}`);
          // Si quieres beep:
          try { document.getElementById('beep')?.play().catch(()=>{}); } catch {}
        }
      });
    }, err => console.warn('alerts listener error', err));
}

/** ====== Emitir AVISO “PARADA SALIDA” desde DC ======
 *  Esto escribe en /tramos/{tramo}/alerts un doc con type:'salida_parada'
 *  Para integrarlo en Editor/Visor solo hay que escuchar este type y dibujar banner.
 */
async function emitParadaSalida(tramoId){
  try{
    const payload = {
      tramo: tramoId,
      type: 'salida_parada',
      actor: 'DC',
      clientTs: Date.now(),
      ts: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('tramos').doc(tramoId).collection('alerts').add(payload);
    showBanner(`Aviso emitido: SALIDA PARADA · TRAMO ${tramoId}`);
  }catch(e){
    console.error(e);
    showBanner('Error emitiendo aviso.', true);
  }
}

/** Banner rápido */
let bannerEl = null, bannerTimer = null;
function ensureBanner(){
  if (bannerEl) return bannerEl;
  bannerEl = document.createElement('div');
  bannerEl.className = 'banner';
  document.body.appendChild(bannerEl);
  return bannerEl;
}
function showBanner(text, isError=false){
  const el = ensureBanner();
  el.textContent = text;
  el.style.display = 'block';
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=>{ el.style.display='none'; }, 6000);
}

/** Init */
buildUI();
