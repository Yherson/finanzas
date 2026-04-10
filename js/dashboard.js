import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
    import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, serverTimestamp, addDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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
    let currentUser = null;
    let unsubListener = null;

    // Build a Firestore DocumentReference from a slash-separated path
    function makeRef(path) {
      if (!path) { console.error('[FB] makeRef: null path'); return null; }
      const segs = path.split('/');
      return doc(db, ...segs);
    }

    // Generic load with fallback
    async function loadDoc(path, def) {
      const ref = makeRef(path);
      if (!ref) return def;
      try {
        const snap = await getDoc(ref);
        const result = snap.exists() ? snap.data() : def;
        console.log('[FB] load', path, '->', snap.exists() ? 'found' : 'empty');
        return result;
      } catch (e) {
        console.error('[FB] load ERROR', path, e.code, e.message);
        return def;
      }
    }

    // Generic save with logging
    async function saveDoc(path, data) {
      const ref = makeRef(path);
      if (!ref) { console.error('[FB] saveDoc: null ref for path', path); return; }
      try {
        console.log('[FB] saving', path, '...');
        await setDoc(ref, data);
        console.log('[FB] saved OK', path);
      } catch (e) {
        console.error('[FB] save ERROR', path, e.code, e.message);
        throw e;
      }
    }

    // User-scoped path helper
    function up(path) {
      if (!currentUser) { console.error('[FB] up(): no currentUser'); return null; }
      return 'users/' + currentUser.uid + '/' + path;
    }

    // Expose all operations
    window._loginGoogle = async () => { try { await signInWithPopup(auth, provider); } catch (e) { window.toast('Error al iniciar sesion', 'err'); } };
    window._logout = async () => { if (unsubListener) unsubListener(); await signOut(auth); };
    window._updateDoc = async (id, data) => { await updateDoc(doc(db, 'users', currentUser.uid, 'registros', id), data); };
    window._deleteDoc = async (id) => { await deleteDoc(doc(db, 'users', currentUser.uid, 'registros', id)); };

    window._startListener = (cb) => {
      const q = query(collection(db, 'users', currentUser.uid, 'registros'), orderBy('createdAt', 'desc'));
      unsubListener = onSnapshot(q,
        snap => { 
          try {
            const r = []; snap.forEach(d => r.push({ id: d.id, ...d.data() })); cb(r); 
          } catch(err) {
            console.error('[FB] process error', err);
            document.getElementById('loading').style.display = 'none';
            var errBox = document.getElementById('errorBox');
            if(errBox) { errBox.style.display = 'block'; errBox.textContent = 'Error procesando datos: ' + err.message; }
          }
        },
        e => {
          console.error('[FB] listener error', e);
          document.getElementById('loading').style.display = 'none';
          var errBox = document.getElementById('errorBox');
          if(errBox) { errBox.style.display = 'block'; errBox.textContent = 'Error DB (Posible falta de permisos o indice): ' + e.message; }
        }
      );
    };

    window._loadPresupuestos = () => loadDoc(up('config/presupuestos'), { cats: {}, subs: {} });
    window._savePresupuestos = (d) => saveDoc(up('config/presupuestos'), d);
    window._loadSettings = () => loadDoc(up('config/settings'), {});
    window._saveSettings = (d) => saveDoc(up('config/settings'), d);
    window._loadMetas = async () => { const d = await loadDoc(up('config/metas'), { lista: [] }); return d.lista || []; };
    window._saveMetas = async (l) => { console.log('[FB] _saveMetas called, count:', l.length); await saveDoc(up('config/metas'), { lista: l }); };
    window._loadRecurrentes = async () => { const d = await loadDoc(up('config/recurrentes'), { lista: [] }); return d.lista || []; };
    window._saveRecurrentes = (l) => saveDoc(up('config/recurrentes'), { lista: l });
    window._loadPatrimonio = () => loadDoc(up('config/patrimonio'), { activos: [], pasivos: [], history: [], movimientos: [] });
    window._savePatrimonio = (d) => saveDoc(up('config/patrimonio'), d);
    window._loadSobregiros = async () => { const d = await loadDoc(up('config/sobregiros'), { lista: [] }); return d.lista || []; };
    window._saveSobregiros = async (l) => { await saveDoc(up('config/sobregiros'), { lista: l }); };
    window._addRegistroFuturo = async (data) => {
      data.createdAt = serverTimestamp();
      return addDoc(collection(db, 'users', currentUser.uid, 'registros'), data);
    };

    onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    window._userId = user.uid;
    window._userEmail = user.email || '';
    window._userName = user.displayName || 'Usuario';
    
    document.getElementById('app').classList.add('ready');
    document.getElementById('sbUserName').textContent = window._userName;
    if(user.photoURL) document.getElementById('sbAvatar').innerHTML = '<img src="' + user.photoURL + '" alt="">';
    else document.getElementById('sbAvatar').textContent = window._userName.charAt(0).toUpperCase();

    if(typeof window.onAppReady === 'function') window.onAppReady();
  } else {
    window.location.href = 'index.html';
  }
});

