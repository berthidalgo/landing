# 🔪 Landing YUNQUE — clon de la plantilla de Kenku

Landing de venta directa **mobile-first**, pago contra entrega y cierre por WhatsApp.
**Replica la plantilla de `kenku.pe`**, no la reinterpreta: misma tipografía, misma paleta,
mismo orden de bloques, mismo formulario COD. Un archivo HTML, sin dependencias externas,
sin build.

- **Página:** [`index.html`](index.html)
- **Backend de pedidos:** [`backend/`](backend/) — Sheets + "cha-ching" + panel en soles,
  con [`api/pedido.mjs`](api/pedido.mjs) de intermediario para que ningún secreto viaje en el HTML
- **Creativos:** [`../PROWIN/PROMPTS-CREATIVOS.md`](../PROWIN/PROMPTS-CREATIVOS.md)
- **Tests:** 44 casos · **Compliance:** `node test/compliance-check.js`
- **Peso en móvil:** ~190 KB (HTML + 4 Poppins de 30 KB + imágenes WebP)

```bash
node landing-cuchillo/test/compliance-check.js    # bloquea si hay riesgo o plantillas
node landing-cuchillo/test/probar-backend.js      # el receptor de pedidos (Google simulado)
node landing-cuchillo/test/probar-api.mjs         # la función que guarda el secreto
start landing-cuchillo/test/test-funcional.html   # el título de la pestaña es el informe
```

---

## ⭐ Las primeras reseñas

No tienes clientes todavía, así que **`CONFIG.RESENAS` está vacío a propósito** y en su
lugar sale el bloque *"Acabamos de lanzarlo en el Perú"*, que convierte la falta de
reseñas en el argumento del riesgo cero.

**No las inventes.** Además de ser publicidad engañosa —sancionable por INDECOPI—, se
notan: nombres genéricos, todas de cinco estrellas y ninguna con foto. Un comprador de
contraentrega desconfía por defecto, y una reseña falsa detectada mata la venta.

### Cómo tener tres reales en tres días

1. **Los primeros 5 pedidos son tu inventario de reseñas.** Ya tienes su WhatsApp: el
   pedido entra por ahí.
2. **Escríbeles 24 h después de la entrega**, ni antes ni una semana después:

   > ¡Hola [nombre]! ¿Ya lo probaste? 😊
   > Somos nuevos y tu opinión nos ayuda muchísimo.
   > ¿Me cuentas en una línea qué tal cortó? Y si puedes, mándame una foto
   > del cuchillo en tu cocina.

3. **Pide permiso explícito** para publicarla: *"¿Te parece si la publico en la página con
   tu nombre y distrito?"*. Basta el "sí" por WhatsApp.
4. **Cópiala tal cual**, con sus faltas y su forma de hablar. Una reseña que dice
   *"llegó rapidito, corta bien la carne"* convence más que una redactada.

```js
RESENAS: [
  { texto: 'Corta muy bien y se siente firme en la mano. Llegó rápido.',
    nombre: 'M. G.', lugar: 'Los Olivos', hace: 'hace 2 días' }
]
```

Con una sola reseña real ya se muestra el bloque de reseñas y desaparece el de
lanzamiento. `hace` es opcional pero **la marca temporal es lo que hace creíble** la
reseña: es el detalle que usan Kenku e ImportBlueStore.

---

## 🚨 Antes de pautar

`compliance-check.js` falla a propósito hasta que hagas estas tres cosas:

1. **Poner tu WhatsApp** en `CONFIG.WHATSAPP` (ahora está el de ejemplo `51999999999`).
2. **Sustituir la reseña `[EJEMPLO]`** por reseñas reales.
3. **Sustituir `[Nombre] · [Distrito]`** por nombres y distritos reales.

---

## 🎨 El sistema de diseño, extraído de Kenku

