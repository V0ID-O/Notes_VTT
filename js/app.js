// Notes_VTT — lógica de la app (Firebase Firestore + Auth)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyBhHabNOsM0feNz1ASpeKQ45hhohciZUvg",
  authDomain: "notes-vtt.firebaseapp.com",
  projectId: "notes-vtt",
  storageBucket: "notes-vtt.firebasestorage.app",
  messagingSenderId: "37390796942",
  appId: "1:37390796942:web:141893d4ce04bc9375a1df"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Cache local persistente: funciona sin internet y sincroniza al reconectar
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const COLORS = ['#4d9fff', '#38e1ff', '#b26bff', '#ff5ce1', '#4ade80', '#ffb020'];
// Colores de paletas anteriores → equivalentes actuales (para notas ya guardadas)
const COLOR_MAP = {
  '#a78bfa': '#b26bff', '#f472b6': '#ff5ce1', '#4ade80': '#4ade80',
  '#60a5fa': '#4d9fff', '#fbbf24': '#ffb020', '#f87171': '#ff5ce1',
  '#b6ff2e': '#4ade80', '#b26bff': '#b26bff', '#3ee6ff': '#38e1ff',
  '#ff5ce1': '#ff5ce1', '#ffb020': '#ffb020', '#ff4d5e': '#ff5ce1',
  '#c81e3e': '#ff5ce1', '#7d0018': '#b26bff', '#25435d': '#4d9fff',
  '#4c6c81': '#38e1ff', '#87a4b5': '#7dd3fc', '#b9d3e2': '#38e1ff',
  '#1e5fe0': '#4d9fff', '#1250c8': '#38e1ff', '#0a2a6e': '#4d9fff', '#7dd3fc': '#38e1ff'
};
const noteColor = n => COLOR_MAP[n.color] || n.color || COLORS[0];
const USER_KEY = 'notes_vtt_user';
const LEGACY_KEY = 'notes_vtt_v1';

let notes = [];
let userName = '';
let ownerId = null;
let editingId = null;
let selectedColor = COLORS[0];
let unsubscribe = null;
let dataLoaded = false;

const grid = document.getElementById('notes-grid');
const emptyState = document.getElementById('empty-state');
const emptyText = document.getElementById('empty-text');
const overlay = document.getElementById('overlay');
const searchInput = document.getElementById('search');
const titleInput = document.getElementById('note-title');
const beatInput = document.getElementById('note-beat');
const colorPreview = document.getElementById('color-preview');
const contentInput = document.getElementById('note-content');
const swatchesEl = document.getElementById('swatches');
const modalTitle = document.getElementById('modal-title');
const userOverlay = document.getElementById('user-overlay');
const chapaOverlay = document.getElementById('chapa-overlay');
const chapaInput = document.getElementById('chapa-input');
const chapaBtn = document.getElementById('brand-chapa');
const userMenu = document.getElementById('user-menu');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmMsg = document.getElementById('confirm-msg');
const btnConfirmOk = document.getElementById('btn-confirm-ok');
const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
const confirmIcon = document.getElementById('confirm-icon');

