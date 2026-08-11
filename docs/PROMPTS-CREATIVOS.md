# 🎨 Creativos de la landing — qué generar y dónde va cada uno

Genera, guarda **con el nombre exacto** en `landing-cuchillo/img/` y avísame: yo los
engancho y despliego.

> **Regla que atraviesa todo:** esto se anuncia como **utensilio de cocina**. Nunca como
> arma, táctico, vikingo, de caza, camping o supervivencia. Ni en la imagen ni en el texto.
> Es lo que separa un anuncio aprobado de una cuenta restringida.
> Lista completa de palabras prohibidas al final.

---

## 📐 Dónde encaja cada pieza (AIDA)

| Fase | Bloque de la landing | Qué hace | Archivo |
|---|---|---|---|
| **A**tención | Héroe | Frenar el scroll en 1 segundo | `hero.jpg` |
| **A** | Galería | Dar a entender que es real | `g1…g5.jpg` |
| **I**nterés | Beneficios · Antes/Después | "esto resuelve *mi* problema" | `agarre.jpg` |
| **I** | **Vídeo demostración** | La prueba. **Lo que más convierte** | `demo.mp4` |
| **D**eseo | Un solo cuchillo para toda tu cocina | Verlo en su cocina | `uso.jpg` |
| **D** | Medidas | Matar la objeción del tamaño | *ya resuelto en SVG* |
| **A**cción | Packs · Formulario | — | *no necesita imagen* |

---

## 1 · `hero.jpg` — la más importante · 1:1

Es lo primero que ve alguien que viene de TikTok. Si esta falla, el resto da igual.

> Professional product photography of a hand-forged kitchen cleaver with a wide curved
> blade and a large oval finger-hole cut into the blade, dark hammered forge finish with a
> mottled damascus-like pattern, polished rosewood handle with three steel rivets. Resting
> on a thick walnut cutting board in a warm home kitchen, sliced tomato and fresh herbs
> beside it. Soft directional window light from the left, deep shadows, warm charcoal
> background. Shot on 85mm, f/4, high detail on the steel texture. Square 1:1, the knife
> filling most of the frame on a diagonal.
> **Negative:** no text, no watermark, no logos, no hands, no blood, no raw red meat, no
> tactical or military props, no outdoor or camping setting, no dark moody horror lighting.

## 2 · `g1.jpg` … `g5.jpg` — galería · 1:1

Cinco vistas. La galería está **oculta** hasta que haya al menos dos.

| Archivo | Qué debe mostrar |
|---|---|
| `g1.jpg` | El cuchillo completo sobre fondo claro y limpio (catálogo) |
| `g2.jpg` | **La foto de medidas** que ya tienes, con las cotas 20 cm y 8.5 cm |
| `g3.jpg` | Macro del hueco de agarre con dos dedos dentro |
| `g4.jpg` | Cortando: tomate, calabaza o carne |
| `g5.jpg` | El paquete: cuchillo + funda protectora |

Para `g1`:

> Clean product photo of a forged kitchen cleaver with a finger-hole in the blade and
> wooden handle, lying flat on a light grey seamless background. Overhead top-down shot,
> even soft studio light, minimal shadows, catalogue style, square 1:1.
> **Negative:** no text, no watermark, no hands, no props.

## 3 · `agarre.jpg` — el argumento entero · 1:1

El hueco de agarre es lo único que diferencia este cuchillo de otros cuarenta.

> Extreme macro close-up of the oval finger-hole in a forged kitchen knife blade, with two
> fingers hooked through it mid-cut. Focus on the transition between the polished edge
> bevel and the dark hammered forge finish. Warm rim light, blurred wooden kitchen
> background, shallow depth of field, 1:1.
> **Negative:** no text, no watermark, no blood, no raw red meat.

## 4 · `antes-despues.jpg` — la comparativa · 4:5

La pieza más persuasiva de la competencia. Es una imagen partida en dos con un "VS" en
medio. Mientras no la tengas, la landing muestra una versión en texto; en cuanto la subas,
la sustituye sola.

> Split-screen comparison image, vertical 4:5, divided by a diagonal golden line with a
> circular "VS" badge in the centre. **Left half, cooler and duller:** a thin ordinary
> kitchen knife squashing a tomato on a wooden board, uneven torn slices, tomato juice
> spilled. **Right half, warm and bright:** a wide forged cleaver with an oval finger-hole
> in the blade cutting a tomato into perfectly even thin slices, clean board. Dark
> background, dramatic side lighting, professional food photography, high detail.
> **Negative:** no text, no watermark, no hands in gloves, no blood, no raw red meat, no
> weapons context.

Luego súbela como `img/antes-despues.jpg` y en `CONFIG`:

```js
COMPARATIVA: { imagen: 'img/antes-despues.jpg' },
```

**Si le añades texto tú mismo** (con Canva, por ejemplo), usa exactamente estas etiquetas,
que son las que ya están validadas en el bloque de texto:

