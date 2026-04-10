import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCBEViX704HkJvpQBxCgb_r6so9c3efhr8",
  authDomain: "finanzas-personales-70e52.firebaseapp.com",
  projectId: "finanzas-personales-70e52",
  storageBucket: "finanzas-personales-70e52.firebasestorage.app",
  messagingSenderId: "433329691661",
  appId: "1:433329691661:web:8d2d39f30b52afedd78944"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

window._serverTimestamp = serverTimestamp;

window._loginGoogle = async () => {
  try { await signInWithPopup(auth, provider); }
  catch(e) { alert('Error: ' + e.message); }
};

window._logout = () => signOut(auth);

// Categories persistence in Firestore
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

onAuthStateChanged(auth, user => {
  if(user){
    window._currentUser = user;
    window._addRegistro = async (data) => addDoc(collection(db,'users',user.uid,'registros'), data);
    window._firebaseReady = true;
    document.getElementById('authScreen').classList.remove('show');
    document.getElementById('mainPage').classList.add('show');
    document.getElementById('userName').textContent = user.displayName || user.email || 'Usuario';
    // Load categories from Firestore
    window._loadCats(user.uid).then(function(cats){
      if(cats && (cats.gasto || cats.ingreso)){
        data = cats;
      }
      renderCats(); renderSubs();
    });
  } else {
    window._currentUser = null;
    window._firebaseReady = false;
    document.getElementById('authScreen').classList.add('show');
    document.getElementById('mainPage').classList.remove('show');
  }
});

var tipo='gasto', rawMonto='', catSel='', subSel='';
var modalMode='', modalTarget='', modalParent='';
var today=new Date().toISOString().split('T')[0];

var defaultData={
  gasto:{
    cats:['Alimentacion','Transporte','Salud','Servicios','Entretenimiento','Ahorro','Alquiler'],
    subs:{'Alimentacion':['Desayuno','Almuerzo','Cena'],'Transporte':['Bus','Taxi','Gasolina','Estacionamiento'],'Salud':['Farmacia','Consulta','Laboratorio'],'Servicios':['Luz','Agua','Internet','Telefono'],'Entretenimiento':['Streaming','Salida','Evento'],'Ahorro':['Fondo emergencia','Inversion','Meta'],'Alquiler':['Mensualidad','Mantenimiento']}
  },
  ingreso:{
    cats:['Sueldo','Freelance','Negocio','Inversiones','Otro'],
    subs:{'Sueldo':['Mensual','Quincenal','Bono'],'Freelance':['Proyecto','Consultoria','Diseno'],'Negocio':['Ventas','Servicios','Comision'],'Inversiones':['Dividendos','Intereses','Venta activo'],'Otro':['Regalo','Premio','Devolucion']}
  }
};

function loadData(){return JSON.parse(JSON.stringify(defaultData));} // initial default
function cloneData(obj){return JSON.parse(JSON.stringify(obj));}
async function saveData(d){
  if(!window._currentUser || !window._saveCats){
    throw new Error('cloud-unavailable');
  }
  await window._saveCats(window._currentUser.uid, d);
}
var data=loadData();

