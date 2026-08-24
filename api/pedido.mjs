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
 *
 *  Desde que la landing vive también en Shopify, este endpoint hace DOS
 *  cosas con cada pedido: lo escribe en la hoja (como siempre) y lo crea
 *  como pedido real en Shopify (ver _shopify.mjs). Son independientes: si
 *  una falla, la otra sigue, y el cliente llega a WhatsApp igual.
 *
 *    ORIGENES_PERMITIDOS  https://tu-tienda.myshopify.com,https://tudominio.com
 *    META_CAPI_TOKEN      token de Conversions API (Events Manager → HIDATA
 *                         CAPI → Configuración → Conversions API)
 *
 *  Y un tercer destino: el evento "Lead" a la Conversions API de Meta. Es el
 *  registro server-side que complementa al Pixel del navegador — en Shopify la
 *  página usa {% layout none %}, así que ningún tracking del tema se ejecuta, y
 *  el Pixel solo pierde eventos por bloqueadores, Safari/iOS y pestañas que se
 *  cierran antes de que dispare. El id de evento viaja desde el navegador para
 *  que Meta deduplique: un Lead, no dos.
 */

import { crearPedidoShopify } from './_shopify.mjs';
import { createHash } from 'node:crypto';

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

/* ── Conversions API de Meta ─────────────────────────────────────────
   Nada de esto toca la hoja de Sheets ni el mensaje de WhatsApp: si falla,
   solo queda un log. La venta nunca se bloquea por un evento de tracking. */

const META_PIXEL_ID = '4244873702429153';   // HIDATA CAPI — no es secreto, es
                                             // solo el identificador del dataset

function sha256Hex(texto) {
  return createHash('sha256').update(texto).digest('hex');
}

/** Perú guarda el celular como 9 dígitos locales; CAPI exige E.164 sin '+'. */
function telefonoHasheado(celular) {
  const digitos = String(celular || '').replace(/\D/g, '');
  if (!digitos) return null;
  const e164 = digitos.length === 9 ? '51' + digitos : digitos;
  return sha256Hex(e164);
}

async function enviarConversionsAPI(datos, ip) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || datos.tipo === 'suscripcion') return;

  const ph = telefonoHasheado(datos.celular);
  const userData = {};
  if (ip && ip !== 'sin-ip') userData.client_ip_address = ip;
  if (datos.ua) userData.client_user_agent = String(datos.ua).slice(0, 300);
  if (datos.fbp) userData.fbp = String(datos.fbp).slice(0, 300);
  if (datos.fbc) userData.fbc = String(datos.fbc).slice(0, 300);
  if (ph) userData.ph = [ph];

  const total = typeof datos.total === 'number' ? datos.total : Number(datos.total);

  const evento = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData
  };
  if (datos.event_id) evento.event_id = String(datos.event_id).slice(0, 100);
  if (datos.url) evento.event_source_url = String(datos.url).slice(0, 300);
  if (Number.isFinite(total) || datos.pack) {
    evento.custom_data = {
      currency: 'PEN',
      ...(Number.isFinite(total) ? { value: total } : {}),
      ...(datos.pack ? { content_name: String(datos.pack).slice(0, 100) } : {})
    };
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [evento] })
      }
    );
    if (!resp.ok) {
      const texto = await resp.text();
      console.error('Meta CAPI rechazó el evento — HTTP ' + resp.status + ' · ' + texto.slice(0, 300));
    }
  } catch (err) {
    console.error('No se pudo enviar el evento a Meta CAPI: ' + err);
  }
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

  /** La hoja de cálculo: sigue siendo el registro de siempre. */
  async function guardarEnHoja() {
    const respuesta = await fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(carga)
    });
    const texto = await respuesta.text();

    // No basta con el código HTTP: Apps Script responde 200 aunque rechace el
    // pedido (token inválido, por ejemplo) y lo dice solo en el cuerpo. Sin
    // mirar dentro, un token mal puesto se traduce en ventas que nadie registra
    // y que nadie ve fallar.
    let cuerpo = null;
    try { cuerpo = JSON.parse(texto); } catch { /* no vino JSON */ }
    const registrado = respuesta.ok && cuerpo !== null && cuerpo.ok === true;

    if (!registrado) {
      console.error('EL PEDIDO NO SE REGISTRÓ EN LA HOJA — HTTP ' + respuesta.status +
                    ' · respuesta: ' + texto.slice(0, 300));
    }
    return registrado;
  }

  // Los dos destinos van en paralelo y por separado: la hoja es el registro
  // operativo (la usas para llamar y repartir) y Shopify es el registro
  // contable (inventario, informes, píxel). Que Shopify falle no puede
  // impedir que el pedido llegue a la hoja, ni al revés.
  //
  // Las suscripciones al boletín no son pedidos: solo van a la hoja.
  const [hoja, shopify] = await Promise.allSettled([
    guardarEnHoja(),
    esSuscripcion ? Promise.resolve({ ok: false, motivo: 'no es un pedido' })
                  : crearPedidoShopify(datos),
    // Tracking, no registro: se traga sus propios errores y nunca decide el
    // resultado de la respuesta. Un Lead perdido cuesta atribución; un pedido
    // perdido cuesta la venta.
    enviarConversionsAPI(datos, ip)
  ]);

  const enHoja = hoja.status === 'fulfilled' && hoja.value === true;
  if (hoja.status === 'rejected') {
    console.error('No se pudo registrar el pedido en la hoja: ' + hoja.reason);
  }

  const enShopify = shopify.status === 'fulfilled' && shopify.value?.ok === true;
  if (!esSuscripcion) {
    if (shopify.status === 'rejected') {
      console.error('EL PEDIDO NO ENTRÓ EN SHOPIFY: ' + shopify.reason);
    } else if (!enShopify && shopify.value?.motivo !== 'shopify sin configurar') {
      console.error('EL PEDIDO NO ENTRÓ EN SHOPIFY: ' + shopify.value?.motivo);
    } else if (enShopify && shopify.value.repetido) {
      console.log('Pedido ya existente en Shopify (post-upsell): ' + shopify.value.pedido);
    }
  }

  // Pase lo que pase, el cliente sigue su camino a WhatsApp: la venta nunca
  // se rompe por un fallo de registro.
  return res.status(200).json({ ok: enHoja, hoja: enHoja, shopify: enShopify });
}
