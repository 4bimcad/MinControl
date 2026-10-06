// ==========================================================
// MinControl — Base de datos local (IndexedDB via Dexie.js) v3
// ==========================================================

const db = new Dexie('MinControlDB');

db.version(3).stores({
  config: 'id',
  metales: '++id, proyectoId, nombre',
  produccion: '++id, proyectoId, fecha',
  categoriasIngreso: '++id, proyectoId, nombre',
  categoriasGasto: '++id, proyectoId, nombre',
  ingresos: '++id, proyectoId, fecha, tipo',
  gastos: '++id, proyectoId, fecha, tipo',
  trabajadores: '++id, proyectoId, nombre, estado',
  diasLaborales: '++id, proyectoId, trabajadorId, fecha',
  pagosTrabajador: '++id, proyectoId, trabajadorId, fecha',
  cajasChicas: '++id, proyectoId, nombre',
  movimientosCajaChica: '++id, cajaChicaId, proyectoId, fecha, tipo',
  adjuntos: '++id, refTabla, refId, nombre, tipoArchivo'
});

const METALES_PREDEFINIDOS = [
  { c: 'Au', n: 'Oro' }, { c: 'Ag', n: 'Plata' }, { c: 'Cu', n: 'Cobre' },
  { c: 'Fe', n: 'Hierro' }, { c: 'Zn', n: 'Zinc' }, { c: 'Pb', n: 'Plomo' },
  { c: 'Sn', n: 'Estaño' }, { c: 'Li', n: 'Litio' }, { c: 'Ni', n: 'Níquel' },
  { c: 'Mo', n: 'Molibdeno' }, { c: 'Otro', n: '' }
];
const UNIDADES_VALOR = ['t', 'kg', 'g', 'oz', 'm3', '%', 'ppm', 'otro'];
const UNIDADES_PRODUCCION = [
  { v: 'T', l: 'Toneladas métricas (t)' },
  { v: 'M3', l: 'Metros cúbicos (m³)' }
];