// DateTime
function updateDT(){
  var now=new Date();
  var dd=['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var mm=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  document.getElementById('dtTime').textContent=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  document.getElementById('dtDate').textContent=dd[now.getDay()]+' '+now.getDate()+' '+mm[now.getMonth()];
}
updateDT(); setInterval(updateDT,30000);
document.getElementById('fecha').value=today;

function loginConGoogle(){if(window._loginGoogle) window._loginGoogle();}
function logout(){if(confirm('Cerrar sesion?')&&window._logout) window._logout();}

// RENDER CATS
function renderCats(){
  var c=document.getElementById('chipsCat'); c.innerHTML='';
  data[tipo].cats.forEach(function(cat){
    var chip=document.createElement('div'); chip.className='chip'+(catSel===cat?' sel-'+(tipo==='gasto'?'g':'i'):'');
    var lbl=document.createElement('button'); lbl.className='chip-lbl'; lbl.textContent=cat; lbl.onclick=function(){selectCat(cat);};
    var ed=document.createElement('button'); ed.className='chip-edit';
    ed.innerHTML='<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ed.onclick=function(e){e.stopPropagation();showModal('cat',cat,'');};
    chip.appendChild(lbl); chip.appendChild(ed); c.appendChild(chip);
  });
  var add=document.createElement('button'); add.className='chip-add'; add.textContent='+ agregar'; add.onclick=function(){showInline('cat');};
  c.appendChild(add);
}

function renderSubs(){
  var sec=document.getElementById('subSection');
  if(!catSel){sec.style.display='none';return;}
  sec.style.display='block';
  var subs=data[tipo].subs[catSel]||[];
  var c=document.getElementById('subchips'); c.innerHTML='';
  subs.forEach(function(s){
    var sub=document.createElement('div'); sub.className='subchip'+(subSel===s?' sel-'+(tipo==='gasto'?'g':'i'):'');
    var lbl=document.createElement('button'); lbl.className='subchip-lbl'; lbl.textContent=s; lbl.onclick=function(){selectSub(s);};
    var ed=document.createElement('button'); ed.className='subchip-edit';
    ed.innerHTML='<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ed.onclick=function(e){e.stopPropagation();showModal('sub',s,catSel);};
    sub.appendChild(lbl); sub.appendChild(ed); c.appendChild(sub);
  });
  var add=document.createElement('button'); add.className='subchip-add'; add.textContent='+ agregar'; add.onclick=function(){showInline('sub');};
  c.appendChild(add);
}

function selectCat(c){catSel=catSel===c?'':c;subSel='';document.getElementById('eCat').textContent='';cancelInline('cat');cancelInline('sub');renderCats();renderSubs();}
function selectSub(s){subSel=subSel===s?'':s;renderSubs();}

function showInline(t){
  if(t==='cat'){document.getElementById('addCatForm').classList.add('on');document.getElementById('addCatInp').focus();}
  else{if(!catSel)return;document.getElementById('addSubForm').classList.add('on');document.getElementById('addSubInp').focus();}
}
function cancelInline(t){
  if(t==='cat'){document.getElementById('addCatForm').classList.remove('on');document.getElementById('addCatInp').value='';}
  else{document.getElementById('addSubForm').classList.remove('on');document.getElementById('addSubInp').value='';}
}
async function confirmAddCat(){
  var v=document.getElementById('addCatInp').value.trim();if(!v)return;
  var prev=cloneData(data);
  if(!data[tipo].cats.includes(v)){
    data[tipo].cats.push(v);data[tipo].subs[v]=[];
    try{await saveData(data);}catch(e){data=prev;alert('No se pudo guardar en la nube');renderCats();renderSubs();return;}
  }
  catSel=v;subSel='';cancelInline('cat');renderCats();renderSubs();
}
async function confirmAddSub(){
  var v=document.getElementById('addSubInp').value.trim();if(!v||!catSel)return;
  var prev=cloneData(data);
  if(!data[tipo].subs[catSel])data[tipo].subs[catSel]=[];
  if(!data[tipo].subs[catSel].includes(v)){
    data[tipo].subs[catSel].push(v);
    try{await saveData(data);}catch(e){data=prev;alert('No se pudo guardar en la nube');renderCats();renderSubs();return;}
  }
  subSel=v;cancelInline('sub');renderSubs();
}

// MODAL EDITAR CATEGORIA
function showModal(mode,target,parent){modalMode=mode;modalTarget=target;modalParent=parent;document.getElementById('modalTitleTxt').textContent=mode==='cat'?'Editar categoria':'Editar subcategoria';document.getElementById('modalInp').value=target;document.getElementById('modalOv').classList.add('show');setTimeout(function(){document.getElementById('modalInp').focus();},300);}
function hideModal(){document.getElementById('modalOv').classList.remove('show');}
async function confirmModalEdit(){
  var v=document.getElementById('modalInp').value.trim();if(!v)return;
  var prev=cloneData(data), prevCatSel=catSel, prevSubSel=subSel;
  if(modalMode==='cat'){var idx=data[tipo].cats.indexOf(modalTarget);if(idx>=0){data[tipo].cats[idx]=v;var old=data[tipo].subs[modalTarget]||[];delete data[tipo].subs[modalTarget];data[tipo].subs[v]=old;if(catSel===modalTarget)catSel=v;}}
  else{var subs=data[tipo].subs[modalParent]||[];var idx2=subs.indexOf(modalTarget);if(idx2>=0){subs[idx2]=v;if(subSel===modalTarget)subSel=v;}}
  try{await saveData(data);}catch(e){data=prev;catSel=prevCatSel;subSel=prevSubSel;alert('No se pudo guardar en la nube');renderCats();renderSubs();return;}
  hideModal();renderCats();renderSubs();
}
async function confirmModalDelete(){
  var prev=cloneData(data), prevCatSel=catSel, prevSubSel=subSel;
  if(modalMode==='cat'){data[tipo].cats=data[tipo].cats.filter(function(c){return c!==modalTarget;});delete data[tipo].subs[modalTarget];if(catSel===modalTarget){catSel='';subSel='';}}
  else{data[tipo].subs[modalParent]=(data[tipo].subs[modalParent]||[]).filter(function(s){return s!==modalTarget;});if(subSel===modalTarget)subSel='';}
  try{await saveData(data);}catch(e){data=prev;catSel=prevCatSel;subSel=prevSubSel;alert('No se pudo guardar en la nube');renderCats();renderSubs();return;}
  hideModal();renderCats();renderSubs();
}

function setTipo(t){
  tipo=t;catSel='';subSel='';
  document.getElementById('btnG').className='tipo-btn'+(t==='gasto'?' ag':'');
  document.getElementById('btnI').className='tipo-btn'+(t==='ingreso'?' ai':'');
  document.getElementById('btnSave').className='btn-save btn-'+(t==='gasto'?'g':'i');
  document.getElementById('btnSave').textContent='Registrar '+(t==='gasto'?'Gasto':'Ingreso');
  document.getElementById('estado').className='estado';
  document.getElementById('estado').textContent='';
  cancelInline('cat');cancelInline('sub');
  renderCats();renderSubs();
}

function validate(){
  var ok=true;
  if(!rawMonto||isNaN(parseFloat(rawMonto))||parseFloat(rawMonto)<=0){document.getElementById('eMonto').textContent='Ingresa un monto valido';ok=false;}
  if(!catSel){document.getElementById('eCat').textContent='Selecciona una categoria';ok=false;}
  return ok;
}

function resetForm(){
  rawMonto='';catSel='';subSel='';
  document.getElementById('monto').value='';
  document.getElementById('desc').value='';
  document.getElementById('fecha').value=today;
  renderCats();renderSubs();
}

async function guardar() {
  try {
    if(!window._firebaseReady || !window._addRegistro){
      alert("Primero inicia sesi?n");
      return;
    }
    document.getElementById('eMonto').textContent='';
    document.getElementById('eCat').textContent='';
    if(!validate()) return;

    const now = new Date();

    const registro = {
      fecha: document.getElementById('fecha').value,
      fecha_ingreso: now.toLocaleDateString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit'}),
      hora_ingreso: now.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      fechahora: now.toLocaleString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      tipo: tipo,
      monto: parseFloat(rawMonto),
      categoria: catSel,
      subcategoria: subSel,
      descripcion: document.getElementById('desc').value.trim(),
      createdAt: window._serverTimestamp()
    };

    await window._addRegistro(registro);
    resetForm();
    document.getElementById('estado').className='estado ok';
    document.getElementById('estado').textContent='Registro guardado correctamente';

  } catch (e) {
    console.error(e);
    document.getElementById('estado').className='estado fail';
    document.getElementById('estado').textContent='Error al guardar';
  }
}

// ===============================
// ? MOTOR SOBREGIRO INTELIGENTE
// ===============================

function esAhorro(subcategoria) {
  return subcategoria && subcategoria.toUpperCase().includes("AHORRO");
}

function getPrimerDiaSiguienteMes(fechaStr) {
  const fecha = new Date(fechaStr);
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];
}

