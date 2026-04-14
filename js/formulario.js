/**
 * formulario.js
 * Lógica completa del formulario de registro de transacciones.
 * Se carga como script normal (no-módulo) después de firebase-config.js
 */

/* ── Estado ── */
var tipo = 'gasto', rawMonto = '', catSel = '', subSel = '';
var modalMode = '', modalTarget = '', modalParent = '';
var today = new Date().toISOString().split('T')[0];

/* ── Datos de categorías ── */
var defaultData = {
  gasto: {
    cats: ['Alimentacion','Transporte','Salud','Servicios','Entretenimiento','Ahorro','Alquiler'],
    subs: {
      'Alimentacion':   ['Desayuno','Almuerzo','Cena'],
      'Transporte':     ['Bus','Taxi','Gasolina','Estacionamiento'],
      'Salud':          ['Farmacia','Consulta','Laboratorio'],
      'Servicios':      ['Luz','Agua','Internet','Telefono'],
      'Entretenimiento':['Streaming','Salida','Evento'],
      'Ahorro':         ['Fondo emergencia','Inversion','Meta'],
      'Alquiler':       ['Mensualidad','Mantenimiento']
    }
  },
  ingreso: {
    cats: ['Sueldo','Freelance','Negocio','Inversiones','Otro'],
    subs: {
      'Sueldo':      ['Mensual','Quincenal','Bono'],
      'Freelance':   ['Proyecto','Consultoria','Diseno'],
      'Negocio':     ['Ventas','Servicios','Comision'],
      'Inversiones': ['Dividendos','Intereses','Venta activo'],
      'Otro':        ['Regalo','Premio','Devolucion']
    }
  }
};

function loadData()      { return JSON.parse(JSON.stringify(defaultData)); }
function cloneData(obj)  { return JSON.parse(JSON.stringify(obj)); }

async function saveData(d) {
  if (!window._currentUser || !window._saveCats) throw new Error('cloud-unavailable');
  await window._saveCats(window._currentUser.uid, d);
}

var data = loadData();

/* ── Fecha/Hora ── */
function updateDT() {
  var now = new Date();
  var dd  = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var mm  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  document.getElementById('dtTime').textContent =
    now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  document.getElementById('dtDate').textContent =
    dd[now.getDay()] + ' ' + now.getDate() + ' ' + mm[now.getMonth()];
}
updateDT();
setInterval(updateDT, 30000);
document.getElementById('fecha').value = today;

/* ── Auth ── */
function loginConGoogle() { if (window._loginGoogle) window._loginGoogle(); }
function logout()         { if (confirm('Cerrar sesion?') && window._logout) window._logout(); }

/* Callbacks que firebase-config.js invocará */
window.onFirebaseUser = function(user) {
  document.getElementById('authScreen').classList.remove('show');
  document.getElementById('mainPage').classList.add('show');
  document.getElementById('userName').textContent = user.displayName || user.email || 'Usuario';
  window._loadCats(user.uid).then(function(cats) {
    if (cats && (cats.gasto || cats.ingreso)) data = cats;
    renderCats(); renderSubs();
  });
};

window.onFirebaseSignOut = function() {
  document.getElementById('authScreen').classList.add('show');
  document.getElementById('mainPage').classList.remove('show');
};

/* ── Render Categorías ── */
function renderCats() {
  var c = document.getElementById('chipsCat');
  c.innerHTML = '';
  data[tipo].cats.forEach(function(cat) {
    var chip = document.createElement('div');
    chip.className = 'chip' + (catSel === cat ? ' sel-' + (tipo === 'gasto' ? 'g' : 'i') : '');
    var lbl = document.createElement('button');
    lbl.className = 'chip-lbl';
    lbl.textContent = cat;
    lbl.onclick = function() { selectCat(cat); };
    var ed = document.createElement('button');
    ed.className = 'chip-edit';
    ed.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ed.onclick = function(e) { e.stopPropagation(); showModal('cat', cat, ''); };
    chip.appendChild(lbl); chip.appendChild(ed); c.appendChild(chip);
  });
  var add = document.createElement('button');
  add.className = 'chip-add';
  add.textContent = '+ agregar';
  add.onclick = function() { showInline('cat'); };
  c.appendChild(add);
}

function renderSubs() {
  var sec = document.getElementById('subSection');
  if (!catSel) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  var subs = data[tipo].subs[catSel] || [];
  var c = document.getElementById('subchips');
  c.innerHTML = '';
  subs.forEach(function(s) {
    var sub = document.createElement('div');
    sub.className = 'subchip' + (subSel === s ? ' sel-' + (tipo === 'gasto' ? 'g' : 'i') : '');
    var lbl = document.createElement('button');
    lbl.className = 'subchip-lbl';
    lbl.textContent = s;
    lbl.onclick = function() { selectSub(s); };
    var ed = document.createElement('button');
    ed.className = 'subchip-edit';
    ed.innerHTML = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ed.onclick = function(e) { e.stopPropagation(); showModal('sub', s, catSel); };
    sub.appendChild(lbl); sub.appendChild(ed); c.appendChild(sub);
  });
  var add = document.createElement('button');
  add.className = 'subchip-add';
  add.textContent = '+ agregar';
  add.onclick = function() { showInline('sub'); };
  c.appendChild(add);
}

