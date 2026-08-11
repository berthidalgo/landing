# 🎨 Prompts para los creativos — YUNQUE

Todo lo que hay que generar, con el prompt listo para pegar. Genera, guarda en esta misma
carpeta con el nombre indicado y avísame: yo los meto en la landing.

> **Regla que atraviesa todo:** este producto se anuncia como **utensilio de cocina**.
> Nunca como arma, táctico, vikingo, de caza, de camping o de supervivencia. Ni en la
> imagen ni en el texto. Es lo que separa un anuncio aprobado de una cuenta restringida.
> Detalle en [`../landing-cuchillo/README.md`](../landing-cuchillo/README.md).

---

## ⚠️ Antes que nada: el vídeo que dejaste no se puede usar

`WhatsApp Video 2026-08-10 at 6.20.05 PM.mp4` tiene dos problemas:

1. **Marca de agua de TikTok de `@aninda_shop06`** en todos los fotogramas.
2. Rótulo impreso: *"Unauthorised commercial use of video strictly prohibited"*.

Meta y TikTok penalizan en entrega el material con marca de agua de otra plataforma, y el
aviso legal expone a una reclamación de derechos. **Sirve como referencia de lo que
queremos grabar, no como creativo.** Los prompts de abajo lo reemplazan.

---

## 1 · Foto principal · `hero.png` — 1:1

> Professional product photography of a hand-forged kitchen cleaver with a wide curved
> blade, a large oval finger-hole cut into the blade, dark hammered forge finish with a
> mottled damascus-like pattern, and a polished rosewood handle with three steel rivets.
> The knife rests on a thick walnut cutting board in a warm domestic kitchen. Soft
> directional window light from the left, deep shadows, dark charcoal background.
> Shot on 85mm, f/4, high detail on the steel texture. Square 1:1 composition, the knife
> filling most of the frame, diagonal placement.
> **Negative:** no text, no watermark, no logos, no hands, no blood, no raw meat,
> no tactical or military props, no outdoor setting.

## 2 · Escala real · `escala.png` — 1:1

La objeción número uno de este producto es *"¿qué tan grande es?"*.

> Product photo of a hand-forged kitchen cleaver with a finger-hole in the blade, lying
> flat on a light grey seamless surface next to a standard kitchen fork and a lime, for
> size comparison. Overhead top-down shot, even soft studio light, minimal shadows.
> Clean, catalogue style, 1:1.
> **Negative:** no text, no watermark, no rulers, no hands.

## 3 · En uso, cocina peruana · `uso-cocina.png` — 4:5

> Warm lifestyle photo: a woman's hands, mid-forties, resting fingers inside the
> finger-hole of a wide forged kitchen cleaver while slicing a red onion on a wooden board.
> Home kitchen in Lima: ceramic tile backsplash, a pot of rice out of focus behind.
> Natural late-afternoon light, shallow depth of field, warm tones. Documentary style,
> not staged. 4:5 vertical.
> **Negative:** no text, no watermark, no blood, no raw red meat, no professional chef
> uniform, no dark or dramatic mood.

## 4 · El detalle que vende · `detalle-hueco.png` — 1:1

El hueco de agarre es el argumento entero. Merece su propia foto.

> Extreme macro close-up of the oval finger-hole in a forged kitchen knife blade, two
> fingers hooked through it. Focus on the transition between the polished edge bevel and
> the dark hammered forge finish. Warm rim light, blurred wooden kitchen background.
> 1:1, shallow depth of field.
> **Negative:** no text, no watermark, no blood, no cutting action.

## 5 · Foto para prueba social · `entrega.png` — 1:1

> Casual smartphone-style photo, slightly imperfect: a kraft cardboard parcel just opened
> on a kitchen table, the forged cleaver visible inside its protective sleeve. Daylight
> from a window, a mug and keys in the corner of the frame. Looks like a real customer
> photo, not a studio shot. 1:1.
> **Negative:** no text, no watermark, no branding on the box, no studio lighting.

---

## 🎬 Vídeo para TikTok / Reels · 9:16, 15–20 s

Tres ángulos. Empieza por el **A**: es el que ataca la objeción real (la muñeca cansada) y
el que se sostiene sin afirmar nada que no podamos probar.

### A · "El hueco" — demostración

| Seg | Imagen | Voz / rótulo |
|---|---|---|
| 0–2 | Primer plano: dedos entrando en el hueco de la hoja | **"¿Ves este hueco?"** |
| 2–5 | Mano cortando cebolla, muñeca casi quieta | "Tus dedos van *encima* del filo." |
| 5–9 | Mismo corte con un cuchillo normal: la muñeca hace fuerza | "Con uno normal, la fuerza la hace tu muñeca." |
| 9–13 | La hoja cae sola sobre una zanahoria y la parte | "Con este, la hace el peso." |
| 13–17 | Producto sobre la tabla, se sobreimprime el precio | "S/69, y pagas cuando te llega." |

### B · "Una sola herramienta"

Plano cenital fijo. Se corta seguido: cebolla → pollo → zanahoria → se aplasta un ajo con
el plano de la hoja → se arrastra todo a la olla con la hoja. Sin voz, solo el sonido real
del corte. Rótulo final: **"Un cuchillo. Toda la cocina. S/69."**

### C · UGC honesto (grábalo con el móvil, sin producción)

Alguien de tu entorno que cocine a diario, hablando a cámara en su cocina:
*"Yo tenía tres cuchillos y ninguno cortaba el pollo. Este llegó ayer…"*, y corta en
directo. **Este suele ser el que más rinde en frío, y es el más barato de hacer.**

**Especificaciones:** 9:16 · 1080×1920 · texto dentro del 80% central (fuera de la zona de
la interfaz) · gancho en los primeros 2 segundos · subtítulos quemados, casi nadie lo verá
con sonido.

---

## Palabras prohibidas en los creativos

No las uses en el vídeo, el texto del anuncio ni la landing:

> arma · táctico · vikingo · samurái · supervivencia · caza · combate · militar ·
> machete · daga · espada · defensa personal · camping · matar · degollar · sangre · letal

Y las que **sí** hay que usar, porque anclan la categoría correcta: *cocina, cocinar,
utensilio de cocina, tabla de cortar, picar, verduras, hogar*.

Para verificarlo antes de publicar:

```bash
node landing-cuchillo/test/compliance-check.js
```
