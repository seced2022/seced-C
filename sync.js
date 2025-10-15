(function(){
  const DEBUG = (new URLSearchParams(location.search).get('debug') === '1') || !!window.DEBUG;
  function log(...args){ if (DEBUG) console.log('[SYNC]', ...args); }
  function warn(...args){ console.warn('[SYNC]', ...args); }

  // --- TRAMO ---
  function sanitizeTramo(t){ return (t||'').toString().trim().toLowerCase().replace(/[^\w-]+/g,'-').substring(0,64) || 'tramo-default'; }
  function getTramoFromURL(){ const p=new URLSearchParams(location.search); return p.get('tramo'); }
  function ensureTramo(){
    let t=getTramoFromURL()||sessionStorage.getItem('seced_tramo');
    if(!t){ t=prompt('Indica el nombre del tramo (ej. 1 o tramo-1):','1'); }
    t=sanitizeTramo(t);
    sessionStorage.setItem('seced_tramo',t);
    return t;
  }
  const TRAMO=ensureTramo(); window.TRAMO_ID=TRAMO;
  log('TRAMO_ID =', TRAMO);

  // --- Firebase (compat) ---
  const hasCompatSDK = (typeof firebase !== 'undefined') && !!(firebase.initializeApp);
  const hasConfig = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey);
  log('SDK compat:', hasCompatSDK, 'Config:', hasConfig);

  let db=null, docRef=null, applyingRemote=false, usingFirestore=false;

  if(hasCompatSDK && hasConfig){
    try{
      if (firebase.apps && firebase.apps.length === 0) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
        log('firebase.initializeApp OK');
      } else {
        log('Firebase app ya inicializada');
      }
      db = firebase.firestore();
      docRef = db.collection('tramos').doc(TRAMO);
      usingFirestore = true;
      log('Firestore ON → docRef = tramos/', TRAMO);
    }catch(e){
      usingFirestore = false;
      warn('Fallo iniciando Firebase. Cayendo a localStorage. Error:', e);
    }
  }else{
    usingFirestore = false;
    warn('SDK o config Firebase no disponibles. Cayendo a localStorage.');
  }

  const LOCAL_KEY = 'seced_tramo:'+TRAMO;
  const LOCAL_AUDIT_KEY = 'seced_audit:'+TRAMO;

  // --- Guardar estado ---
  window.syncSave = (function(){
    let t;
    return function(){
      clearTimeout(t);
      t = setTimeout(function(){
        try{
          if (window.VIEWER) { log('syncSave omitido (VIEWER)'); return; }
          const data = {
            items: (typeof window._getItems==='function' ? window._getItems() : []),
            updatedAt: Date.now()
          };
          if (usingFirestore && docRef && !applyingRemote){
            log('Guardando en Firestore…', data);
            docRef.set(Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }), { merge:true })
              .then(()=> log('Guardado OK (Firestore)'))
              .catch(err=> warn('Error guardando en Firestore', err));
          } else {
            log('Guardando en localStorage…', data);
            localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
          }
        }catch(e){
          warn('syncSave error:', e);
        }
      }, 120);
    };
  })();

  // --- Auditoría ---
  window.auditSave = function(entry){
    try{
      if (usingFirestore && docRef){
        log('auditSave → Firestore', entry);
        const col = docRef.collection('auditoria');
        col.add(Object.assign({}, entry, { ts: firebase.firestore.FieldValue.serverTimestamp() }))
          .then(()=> log('auditSave OK'))
          .catch(err=> warn('auditSave Firestore error', err));
      } else {
        log('auditSave → localStorage', entry);
        const list = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||'[]');
        list.push(Object.assign({}, entry, { ts: new Date().toISOString() }));
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(list));
      }
    }catch(e){ warn('auditSave error:', e); }
  };

  window.auditFetch = async function(){
    try{
      if (usingFirestore && docRef){
        log('auditFetch Firestore…');
        const snap = await docRef.collection('auditoria').orderBy('ts','desc').limit(500).get();
        const rows = [];
        snap.forEach(doc=>{
          const d=doc.data()||{};
          rows.push({
            ts: d.ts ? (d.ts.toDate ? d.ts.toDate().toISOString() : d.ts) : null,
            actor: d.actor||'',
            action: d.action||'',
            detail: d.detail||{},
            clientTime: d.clientTime||null
          });
        });
        log('auditFetch OK, rows:', rows.length);
        return rows;
      } else {
        log('auditFetch localStorage…');
        const list = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||'[]');
        return list.sort((a,b)=> String(b.ts).localeCompare(String(a.ts))).slice(0,500);
      }
    }catch(e){
      warn('auditFetch error:', e);
      return [];
    }
  };

  // --- Lectura / Suscripción ---
  (function subscribeOrSeed(){
    const applyRemote = (arr)=>{
      if(typeof window._onRemoteUpdate==='function'){
        applyingRemote = true;
        try { window._onRemoteUpdate(Array.isArray(arr)?arr:[]); }
        finally { applyingRemote = false; }
      }
    };

    if (usingFirestore && docRef){
      log('onSnapshot suscribiéndose…');
      docRef.onSnapshot(function(snap){
        if(!snap.exists){
          log('onSnapshot: doc no existe aún.');
          return;
        }
        if(snap.metadata && snap.metadata.hasPendingWrites){
          log('onSnapshot: cambios locales (pending writes)…');
          return;
        }
        const data = snap.data() || {};
        log('onSnapshot: datos recibidos', data);
        applyRemote(data.items || []);
      }, function(err){
        warn('onSnapshot error, usando localStorage:', err);
        try{
          const local = localStorage.getItem(LOCAL_KEY);
          if (local){
            const parsed = JSON.parse(local)||{};
            applyRemote(parsed.items || []);
            log('Semilla local OK (fallback).');
          }
        }catch(e){ warn('Fallback localStorage error:', e); }
      });
    } else {
      log('Usando solo localStorage (sin Firestore).');
      try{
        const local = localStorage.getItem(LOCAL_KEY);
        if (local){
          const parsed = JSON.parse(local)||{};
          applyRemote(parsed.items || []);
          log('Semilla local OK.');
        } else {
          log('No hay datos locales aún para', LOCAL_KEY);
        }
      }catch(e){ warn('Lectura localStorage error:', e); }
    }
  })();
})();
