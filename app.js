/* -------------- app.js (v=17) -------------- */
const input = document.getElementById('inputNumero');
const btnAgregar = document.getElementById('btnAgregar');
const grid = document.getElementById('grid');
const btnTramo = document.getElementById('btnTramo');
const tramoMenu = document.getElementById('tramoMenu');
const tramoInput = document.getElementById('tramoInput');

// 1. Gestión de Radio e ID (Recuperado)
function getRadioId() {
  return localStorage.getItem('seced_radio_id') || '1';
}

function updateRadioUI() {
  const btnRadio = document.getElementById('btnRadio');
  if (btnRadio) {
    btnRadio.textContent = 'RADIO: ' + getRadioId();
  }
}

// 2. Lógica de Marcado para Radio
async function marcarRadio(dorsal) {
  const tramo = (window.TRAMO_ID || '1').toString();
  const rIdx = parseInt(getRadioId());
  const db = firebase.firestore();
  
  try {
    const docRef = db.collection('tramos').doc(tramo).collection('radios').doc(String(dorsal));
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      const marks = snap.exists ? (snap.data().marks || []) : [];
      transaction.set(docRef, { 
        marks: [...new Set([...marks, rIdx])].sort((a,b)=>a-b),
        lastUpdate: Date.now()
      }, { merge: true });
    });
  } catch (e) { console.error("Error radio:", e); }
}

// 3. Renderizado de Tarjetas (Vuelve a la versión que te gustaba)
function render() {
  grid.innerHTML = '';
  const items = window._getItems ? window._getItems() : [];
  
  items.forEach(item => {
    if (item.status === 'abandon') return;

    const card = document.createElement('div');
    card.className = 'card' + (item.selected ? ' selected' : '');
    card.dataset.value = item.value;
    
    // Si estamos en el Panel Radio, añadimos la clase de clic
    if (document.body.classList.contains('radio-skin')) {
      card.classList.add('radio-eligible');
      card.onclick = () => marcarRadio(item.value);
    }

    const num = document.createElement('div');
    num.textContent = item.value;
    card.appendChild(num);
    grid.appendChild(card);
  });
}

// 4. Cierre de menús al hacer clic fuera (Rectificado)
document.addEventListener('click', (ev) => {
  if (tramoMenu && !tramoMenu.contains(ev.target) && ev.target !== btnTramo) {
    tramoMenu.classList.add('hidden');
  }
  // Cerrar menús de tarjetas
  if (!ev.target.closest('.card')) {
    document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
  }
});

// Inicialización
updateRadioUI();
if (typeof render === 'function') render();