function selectCat(c) {
  catSel = catSel === c ? '' : c;
  subSel = '';
  document.getElementById('eCat').textContent = '';
  cancelInline('cat'); cancelInline('sub');
  renderCats(); renderSubs();
}
function selectSub(s) { subSel = subSel === s ? '' : s; renderSubs(); }

/* ── Inline forms ── */
function showInline(t) {
  if (t === 'cat') { document.getElementById('addCatForm').classList.add('on'); document.getElementById('addCatInp').focus(); }
  else             { if (!catSel) return; document.getElementById('addSubForm').classList.add('on'); document.getElementById('addSubInp').focus(); }
}
function cancelInline(t) {
  if (t === 'cat') { document.getElementById('addCatForm').classList.remove('on'); document.getElementById('addCatInp').value = ''; }
  else             { document.getElementById('addSubForm').classList.remove('on'); document.getElementById('addSubInp').value = ''; }
}

async function confirmAddCat() {
  var v = document.getElementById('addCatInp').value.trim(); if (!v) return;
  var prev = cloneData(data);
  if (!data[tipo].cats.includes(v)) {
    data[tipo].cats.push(v); data[tipo].subs[v] = [];
    try { await saveData(data); } catch(e) { data = prev; alert('No se pudo guardar en la nube'); renderCats(); renderSubs(); return; }
  }
  catSel = v; subSel = ''; cancelInline('cat'); renderCats(); renderSubs();
}

async function confirmAddSub() {
  var v = document.getElementById('addSubInp').value.trim(); if (!v || !catSel) return;
  var prev = cloneData(data);
  if (!data[tipo].subs[catSel]) data[tipo].subs[catSel] = [];
  if (!data[tipo].subs[catSel].includes(v)) {
    data[tipo].subs[catSel].push(v);
    try { await saveData(data); } catch(e) { data = prev; alert('No se pudo guardar en la nube'); renderCats(); renderSubs(); return; }
  }
  subSel = v; cancelInline('sub'); renderSubs();
}

/* ── Modal editar categoría ── */
function showModal(mode, target, parent) {
  modalMode = mode; modalTarget = target; modalParent = parent;
  document.getElementById('modalTitleTxt').textContent = mode === 'cat' ? 'Editar categoria' : 'Editar subcategoria';
  document.getElementById('modalInp').value = target;
  document.getElementById('modalOv').classList.add('show');
  setTimeout(function() { document.getElementById('modalInp').focus(); }, 300);
}
function hideModal() { document.getElementById('modalOv').classList.remove('show'); }

async function confirmModalEdit() {
  var v = document.getElementById('modalInp').value.trim(); if (!v) return;
  var prev = cloneData(data), prevCatSel = catSel, prevSubSel = subSel;
  if (modalMode === 'cat') {
    var idx = data[tipo].cats.indexOf(modalTarget);
    if (idx >= 0) {
      data[tipo].cats[idx] = v;
      var old = data[tipo].subs[modalTarget] || [];
      delete data[tipo].subs[modalTarget];
      data[tipo].subs[v] = old;
      if (catSel === modalTarget) catSel = v;
    }
  } else {
    var subs = data[tipo].subs[modalParent] || [];
    var idx2 = subs.indexOf(modalTarget);
    if (idx2 >= 0) { subs[idx2] = v; if (subSel === modalTarget) subSel = v; }
  }
  try { await saveData(data); } catch(e) { data = prev; catSel = prevCatSel; subSel = prevSubSel; alert('No se pudo guardar en la nube'); renderCats(); renderSubs(); return; }
  hideModal(); renderCats(); renderSubs();
}

async function confirmModalDelete() {
  var prev = cloneData(data), prevCatSel = catSel, prevSubSel = subSel;
  if (modalMode === 'cat') {
    data[tipo].cats = data[tipo].cats.filter(function(c) { return c !== modalTarget; });
    delete data[tipo].subs[modalTarget];
    if (catSel === modalTarget) { catSel = ''; subSel = ''; }
  } else {
    data[tipo].subs[modalParent] = (data[tipo].subs[modalParent] || []).filter(function(s) { return s !== modalTarget; });
    if (subSel === modalTarget) subSel = '';
  }
  try { await saveData(data); } catch(e) { data = prev; catSel = prevCatSel; subSel = prevSubSel; alert('No se pudo guardar en la nube'); renderCats(); renderSubs(); return; }
  hideModal(); renderCats(); renderSubs();
}

/* ── Tipo gasto/ingreso ── */
function setTipo(t) {
  tipo = t; catSel = ''; subSel = '';
  document.getElementById('btnG').className    = 'tipo-btn' + (t === 'gasto' ? ' ag' : '');
  document.getElementById('btnI').className    = 'tipo-btn' + (t === 'ingreso' ? ' ai' : '');
  document.getElementById('btnSave').className = 'btn-save btn-' + (t === 'gasto' ? 'g' : 'i');
  document.getElementById('btnSave').textContent = 'Registrar ' + (t === 'gasto' ? 'Gasto' : 'Ingreso');
  document.getElementById('estado').className  = 'estado';
  document.getElementById('estado').textContent = '';
  cancelInline('cat'); cancelInline('sub');
  renderCats(); renderSubs();
}

