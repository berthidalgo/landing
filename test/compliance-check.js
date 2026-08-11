#!/usr/bin/env node
/**
 * Compliance publicitario para un producto CON FILO.
 *
 * El riesgo aquí no es sanitario (como en BIOAYUR): es que Meta y TikTok
 * clasifiquen el producto como ARMA en vez de como utensilio de cocina.
 *
 *   · Meta  — permite cuchillos culinarios; prohíbe los NO culinarios
 *             (tácticos, de caza, de combate). El enforcement automático de 2026
 *             es agresivo y una cuenta restringida cuesta más que la campaña.
 *   · TikTok — la lista de prohibidos dice "non-culinary knives, blades, spears".
 *             Excluye de esa lista los objetos afilados "de uso doméstico que
 *             muestran claramente un logo o marca en el producto".
 *
 * De ahí las dos reglas: vocabulario 100% de cocina, y marca visible.
 *
 * Uso (desde la raíz del repo):
 *   node landing-cuchillo/test/compliance-check.js
 */

const fs = require('fs');
const path = require('path');

const LANDING = path.join(__dirname, '..', 'index.html');

/** Palabras que empujan al producto fuera de la categoría "cocina". */
const PROHIBIDOS = [
  'arma', 'armas', 'armamento',
  'tactico', 'tactica', 'tactical',
  'vikingo', 'viking', 'samurai', 'ninja', 'guerrero',
  'supervivencia', 'survival',
  'caza', 'cazar', 'cazador', 'hunting',
  'combate', 'militar', 'asalto',
  'machete', 'daga', 'espada', 'katana', 'punal',
  'defensa personal', 'autodefensa',
  'camping', 'aire libre', 'outdoor',
  'matar', 'degollar', 'herir', 'atacar', 'apunalar',
  'letal', 'mortal', 'sangre',
  'navaja', 'mariposa'
];

/** Señales de que SÍ se presenta como utensilio de cocina. */
const EXIGIDOS = [
  { que: 'se declara utensilio de cocina', re: /utensilio de cocina/i },
  { que: 'aviso de mantener fuera del alcance de los niños', re: /fuera del alcance de los ni/i },
  { que: 'habla de cocina o de cocinar', re: /\bcocina\b/i }
];

/** Plantillas que no pueden llegar a producción. */
const PLANTILLAS = [
  { que: 'reseñas de ejemplo sin sustituir', re: /\[EJEMPLO/i },
  { que: 'nombres de reseña sin sustituir', re: /\[Nombre\]|\[Distrito\]/i },
  { que: 'WhatsApp de ejemplo', re: /51999999999/ },
  // Los recuadros "falta img/x.jpg" son para montar la página, no para el cliente.
  { que: 'recuadros de imagen pendiente visibles', re: /MOSTRAR_HUECOS:\s*true/ }
];

const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const textoVisible = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ');

function main() {
  const html = fs.readFileSync(LANDING, 'utf8');
  const visible = textoVisible(html);
  const aguja = normalizar(visible);
  let fallos = 0;

  console.log('== Vocabulario: el producto debe leerse como cocina, no como arma ==\n');
  for (const termino of PROHIBIDOS) {
    const t = normalizar(termino).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patron = new RegExp('(^|[^a-z0-9])' + t + '([^a-z0-9]|$)');
    if (patron.test(aguja)) {
      const i = aguja.search(patron);
      const ctx = visible.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, ' ').trim();
      console.log(`FALLA :: término de riesgo "${termino}" -> …${ctx}…`);
      fallos++;
    }
  }
  if (fallos === 0) console.log(`PASA  :: ninguno de los ${PROHIBIDOS.length} términos de riesgo aparece`);

  console.log('\n== Señales exigidas ==\n');
  for (const { que, re } of EXIGIDOS) {
    const ok = re.test(visible);
    console.log(`${ok ? 'PASA ' : 'FALLA'} :: ${que}`);
    if (!ok) fallos++;
  }

  // TikTok excluye de su lista de prohibidos los cortantes domésticos con marca visible.
  const marca = (html.match(/MARCA:\s*'([^']+)'/) || [])[1];
  const okMarca = Boolean(marca && marca.trim());
  console.log(`${okMarca ? 'PASA ' : 'FALLA'} :: hay marca definida${okMarca ? ` ("${marca}")` : ''}`);
  if (!okMarca) fallos++;

  console.log('\n== Plantillas pendientes de sustituir ==\n');
  for (const { que, re } of PLANTILLAS) {
    const hay = re.test(html);
    console.log(`${hay ? 'FALLA' : 'PASA '} :: ${que}`);
    if (hay) fallos++;
  }

  console.log(`\n${fallos === 0 ? 'OK — lista para publicar' : fallos + ' problema(s) que resolver antes de pautar'}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