// Confirmación con estilos de la app (reemplaza al confirm() del navegador)
function customConfirm(title, msg, okLabel, onOk, okIcon = pixTrash) {
  confirmTitle.textContent = title;
  confirmMsg.textContent = msg;
  confirmIcon.innerHTML = bigIcon(okIcon);
  btnConfirmOk.innerHTML = okIcon + okLabel;
  confirmOverlay.classList.add('open');
  const handler = () => {
    confirmOverlay.classList.remove('open');
    btnConfirmOk.removeEventListener('click', handler);
    onOk();
  };
  btnConfirmOk.addEventListener('click', handler, { once: true });
}
btnConfirmCancel.onclick = () => confirmOverlay.classList.remove('open');
confirmOverlay.onclick = e => { if (e.target === confirmOverlay) confirmOverlay.classList.remove('open'); };

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Iconos pixel-art (estilo disco pixelado)
const pixTrash = `<svg class="pix" width="14" height="14" viewBox="0 0 8 8" fill="currentColor" shape-rendering="crispEdges"><rect x="3" y="0" width="2" height="1"/><rect x="1" y="1" width="6" height="1"/><rect x="1" y="2" width="1" height="4"/><rect x="6" y="2" width="1" height="4"/><rect x="3" y="2" width="1" height="4"/><rect x="5" y="2" width="1" height="4"/><rect x="1" y="6" width="6" height="1"/></svg>`;
const pixDisc = `<svg class="pix" width="12" height="12" viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="currentColor" d="M1 0h6v1h1v6h-1v1h-6v-1h-1v-6h1z"/><rect x="3" y="3" width="2" height="2" fill="#111520"/></svg>`;
// Iconos pixel para el modal de confirmación (puerta de salida)
const pixOut = `<svg class="pix" width="14" height="14" viewBox="0 0 8 8" fill="currentColor" shape-rendering="crispEdges"><rect x="0" y="0" width="3" height="1"/><rect x="0" y="7" width="3" height="1"/><rect x="0" y="1" width="1" height="6"/><rect x="3" y="3" width="4" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/></svg>`;
// Versión grande del icono que va sobre el título del confirm
const bigIcon = svg => svg.replace(/width="14" height="14"/, 'width="34" height="34"');
const linkify = s => escapeHtml(s).replace(
  /(https?:\/\/[^\s<]+)/g,
  url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
);

// Link del beat: prioriza el campo guardado (beatUrl); si el usuario pegó el link
// dentro del nombre del beat, lo extrae de ahí (compatibilidad con notas viejas)
function beatUrlOf(note) {
  if (note.beatUrl) return note.beatUrl;
  const m = (note.beatName || '').match(/https?:\/\/[^\s]+/);
  return m ? m[0] : '';
}
function beatNameOf(note) {
  if (note.beatUrl) return (note.beatName || '').trim();
  return (note.beatName || '').replace(/https?:\/\/[^\s]+/g, '').trim();
}

// Paleta de colores
COLORS.forEach(c => {
  const b = document.createElement('div');
  b.className = 'swatch';
  b.style.background = c;
  b.onclick = () => { selectedColor = c; refreshSwatches(); };
  swatchesEl.appendChild(b);
});
function refreshSwatches() {
  [...swatchesEl.children].forEach((el, i) => el.classList.toggle('selected', COLORS[i] === selectedColor));
  colorPreview.style.color = selectedColor; // el corazón pixel toma el color elegido
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const visible = q
    ? notes.filter(n => (n.title + ' ' + n.content).toLowerCase().includes(q))
    : notes;
  grid.innerHTML = '';
  emptyState.hidden = visible.length > 0;
  emptyText.innerHTML = dataLoaded
    ? `Aún no hay notas.<br>Toca el <b>disco</b> ${pixDisc} para crear tu primera canción.`
    : 'Cargando notas desde la nube…';

  visible.sort((a, b) => b.updated - a.updated).forEach(note => {
    // Targets del chip de beat: primero el link propio de la nota, luego los del contenido
    const bUrl = beatUrlOf(note);
    const bName = beatNameOf(note);
    const beatTargets = [];
    if (bUrl) beatTargets.push({ href: bUrl, label: bName || 'Beat' });
    const contentUrls = [...new Set(((note.content || '').match(/https?:\/\/[^\s]+/g) || []))]
      .filter(u => u !== bUrl);
    contentUrls.forEach((u, i) => {
      const isFirst = beatTargets.length === 0 && i === 0;
      beatTargets.push({
        href: u,
        label: isFirst && bName ? bName : (isFirst ? 'Beat' : 'Beat ' + (i + 1))
      });
    });
    const beatsHtml = beatTargets.length
      ? beatTargets.map(t =>
          `<a class="beat-chip" href="${escapeHtml(t.href)}" target="_blank" rel="noopener noreferrer"><img class="pix chip-ico" src="img/nota.png" alt=""> ${escapeHtml(t.label)}</a>`
        ).join('')
      : (bName
          ? `<span class="beat-chip"><img class="pix chip-ico" src="img/nota.png" alt=""> ${escapeHtml(bName)}</span>`
          : '');
    const card = document.createElement('article');
    card.className = 'note';
    card.style.borderLeftColor = noteColor(note);
    card.innerHTML = `
      <div class="color-bar" style="background: ${noteColor(note)}; color: ${noteColor(note)}"></div>
      <h3></h3>
      <div class="content">${linkify(note.content || '')}</div>
      <div class="beats">${beatsHtml}</div>
      <div class="meta">
        <time>${formatDate(note.updated)}</time>
        <div class="actions">
          <button class="icon-btn del" data-act="del" title="Eliminar">${pixTrash}</button>
        </div>
      </div>`;
    card.querySelector('h3').textContent = note.title || 'Sin título';
    // Abrir links/chips con window.open: target="_blank" falla en la PWA de iOS
    const openUrl = (e, url) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
    };
    card.querySelectorAll('a.beat-chip').forEach(a => {
      a.onclick = e => openUrl(e, a.href);
    });
    card.querySelectorAll('.content a').forEach(a => {
      a.onclick = e => openUrl(e, a.href);
    });
    // Click en cualquier parte de la nota (excepto links, chips y botones) → editar
    card.onclick = e => {
      if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.beat-chip')) return;
      openModal(note.id);
    };
    card.querySelector('[data-act="del"]').onclick = e => {
      e.stopPropagation();
      customConfirm(
        '¿Eliminar nota?',
        (note.title || 'Esta nota') + ' se borrará para siempre.',
        'Eliminar',
        () => deleteDoc(doc(db, 'notes', note.id)).catch(console.error)
      );
    };
    grid.appendChild(card);
  });
}