// ? FUNCI?N PRINCIPAL
async function motorSobregiro(data) {
  if (
    data.tipo === "ingreso" &&
    data.categoria === "SOBREGIRO"
  ) {
    console.log("? Detectado SOBREGIRO");

    await crearSobregiroFuturo(data);
    await procesarPatrimonioSobregiro(data);
  }
}

// ===============================
// ? MOTOR SOBREGIRO INTELIGENTE (MEJORADO)
// ===============================

function esAhorro(subcategoria) {
  return subcategoria && subcategoria.toUpperCase().includes("AHORRO");
}

function getPrimerDiaSiguienteMes(fechaStr) {
  const fecha = new Date(fechaStr);
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];
}

// FUNCI?N PRINCIPAL: detecta SOBREGIRO y aplica caso 1 / caso 2
async function motorSobregiro(data) {
  try {
    if (data.tipo === "ingreso" && data.categoria && data.categoria.toUpperCase() === "SOBREGIRO") {
      console.log("? Detectado SOBREGIRO:", data);

      const subUpper = (data.subcategoria || "").toUpperCase();

      // Caso 2: si la subcategor?a contiene "AHORRO AGORA" -> gasto inmediato en Patrimonio (mismo d?a)
      if (subUpper.includes("AHORRO AGORA") || subUpper.includes("AHORRO")) {
        // Registrar gasto inmediato en Patrimonio (historial)
        await registrarHistorial({
          fecha: data.fecha || new Date().toISOString().split('T')[0],
          tipo: "gasto",
          monto: data.monto,
          categoria: "SOBREGIRO",
          subcategoria: data.subcategoria || ""
        });

        // Tambi?n guardar en Firestore como gasto (opcional, mantiene consistencia)
        if (window._addRegistro) {
          await window._addRegistro({
            fecha: data.fecha || new Date().toISOString().split('T')[0],
            fecha_ingreso: new Date().toLocaleDateString('es-PE'),
            hora_ingreso: new Date().toLocaleTimeString('es-PE'),
            fechahora: new Date().toLocaleString('es-PE'),
            tipo: "gasto",
            monto: data.monto,
            categoria: "SOBREGIRO",
            subcategoria: data.subcategoria || "",
            descripcion: data.descripcion || "Gasto autom?tico por SOBREGIRO -> AHORRO",
            createdAt: window._serverTimestamp()
          });
        }

      } else {
        // Caso 1: crear gasto autom?tico el primer d?a del mes siguiente
        await crearSobregiroFuturo(data);
      }
    }
  } catch (e) {
    console.error("motorSobregiro error:", e);
  }
}

