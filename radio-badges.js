(function(){
  function ready(fn){(document.readyState!=='loading')?fn():document.addEventListener('DOMContentLoaded',fn);}
  ready(function(){
    const params=new URLSearchParams(location.search);
    const TRAMO=(window.TRAMO_ID||params.get('tramo')||'1').toString();
    const grid=document.getElementById('grid'); if(!grid) return;

    const radioClicks=new Map();

    function paintChips(){
      const cells=grid.querySelectorAll('.cell');
      cells.forEach(cell=>{
        const card=cell.querySelector('.card'); if(!card) return;
        const val=card.dataset.value; if(!val) return;

        const old=cell.querySelector('.radio-chips'); if(old) old.remove();

        const list=radioClicks.get(String(val));
        if(!Array.isArray(list)||list.length===0) return;

        const wrap=document.createElement('div'); wrap.className='radio-chips';
        list.slice().sort((a,b)=>a-b).forEach(r=>{
          const chip=document.createElement('span');
          chip.className='chip chip-radio'; chip.textContent=`R:${r}`;
          wrap.appendChild(chip);
        });

        const timeStack=cell.querySelector('.time-stack');
        if(timeStack) cell.insertBefore(wrap,timeStack); else cell.appendChild(wrap);
      });
    }

    const mo=new MutationObserver(()=>paintChips());
    mo.observe(grid,{childList:true,subtree:true});

    function subscribe(){
      try{
        if(!window.firebase||!firebase.firestore) return;
        const db=firebase.firestore();
        db.collection('tramos').doc(TRAMO).collection('radios')
          .onSnapshot(snap=>{
            snap.docChanges().forEach(ch=>{
              const id=ch.doc.id;
              const d=ch.doc.data()||{};
              const arr=Array.isArray(d.list)?d.list.slice():[];
              if(ch.type==='removed'||arr.length===0) radioClicks.delete(id);
              else radioClicks.set(id,arr);
            });
            paintChips();
          },err=>console.warn('radio-badges snapshot error:',err));
      }catch(e){console.warn('radio-badges subscribe error:',e);}
    }
    subscribe();
  });
})();
