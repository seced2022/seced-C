// js/auto-llegada.js
// Suscripción ligera a /tramos/{TRAMO}/alerts para marcar llegada en el control
(function(){
  try{
    if (!window.firebase || !firebase.firestore) return;
    const db = firebase.firestore();

    function getTramoId(){
      const p = new URLSearchParams(location.search);
      return (p.get('tramo') || window.TRAMO_ID || '1').toString();
    }
    const tramo = getTramoId();
    const lastKey = `seced_last_alert_auto_ll_${tramo}`;

    let lastSeen = 0; try { lastSeen = Number(localStorage.getItem(lastKey) || '0'); } catch {}

    db.collection('tramos').doc(tramo).collection('alerts')
      .orderBy('ts','desc').limit(50)
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          const data = ch.doc.data() || {};
          const ts = (data.ts && data.ts.toMillis) ? data.ts.toMillis() : (typeof data.clientTs === 'number' ? data.clientTs : Date.now());
          if (ts <= lastSeen) return;

          // Marcar visto
          lastSeen = ts; try { localStorage.setItem(lastKey, String(ts)); } catch {}

          if ((data.type || '') !== 'auto_llegada') return;
          const dorsal = Number(data.dorsal);
          if (!Number.isFinite(dorsal)) return;

          try {
            // items, render, syncSave ya existen en app.js del control
            const arr = (typeof window._getItems === 'function') ? window._getItems() : [];
            const idx = arr.findIndex(x => Number(x.value) === dorsal);
            if (idx === -1) return;

            if (!arr[idx].selected) {
              arr[idx].selected = true;
              if (!arr[idx].tLlegada) arr[idx].tLlegada = Date.now();
              if (typeof window.render === 'function') window.render();
              if (typeof window.syncSave === 'function') window.syncSave();
              try { if (typeof window.logAudit === 'function') logAudit('llegada_auto_por_ultimo_radio', { value: dorsal, via: 'alert' }); } catch {}
            }
          } catch(e){ console.warn('auto-llegada apply error', e); }
        });
      }, err => console.warn('auto-llegada listener error', err));
  }catch(e){ console.warn('auto-llegada init error', e); }
})();
