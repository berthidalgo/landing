#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════════
 *  index.html  →  tema de Shopify        (superposición, no reemplazo)
 * ══════════════════════════════════════════════════════════════════════
 *
 *  Genera en shopify/ SOLO los archivos que hay que añadir al tema que ya
 *  tiene la tienda. No toca theme.liquid, ni el header, ni el footer: la
 *  plantilla usa {% layout none %} y se dibuja sola, igual que en Vercel.
 *
 *      node landing-cuchillo/build-shopify.mjs
 *      node landing-cuchillo/build-shopify.mjs --verificar   # no escribe
 *
 *  Reglas de reescritura (33 rutas relativas en total):
 *
 *    fonts/Poppins-400.woff2  →  {{ 'Poppins-400.woff2' | asset_url }}
 *    img/hero.webp            →  {{ 'hero.webp'         | asset_url }}
 *    img/demo.mp4             →  https://<MEDIA>/img/demo.mp4      (Vercel)
 *    '/api/pedido'            →  https://<MEDIA>/api/pedido        (Vercel)
 *
 *  Por qué los .mp4 NO van al tema: assets/ es para "image, CSS and
 *  JavaScript files". Los mp4 dan "file format is not supported" de forma
 *  intermitente aunque estén bajo el límite de 20 MB. Como Vercel se queda
 *  igualmente para /api/pedido, los vídeos se sirven desde allí.
 *
 *  Por qué /api/pedido tiene que ser ABSOLUTA: en Shopify una ruta relativa
 *  resuelve a tu-tienda.myshopify.com/api/pedido, que no existe. Y como
 *  registrarPedido() traga los errores a propósito ("la venta nunca se
 *  bloquea por el registro"), cada pedido se perdería SIN ERROR VISIBLE.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync,
         existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename }  from 'node:path';
import { fileURLToPath }            from 'node:url';

const AQUI   = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, 'shopify');
const VERIFICAR = process.argv.includes('--verificar');

/* ── Lo único que hay que configurar ──────────────────────────────────
   El dominio donde viven /api/pedido y los vídeos. Es el despliegue de
   Vercel que YA está en producción (repo github.com/berthidalgo/landing).
   Sin barra final. */
const MEDIA = process.env.MEDIA_BASE || '';

/* ── Utilidades ───────────────────────────────────────────────────── */
const problemas = [];
const avisos    = [];
function fallo(msg) { problemas.push(msg); }
function aviso(msg) { avisos.push(msg); }

/* ── 1. Leer la landing ───────────────────────────────────────────── */
const rutaHtml = join(AQUI, 'index.html');
let html = readFileSync(rutaHtml, 'utf8');
const bytesOriginal = Buffer.byteLength(html);

// index.html empieza con BOM (U+FEFF). En Vercel es inofensivo porque va al
// principio del archivo, pero aquí la plantilla lleva delante {% layout none %}
// y el BOM acabaría EN MEDIO, justo antes del <!DOCTYPE>. Un carácter antes
// del doctype mete al navegador en quirks mode y ahí el diseño móvil se
// descuadra sin que nada parezca roto.
const teniaBom = html.charCodeAt(0) === 0xFEFF;
if (teniaBom) html = html.slice(1);

/* ── 2. Guardia: sintaxis que Liquid se comería ───────────────────────
   Hoy index.html no tiene ni un {{ ni un {%, y por eso el JavaScript
   sobrevive intacto a la conversión. Si alguien añade uno más adelante,
   Liquid intentará ejecutarlo y la página se romperá de formas raras.
   Este guardia lo detecta antes de publicar, no después. */