/* ── Validación y guardado ── */
function validate() {
  var ok = true;
  if (!rawMonto || isNaN(parseFloat(rawMonto)) || parseFloat(rawMonto) <= 0) {
    document.getElementById('eMonto').textContent = 'Ingresa un monto valido'; ok = false;
  }
  if (!catSel) { document.getElementById('eCat').textContent = 'Selecciona una categoria'; ok = false; }
  return ok;
}

function resetForm() {
  rawMonto = ''; catSel = ''; subSel = '';
  document.getElementById('monto').value = '';
  document.getElementById('desc').value  = '';
  document.getElementById('fecha').value = today;
  renderCats(); renderSubs();
}

async function guardar() {
  try {
    if (!window._firebaseReady || !window._addRegistro) { alert('Primero inicia sesión'); return; }
    document.getElementById('eMonto').textContent = '';
    document.getElementById('eCat').textContent   = '';
    if (!validate()) return;

    const now = new Date();
    const registro = {
      fecha:         document.getElementById('fecha').value,
      fecha_ingreso: now.toLocaleDateString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit'}),
      hora_ingreso:  now.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      fechahora:     now.toLocaleString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      tipo:          tipo,
      monto:         parseFloat(rawMonto),
      categoria:     catSel,
      subcategoria:  subSel,
      descripcion:   document.getElementById('desc').value.trim(),
      createdAt:     window._serverTimestamp()
    };

    await window._addRegistro(registro);
    resetForm();
    document.getElementById('estado').className  = 'estado ok';
    document.getElementById('estado').textContent = 'Registro guardado correctamente';

  } catch(e) {
    console.error(e);
    document.getElementById('estado').className  = 'estado fail';
    document.getElementById('estado').textContent = 'Error al guardar';
  }
}

/* ── Motor Sobregiro ── */
function esAhorro(subcategoria) {
  return subcategoria && subcategoria.toUpperCase().includes('AHORRO');
}

function getPrimerDiaSiguienteMes(fechaStr) {
  const fecha = new Date(fechaStr);
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1).toISOString().split('T')[0];
}

async function motorSobregiro(data) {
  try {
    if (data.tipo === 'ingreso' && data.categoria && data.categoria.toUpperCase() === 'SOBREGIRO') {
      console.log('Detectado SOBREGIRO:', data);
      const subUpper = (data.subcategoria || '').toUpperCase();
      if (subUpper.includes('AHORRO AGORA') || subUpper.includes('AHORRO')) {
        if (window._addRegistro) {
          await window._addRegistro({
            fecha:         data.fecha || new Date().toISOString().split('T')[0],
            fecha_ingreso: new Date().toLocaleDateString('es-PE'),
            hora_ingreso:  new Date().toLocaleTimeString('es-PE'),
            fechahora:     new Date().toLocaleString('es-PE'),
            tipo:          'gasto',
            monto:         data.monto,
            categoria:     'SOBREGIRO',
            subcategoria:  data.subcategoria || '',
            descripcion:   data.descripcion || 'Gasto automático por SOBREGIRO -> AHORRO',
            createdAt:     window._serverTimestamp()
          });
        }
      } else {
        await crearSobregiroFuturo(data);
      }
    }
  } catch(e) { console.error('motorSobregiro error:', e); }
}

async function crearSobregiroFuturo(data) {
  try {
    const fechaFutura = getPrimerDiaSiguienteMes(data.fecha || new Date().toISOString().split('T')[0]);
    if (window._addRegistro) {
      await window._addRegistro({
        fecha:         fechaFutura,
        fecha_ingreso: new Date().toLocaleDateString('es-PE'),
        hora_ingreso:  new Date().toLocaleTimeString('es-PE'),
        fechahora:     new Date().toLocaleString('es-PE'),
        tipo:          'gasto',
        monto:         data.monto,
        categoria:     'SOBREGIRO',
        subcategoria:  data.subcategoria || '',
        descripcion:   'Gasto automático SOBREGIRO',
        createdAt:     window._serverTimestamp()
      });
    }
  } catch(e) { console.error('crearSobregiroFuturo error:', e); }
}

function calcularPenalizacionSobregiro(registros) {
  let sobregiro = 0, ingresos = 0;
  registros.forEach(r => {
    if (r.tipo === 'ingreso') ingresos += r.monto;
    if (r.tipo === 'ingreso' && r.categoria === 'SOBREGIRO') sobregiro += r.monto;
  });
  return ingresos === 0 ? 0 : ((sobregiro / ingresos) * 100).toFixed(2);
}

function agruparGastosPorDia(registros) {
  const mapa = {};
  registros.forEach(r => {
    if (r.tipo === 'gasto') { if (!mapa[r.fecha]) mapa[r.fecha] = 0; mapa[r.fecha] += r.monto; }
  });
  return mapa;
}

/* ── Init ── */
renderCats();
renderSubs();