// ---------- Configuración general ----------
function generarDeviceId() {
  return 'D' + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

async function getConfig() {
  let cfg = await db.config.get(1);
  let cambiado = false;
  if (!cfg) {
    cfg = {
      id: 1, tipoCambioUsdPen: 3.75,
      monedaPrincipal: 'PEN', monedaSecundaria: 'USD',
      nombreProyecto: 'Mi proyecto', unidadesDeValor: 'T',
      deviceId: generarDeviceId(),
      fechaInstalacion: new Date().toISOString().slice(0, 10),
      licenciaKey: ''
    };
    cambiado = true;
  } else {
    if (!cfg.monedaSecundaria) { cfg.monedaSecundaria = 'USD'; cambiado = true; }
    if (!cfg.nombreProyecto) { cfg.nombreProyecto = 'Mi proyecto'; cambiado = true; }
    if (!cfg.unidadesDeValor) { cfg.unidadesDeValor = 'T'; cambiado = true; }
    if (!cfg.deviceId) { cfg.deviceId = generarDeviceId(); cambiado = true; }
    if (!cfg.fechaInstalacion) { cfg.fechaInstalacion = new Date().toISOString().slice(0, 10); cambiado = true; }
    if (cfg.licenciaKey == null) { cfg.licenciaKey = ''; cambiado = true; }
  }
  if (cambiado) await db.config.put(cfg);
  return cfg;
}
async function saveConfig(cfg) {
  const plano = JSON.parse(JSON.stringify(cfg));
  plano.id = 1;
  await db.config.put(plano);
  return plano;
}

// ---------- Conversión de moneda ----------
// tipoCambio = cuántas unidades de monedaPrincipal equivalen a 1 unidad de monedaSecundaria
function convertMonto(monto, monedaOrigen, monedaDestino, tipoCambio, cfg) {
  if (monedaOrigen === monedaDestino) return Number(monto);
  const principal = cfg ? cfg.monedaPrincipal : 'PEN';
  const secundaria = cfg ? cfg.monedaSecundaria : 'USD';
  if (monedaOrigen === secundaria && monedaDestino === principal) return Number(monto) * tipoCambio;
  if (monedaOrigen === principal && monedaDestino === secundaria) return Number(monto) / tipoCambio;
  return Number(monto); // moneda no reconocida: sin conversión posible
}

// ---------- Metales por proyecto ----------
async function listarMetales(proyectoId) { return db.metales.where({ proyectoId }).toArray(); }
async function guardarMetal(datos) {
  if (datos.id) { await db.metales.update(datos.id, datos); return datos.id; }
  return db.metales.add(datos);
}
async function eliminarMetal(id) { return db.metales.delete(id); }

// ---------- Producción ----------
// leyes: { metalId: leyValue }
function calcMetalContenido(cantidad, ley) {
  if (cantidad == null || ley == null || ley === '' || cantidad === '') return null;
  return Number(cantidad) * Number(ley);
}

async function calcValorProduccion(registro, metales, monedaDestino, tipoCambio, cfg) {
  let total = 0;
  const detalle = [];
  for (const m of metales) {
    const ley = registro.leyes ? registro.leyes[m.id] : null;
    const contenido = calcMetalContenido(registro.cantidad, ley);
    let valor = null;
    if (contenido != null) {
      valor = contenido * Number(m.precio || 0);
      valor = convertMonto(valor, m.moneda, monedaDestino, tipoCambio, cfg);
    }
    detalle.push({ metal: m, ley, contenido, valor });
    if (valor != null) total += valor;
  }
  return { total, detalle };
}

// ---------- Categorías (Ingresos/Gastos) ----------
async function listarCategorias(tabla, proyectoId) {
  const t = tabla === 'ingreso' ? db.categoriasIngreso : db.categoriasGasto;
  return t.where({ proyectoId }).toArray();
}
async function agregarCategoria(tabla, proyectoId, nombre) {
  const t = tabla === 'ingreso' ? db.categoriasIngreso : db.categoriasGasto;
  return t.add({ proyectoId, nombre });
}
async function eliminarCategoria(tabla, id) {
  const t = tabla === 'ingreso' ? db.categoriasIngreso : db.categoriasGasto;
  return t.delete(id);
}

// ---------- Trabajadores ----------
async function calcSaldoTrabajador(trabajadorId) {
  const trabajador = await db.trabajadores.get(trabajadorId);
  if (!trabajador) return null;
  const dias = await db.diasLaborales.where('trabajadorId').equals(trabajadorId).and(d => d.estado === 'trabajo').toArray();
  const devengado = dias.length * Number(trabajador.jornalDiario || 0);
  const pagos = await db.pagosTrabajador.where('trabajadorId').equals(trabajadorId).toArray();
  const pagado = pagos.reduce((s, p) => s + Number(p.monto || 0), 0);
  return { diasTrabajados: dias.length, devengado, pagado, saldo: devengado - pagado, moneda: trabajador.moneda || 'PEN' };
}

// ---------- Caja chica ----------
async function calcSaldoCajaChica(cajaChicaId) {
  const caja = await db.cajasChicas.get(cajaChicaId);
  if (!caja) return null;
  const movimientos = await db.movimientosCajaChica.where('cajaChicaId').equals(cajaChicaId).toArray();
  const gastoProyecto = movimientos.filter(m => m.tipo === 'proyecto').reduce((s, m) => s + Number(m.monto || 0), 0);
  const gastoPersonal = movimientos.filter(m => m.tipo === 'personal').reduce((s, m) => s + Number(m.monto || 0), 0);
  const saldo = Number(caja.montoEntregado || 0) - gastoProyecto;
  return { gastoProyecto, gastoPersonal, saldo, movimientos };
}

// ---------- Totales del proyecto (para Inicio) ----------
async function calcTotalesProyecto(proyectoId, fechaInicio, fechaFin, monedaDestino, tipoCambio, cfg) {
  const metales = await listarMetales(proyectoId);
  const producciones = await db.produccion.where({ proyectoId }).and(p => p.fecha >= fechaInicio && p.fecha <= fechaFin).toArray();

  let valorProduccionTotal = 0;
  const porMetal = {};
  for (const m of metales) porMetal[m.id] = { metal: m, cantidadConLey: 0, contenido: 0, valor: 0 };

  for (const p of producciones) {
    const { detalle } = await calcValorProduccion(p, metales, monedaDestino, tipoCambio, cfg);
    for (const d of detalle) {
      if (d.contenido != null) {
        porMetal[d.metal.id].contenido += d.contenido;
        porMetal[d.metal.id].valor += (d.valor || 0);
      }
    }
    if (detalle.some(d => d.valor != null)) valorProduccionTotal += detalle.reduce((s, d) => s + (d.valor || 0), 0);
  }

  const cantidadTotal = producciones.reduce((s, p) => s + Number(p.cantidad || 0), 0);

  const ingresos = await db.ingresos.where({ proyectoId }).and(i => i.fecha >= fechaInicio && i.fecha <= fechaFin).toArray();
  const gastos = await db.gastos.where({ proyectoId }).and(g => g.fecha >= fechaInicio && g.fecha <= fechaFin).toArray();
  const pagos = await db.pagosTrabajador.where({ proyectoId }).and(p => p.fecha >= fechaInicio && p.fecha <= fechaFin).toArray();

  const sumConvert = (arr) => arr.reduce((s, x) => s + convertMonto(x.monto, x.moneda || cfg.monedaPrincipal, monedaDestino, tipoCambio, cfg), 0);

  const ingresosNegocio = sumConvert(ingresos.filter(i => i.tipo !== 'personal'));
  const ingresosPersonal = sumConvert(ingresos.filter(i => i.tipo === 'personal'));
  const gastosNegocio = sumConvert(gastos.filter(g => g.tipo !== 'personal'));
  const gastosPersonal = sumConvert(gastos.filter(g => g.tipo === 'personal'));
  const pagosTotal = sumConvert(pagos);

  const costosTotal = gastosNegocio + pagosTotal;
  const margen = ingresosNegocio - costosTotal;

  return {
    cantidadTotal, valorProduccionTotal, porMetal,
    ingresosNegocio, gastosNegocio, pagosTotal, costosTotal, margen,
    personal: { ingresos: ingresosPersonal, gastos: gastosPersonal, saldo: ingresosPersonal - gastosPersonal },
    producciones, ingresos, gastos, pagos, metales
  };
}

// ---------- Adjuntos ----------
async function guardarAdjunto(refTabla, refId, file, descripcion) {
  const tipoArchivo = file.type === 'application/pdf' ? 'pdf' : 'image';
  return db.adjuntos.add({ refTabla, refId, fecha: new Date().toISOString(), nombre: file.name, tipoArchivo, blob: file, descripcion: descripcion || '' });
}
async function obtenerAdjuntos(refTabla, refId) { return db.adjuntos.where({ refTabla, refId }).toArray(); }
async function eliminarAdjunto(id) { return db.adjuntos.delete(id); }

// ---------- Backup completo ----------
async function exportarBackup() {
  const data = { version: 3, fechaExport: new Date().toISOString() };
  for (const t of db.tables) {
    if (t.name !== 'adjuntos') data[t.name] = await t.toArray();
  }
  return data;
}
async function importarBackup(data) {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (table.name !== 'adjuntos' && data[table.name]) {
        await table.clear();
        await table.bulkAdd(data[table.name]);
      }
    }
  });
}

// ---------- Formato numérico seguro (sin NaN/undefined, con separador de miles) ----------
function fmt(n) {
  const v = Number(n);
  if (!isFinite(v)) return '0.00';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Formato de fecha ----------
function formatFechaDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
