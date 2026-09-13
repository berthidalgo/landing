/**
 * ══════════════════════════════════════════════════════════════════
 *  INTERMEDIARIO landing → Google Apps Script   (función de Vercel)
 * ══════════════════════════════════════════════════════════════════
 *
 *  Existe por una razón: que el secreto del receptor NO viaje en el HTML
 *  público. El navegador del cliente habla con esta función, y solo esta
 *  función conoce la URL y el token de Apps Script — que viven en las
 *  variables de entorno de Vercel, no en el repo.
 *
 *  Variables de entorno (Vercel → Settings → Environment Variables):
 *    PEDIDOS_URL          https://script.google.com/macros/s/…/exec
 *    PEDIDOS_TOKEN        el mismo TOKEN de las propiedades del Apps Script
 *    ORIGENES_PERMITIDOS  https://tu-tienda.myshopify.com,https://tudominio.com
 *
 *  ── Por qué esta función YA NO llama a Shopify ni a Meta por su cuenta ──
 *  Hasta el 13-sep-2026 creaba el pedido en Shopify (_shopify.mjs) y mandaba
 *  el Lead a Meta EN PARALELO con Apps Script (Código.js), que hace
 *  exactamente lo mismo — además de guardar la hoja. Las dos rutas no se
 *  avisaban entre sí: cada una comprobaba "¿ya existe este pedido?" antes
 *  de crearlo, pero como las dos llamadas salían al mismo tiempo, ambas
 *  podían ver "no existe" antes de que la otra terminara → pedido
 *  duplicado en el admin de Shopify, en cada venta. Apps Script además
 *  recalcula el precio en servidor (Precios.js) — la llamada directa que
 *  hacía esta función confiaba en el `total` del navegador y nunca tuvo
 *  esa protección.
 *
 *  Ahora Apps Script (backend/apps-script/activo/: Código.js, Shopify.js,
 *  Meta.js, Precios.js, Escudo.js) es el ÚNICO lugar que decide si el
 *  pedido entra a Shopify y qué se manda a Meta. Esta función solo limpia
 *  los datos, frena el spam y reenvía — el `shopify`/`meta` que devuelve
 *  son los que Apps Script reportó en su propia respuesta, no un intento
 *  propio. `_shopify.mjs` se conserva sin usar en este camino en vivo:
 *  sigue sirviendo como diagnóstico manual vía test/probar-shopify.mjs.
 */

/**
 * La landing ya no está en el mismo dominio que esta función: vive en el
 * tema de Shopify y llama aquí desde otro origen.
 *
 * sendBeacon manda text/plain, que cuenta como "petición simple" y llega al
 * servidor aunque no haya CORS —solo se bloquea la respuesta—. Pero sin
 * estas cabeceras el navegador escupe un error de CORS en consola por cada
 * venta, y nadie puede distinguir "registrado" de "perdido". Con ellas, el
 * `{ok:true}` vuelve a ser legible.
 */
function permitirOrigen(req, res) {
  const permitidos = (process.env.ORIGENES_PERMITIDOS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const origen = req.headers.origin;
  if (origen && permitidos.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const MAX_BYTES = 4000;          // un pedido real ronda los 500 bytes
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 6;       // ningún cliente hace 6 pedidos en un minuto

/**
 * Freno anti-spam. Es best-effort a propósito: en serverless cada instancia
 * tiene su propia memoria, así que esto frena el abuso trivial, no un ataque
 * distribuido. Para eso está el escudo de Apps Script (Escudo.js) como
 * segundo tope, ahora con la IP real (ver más abajo), no solo el celular.
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

/**
 * Solo se reenvían campos conocidos: nada que llegue de fuera pasa entero.
 * event_id/fbp/fbc/ua/url viajan también: son los que Apps Script necesita
 * para que su Lead/Purchase deduplique con el píxel del navegador y tenga
 * buena calidad de coincidencia — antes se quedaban aquí y el Lead que
 * mandaba Apps Script viajaba "a ciegas", sin poder deduplicarse con nada.
 */
const CAMPOS = ['tipo', 'pedido', 'nombre', 'celular', 'departamento', 'ciudad',
                'direccion', 'referencia', 'pack', 'unidades', 'adicional',
                'total', 'adelanto', 'origen', 'campana', 'dispositivo', 'correo',
                'event_id', 'fbp', 'fbc', 'ua', 'url'];

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
  permitirOrigen(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
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
  // La IP real de Vercel (x-forwarded-for) es lo único estable para frenar
  // abuso: el celular lo inventa quien manda la petición, la IP la pone la
  // red. Sin esto, el escudo de Apps Script (Escudo.js) solo podía contar
  // por celular — con tráfico pagado real entrando, esto es lo que hace que
  // su freno por IP sirva de algo.
  if (ip !== 'sin-ip') carga.ip = ip;

  let cuerpoRespuesta = null;
  let registrado = false;
  try {
    const respuesta = await fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(carga)
    });
    const texto = await respuesta.text();

    // No basta con el código HTTP: Apps Script responde 200 aunque rechace el
    // pedido (token inválido, por ejemplo) y lo dice solo en el cuerpo. Sin
    // mirar dentro, un token mal puesto se traduce en ventas que nadie
    // registra y que nadie ve fallar.
    try { cuerpoRespuesta = JSON.parse(texto); } catch { /* no vino JSON */ }
    registrado = respuesta.ok && cuerpoRespuesta !== null && cuerpoRespuesta.ok === true;

    if (!registrado) {
      console.error('EL PEDIDO NO SE REGISTRÓ — HTTP ' + respuesta.status +
                    ' · respuesta: ' + texto.slice(0, 300));
    }
  } catch (err) {
    console.error('No se pudo contactar a Apps Script: ' + String(err).slice(0, 200));
  }

  // shopify/meta ya no son intentos propios de esta función: son lo que
  // Apps Script reportó en su respuesta (ver Código.js → doPost → el
  // objeto que arma al final, con shop.ok y meta.ok).
  if (!esSuscripcion && cuerpoRespuesta && cuerpoRespuesta.shopify === false) {
    console.error('EL PEDIDO NO ENTRÓ EN SHOPIFY (reportado por Apps Script)');
  }

  // Pase lo que pase, el cliente sigue su camino a WhatsApp: la venta nunca
  // se rompe por un fallo de registro.
  return res.status(200).json({
    ok: registrado,
    hoja: registrado,
    shopify: cuerpoRespuesta?.shopify === true,
    meta: cuerpoRespuesta?.meta === true
  });
}
