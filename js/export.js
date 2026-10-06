// ==========================================================
// MinControl — Exportación PDF / Excel / Archivo ZIP de adjuntos
// ==========================================================

function fechaHoraGeneracion() {
  const d = new Date();
  const fecha = formatFechaDisplay(d.toISOString().slice(0, 10));
  const hora = d.toTimeString().slice(0, 5);
  return `${fecha} ${hora}`;
}

let _logoDataUrl = undefined;
async function obtenerLogoDataUrl() {
  if (_logoDataUrl !== undefined) return _logoDataUrl;
  try {
    const resp = await fetch('img/logo.png');
    if (!resp.ok) { _logoDataUrl = null; return null; }
    const blob = await resp.blob();
    _logoDataUrl = await new Promise((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) { _logoDataUrl = null; }
  return _logoDataUrl;
}

async function nuevoPDF(titulo, proyecto) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const logo = await obtenerLogoDataUrl();
  let xTexto = 14;
  if (logo) {
    try { doc.addImage(logo, 'PNG', 14, 8, 14, 14); xTexto = 32; } catch (e) {}
  }

  doc.setFontSize(16);
  doc.text(proyecto ? proyecto.nombre : 'MinControl', xTexto, 16);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(titulo, xTexto, 23);
  doc.setFontSize(8);
  doc.text(`Generado: ${fechaHoraGeneracion()}`, xTexto, 28);
  doc.setDrawColor(200);
  doc.line(14, 32, 196, 32);
  doc.setTextColor(0);
  doc._y0 = 42;
  return doc;
}

function piePagina(doc) {
  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text('Desarrollado por INFOSET (infoset.org.pe)', 14, 290);
    doc.setTextColor(0);
  }
}

function guardarPDFConPie(doc, nombreArchivo) {
  piePagina(doc);
  doc.save(nombreArchivo);
}

function tablaSimple(doc, y, headers, rows, colX) {
  const margenDerecho = 196;
  // Ancho de cada columna = distancia hasta la siguiente columna (la última llega hasta el margen)
  const anchos = colX.map((x, i) => (i < colX.length - 1 ? colX[i + 1] - x - 3 : margenDerecho - x));

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  doc.setFont(undefined, 'normal');
  y += 5;
  doc.setDrawColor(220);
  doc.line(14, y, margenDerecho, y);
  y += 5;

  for (const row of rows) {
    // Dividir cada celda en líneas según el ancho disponible — nada se corta, todo se conserva
    const celdas = row.map((val, i) => doc.splitTextToSize(String(val ?? ''), anchos[i]));
    const maxLineas = Math.max(1, ...celdas.map(c => c.length));

    if (y + maxLineas * 5 > 280) { doc.addPage(); y = 20; }

    celdas.forEach((lineas, i) => doc.text(lineas, colX[i], y));
    y += maxLineas * 5 + 1;
  }
  return y;
}

// ---------- Excel genérico (SheetJS), con fecha de generación y pie ----------
function exportarExcel(nombreArchivo, hojas) {
  const wb = XLSX.utils.book_new();
  for (const [nombreHoja, filas] of hojas) {
    const filasConPie = [...filas, {}, { [Object.keys(filas[0] || { A: '' })[0]]: `Generado: ${fechaHoraGeneracion()} — Desarrollado por INFOSET (infoset.org.pe)` }];
    const ws = XLSX.utils.json_to_sheet(filasConPie);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja.slice(0, 31));
  }
  XLSX.writeFile(wb, nombreArchivo);
}

