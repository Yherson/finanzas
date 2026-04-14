/**
 * firebase-config.js
 * Inicialización de Firebase compartida.
 * Se carga como <script type="module"> en ambas páginas.
 * Expone todo lo necesario en window._ para que los scripts
 * normales (no-módulo) puedan accederlo.
 */

import { initializeApp }           from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp,
         doc, getDoc, setDoc, updateDoc, deleteDoc,
         query, orderBy, onSnapshot }
                                    from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider,
         onAuthStateChanged, signOut }
                                    from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

/* ── Configuración ── */
const firebaseConfig = {
  apiKey:            "AIzaSyCBEViX704HkJvpQBxCgb_r6so9c3efhr8",
  authDomain:        "finanzas-personales-70e52.firebaseapp.com",
  projectId:         "finanzas-personales-70e52",
  storageBucket:     "finanzas-personales-70e52.firebasestorage.app",
  messagingSenderId: "433329691661",
  appId:             "1:433329691661:web:8d2d39f30b52afedd78944"
};

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser    = null;
let unsubListener  = null;

/* ── Helpers internos ── */
function up(path) {
  if (!currentUser) { console.error('[FB] up(): no currentUser'); return null; }
  return 'users/' + currentUser.uid + '/' + path;
}

function makeRef(path) {
  if (!path) { console.error('[FB] makeRef: null path'); return null; }
  const segs = path.split('/');
  return doc(db, ...segs);
}

async function loadDoc(path, def) {
  const ref = makeRef(path);
  if (!ref) return def;
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : def;
  } catch(e) {
    console.error('[FB] load ERROR', path, e.code, e.message);
    return def;
  }
}

async function saveDoc(path, data) {
  const ref = makeRef(path);
  if (!ref) { console.error('[FB] saveDoc: null ref', path); return; }
  try {
    await setDoc(ref, data);
  } catch(e) {
    console.error('[FB] save ERROR', path, e.code, e.message);
    throw e;
  }
}

/* ── API pública expuesta en window ── */

window._serverTimestamp = serverTimestamp;

window._loginGoogle = async () => {
  try { await signInWithPopup(auth, provider); }
  catch(e) { if(window.toast) window.toast('Error al iniciar sesión','err'); else alert('Error: '+e.message); }
};

window._logout = async () => {
  if (unsubListener) unsubListener();
  await signOut(auth);
};

/* Firestore CRUD — registros */
window._updateDoc = async (id, data) =>
  updateDoc(doc(db, 'users', currentUser.uid, 'registros', id), data);

window._deleteDoc = async (id) =>
  deleteDoc(doc(db, 'users', currentUser.uid, 'registros', id));

window._addRegistroFuturo = async (data) => {
  data.createdAt = serverTimestamp();
  return addDoc(collection(db, 'users', currentUser.uid, 'registros'), data);
};

/* Listener en tiempo real */
window._startListener = (cb) => {
  const q = query(
    collection(db, 'users', currentUser.uid, 'registros'),
    orderBy('createdAt', 'desc')
  );
  unsubListener = onSnapshot(q,
    snap => { const r=[]; snap.forEach(d => r.push({id:d.id,...d.data()})); cb(r); },
    e => console.error('[FB] listener error', e)
  );
};

/* Config docs */
window._loadPresupuestos = ()  => loadDoc(up('config/presupuestos'), {cats:{}, subs:{}});
window._savePresupuestos = (d) => saveDoc(up('config/presupuestos'), d);

window._loadSettings     = ()  => loadDoc(up('config/settings'), {});
window._saveSettings     = (d) => saveDoc(up('config/settings'), d);

window._loadMetas        = async () => { const d = await loadDoc(up('config/metas'),{lista:[]}); return d.lista||[]; };
window._saveMetas        = async (l) => saveDoc(up('config/metas'), {lista:l});

window._loadRecurrentes  = async () => { const d = await loadDoc(up('config/recurrentes'),{lista:[]}); return d.lista||[]; };
window._saveRecurrentes  = (l)       => saveDoc(up('config/recurrentes'), {lista:l});

window._loadPatrimonio   = () => loadDoc(up('config/patrimonio'), {activos:[],pasivos:[],history:[],movimientos:[]});
window._savePatrimonio   = (d) => saveDoc(up('config/patrimonio'), d);

window._loadSobregiros   = async () => { const d = await loadDoc(up('config/sobregiros'),{lista:[]}); return d.lista||[]; };
window._saveSobregiros   = async (l) => saveDoc(up('config/sobregiros'), {lista:l});

/* Categorías (usado por formulario.html) */
window._loadCats = async (uid) => {
  try {
    const s = await getDoc(doc(db,'users',uid,'config','categorias'));
    return s.exists() ? s.data() : null;
  } catch(e) { return null; }
};
window._saveCats = async (uid, data) => {
  try { await setDoc(doc(db,'users',uid,'config','categorias'), data); }
  catch(e) { console.error('saveCats:', e); }
};

/* ── Auth state — detecta en qué página estamos y llama el callback correcto ── */
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    window._currentUser    = user;
    window._firebaseReady  = true;

    /* Registro de nuevo documento */
    window._addRegistro = async (data) =>
      addDoc(collection(db,'users',user.uid,'registros'), data);

    /* Notificar a cada página según cuál callback esté registrado */
    if (typeof window.onFirebaseUser === 'function') {
      window.onFirebaseUser(user);
    }
  } else {
    currentUser            = null;
    window._currentUser    = null;
    window._firebaseReady  = false;

    if (typeof window.onFirebaseSignOut === 'function') {
      window.onFirebaseSignOut();
    }
  }
});
