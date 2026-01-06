<!-- js/panel-radio-pasos.js -->
<script>
/**
 * Panel Radio → DC: último dorsal por radio
 * Escribe en: rallies/{rallyId}/pasos/{nombreTramo} => { radio{N}: dorsal, radio{N}_ts: serverTimestamp }
 *
 * Cómo decide los valores:
 *  - rallyId: ?rally=…  ó localStorage('dc_rally_id')  (si no, te pregunta una sola vez)
 *  - nombreTramo: ?tramoNombre=…  ó localStorage('dc_tramo_nombre')  (si no, te pregunta una sola vez)
 *  - radioId: usa tu getRadioId() actual (seced) o pregunta una vez
 *
 * Para disparar el guardado:
 *  1) Llama a window.emitRadioPass(dorsal) desde tu click de dorsal del panel, o
 *  2) (opcional) enlaza al botón BANDERA para que te pida dorsal y lo suba.
 */

(function(){
  if (!window.firebase || !firebase.firestore) {
    console.warn('[panel-radio-pasos] Firebase no está cargado aquí.');
    return;
  }
  const db = firebase.firestore();

  // --- helpers de estado persistente ---
  function askOnceLS(key, msg) {
    let v = (localStorage.getItem(key) || '').trim();
    if (!v) {
      v = (prompt(msg) || '').trim();
      if (!v) return '';
      try { localStorage.setItem(key, v); } catch {}
    }
    return v;
  }

  // --- obtener rallyId ---
  function getRallyId() {
    const qp = new URLSearchParams(location.search).get('rally');
    if (qp) { try { localStorage.setItem('dc_rally_id', qp.trim()); } catch {} return qp.trim(); }
    return askOnceLS('dc_rally_id', 'ID del rally (igual que el usado en DC):');
  }

  // --- obtener nombre del tramo (tal como aparece en DC) ---
  function getNombreTramo() {
    const qpt = new URLSearchParams(location.search).get('tramoNombre');
    if (qpt) { try { localStorage.setItem('dc_tramo_nombre', qpt.trim()); } catch {} return qpt.trim(); }
    // Si tu panel muestra en UI el nombre real, podrías rellenarlo tú aquí.
    return askOnceLS('dc_tramo_nombre', 'Nombre EXACTO del tramo (como en DC):');
  }

  // --- obtener radioId (N) ---
  function getRadioIdCompat() {
    // 1) tu helper seced (si existe)
    if (typeof getRadioId === 'function') {
      const v = String(getRadioId() || '').trim();
      if (v) return v;
    }
    // 2) atributos de UI típicos
    const checked = document.querySelector('[name="radio"]:checked');
    if (checked && checked.value) return String(checked.value).trim();
    const bodyAttr = document.body.getAttribute('data-radio');
    if (bodyAttr) return String(bodyAttr).trim();
    // 3) últimas opciones guardadas
    const ls1 = (localStorage.getItem('seced_radio_id') || '').trim();
    if (ls1) return ls1;
    const ls2 = (localStorage.getItem('seced_radio') || '').trim();
    if (ls2) return ls2;
    // 4) preguntar una sola vez
    return askOnceLS('dc_radio_id', 'Número de RADIO (solo el número, p.ej. "1" para R1):');
  }

  // --- función principal: subir paso de dorsal ---
  async function saveRadioPass(dorsal) {
    try {
      const rallyId = getRallyId();
      const nombreTramo = getNombreTramo();
      const radioId = getRadioIdCompat();

      if (!rallyId || !nombreTramo || !radioId) {
        alert('Falta rallyId, nombreTramo o radioId. Revisa parámetros (?rally= & ?tramoNombre=) o rellena los diálogos.');
        return;
      }
      const n = String(radioId).replace(/^\D+/,''); // extrae dígitos por si vienen "R1"
      const payload = {};
      payload['radio' + n] = String(dorsal).trim();
      payload['radio' + n + '_ts'] = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection('rallies')
        .doc(rallyId)
        .collection('pasos')
        .doc(nombreTramo)
        .set(payload, { merge: true });

      console.log('[panel-radio-pasos] OK', { rallyId, nombreTramo, radio:n, dorsal });
    } catch (e) {
      console.error('[panel-radio-pasos] Error guardando paso', e);
      alert('Error enviando paso a DC. Revisa conexión y Reglas Firestore.');
    }
  }

  // Exponer para que lo llames desde tu handler de click en dorsal:
  window.emitRadioPass = function(dorsal){
    const d = Number(String(dorsal).trim());
    if (!Number.isFinite(d) || d<=0) { alert('Dorsal inválido'); return; }
    saveRadioPass(d);
  };

  // (OPCIONAL) Integrar con el botón BANDERA pidiendo dorsal:
  const btnBandera = document.getElementById('btnBandera') || document.getElementById('btnAviso');
  if (btnBandera && !btnBandera._wiredForPasos) {
    btnBandera._wiredForPasos = true;
    const oldOnClick = btnBandera.onclick;
    btnBandera.onclick = (ev)=>{
      try{ ev.preventDefault(); }catch{}
      // pregunta dorsal y lo sube
      const raw = prompt('Dorsal que pasa por este RADIO:');
      if (raw!==null) {
        const d = Number((raw||'').trim());
        if (Number.isFinite(d) && d>0) saveRadioPass(d);
        else alert('Dorsal inválido.');
      }
      // llama lo viejo si existía (por compatibilidad con tu alerta/banera)
      if (typeof oldOnClick === 'function') {
        try { oldOnClick.call(btnBandera, ev); } catch {}
      }
    };
  }
})();
</script>
