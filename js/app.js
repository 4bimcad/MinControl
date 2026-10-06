// ==========================================================
// MinControl — App principal (Alpine.js) v3
// ==========================================================

function minControlApp() {
  return {
    pantalla: 'dashboard',
    cargando: true,
    config: {},
    sidebarAbierto: false,
    METALES_PREDEFINIDOS, UNIDADES_VALOR, UNIDADES_PRODUCCION,

    // Toast
    toast: { visible: false, mensaje: '' },
    mostrarToast(msg) {
      this.toast.mensaje = msg;
      this.toast.visible = true;
      setTimeout(() => { this.toast.visible = false; }, 2500);
    },

    // Proyecto único
    proyectoActivo: null,
    formProyectoNombre: '',
    formProyectoUnidad: 'T',

    // Metales
    metales: [],
    formMetal: { nombre: 'Au', nombreOtro: '', unidad: 'g', unidadOtro: '', precio: '', moneda: 'PEN' },
    editandoMetalId: null,
    adjuntosPorPago: {},

    // Dashboard
    periodoInicio: '', periodoFin: '',
    totales: null,

    // Producción
    listaProduccion: [],
    formProduccion: { fecha: '', comentario: '', cantidad: '', leyes: {} },
    editandoProduccionId: null,

    // Ingresos / Gastos (comparten estructura)
    listaIngresos: [], categoriasIngreso: [],
    formIngreso: { fecha: '', categoria: '', monto: '', moneda: 'PEN', tipo: 'proyecto', origen: '', observacion: '' },
    editandoIngresoId: null, archivoIngresoTemp: null, adjuntosPorIngreso: {},
    nuevaCategoriaIngreso: '',

    listaGastos: [], categoriasGasto: [],
    formGasto: { fecha: '', categoria: '', monto: '', moneda: 'PEN', tipo: 'proyecto', observacion: '' },
    editandoGastoId: null, archivoGastoTemp: null, adjuntosPorGasto: {},
    nuevaCategoriaGasto: '',

    // Trabajadores
    listaTrabajadores: [],
    formTrabajador: { nombre: '', jornalDiario: '', moneda: 'PEN' },
    editandoTrabajadorId: null,
    trabajadorSeleccionado: null, saldoTrabajadorSeleccionado: null, historialPagos: [],
    fechaDiaLaboral: '', diaLaboralHoy: {},
    formPago: { monto: '', metodo: 'Transferencia' }, archivoPagoTemp: null,
    editandoPagoId: null,

    // Caja chica
    listaCajas: [],
    formCaja: { nombre: '', montoEntregado: '', moneda: 'PEN' },
    editandoCajaId: null,
    cajaSeleccionada: null, saldoCajaSeleccionada: null,
    categoriasCaja: ['Transporte', 'Alojamiento', 'Comida', 'Insumos', 'Otro'],
    formMovimiento: { fecha: '', tipo: 'proyecto', categoria: 'Transporte', monto: '', moneda: 'PEN', observacion: '' },
    archivoMovimientoTemp: null, adjuntosPorMovimiento: {},

    // Licencia / prueba
    bloqueado: false,
    diasRestantesPrueba: 14,
    licenciaEstado: null,
    licenciaInput: '',
    licenciaError: '',

    // Visor de adjuntos
    visorAbierto: false, visorUrl: '', visorTipo: '', visorNombre: '',

    // ---------- Inicialización ----------
    async init() {
      try {
        await this._initInterno();
      } catch (e) {
        console.error('Error al iniciar MinControl:', e);
        this.errorInicio = 'No se pudo abrir la base de datos local. Detalle: ' + (e.message || e);
      }
      this.cargando = false;
    },
    errorInicio: '',
    async _initInterno() {
      this.config = await getConfig();

      // ---- Verificación de prueba / licencia ----
      const licencia = await validarLicencia(this.config.licenciaKey, this.config.deviceId);
      if (licencia.valida) {
        this.licenciaEstado = licencia;
        this.bloqueado = false;
      } else {
        const dias = diasDesde(this.config.fechaInstalacion);
        this.diasRestantesPrueba = Math.max(0, 14 - dias);
        this.bloqueado = this.diasRestantesPrueba <= 0;
      }

      const hoy = new Date();
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.periodoInicio = this.formatFecha(primerDiaMes);
      this.periodoFin = this.formatFecha(hoy);
      this.fechaDiaLaboral = this.formatFecha(hoy);
      this.formProduccion.fecha = this.formatFecha(hoy);
      this.formIngreso.fecha = this.formatFecha(hoy);
      this.formGasto.fecha = this.formatFecha(hoy);
      this.formMovimiento.fecha = this.formatFecha(hoy);

      this.proyectoActivo = { id: 1, nombre: this.config.nombreProyecto, unidadesDeValor: this.config.unidadesDeValor };
      this.formProyectoNombre = this.config.nombreProyecto;
      this.formProyectoUnidad = this.config.unidadesDeValor;
      await this.cargarTodo();

      this.cargando = false;
    },

    formatFecha(d) {
      const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },
    fd(iso) { return formatFechaDisplay(iso); },

    ir(pantalla) { this.pantalla = pantalla; this.sidebarAbierto = false; },

    // ---------- Proyecto único ----------
    async guardarDatosProyecto() {
      this.config.nombreProyecto = this.formProyectoNombre;
      this.config.unidadesDeValor = this.formProyectoUnidad;
      await saveConfig(this.config);
      this.proyectoActivo = { id: 1, nombre: this.config.nombreProyecto, unidadesDeValor: this.config.unidadesDeValor };
      this.mostrarToast('Datos del proyecto guardados');
    },

    async cargarTodo() {
      if (!this.proyectoActivo) return;
      this.metales = await listarMetales(this.proyectoActivo.id);
      await this.cargarDashboard();
      await this.cargarProduccion();
      await this.cargarCategorias();
      await this.cargarIngresos();
      await this.cargarGastos();
      await this.cargarTrabajadores();
      await this.cargarCajas();
    },

    // ---------- Metales ----------
    nombreMetal(m) { return m.nombre === 'Otro' ? m.nombreOtro : m.nombre; },
    unidadMetal(m) { return m.unidad === 'otro' ? m.unidadOtro : m.unidad; },
    fmt(n) { return fmt(n); },
    async guardarMetal() {
      const datos = {
        proyectoId: this.proyectoActivo.id,
        nombre: this.formMetal.nombre,
        nombreOtro: this.formMetal.nombreOtro,
        unidad: this.formMetal.unidad,
        unidadOtro: this.formMetal.unidadOtro,
        precio: Number(this.formMetal.precio),
        moneda: this.formMetal.moneda
      };
      if (this.editandoMetalId) datos.id = this.editandoMetalId;
      await guardarMetal(datos);
      this.metales = await listarMetales(this.proyectoActivo.id);
      this.formMetal = { nombre: 'Au', nombreOtro: '', unidad: 'g', unidadOtro: '', precio: '', moneda: 'PEN' };
      this.editandoMetalId = null;
      await this.cargarDashboard();
      this.mostrarToast('Metal guardado');
    },
    editarMetal(m) { this.editandoMetalId = m.id; this.formMetal = { nombre: m.nombre, nombreOtro: m.nombreOtro || '', unidad: m.unidad, unidadOtro: m.unidadOtro || '', precio: m.precio, moneda: m.moneda }; },
    resetFormMetal() { this.editandoMetalId = null; this.formMetal = { nombre: 'Au', nombreOtro: '', unidad: 'g', unidadOtro: '', precio: '', moneda: 'PEN' }; },
    async eliminarMetal(id) {
      if (!confirm('¿Eliminar este metal?')) return;
      await eliminarMetal(id);
      this.metales = await listarMetales(this.proyectoActivo.id);
      await this.cargarDashboard();
      this.mostrarToast('Metal eliminado');
    },

    // ---------- Dashboard ----------
    async cargarDashboard() {
      if (!this.proyectoActivo) return;
      this.totales = await calcTotalesProyecto(this.proyectoActivo.id, this.periodoInicio, this.periodoFin, this.config.monedaPrincipal, this.config.tipoCambioUsdPen, this.config);
    },

    // ---------- Producción ----------
    async cargarProduccion() {
      this.listaProduccion = await db.produccion.where({ proyectoId: this.proyectoActivo.id }).reverse().sortBy('fecha');
    },
    valorProduccionRegistro(p) {
      let total = 0;
      for (const m of this.metales) {
        const ley = p.leyes ? p.leyes[m.id] : null;
        const c = calcMetalContenido(p.cantidad, ley);
        if (c != null) total += convertMonto(c * (m.precio || 0), m.moneda, this.config.monedaPrincipal, this.config.tipoCambioUsdPen, this.config);
      }
      return total;
    },
    async guardarProduccion() {
      const datos = {
        proyectoId: this.proyectoActivo.id,
        fecha: this.formProduccion.fecha,
        comentario: this.formProduccion.comentario,
        cantidad: Number(this.formProduccion.cantidad),
        leyes: { ...this.formProduccion.leyes }
      };
      if (this.editandoProduccionId) await db.produccion.update(this.editandoProduccionId, datos);
      else await db.produccion.add(datos);
      this.resetFormProduccion();
      await this.cargarProduccion();
      await this.cargarDashboard();
      this.mostrarToast('Producción guardada');
    },
    editarProduccion(p) {
      this.editandoProduccionId = p.id;
      this.formProduccion = { fecha: p.fecha, comentario: p.comentario || '', cantidad: p.cantidad, leyes: { ...(p.leyes || {}) } };
    },
    async eliminarProduccion(id) {
      if (!confirm('¿Eliminar este registro?')) return;
      await db.produccion.delete(id);
      await this.cargarProduccion();
      await this.cargarDashboard();
      this.mostrarToast('Registro eliminado');
    },
    resetFormProduccion() {
      this.editandoProduccionId = null;
      this.formProduccion = { fecha: this.formatFecha(new Date()), comentario: '', cantidad: '', leyes: {} };
    },
    async exportarProduccionPDFClick() { await exportarProduccionPDF(this.proyectoActivo, this.listaProduccion, this.metales); },
    async exportarProduccionExcelClick() { await exportarProduccionExcel(this.proyectoActivo, this.listaProduccion, this.metales); },

    // ---------- Categorías Ingresos/Gastos ----------
    async cargarCategorias() {
      this.categoriasIngreso = await listarCategorias('ingreso', this.proyectoActivo.id);
      this.categoriasGasto = await listarCategorias('gasto', this.proyectoActivo.id);
      if (this.categoriasIngreso.length === 0) {
        for (const n of ['Venta de mineral', 'Adelanto', 'Préstamo', 'Otro']) await agregarCategoria('ingreso', this.proyectoActivo.id, n);
        this.categoriasIngreso = await listarCategorias('ingreso', this.proyectoActivo.id);
      }
      if (this.categoriasGasto.length === 0) {
        for (const n of ['Salario', 'Cocina', 'Alquiler de equipo', 'Combustible', 'Otro']) await agregarCategoria('gasto', this.proyectoActivo.id, n);
        this.categoriasGasto = await listarCategorias('gasto', this.proyectoActivo.id);
      }
      // Limpieza defensiva: si por alguna razón hay nombres repetidos (p.ej. datos de pruebas anteriores), dejar solo el primero
      const dedupe = async (lista, tabla) => {
        const vistos = new Set(); const aBorrar = [];
        for (const c of lista) { if (vistos.has(c.nombre)) aBorrar.push(c.id); else vistos.add(c.nombre); }
        for (const id of aBorrar) await eliminarCategoria(tabla, id);
        return aBorrar.length > 0;
      };
      if (await dedupe(this.categoriasIngreso, 'ingreso')) this.categoriasIngreso = await listarCategorias('ingreso', this.proyectoActivo.id);
      if (await dedupe(this.categoriasGasto, 'gasto')) this.categoriasGasto = await listarCategorias('gasto', this.proyectoActivo.id);
      if (!this.formIngreso.categoria && this.categoriasIngreso[0]) this.formIngreso.categoria = this.categoriasIngreso[0].nombre;
      if (!this.formGasto.categoria && this.categoriasGasto[0]) this.formGasto.categoria = this.categoriasGasto[0].nombre;
    },
    async agregarNuevaCategoriaIngreso() {
      if (!this.nuevaCategoriaIngreso.trim()) return;
      await agregarCategoria('ingreso', this.proyectoActivo.id, this.nuevaCategoriaIngreso.trim());
      this.nuevaCategoriaIngreso = '';
      this.categoriasIngreso = await listarCategorias('ingreso', this.proyectoActivo.id);
      this.mostrarToast('Categoría agregada');
    },
    async quitarCategoriaIngreso(id) { await eliminarCategoria('ingreso', id); this.categoriasIngreso = await listarCategorias('ingreso', this.proyectoActivo.id); this.mostrarToast('Categoría eliminada'); },
    async agregarNuevaCategoriaGasto() {
      if (!this.nuevaCategoriaGasto.trim()) return;
      await agregarCategoria('gasto', this.proyectoActivo.id, this.nuevaCategoriaGasto.trim());
      this.nuevaCategoriaGasto = '';
      this.categoriasGasto = await listarCategorias('gasto', this.proyectoActivo.id);
      this.mostrarToast('Categoría agregada');
    },
    async quitarCategoriaGasto(id) { await eliminarCategoria('gasto', id); this.categoriasGasto = await listarCategorias('gasto', this.proyectoActivo.id); this.mostrarToast('Categoría eliminada'); },

    // ---------- Ingresos ----------
    async cargarIngresos() {
      this.listaIngresos = await db.ingresos.where({ proyectoId: this.proyectoActivo.id }).reverse().sortBy('fecha');
      this.adjuntosPorIngreso = {};
      for (const i of this.listaIngresos) this.adjuntosPorIngreso[i.id] = await obtenerAdjuntos('ingresos', i.id);
    },
    onArchivoIngreso(e) { this.archivoIngresoTemp = e.target.files[0] || null; },
    montoConvertido(monto, moneda) {
      const otra = moneda === this.config.monedaPrincipal ? this.config.monedaSecundaria : this.config.monedaPrincipal;
      return otra + ' ' + convertMonto(monto || 0, moneda, otra, this.config.tipoCambioUsdPen, this.config).toFixed(2);
    },
    async guardarIngreso() {
      const datos = { proyectoId: this.proyectoActivo.id, ...this.formIngreso, monto: Number(this.formIngreso.monto) };
      let id;
      if (this.editandoIngresoId) { await db.ingresos.update(this.editandoIngresoId, datos); id = this.editandoIngresoId; }
      else id = await db.ingresos.add(datos);
      if (this.archivoIngresoTemp) {
        const previos = await obtenerAdjuntos('ingresos', id);
        for (const p of previos) await eliminarAdjunto(p.id);
        await guardarAdjunto('ingresos', id, this.archivoIngresoTemp, '');
      }
      this.resetFormIngreso();
      await this.cargarIngresos(); await this.cargarDashboard();
      this.mostrarToast('Ingreso guardado');
    },
    editarIngreso(i) {
      this.editandoIngresoId = i.id;
      this.formIngreso = { fecha: i.fecha, categoria: i.categoria, monto: i.monto, moneda: i.moneda || 'PEN', tipo: i.tipo || 'proyecto', origen: i.origen || '', observacion: i.observacion || '' };
    },
    async eliminarIngreso(id) {
      if (!confirm('¿Eliminar este ingreso?')) return;
      await db.ingresos.delete(id);
      await this.cargarIngresos(); await this.cargarDashboard();
      this.mostrarToast('Ingreso eliminado');
    },
    resetFormIngreso() {
      this.editandoIngresoId = null; this.archivoIngresoTemp = null;
      this.formIngreso = { fecha: this.formatFecha(new Date()), categoria: this.categoriasIngreso[0]?.nombre || '', monto: '', moneda: 'PEN', tipo: 'proyecto', origen: '', observacion: '' };
      const el = document.getElementById('archivoIngresoInput'); if (el) el.value = '';
    },
    async exportarIngresosPDFClick() { await exportarMovimientosPDF('Ingresos', this.proyectoActivo, this.listaIngresos, 'Proyecto'); },
    async exportarIngresosExcelClick() { await exportarMovimientosExcel('Ingresos', this.proyectoActivo, this.listaIngresos, 'Proyecto'); },

    // ---------- Gastos ----------
    async cargarGastos() {
      this.listaGastos = await db.gastos.where({ proyectoId: this.proyectoActivo.id }).reverse().sortBy('fecha');
      this.adjuntosPorGasto = {};
      for (const g of this.listaGastos) this.adjuntosPorGasto[g.id] = await obtenerAdjuntos('gastos', g.id);
    },
    onArchivoGasto(e) { this.archivoGastoTemp = e.target.files[0] || null; },
    async guardarGasto() {
      const datos = { proyectoId: this.proyectoActivo.id, ...this.formGasto, monto: Number(this.formGasto.monto) };
      let id;
      if (this.editandoGastoId) { await db.gastos.update(this.editandoGastoId, datos); id = this.editandoGastoId; }
      else id = await db.gastos.add(datos);
      if (this.archivoGastoTemp) {
        const previos = await obtenerAdjuntos('gastos', id);
        for (const p of previos) await eliminarAdjunto(p.id);
        await guardarAdjunto('gastos', id, this.archivoGastoTemp, '');
      }
      this.resetFormGasto();
      await this.cargarGastos(); await this.cargarDashboard();
      this.mostrarToast('Gasto guardado');
    },
    editarGasto(g) {
      this.editandoGastoId = g.id;
      this.formGasto = { fecha: g.fecha, categoria: g.categoria, monto: g.monto, moneda: g.moneda || 'PEN', tipo: g.tipo || 'proyecto', observacion: g.observacion || '' };
    },
    async eliminarGasto(id) {
      if (!confirm('¿Eliminar este gasto?')) return;
      await db.gastos.delete(id);
      await this.cargarGastos(); await this.cargarDashboard();
      this.mostrarToast('Gasto eliminado');
    },
    resetFormGasto() {
      this.editandoGastoId = null; this.archivoGastoTemp = null;
      this.formGasto = { fecha: this.formatFecha(new Date()), categoria: this.categoriasGasto[0]?.nombre || '', monto: '', moneda: 'PEN', tipo: 'proyecto', observacion: '' };
      const el = document.getElementById('archivoGastoInput'); if (el) el.value = '';
    },
    async exportarGastosPDFClick(soloTipo) {
      const registros = soloTipo ? this.listaGastos.filter(g => g.tipo === soloTipo) : this.listaGastos;
      await exportarMovimientosPDF(soloTipo === 'personal' ? 'Gastos Personales' : soloTipo === 'proyecto' ? 'Gastos de Proyecto' : 'Gastos', this.proyectoActivo, registros, 'Proyecto');
    },
    async exportarGastosExcelClick(soloTipo) {
      const registros = soloTipo ? this.listaGastos.filter(g => g.tipo === soloTipo) : this.listaGastos;
      await exportarMovimientosExcel(soloTipo === 'personal' ? 'Gastos Personales' : soloTipo === 'proyecto' ? 'Gastos de Proyecto' : 'Gastos', this.proyectoActivo, registros, 'Proyecto');
    },

    // ---------- Trabajadores ----------
    async cargarTrabajadores() {
      this.listaTrabajadores = await db.trabajadores.where({ proyectoId: this.proyectoActivo.id }).toArray();
      const registros = await db.diasLaborales.where({ proyectoId: this.proyectoActivo.id, fecha: this.fechaDiaLaboral }).toArray();
      this.diaLaboralHoy = {};
      for (const r of registros) this.diaLaboralHoy[r.trabajadorId] = r.estado;
    },
    async guardarTrabajador() {
      const datos = { proyectoId: this.proyectoActivo.id, nombre: this.formTrabajador.nombre, jornalDiario: Number(this.formTrabajador.jornalDiario), moneda: this.formTrabajador.moneda, estado: 'activo' };
      if (this.editandoTrabajadorId) await db.trabajadores.update(this.editandoTrabajadorId, datos);
      else await db.trabajadores.add(datos);
      this.formTrabajador = { nombre: '', jornalDiario: '', moneda: 'PEN' };
      this.editandoTrabajadorId = null;
      await this.cargarTrabajadores();
      this.mostrarToast('Trabajador guardado');
    },
    editarTrabajador(t) { this.editandoTrabajadorId = t.id; this.formTrabajador = { nombre: t.nombre, jornalDiario: t.jornalDiario, moneda: t.moneda || 'PEN' }; },
    resetFormTrabajador() { this.editandoTrabajadorId = null; this.formTrabajador = { nombre: '', jornalDiario: '', moneda: 'PEN' }; },
    async despedirTrabajador(id) {
      if (!confirm('¿Despedir a este trabajador? Su historial se conserva pero no aparecerá en reportes generales nuevos.')) return;
      await db.trabajadores.update(id, { estado: 'despedido' });
      this.trabajadorSeleccionado = null;
      await this.cargarTrabajadores();
      this.mostrarToast('Trabajador despedido');
    },
    async marcarDiaLaboral(trabajadorId, estado) {
      this.diaLaboralHoy[trabajadorId] = estado;
      const existente = await db.diasLaborales.where({ proyectoId: this.proyectoActivo.id, fecha: this.fechaDiaLaboral, trabajadorId }).first();
      if (existente) await db.diasLaborales.update(existente.id, { estado });
      else await db.diasLaborales.add({ proyectoId: this.proyectoActivo.id, fecha: this.fechaDiaLaboral, trabajadorId, estado });
    },
    async cambiarFechaDiaLaboral(fecha) { this.fechaDiaLaboral = fecha; await this.cargarTrabajadores(); },
    async cargarAdjuntosPagos() {
      this.adjuntosPorPago = {};
      for (const p of this.historialPagos) this.adjuntosPorPago[p.id] = await obtenerAdjuntos('pagosTrabajador', p.id);
    },
    async abrirTrabajador(t) {
      this.trabajadorSeleccionado = t;
      this.saldoTrabajadorSeleccionado = await calcSaldoTrabajador(t.id);
      this.historialPagos = await db.pagosTrabajador.where('trabajadorId').equals(t.id).reverse().sortBy('fecha');
      await this.cargarAdjuntosPagos();
      this.formPago = { monto: '', metodo: 'Transferencia' };
      this.archivoPagoTemp = null;
      this.editandoPagoId = null;
    },
    onArchivoPago(e) { this.archivoPagoTemp = e.target.files[0] || null; },
    async registrarPago() {
      const datos = { proyectoId: this.proyectoActivo.id, trabajadorId: this.trabajadorSeleccionado.id, fecha: this.formatFecha(new Date()), monto: Number(this.formPago.monto), metodo: this.formPago.metodo };
      let id;
      if (this.editandoPagoId) { await db.pagosTrabajador.update(this.editandoPagoId, datos); id = this.editandoPagoId; }
      else id = await db.pagosTrabajador.add(datos);
      if (this.archivoPagoTemp) {
        const previos = await obtenerAdjuntos('pagosTrabajador', id);
        for (const p of previos) await eliminarAdjunto(p.id);
        await guardarAdjunto('pagosTrabajador', id, this.archivoPagoTemp, '');
      }
      this.saldoTrabajadorSeleccionado = await calcSaldoTrabajador(this.trabajadorSeleccionado.id);
      this.historialPagos = await db.pagosTrabajador.where('trabajadorId').equals(this.trabajadorSeleccionado.id).reverse().sortBy('fecha');
      await this.cargarAdjuntosPagos();
      this.formPago = { monto: '', metodo: 'Transferencia' }; this.archivoPagoTemp = null; this.editandoPagoId = null;
      const el = document.getElementById('archivoPagoInput'); if (el) el.value = '';
      await this.cargarDashboard();
      this.mostrarToast('Pago registrado');
    },
    editarPago(p) { this.editandoPagoId = p.id; this.formPago = { monto: p.monto, metodo: p.metodo }; },
    cancelarPago() { this.editandoPagoId = null; this.formPago = { monto: '', metodo: 'Transferencia' }; this.archivoPagoTemp = null; const el = document.getElementById('archivoPagoInput'); if (el) el.value = ''; },
    async eliminarPago(id) {
      if (!confirm('¿Eliminar este pago?')) return;
      await db.pagosTrabajador.delete(id);
      this.saldoTrabajadorSeleccionado = await calcSaldoTrabajador(this.trabajadorSeleccionado.id);
      this.historialPagos = await db.pagosTrabajador.where('trabajadorId').equals(this.trabajadorSeleccionado.id).reverse().sortBy('fecha');
      await this.cargarAdjuntosPagos();
      await this.cargarDashboard();
      this.mostrarToast('Pago eliminado');
    },
    async exportarTrabajadorPDFClick() { await exportarTrabajadorPDF(this.trabajadorSeleccionado, this.saldoTrabajadorSeleccionado, this.historialPagos, this.proyectoActivo); },
    async exportarTrabajadorExcelClick() { await exportarTrabajadorExcel(this.trabajadorSeleccionado, this.saldoTrabajadorSeleccionado, this.historialPagos); },
    async exportarTrabajadoresGeneralPDFClick() {
      const activos = this.listaTrabajadores.filter(t => t.estado === 'activo');
      const conSaldo = [];
      for (const t of activos) conSaldo.push({ trabajador: t, saldo: await calcSaldoTrabajador(t.id) });
      await exportarTrabajadoresGeneralPDF(this.proyectoActivo, conSaldo);
    },
    async exportarTrabajadoresGeneralExcelClick() {
      const activos = this.listaTrabajadores.filter(t => t.estado === 'activo');
      const conSaldo = [];
      for (const t of activos) conSaldo.push({ trabajador: t, saldo: await calcSaldoTrabajador(t.id) });
      await exportarTrabajadoresGeneralExcel(this.proyectoActivo, conSaldo);
    },

    // ---------- Caja chica ----------
    async cargarCajas() { this.listaCajas = await db.cajasChicas.where({ proyectoId: this.proyectoActivo.id }).toArray(); },
    async guardarCaja() {
      const datos = { proyectoId: this.proyectoActivo.id, nombre: this.formCaja.nombre, montoEntregado: Number(this.formCaja.montoEntregado || 0), moneda: this.formCaja.moneda };
      if (this.editandoCajaId) await db.cajasChicas.update(this.editandoCajaId, datos);
      else await db.cajasChicas.add(datos);
      this.formCaja = { nombre: '', montoEntregado: '', moneda: 'PEN' }; this.editandoCajaId = null;
      await this.cargarCajas();
      this.mostrarToast('Caja chica guardada');
    },
    editarCaja(c) { this.editandoCajaId = c.id; this.formCaja = { nombre: c.nombre, montoEntregado: c.montoEntregado, moneda: c.moneda }; },
    resetFormCaja() { this.editandoCajaId = null; this.formCaja = { nombre: '', montoEntregado: '', moneda: 'PEN' }; },
    async eliminarCaja(id) {
      if (!confirm('¿Eliminar esta caja chica?')) return;
      await db.cajasChicas.delete(id);
      await this.cargarCajas();
      this.mostrarToast('Caja chica eliminada');
    },
    async abrirCaja(c) {
      this.cajaSeleccionada = c;
      this.saldoCajaSeleccionada = await calcSaldoCajaChica(c.id);
      this.formMovimiento = { fecha: this.formatFecha(new Date()), tipo: 'proyecto', categoria: this.categoriasCaja[0], monto: '', moneda: c.moneda, observacion: '' };
      await this.cargarAdjuntosMovimientos();
    },
    async cargarAdjuntosMovimientos() {
      this.adjuntosPorMovimiento = {};
      if (!this.saldoCajaSeleccionada) return;
      for (const m of this.saldoCajaSeleccionada.movimientos) this.adjuntosPorMovimiento[m.id] = await obtenerAdjuntos('movimientosCajaChica', m.id);
    },
    onArchivoMovimiento(e) { this.archivoMovimientoTemp = e.target.files[0] || null; },
    async guardarMovimiento() {
      const movId = await db.movimientosCajaChica.add({ cajaChicaId: this.cajaSeleccionada.id, proyectoId: this.proyectoActivo.id, ...this.formMovimiento, monto: Number(this.formMovimiento.monto) });
      if (this.archivoMovimientoTemp) await guardarAdjunto('movimientosCajaChica', movId, this.archivoMovimientoTemp, '');
      this.saldoCajaSeleccionada = await calcSaldoCajaChica(this.cajaSeleccionada.id);
      this.formMovimiento = { fecha: this.formatFecha(new Date()), tipo: 'proyecto', categoria: this.categoriasCaja[0], monto: '', moneda: this.cajaSeleccionada.moneda, observacion: '' };
      this.archivoMovimientoTemp = null;
      const el = document.getElementById('archivoMovimientoInput'); if (el) el.value = '';
      await this.cargarAdjuntosMovimientos();
      this.mostrarToast('Movimiento agregado');
    },
    async exportarCajaPDFClick(soloTipo) { await exportarCajaChicaPDF(this.cajaSeleccionada, this.saldoCajaSeleccionada, this.proyectoActivo, soloTipo); },
    async exportarCajaExcelClick(soloTipo) { await exportarCajaChicaExcel(this.cajaSeleccionada, this.saldoCajaSeleccionada, soloTipo); },

    // ---------- Visor de adjuntos ----------
    abrirAdjunto(a) { this.visorUrl = URL.createObjectURL(a.blob); this.visorTipo = a.tipoArchivo; this.visorNombre = a.nombre; this.visorAbierto = true; },
    cerrarVisor() { this.visorAbierto = false; if (this.visorUrl) URL.revokeObjectURL(this.visorUrl); this.visorUrl = ''; },

    // ---------- Licencia ----------
    async activarLicencia() {
      this.licenciaError = '';
      const resultado = await validarLicencia(this.licenciaInput, this.config.deviceId);
      if (!resultado.valida) {
        this.licenciaError = 'Clave inválida' + (resultado.motivo ? ' (' + resultado.motivo + ')' : '') + '.';
        return;
      }
      this.config.licenciaKey = this.licenciaInput.trim();
      await saveConfig(this.config);
      this.licenciaEstado = resultado;
      this.bloqueado = false;
      this.mostrarToast('Licencia activada. ¡Gracias!');
    },

    // ---------- Configuración general ----------
    async guardarConfigGeneral() { await saveConfig(this.config); await this.cargarDashboard(); this.mostrarToast('Configuración guardada'); },

    // ---------- Backup ----------
    async exportar() {
      const data = await exportarBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `mincontrol_backup_${this.formatFecha(new Date())}.json`; a.click();
      URL.revokeObjectURL(url);
      this.mostrarToast('Copia exportada');
    },
    async importar(event) {
      const file = event.target.files[0]; if (!file) return;
      const data = JSON.parse(await file.text());
      if (!confirm('Esto reemplazará todos los datos actuales. ¿Continuar?')) return;
      await importarBackup(data);
      location.reload();
    },
    async exportarComprobantes() {
      await exportarArchivoComprobantes(this.proyectoActivo ? this.proyectoActivo.nombre : 'todos');
      this.mostrarToast('Archivo de comprobantes generado');
    }
  };
}
