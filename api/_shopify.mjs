/**
 * ══════════════════════════════════════════════════════════════════
 *  Crea el pedido REAL en Shopify        (Admin API · orderCreate)
 * ══════════════════════════════════════════════════════════════════
 *
 *  Esto es, literalmente, lo que hace Releasit COD por dentro: recibe el
 *  formulario y llama a la Admin API. No hay más magia. Como nuestro
 *  formulario ya pasa por /api/pedido —que existe para guardar secretos
 *  fuera del HTML— este es el sitio natural para hacer la llamada.
 *
 *  Sin esto, Shopify no se entera de nada: 0 pedidos, 0 ingresos, 0
 *  inventario, y los informes marcan S/ 0 para siempre.
 *
 *  ── Cómo obtener las credenciales ────────────────────────────────
 *  Desde el 1 de enero de 2026 ya NO se pueden crear custom apps desde el
 *  admin de la tienda ("You can no longer create new custom apps in the
 *  Shopify admin"). Las de antes siguen funcionando y enseñando su token
 *  shpat_; las nuevas van por el Dev Dashboard y NO enseñan token: dan un
 *  Client ID y un Client Secret que se canjean por un token de 24 h
 *  mediante client_credentials.
 *
 *  Dev Dashboard → Apps → Crear una app → Alcances: write_orders,
 *  read_products → Tiendas: instalar en la tienda → copiar Client ID y
 *  Client Secret.
 *
 *  ── Variables de entorno (Vercel → Settings → Environment Variables)
 *    SHOPIFY_STORE          tu-tienda.myshopify.com
 *    SHOPIFY_VARIANT_ID     gid://shopify/ProductVariant/1234567890
 *
 *    …y UNA de estas dos vías de autenticación:
 *
 *    a) App del Dev Dashboard (lo normal a partir de 2026)
 *       SHOPIFY_CLIENT_ID       ← secreto
 *       SHOPIFY_CLIENT_SECRET   ← secreto
 *
 *    b) App legacy creada en el admin antes de 2026
 *       SHOPIFY_TOKEN           shpat_…             ← secreto
 */

// Shopify publica una versión por trimestre y cada una vive 12 meses.
// 2026-07 es la estable vigente. Al subirla, revisa el registro de cambios
// de orderCreate: es una mutación relativamente reciente.
const VERSION = '2026-07';

const MUTACION = `
  mutation crearPedido($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order {
        id
        name
        totalPriceSet { shopMoney { amount currencyCode } }
      }
      userErrors { field message }
    }
  }`;

const BUSQUEDA = `
  query buscarPedido($filtro: String!) {
    orders(first: 1, query: $filtro) { nodes { id name } }
  }`;

/**
 * Caché del token, por instancia de la función.
 *
 * En serverless cada instancia tiene su propia memoria —igual que el freno
 * anti-spam de pedido.mjs—, así que esto no es un caché compartido: en el
 * peor caso se pide un token por arranque en frío. Con un token que dura
 * 24 h, eso son unas pocas peticiones al día, no una por pedido.
 */
let cacheToken = { valor: null, expira: 0 };

/**
 * Token de la Admin API.
 *
 * Dos vías porque hay dos generaciones de apps conviviendo:
 *   · SHOPIFY_TOKEN        → app legacy del admin (shpat_), no caduca
 *   · CLIENT_ID + SECRET   → app del Dev Dashboard, token de 24 h
 */