for (const [patron, nombre] of [[/\{\{/g, '{{'], [/\{%/g, '{%']]) {
  const n = (html.match(patron) || []).length;
  if (n) {
    const linea = html.slice(0, html.search(patron)).split('\n').length;
    fallo(`index.html contiene ${n} aparición(es) de "${nombre}" (primera en la ` +
          `línea ${linea}). Liquid lo interpretaría como código suyo. ` +
          `Envuelve ese bloque en {% raw %}…{% endraw %} antes de seguir.`);
  }
}

/* ── 3. Guardia: el dominio de los medios ─────────────────────────── */
if (!MEDIA) {
  fallo('Falta el dominio de Vercel. Ejecuta con:\n' +
        '        MEDIA_BASE=https://tu-proyecto.vercel.app node landing-cuchillo/build-shopify.mjs\n' +
        '      Es el dominio donde ya viven /api/pedido y los vídeos.');
} else if (!/^https:\/\/[a-z0-9.-]+$/i.test(MEDIA)) {
  fallo(`MEDIA_BASE debe ser https:// y sin barra final. Recibido: "${MEDIA}"`);
}

/* ── 4. Reescritura de rutas ──────────────────────────────────────── */
const asset = new Set();   // lo que hay que copiar a shopify/assets/
let nAsset = 0, nVideo = 0;

// 4a. Imágenes y fuentes → asset_url del tema.
//     Funciona igual dentro de un atributo HTML que dentro de una cadena
//     de JavaScript: Liquid se ejecuta en el servidor, mucho antes de que
//     el navegador vea el archivo.
html = html.replace(/(img|fonts)\/([A-Za-z0-9._-]+\.(?:webp|jpg|jpeg|png|svg|woff2?))/g,
  (_, carpeta, archivo) => {
    asset.add(`${carpeta}/${archivo}`);
    nAsset++;
    return `{{ '${archivo}' | asset_url }}`;
  });

// 4b. Vídeos → se quedan en Vercel, con URL absoluta.
html = html.replace(/(?:img\/)([A-Za-z0-9._-]+\.mp4)/g, (_, archivo) => {
  nVideo++;
  return `${MEDIA}/img/${archivo}`;
});

// 4c. El endpoint de pedidos → absoluto. Sin esto se pierden las ventas.
//     Solo se comprueba si hay MEDIA: sin él la sustitución dejaría la cadena
//     idéntica y el guardia acusaría de un fallo que no existe.
if (MEDIA) {
  const antesEndpoint = html;
  html = html.replace(/(PEDIDOS:\s*\{\s*url:\s*)'\/api\/pedido'/,
                      `$1'${MEDIA}/api/pedido'`);
  if (html === antesEndpoint) {
    fallo('No se encontró PEDIDOS: { url: \'/api/pedido\' } en index.html. ' +
          'Si cambiaste esa línea, actualiza también este script: es la que ' +
          'evita que los pedidos se pierdan en silencio.');
  }
}

/* ── 5. Guardia: que no quede ninguna ruta relativa suelta ────────── */
const sueltas = html.match(/["'(](?:img|fonts)\/[^"')]*/g);
if (sueltas) {
  fallo(`Quedaron ${sueltas.length} ruta(s) relativa(s) sin convertir: ` +
        [...new Set(sueltas)].slice(0, 5).join(', '));
}
if (MEDIA) {
  const relativasApi = html.match(/["']\/api\/[^"']*/g);
  if (relativasApi) {
    fallo(`Quedó una ruta /api/ relativa: ${[...new Set(relativasApi)].join(', ')}`);
  }
}

/* ── 6. Comprobar que los archivos existen de verdad ──────────────── */
for (const rel of asset) {
  if (!existsSync(join(AQUI, rel))) fallo(`Falta el archivo ${rel}`);
}
// Los vídeos no se copian, pero si no existen en local tampoco estarán en
// Vercel, así que conviene decirlo.
for (const v of ['bucle.mp4', 'bucle2.mp4', 'demo.mp4', 'demo2.mp4']) {
  if (!existsSync(join(AQUI, 'img', v))) {
    aviso(`img/${v} no está en local — comprueba que sí esté publicado en Vercel`);
  }
}

/* ── 7. La plantilla Liquid ───────────────────────────────────────── */
// {% layout none %} es lo que hace que la landing salga tal cual: sin el
// header, el footer ni el CSS del tema. Sin esta línea, Dawn envolvería la
// página y el diseño calcado de Kenku dejaría de serlo.
const CABECERA =
`{%- comment -%}
  ══════════════════════════════════════════════════════════════════
   GENERADO — no editar aquí.
   Fuente:  landing-cuchillo/index.html
   Genera:  MEDIA_BASE=${MEDIA || 'https://…'} node landing-cuchillo/build-shopify.mjs
  ══════════════════════════════════════════════════════════════════
  layout none = la landing se dibuja sola, sin header/footer/CSS del tema.
  Imágenes y fuentes salen de assets/ del tema; los vídeos y /api/pedido
  siguen en Vercel porque Shopify no sirve mp4 ni ejecuta funciones.
{%- endcomment -%}
{% layout none %}
`;
const liquid = CABECERA + html;

/* ── 8. Informe y salida ──────────────────────────────────────────── */
console.log('▸ Conversión a tema de Shopify\n');
console.log(`  index.html          ${(bytesOriginal / 1024).toFixed(1)} KB${teniaBom ? ' (BOM retirado)' : ''}`);
console.log(`  imágenes y fuentes  ${nAsset} referencias → ${asset.size} archivos a assets/`);
console.log(`  vídeos              ${nVideo} referencias → ${MEDIA || '<MEDIA>'}/img/`);
console.log(`  endpoint            ${MEDIA || '<MEDIA>'}/api/pedido`);

if (avisos.length) {
  console.log('\n  Avisos:');
  for (const a of avisos) console.log(`    · ${a}`);
}

if (problemas.length) {
  console.error('\n✗ No se generó nada:\n');
  for (const p of problemas) console.error(`    · ${p}\n`);
  process.exit(1);
}

if (VERIFICAR) {
  console.log('\n✓ --verificar: todo correcto, no se escribió nada.');
  process.exit(0);
}

/* Se rehace entero en cada build para que no queden restos de assets
   que ya no se usan. */
rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(join(SALIDA, 'templates'), { recursive: true });
mkdirSync(join(SALIDA, 'assets'),    { recursive: true });

writeFileSync(join(SALIDA, 'templates', 'page.cuchillo.liquid'), liquid);
for (const rel of asset) copyFileSync(join(AQUI, rel), join(SALIDA, 'assets', basename(rel)));

// Shopify limita cada archivo de assets/ a 20 MB.
let pesoAssets = 0;
for (const f of readdirSync(join(SALIDA, 'assets'))) {
  const { size } = statSync(join(SALIDA, 'assets', f));
  pesoAssets += size;
  if (size > 20 * 1024 * 1024) {
    console.error(`\n✗ ${f} pesa ${(size / 1048576).toFixed(1)} MB — Shopify rechaza más de 20 MB`);
    process.exit(1);
  }
}

console.log(`\n✓ Generado en shopify/`);
console.log(`    templates/page.cuchillo.liquid   ${(Buffer.byteLength(liquid) / 1024).toFixed(1)} KB`);
console.log(`    assets/                          ${asset.size} archivos · ${(pesoAssets / 1024).toFixed(0)} KB`);
console.log(`\n  Siguiente paso:`);
console.log(`    shopify theme push --store TU-TIENDA.myshopify.com --path landing-cuchillo/shopify --nodelete`);