// ---------- Producción ----------
async function exportarProduccionPDF(proyecto, producciones, metales) {
  const doc = await nuevoPDF('Producción', proyecto);
  const headers = ['Fecha', 'Comentario', 'Cantidad', ...metales.map(m => 'Ley ' + m.nombre)];
  const colX = [14, 40, 90, 115, 145, 170];
  const rows = producciones.map(p => [
    formatFechaDisplay(p.fecha), (p.comentario || ''), p.cantidad,
    ...metales.map(m => (p.leyes && p.leyes[m.id] != null) ? p.leyes[m.id] : '—')
  ]);
  tablaSimple(doc, doc._y0, headers, rows, colX);
  guardarPDFConPie(doc, `produccion_${proyecto.nombre}.pdf`);
}
async function exportarProduccionExcel(proyecto, producciones, metales) {
  const filas = producciones.map(p => {
    const fila = { Fecha: formatFechaDisplay(p.fecha), Comentario: p.comentario || '', Cantidad: p.cantidad };
    metales.forEach(m => { fila['Ley ' + m.nombre] = (p.leyes && p.leyes[m.id] != null) ? p.leyes[m.id] : ''; });
    return fila;
  });
  exportarExcel(`produccion_${proyecto.nombre}.xlsx`, [['Producción', filas.length ? filas : [{ Fecha: '', Comentario: '', Cantidad: '' }]]]);
}

// ---------- Ingresos / Gastos ----------
// labelNoPersonal: cómo llamar al tipo que no es "Personal" (Negocio para Ingresos, Proyecto para Gastos)
async function exportarMovimientosPDF(titulo, proyecto, registros, labelNoPersonal) {
  const doc = await nuevoPDF(titulo, proyecto);
  const headers = ['Fecha', 'Categoría', 'Monto', 'Moneda', 'Tipo', 'Origen/Obs'];
  const colX = [14, 45, 85, 105, 125, 150];
  const rows = registros.map(r => [
    formatFechaDisplay(r.fecha), r.categoria, Number(r.monto || 0).toFixed(2), r.moneda || '',
    r.tipo === 'personal' ? 'Personal' : labelNoPersonal, (r.origen || r.observacion || '')
  ]);
  tablaSimple(doc, doc._y0, headers, rows, colX);
  guardarPDFConPie(doc, `${titulo.toLowerCase().replace(/\s+/g, '_')}_${proyecto.nombre}.pdf`);
}
async function exportarMovimientosExcel(titulo, proyecto, registros, labelNoPersonal) {
  const filas = registros.map(r => ({
    Fecha: formatFechaDisplay(r.fecha), Categoría: r.categoria, Monto: r.monto || 0, Moneda: r.moneda || '',
    Tipo: r.tipo === 'personal' ? 'Personal' : labelNoPersonal, 'Origen/Observación': r.origen || r.observacion || ''
  }));
  exportarExcel(`${titulo.toLowerCase().replace(/\s+/g, '_')}_${proyecto.nombre}.xlsx`, [[titulo, filas.length ? filas : [{ Fecha: '', Categoría: '', Monto: 0, Moneda: '', Tipo: '', 'Origen/Observación': '' }]]]);
}