function openModal(id = null) {
  editingId = id;
  const note = id ? notes.find(n => n.id === id) : null;
  modalTitle.textContent = note ? 'Editar nota' : 'Nueva nota';
  titleInput.value = note ? note.title : '';
  beatInput.value = note ? [note.beatName || '', note.beatUrl || ''].filter(Boolean).join(' ') : '';
  contentInput.value = note ? (note.content || '') : '';
  selectedColor = note ? noteColor(note) : COLORS[0];
  refreshSwatches();
  overlay.classList.add('open');
  titleInput.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  editingId = null;
}

document.getElementById('fab').onclick = () => openModal();
document.getElementById('btn-cancel').onclick = closeModal;
overlay.onclick = e => { if (e.target === overlay) closeModal(); };

document.getElementById('btn-save').onclick = async () => {
  const content = contentInput.value.trim();
  if (!content && !titleInput.value.trim()) return;
  // Si el usuario pegó un link en el campo del beat, se guarda como beatUrl
  const rawBeat = beatInput.value.trim();
  const urlMatch = rawBeat.match(/https?:\/\/[^\s]+/);
  const now = Date.now();
  const data = {
    title: titleInput.value.trim(),
    beatUrl: urlMatch ? urlMatch[0] : '',
    beatName: rawBeat.replace(/https?:\/\/[^\s]+/g, '').trim(),
    content,
    color: selectedColor,
    updated: now
  };
  const idToSave = editingId; // capturar antes de closeModal(), que lo pone en null
  closeModal();
  try {
    if (idToSave) {
      await updateDoc(doc(db, 'notes', idToSave), data);
    } else {
      await addDoc(collection(db, 'notes'), { ...data, owner: userName, ownerId, created: now });
    }
  } catch (err) {
    console.error(err);
    alert('Error al guardar la nota. Código: ' + (err.code || err.message || 'desconocido'));
  }
};

searchInput.oninput = render;

// ---- Autenticación y sincronización ----
function showGate() {
  userOverlay.classList.add('open');
}

async function login() {
  const provider = new GoogleAuthProvider();
  // Siempre mostrar el selector de cuentas de Google
  provider.setCustomParameters({ prompt: 'select_account' });
  // Popup en todos lados (en iPhone la PWA instalada lo abre como hoja dentro de la app).
  // Si falla, mostramos el código exacto en vez de caer en el bucle del redirect.
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    // En pestañas normales el redirect es un buen plan B
    if (!standalone) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch { /* cae al aviso de abajo */ }
    }
    alert('No se pudo iniciar sesión. Código: ' + (err.code || err.message || 'desconocido'));
  }
}

