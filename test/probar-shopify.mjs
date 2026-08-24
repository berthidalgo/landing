#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 *  Diagnóstico de la conexión con Shopify
 * ══════════════════════════════════════════════════════════════════
 *
 *  Comprueba de verdad, contra la tienda, todo lo que puede fallar EN
 *  SILENCIO cuando entra un pedido. La landing traga los errores a
 *  propósito para que la venta nunca se rompa; el precio de esa decisión
 *  es que sin este diagnóstico no te enteras de nada hasta que miras el
 *  admin y está vacío.
 *
 *      # Windows (PowerShell)
 *      $env:SHOPIFY_STORE="7hu0g1-xz.myshopify.com"
 *      $env:SHOPIFY_CLIENT_ID="…"; $env:SHOPIFY_CLIENT_SECRET="…"
 *      $env:SHOPIFY_VARIANT_ID="gid://shopify/ProductVariant/…"
 *      node landing-cuchillo/test/probar-shopify.mjs
 *
 *      # con un pedido de prueba real (queda en el admin, etiquetado)
 *      node landing-cuchillo/test/probar-shopify.mjs --pedido
 *
 *  El pedido de prueba NO se puede borrar desde la API: Shopify solo deja
 *  cancelarlo. Sale etiquetado `prueba` y `contraentrega` para que lo
 *  distingas y lo canceles a mano.
 */

const CREAR_PEDIDO = process.argv.includes('--pedido');
const VERSION = '2026-07';

const ALCANCES_NECESARIOS = ['write_orders', 'read_products'];

let fallos = 0;
const ok    = (m) => console.log(`  ✓ ${m}`);
const mal   = (m) => { console.log(`  ✗ ${m}`); fallos++; };
const nota  = (m) => console.log(`    ${m}`);
const paso  = (m) => console.log(`\n▸ ${m}`);

/* ── 1 · Variables ──────────────────────────────────────────────── */
paso('Variables de entorno');

const tienda   = process.env.SHOPIFY_STORE;
const variante = process.env.SHOPIFY_VARIANT_ID;
const idCli    = process.env.SHOPIFY_CLIENT_ID;
const secreto  = process.env.SHOPIFY_CLIENT_SECRET;
const estatico = process.env.SHOPIFY_TOKEN;

if (!tienda) mal('falta SHOPIFY_STORE');
else if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(tienda)) {
  mal(`SHOPIFY_STORE debe ser algo.myshopify.com, sin https:// ni barra final. Recibido: "${tienda}"`);
} else ok(`tienda: ${tienda}`);

if (!variante) mal('falta SHOPIFY_VARIANT_ID');
else if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variante)) {
  mal(`SHOPIFY_VARIANT_ID debe ser gid://shopify/ProductVariant/NUMERO. Recibido: "${variante}"`);
  nota('Es el número del final de …/admin/products/XXX/variants/NUMERO');
} else ok(`variante: ${variante}`);

if (estatico) ok('autenticación: token estático (app legacy anterior a 2026)');
else if (idCli && secreto) ok('autenticación: client_credentials (app del Dev Dashboard)');
else mal('faltan SHOPIFY_CLIENT_ID y SHOPIFY_CLIENT_SECRET (o SHOPIFY_TOKEN)');

if (fallos) {
  console.log(`\n✗ ${fallos} problema(s) de configuración. No se llamó a Shopify.`);
  process.exit(1);
}

