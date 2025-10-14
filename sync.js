(function(){
  function sanitizeTramo(t){ return (t||'').toString().trim().toLowerCase().replace(/[^\w-]+/g,'-').substring(0,64) || 'tramo-default'; }
  function getTramoFromURL(){ const p=new URLSearchParams(location.search); return p.get('tramo'); }
  function ensureTramo(){
    let t=getTramoFromURL()||sessionStorage.getItem('seced_tramo');
    if(!t){ t=prompt('Indica el nombre del tramo (ej. tramo-1):','tramo-1'); }
    t=sanitizeTramo(t);
    sessionStorage.setItem('seced_tramo',t);
    return t;
  }
  const TRAMO=ensureTramo(); window.TRAMO_ID=TRAMO;

  const hasFirebase=typeof firebase!=='undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey;
  let db=null, docRef=null, applyingRemote=false;

  if(hasFirebase){
    try{
      if(firebase.apps?.length===0) firebase.initializeApp(window.FIREBASE_CONFIG);
      db=firebase.firestore();
      docRef=db.collection('tramos').doc(TRAMO);
    }catch(e){ console.warn('Firebase deshabilitado, usando localStorage:',e); }
  }

  const LOCAL_KEY='seced_tramo:'+TRAMO;
  const LOCAL_AUDIT_KEY='seced_audit:'+TRAMO;

  window.syncSave=(function(){ let t; return function(){
    clearTimeout(t);
    t=setTimeout(function(){
      try{
        if(window.VIEWER) return;
        const data={ items:(typeof window._getItems==='function'?window._getItems():[]), updatedAt: Date.now() };
        if(docRef && !applyingRemote){
          docRef.set(
            Object.assign({}, data, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }),
            { merge:true }
          );
        }else{
          localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
        }
      }catch(e){ console.error('syncSave error:', e); }
    },150);
  }; })();

  window.auditSave = function(entry){
    try{
      if(docRef){
        const col = docRef.collection('auditoria');
        col.add(Object.assign({}, entry, { ts: firebase.firestore.FieldValue.serverTimestamp() }));
      }else{
        const list = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||'[]');
        list.push(Object.assign({}, entry, { ts: new Date().toISOString() }));
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(list));
      }
    }catch(e){ console.error('auditSave error:', e); }
  };

  window.auditFetch = async function(){
    try{
      if(docRef){
        const snap = await docRef.collection('auditoria').orderBy('ts','desc').limit(500).get();
        const rows=[];
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
        return rows;
      }else{
        const list = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY)||'[]');
        return list.sort((a,b)=> String(b.ts).localeCompare(String(a.ts))).slice(0,500);
      }
    }catch(e){
      console.error('auditFetch error:', e);
      return [];
    }
  };

  (function subscribeOrSeed(){
    const applyRemote = (arr)=>{
      if(typeof window._onRemoteUpdate==='function'){
        applyingRemote=true;
        try{ window._onRemoteUpdate(Array.isArray(arr)?arr:[]); } finally { applyingRemote=false; }
      }
    };
    if(docRef){
      docRef.onSnapshot(function(snap){
        if(!snap.exists) return;
        if(snap.metadata && snap.metadata.hasPendingWrites) return;
        const data=snap.data()||{};
        applyRemote(data.items||[]);
      }, function(err){
        console.warn('Fallo suscripción Firestore, usando localStorage:', err);
        const local=localStorage.getItem(LOCAL_KEY);
        if(local){ try{ applyRemote((JSON.parse(local)||{}).items||[]); }catch{} }
      });
    }else{
      const local=localStorage.getItem(LOCAL_KEY);
      if(local){ try{ applyRemote((JSON.parse(local)||{}).items||[]); }catch{} }
    }
  })();
})();