No inventado: **medido** sobre su PDP con Playwright, leyendo el CSS ya computado
(`scripts` en el scratchpad; la fuente fue
[esta ficha](https://kenku.pe/products/nails-repairing-suero-reparador-de-unas)).

| Token | Valor | Dónde lo usa Kenku |
|---|---|---|
| Tipografía | **Poppins** 400 / 500 / 700 / 900 | Toda la página, sin excepción |
| Texto | `#121212` · secundario `#565656` | Cuerpo y títulos |
| **Morado de marca** | `#6D388B` | Precio, badge "MÁS VENDIDO", enlaces |
| **Verde CTA** | `#00D084` | Botón "COMPRAR AHORA" |
| Verde secundario | `#35CB5E` | Chip de WhatsApp, etiqueta "Mega Oferta" |
| Naranja | `#FF6900` | Etiqueta "Más vendido" |
| Amarillo | `#FDBC00` | Estrellas |
| Turquesa | `#CCFBF1` | **Fondo del pack seleccionado** |
| Gris caja | `#F3F3F3` | Bloque de envíos, tira de contraentrega |
| Radio | **12px** (principal), 8px, 6px | Botones, tarjetas, cajas |
| Base tipográfica | 15px cuerpo · 24.75px/900 H1 · 18px/700 botón | |

Cinco de los tests comprueban justamente esto: si alguien cambia el verde del CTA o el
radio de 12px, el test falla. La fidelidad está protegida, no confiada a la memoria.

Poppins va **autoalojada** (30 KB las cuatro variantes, subset latino desde Google Fonts,
licencia SIL OFL). Kenku la carga desde el CDN de Shopify; nosotros no dependemos de red
externa.

## 🧬 El orden de bloques, calcado

| # | Bloque | Detalle copiado |
|:-:|---|---|
| 1 | Cabecera | ☰ · logotipo centrado · carrito |
| 2 | Barra negra | ★★★★★ + promesa |
| 3 | Héroe | Rótulo con énfasis en verde, foto, **píldoras** "ENVÍO GRATIS HOY" / "STOCK LIMITADO", botón + sellos |
| 4 | Badge morado | `MÁS VENDIDO \| ÚLTIMAS UNIDADES` con borde |
| 5 | H1 + estrellas | Nombre largo y descriptivo, al estilo de sus fichas |
| 6 | Precio | Morado grande + tachado + chip verde "Escríbenos" |
| 7 | **CTA verde** | "COMPRAR AHORA" + "Envío gratis - Todo Perú" debajo |
| 8 | Caja gris | Envío Gratis · Enviado por… · Compra Segura |
| 9 | **Packs** | Miniatura + título + etiqueta de color + tachado y precio |
| 10 | CTA verde repetido | Igual que el 7 |
| 11 | Acordeones | ☑ Envíos Seguros · ☑ Garantía al 100% · ☑ ¿Qué incluye? |
| 12 | Ventajas con emoji | Su patrón exacto |
| 13 | Tira gris | 🛡 Pago Contraentrega · 🚚 Envío Gratis |
| 14 | Reseñas | Texto + nombre + distrito + estrellas |
| 15 | H2 en mayúsculas | "¡El cuchillo que te faltaba!" |
| 16 | Imagen grande | |
| 17 | **"Beneficios:"** | Lista con checks verdes, su patrón exacto |
| 18 | Imagen + **rótulo en cursiva** | "Así se corta cuando la mano va encima del filo" |
| 19 | **"Características:"** | Viñetas con negrita al inicio de cada una |
| 20 | **"MODO DE USO"** | H2 centrado + lista numerada |
| 21 | Imagen de medidas | |
| 22 | **Especificaciones** | Tabla de datos (su bloque "Capacidad:") |
| 23 | **"Materiales:"** | Subtítulos en negrita + párrafo, como su bloque "Ingrediente:" |
| 24 | FAQ + CTA final | |
| 25 | **Widget de reseñas** | "Todavía no hay reseñas · Sé el primero" |
| 26 | **Onda + pie morado** | Logo, atención al cliente, enlaces, suscripción, medios de pago |

Su ficha mide 8.142 px de alto; esta 7.244 px con todos los mismos bloques.

### El flujo de compra

```
[COMPRAR AHORA] → Formulario COD → se REGISTRA el pedido (💰 cha-ching) → Upsell → WhatsApp
```

El formulario replica el suyo campo por campo: **celular con WhatsApp primero**, nombre,
provincia, ciudad, dirección completa y **referencias** —el campo que reduce las entregas
fallidas—, selector de packs, opciones de envío, resumen con descuento en rojo, upsell con
casilla y el total dentro del botón.

El pedido se guarda **antes** del upsell, igual que ellos: si el cliente abandona en esa
pantalla, la venta ya está en la hoja. Si acepta, la fila se **actualiza**, no se duplica.

Recorrido completo de su embudo en
[`deep/kenku/05-funnel-de-conversion-completo.md`](../deep/kenku/05-funnel-de-conversion-completo.md).

## Lo que NO se copió, y por qué

- **Los tres upsells encadenados.** Con ticket de S/298 el margen aguanta esa fricción; con
  S/69–89 quema la intención. Aquí va uno.
- **"+20.000 clientes" y "4.8/5 (6,432 calificaciones)".** Son afirmaciones verificables y
  no las tenemos. `CONFIG.RESENAS_NOTA` y `RESENAS_TOTAL` están vacíos y la barra enseña
  otra cosa hasta que los rellenes con números reales.
- **Contadores que no expiran.** Los suyos se reinician al recargar. El del post-upsell
  **retira la oferta de verdad** al llegar a cero.
- **La casilla de suscripción premarcada.** Consentimiento por omisión.
- **Los 563 KB de HTML.** Su PDP pesa eso para venderse en 4G peruano; esta pesa ~190 KB
  con todo incluido.

---

## ⚠️ El riesgo específico de este producto

No es sanitario como en BIOAYUR: es que lo clasifiquen como **arma** en vez de utensilio.

| | Qué dice | Fuente |
|---|---|---|
| **Meta** | Permite cuchillos **culinarios**; prohíbe los no culinarios. Enforcement automático y agresivo en 2026 | [Transparency Center](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/weapons-ammunitions-explosives/) |
| **TikTok** | Prohíbe *"non-culinary knives"*; **excluye** los cortantes domésticos **con marca visible en el producto** | [TikTok Ads Policy](https://ads.tiktok.com/help/article/tiktok-ads-policy-dangerous-products-or-services) |

De ahí las dos reglas de [`test/compliance-check.js`](test/compliance-check.js):
vocabulario 100 % de cocina (40 términos bloqueados) y **marca visible** — por eso el
producto tiene nombre en vez de venderse como genérico.

---

## 💰 Precios

| Pack | Precio | Ancla | Etiqueta |
|---|---|---|---|
| 1 unidad | S/. 69.00 | — | |
| **2 unidades** | **S/. 89.00** | S/. 138.00 | ¡Más vendido! · *preseleccionado* |
| 3 unidades | S/. 119.00 | S/. 207.00 | ¡Mega Oferta! · **propuesto, no confirmado** |

El pack de 3 lo añadí yo, marcado como tal en `CONFIG.PACKS`; bórralo en una línea si no lo
quieres. La razón de proponerlo es que la mecánica de Kenku tiene **tres** niveles, y el
tercero existe para que el de en medio parezca la opción sensata.

**Advertencia de margen:** tu propio análisis en
[`deep/kenku/03-seleccion-de-producto.md`](../deep/kenku/03-seleccion-de-producto.md)
concluyó que en Perú el ticket que aguanta el CAC de Facebook es S/149–189, y que Kenku
*abandonó* el rango S/50–89 tras tres años. El pack de 2 es lo que salva la operación:
vigila el ticket medio y la tasa de entrega desde el día uno con el panel de
[`backend/`](backend/).

## ⚙️ Configuración

```js
window.CONFIG = {
  MARCA:    'YUNQUE',
  WHATSAPP: '51999999999',       // ← TU número
  PIXEL_ID: '', TIKTOK_ID: '',   // ← píxeles
  PRECIO_ANTES: 120,             // precio tachado de la ficha
  PACKS:  [ … ],
  UPSELL:      { activo:true, nombre:'Piedra afiladora…',  precio:29 },
  POST_UPSELL: { activo:true, nombre:'Tabla de bambú…',    precio:39, minutos:5 },
  PEDIDOS:{ url:'', token:'' },  // ← Apps Script, ver backend/README.md
  RESENAS_NOTA:'', RESENAS_TOTAL:''
};
```

| Momento | Meta | TikTok |
|---|---|---|
| Carga | `PageView` + `ViewContent` | `page` |
| Elegir pack | `AddToCart` | `AddToCart` |
| Abrir el formulario | `InitiateCheckout` | `InitiateCheckout` |
| Enviar el pedido | `Lead` | `SubmitForm` |

## ✅ Estado verificado

Playwright, viewport 390×844:

- **44/44 tests en verde** — packs, upsell, post-upsell (aceptado y rechazado), validación,
  mensaje de WhatsApp, modal y **5 de fidelidad al sistema de Kenku**
- Sin scroll horizontal · 0 elementos desbordados · 0 objetivos táctiles bajo 44px
- Un solo `<h1>`, `lang="es-PE"`, todas las imágenes con `alt`, ningún texto bajo 11.5px

## 🎬 Los vídeos

Material del proveedor, preparado para web. Los másteres (`img/vid1.mp4`, `img/vid2.mp4`,
29 MB entre los dos) están **fuera de git**: se regeneran desde el original.

| Archivo | De | Peso | Cómo se sirve |
|---|---|---|---|
| `bucle.mp4` | vid1, 6 s | **609 KB** | Arranca solo, sin sonido, en bucle. Es el gancho |
| `demo.mp4` | vid1, 15 s | 2,0 MB | Solo al pulsar "Ver el vídeo completo" |
| `demo2.mp4` | vid2, 44 s | 5,5 MB | Más abajo, solo al pulsar |

Al abrir la página se descargan **688 KB** de vídeo (el bucle y los pósters); el resto
llega únicamente si el visitante lo pide. Sin esto, una landing de 190 KB pasaría a 29 MB.

```bash
# Recomprimir un máster nuevo (necesita ffmpeg)
ffmpeg -i vid1.mp4 -vf "scale=640:1138:flags=lanczos" -c:v libx264 -crf 32 \
  -preset slow -pix_fmt yuv420p -movflags +faststart -an demo.mp4
```

A `vid2` se le **eliminó la marca de agua** «TIỆN ÍCH KORA» (una tienda vietnamita) con el
filtro `delogo`: Meta y TikTok degradan la entrega del material con logotipo de otra
plataforma.

> ⚠️ **Riesgo asumido, anotado a propósito:** el cuchillo de los vídeos **no es el mismo
> modelo** que el de las fotos — no tiene el hueco en la hoja, que es el argumento central
> de la página. Decisión del CEO (material del proveedor). Si aparecen rechazos en la
> puerta o quejas de "no es el que vi", esta es la primera causa a mirar.

## Pendiente

- [ ] WhatsApp y reseñas reales (lo bloquea el compliance)
- [ ] **Más fotos para la galería.** Ahora solo hay una y por eso está oculta. En cuanto
      pongas `medidas.jpg` y las de uso en `img/`, añádelas al array `FOTOS`
- [ ] Generar los creativos de [`PROMPTS-CREATIVOS.md`](../PROWIN/PROMPTS-CREATIVOS.md)
- [x] Backend de pedidos **funcionando y verificado en producción**: landing → `/api/pedido`
      (función de Vercel, guarda el secreto) → Apps Script → hoja *Pedidos YUNQUE*
- [ ] **El aviso con sonido todavía no suena**: falta elegir Pushover o Telegram y añadir
      sus propiedades al Apps Script ([`backend/README.md`](backend/README.md) §3)
- [ ] Ejecutar `crearPanel` una vez en el editor de Apps Script
- [ ] Confirmar el nombre de marca: **YUNQUE** es propuesta mía, no está registrada