// Todo lo que hace red va dentro de main(): salir con process.exit() mientras
// undici tiene conexiones abiertas revienta libuv en Windows
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). Con
// process.exitCode y un return, Node cierra los sockets antes de terminar.
async function main() {

/* ── 2 · Token ──────────────────────────────────────────────────── */
paso('Canje de credenciales por token');

let token = estatico;
let alcancesConcedidos = null;

if (!token) {
  let r, crudo = '';
  try {
    r = await fetch(`https://${tienda}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials', client_id: idCli, client_secret: secreto
      })
    });
    crudo = await r.text();
  } catch (e) {
    mal(`no se pudo contactar con ${tienda}: ${String(e).slice(0, 150)}`);
    process.exitCode = 1;
    return;
  }

  // El cuerpo se lee como texto y luego se intenta parsear: cuando Shopify
  // rechaza las credenciales NO siempre devuelve JSON, y perder ese texto
  // deja el diagnóstico ciego justo en el fallo más probable.
  let j = null;
  try { j = JSON.parse(crudo); } catch { /* no vino JSON */ }

  if (!j?.access_token) {
    // Cuando falla el OAuth, Shopify devuelve una página HTML entera. El dato
    // útil está en el <title> ("400 - Oauth error application_cannot_be_found");
    // volcar el cuerpo crudo solo enseña CSS y esconde el motivo.
    const titulo = /<title>([^<]+)<\/title>/i.exec(crudo)?.[1]?.trim();
    mal(`no se obtuvo token (HTTP ${r.status})`);
    nota(`Shopify dice: ${titulo || (crudo || '(respuesta vacía)').slice(0, 200)}`);
    if (/application_cannot_be_found/i.test(crudo)) {
      nota('→ ese Client ID no existe para esta tienda: o está mal copiado,');
      nota('  o la app no está instalada, o es de otra organización.');
    }
    nota('Causas habituales:');
    nota('  · la app no está INSTALADA en la tienda (Dev Dashboard → Tiendas)');
    nota('  · la app y la tienda están en organizaciones distintas');
    nota('    ("client credentials only works when the app and the store');
    nota('     belong to the same Shopify organization")');
    nota('  · "Usar flujo de instalación heredado" quedó MARCADO');
    nota('  · Client ID o Client Secret mal copiados');
    process.exitCode = 1;
    return;
  }

  ok(`token obtenido, caduca en ${Math.round((j.expires_in || 0) / 3600)} h`);
  token = j.access_token;
  alcancesConcedidos = String(j.scope || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/* ── 3 · Alcances ───────────────────────────────────────────────── */
if (alcancesConcedidos) {
  paso('Alcances concedidos');
  ok(alcancesConcedidos.join(', ') || '(ninguno)');
  for (const nec of ALCANCES_NECESARIOS) {
    // write_X implica read_X en Shopify, así que read_products se da por
    // cubierto si concedieron write_products.
    const equivalente = nec.startsWith('read_') ? 'write_' + nec.slice(5) : null;
    if (alcancesConcedidos.includes(nec) ||
        (equivalente && alcancesConcedidos.includes(equivalente))) {
      ok(`${nec} presente`);
    } else {
      mal(`FALTA ${nec} — añádelo en Alcances y vuelve a Publicar`);
    }
  }
}

/* ── 4 · La variante existe ─────────────────────────────────────── */
paso('El producto');

async function graphql(query, variables) {
  const r = await fetch(`https://${tienda}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables })
  });
  const j = await r.json().catch(() => null);
  return { http: r.status, cuerpo: j };
}

const { http, cuerpo } = await graphql(`
  query($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id title price inventoryQuantity inventoryPolicy
        product { title status }
      }
    }
  }`, { id: variante });

if (http === 401 || http === 403) {
  mal(`Shopify rechazó el token (HTTP ${http}) — revisa alcances e instalación`);
} else if (cuerpo?.errors?.length) {
  mal(cuerpo.errors.map((e) => e.message).join('; ').slice(0, 200));
} else if (!cuerpo?.data?.node) {
  mal('esa variante no existe en esta tienda');
  nota('¿Copiaste el ID del PRODUCTO en vez del de la VARIANTE?');
  nota('La URL correcta acaba en …/variants/NUMERO, no en …/products/NUMERO');
} else {
  const v = cuerpo.data.node;
  ok(`producto: ${v.product.title}`);
  ok(`variante: ${v.title} · S/ ${v.price}`);
  if (v.product.status !== 'ACTIVE') {
    mal(`el producto está en estado ${v.product.status}, no ACTIVE`);
  }
  if (v.inventoryQuantity <= 0 && v.inventoryPolicy === 'DENY') {
    mal(`stock ${v.inventoryQuantity} y política DENY: orderCreate fallará por falta de inventario`);
    nota('Sube el stock, o marca "Seguir vendiendo cuando esté agotado"');
  } else {
    ok(`stock: ${v.inventoryQuantity} · política: ${v.inventoryPolicy}`);
  }
}

/* ── 5 · Pedido de prueba (opcional) ────────────────────────────── */
if (CREAR_PEDIDO && !fallos) {
  paso('Pedido de prueba');
  const { crearPedidoShopify } = await import('../api/_shopify.mjs');
  const r = await crearPedidoShopify({
    pedido: `PRUEBA-${Date.now().toString().slice(-6)}`,
    nombre: 'Prueba Diagnóstico', celular: '987654321',
    departamento: 'Lima', ciudad: 'Los Olivos',
    direccion: 'Av. de Prueba 123', referencia: 'NO ENVIAR — pedido de diagnóstico',
    pack: '2 unidades', unidades: 2, total: 89, adelanto: 0,
    origen: 'diagnostico', campana: 'prueba'
  });
  if (r.ok) {
    ok(`creado: ${r.pedido}`);
    nota('Está en tu admin con las etiquetas "landing" y "contraentrega".');
    nota('CANCÉLALO a mano: la API no permite borrar pedidos, solo cancelarlos.');
  } else {
    mal(`no se creó: ${r.motivo}`);
    if (/inventory|inventario/i.test(r.motivo || '')) {
      nota('Si el pedido entra pero el stock no baja, añade write_inventory.');
    }
  }
}

/* ── Resumen ────────────────────────────────────────────────────── */
console.log();
if (fallos) {
  console.log(`✗ ${fallos} problema(s). Los pedidos NO entrarían en Shopify.`);
  process.exitCode = 1;
  return;
}
console.log('OK — Shopify conectado y listo para recibir pedidos');
if (!CREAR_PEDIDO) console.log('   (repite con --pedido para crear uno real de prueba)');

}

await main();