// ---------- Trabajador individual ----------
async function exportarTrabajadorPDF(trabajador, saldo, pagos, proyecto) {
  const doc = await nuevoPDF(`Estado de cuenta — ${trabajador.nombre}`, proyecto);
  let y = doc._y0;
  doc.setFontSize(10);
  doc.text(`Jornal diario: ${trabajador.moneda} ${Number(trabajador.jornalDiario || 0).toFixed(2)}`, 14, y); y += 7;
  doc.text(`Días trabajados: ${saldo.diasTrabajados}`, 14, y); y += 7;
  doc.text(`Devengado: ${trabajador.moneda} ${(saldo.devengado || 0).toFixed(2)}`, 14, y); y += 7;
  doc.text(`Pagado: ${trabajador.moneda} ${(saldo.pagado || 0).toFixed(2)}`, 14, y); y += 9;
  doc.setFontSize(12);
  const estado = saldo.saldo > 0 ? `Se le debe ${trabajador.moneda} ${saldo.saldo.toFixed(2)}` : saldo.saldo < 0 ? `Pago en exceso: ${trabajador.moneda} ${Math.abs(saldo.saldo).toFixed(2)}` : 'Pagado completo';
  doc.text(estado, 14, y); y += 12;
  doc.setFontSize(11); doc.text('Historial de pagos', 14, y); y += 6;
  tablaSimple(doc, y, ['Fecha', 'Monto', 'Método'], pagos.map(p => [formatFechaDisplay(p.fecha), Number(p.monto || 0).toFixed(2), p.metodo]), [14, 60, 100]);
  guardarPDFConPie(doc, `estado_cuenta_${trabajador.nombre.replace(/\s+/g, '_')}.pdf`);
}
async function exportarTrabajadorExcel(trabajador, saldo, pagos) {
  const filas = pagos.map(p => ({ Fecha: formatFechaDisplay(p.fecha), Monto: p.monto || 0, Método: p.metodo }));
  exportarExcel(`estado_cuenta_${trabajador.nombre.replace(/\s+/g, '_')}.xlsx`, [['Pagos', filas.length ? filas : [{ Fecha: '', Monto: 0, Método: '' }]]]);
}

// ---------- Reporte general de trabajadores ----------
async function exportarTrabajadoresGeneralPDF(proyecto, trabajadoresConSaldo) {
  const doc = await nuevoPDF('Reporte general de trabajadores', proyecto);
  const rows = trabajadoresConSaldo.map(t => [t.trabajador.nombre, t.saldo.diasTrabajados, (t.saldo.devengado || 0).toFixed(2), (t.saldo.pagado || 0).toFixed(2), (t.saldo.saldo || 0).toFixed(2)]);
  tablaSimple(doc, doc._y0, ['Nombre', 'Días', 'Devengado', 'Pagado', 'Saldo'], rows, [14, 75, 100, 135, 165]);
  guardarPDFConPie(doc, `trabajadores_${proyecto.nombre}.pdf`);
}
async function exportarTrabajadoresGeneralExcel(proyecto, trabajadoresConSaldo) {
  const filas = trabajadoresConSaldo.map(t => ({ Nombre: t.trabajador.nombre, Días: t.saldo.diasTrabajados, Devengado: t.saldo.devengado || 0, Pagado: t.saldo.pagado || 0, Saldo: t.saldo.saldo || 0 }));
  exportarExcel(`trabajadores_${proyecto.nombre}.xlsx`, [['Trabajadores', filas.length ? filas : [{ Nombre: '', Días: 0, Devengado: 0, Pagado: 0, Saldo: 0 }]]]);
}

// ---------- Caja chica ----------
async function exportarCajaChicaPDF(caja, saldo, proyecto, soloTipo) {
  const doc = await nuevoPDF(`Caja chica — ${caja.nombre}${soloTipo ? ' (' + (soloTipo === 'personal' ? 'Personal' : 'Proyecto') + ')' : ''}`, proyecto);
  let y = doc._y0;
  doc.setFontSize(10);
  doc.text(`Entregado: ${caja.moneda} ${Number(caja.montoEntregado || 0).toFixed(2)}`, 14, y); y += 7;
  doc.text(`Gastado (proyecto): ${caja.moneda} ${(saldo.gastoProyecto || 0).toFixed(2)}`, 14, y); y += 9;
  const movs = soloTipo ? saldo.movimientos.filter(m => m.tipo === soloTipo) : saldo.movimientos;
  tablaSimple(doc, y, ['Fecha', 'Categoría', 'Monto', 'Tipo', 'Observación'], movs.map(m => [formatFechaDisplay(m.fecha), m.categoria, Number(m.monto || 0).toFixed(2), m.tipo === 'personal' ? 'Personal' : 'Proyecto', (m.observacion || '')]), [14, 55, 95, 125, 150]);
  guardarPDFConPie(doc, `caja_chica_${caja.nombre.replace(/\s+/g, '_')}${soloTipo ? '_' + soloTipo : ''}.pdf`);
}
async function exportarCajaChicaExcel(caja, saldo, soloTipo) {
  const movs = soloTipo ? saldo.movimientos.filter(m => m.tipo === soloTipo) : saldo.movimientos;
  const filas = movs.map(m => ({ Fecha: formatFechaDisplay(m.fecha), Categoría: m.categoria, Monto: m.monto || 0, Tipo: m.tipo === 'personal' ? 'Personal' : 'Proyecto', Observación: m.observacion || '' }));
  exportarExcel(`caja_chica_${caja.nombre.replace(/\s+/g, '_')}.xlsx`, [['Movimientos', filas.length ? filas : [{ Fecha: '', Categoría: '', Monto: 0, Tipo: '', Observación: '' }]]]);
}

