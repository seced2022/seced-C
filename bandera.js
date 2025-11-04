// bandera.js — Panel Radio

(function(){
  // Solo en Panel Radio
  if (!document.body.classList.contains('radio-skin')) return;

  // ===== Selector de TRAMO y RADIO (mínimo viable) =====
  const btnTramo = document.getElementById('btnTramo');
  const btnRadio = document.getElementById('btnRadio');
  const btnOperador = document.getElementById('btnOperador');

  function getTramo(){
    const qs = new URLSearchParams(location.search).get('tramo');
    return (window.TRAMO_ID || qs || '1').toString();
  }
  function setTramo(t){
    const tramo = String(t||'').trim();
    if (!tramo) return;
    const p = new URLSearchParams(location.search);
    p.set('tramo', tramo);
    location.search = p.toString();
  }

  function setLocal(k,v){ try{ localStorage.setItem(k, v);}catch{} }
  function getLocal(k){ try{ return localStorage.getItem(k)||'';}catch{ return ''; } }

  function getRadioId(){
    try{
      // 1) DOM dinámico (si lo usas)
      const checked = document.querySelector('[name="radio"]:checked');
      if (checked && checked.value) return String(checked.value).trim();

      const activeBtn = document.querySelector('.radio-option.active,[data-radio-selected="true"]');
      if (activeBtn) {
        const v = activeBtn.getAttribute('data-radio-id')
              || activeBtn.getAttribute('data-radio')
              || activeBtn.textContent;
        if (v) return String(v).trim();
      }

      // 2) Variables/URL
      if (window.RADIO_ID) return String(window.RADIO_ID);
      const qp = new URLSearchParams(location.search).get('radio');
      if (qp) return String(qp).trim();

      // 3) LocalStorage (aceptamos ambas claves)
      const v1 = getLocal('seced_radio_id'); if (v1) return String(v1).trim();
      const v2 = getLocal('seced_radio');    if (v2) return String(v2).trim();
    }catch{}
    return '';
  }
  function storeRadioId(id){
    if (!id) return;
    window.RADIO_ID = id;
    setLocal('seced_radio_id', id);
    setLocal('seced_radio', id);
  }
  function updateRadioUI(){
    const r = getRadioId();
    if (btnRadio) btnRadio.textContent = 'RADIO: ' + (r || '—');
  }

  if (btnTramo) btnTramo.addEventListener('click', ()=>{
    const curr = getTramo();
    const t = prompt('Indica el tramo (ej. 1 o tramo-1):', curr);
    if (t !== null) setTramo(t);
  });

  if (btnRadio) btnRadio.addEventListener('click', ()=>{
    const curr = getRadioId() || '1';
    const v = prompt('Introduce tu número de RADIO (1,2,3…):', curr);
    if (v === null) return;
    storeRadioId(String(v).trim());
    updateRadioUI();
  });

  if (btnOperador) btnOperador.addEventListener('click', ()=>{
    const name = prompt('Nombre o identificador del operador:', getLocal('seced_operator')||'');
    if (name !== null) setLocal('seced_operator', (name||'').trim());
  });

  updateRadioUI();

  // ===== Publicar AVISO =====
  async function publishRadioAlert(){
    try{
      const radio = getRadioId();
      if (!radio) {
        alert('No se ha detectado el número de RADIO. Pulsa "RADIO: —" y define 1, 2, 3…');
        return;
      }
      if (!window.firebase || !firebase.firestore) {
        alert('Firestore no está disponible en esta página.');
        return;
      }
      const tramo = getTramo();
      const db = firebase.firestore();
      const payload = {
        tramo,
        radio,
        actor: (getLocal('seced_operator') || '—'),
        type: 'radio_alert',
        clientTs: Date.now(),
        ts: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('tramos').doc(tramo).collection('alerts').add(payload);
      // feedback sutil
      const old = document.title;
      document.title = '✅ AVISO ENVIADO';
      setTimeout(()=>{ document.title = old; }, 1200);
    } catch (e) {
      console.error('AVISO no enviado:', e);
      alert('Error enviando AVISO.\nRevisa Reglas Firestore o la consola.');
    }
  }

  // ===== Botón BANDERA (crear o normalizar) =====
  (function ensureBanderaButton(){
    let btn = document.getElementById('btnBandera') || document.getElementById('btnAviso');
    function wire(b){
      b.onclick = (ev)=>{ ev.preventDefault(); publishRadioAlert(); };
      b.setAttribute('aria-label','Enviar AVISO de radio');
      b.textContent = 'BANDERA';
      b.id = 'btnBandera';
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
    if (!btn) {
      btn = document.createElement('button');
      wire(btn);
      document.body.appendChild(btn);
    } else {
      wire(btn);
    }
  })();
})();
