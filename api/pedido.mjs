/**
 * ══════════════════════════════════════════════════════════════════
 *  INTERMEDIARIO landing → Google Sheets   (función de Vercel)
 * ══════════════════════════════════════════════════════════════════
 *
 *  Existe por una razón: que el secreto del receptor NO viaje en el HTML
 *  público. El navegador del cliente habla con esta función, y solo esta
 *  función conoce la URL y el token de Apps Script — que viven en las
 *  variables de entorno de Vercel, no en el repo.
 *
 *  Es el mismo modelo que usan las apps COD de Shopify: un servidor en
 *  medio que guarda las credenciales.
 *
 *  Variables de entorno (Vercel → Settings → Environment Variables):
 *    PEDIDOS_URL    https://script.google.com/macros/s/…/exec
 *    PEDIDOS_TOKEN  el mismo TOKEN de las propiedades del Apps Script
 */

const MAX_BYTES = 4000;          // un pedido real ronda los 500 bytes
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 6;       // ningún cliente hace 6 pedidos en un minuto

/**
 * Freno anti-spam. Es best-effort a propósito: en serverless cada instancia
 * tiene su propia memoria, así que esto frena el abuso trivial, no un ataque
 * distribuido. Para eso está la cuota de Apps Script como último tope.
 */
const vistos = new Map();

function demasiadas(ip) {
  const ahora = Date.now();
  const previas = (vistos.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  previas.push(ahora);
  vistos.set(ip, previas);

  if (vistos.size > 500) {       // no dejar crecer la memoria sin límite
    for (const [k, v] of vistos) {
      if (!v.length || ahora - v[v.length - 1] > VENTANA_MS) vistos.delete(k);
    }
  }
  return previas.length > MAX_POR_VENTANA;
}

/** El cuerpo llega como text/plain (lo manda sendBeacon), no como JSON. */
function leerCuerpo(req) {
  const crudo = req.body;
  if (!crudo) return null;
  if (typeof crudo === 'object') return crudo;
  if (typeof crudo !== 'string' || crudo.length > MAX_BYTES) return null;
  try { return JSON.parse(crudo); } catch { return null; }
}

/** Solo se reenvían campos conocidos: nada que llegue de fuera pasa entero. */
const CAMPOS = ['tipo', 'pedido', 'nombre', 'celular', 'departamento', 'ciudad',
                'direccion', 'referencia', 'pack', 'unidades', 'adicional',
                'total', 'adelanto', 'origen', 'campana', 'dispositivo', 'correo'];

function limpiar(datos) {
  const salida = {};
  for (const campo of CAMPOS) {
    if (datos[campo] === undefined || datos[campo] === null) continue;
    const valor = datos[campo];
    salida[campo] = typeof valor === 'number' ? valor : String(valor).slice(0, 300);
  }
  return salida;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'método no permitido' });
  }

  const destino = process.env.PEDIDOS_URL;
  if (!destino) {
    console.error('Falta PEDIDOS_URL en las variables de entorno');
    return res.status(500).json({ ok: false, error: 'receptor sin configurar' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';
  if (demasiadas(ip)) {
    return res.status(429).json({ ok: false, error: 'demasiadas peticiones' });
  }

  const datos = leerCuerpo(req);
  if (!datos) return res.status(400).json({ ok: false, error: 'cuerpo inválido' });

  const esSuscripcion = datos.tipo === 'suscripcion';
  if (!esSuscripcion && !datos.pedido) {
    return res.status(400).json({ ok: false, error: 'falta el número de pedido' });
  }

  const carga = limpiar(datos);
  carga.token = process.env.PEDIDOS_TOKEN || '';

  try {
    const respuesta = await fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(carga)
    });
    const texto = await respuesta.text();
    // Un fallo del receptor no puede parecer un fallo de la venta: se registra
    // aquí y el cliente sigue su camino a WhatsApp igual.
    if (!respuesta.ok) console.error('Apps Script ' + respuesta.status + ': ' + texto);
    return res.status(200).json({ ok: respuesta.ok });
  } catch (err) {
    console.error('No se pudo registrar el pedido: ' + err);
    return res.status(200).json({ ok: false });
  }
}