// Si la app vuelve de un redirect de Google y falló, mostrar el motivo en vez de buclear
getRedirectResult(auth).catch(err => {
  console.error(err);
  alert('Error al volver de Google: ' + (err.code || err.message || 'desconocido'));
});

document.getElementById('btn-enter').onclick = login;

// ---- Chapa de artista ----
const chapaKey = () => 'notes_vtt_chapa_' + ownerId;
function showChapa() {
  chapaInput.value = localStorage.getItem(chapaKey()) || '';
  chapaOverlay.classList.add('open');
  chapaInput.focus();
}
function saveChapa() {
  const chapa = chapaInput.value.trim();
  if (!chapa) return;
  localStorage.setItem(chapaKey(), chapa);
  chapaBtn.textContent = chapa;
  chapaOverlay.classList.remove('open');
}
document.getElementById('btn-chapa').onclick = saveChapa;
chapaInput.onkeydown = e => { if (e.key === 'Enter') saveChapa(); };
// Menú de usuario: tocar la chapa muestra opciones
chapaBtn.onclick = e => {
  e.stopPropagation();
  userMenu.hidden = !userMenu.hidden;
};
document.addEventListener('click', e => {
  if (!userMenu.hidden && !e.target.closest('#user-menu') && !e.target.closest('#brand-chapa')) {
    userMenu.hidden = true;
  }
});
document.getElementById('menu-chapa').onclick = () => {
  userMenu.hidden = true;
  showChapa();
};
document.getElementById('menu-logout').onclick = () => {
  userMenu.hidden = true;
  customConfirm(
    '¿Cerrar sesión?',
    'Podrás volver a entrar con tu cuenta de Google.',
    'Cerrar sesión',
    () => signOut(auth).catch(console.error),
    pixOut
  );
};

function startSync() {
  if (unsubscribe) unsubscribe();
  dataLoaded = false;
  render();
  const q = query(collection(db, 'notes'), where('ownerId', '==', ownerId));
  unsubscribe = onSnapshot(q, snapshot => {
    notes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    dataLoaded = true;
    render();
  }, err => {
    console.error('Snapshot error:', err);
    dataLoaded = true;
    render();
  });
}

// Migra las notas guardadas localmente (versión antigua) hacia la nube
async function migrateLegacyNotes() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (!Array.isArray(legacy) || !legacy.length) return;
    for (const n of legacy) {
      await addDoc(collection(db, 'notes'), {
        owner: userName,
        ownerId,
        title: n.title || '',
        beatName: n.beatName || '',
        content: n.content || '',
        color: n.color || COLORS[0],
        created: n.created || Date.now(),
        updated: n.updated || Date.now()
      });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch (err) {
    console.error('Migración:', err);
  }
}

// Reclama las notas creadas antes de Authentication (identificadas por nombre)
async function claimNotesByName(legacyName) {
  if (!legacyName) return;
  try {
    const q = query(collection(db, 'notes'), where('owner', '==', legacyName));
    const snap = await new Promise((resolve, reject) => {
      const unsub = onSnapshot(q, s => { unsub(); resolve(s); }, err => { unsub(); reject(err); });
    });
    for (const d of snap.docs) {
      if (!d.data().ownerId) {
        await updateDoc(doc(db, 'notes', d.id), { ownerId });
      }
    }
  } catch (err) {
    console.error('Reclamo de notas:', err);
  }
}

// Service Worker (offline) — solo si se sirve por http/https
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

onAuthStateChanged(auth, user => {
  if (user) {
    userName = user.displayName || user.email.split('@')[0];
    ownerId = user.uid;
    userOverlay.classList.remove('open');
    const legacyName = localStorage.getItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
    const chapa = localStorage.getItem(chapaKey());
    chapaBtn.textContent = chapa || 'NOTES_VTT';
    if (!chapa) showChapa();
    migrateLegacyNotes();
    claimNotesByName(legacyName);
    startSync();
  } else {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    notes = [];
    dataLoaded = true;
    chapaBtn.textContent = 'NOTES_VTT';
    userMenu.hidden = true;
    showGate();
    render();
  }
});

render();