/* =========================================================
   MINCONTROL — LICENCIA SIMPLE OFFLINE
   =========================================================

   Formato:

   MC-DEVICE-ID-PERM-XXXXXXXXXXXXXXXXXXXXXXXX

   o

   MC-DEVICE-ID-YYYY-MM-DD-XXXXXXXXXXXXXXXXXXXXXXXX

   Ejemplos:

   MC-DLO2BLDHEP1-PERM-A8F2K9L4M7Q1X6C3V5N0R8TZ

   MC-DLO2BLDHEP1-2027-02-03-X7K9P2M8Q4L1Z6N3R5T0W8AB

   Sistema simple de activación offline.
   No utiliza firma digital ni criptografía.
========================================================= */


/* =========================================================
   FECHA LOCAL EN FORMATO YYYY-MM-DD
========================================================= */

function fechaLocalISO() {

  const ahora = new Date();

  return (
    ahora.getFullYear() +
    '-' +
    String(ahora.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(ahora.getDate()).padStart(2, '0')
  );

}


/* =========================================================
   VALIDAR FECHA
========================================================= */

function fechaISOValida(fecha) {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const partes = fecha.split('-').map(Number);

  const año = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  const d = new Date(
    año,
    mes - 1,
    dia
  );

  return (
    d.getFullYear() === año &&
    d.getMonth() === mes - 1 &&
    d.getDate() === dia
  );

}


/* =========================================================
   VALIDAR CÓDIGO FINAL DE 24 CARACTERES
========================================================= */

function codigo24Valido(codigo) {

  return /^[A-Z0-9]{24}$/.test(codigo);

}


/* =========================================================
   COMPATIBILIDAD DEL NAVEGADOR
========================================================= */

async function navegadorEsCompatible() {

  return true;

}


/* =========================================================
   VALIDAR LICENCIA
========================================================= */

async function validarLicencia(
  licenseKey,
  deviceId
) {

  if (!licenseKey || !deviceId) {

    return {
      valida: false,
      motivo: 'licencia o dispositivo faltante'
    };

  }

  try {

    const licencia =
      licenseKey
        .trim()
        .toUpperCase();

    const dispositivo =
      deviceId
        .trim()
        .toUpperCase();


    /* =====================================================
       PREFIJO
    ===================================================== */

    if (!licencia.startsWith('MC-')) {

      return {
        valida: false,
        motivo: 'formato inválido'
      };

    }


    /* =====================================================
       SEPARAR LICENCIA
    ===================================================== */

    const partes =
      licencia.split('-');


    /*
       Permanente:

       MC-DEVICE-PERM-CODIGO24

       = 4 partes


       Con fecha:

       MC-DEVICE-YYYY-MM-DD-CODIGO24

       = 6 partes
    */


    /* =====================================================
       COMPROBAR FORMATO GENERAL
    ===================================================== */

    if (
      partes.length !== 4 &&
      partes.length !== 6
    ) {

      return {
        valida: false,
        motivo: 'formato de licencia inválido'
      };

    }


    /* =====================================================
       DEVICE ID
    ===================================================== */

    const deviceIdLicencia =
      partes[1];


    if (!deviceIdLicencia) {

      return {
        valida: false,
        motivo: 'formato de licencia inválido'
      };

    }


    /* =====================================================
       COMPROBAR DEVICE ID
    ===================================================== */

    if (
      deviceIdLicencia !== dispositivo
    ) {

      return {
        valida: false,
        motivo: 'no corresponde a este dispositivo'
      };

    }


    /* =====================================================
       LICENCIA PERMANENTE
       
       MC-DEVICE-PERM-CODIGO24
    ===================================================== */

    if (partes.length === 4) {

      const tipo =
        partes[2];

      const codigo24 =
        partes[3];


      if (tipo !== 'PERM') {

        return {
          valida: false,
          motivo: 'formato de licencia inválido'
        };

      }


      if (
        !codigo24Valido(codigo24)
      ) {

        return {
          valida: false,
          motivo: 'código de licencia inválido'
        };

      }


      return {

        valida: true,

        expiry: 'PERM',

        codigo24: codigo24

      };

    }


    /* =====================================================
       LICENCIA CON FECHA
       
       MC-DEVICE-YYYY-MM-DD-CODIGO24
    ===================================================== */

    const año =
      partes[2];

    const mes =
      partes[3];

    const dia =
      partes[4];

    const codigo24 =
      partes[5];


    /* =====================================================
       CONSTRUIR FECHA
    ===================================================== */

    const expiry =
      año +
      '-' +
      mes +
      '-' +
      dia;


    /* =====================================================
       VALIDAR FECHA
    ===================================================== */

    if (
      !fechaISOValida(expiry)
    ) {

      return {
        valida: false,
        motivo: 'fecha de vencimiento inválida'
      };

    }


    /* =====================================================
       VALIDAR CÓDIGO DE 24 CARACTERES
    ===================================================== */

    if (
      !codigo24Valido(codigo24)
    ) {

      return {
        valida: false,
        motivo: 'código de licencia inválido'
      };

    }


    /* =====================================================
       COMPROBAR VENCIMIENTO
    ===================================================== */

    const hoy =
      fechaLocalISO();


    if (hoy > expiry) {

      return {

        valida: false,

        motivo: 'licencia vencida',

        expiry: expiry,

        codigo24: codigo24

      };

    }


    /* =====================================================
       LICENCIA VÁLIDA
    ===================================================== */

    return {

      valida: true,

      expiry: expiry,

      codigo24: codigo24

    };


  } catch (error) {

    console.error(
      'Error al validar licencia:',
      error
    );

    return {

      valida: false,

      motivo: 'no se pudo validar la licencia'

    };

  }

}


/* =========================================================
   CALCULAR DÍAS DESDE LA INSTALACIÓN
========================================================= */

function diasDesde(fechaISO) {

  const inicio =
    new Date(
      fechaISO + 'T00:00:00'
    );

  const ahora =
    new Date();

  const hoy =
    new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate()
    );

  return Math.floor(
    (hoy - inicio) /
    86400000
  );

}