async function obtenerToken(tienda) {
  const estatico = process.env.SHOPIFY_TOKEN;
  if (estatico) return estatico;

  const id      = process.env.SHOPIFY_CLIENT_ID;
  const secreto = process.env.SHOPIFY_CLIENT_SECRET;
  if (!id || !secreto) return null;

  // Margen de 5 minutos: un token que caduca a mitad de la petición
  // devolvería un 401 y perdería el pedido en Shopify.
  if (cacheToken.valor && Date.now() < cacheToken.expira) return cacheToken.valor;

  const r = await fetch(`https://${tienda}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secreto
    })
  });
  const j = await r.json().catch(() => null);
  if (!j?.access_token) return null;

  cacheToken = {
    valor: j.access_token,
    expira: Date.now() + Math.max(60, (j.expires_in || 86399) - 300) * 1000
  };
  return cacheToken.valor;
}

/**
 * ¿Ya existe este pedido en Shopify?
 *
 * La landing llama a /api/pedido DOS veces con el mismo número: una al
 * enviar el formulario (index.html:1558, "guardado AQUÍ, antes del upsell")
 * y otra si el cliente acepta el post-upsell (index.html:1596). El Apps
 * Script lo resuelve con buscarFila() y actualiza la hoja; sin este
 * equivalente, Shopify se quedaría con dos pedidos idénticos y el
 * inventario bajaría el doble.
 *
 * Hoy UPSELL y POST_UPSELL están en activo:false, así que la segunda
 * llamada no ocurre — pero el día que los enciendas, esto ya está puesto.
 */
async function yaExiste(tienda, token, numero) {
  if (!numero) return null;
  try {
    const r = await fetch(`https://${tienda}/admin/api/${VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query: BUSQUEDA, variables: { filtro: `tag:'pedido-${numero}'` } })
    });
    const c = await r.json().catch(() => null);
    return c?.data?.orders?.nodes?.[0] || null;
  } catch {
    // Si la búsqueda falla no se bloquea la creación: es peor perder un
    // pedido que arriesgarse a un duplicado, que además se ve en el admin.
    return null;
  }
}

/** Perú: 9 dígitos. Shopify quiere formato internacional o rechaza el pedido. */
function telefono(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(-9);
  return d.length === 9 ? `+51${d}` : null;
}