| Antes · con un cuchillo común | Después · con el nuestro |
|---|---|
| Cortes irregulares | Cortes parejos |
| Aplastas el tomate | Rebanadas limpias |
| La muñeca hace la fuerza | El peso hace la fuerza |
| Serruchas la carne | Separas por la articulación |
| Cambias de cuchillo tres veces | Uno solo para todo |

## 5 · `uso.jpg` — en una cocina peruana · 1:1

> Warm lifestyle photo: a woman's hands, mid-forties, fingers resting inside the
> finger-hole of a wide forged kitchen cleaver while slicing a red onion on a wooden board.
> Home kitchen in Lima: ceramic tile backsplash, a pot of rice out of focus behind. Natural
> late-afternoon light, shallow depth of field, warm tones. Documentary style, not staged.
> Square 1:1.
> **Negative:** no text, no watermark, no blood, no professional chef uniform, no dark or
> dramatic mood, no studio lighting.

---

# 🎬 `demo.mp4` — el vídeo · 9:16 · 15–20 s

**Es la pieza que más va a mover la aguja.** Un cuchillo se vende viendo cómo corta. La
landing ya tiene el hueco reservado: en cuanto lo tengas, se activa con una línea.

## ⚠️ El vídeo que dejaste no sirve para esto

`WhatsApp Video…mp4` lleva marca de agua de TikTok de `@aninda_shop06` y el rótulo
*"Unauthorised commercial use strictly prohibited"*. Meta y TikTok penalizan en entrega el
material con marca de agua de otra plataforma. Tres salidas, por orden de rapidez:

1. **Pídeselo al proveedor.** Ese vídeo es material de fábrica y `@aninda_shop06` casi
   seguro también lo republicó. Los mayoristas mandan el pack limpio y con permiso de uso
   solo por pedirlo por WhatsApp. **10 minutos, cero riesgo.**
2. **Grábalo tú** con el guion A de abajo: 20 minutos con un móvil. Además el UGC propio
   rinde más en frío que el vídeo de catálogo que ya usan otros diez vendedores.
3. Genera uno por IA con el prompt de más abajo, mientras llega el del proveedor.

## Guion A · "El hueco" — empieza por este

Ataca la objeción real (la muñeca que se cansa) y no afirma nada que no podamos probar.

| Seg | Imagen | Rótulo en pantalla |
|---|---|---|
| 0–2 | Macro: dos dedos entrando en el hueco de la hoja | **"¿Ves este hueco?"** |
| 2–5 | Corte de cebolla, la muñeca casi quieta | "Tus dedos van *encima* del filo" |
| 5–9 | El mismo corte con un cuchillo normal: la muñeca forcejea | "Con uno normal, la fuerza la hace tu muñeca" |
| 9–13 | La hoja cae sola y parte una zanahoria | "Con este, la hace el peso" |
| 13–17 | Producto sobre la tabla + precio | **"S/69 · Pagas cuando te llega"** |

## Guion B · "Una sola herramienta"

Plano cenital fijo, sin voz, solo el sonido real del corte: cebolla → pollo → zanahoria →
machacar ajo con el plano de la hoja → arrastrar todo a la olla con la hoja.
Rótulo final: **"Un cuchillo. Toda la cocina. S/69."**

## Guion C · UGC — el que más rinde en frío

Alguien de tu entorno que cocine a diario, en su cocina, hablando a cámara:
*"Yo tenía tres cuchillos y ninguno cortaba bien el pollo. Este llegó ayer…"* y corta en
directo. Grabado con móvil, sin producción. **Es el más barato y suele ganar.**

## Prompt para vídeo por IA (Veo / Kling / Runway)

> Close-up cinematic shot in a warm home kitchen: a hand-forged kitchen cleaver with a
> large oval finger-hole in the blade slices cleanly through a ripe tomato on a wooden
> cutting board. The hand grips through the hole in the blade, fingers above the edge.
> Shallow depth of field, warm afternoon window light, slow motion, steam and fresh herbs
> in the background. Vertical 9:16, photorealistic, no text.
> **Negative:** no watermark, no logos, no blood, no raw red meat, no hands in gloves, no
> outdoor setting, no weapons context.

**Especificaciones:** 9:16 · 1080×1920 · **menos de 3 MB** para la landing (recórtalo a
15 s y compáralo) · gancho en los 2 primeros segundos · subtítulos quemados, casi nadie lo
verá con sonido.

---

## 🚫 Palabras prohibidas

No las uses en el vídeo, el texto del anuncio ni la landing:

> arma · táctico · vikingo · samurái · supervivencia · caza · combate · militar · machete ·
> daga · espada · defensa personal · camping · matar · degollar · sangre · letal

Y las que **sí** hay que usar, porque anclan la categoría correcta: *cocina, cocinar,
utensilio de cocina, tabla de cortar, picar, verduras, hogar, chef*.

Comprobar antes de publicar:

```bash
node landing-cuchillo/test/compliance-check.js
```