// Crear gasto autom?tico en el primer d?a del mes siguiente y registrar en historial
async function crearSobregiroFuturo(data) {
  try {
    const fechaFutura = getPrimerDiaSiguienteMes(data.fecha || new Date().toISOString().split('T')[0]);
    console.log("? Creando gasto autom?tico para:", fechaFutura);

    // Guardar registro en Firestore (gasto)
    if (window._addRegistro) {
      await window._addRegistro({
        fecha: fechaFutura,
        fecha_ingreso: new Date().toLocaleDateString('es-PE'),
        hora_ingreso: new Date().toLocaleTimeString('es-PE'),
        fechahora: new Date().toLocaleString('es-PE'),
        tipo: "gasto",
        monto: data.monto,
        categoria: "SOBREGIRO",
        subcategoria: data.subcategoria || "",
        descripcion: "Gasto autom?tico SOBREGIRO",
        createdAt: window._serverTimestamp()
      });
    }

    // Registrar en historial local/UI
    await registrarHistorial({
      fecha: fechaFutura,
      tipo: "gasto",
      monto: data.monto,
      categoria: "SOBREGIRO",
      subcategoria: data.subcategoria || ""
    });

  } catch (e) {
    console.error("crearSobregiroFuturo error:", e);
  }
}

// ===============================
// ? IMPACTO EN PATRIMONIO
// ===============================
async function procesarPatrimonioSobregiro(data) {
  if (!esAhorro(data.subcategoria)) return;

  console.log("? Impactando patrimonio");

  const user = window._currentUser;
  if (!user) return;

  try {
    await addDoc(
      collection(db, 'users', user.uid, 'patrimonio'),
      {
        tipo: "deuda_sobregiro",
        origen: data.subcategoria,
        monto: data.monto,
        fecha: data.fecha,
        estado: "pendiente",
        createdAt: window._serverTimestamp()
      }
    );
  } catch (e) {
    console.error("Error patrimonio:", e);
  }
}

// ===============================
// ? ALERTAS
// ===============================
function calcularPenalizacionSobregiro(registros) {
  let sobregiro = 0;
  let ingresos = 0;

  registros.forEach(r => {
    if (r.tipo === "ingreso") ingresos += r.monto;

    if (
      r.tipo === "ingreso" &&
      r.categoria === "SOBREGIRO"
    ) {
      sobregiro += r.monto;
    }
  });

  if (ingresos === 0) return 0;

  return ((sobregiro / ingresos) * 100).toFixed(2);
}

// ===============================
// ? HEATMAP
// ===============================
function agruparGastosPorDia(registros) {
  const mapa = {};

  registros.forEach(r => {
    if (r.tipo === "gasto") {
      if (!mapa[r.fecha]) mapa[r.fecha] = 0;
      mapa[r.fecha] += r.monto;
    }
  });

  return mapa;
}

renderCats(); renderSubs();