/* GLOBALS */
    var allRows = [], periodoActivo = 0, vistaActiva = 'dashboard', charts = {};
    var presupCat = {}, presupSub = {}, _metas = [], _recurrentes = [], _settings = {};
    var _configLoaded = false;
    var _activos = [], _pasivos = [], _patrimonioHistory = [], _patrimonioMovimientos = [];
    var _etiquetas = ['trabajo', 'familia', 'viaje', 'salud', 'ocio', 'urgente'], _etiquetasActivas = [];
    var meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var mesesFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    var diasSem = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    var mesActual = new Date().getMonth() + 1;
    var catColors = ['#3a6a8a', '#5a4a7a', '#4a7a5a', '#8a6a3a', '#7a4a4a', '#4a6a7a', '#6a7a4a', '#8a4a6a'];
    var gColor = 'rgba(255,255,255,0.04)';
    var ttOpts = { backgroundColor: '#0d0d10', borderColor: '#1e1e28', borderWidth: 1, titleFont: { size: 11 }, bodyFont: { size: 11 }, padding: 10 };
    window._moneda = 'S/'; window._metaAhorro = 30;
    var PAGE_SIZE = 25, currentPage = 1;
    var calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
    var _weekStart = 0; // loaded from Firestore _settings on app ready
    Chart.defaults.color = '#52505c';
    Chart.defaults.font = { family: "'IBM Plex Sans',sans-serif", size: 10, weight: '300' };

    /* TOAST */
    function toast(msg, type, dur) {
      type = type || 'info'; dur = dur || 3000;
      var c = document.getElementById('toastContainer');
      var t = document.createElement('div'); t.className = 'toast ' + type;
      t.innerHTML = '<div class="toast-dot"></div><div class="toast-msg">' + msg + '</div><button class="toast-x" onclick="removeToast(this.parentElement)">&#x2715;</button>';
      c.appendChild(t);
      setTimeout(function () { removeToast(t); }, dur);
    }
    function removeToast(t) { if (!t || !t.parentElement) return; t.classList.add('out'); setTimeout(function () { if (t.parentElement) t.parentElement.removeChild(t); }, 300); }
    function cloneData(obj) { return JSON.parse(JSON.stringify(obj)); }

    /* FMT */
    function fmt(n) { return (window._moneda || 'S/') + ' ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    /* AUTH */
    function loginConGoogle() { if (window._loginGoogle) window._loginGoogle(); }
    function logout() { if (confirm('Cerrar sesion?')) window._logout(); }


    /* ===== CHART DRILL-DOWN ===== */
    function openDrill(titulo, filtroFn, tipo) {
      var panel = document.getElementById('drillPanel');
      var titleEl = document.getElementById('drillTitle');
      var body = document.getElementById('drillBody');
      if (!panel) return;

      var rows = getRows(periodoActivo).filter(filtroFn);
      rows.sort(function (a, b) {
        var ta = a.createdAt ? a.createdAt.seconds || 0 : 0;
        var tb = b.createdAt ? b.createdAt.seconds || 0 : 0;
        return tb - ta;
      });

      titleEl.textContent = (tipo || '').toUpperCase() + ' ? ' + titulo + ' (' + rows.length + ' registros)';
      body.innerHTML = '';

      if (!rows.length) {
        body.innerHTML = '<div style="padding:20px 0;text-align:center;color:var(--muted);font-size:12px">Sin registros para este filtro</div>';
        panel.classList.add('show');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      var total = rows.reduce(function (s, r) { return s + r.monto; }, 0);
      rows.forEach(function (r) {
        var isG = r.tipo === 'gasto';
        var div = document.createElement('div'); div.className = 'drill-row';
        var left = document.createElement('div'); left.className = 'drill-row-left';
        var desc = document.createElement('div'); desc.className = 'drill-row-desc';
        desc.textContent = (r.descripcion || r.subcategoria || r.categoria || '-');
        var sub = document.createElement('div'); sub.className = 'drill-row-sub';
        sub.textContent = (r.fecha || '-') + (r.subcategoria ? ' ? ' + r.subcategoria : '') + (r.nota ? ' ? ' + r.nota : '');
        left.appendChild(desc); left.appendChild(sub);
        var amt = document.createElement('div');
        amt.className = 'drill-row-amt ' + (isG ? 'r' : 'g');
        amt.textContent = (isG ? '-' : '+') + fmt(r.monto);
        div.appendChild(left); div.appendChild(amt);
        body.appendChild(div);
      });

      // Summary
      var sum = document.createElement('div'); sum.className = 'drill-summary';
      sum.innerHTML = '<div class="drill-sum-item">Total <span>' + fmt(total) + '</span></div>' +
        '<div class="drill-sum-item">Registros <span>' + rows.length + '</span></div>' +
        '<div class="drill-sum-item">Promedio <span>' + fmt(total / rows.length) + '</span></div>';
      body.appendChild(sum);

      panel.classList.add('show');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    function closeDrill() {
      var p = document.getElementById('drillPanel');
      if (p) p.classList.remove('show');
    }


    /* ===== SISTEMA DE SOBREGIRO ===== */
    function getSobregiroKey(rowOrSob, tipo) {
      var regId = rowOrSob && rowOrSob.registroId ? rowOrSob.registroId : rowOrSob && rowOrSob.id ? rowOrSob.id : '';
      return (tipo || rowOrSob.tipo || '') + '::' + regId;
    }
    function dedupeSobregirosLista(lista) {
      var map = {};
      (lista || []).forEach(function (item) {
        var key = getSobregiroKey(item, item.tipo || '');
        if (!key) return;
        if (!map[key]) map[key] = item;
        else if (map[key].pagado && !item.pagado) map[key] = item;
      });
      return Object.keys(map).map(function (k) { return map[k]; });
    }
    function dedupeAlertItems(lista, keyFn) {
      var map = {};
      (lista || []).forEach(function (item) {
        var key = keyFn(item);
        if (!key) return;
        if (!map[key]) map[key] = item;
      });
      return Object.keys(map).map(function (k) { return map[k]; });
    }
    function esSobregiroConPenalizacion(s) {
      return !!s && (s.tipo === 'SUELDO BBVA' || s.tipo === 'AHORRO AGORA');
    }
    function existeMovimientoPatrimonioSobregiro(registroId) {
      return _patrimonioMovimientos.some(function (m) {
        return m.registroId === registroId && m.categoria === 'SOBREGIRO' && (m.subcategoria || '').toUpperCase() === 'AHORRO AGORA';
      });
    }
    function sobregiroPatrimonioEliminado(registroId) {
      return _sobregiros.some(function (s) {
        return s.registroId === registroId && s.tipo === 'AHORRO AGORA' && s.movimientoEliminado;
      });
    }
    function existeGastoAutomaticoSobregiro(row, rows) {
      var partesFecha = (row.fecha || '').split('-');
      var anioUso = parseInt(partesFecha[0] || 0);
      var mesUso = parseInt(partesFecha[1] || 0);
      if (!anioUso || !mesUso) return false;
      var anioSig = mesUso === 12 ? anioUso + 1 : anioUso;
      var mesSig = mesUso === 12 ? 1 : mesUso + 1;
      var fechaGasto = anioSig + '-' + String(mesSig).padStart(2, '0') + '-01';
      return (rows || allRows || []).some(function (r) {
        var cat = (r.categoria || '').toUpperCase().trim();
        var sub = (r.subcategoria || '').toUpperCase().trim();
        var desc = (r.descripcion || '').toUpperCase();
        return r.tipo === 'gasto'
          && cat === 'SOBREGIRO'
          && sub === 'SUELDO BBVA'
          && r.fecha === fechaGasto
          && Math.abs((parseFloat(r.monto) || 0) - (parseFloat(row.monto) || 0)) < 0.001
          && (r.sobregiroSourceId === row.id || desc.indexOf((row.fecha || '').toUpperCase()) >= 0);
      });
    }
    async function detectarSobregiro(row, rows, opts) {
      opts = opts || {};
      if (row.tipo !== 'ingreso') return false;
      var cat = (row.categoria || '').toUpperCase().trim();
      var sub = (row.subcategoria || '').toUpperCase().trim();
      if (cat !== 'SOBREGIRO') return false;
      console.log('[SOBREGIRO] processing:', sub, row.monto, row.id);
      var cambios = false;

      if (sub === 'AHORRO AGORA') {
        var yaLog = _sobregiros.some(function (s) { return s.registroId === row.id && s.tipo === 'AHORRO AGORA'; });
        var yaMov = existeMovimientoPatrimonioSobregiro(row.id);
        var fechaBaseAgora = row.fecha || getTodayPatrimonio();
        var fechaAgoraParts = fechaBaseAgora.split('-');
        var alertStartAgora = new Date(parseInt(fechaAgoraParts[0] || 0), Math.max(0, parseInt(fechaAgoraParts[1] || 1) - 1), parseInt(fechaAgoraParts[2] || 1));
        var alertEndAgora = new Date(alertStartAgora);
        alertEndAgora.setDate(alertEndAgora.getDate() + 30);
        var creditoAgora = Math.round(row.monto * 0.10 * 100) / 100;
        if (sobregiroPatrimonioEliminado(row.id)) return false;
        if (yaLog && yaMov) return false;
        // Descuenta del activo AHORRO AGORA en Patrimonio
        var idx2 = _activos.findIndex(function (a) {
          return a.nombre.toUpperCase().replace(/\s+/g, '').includes('AGORA');
        });
        if (idx2 >= 0 && !yaMov) {
          var antes = _activos[idx2].monto;
          _activos[idx2].monto = Math.max(0, Math.round((_activos[idx2].monto - row.monto) * 100) / 100);
          registrarMovimientoPatrimonio({
            id: 'sob-ahorro-' + row.id,
            fecha: row.fecha || getTodayPatrimonio(),
            tipo: 'sobregiro',
            entidad: 'activo',
            nombre: _activos[idx2].nombre,
            monto: -row.monto,
            motivo: 'Salida por sobregiro desde ahorro',
            categoria: 'SOBREGIRO',
            subcategoria: 'AHORRO AGORA',
            registroId: row.id
          });
          await savePatrimonio();
          cambios = true;
          if (!opts.silent) toast('Patrimonio actualizado: AHORRO AGORA ' + fmt(antes) + ' ? ' + fmt(_activos[idx2].monto), 'info', 6000);
        } else {
          if (!yaMov && !opts.silent) toast('Activo AHORRO AGORA no encontrado en Patrimonio', 'err', 6000);
        }
        if (!yaLog) {
          // Register in sobregiros log with registroId to prevent re-processing
          _sobregiros.push({
            id: Date.now().toString(), registroId: row.id,
            fecha: row.fecha, monto: row.monto, tipo: 'AHORRO AGORA',
            creditoDeuda: creditoAgora,
            fechaAlerta: alertStartAgora.toISOString().split('T')[0],
            fechaVence: alertEndAgora.toISOString().split('T')[0],
            descripcion: row.descripcion || '',
            pagado: false,
            mostrarAlerta: true
          });
          _sobregiros = dedupeSobregirosLista(_sobregiros);
          await window._saveSobregiros(_sobregiros).catch(function (e) { console.error('saveSob:', e); });
          cambios = true;
          if (!opts.silent) toast('Penalizacion de ahorro: ' + fmt(creditoAgora) + ' registrada', 'info', 5000);
        }

      } else if (sub === 'SUELDO BBVA') {
        var yaLog2 = _sobregiros.some(function (s) { return s.registroId === row.id && s.tipo === 'SUELDO BBVA'; });
        // 1. Calcular fecha: dia 01 del mes siguiente al mes del registro
        var partesFecha = (row.fecha || new Date().toISOString().split('T')[0]).split('-');
        var anioUso = parseInt(partesFecha[0]);
        var mesUso = parseInt(partesFecha[1]); // 1-12
        var anioSig = mesUso === 12 ? anioUso + 1 : anioUso;
        var mesSig = mesUso === 12 ? 1 : mesUso + 1;
        var fechaGasto = anioSig + '-' + String(mesSig).padStart(2, '0') + '-01';

        if (!existeGastoAutomaticoSobregiro(row, rows)) {
          // 2. Registrar el gasto en Firestore con fecha del 01 del mes siguiente
          var ahora = new Date();
          var gastoFuturo = {
            fecha: fechaGasto,
            fecha_ingreso: ahora.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' }),
            hora_ingreso: ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            fechahora: ahora.toLocaleString('es-PE'),
            tipo: 'gasto',
            monto: row.monto,
            categoria: 'Sobregiro',
            subcategoria: 'Sueldo BBVA',
            descripcion: 'Descuento sobregiro del ' + row.fecha,
            sobregiroSourceId: row.id
          };
          await window._addRegistroFuturo(gastoFuturo)
            .then(function () {
              cambios = true;
              if (!opts.silent) toast('Gasto de ' + fmt(row.monto) + ' registrado para el ' + fechaGasto, 'info', 6000);
            })
            .catch(function (e) { console.error('addRegistroFuturo error:', e); if (!opts.silent) toast('Error creando gasto futuro', 'err'); });
        }

        // 3. Penalizacion: 10% como credito de deuda de ahorro
        var credito = Math.round(row.monto * 0.10 * 100) / 100;

        // 4. Fechas de alerta: mismo dia pero del mes siguiente, plazo 30 dias
        var diaUso = parseInt(partesFecha[2]);
        var alertStart = new Date(anioSig, mesSig - 1, diaUso);
        var alertEnd = new Date(alertStart); alertEnd.setDate(alertEnd.getDate() + 30);

        var sob = {
          id: Date.now().toString(),
          registroId: row.id,
          fecha: row.fecha,
          monto: row.monto,
          tipo: 'SUELDO BBVA',
          creditoDeuda: credito,
          fechaAlerta: alertStart.toISOString().split('T')[0],
          fechaVence: alertEnd.toISOString().split('T')[0],
          descripcion: row.descripcion || '',
          pagado: false,
          mostrarAlerta: true
        };
        if (!yaLog2) {
          _sobregiros.push(sob);
          _sobregiros = dedupeSobregirosLista(_sobregiros);
          await window._saveSobregiros(_sobregiros).catch(function (e) { console.error('saveSob:', e); });
          cambios = true;
          if (!opts.silent) toast('Penalizacion de ahorro: ' + fmt(credito) + ' registrada', 'info', 5000);
        }
      }
      return cambios;
    }
    async function reconciliarSobregiros(rows, prevIds, isFirstLoad) {
      var candidatos = (rows || []).filter(function (r) {
        return r.tipo === 'ingreso' && (r.categoria || '').toUpperCase() === 'SOBREGIRO';
      });
      var changed = false;
      for (var i = 0; i < candidatos.length; i++) {
        var r = candidatos[i];
        var esNuevo = !prevIds || !prevIds.has(r.id);
        if (isFirstLoad || esNuevo) {
          var applied = await detectarSobregiro(r, rows, { silent: isFirstLoad });
          if (applied) changed = true;
        }
      }
      if (changed) {
        _sobregiros = dedupeSobregirosLista(_sobregiros);
        renderPatrimonio();
        renderSobregiroAlertas();
      }
    }

    function renderSobregiroAlertas() {
      var seccion = document.getElementById('sobregiroAlertas');
      var lista = document.getElementById('sobregiroList');
      if (!seccion || !lista) return;

      var hoyDate = new Date();
      var hoy = hoyDate.toISOString().split('T')[0];
      var mesActual = hoyDate.getMonth() + 1;
      var anioActual = hoyDate.getFullYear();
      var pendientes = dedupeSobregirosLista(_sobregiros).filter(function (s) {
        if (s.pagado || !esSobregiroConPenalizacion(s) || s.mostrarAlerta === false || !s.fechaAlerta) return false;
        var partes = s.fechaAlerta.split('-');
        return parseInt(partes[0] || 0) === anioActual && parseInt(partes[1] || 0) === mesActual;
      });
      pendientes = dedupeAlertItems(pendientes, function (s) {
        return [s.registroId || '', s.tipo || '', s.fecha || '', s.monto || 0, s.creditoDeuda || 0, s.fechaAlerta || '', s.fechaVence || ''].join('|');
      }).sort(function (a, b) { return a.fechaAlerta > b.fechaAlerta ? 1 : -1; });

      if (!pendientes.length) { seccion.style.display = 'none'; return; }
      seccion.style.display = 'block';
      lista.innerHTML = '';

      pendientes.forEach(function (s) {
        var activa = s.fechaAlerta <= hoy;
        var vencida = s.fechaVence < hoy;
        var diasParaAlerta = Math.ceil((new Date(s.fechaAlerta) - new Date()) / (1000 * 60 * 60 * 24));
        var diasRestantes = Math.ceil((new Date(s.fechaVence) - new Date()) / (1000 * 60 * 60 * 24));

        var estado = vencida ? 'VENCIDA' : activa ? 'ACTIVA' : 'PROXIMA';
        var color = vencida ? 'var(--red-tx)' : activa ? 'var(--gold)' : 'var(--muted)';

        var div = document.createElement('div'); div.className = 'sob-alert';
        div.style.borderColor = vencida ? 'rgba(192,112,112,0.4)' : activa ? 'rgba(201,168,76,0.3)' : 'var(--border)';
        div.style.background = vencida ? 'var(--red-d)' : activa ? 'var(--gold-d)' : 'var(--s2)';

        var dot = document.createElement('div'); dot.className = 'sob-alert-dot';
        dot.style.background = color;

        var body2 = document.createElement('div'); body2.className = 'sob-alert-body';

        var title = document.createElement('div'); title.className = 'sob-alert-title';
        title.style.color = color;
        title.textContent = estado + ' - Penalizacion de sobregiro (' + fmt(s.creditoDeuda) + ')';

        var sub2 = document.createElement('div'); sub2.className = 'sob-alert-sub';
        var info = 'Registro ' + (s.registroId || s.id) + ' del ' + s.fecha + ' - ' + fmt(s.monto) + ' usados de ' + (s.tipo || 'sobregiro');
        if (vencida) info += ' - Vencio el ' + s.fechaVence;
        else if (activa) info += ' - Vence en ' + diasRestantes + ' dias (' + s.fechaVence + ')';
        else info += ' - Se activa el ' + s.fechaAlerta + ' (en ' + diasParaAlerta + ' dias)';
        sub2.textContent = info;

        var btnPag = document.createElement('button'); btnPag.className = 'row-btn';
        btnPag.textContent = 'Marcar como pagado'; btnPag.style.marginTop = '6px';
        btnPag.onclick = (function (id) {
          return function () {
            var found = _sobregiros.find(function (x) { return x.id === id; });
            if (found) { found.pagado = true; window._saveSobregiros(_sobregiros).catch(function () { }); }
            renderSobregiroAlertas(); toast('Penalizacion marcada como pagada', 'ok');
          };
        })(s.id);

        var amt = document.createElement('div'); amt.className = 'sob-alert-amt';
        amt.style.color = color; amt.textContent = fmt(s.creditoDeuda);

        body2.appendChild(title); body2.appendChild(sub2); body2.appendChild(btnPag);
        div.appendChild(dot); div.appendChild(body2); div.appendChild(amt);
        lista.appendChild(div);
      });
    }

    async function pagarSobregiro(id) {
      var s = _sobregiros.find(function (x) { return x.id === id; });
      if (!s) return;
      s.pagado = true;
      await window._saveSobregiros(_sobregiros).catch(function (e) { console.error(e); });
      renderSobregiroAlertas();
      toast('Credito de penalizacion marcado como pagado', 'ok');
    }


    /* ===================================================
       PROYECCION FIN DE MES
    =================================================== */
    /* ===================================================
       ALERTAS INTELIGENTES
    =================================================== */
    function generarSmartAlerts(rows, mes) {
      var alerts = [];
      var ing = rows.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var bal = ing - gas;

      // 1. Sobregiro > 30% ingresos
      var sobMes = _sobregiros.filter(function (s) {
        var m = parseInt((s.fecha || '').split('-')[1] || 0);
        return m === mes && esSobregiroConPenalizacion(s) && !s.pagado;
      });
      var totalSob = sobMes.reduce(function (s, x) { return s + x.monto; }, 0);
      if (totalSob > 0) {
        var ratioSob = ing > 0 ? totalSob / ing : 1;
        var tiposSob = {};
        sobMes.forEach(function (s) { tiposSob[s.tipo] = 1; });
        var origenes = Object.keys(tiposSob).sort().join(' y ');
        alerts.push({
          nivel: ratioSob > 0.3 ? 'alto' : 'medio',
          icon: ratioSob > 0.3 ? '!!' : '!',
          title: 'Sobregiro del ' + (Math.round(ratioSob * 100)) + '% de tus ingresos',
          sub: 'Usaste ' + fmt(totalSob) + ' en ' + origenes + '. ' + (ratioSob > 0.3 ? 'Riesgo financiero alto.' : 'Modera el uso de dinero futuro.')
        });
      }

      // 2. Gasto > 90% ingresos
      if (ing > 0 && gas / ing > 0.9) {
        alerts.push({
          nivel: 'alto', icon: '!!',
          title: 'Gastos al ' + (Math.round(gas / ing * 100)) + '% de tus ingresos',
          sub: 'Te quedan solo ' + fmt(bal) + ' de margen. Reduce gastos no esenciales esta semana.'
        });
      }

      // 3. Proyeccion deficit
      var hoy2 = new Date().getDate();
      var totalDias3 = new Date(new Date().getFullYear(), mes, 0).getDate();
      var gastoDiario2 = gas / Math.max(1, hoy2);
      var proyeccion2 = gastoDiario2 * totalDias3;
      if (proyeccion2 > ing && ing > 0) {
        alerts.push({
          nivel: 'medio', icon: '!',
          title: 'Proyeccion: deficit de ' + fmt(proyeccion2 - ing) + ' al fin de mes',
          sub: 'Al ritmo actual gastas ' + fmt(gastoDiario2) + '/dia. Necesitas reducir a ' + fmt(ing / totalDias3) + '/dia para equilibrar.'
        });
      }

      // 4. Presupuesto excedido
      var byCat2 = {};
      rows.filter(function (r) { return r.tipo === 'gasto'; }).forEach(function (r) { byCat2[r.categoria] = (byCat2[r.categoria] || 0) + r.monto; });
      Object.keys(presupCat).forEach(function (cat) {
        var pm = presupCat[cat].mensual || 0;
        if (pm > 0 && (byCat2[cat] || 0) > pm) {
          alerts.push({
            nivel: 'medio', icon: '!',
            title: 'Presupuesto de ' + cat + ' excedido',
            sub: 'Gastaste ' + fmt(byCat2[cat] || 0) + ' de un limite de ' + fmt(pm) + ' (+' + fmt((byCat2[cat] || 0) - pm) + ')'
          });
        }
      });

      // 5. Limite de alertas excedido
      var limites2 = getLimites();
      Object.keys(limites2).forEach(function (cat) {
        if ((byCat2[cat] || 0) > limites2[cat]) {
          alerts.push({
            nivel: 'alto', icon: '!!',
            title: 'Limite de ' + cat + ' superado',
            sub: 'Limite: ' + fmt(limites2[cat]) + ' ? Gastado: ' + fmt(byCat2[cat] || 0)
          });
        }
      });

      // 6. Todo bien
      if (!alerts.length) {
        alerts.push({
          nivel: 'bajo', icon: 'ok',
          title: 'Finanzas en orden este mes',
          sub: 'Sin alertas criticas. Sigue con este comportamiento financiero.'
        });
      }

      return alerts;
    }

    function renderSmartAlerts(rows, mes) {
      var cont = document.getElementById('smartAlertsList');
      if (!cont) return;
      var alerts = dedupeAlertItems(generarSmartAlerts(rows, mes), function (a) {
        return [(a.nivel || ''), (a.icon || ''), (a.title || ''), (a.sub || '')].join('|');
      });
      cont.innerHTML = '';
      alerts.forEach(function (a) {
        var div = document.createElement('div');
        div.className = 'smart-alert nivel-' + (a.nivel === 'alto' ? 'alto' : a.nivel === 'medio' ? 'medio' : a.nivel === 'bajo' ? 'bajo' : 'info');
        div.innerHTML = '<div class="smart-alert-icon">' + a.icon + '</div>' +
          '<div class="smart-alert-body"><div class="smart-alert-title">' + a.title + '</div>' +
          '<div class="smart-alert-sub">' + a.sub + '</div></div>';
        cont.appendChild(div);
      });
    }

    /* SIDEBAR */
    function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sbOverlay').classList.toggle('show'); }
    function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sbOverlay').classList.remove('show'); }

    /* RESPONSIVE */
    function handleResize() {
      var mob = window.innerWidth <= 768;
      document.getElementById('mobileSel').style.display = mob ? 'block' : 'none';
    }
    window.addEventListener('resize', handleResize);

    /* KEYBOARD */
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { hideEditModal(); hideMetaModal(); document.getElementById('confirmOv').classList.remove('show'); closeSidebar(); }
    });

    /* DATA */
    function getRows(m) { return m ? allRows.filter(function (r) { return r.mes === m; }) : allRows; }

    function processRows(raw) {
      return raw.map(function (r) {
        var fechaRaw = r.fecha || '';
        var mes = 0;
        var fm = String(fechaRaw).match(/(\d{4})-(\d{2})-(\d{2})/);
        if (fm) mes = parseInt(fm[2]);
        var fi = r.fecha_ingreso || '';
        if (!fi && r.fechahora) { var p = String(r.fechahora).match(/(\d{2})\/(\d{2})\/(\d{4})/); if (p) fi = p[3] + '-' + p[2] + '-' + p[1]; }
        return {
          id: r.id, fecha: fechaRaw, fecha_ingreso: fi, hora_ingreso: r.hora_ingreso || '',
          fechahora: r.fechahora || '', tipo: String(r.tipo || '').toLowerCase().trim(),
          monto: parseFloat(r.monto) || 0, categoria: r.categoria || '', subcategoria: r.subcategoria || '',
          descripcion: r.descripcion || '', nota: r.nota || '', etiquetas: r.etiquetas || [],
          mes: mes, createdAt: r.createdAt
        };
      }).filter(function (r) { return r.tipo === 'gasto' || r.tipo === 'ingreso'; });
    }

    function setPeriod(m) {
      periodoActivo = m;
      document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('p' + m).classList.add('active');
      var mob = document.getElementById('mobileSel'); if (mob) mob.value = m;
      if (allRows.length) renderVista();
    }

    var viewNames = { dashboard: 'Dashboard', presupuesto: 'Presupuesto', historial: 'Historial', alertas: 'Alertas', calendario: 'Calendario', recurrentes: 'Recurrentes', patrimonio: 'Patrimonio', ajustes: 'Ajustes' };
    var viewIds = ['vDashboard', 'vPresupuesto', 'vHistorial', 'vAlertas', 'vCalendario', 'vRecurrentes', 'vPatrimonio', 'vAjustes'];

    function showView(v, el) {
      vistaActiva = v; currentPage = 1;
      viewIds.forEach(function (id) { var e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.remove('view-active'); } });
      var target = document.getElementById('v' + v.charAt(0).toUpperCase() + v.slice(1));
      if (target) { target.style.display = 'block'; requestAnimationFrame(function () { target.classList.add('view-active'); }); }
      document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
      if (el) el.classList.add('active');
      document.getElementById('viewTitle').textContent = viewNames[v] || v;
      document.getElementById('loading').style.display = 'none';
      document.getElementById('errorBox').style.display = 'none';
      closeSidebar();
      renderVista();
    }

    function renderVista() {
      document.getElementById('loading').style.display = 'none';
      if (vistaActiva === 'dashboard') renderDashboard();

      else if (vistaActiva === 'presupuesto') renderPresupuesto();
      else if (vistaActiva === 'historial') renderHistorial();
      else if (vistaActiva === 'alertas') renderAlertas();
      else if (vistaActiva === 'calendario') renderCalendario();
      else if (vistaActiva === 'recurrentes') renderRecurrentes();
      else if (vistaActiva === 'patrimonio') {
        if (window._loadPatrimonio) {
          window._loadPatrimonio().then(function (d) {
            _activos = d.activos || [];
            _pasivos = d.pasivos || [];
            _patrimonioHistory = d.history || [];
            _patrimonioMovimientos = d.movimientos || [];
            renderPatrimonio();
          }).catch(function () { renderPatrimonio(); });
        } else { renderPatrimonio(); }
      }
      else if (vistaActiva === 'ajustes') renderStatsSystem();
    }

    function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

    /* POCKET */
    function renderPocket(rows) {
      var ing = rows.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var hoy = new Date().getDate();
      var mesActualNum = new Date().getMonth();
      var anioActual = new Date().getFullYear();
      var mesKey = anioActual + '-' + String(mesActualNum + 1).padStart(2, '0');

      // Separate paid, pending (dia > hoy), vencido (dia < hoy, not paid)
      var fijosP = 0, fijosV = 0;
      _recurrentes.forEach(function (r) {
        var pagadoEsteMes = r.pagos && r.pagos[mesKey] === true;
        if (pagadoEsteMes) return; // already paid, don't count
        var m = parseFloat(r.monto) || 0;
        if (r.dia > hoy) fijosP += m;       // pending (not yet due)
        else if (r.dia <= hoy) fijosV += m; // overdue
      });

      var disp = ing - gas - fijosP - fijosV;
      var el = document.getElementById('pocketAmt'); if (!el) return;
      el.textContent = fmt(disp);
      el.className = 'pocket-amt ' + (disp >= 0 ? 'pos' : 'neg');

      var elIng = document.getElementById('pocketIng');
      var elGas = document.getElementById('pocketGas');
      var elFij = document.getElementById('pocketFijos');
      var elVenc = document.getElementById('pocketVenc');
      var elVencW = document.getElementById('pocketVencWrap');

      if (elIng) elIng.textContent = fmt(ing);
      if (elGas) elGas.textContent = fmt(gas);
      if (elFij) elFij.textContent = fmt(fijosP);
      if (elVenc) elVenc.textContent = fmt(fijosV);
      if (elVencW) elVencW.style.display = fijosV > 0 ? 'block' : 'none';

      var pct = ing > 0 ? Math.min(100, ((gas + fijosP + fijosV) / ing) * 100) : 0;
      var fc = pct > 90 ? 'var(--red-tx)' : pct > 70 ? 'var(--gold)' : 'var(--green-tx)';
      var fill = document.getElementById('pocketFill');
      if (fill) { fill.style.width = pct + '%'; fill.style.background = fc; }
    }

    /* WEEKLY */
    function getWeekRows(offset) {
      var now = new Date();
      var diff = (now.getDay() - _weekStart + 7) % 7;
      var s = new Date(now); s.setDate(now.getDate() - diff + (offset * 7)); s.setHours(0, 0, 0, 0);
      var e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
      return allRows.filter(function (r) { if (!r.fecha || r.tipo !== 'gasto') return false; var d = new Date(r.fecha + 'T12:00:00'); return d >= s && d <= e; });
    }
    function renderWeekly() {
      var tw = getWeekRows(0), lw = getWeekRows(-1);
      var tt = tw.reduce(function (s, r) { return s + r.monto; }, 0);
      var lt = lw.reduce(function (s, r) { return s + r.monto; }, 0);
      var el = document.getElementById('wkGas'); if (!el) return;
      el.textContent = fmt(tt);
      var wd = document.getElementById('wkDelta');
      if (lt > 0) { var pct = Math.round((tt - lt) / lt * 100); wd.textContent = (pct >= 0 ? '+' : '') + pct + '% vs semana pasada'; wd.className = 'weekly-delta ' + (pct >= 0 ? 'down' : 'up'); }
      else { wd.textContent = 'Primera semana'; wd.className = 'weekly-delta neu'; }
      var bc = {}; tw.forEach(function (r) { bc[r.categoria] = (bc[r.categoria] || 0) + r.monto; });
      var sorted = Object.keys(bc).sort(function (a, b) { return bc[b] - bc[a]; }).slice(0, 3);
      var cont = document.getElementById('wkTopCats'); if (!cont) return;
      cont.innerHTML = '';
      if (!sorted.length) { cont.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px 0">Sin gastos esta semana</div>'; return; }
      sorted.forEach(function (cat, i) { cont.innerHTML += '<div class="top-cat-row"><div class="top-cat-dot" style="background:' + catColors[i % catColors.length] + '"></div><div class="top-cat-name">' + cat + '</div><div class="top-cat-amt">' + fmt(bc[cat]) + '</div></div>'; });
    }

    /* DASHBOARD */
    function renderDashboard() {
      document.getElementById('dashPage').style.display = 'block';
      var rows = getRows(periodoActivo);
      var ing = rows.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var bal = ing - gas, aho = ing > 0 ? Math.round(bal / ing * 100) : 0;
      document.getElementById('mIng').textContent = fmt(ing);
      document.getElementById('mGas').textContent = fmt(gas);
      document.getElementById('mBal').textContent = fmt(bal);
      document.getElementById('mAho').textContent = aho + '%';
      document.getElementById('lblEvol').textContent = periodoActivo ? meses[periodoActivo - 1] : 'anio';
      var meta = window._metaAhorro || 30;
      document.getElementById('dAho').textContent = aho >= meta ? 'Meta cumplida' : 'Meta: ' + meta + '%';
      document.getElementById('dAho').className = 'm-delta' + (aho >= meta ? ' up' : '');
      if (periodoActivo > 1) {
        var pr = getRows(periodoActivo - 1);
        var pI = pr.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
        var pG = pr.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
        setDelta('dIng', ing, pI, false); setDelta('dGas', gas, pG, true); setDelta('dBal', bal, pI - pG, false);
      } else['dIng', 'dGas', 'dBal'].forEach(function (id) { document.getElementById(id).textContent = ''; });
      checkAlertas(rows);
      renderPocket(getRows(periodoActivo || mesActual));
      renderWeekly();
      var mesDash = periodoActivo || mesActual;
      buildEvol(); buildDonut(rows); buildComp(); buildTop(rows); buildProyec();
    }

    function setDelta(id, curr, prev, inv) {
      var el = document.getElementById(id); if (!prev) { el.textContent = ''; return; }
      var pct = Math.round((curr - prev) / prev * 100), up = pct >= 0;
      el.textContent = (up ? '+' : '') + pct + '% vs mes anterior';
      el.className = 'm-delta ' + ((inv ? !up : up) ? 'up' : 'down');
    }

    function buildEvol() {
      var iD = [], gD = [], bD = [];
      for (var m = 1; m <= 12; m++) { var r = getRows(m); var i = r.filter(function (x) { return x.tipo === 'ingreso'; }).reduce(function (s, x) { return s + x.monto; }, 0); var g = r.filter(function (x) { return x.tipo === 'gasto'; }).reduce(function (s, x) { return s + x.monto; }, 0); iD.push(i); gD.push(g); bD.push(i - g); }
      destroyChart('cEvol');
      charts['cEvol'] = new Chart(document.getElementById('cEvol'), { type: 'line', data: { labels: meses, datasets: [{ label: 'Ingresos', data: iD, borderColor: '#3d7a5c', backgroundColor: 'rgba(61,122,92,.05)', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#3d7a5c', tension: .4, fill: true }, { label: 'Gastos', data: gD, borderColor: '#8a3a3a', backgroundColor: 'rgba(138,58,58,.05)', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#8a3a3a', tension: .4, fill: true }, { label: 'Balance', data: bD, borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,.03)', borderWidth: 1, pointRadius: 2, pointBackgroundColor: '#c9a84c', tension: .4, borderDash: [4, 3] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var m = els[0].index + 1; var ds = els[0].datasetIndex; openDrill(meses[els[0].index] + (ds === 0 ? ' - Ingresos' : ds === 1 ? ' - Gastos' : ' - Balance'), function (r) { return r.mes === m && (ds === 0 ? r.tipo === 'ingreso' : ds === 1 ? r.tipo === 'gasto' : true); }, ''); } }, scales: { x: { grid: { color: gColor } }, y: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
    }

    function buildDonut(rows) {
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }), bc = {};
      gas.forEach(function (r) { bc[r.categoria] = (bc[r.categoria] || 0) + r.monto; });
      var cats = Object.keys(bc).sort(function (a, b) { return bc[b] - bc[a]; }), vals = cats.map(function (c) { return bc[c]; }), colors = cats.map(function (_, i) { return catColors[i % catColors.length]; }), total = vals.reduce(function (s, v) { return s + v; }, 0);
      destroyChart('cDonut');
      if (!cats.length) { document.getElementById('legDonut').innerHTML = '<span style="color:var(--muted);font-size:11px">Sin gastos este periodo</span>'; return; }
      charts['cDonut'] = new Chart(document.getElementById('cDonut'), { type: 'doughnut', data: { labels: cats, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var cat = cats[els[0].index]; openDrill(cat, function (r) { return r.tipo === 'gasto' && r.categoria === cat; }, 'gasto'); } } } });
      var leg = document.getElementById('legDonut'); leg.innerHTML = '';
      cats.forEach(function (c, i) { var pct = total > 0 ? Math.round(bc[c] / total * 100) : 0; leg.innerHTML += '<div class="leg-item"><div class="leg-sq" style="background:' + colors[i] + '"></div>' + c + ' ' + pct + '%</div>'; });
    }

    function buildComp() {
      var show = periodoActivo > 0 ? [Math.max(1, periodoActivo - 2), Math.max(1, periodoActivo - 1), periodoActivo] : [Math.max(1, mesActual - 2), Math.max(1, mesActual - 1), mesActual];
      var iD = [], gD = [], lbl = [];
      show.forEach(function (m) { var r = getRows(m); iD.push(r.filter(function (x) { return x.tipo === 'ingreso'; }).reduce(function (s, x) { return s + x.monto; }, 0)); gD.push(r.filter(function (x) { return x.tipo === 'gasto'; }).reduce(function (s, x) { return s + x.monto; }, 0)); lbl.push(meses[m - 1]); });
      destroyChart('cComp');
      charts['cComp'] = new Chart(document.getElementById('cComp'), { type: 'bar', data: { labels: lbl, datasets: [{ label: 'Ingresos', data: iD, backgroundColor: 'rgba(61,122,92,.65)', borderRadius: 2 }, { label: 'Gastos', data: gD, backgroundColor: 'rgba(138,58,58,.65)', borderRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var m = els[0].index + 1; var ds = els[0].datasetIndex; openDrill(meses[els[0].index] + (ds === 0 ? ' - Ingresos' : ds === 1 ? ' - Gastos' : ' - Balance'), function (r) { return r.mes === m && (ds === 0 ? r.tipo === 'ingreso' : ds === 1 ? r.tipo === 'gasto' : true); }, ''); } }, scales: { x: { grid: { color: gColor } }, y: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
    }

    function buildTop(rows) {
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }), bc = {};
      gas.forEach(function (r) { bc[r.categoria] = (bc[r.categoria] || 0) + r.monto; });
      var sorted = Object.keys(bc).sort(function (a, b) { return bc[b] - bc[a]; }).slice(0, 5), vals = sorted.map(function (c) { return bc[c]; }), colors = sorted.map(function (_, i) { return catColors[i % catColors.length]; });
      destroyChart('cTop'); if (!sorted.length) return;
      charts['cTop'] = new Chart(document.getElementById('cTop'), { type: 'bar', data: { labels: sorted, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var cat = sorted[els[0].index]; openDrill(cat, function (r) { return r.tipo === 'gasto' && r.categoria === cat; }, 'gasto'); } }, scales: { x: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } }, y: { grid: { display: false } } } } });
    }

    function buildProyec() {
      var acum = 0, data = [], proy = [], last = 0;
      for (var m = 1; m <= 12; m++) { var r = getRows(m); var i = r.filter(function (x) { return x.tipo === 'ingreso'; }).reduce(function (s, x) { return s + x.monto; }, 0); var g = r.filter(function (x) { return x.tipo === 'gasto'; }).reduce(function (s, x) { return s + x.monto; }, 0); if (i > 0 || g > 0) { acum += (i - g); last = m; } data.push(m <= mesActual ? acum : null); proy.push(m >= mesActual ? acum : null); }
      var avg = last > 0 ? acum / last : 0;
      for (var m2 = mesActual + 1; m2 <= 12; m2++) { acum += avg; data[m2 - 1] = null; proy[m2 - 1] = Math.round(acum); }
      destroyChart('cProyec');
      charts['cProyec'] = new Chart(document.getElementById('cProyec'), { type: 'line', data: { labels: meses, datasets: [{ label: 'Real', data: data, borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,.06)', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#c9a84c', tension: .4, fill: true }, { label: 'Proyeccion', data: proy, borderColor: '#c9a84c', borderDash: [5, 4], borderWidth: 1, pointRadius: 0, tension: .4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var m = els[0].index + 1; var ds = els[0].datasetIndex; openDrill(meses[els[0].index] + (ds === 0 ? ' - Ingresos' : ds === 1 ? ' - Gastos' : ' - Balance'), function (r) { return r.mes === m && (ds === 0 ? r.tipo === 'ingreso' : ds === 1 ? r.tipo === 'gasto' : true); }, ''); } }, scales: { x: { grid: { color: gColor } }, y: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
    }

    /* METAS */
    /* PRESUPUESTO */
    function diasMes(m) { return new Date(new Date().getFullYear(), m, 0).getDate(); }
    async function savePresupuestos() { await window._savePresupuestos({ cats: presupCat, subs: presupSub }); }
    function renderPresupuesto() {
      var mes = periodoActivo || (new Date().getMonth() + 1);
      var rows = getRows(mes);
      var gastos = rows.filter(function (r) { return r.tipo === 'gasto'; });
      var totalDias = diasMes(mes);
      var diaHoy = (periodoActivo === (new Date().getMonth() + 1) || periodoActivo === 0) ? new Date().getDate() : totalDias;
      var rf = diaHoy / totalDias;
      var cats = [], catSet = {};
      allRows.forEach(function (r) { if (r.categoria && !catSet[r.categoria]) { catSet[r.categoria] = 1; cats.push(r.categoria); } });
      cats.sort();
      ['pCatSel', 'pSubCatSel'].forEach(function (id) { var sel = document.getElementById(id); if (sel) { sel.innerHTML = '<option value="">Categoria...</option>'; cats.forEach(function (c) { sel.innerHTML += '<option value="' + c + '">' + c + '</option>'; }); } });
      var alertSel = document.getElementById('alertCat'); if (alertSel) { alertSel.innerHTML = '<option value="">Categoria...</option>'; cats.filter(function (c) { return allRows.some(function (r) { return r.categoria === c && r.tipo === 'gasto'; }); }).sort().forEach(function (c) { alertSel.innerHTML += '<option value="' + c + '">' + c + '</option>'; }); }
      var byCat = {}, bySub = {};
      gastos.forEach(function (r) { byCat[r.categoria] = (byCat[r.categoria] || 0) + r.monto; var k = r.categoria + '||' + r.subcategoria; bySub[k] = (bySub[k] || 0) + r.monto; });
      var catsConP = Object.keys(presupCat);
      var totP = catsConP.reduce(function (s, c) { return s + (presupCat[c].mensual || 0); }, 0);
      var totG = catsConP.reduce(function (s, c) { return s + (byCat[c] || 0); }, 0);
      var totE = totP * rf;
      var ratio = totE > 0 ? totG / totE : 0;
      var resCls = ratio > 1 ? 'bad' : ratio > 0.85 ? 'warn' : 'ok';
      var ps = document.getElementById('presStats');
      ps.innerHTML = '<div class="ps-card"><div class="ps-lbl">Presupuesto mes</div><div class="ps-val">' + fmt(totP) + '</div></div><div class="ps-card"><div class="ps-lbl">Gastado</div><div class="ps-val ' + resCls + '">' + fmt(totG) + '</div></div><div class="ps-card"><div class="ps-lbl">Ritmo esperado dia ' + diaHoy + '/' + totalDias + '</div><div class="ps-val">' + fmt(totE) + '</div></div>';
      var catsEl = document.getElementById('presCats'); catsEl.innerHTML = '';
      if (!catsConP.length) { catsEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:16px 0">Configura tu primer presupuesto abajo.</div>'; renderPresupLists(); return; }
      catsConP.forEach(function (cat) {
        var pm = presupCat[cat].mensual || 0, pd = presupCat[cat].diario || 0;
        var gastado = byCat[cat] || 0;
        var esSoloMensual = pm > 0 && pd === 0; // Solo mensual, sin gestion diaria
        var esDiario = pd > 0; // Tiene presupuesto diario

        // ?? MODO SOLO MENSUAL: pago puntual, no se gestiona por ritmo diario
        var cls, barC, diff = 0, pctG = 0, pctE = 0;
        var infoExtra = '';
        var ajusteDiario = null;

        if (esSoloMensual) {
          // Solo mostrar progreso simple: cuanto llevo del total mensual
          pctG = pm > 0 ? Math.min(gastado / pm * 100, 100) : 0;
          cls = gastado > pm ? 'bad' : gastado > pm * 0.9 ? 'warn' : 'ok';
          barC = cls === 'bad' ? 'var(--red-tx)' : cls === 'warn' ? 'var(--gold)' : 'var(--green-tx)';
          infoExtra = '<div style="font-size:9px;color:var(--muted);margin-top:4px">Pago mensual - sin gestion diaria</div>';
        } else {
          // ?? MODO CON GESTION DIARIA (tiene presupuesto diario o mensual dividido)
          var diasRestantes = totalDias - diaHoy;
          var presupuestoDiario = pd > 0 ? pd : Math.round(pm / totalDias);
          var esperadoHastaHoy = presupuestoDiario * diaHoy;
          diff = gastado - esperadoHastaHoy;

          pctG = pm > 0 ? Math.min(gastado / pm * 100, 100) : 0;
          pctE = Math.min((esperadoHastaHoy / pm) * 100, 100);
          cls = gastado > pm ? 'bad' : gastado > esperadoHastaHoy * 1.05 ? 'warn' : 'ok';
          barC = cls === 'bad' ? 'var(--red-tx)' : cls === 'warn' ? 'var(--gold)' : 'var(--green-tx)';

          // Calculo ajustado para dias restantes
          if (diasRestantes > 0) {
            var montoRestante = Math.max(0, pm - gastado);
            var diarioAjustado = Math.round(montoRestante / diasRestantes);
            var diferenciaVsOriginal = diarioAjustado - presupuestoDiario;
            ajusteDiario = {
              original: presupuestoDiario,
              ajustado: diarioAjustado,
              diferencia: diferenciaVsOriginal,
              dias: diasRestantes,
              restante: montoRestante
            };
          }
        }

        var subKeys = Object.keys(presupSub).filter(function (k) { return k.indexOf(cat + '||') === 0; });
        var card = document.createElement('div'); card.className = 'pc-card';

        var html = '<div class="pc-head" onclick="toggleSubsP(this)">';
        html += '<div><div class="pc-name">' + cat + '</div><div class="pc-meta">';
        if (esSoloMensual) html += fmt(pm) + '/mes (mensual puntual)';
        else if (pd > 0) html += fmt(pd) + '/dia - ' + fmt(pm) + '/mes';
        else html += fmt(pm) + '/mes (' + fmt(Math.round(pm / totalDias)) + '/dia estimado)';
        html += '</div></div>';
        html += '<div class="pc-right"><div class="pc-nums">';
        if (!esSoloMensual) html += '<div class="pc-diff ' + (diff > 0 ? 'bad' : 'ok') + '">' + (diff > 0 ? '+' : '') + diff.toFixed(2) + ' ' + (diff > 0 ? 'sobre' : 'bajo') + ' ritmo</div>';
        html += '<span class="pc-val ' + cls + '">' + fmt(gastado) + '</span><span style="font-size:10px;color:var(--muted)"> / ' + fmt(pm) + '</span>';
        html += '</div>';
        if (subKeys.length > 0) html += '<span class="chevron">&#9660;</span>';
        html += '</div></div>';

        // Barras
        html += '<div class="p-bars">';
        html += '<div class="p-bar-row"><span class="p-bar-lbl">Gastado</span><div class="p-bar-track"><div class="p-bar-fill" style="width:' + pctG + '%;background:' + barC + '"></div>' + (esSoloMensual ? '' : '<div class="p-bar-mk" style="left:' + pctE + '%"></div>') + '</div><span class="p-bar-pct ' + cls + '">' + Math.round(pctG) + '%</span></div>';
        if (!esSoloMensual) html += '<div class="p-bar-row"><span class="p-bar-lbl">Esperado</span><div class="p-bar-track"><div class="p-bar-fill" style="width:' + pctE + '%;background:var(--muted)"></div></div><span class="p-bar-pct">' + Math.round(pctE) + '%</span></div>';
        if (infoExtra) html += infoExtra;
        // ?? AJUSTE DIARIO INTELIGENTE
        if (ajusteDiario) {
          var adjColor = ajusteDiario.diferencia < 0 ? 'var(--green-tx)' : ajusteDiario.diferencia > 0 ? 'var(--red-tx)' : 'var(--muted)';
          var adjMsg;
          if (ajusteDiario.diferencia < 0) {
            adjMsg = 'Vas bien: puedes gastar ' + fmt(ajusteDiario.ajustado) + '/dia los proximos ' + ajusteDiario.dias + ' dias';
          } else if (ajusteDiario.diferencia === 0) {
            adjMsg = 'En ritmo exacto: ' + fmt(ajusteDiario.ajustado) + '/dia los proximos ' + ajusteDiario.dias + ' dias';
          } else if (gastado > pm) {
            adjMsg = 'Superaste el presupuesto mensual. Ajusta a ' + fmt(ajusteDiario.ajustado) + '/dia los proximos ' + ajusteDiario.dias + ' dias';
          } else {
            adjMsg = 'Ajusta a ' + fmt(ajusteDiario.ajustado) + '/dia los proximos ' + ajusteDiario.dias + ' dias';
          }
          html += '<div style="margin-top:8px;padding:8px 0 0;border-top:1px dashed var(--border)">' +
            '<div style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Ritmo ajustado</div>' +
            '<div style="font-size:11px;color:' + adjColor + '">' + adjMsg + '</div>' +
            '<div style="font-size:10px;color:var(--muted);margin-top:3px">Restante: ' + fmt(ajusteDiario.restante) + ' en ' + ajusteDiario.dias + ' dias</div>' +
            '</div>';
        }
        html += '</div>';
        if (subKeys.length > 0) {
          html += '<div class="p-subs">';
          subKeys.forEach(function (sk) {
            var sn = sk.split('||')[1], spm = presupSub[sk].mensual || 0;
            var sg = bySub[sk] || 0, se = spm * rf;
            var spG = spm > 0 ? Math.min(sg / spm * 100, 100) : 0, spE = Math.min(rf * 100, 100);
            var scls = sg > spm ? 'bad' : sg > se * 1.05 ? 'warn' : 'ok';
            var sbar = scls === 'bad' ? 'var(--red-tx)' : scls === 'warn' ? 'var(--gold)' : 'var(--green-tx)';
            var sdiff2 = Math.round((sg - se) * 100) / 100;
            var sdiffTxt = (sdiff2 > 0 ? '+' : '') + sdiff2.toFixed(2) + ' ' + (sdiff2 > 0 ? 'sobre' : 'bajo') + ' ritmo';
            html += '<div class="p-sub-row"><div class="p-sub-name">' + sn + '</div><div class="p-sub-bars">' +
              '<div class="p-sub-brow"><span class="p-sub-lbl">Gastado</span><div class="p-sub-track"><div class="p-sub-fill" style="width:' + spG + '%;background:' + sbar + '"></div><div class="p-sub-mk" style="left:' + spE + '%"></div></div><span class="p-sub-amt" style="color:' + sbar + '">' + fmt(sg) + ' / ' + fmt(spm) + '</span></div>' +
              '<div class="p-sub-brow"><span class="p-sub-lbl">Esperado</span><div class="p-sub-track"><div class="p-sub-fill" style="width:' + spE + '%;background:var(--muted);opacity:.6"></div></div><span class="p-sub-amt" style="color:var(--muted)">' + sdiffTxt + '</span></div>' +
              '</div></div>';
          });
          html += '</div>';
        }
        card.innerHTML = html; catsEl.appendChild(card);
      });
      renderPresupLists();
    }
    function toggleSubsP(h) { var c = h.parentElement, s = c.querySelector('.p-subs'), ch = h.querySelector('.chevron'); if (s) s.classList.toggle('open'); if (ch) ch.classList.toggle('open'); }
    function loadSubcats() {
      var cat = document.getElementById('pSubCatSel').value;
      var sel = document.getElementById('pSubSel'); sel.innerHTML = '<option value="">Subcategoria...</option>';
      if (!cat) return;
      var set = {}; allRows.filter(function (r) { return r.categoria === cat; }).forEach(function (r) { if (r.subcategoria) set[r.subcategoria] = 1; });
      Object.keys(set).sort().forEach(function (s) { sel.innerHTML += '<option value="' + s + '">' + s + '</option>'; });
    }
    async function guardarPresupCat() {
      var prevCat = cloneData(presupCat), prevSub = cloneData(presupSub);
      var cat = document.getElementById('pCatSel').value, mens = parseFloat(document.getElementById('pMens').value) || 0, daily = parseFloat(document.getElementById('pDaily').value) || 0;
      if (!cat || (!mens && !daily)) { toast('Selecciona categoria y monto', 'err'); return; }
      if (daily > 0 && !mens) mens = daily * diasMes(periodoActivo || (new Date().getMonth() + 1));
      presupCat[cat] = { mensual: mens, diario: daily };
      try { await savePresupuestos(); toast('Presupuesto guardado', 'ok'); }
      catch (e) { presupCat = prevCat; presupSub = prevSub; toast('No se pudo guardar en la nube', 'err'); }
      document.getElementById('pMens').value = ''; document.getElementById('pDaily').value = '';
      renderPresupuesto();
    }
    async function guardarPresupSub() {
      var prevCat = cloneData(presupCat), prevSub = cloneData(presupSub);
      var cat = document.getElementById('pSubCatSel').value, sub = document.getElementById('pSubSel').value, mens = parseFloat(document.getElementById('pSubMens').value) || 0, daily = parseFloat(document.getElementById('pSubDaily').value) || 0;
      if (!cat || !sub || (!mens && !daily)) { toast('Completa todos los campos', 'err'); return; }
      if (daily > 0 && !mens) mens = daily * diasMes(periodoActivo || (new Date().getMonth() + 1));
      presupSub[cat + '||' + sub] = { mensual: mens, diario: daily };
      try { await savePresupuestos(); toast('Subcategoria guardada', 'ok'); }
      catch (e) { presupCat = prevCat; presupSub = prevSub; toast('No se pudo guardar en la nube', 'err'); }
      document.getElementById('pSubMens').value = ''; document.getElementById('pSubDaily').value = '';
      renderPresupuesto();
    }
    async function elimPresupCat(cat) {
      var prevCat = cloneData(presupCat), prevSub = cloneData(presupSub);
      delete presupCat[cat];
      try { await savePresupuestos(); toast('Eliminado', 'info'); }
      catch (e) { presupCat = prevCat; presupSub = prevSub; toast('No se pudo eliminar en la nube', 'err'); }
      renderPresupuesto();
    }
    async function elimPresupSub(key) {
      var prevCat = cloneData(presupCat), prevSub = cloneData(presupSub);
      delete presupSub[key];
      try { await savePresupuestos(); toast('Eliminado', 'info'); }
      catch (e) { presupCat = prevCat; presupSub = prevSub; toast('No se pudo eliminar en la nube', 'err'); }
      renderPresupuesto();
    }
    function renderPresupLists() {
      var l1 = document.getElementById('pCatList'), l2 = document.getElementById('pSubList');
      if (l1) { l1.innerHTML = ''; Object.keys(presupCat).forEach(function (c) { var pm = presupCat[c].mensual, pd = presupCat[c].diario; l1.innerHTML += '<div class="p-list-item"><span class="p-list-name">' + c + '</span><span class="p-list-amt">' + fmt(pm) + '/mes' + (pd > 0 ? ' ' + fmt(pd) + '/d' : '') + '</span><button class="p-list-del" onclick="elimPresupCat(\'' + c + '\')">&#x2715;</button></div>'; }); if (!Object.keys(presupCat).length) l1.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px 0">Sin configurar</div>'; }
      if (l2) { l2.innerHTML = ''; Object.keys(presupSub).forEach(function (k) { var pts = k.split('||'), pm = presupSub[k].mensual; l2.innerHTML += '<div class="p-list-item"><span class="p-list-name">' + pts[0] + ' > ' + pts[1] + '</span><span class="p-list-amt">' + fmt(pm) + '/mes</span><button class="p-list-del" onclick="elimPresupSub(\'' + k + '\')">&#x2715;</button></div>'; }); if (!Object.keys(presupSub).length) l2.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px 0">Sin configurar</div>'; }
    }

    /* HISTORIAL */
    function renderHistorial() {
      var catSet = {}; allRows.forEach(function (r) { if (r.categoria) catSet[r.categoria] = 1; });
      var sel = document.getElementById('fCat'); sel.innerHTML = '<option value="">Categorias</option>';
      Object.keys(catSet).sort().forEach(function (c) { sel.innerHTML += '<option value="' + c + '">' + c + '</option>'; });
      currentPage = 1; filtrarTabla();
    }
    function filtrarTabla() {
      var rows = getRows(periodoActivo);
      var q = (document.getElementById('searchInp') ? document.getElementById('searchInp').value || '' : '').toLowerCase();
      var tipo = document.getElementById('fTipo') ? document.getElementById('fTipo').value : '';
      var cat = document.getElementById('fCat') ? document.getElementById('fCat').value : '';
      var desde = document.getElementById('fDesde') ? document.getElementById('fDesde').value : '';
      var hasta = document.getElementById('fHasta') ? document.getElementById('fHasta').value : '';
      var filtered = rows.filter(function (r) {
        if (tipo && r.tipo !== tipo) return false;
        if (cat && r.categoria !== cat) return false;
        if (q && !(r.descripcion || '').toLowerCase().includes(q) && !(r.categoria || '').toLowerCase().includes(q) && !(r.subcategoria || '').toLowerCase().includes(q)) return false;
        if (desde && r.fecha && r.fecha < desde) return false;
        if (hasta && r.fecha && r.fecha > hasta) return false;
        return true;
      }).sort(function (a, b) { var ta = a.createdAt ? a.createdAt.seconds || 0 : 0; var tb = b.createdAt ? b.createdAt.seconds || 0 : 0; return tb - ta; });
      var totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
      if (currentPage > totalPages) currentPage = 1;
      var start = (currentPage - 1) * PAGE_SIZE;
      var pageRows = filtered.slice(start, start + PAGE_SIZE);
      var tbody = document.getElementById('tablaBody'); if (!tbody) return;
      tbody.innerHTML = '';
      if (!pageRows.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);font-size:12px">Sin registros para este periodo</td></tr>'; }
      else pageRows.forEach(function (r) {
        var isG = r.tipo === 'gasto';
        var tr = document.createElement('tr');
        var t1 = document.createElement('td'); t1.setAttribute('data-label', 'Fecha'); t1.style.fontFamily = "'IBM Plex Mono',monospace"; t1.textContent = r.fecha || '-'; tr.appendChild(t1);
        var t2 = document.createElement('td'); t2.setAttribute('data-label', 'Ingresado'); t2.style.color = 'var(--muted)'; t2.style.fontSize = '11px'; t2.style.fontFamily = "'IBM Plex Mono',monospace"; t2.textContent = (r.fecha_ingreso || '-') + (r.hora_ingreso ? ' ' + r.hora_ingreso : ''); tr.appendChild(t2);
        var t3 = document.createElement('td'); t3.className = 'td-main'; t3.setAttribute('data-label', 'Descripcion'); t3.textContent = r.descripcion || '-';
        if (r.etiquetas && r.etiquetas.length) { r.etiquetas.forEach(function (tg) { var sp = document.createElement('span'); sp.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:8px;font-size:8px;background:var(--gold-d);border:1px solid var(--gold-b);color:var(--gold);margin-left:4px;'; sp.textContent = '#' + tg; t3.appendChild(sp); }); }
        tr.appendChild(t3);
        var t4 = document.createElement('td'); t4.setAttribute('data-label', 'Categoria'); t4.textContent = (r.categoria || '-') + (r.subcategoria ? ' / ' + r.subcategoria : ''); tr.appendChild(t4);
        var t5 = document.createElement('td'); t5.className = 'td-amt ' + (isG ? 'r' : 'g'); t5.setAttribute('data-label', 'Monto'); t5.style.textAlign = 'right'; t5.textContent = (isG ? '-' : '+') + fmt(r.monto); tr.appendChild(t5);
        var t6 = document.createElement('td'); t6.setAttribute('data-label', 'Tipo'); var b = document.createElement('div'); b.className = 'badge ' + (isG ? 'r' : 'g'); b.textContent = r.tipo; t6.appendChild(b); tr.appendChild(t6);
        var t7 = document.createElement('td'); t7.setAttribute('data-label', ''); var wrap = document.createElement('div'); wrap.className = 'row-actions';
        var be = document.createElement('button'); be.className = 'row-btn'; be.textContent = 'Editar'; be.onclick = (function (rec) { return function () { showEditModal(rec); }; })(r);
        var bd = document.createElement('button'); bd.className = 'row-btn del'; bd.textContent = 'x'; bd.onclick = (function (rec) { return function () { quickDelete(rec); }; })(r);
        wrap.appendChild(be); wrap.appendChild(bd); t7.appendChild(wrap); tr.appendChild(t7);
        tbody.appendChild(tr);
      });
      var tc = document.getElementById('tblCount'); if (tc) tc.textContent = filtered.length + ' registro' + (filtered.length === 1 ? '' : 's');
      buildPagination(totalPages);
    }
    function buildPagination(total) {
      var pag = document.getElementById('pagination'); if (!pag) return; pag.innerHTML = ''; if (total <= 1) return;
      var prev = document.createElement('button'); prev.className = 'pg-btn'; prev.textContent = '<'; prev.disabled = currentPage === 1; prev.onclick = function () { currentPage--; filtrarTabla(); }; pag.appendChild(prev);
      for (var i = Math.max(1, currentPage - 2); i <= Math.min(total, currentPage + 2); i++) { (function (p) { var btn = document.createElement('button'); btn.className = 'pg-btn' + (i === currentPage ? ' active' : ''); btn.textContent = p; btn.onclick = function () { currentPage = p; filtrarTabla(); }; pag.appendChild(btn); })(i); }
      var next = document.createElement('button'); next.className = 'pg-btn'; next.textContent = '>'; next.disabled = currentPage === total; next.onclick = function () { currentPage++; filtrarTabla(); }; pag.appendChild(next);
    }
    function clearDateFilter() { var d = document.getElementById('fDesde'), h = document.getElementById('fHasta'); if (d) d.value = ''; if (h) h.value = ''; filtrarTabla(); }

    /* ALERTAS */
    function getLimites() { return _settings.limites || {}; }
    function checkAlertas(rows) {
      var limites = getLimites(), gas = rows.filter(function (r) { return r.tipo === 'gasto'; }), bc = {};
      gas.forEach(function (r) { bc[r.categoria] = (bc[r.categoria] || 0) + r.monto; });
      var al = []; Object.keys(limites).forEach(function (c) { if (bc[c] && bc[c] > limites[c]) al.push(c); });
      var banner = document.getElementById('alertBanner');
      if (al.length) { banner.classList.add('show'); document.getElementById('alertMsg').textContent = 'Limite superado: ' + al.join(', '); }
      else banner.classList.remove('show');
    }
    function renderAlertas() {
      var rows = getRows(periodoActivo);
      var mesAl = periodoActivo || mesActual;
      renderSmartAlerts(rows, mesAl); gas = rows.filter(function (r) { return r.tipo === 'gasto'; }), bc = {};
      gas.forEach(function (r) { bc[r.categoria] = (bc[r.categoria] || 0) + r.monto; });
      var limites = getLimites();
      var cats = []; var catSet = {};
      allRows.filter(function (r) { return r.tipo === 'gasto'; }).forEach(function (r) { if (r.categoria && !catSet[r.categoria]) { catSet[r.categoria] = 1; cats.push(r.categoria); } });
      cats.sort();
      var sel = document.getElementById('alertCat'); if (sel) { sel.innerHTML = '<option value="">Categoria...</option>'; cats.forEach(function (c) { sel.innerHTML += '<option value="' + c + '">' + c + '</option>'; }); }
      var colors = cats.map(function (_, i) { return catColors[i % catColors.length]; });
      destroyChart('cAlertDonut');
      var catsG = cats.filter(function (c) { return bc[c] > 0; });
      var cGcolors = catsG.map(function (_, i) { return catColors[i % catColors.length]; });
      if (catsG.length && document.getElementById('cAlertDonut')) {
        charts['cAlertDonut'] = new Chart(document.getElementById('cAlertDonut'), { type: 'doughnut', data: { labels: catsG, datasets: [{ data: catsG.map(function (c) { return bc[c]; }), backgroundColor: cGcolors, borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var cat = catsG[els[0].index]; openDrill(cat, function (r) { return r.tipo === 'gasto' && r.categoria === cat; }, 'gasto'); } } } });
        var leg = document.getElementById('legAlertDonut'); leg.innerHTML = ''; var tot = catsG.reduce(function (s, c) { return s + (bc[c] || 0); }, 0);
        catsG.forEach(function (c, i) { var pct = tot > 0 ? Math.round((bc[c] || 0) / tot * 100) : 0; leg.innerHTML += '<div class="leg-item"><div class="leg-sq" style="background:' + cGcolors[i] + '"></div>' + c + ' ' + pct + '%</div>'; });
      } else if (document.getElementById('legAlertDonut')) document.getElementById('legAlertDonut').innerHTML = '<span style="color:var(--muted);font-size:11px">Sin gastos este periodo</span>';
      var topCats = cats.filter(function (c) { return bc[c] > 0; }).slice(0, 4);
      var last6 = [], last6L = []; for (var mi = mesActual; mi > Math.max(0, mesActual - 6); mi--) { last6.unshift(mi); last6L.unshift(meses[mi - 1]); }
      var datasets = topCats.map(function (cat, i) { return { label: cat, data: last6.map(function (m) { return getRows(m).filter(function (x) { return x.tipo === 'gasto' && x.categoria === cat; }).reduce(function (s, x) { return s + x.monto; }, 0); }), backgroundColor: colors[i] + 'cc', borderRadius: 2 }; });
      destroyChart('cAlertBar');
      if (document.getElementById('cAlertBar')) charts['cAlertBar'] = new Chart(document.getElementById('cAlertBar'), { type: 'bar', data: { labels: last6L, datasets: datasets.length ? datasets : [{ label: '', data: last6.map(function () { return 0; }), backgroundColor: 'rgba(255,255,255,.05)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#52505c', font: { size: 10 }, boxWidth: 10 } }, tooltip: ttOpts }, scales: { x: { stacked: true, grid: { color: gColor } }, y: { stacked: true, grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
      var cont = document.getElementById('alertasContent'); cont.innerHTML = '';
      cats.forEach(function (cat) {
        var gastado = bc[cat] || 0, limite = limites[cat] || 0; if (!limite && !gastado) return;
        var pct = limite > 0 ? Math.min(100, Math.round(gastado / limite * 100)) : 0;
        var color = pct >= 100 ? 'var(--red-tx)' : pct >= 80 ? 'var(--gold)' : 'var(--green-tx)';
        cont.innerHTML += '<div class="a-row"><div class="a-lbl">' + cat + (limite > 0 ? ' - ' + fmt(limite) : '') + '</div><div class="a-bar-bg"><div class="a-bar" style="width:' + pct + '%;background:' + color + '"></div></div><div class="a-pct" style="color:' + color + '">' + fmt(gastado) + '</div></div>';
      });
      if (!cont.innerHTML) cont.innerHTML = '<div style="color:var(--muted);font-size:11px">Sin datos de gastos</div>';

      renderSobregiroAlertas();
    }
    function guardarAlerta() {
      var prev = cloneData(_settings);
      var cat = document.getElementById('alertCat').value, limit = parseFloat(document.getElementById('alertLimit').value);
      if (!cat || !limit || limit <= 0) { toast('Completa categoria y limite', 'err'); return; }
      var l = getLimites(); l[cat] = limit; _settings.limites = l;
      if (window._saveSettings) {
        window._saveSettings(_settings).then(function () {
          document.getElementById('alertLimit').value = ''; toast('Limite guardado para ' + cat, 'ok'); renderAlertas();
        }).catch(function () {
          _settings = prev;
          toast('No se pudo guardar en la nube', 'err');
          renderAlertas();
        });
        return;
      }
      document.getElementById('alertLimit').value = ''; toast('Limite guardado para ' + cat, 'ok'); renderAlertas();
    }

    /* CALENDARIO */
    function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendario(); }
    function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendario(); }
    function renderCalendario() {
      var labelsEl = document.getElementById('calLabels'); if (!labelsEl) return;
      labelsEl.innerHTML = '';
      var diasRot = diasSem.slice(_weekStart).concat(diasSem.slice(0, _weekStart));
      diasRot.forEach(function (d) { labelsEl.innerHTML += '<div class="cal-day-lbl">' + d.substring(0, 2) + '</div>'; });
      document.getElementById('calMonthLbl').textContent = mesesFull[calMonth] + ' ' + calYear;
      var rowsByDate = {};
      allRows.forEach(function (r) {
        if (!r.fecha) return;
        var p = r.fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!p) return;
        var y = parseInt(p[1]), mo = parseInt(p[2]) - 1, d = parseInt(p[3]);
        if (y === calYear && mo === calMonth) { if (!rowsByDate[d]) rowsByDate[d] = []; rowsByDate[d].push(r); }
      });
      var grid = document.getElementById('calGrid'); grid.innerHTML = '';
      var firstDay = (new Date(calYear, calMonth, 1).getDay() - _weekStart + 7) % 7;
      var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      var today = new Date();
      var isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;
      var todayDate = today.getDate();
      for (var e = 0; e < firstDay; e++) { var empty = document.createElement('div'); empty.className = 'cal-day empty'; grid.appendChild(empty); }
      for (var d = 1; d <= daysInMonth; d++) {
        var cell = document.createElement('div');
        var isToday = isCurrentMonth && d === todayDate;
        cell.className = 'cal-day' + (isToday ? ' today' : '');
        var dayRows = rowsByDate[d] || [];
        var gas = dayRows.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
        var ing = dayRows.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
        var html = '<div class="cal-day-num">' + d + '</div>';
        if (dayRows.length > 0) {
          html += '<div class="cal-dot-wrap">';
          if (gas > 0) html += '<div class="cal-dot" style="background:var(--red-tx)"></div>';
          if (ing > 0) html += '<div class="cal-dot" style="background:var(--green-tx)"></div>';
          html += '</div>';
          if (gas > 0) html += '<div class="cal-day-total">-S/' + Math.round(gas) + '</div>';
        }
        cell.innerHTML = html;
        (function (day, rows) {
          if (!rows.length) return;
          cell.onclick = function () {
            var det = document.getElementById('calDetail'), title = document.getElementById('calDetailTitle'), cont = document.getElementById('calDetailRows');
            title.textContent = day + ' de ' + mesesFull[calMonth];
            cont.innerHTML = '';
            rows.forEach(function (r) { var isG = r.tipo === 'gasto'; cont.innerHTML += '<div class="cal-detail-row"><span style="font-size:12px;color:var(--text2)">' + (r.descripcion || r.categoria || '-') + '</span><span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:' + (isG ? 'var(--red-tx)' : 'var(--green-tx)') + '">' + (isG ? '-' : '+') + fmt(r.monto) + '</span></div>'; });
            det.classList.add('show');
          };
        })(d, dayRows);
        grid.appendChild(cell);
      }
      var byDow = [0, 0, 0, 0, 0, 0, 0];
      allRows.filter(function (r) {
        if (!r.fecha || r.tipo !== 'gasto') return false;
        var p = r.fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
        return p && parseInt(p[1]) === calYear && parseInt(p[2]) - 1 === calMonth;
      }).forEach(function (r) {
        var p = r.fecha.match(/(\d{4})-(\d{2})-(\d{2})/);
        var dow = new Date(parseInt(p[1]), parseInt(p[2]) - 1, parseInt(p[3])).getDay();
        byDow[dow] += r.monto;
      });
      destroyChart('cCalSemana');
      var diasRot2 = diasSem.slice(_weekStart).concat(diasSem.slice(0, _weekStart));
      var byDowRot = byDow.slice(_weekStart).concat(byDow.slice(0, _weekStart));
      if (document.getElementById('cCalSemana')) charts['cCalSemana'] = new Chart(document.getElementById('cCalSemana'), { type: 'bar', data: { labels: diasRot2, datasets: [{ data: byDowRot, backgroundColor: diasSem.map(function (_, i) { return catColors[i % catColors.length] + 'cc'; }), borderRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var m = els[0].index + 1; var ds = els[0].datasetIndex; openDrill(meses[els[0].index] + (ds === 0 ? ' - Ingresos' : ds === 1 ? ' - Gastos' : ' - Balance'), function (r) { return r.mes === m && (ds === 0 ? r.tipo === 'ingreso' : ds === 1 ? r.tipo === 'gasto' : true); }, ''); } }, scales: { x: { grid: { color: gColor } }, y: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
      var diasConGasto = Object.entries(rowsByDate).map(function (e) { return { dia: parseInt(e[0]), gas: e[1].filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0) }; }).filter(function (d) { return d.gas > 0; }).sort(function (a, b) { return b.gas - a.gas; }).slice(0, 5);
      var topEl = document.getElementById('calTopDias'); if (topEl) { topEl.innerHTML = ''; if (!diasConGasto.length) { topEl.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px 0">Sin gastos este mes</div>'; return; } diasConGasto.forEach(function (d, i) { topEl.innerHTML += '<div class="top-cat-row"><div class="top-cat-dot" style="background:' + catColors[i % catColors.length] + '"></div><div class="top-cat-name">Dia ' + d.dia + ' de ' + mesesFull[calMonth] + '</div><div class="top-cat-amt">' + fmt(d.gas) + '</div></div>'; }); }
    }

    /* RECURRENTES */
    function renderRecurrentes() {
      var hoy = new Date().getDate();
      var mesActualNum = new Date().getMonth(); // 0-indexed
      var anioActual = new Date().getFullYear();
      // Key for this month's payments: "YYYY-MM"
      var mesKey = anioActual + '-' + String(mesActualNum + 1).padStart(2, '0');

      // Populate selects
      var cats = [], catSet = {};
      allRows.forEach(function (r) { if (r.categoria && !catSet[r.categoria]) { catSet[r.categoria] = 1; cats.push(r.categoria); } });
      cats.sort();
      var rc = document.getElementById('recCat');
      if (rc) { rc.innerHTML = '<option value="">Categoria...</option>'; cats.forEach(function (c) { rc.innerHTML += '<option value="' + c + '">' + c + '</option>'; }); }
      var rd = document.getElementById('recDia');
      if (rd) { rd.innerHTML = '<option value="">Dia del mes...</option>'; for (var d = 1; d <= 31; d++)rd.innerHTML += '<option value="' + d + '">Dia ' + d + '</option>'; }
      var reDia = document.getElementById('reDia');
      if (reDia) { reDia.innerHTML = '<option value="">Dia...</option>'; for (var d = 1; d <= 31; d++)reDia.innerHTML += '<option value="' + d + '">Dia ' + d + '</option>'; }

      var cont = document.getElementById('recList'); if (!cont) return;

      if (!_recurrentes.length) {
        cont.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">Sin gastos recurrentes configurados</div>';
        var res = document.getElementById('recResumen'); if (res) res.style.display = 'none';
        return;
      }

      cont.innerHTML = '';
      var totPend = 0, totVenc = 0, totPag = 0;
      var cntPend = 0, cntVenc = 0, cntPag = 0;

      _recurrentes.forEach(function (rec, idx2) {
        // Check if paid this month
        var pagadoEsteMes = rec.pagos && rec.pagos[mesKey] === true;
        var vencido = !pagadoEsteMes && rec.dia < hoy;
        var hoyMismo = !pagadoEsteMes && rec.dia === hoy;

        // Accumulate
        if (pagadoEsteMes) { totPag += rec.monto; cntPag++; }
        else if (vencido) { totVenc += rec.monto; cntVenc++; }
        else { totPend += rec.monto; cntPend++; }

        var estadoColor = pagadoEsteMes ? 'var(--muted)' : vencido ? 'var(--red-tx)' : hoyMismo ? 'var(--red-tx)' : 'var(--green-tx)';
        var estadoTxt = pagadoEsteMes ? 'Pagado este mes' : vencido ? 'VENCIDO dia ' + rec.dia : hoyMismo ? 'Vence HOY' : 'Vence dia ' + rec.dia;

        var div = document.createElement('div');
        div.className = 'rec-item' + (pagadoEsteMes ? ' pagado' : '');

        var info = document.createElement('div'); info.className = 'rec-item-info';
        var nombre = document.createElement('div'); nombre.className = 'rec-item-nombre'; nombre.textContent = rec.nombre;
        var sub = document.createElement('div'); sub.className = 'rec-item-sub';
        sub.style.color = estadoColor;
        sub.textContent = estadoTxt + (rec.categoria ? ' ? ' + rec.categoria : '');
        info.appendChild(nombre); info.appendChild(sub);

        var monto = document.createElement('div');
        monto.className = 'rec-item-monto' + (pagadoEsteMes ? ' pagado' : '');
        monto.textContent = (pagadoEsteMes ? '' : '-') + fmt(rec.monto);

        var actions = document.createElement('div'); actions.className = 'rec-item-actions';

        // Paid button
        var btnPag = document.createElement('button');
        btnPag.className = 'rec-paid-btn' + (pagadoEsteMes ? ' active' : '');
        btnPag.textContent = pagadoEsteMes ? 'Pagado' : 'Marcar pagado';
        btnPag.onclick = (function (i3, key, isPag) {
          return function () {
            togglePagoRecurrente(i3, key, isPag);
          };
        })(idx2, mesKey, pagadoEsteMes);

        // Edit button
        var btnEdit = document.createElement('button');
        btnEdit.className = 'row-btn';
        btnEdit.textContent = 'Editar';
        btnEdit.onclick = (function (i3) { return function () { showRecEditModal(i3); }; })(idx2);

        // Delete button
        var btnDel = document.createElement('button');
        btnDel.className = 'row-btn del';
        btnDel.textContent = 'x';
        btnDel.onclick = (function (i3) { return function () { eliminarRecurrente(i3); }; })(idx2);

        actions.appendChild(btnPag);
        actions.appendChild(btnEdit);
        actions.appendChild(btnDel);

        div.appendChild(info);
        div.appendChild(monto);
        div.appendChild(actions);
        cont.appendChild(div);
      });

      // Resumen
      var res = document.getElementById('recResumen');
      if (res) {
        res.style.display = 'block';
        var elPend = document.getElementById('recResPend');
        var elVenc = document.getElementById('recResVenc');
        var elPag = document.getElementById('recResPag');
        if (elPend) elPend.textContent = fmt(totPend) + ' (' + cntPend + ')';
        if (elVenc) elVenc.textContent = fmt(totVenc) + ' (' + cntVenc + ')';
        if (elPag) elPag.textContent = fmt(totPag) + ' (' + cntPag + ')';
      }
    }

    /* ?? Edit recurrente modal ?? */
    var _recEditIdx = -1;
    function showRecEditModal(idx2) {
      _recEditIdx = idx2;
      var rec = _recurrentes[idx2]; if (!rec) return;
      document.getElementById('reNombre').value = rec.nombre || '';
      document.getElementById('reMonto').value = rec.monto || '';
      document.getElementById('reDia').value = rec.dia || '';
      document.getElementById('reCatEdit').value = rec.categoria || '';
      document.getElementById('recEditOv').classList.add('show');
    }
    function hideRecEditModal() { document.getElementById('recEditOv').classList.remove('show'); _recEditIdx = -1; }

    async function confirmarRecEdit() {
      if (_recEditIdx < 0) return;
      var rec = _recurrentes[_recEditIdx];
      rec.nombre = document.getElementById('reNombre').value.trim() || rec.nombre;
      rec.monto = parseFloat(document.getElementById('reMonto').value) || rec.monto;
      rec.dia = parseInt(document.getElementById('reDia').value) || rec.dia;
      rec.categoria = document.getElementById('reCatEdit').value.trim() || rec.categoria;
      try {
        await window._saveRecurrentes(_recurrentes);
        toast(rec.nombre + ' actualizado', 'ok');
      } catch (e) { toast('Error guardando', 'err'); }
      hideRecEditModal();
      renderRecurrentes();
    }

    async function confirmarRecDelete() {
      if (_recEditIdx < 0) return;
      var nombre = _recurrentes[_recEditIdx].nombre;
      _recurrentes.splice(_recEditIdx, 1);
      try {
        await window._saveRecurrentes(_recurrentes);
        toast(nombre + ' eliminado', 'info');
      } catch (e) { toast('Error eliminando', 'err'); }
      hideRecEditModal();
      renderRecurrentes();
    }

    async function togglePagoRecurrente(idx2, mesKey, isPagado) {
      var rec = _recurrentes[idx2]; if (!rec) return;
      if (!rec.pagos) rec.pagos = {};
      if (isPagado) {
        delete rec.pagos[mesKey];
        toast(rec.nombre + ' marcado como pendiente', 'info');
      } else {
        rec.pagos[mesKey] = true;
        toast(rec.nombre + ' pagado este mes', 'ok');
      }
      try {
        await window._saveRecurrentes(_recurrentes);
      } catch (e) { toast('Error guardando', 'err'); }
      renderRecurrentes();
      // Update pocket
      var mesPocket = periodoActivo || mesActual;
      renderPocket(getRows(mesPocket));
    }
    async function agregarRecurrente() {
      var prev = cloneData(_recurrentes);
      var nombre = document.getElementById('recNombre').value.trim(), monto = parseFloat(document.getElementById('recMonto').value) || 0, dia = parseInt(document.getElementById('recDia').value) || 0, cat = document.getElementById('recCat').value;
      if (!nombre || !monto || !dia) { toast('Completa todos los campos', 'err'); return; }
      _recurrentes.push({ nombre: nombre, monto: monto, dia: dia, categoria: cat || 'General' });
      try { await window._saveRecurrentes(_recurrentes); toast(nombre + ' agregado', 'ok'); }
      catch (e) { _recurrentes = prev; toast('No se pudo guardar en la nube', 'err'); }
      document.getElementById('recNombre').value = ''; document.getElementById('recMonto').value = '';
      renderRecurrentes();
    }
    async function eliminarRecurrente(idx) {
      var prev = cloneData(_recurrentes);
      _recurrentes.splice(idx, 1);
      try { await window._saveRecurrentes(_recurrentes); toast('Eliminado', 'info'); }
      catch (e) { _recurrentes = prev; toast('No se pudo eliminar en la nube', 'err'); }
      renderRecurrentes();
    }
    function checkRecurrentes() {
      var hoy = new Date().getDate();
      var hoyList = _recurrentes.filter(function (r) { return r.dia === hoy; });
      if (hoyList.length > 0) toast('Vencen hoy: ' + hoyList.map(function (r) { return r.nombre; }).join(', '), 'info', 6000);
    }

    /* PATRIMONIO */
    function getTodayPatrimonio() {
      return new Date().toISOString().split('T')[0];
    }
    function getPatrimonioNeto() {
      var tA = _activos.reduce(function (s, a) { return s + a.monto; }, 0);
      var tP = _pasivos.reduce(function (s, p) { return s + p.monto; }, 0);
      return { activos: tA, pasivos: tP, neto: tA - tP };
    }
    function registrarMovimientoPatrimonio(data) {
      var netoInfo = getPatrimonioNeto();
      var mov = {
        id: data.id || Date.now().toString() + Math.random().toString(16).slice(2, 8),
        fecha: data.fecha || getTodayPatrimonio(),
        tipo: data.tipo || 'ajuste',
        entidad: data.entidad || 'activo',
        nombre: data.nombre || 'Patrimonio',
        monto: Math.round((parseFloat(data.monto) || 0) * 100) / 100,
        motivo: data.motivo || 'Movimiento manual',
        categoria: data.categoria || 'PATRIMONIO',
        subcategoria: data.subcategoria || '',
        registroId: data.registroId || null,
        saldoPosterior: data.saldoPosterior === undefined ? netoInfo.neto : data.saldoPosterior
      };
      _patrimonioMovimientos.unshift(mov);
      _patrimonioMovimientos = _patrimonioMovimientos.slice(0, 120);
    }
    function getImpactoMovimientoPatrimonio(mov) {
      var monto = Math.abs(parseFloat(mov.monto) || 0);
      if (mov.entidad === 'pasivo') {
        if (mov.tipo === 'agrega') return -monto;
        if (mov.tipo === 'elimina') return monto;
        return parseFloat(mov.monto) || 0;
      }
      if (mov.tipo === 'elimina') return -monto;
      return parseFloat(mov.monto) || 0;
    }
    function findPatrimonioItem(entidad, nombre) {
      var lista = entidad === 'pasivo' ? _pasivos : _activos;
      return lista.find(function (item) { return item.nombre === nombre; }) || null;
    }
    function upsertPatrimonioItem(entidad, nombre, monto) {
      var lista = entidad === 'pasivo' ? _pasivos : _activos;
      var item = findPatrimonioItem(entidad, nombre);
      if (item) {
        item.monto = Math.round(monto * 100) / 100;
        if (item.monto <= 0) {
          if (entidad === 'pasivo') _pasivos = _pasivos.filter(function (p) { return p.id !== item.id; });
          else _activos = _activos.filter(function (a) { return a.id !== item.id; });
        }
        return item;
      }
      if (monto > 0) {
        item = { id: Date.now().toString() + Math.random().toString(16).slice(2, 6), nombre: nombre, monto: Math.round(monto * 100) / 100 };
        lista.push(item);
        return item;
      }
      return null;
    }
    async function eliminarMovimientoPatrimonio(id) {
      var prevActivos = cloneData(_activos), prevPasivos = cloneData(_pasivos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos), prevSob = cloneData(_sobregiros);
      var mov = _patrimonioMovimientos.find(function (x) { return x.id === id; });
      if (!mov) return;
      var delta = Math.round((parseFloat(mov.monto) || 0) * 100) / 100;
      var item = findPatrimonioItem(mov.entidad, mov.nombre);
      var montoActual = item ? parseFloat(item.monto) || 0 : 0;
      var montoRevertido = Math.round((montoActual - delta) * 100) / 100;
      upsertPatrimonioItem(mov.entidad, mov.nombre, montoRevertido);
      _patrimonioMovimientos = _patrimonioMovimientos.filter(function (x) { return x.id !== id; });
      if (mov.categoria === 'SOBREGIRO' && (mov.subcategoria || '').toUpperCase() === 'AHORRO AGORA' && mov.registroId) {
        var sob = _sobregiros.find(function (s) { return s.registroId === mov.registroId && s.tipo === 'AHORRO AGORA'; });
        if (sob) {
          sob.movimientoEliminado = true;
          try { await window._saveSobregiros(_sobregiros); }
          catch (e) {
            _activos = prevActivos; _pasivos = prevPasivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; _sobregiros = prevSob;
            toast('No se pudo guardar en la nube', 'err');
            renderPatrimonio();
            return;
          }
        }
      }
      try { await savePatrimonio(); }
      catch (e) {
        _activos = prevActivos; _pasivos = prevPasivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; _sobregiros = prevSob;
        toast('No se pudo guardar en la nube', 'err');
        renderPatrimonio();
        return;
      }
      renderPatrimonio();
      toast('Movimiento eliminado y patrimonio recalculado', 'ok');
    }
    async function savePatrimonio() {
      var netoInfo = getPatrimonioNeto();
      var today = getTodayPatrimonio();
      var existing = _patrimonioHistory.findIndex(function (h) { return h.fecha === today; });
      if (existing >= 0) _patrimonioHistory[existing].valor = netoInfo.neto;
      else _patrimonioHistory.push({ fecha: today, valor: netoInfo.neto });
      _patrimonioHistory = _patrimonioHistory.slice(-24);
      await window._savePatrimonio({
        activos: _activos,
        pasivos: _pasivos,
        history: _patrimonioHistory,
        movimientos: _patrimonioMovimientos
      });
    }
    async function agregarActivo() {
      var prevActivos = cloneData(_activos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos);
      var n = document.getElementById('activoNombre').value.trim(), m = parseFloat(document.getElementById('activoMonto').value) || 0;
      if (!n || !m) { toast('Completa nombre y monto', 'err'); return; }
      _activos.push({ id: Date.now().toString(), nombre: n, monto: m });
      registrarMovimientoPatrimonio({ tipo: 'agrega', entidad: 'activo', nombre: n, monto: m, motivo: 'Activo agregado manualmente' });
      try { await savePatrimonio(); toast(n + ' agregado', 'ok'); }
      catch (e) { _activos = prevActivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; toast('No se pudo guardar en la nube', 'err'); }
      document.getElementById('activoNombre').value = ''; document.getElementById('activoMonto').value = '';
      renderPatrimonio();
    }
    async function agregarPasivo() {
      var prevPasivos = cloneData(_pasivos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos);
      var n = document.getElementById('pasivoNombre').value.trim(), m = parseFloat(document.getElementById('pasivoMonto').value) || 0;
      if (!n || !m) { toast('Completa nombre y monto', 'err'); return; }
      _pasivos.push({ id: Date.now().toString(), nombre: n, monto: m });
      registrarMovimientoPatrimonio({ tipo: 'agrega', entidad: 'pasivo', nombre: n, monto: m, motivo: 'Pasivo agregado manualmente' });
      try { await savePatrimonio(); toast(n + ' agregado', 'ok'); }
      catch (e) { _pasivos = prevPasivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; toast('No se pudo guardar en la nube', 'err'); }
      document.getElementById('pasivoNombre').value = ''; document.getElementById('pasivoMonto').value = '';
      renderPatrimonio();
    }
    var _patriEditType = null, _patriEditId = null;
    function editarPatrimonio(tipo, id) {
      _patriEditType = tipo; _patriEditId = id;
      var lista = tipo === 'activo' ? _activos : _pasivos;
      var item = lista.find(function (x) { return x.id === id; }); if (!item) return;
      document.getElementById('patriEditTitle').textContent = tipo === 'activo' ? 'Editar activo' : 'Editar pasivo';
      document.getElementById('peNombre').value = item.nombre || '';
      document.getElementById('peMonto').value = item.monto || '';
      document.getElementById('patriEditOv').classList.add('show');
    }
    function hidePatriEditModal() { document.getElementById('patriEditOv').classList.remove('show'); _patriEditType = null; _patriEditId = null; }
    async function confirmarPatriEdit() {
      if (!_patriEditType || !_patriEditId) return;
      var prevActivos = cloneData(_activos), prevPasivos = cloneData(_pasivos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos);
      var lista = _patriEditType === 'activo' ? _activos : _pasivos;
      var item = lista.find(function (x) { return x.id === _patriEditId; }); if (!item) return;
      var nombreAnterior = item.nombre;
      var montoAnterior = item.monto;
      item.nombre = document.getElementById('peNombre').value.trim() || item.nombre;
      item.monto = parseFloat(document.getElementById('peMonto').value) || item.monto;
      registrarMovimientoPatrimonio({
        tipo: 'edita',
        entidad: _patriEditType,
        nombre: item.nombre,
        monto: item.monto - montoAnterior,
        motivo: 'Actualizacion manual de ' + nombreAnterior,
        categoria: 'PATRIMONIO',
        subcategoria: item.nombre
      });
      try {
        await savePatrimonio();
        toast(item.nombre + ' actualizado', 'ok');
        hidePatriEditModal();
      } catch (e) {
        _activos = prevActivos; _pasivos = prevPasivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs;
        toast('No se pudo guardar en la nube', 'err');
      }
      renderPatrimonio();
    }

    async function eliminarActivo(id) {
      var prevActivos = cloneData(_activos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos);
      var item = _activos.find(function (a) { return a.id === id; });
      if (!item) return;
      _activos = _activos.filter(function (a) { return a.id !== id; });
      registrarMovimientoPatrimonio({ tipo: 'elimina', entidad: 'activo', nombre: item.nombre, monto: -item.monto, motivo: 'Activo eliminado manualmente' });
      try { await savePatrimonio(); toast('Activo eliminado', 'info'); }
      catch (e) { _activos = prevActivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; toast('No se pudo eliminar en la nube', 'err'); }
      renderPatrimonio();
    }
    async function eliminarPasivo(id) {
      var prevPasivos = cloneData(_pasivos), prevHist = cloneData(_patrimonioHistory), prevMovs = cloneData(_patrimonioMovimientos);
      var item = _pasivos.find(function (p) { return p.id === id; });
      if (!item) return;
      _pasivos = _pasivos.filter(function (p) { return p.id !== id; });
      registrarMovimientoPatrimonio({ tipo: 'elimina', entidad: 'pasivo', nombre: item.nombre, monto: -item.monto, motivo: 'Pasivo eliminado manualmente' });
      try { await savePatrimonio(); toast('Pasivo eliminado', 'info'); }
      catch (e) { _pasivos = prevPasivos; _patrimonioHistory = prevHist; _patrimonioMovimientos = prevMovs; toast('No se pudo eliminar en la nube', 'err'); }
      renderPatrimonio();
    }
    function renderPatrimonio() {
      var tA = _activos.reduce(function (s, a) { return s + a.monto; }, 0);
      var tP = _pasivos.reduce(function (s, p) { return s + p.monto; }, 0);
      var neto = tA - tP;
      var sum = document.getElementById('netoSummary'); if (!sum) return;
      sum.innerHTML = '<div class="neto-card"><div class="neto-lbl">Total activos</div><div class="neto-val pos">' + fmt(tA) + '</div></div><div class="neto-card"><div class="neto-lbl">Total pasivos</div><div class="neto-val neg">' + fmt(tP) + '</div></div><div class="neto-card"><div class="neto-lbl">Patrimonio neto</div><div class="neto-val ' + (neto >= 0 ? 'neu' : 'neg') + '">' + fmt(neto) + '</div></div>';
      var aL = document.getElementById('activosList'), pL = document.getElementById('pasivosList');
      if (aL) {
        aL.innerHTML = '';
        if (!_activos.length) {
          var empty = document.createElement('div');
          empty.style.cssText = 'color:var(--muted);font-size:11px;padding:8px 0';
          empty.textContent = 'Sin activos registrados';
          aL.appendChild(empty);
        } else _activos.forEach(function (a) {
          var row = document.createElement('div'); row.className = 'neto-item';
          var name = document.createElement('div'); name.className = 'neto-item-name'; name.textContent = a.nombre;
          var right = document.createElement('div'); right.style.cssText = 'display:flex;align-items:center;gap:6px';
          var val = document.createElement('div'); val.className = 'neto-item-val pos'; val.textContent = fmt(a.monto);
          var btnE = document.createElement('button'); btnE.textContent = 'Editar';
          btnE.style.cssText = 'font-size:11px;padding:2px 6px;border:1px solid var(--border2);border-radius:2px;color:var(--muted);background:none;cursor:pointer;font-family:IBM Plex Sans,sans-serif';
          btnE.onclick = (function (id) { return function () { editarPatrimonio('activo', id); }; })(a.id);
          var btnD = document.createElement('button'); btnD.className = 'neto-item-del'; btnD.innerHTML = '&#x2715;';
          btnD.onclick = (function (id) { return function () { eliminarActivo(id); }; })(a.id);
          right.appendChild(val); right.appendChild(btnE); right.appendChild(btnD);
          row.appendChild(name); row.appendChild(right); aL.appendChild(row);
        });
      }
      if (pL) {
        pL.innerHTML = '';
        if (!_pasivos.length) {
          var empty2 = document.createElement('div');
          empty2.style.cssText = 'color:var(--muted);font-size:11px;padding:8px 0';
          empty2.textContent = 'Sin pasivos registrados';
          pL.appendChild(empty2);
        } else _pasivos.forEach(function (p) {
          var row = document.createElement('div'); row.className = 'neto-item';
          var name = document.createElement('div'); name.className = 'neto-item-name'; name.textContent = p.nombre;
          var right = document.createElement('div'); right.style.cssText = 'display:flex;align-items:center;gap:6px';
          var val = document.createElement('div'); val.className = 'neto-item-val neg'; val.textContent = fmt(p.monto);
          var btnE = document.createElement('button'); btnE.textContent = 'Editar';
          btnE.style.cssText = 'font-size:11px;padding:2px 6px;border:1px solid var(--border2);border-radius:2px;color:var(--muted);background:none;cursor:pointer;font-family:IBM Plex Sans,sans-serif';
          btnE.onclick = (function (id) { return function () { editarPatrimonio('pasivo', id); }; })(p.id);
          var btnD = document.createElement('button'); btnD.className = 'neto-item-del'; btnD.innerHTML = '&#x2715;';
          btnD.onclick = (function (id) { return function () { eliminarPasivo(id); }; })(p.id);
          right.appendChild(val); right.appendChild(btnE); right.appendChild(btnD);
          row.appendChild(name); row.appendChild(right); pL.appendChild(row);
        });
      }
      destroyChart('cPatrimonio');
      var canv = document.getElementById('cPatrimonio');
      if (canv && _patrimonioHistory.length > 1) {
        charts['cPatrimonio'] = new Chart(canv, { type: 'line', data: { labels: _patrimonioHistory.map(function (h) { return h.fecha.substring(5); }), datasets: [{ label: 'Patrimonio', data: _patrimonioHistory.map(function (h) { return h.valor; }), borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,.06)', borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: '#c9a84c', tension: .4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: ttOpts }, onClick: function (evt, els) { if (els.length) { var m = els[0].index + 1; var ds = els[0].datasetIndex; openDrill(meses[els[0].index] + (ds === 0 ? ' - Ingresos' : ds === 1 ? ' - Gastos' : ' - Balance'), function (r) { return r.mes === m && (ds === 0 ? r.tipo === 'ingreso' : ds === 1 ? r.tipo === 'gasto' : true); }, ''); } }, scales: { x: { grid: { color: gColor } }, y: { grid: { color: gColor }, ticks: { callback: function (v) { return 'S/' + v.toLocaleString(); } } } } } });
      }
      var movWrap = document.getElementById('patrimonioMovimientos');
      if (movWrap) {
        movWrap.innerHTML = '';
        if (!_patrimonioMovimientos.length) {
          movWrap.innerHTML = '<div class="patri-empty">Cada cambio manual o automatico del patrimonio aparecera aqui. Esto incluye movimientos por SOBREGIRO con subcategoria AHORRO AGORA.</div>';
        } else {
          _patrimonioMovimientos.forEach(function (mov) {
            var impacto = getImpactoMovimientoPatrimonio(mov);
            var cls = impacto >= 0 ? 'pos' : 'neg';
            var row = document.createElement('div'); row.className = 'patri-mov';
            var dot = document.createElement('div'); dot.className = 'patri-mov-dot ' + cls;
            var body = document.createElement('div'); body.className = 'patri-mov-body';
            var top = document.createElement('div'); top.className = 'patri-mov-top';
            var title = document.createElement('div'); title.className = 'patri-mov-title';
            title.textContent = (mov.nombre || 'Patrimonio') + ' - ' + (mov.motivo || 'Movimiento');
            var actions = document.createElement('div'); actions.className = 'patri-mov-actions';
            var amt = document.createElement('div'); amt.className = 'patri-mov-amt ' + cls;
            amt.textContent = (impacto >= 0 ? '+ ' : '- ') + fmt(Math.abs(impacto));
            var btnDel = document.createElement('button'); btnDel.className = 'patri-mov-del';
            btnDel.textContent = 'Eliminar';
            btnDel.onclick = (function (id) { return function () { eliminarMovimientoPatrimonio(id); }; })(mov.id);
            var sub = document.createElement('div'); sub.className = 'patri-mov-sub';
            var detalles = [mov.fecha || '', mov.categoria || 'PATRIMONIO'];
            if (mov.subcategoria) detalles.push(mov.subcategoria);
            if (mov.saldoPosterior !== undefined && mov.saldoPosterior !== null) detalles.push('Patrimonio neto: ' + fmt(mov.saldoPosterior));
            sub.textContent = detalles.filter(Boolean).join(' ? ');
            actions.appendChild(amt); actions.appendChild(btnDel);
            top.appendChild(title); top.appendChild(actions);
            body.appendChild(top); body.appendChild(sub);
            row.appendChild(dot); row.appendChild(body);
            movWrap.appendChild(row);
          });
        }
      }
    }

    /* ETIQUETAS */
    function renderEtiquetas() {
      var cont = document.getElementById('eTagsWrap'); if (!cont) return;
      cont.innerHTML = '';
      _etiquetas.forEach(function (t) {
        var active = _etiquetasActivas.indexOf(t) >= 0;
        var tag = document.createElement('div'); tag.className = 'tag' + (active ? ' active' : '');
        tag.textContent = '#' + t;
        tag.onclick = function () { var idx = _etiquetasActivas.indexOf(t); if (idx >= 0) _etiquetasActivas.splice(idx, 1); else _etiquetasActivas.push(t); renderEtiquetas(); };
        cont.appendChild(tag);
      });
      var addInp = document.createElement('input');
      addInp.placeholder = '+etiqueta';
      addInp.style.cssText = 'background:none;border:none;border-bottom:1px solid var(--border);outline:none;font-family:IBM Plex Sans,sans-serif;font-size:10px;color:var(--text);width:70px;padding:2px 4px;';
      addInp.onkeydown = function (e) { if (e.key === 'Enter' && this.value.trim()) { var v = this.value.trim().toLowerCase().replace(/\s+/g, '_'); if (_etiquetas.indexOf(v) < 0) _etiquetas.push(v); _etiquetasActivas.push(v); this.value = ''; renderEtiquetas(); } };
      cont.appendChild(addInp);
    }

    /* EDIT / DELETE */
    var editRec = null;
    function showEditModal(r) {
      editRec = r;
      document.getElementById('eTipo').value = r.tipo || 'gasto';
      document.getElementById('eMonto').value = r.monto || '';
      document.getElementById('eCat').value = r.categoria || '';
      document.getElementById('eSub').value = r.subcategoria || '';
      document.getElementById('eDesc').value = r.descripcion || '';
      document.getElementById('eFecha').value = r.fecha || '';
      document.getElementById('eFechaIngreso').textContent = 'Ingresado: ' + (r.fecha_ingreso || '-') + (r.hora_ingreso ? ' a las ' + r.hora_ingreso : '');
      document.getElementById('eNota').value = r.nota || '';
      _etiquetasActivas = r.etiquetas ? r.etiquetas.slice() : [];
      renderEtiquetas();
      document.getElementById('eStatus').textContent = '';
      document.getElementById('editOv').classList.add('show');
    }
    function hideEditModal() { document.getElementById('editOv').classList.remove('show'); editRec = null; }
    async function guardarEdicion() {
      if (!editRec) return;
      var est = document.getElementById('eStatus'); est.textContent = 'Guardando...'; est.style.color = 'var(--muted)';
      try {
        var updates = { tipo: document.getElementById('eTipo').value, monto: parseFloat(document.getElementById('eMonto').value) || 0, categoria: document.getElementById('eCat').value.trim(), subcategoria: document.getElementById('eSub').value.trim(), descripcion: document.getElementById('eDesc').value.trim(), fecha: document.getElementById('eFecha').value, nota: document.getElementById('eNota').value.trim(), etiquetas: _etiquetasActivas.slice() };
        await window._updateDoc(editRec.id, updates);
        var idx = allRows.findIndex(function (x) { return x.id === editRec.id; });
        if (idx >= 0) Object.assign(allRows[idx], updates);
        est.style.color = 'var(--green-tx)'; est.textContent = 'Guardado';
        toast('Registro actualizado', 'ok');
        setTimeout(function () { hideEditModal(); renderVista(); }, 1000);
      } catch (err) { est.style.color = 'var(--red-tx)'; est.textContent = 'Error: ' + err.message; toast('Error al guardar', 'err'); }
    }
    function pedirConfirm() { document.getElementById('confirmOv').classList.add('show'); }
    function quickDelete(r) { editRec = r; pedirConfirm(); }
    async function ejecutarDelete() {
      document.getElementById('confirmOv').classList.remove('show');
      if (!editRec) return;
      var est = document.getElementById('eStatus'); est.textContent = 'Eliminando...';
      try {
        await window._deleteDoc(editRec.id);
        toast('Registro eliminado', 'info');
        setTimeout(function () { hideEditModal(); }, 600);
      } catch (err) { est.style.color = 'var(--red-tx)'; est.textContent = 'Error: ' + err.message; toast('Error al eliminar', 'err'); }
    }

    /* AJUSTES */
    function applyTheme(t) {
      _settings.theme = t;
      var dark = { bg: '#070709', s1: '#0d0d10', s2: '#121215', s3: '#181820', border: '#1e1e28', border2: '#28283a', text: '#e4e2dc', text2: '#a8a6a0', muted: '#52505c' };
      var light = { bg: '#f4f4f6', s1: '#ffffff', s2: '#f0f0f4', s3: '#e8e8ec', border: '#e0e0e8', border2: '#d0d0dc', text: '#1a1a28', text2: '#52505c', muted: '#9090a0' };
      var vals = t === 'light' ? light : dark;
      Object.entries(vals).forEach(function (kv) { document.documentElement.style.setProperty('--' + kv[0], kv[1]); });
      var tD = document.getElementById('themeDark'), tL = document.getElementById('themeLight');
      if (tD) tD.style.background = t === 'dark' ? 'var(--border2)' : '';
      if (tL) tL.style.background = t === 'light' ? 'var(--border2)' : '';
    }
    function setTheme(t) {
      var prev = cloneData(_settings), prevTheme = _settings.theme;
      applyTheme(t); _settings.theme = t;
      if (window._saveSettings) {
        window._saveSettings(_settings).catch(function () {
          _settings = prev;
          applyTheme(prevTheme || 'dark');
          toast('No se pudo guardar en la nube', 'err');
        });
      }
    }
    function hexToRgba(h, a) { var r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
    function applyAccent(c) { document.documentElement.style.setProperty('--gold', c); document.documentElement.style.setProperty('--gold-d', hexToRgba(c, .1)); document.documentElement.style.setProperty('--gold-b', hexToRgba(c, .3)); document.querySelectorAll('.accent-btn').forEach(function (b) { b.classList.toggle('sel', b.dataset.color === c); }); }
    function setAccent(c, el) {
      var prev = cloneData(_settings), prevAccent = _settings.accentColor;
      applyAccent(c); _settings.accentColor = c;
      if (window._saveSettings) window._saveSettings(_settings).catch(function () {
        _settings = prev;
        applyAccent(prevAccent || '#c9a84c');
        toast('No se pudo guardar en la nube', 'err');
      });
    }
    function guardarNombre() {
      var prev = cloneData(_settings), prevName = document.getElementById('dashName').textContent;
      var v = document.getElementById('cfgNombre').value.trim(); if (!v) return;
      document.getElementById('dashName').textContent = v; _settings.dashName = v;
      if (window._saveSettings) window._saveSettings(_settings).then(function () {
        toast('Nombre actualizado', 'ok');
      }).catch(function () {
        _settings = prev;
        document.getElementById('dashName').textContent = prevName;
        toast('No se pudo guardar en la nube', 'err');
      });
    }
    function guardarMetaPct() {
      var prev = cloneData(_settings), prevMeta = window._metaAhorro, prevLabel = document.getElementById('metaActualLabel').textContent;
      var v = parseFloat(document.getElementById('cfgMeta').value) || 30; window._metaAhorro = v; _settings.meta = v; document.getElementById('metaActualLabel').textContent = v + '%';
      if (window._saveSettings) window._saveSettings(_settings).then(function () {
        toast('Meta de ahorro: ' + v + '%', 'ok'); renderDashboard();
      }).catch(function () {
        _settings = prev; window._metaAhorro = prevMeta; document.getElementById('metaActualLabel').textContent = prevLabel;
        toast('No se pudo guardar en la nube', 'err'); renderDashboard();
      });
    }
    function setWeekStart(v) {
      var prev = cloneData(_settings), prevWeek = _weekStart;
      _weekStart = parseInt(v);
      _settings.weekStart = v;
      if (window._saveSettings) window._saveSettings(_settings).then(function () {
        toast('Inicio de semana actualizado', 'ok');
      }).catch(function () {
        _settings = prev; _weekStart = prevWeek;
        var wsEl = document.getElementById('cfgWeekStart'); if (wsEl) wsEl.value = String(prevWeek);
        toast('No se pudo guardar en la nube', 'err');
        if (vistaActiva === 'calendario') renderCalendario();
      });
      else toast('Inicio de semana actualizado', 'ok');
      if (vistaActiva === 'calendario') renderCalendario();
    }
    function setMoneda(m) {
      var prev = cloneData(_settings), prevMoneda = window._moneda;
      window._moneda = m; _settings.moneda = m;
      if (window._saveSettings) window._saveSettings(_settings).then(function () {
        toast('Moneda: ' + m, 'ok'); renderVista();
      }).catch(function () {
        _settings = prev; window._moneda = prevMoneda;
        var cm = document.getElementById('cfgMoneda'); if (cm) cm.value = prevMoneda;
        toast('No se pudo guardar en la nube', 'err'); renderVista();
      });
      else { toast('Moneda: ' + m, 'ok'); renderVista(); }
    }
    function renderStatsSystem() {
      var cont = document.getElementById('statsSystem'); if (!cont) return;
      var stats = [{ lbl: 'Total registros', val: allRows.length }, { lbl: 'Meses con datos', val: new Set(allRows.map(function (r) { return r.mes; })).size }, { lbl: 'Categorias', val: new Set(allRows.map(function (r) { return r.categoria; })).size }];
      cont.innerHTML = '';
      stats.forEach(function (s) { cont.innerHTML += '<div style="background:var(--s2);border:1px solid var(--border);border-radius:3px;padding:12px 14px"><div style="font-size:9px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:5px">' + s.lbl + '</div><div style="font-family:IBM Plex Mono,monospace;font-size:20px;color:var(--text)">' + s.val + '</div></div>'; });
    }

    /* EXPORTAR PDF */
    function exportarPDF() {
      var rows = getRows(periodoActivo);
      var periodo = periodoActivo ? meses[periodoActivo - 1] : 'A?o completo';
      var ing = rows.filter(function (r) { return r.tipo === 'ingreso'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var gas = rows.filter(function (r) { return r.tipo === 'gasto'; }).reduce(function (s, r) { return s + r.monto; }, 0);
      var bal = ing - gas;

      var doc = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      var W = 210, H = 297, m = 15;

      var primaryColor = [10, 35, 66];
      var secondaryColor = [240, 240, 245];
      var accentColor = [0, 168, 89];
      var dangerColor = [224, 60, 49];
      var textColor = [40, 40, 40];

      // Header Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, W, 40, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('ESTADO DE CUENTA', m, 20);

      var appName = document.getElementById('dashName') && document.getElementById('dashName').textContent ? document.getElementById('dashName').textContent : 'Finanzas';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(appName.toUpperCase(), W - m, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Reporte Financiero', W - m, 26, { align: 'right' });

      var y = 50;

      // Client Box
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.roundedRect(m, y, 100, 35, 2, 2, 'F');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('DATOS DEL TITULAR', m + 5, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      var userName = document.getElementById('sbUserName') ? document.getElementById('sbUserName').textContent : 'Usuario Principal';
      doc.text('Cliente: ' + userName, m + 5, y + 16);
      doc.text('Fecha de emision: ' + new Date().toLocaleDateString('es-PE'), m + 5, y + 22);
      doc.text('Periodo facturado: ' + periodo, m + 5, y + 28);
      doc.text('Moneda: ' + (window._moneda || 'PEN (S/)'), m + 5, y + 34);

      // Resumen del Periodo Box
      var rbX = m + 110;
      doc.roundedRect(rbX, y, W - m * 2 - 110, 35, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('RESUMEN DEL PERIODO', rbX + 5, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Total Ingresos:', rbX + 5, y + 16);
      doc.text(fmt(ing), W - m - 5, y + 16, { align: 'right' });

      doc.text('Total Egresos:', rbX + 5, y + 22);
      doc.text('-' + fmt(gas), W - m - 5, y + 22, { align: 'right' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Neto:', rbX + 5, y + 32);
      if (bal >= 0) { doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]); }
      else { doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]); }
      doc.text((bal >= 0 ? '+' : '') + fmt(bal), W - m - 5, y + 32, { align: 'right' });

      y += 45;

      // Table Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(m, y, W - m * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('FECHA', m + 3, y + 5.5);
      doc.text('DESCRIPCION', m + 25, y + 5.5);
      doc.text('CATEGORIA', m + 90, y + 5.5);
      doc.text('TIPO', m + 135, y + 5.5);
      doc.text('MONTO', W - m - 3, y + 5.5, { align: 'right' });

      y += 8;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      // Note: Printing all rows instead of just 40
      rows.forEach(function (r, i) {
        if (y > 270) {
          var currentPages = doc.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Pagina ' + currentPages, W / 2, 290, { align: 'center' });

          doc.addPage();
          y = 20;

          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(m, y, W - m * 2, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('FECHA', m + 3, y + 5.5);
          doc.text('DESCRIPCION', m + 25, y + 5.5);
          doc.text('CATEGORIA', m + 90, y + 5.5);
          doc.text('TIPO', m + 135, y + 5.5);
          doc.text('MONTO', W - m - 3, y + 5.5, { align: 'right' });
          y += 8;
          doc.setFont('helvetica', 'normal');
        }

        if (i % 2 === 0) {
          doc.setFillColor(245, 245, 249);
          doc.rect(m, y, W - m * 2, 7, 'F');
        }

        var isG = r.tipo === 'gasto';
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.text((r.fecha || '-').substring(0, 10), m + 3, y + 5);
        doc.text((r.descripcion || '-').substring(0, 45), m + 25, y + 5);
        doc.text((r.categoria || '-').substring(0, 25), m + 90, y + 5);

        doc.setFont('helvetica', 'italic');
        doc.text(r.tipo.toUpperCase(), m + 135, y + 5);
        doc.setFont('helvetica', 'bold');

        if (isG) {
          doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
        } else {
          doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        }

        doc.text((isG ? '-' : '+') + fmt(r.monto), W - m - 3, y + 5, { align: 'right' });
        y += 7;
      });

      y += 5;
      if (y > 260) { doc.addPage(); y = 20; }

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(m, y, W - m, y);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text('TOTAL MOVIMIENTOS: ' + rows.length, m, y);

      doc.text('TOTAL INGRESOS:', W - m - 35, y, { align: 'right' });
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(fmt(ing), W - m, y, { align: 'right' });
      y += 5;

      doc.setTextColor(60, 60, 60);
      doc.text('TOTAL EGRESOS:', W - m - 35, y, { align: 'right' });
      doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
      doc.text('-' + fmt(gas), W - m, y, { align: 'right' });

      var pages = doc.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('Este documento es un comprobante generado electronica y automaticamente por Finanzas.', m, 285);
        doc.text('Pagina ' + p + ' de ' + pages, W - m, 285, { align: 'right' });
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 290, W, 7, 'F');
      }

      doc.save('Factura_' + appName.replace(/ /g, '_') + '_' + periodo.replace(/ /g, '_') + '.pdf');
      toast('PDF (Factura) generado', 'ok');
    }

    /* EXPORTAR EXCEL */
    function exportarExcel() {
      var rows = getRows(periodoActivo);
      var data = [['Fecha Real', 'Fecha Ingreso', 'Hora Ingreso', 'Tipo', 'Monto', 'Categoria', 'Subcategoria', 'Descripcion', 'Nota', 'Etiquetas']];
      rows.forEach(function (r) { data.push([r.fecha || '', r.fecha_ingreso || '', r.hora_ingreso || '', r.tipo, r.monto, r.categoria, r.subcategoria, r.descripcion, r.nota || '', (r.etiquetas || []).join(', ')]); });
      var ws = XLSX.utils.aoa_to_sheet(data), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registros');
      XLSX.writeFile(wb, 'finanzas_' + (periodoActivo ? meses[periodoActivo - 1] : 'anual').toLowerCase() + '.xlsx');
      toast('Excel exportado', 'ok');
    }

    /* SYNC STATE */
    function setSyncState(s, t) { document.getElementById('syncDot').className = 'sync-dot ' + s; document.getElementById('syncTxt').textContent = t; }

    /* INIT */
    window.onAppReady = async function () {
      try {
        setPeriod(new Date().getMonth() + 1);
        document.getElementById('vDashboard').style.display = 'block';
        document.getElementById('vDashboard').classList.add('view-active');
        setSyncState('loading', 'Cargando...');
        handleResize();

        var safe = function (fn, def) { return Promise.resolve().then(fn).catch(function (e) { console.error('load error:', e); return def; }); };
        var results = await Promise.all([
          safe(function () { return window._loadPresupuestos(); }, { cats: {}, subs: {} }),
          safe(function () { return window._loadSettings(); }, {}),
          safe(function () { return window._loadRecurrentes(); }, []),
          safe(function () { return window._loadPatrimonio(); }, { activos: [], pasivos: [], history: [], movimientos: [] }),
          safe(function () { return window._loadSobregiros(); }, [])
        ]);
        presupCat = results[0].cats || {}; presupSub = results[0].subs || {};
        _settings = results[1];
        _recurrentes = results[2];
        _activos = results[3].activos || [];
        _pasivos = results[3].pasivos || [];
        _patrimonioHistory = results[3].history || [];
        _patrimonioMovimientos = results[3].movimientos || [];
        _sobregiros = dedupeSobregirosLista(results[4] || []);

        if (_settings.dashName) document.getElementById('dashName').textContent = _settings.dashName;
        if (_settings.moneda) { window._moneda = _settings.moneda; var cm = document.getElementById('cfgMoneda'); if (cm) cm.value = _settings.moneda; }
        if (_settings.meta) { window._metaAhorro = parseFloat(_settings.meta) || 30; var ml = document.getElementById('metaActualLabel'); if (ml) ml.textContent = _settings.meta + '%'; }
        if (_settings.theme) applyTheme(_settings.theme);
        if (_settings.accentColor) applyAccent(_settings.accentColor);
        if (_settings.weekStart !== undefined) { _weekStart = parseInt(_settings.weekStart); var wsEl = document.getElementById('cfgWeekStart'); if (wsEl) wsEl.value = String(_settings.weekStart); }

        window._startListener(async function (rows) {
          try {
            var prevIds = new Set(allRows.map(function (r) { return r.id; }));
            var isFirstLoad = allRows.length === 0;
            allRows = processRows(rows);
            await reconciliarSobregiros(allRows, prevIds, isFirstLoad);
            setSyncState('live', 'Sincronizado');
            document.getElementById('lastSync').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashPage').style.display = 'block';
            document.getElementById('errorBox').style.display = 'none';
            renderVista();
            try { checkRecurrentes(); } catch (e) { console.error(e); }
          } catch(err2) {
            console.error('Error in listener callback:', err2);
            document.getElementById('loading').style.display = 'none';
            var errBox = document.getElementById('errorBox');
            if(errBox) { errBox.style.display = 'block'; errBox.textContent = 'Error dibujando la pantalla: ' + err2.message; }
          }
        });
      } catch (err) {
        console.error('onAppReady init error:', err);
        document.getElementById('loading').style.display = 'none';
        var errBox = document.getElementById('errorBox');
        if(errBox) { errBox.style.display = 'block'; errBox.innerHTML = '<b>Error grave al inicializar:</b><br/>' + err.message; }
      }
    };

    document.addEventListener('DOMContentLoaded', function () { handleResize(); });