/** Shopify separa nombre y apellido; el formulario pide un campo único. */
function partirNombre(completo) {
  const partes = String(completo || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return { firstName: 'Cliente', lastName: '' };
  return { firstName: partes[0], lastName: partes.slice(1).join(' ') };
}

/**
 * @returns {Promise<{ok:boolean, motivo?:string, pedido?:string}>}
 *   Nunca lanza. Si algo falla, el pedido ya está en la hoja y el cliente
 *   ya va camino de WhatsApp: la venta no se rompe por esto.
 */
export async function crearPedidoShopify(datos) {
  const tienda   = process.env.SHOPIFY_STORE;
  const variante = process.env.SHOPIFY_VARIANT_ID;

  // Ausencia de configuración no es un error: permite desplegar la rama de
  // Shopify apagada y encenderla cuando el producto exista en el catálogo.
  if (!tienda || !variante) {
    return { ok: false, motivo: 'shopify sin configurar' };
  }

  let token;
  try {
    token = await obtenerToken(tienda);
  } catch (err) {
    return { ok: false, motivo: 'no se pudo pedir el token: ' + String(err).slice(0, 150) };
  }
  if (!token) {
    return { ok: false, motivo: 'shopify sin configurar' };
  }

  const repetido = await yaExiste(tienda, token, datos.pedido);
  if (repetido) {
    return { ok: true, pedido: repetido.name, id: repetido.id, repetido: true };
  }

  const unidades = Math.max(1, parseInt(datos.unidades, 10) || 1);
  const total    = Number(datos.total) || 0;

  // El precio del pack NO es el precio unitario del catálogo: 2 unidades
  // cuestan S/99, no S/158. Se fija el precio de línea para que el importe
  // del admin cuadre con lo que el cliente va a pagar en la puerta. Si no,
  // los informes de Shopify mienten y el repartidor cobra otra cosa.
  const unitario = total > 0 ? (total / unidades).toFixed(2) : null;

  const { firstName, lastName } = partirNombre(datos.nombre);
  const tel = telefono(datos.celular);

  const direccion = {
    firstName,
    lastName,
    address1: String(datos.direccion || '').slice(0, 255),
    // La referencia es lo que evita entregas fallidas en Perú: va en la
    // dirección, no enterrada en una nota que el repartidor no abre.
    address2: String(datos.referencia || '').slice(0, 255),
    city:     String(datos.ciudad || '').slice(0, 100),
    province: String(datos.departamento || '').slice(0, 100),
    countryCode: 'PE'
  };
  if (tel) direccion.phone = tel;

  const order = {
    lineItems: [{
      variantId: variante,
      quantity: unidades,
      ...(unitario && { priceSet: { shopMoney: { amount: unitario, currencyCode: 'PEN' } } })
    }],
    // PENDING = pedido sin cobrar. Es la verdad en contraentrega: el dinero
    // no existe hasta que el repartidor lo trae. Marcarlo como pagado
    // inflaría los ingresos con ventas que aún pueden rechazarse en la puerta.
    financialStatus: 'PENDING',
    shippingAddress: direccion,
    billingAddress:  direccion,
    ...(tel && { phone: tel }),
    ...(datos.correo && { email: String(datos.correo).slice(0, 200) }),
    // `pedido-N` no es decorativo: es la clave que lee yaExiste() para no
    // duplicar el pedido en la segunda llamada del post-upsell.
    tags: ['contraentrega', 'landing', `pedido-${datos.pedido}`,
           datos.campana || 'sin-campana'].filter(Boolean),
    note: [
      `Pedido #${datos.pedido} (numeración de la landing)`,
      datos.pack ? `Pack: ${datos.pack}` : '',
      datos.adelanto ? `Adelanto de envío: S/ ${datos.adelanto}` : 'Contraentrega puro',
      datos.referencia ? `Referencia: ${datos.referencia}` : '',
      datos.origen ? `Origen: ${datos.origen}` : ''
    ].filter(Boolean).join('\n'),
    // Sobreviven a la edición del pedido y se pueden filtrar en el admin.
    customAttributes: [
      { key: 'pedido_landing', value: String(datos.pedido || '') },
      { key: 'origen',         value: String(datos.origen || '') },
      { key: 'campana',        value: String(datos.campana || '') }
    ]
  };

  const options = {
    // Por defecto es BYPASS: el pedido entra pero el stock NO baja, y te
    // quedas vendiendo lo que ya no tienes. OBEYING_POLICY respeta el ajuste
    // de "seguir vendiendo sin stock" de cada producto.
    inventoryBehaviour: 'DECREMENT_OBEYING_POLICY',
    // El correo de confirmación lo manda WhatsApp, no Shopify. Y la mayoría
    // de estos clientes ni siquiera deja correo.
    sendReceipt: false,
    sendFulfillmentReceipt: false
  };

  try {
    const respuesta = await fetch(`https://${tienda}/admin/api/${VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({ query: MUTACION, variables: { order, options } })
    });

    const cuerpo = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      return { ok: false, motivo: `HTTP ${respuesta.status}` };
    }
    // GraphQL responde 200 aunque la consulta falle: el error viene dentro.
    // Es la misma trampa que ya cubre pedido.mjs con Apps Script.
    if (cuerpo?.errors?.length) {
      return { ok: false, motivo: cuerpo.errors.map((e) => e.message).join('; ').slice(0, 300) };
    }
    const errores = cuerpo?.data?.orderCreate?.userErrors || [];
    if (errores.length) {
      return {
        ok: false,
        motivo: errores.map((e) => `${(e.field || []).join('.')}: ${e.message}`).join('; ').slice(0, 300)
      };
    }

    const creado = cuerpo?.data?.orderCreate?.order;
    if (!creado) return { ok: false, motivo: 'respuesta sin pedido' };

    return { ok: true, pedido: creado.name, id: creado.id };
  } catch (err) {
    return { ok: false, motivo: String(err).slice(0, 200) };
  }
}