// ---------- Archivo ZIP de comprobantes ----------
// Estructura: Ingresos/<fecha>/..., Gastos/<fecha>/..., Trabajadores/<nombre>/<fecha>/...,
// Caja chica/<nombre de la caja>/<fecha>/...
async function rutaCarpetaAdjunto(a) {
  const ext = a.tipoArchivo === 'pdf' ? '.pdf' : (a.nombre.match(/\.\w+$/) ? '' : '.jpg');
  const archivo = `${a.id}_${a.nombre}${ext}`;

  if (a.refTabla === 'ingresos') {
    const r = await db.ingresos.get(a.refId);
    return { carpeta: `Ingresos/${r ? formatFechaDisplay(r.fecha).replace(/\//g, '-') : 'sin_fecha'}`, archivo };
  }
  if (a.refTabla === 'gastos') {
    const r = await db.gastos.get(a.refId);
    return { carpeta: `Gastos/${r ? formatFechaDisplay(r.fecha).replace(/\//g, '-') : 'sin_fecha'}`, archivo };
  }
  if (a.refTabla === 'pagosTrabajador') {
    const r = await db.pagosTrabajador.get(a.refId);
    const t = r ? await db.trabajadores.get(r.trabajadorId) : null;
    const nombre = t ? t.nombre.replace(/[\\/]/g, '-') : 'desconocido';
    return { carpeta: `Trabajadores/${nombre}/${r ? formatFechaDisplay(r.fecha).replace(/\//g, '-') : 'sin_fecha'}`, archivo };
  }
  if (a.refTabla === 'movimientosCajaChica') {
    const r = await db.movimientosCajaChica.get(a.refId);
    const c = r ? await db.cajasChicas.get(r.cajaChicaId) : null;
    const nombre = c ? c.nombre.replace(/[\\/]/g, '-') : 'desconocida';
    return { carpeta: `Caja chica/${nombre}/${r ? formatFechaDisplay(r.fecha).replace(/\//g, '-') : 'sin_fecha'}`, archivo };
  }
  return { carpeta: `Otros/${(a.fecha || '').slice(0, 10) || 'sin_fecha'}`, archivo };
}

async function exportarArchivoComprobantes(proyectoNombre) {
  const zip = new JSZip();
  const todos = await db.adjuntos.toArray();

  if (todos.length === 0) {
    alert('Todavía no hay ningún comprobante (foto/PDF) guardado en la aplicación.');
    return;
  }

  for (const a of todos) {
    const { carpeta, archivo } = await rutaCarpetaAdjunto(a);
    // Se convierte a ArrayBuffer explícitamente: JSZip a veces no reconoce
    // directamente el Blob tal como vuelve de IndexedDB.
    const bytes = await a.blob.arrayBuffer();
    zip.folder(carpeta).file(archivo, bytes);
  }

  const contenido = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(contenido);
  const el = document.createElement('a');
  el.href = url;
  el.download = `comprobantes_${proyectoNombre || 'mincontrol'}.zip`;
  el.click();
  URL.revokeObjectURL(url);
}
