// ==========================================================
// MinControl — Licencia offline con Ed25519
// ==========================================================
//
// La app contiene SOLAMENTE la CLAVE PÚBLICA.
// La CLAVE PRIVADA nunca debe estar aquí.
//
// Formato de licencia:
//
// DEVICE_ID-EXPIRY-SIGNATURE
//
// Ejemplo:
//
// D3F8K2-A1B2-2027-02-03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//
// expiry:
//   PERM
//   YYYY-MM-DD
//
// ==========================================================


// ==========================================================
// CONFIGURACIÓN
// ==========================================================

// Pegue aquí la CLAVE PÚBLICA Ed25519 generada por
// generador-licencias.html.
//
// Será una cadena Base64URL de 32 bytes.
//
// EJEMPLO:
// const MINCONTROL_PUBLIC_KEY_B64U = 'abc123...';
//
const MINCONTROL_PUBLIC_KEY_B64U =
  'YXEGeCX1TF22oNVIBxvr0yUgJ3gXATknsE9Qmxdi0zg';


// ==========================================================
// BASE64URL → BYTES
// ==========================================================

function base64UrlToBytes(base64url) {

  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(
      Math.ceil(base64url.length / 4) * 4,
      '='
    );

  const binary = atob(base64);

  return Uint8Array.from(
    binary,
    c => c.charCodeAt(0)
  );
}


// ==========================================================
// IMPORTAR CLAVE PÚBLICA
// ==========================================================

async function importarClavePublica() {

  if (
    !MINCONTROL_PUBLIC_KEY_B64U ||
    MINCONTROL_PUBLIC_KEY_B64U ===
      'REEMPLAZAR_CON_SU_CLAVE_PUBLICA'
  ) {
    throw new Error(
      'La clave pública Ed25519 no está configurada.'
    );
  }

  const rawPublicKey =
    base64UrlToBytes(
      MINCONTROL_PUBLIC_KEY_B64U
    );

  if (rawPublicKey.length !== 32) {
    throw new Error(
      'La clave pública Ed25519 debe tener 32 bytes.'
    );
  }

  return crypto.subtle.importKey(
    'raw',
    rawPublicKey,
    {
      name: 'Ed25519'
    },
    false,
    ['verify']
  );
}


// ==========================================================
// FECHA LOCAL
// ==========================================================
//
// No usamos toISOString() para evitar problemas cerca
// de medianoche por diferencias UTC / hora local.
// ==========================================================

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


// ==========================================================
// VALIDAR LICENCIA
// ==========================================================

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

    const key =
      licenseKey.trim();

    // ------------------------------------------------------
    // La firma está después del último "-"
    // ------------------------------------------------------

    const ultimoGuion =
      key.lastIndexOf('-');

    if (ultimoGuion <= 0) {

      return {
        valida: false,
        motivo: 'formato inválido'
      };
    }

    const firmaB64u =
      key.slice(
        ultimoGuion + 1
      );

    const contenido =
      key.slice(
        0,
        ultimoGuion
      );

    // ------------------------------------------------------
    // Extraemos expiry desde el final.
    //
    // Permitimos:
    //
    // PERM
    // YYYY-MM-DD
    // ------------------------------------------------------

    const match =
      contenido.match(
        /^(.*)-(\d{4}-\d{2}-\d{2}|PERM)$/
      );

    if (!match) {

      return {
        valida: false,
        motivo: 'formato de licencia inválido'
      };
    }

    const deviceIdEnLicencia =
      match[1].toUpperCase();

    const expiry =
      match[2].toUpperCase();

    // ------------------------------------------------------
    // Verificar dispositivo
    // ------------------------------------------------------

    if (
      deviceIdEnLicencia !==
      deviceId.trim().toUpperCase()
    ) {

      return {
        valida: false,
        motivo:
          'no corresponde a este dispositivo'
      };
    }

    // ------------------------------------------------------
    // Convertir firma
    // ------------------------------------------------------

    const firma =
      base64UrlToBytes(
        firmaB64u
      );

    if (firma.length !== 64) {

      return {
        valida: false,
        motivo: 'firma inválida'
      };
    }

    // ------------------------------------------------------
    // EXACTAMENTE el mismo texto que firma el generador
    // ------------------------------------------------------

    const mensaje =
      `${deviceIdEnLicencia}|${expiry}`;

    const datos =
      new TextEncoder().encode(
        mensaje
      );

    // ------------------------------------------------------
    // Obtener clave pública
    // ------------------------------------------------------

    const publicKey =
      await importarClavePublica();

    // ------------------------------------------------------
    // Verificar firma Ed25519
    // ------------------------------------------------------

    const firmaCorrecta =
      await crypto.subtle.verify(
        {
          name: 'Ed25519'
        },
        publicKey,
        firma,
        datos
      );

    if (!firmaCorrecta) {

      return {
        valida: false,
        motivo:
          'firma de licencia inválida'
      };
    }

    // ------------------------------------------------------
    // LICENCIA PERMANENTE
    // ------------------------------------------------------

    if (expiry === 'PERM') {

      return {
        valida: true,
        expiry: 'PERM'
      };
    }

    // ------------------------------------------------------
    // VALIDAR FECHA
    // ------------------------------------------------------

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        expiry
      )
    ) {

      return {
        valida: false,
        motivo:
          'fecha de vencimiento inválida'
      };
    }

    const hoy =
      fechaLocalISO();

    // ------------------------------------------------------
    // La fecha de vencimiento ES INCLUSIVA.
    //
    // Si expiry = 2027-02-03:
    //
    // 2027-02-02 → funciona
    // 2027-02-03 → funciona
    // 2027-02-04 → vencida
    // ------------------------------------------------------

    if (hoy > expiry) {

      return {
        valida: false,
        motivo: 'licencia vencida',
        expiry
      };
    }

    return {
      valida: true,
      expiry
    };

  } catch (error) {

    console.error(
      'Error al validar licencia:',
      error
    );

    return {
      valida: false,
      motivo:
        'no se pudo validar la licencia'
    };
  }
}


// ==========================================================
// FUNCIÓN EXISTENTE DE MINCONTROL
// ==========================================================

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