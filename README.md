# 🔪 Landing YUNQUE

Landing de venta directa **mobile-first** con pago contra entrega y cierre por WhatsApp.
HTML estático: sin framework, sin build, sin dependencias externas.

**Pesa ~182 KB** en móvil con todo incluido (HTML + 4 tipografías + imágenes WebP).

```
├── index.html        ← la landing entera
├── fonts/            ← Poppins autoalojada (4 pesos, 30 KB)
├── img/              ← foto del producto en WebP + respaldo JPG
├── vercel.json       ← cabeceras de caché y seguridad
├── test/             ← 44 tests + chequeo de compliance   (no se publica)
├── backend/          ← Apps Script: pedidos → Sheets      (no se publica)
└── docs/             ← documentación y prompts de creativos (no se publica)
```

`test/`, `backend/` y `docs/` están excluidos del despliegue en
[`.vercelignore`](.vercelignore): al aire solo sale la landing.

---

## 🚀 Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa este repositorio.
2. **No cambies nada** en la configuración:
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: *(vacío)*
   - Output Directory: *(vacío)*
3. **Deploy.**

Vercel detecta un sitio estático y sirve `index.html` desde la raíz. Cada `git push` a
`main` vuelve a desplegar solo.

### ⚠️ La página sale en `noindex`

[`vercel.json`](vercel.json) envía `X-Robots-Tag: noindex, nofollow` **a propósito**:
mientras haya reseñas de ejemplo y el WhatsApp de plantilla, la página no debe entrar en
Google. Una URL indexada con `[EJEMPLO]` se queda cacheada así.

**Cuando lances de verdad, borra esa línea de `vercel.json`.**

---

## ⚙️ Antes de publicar

Todo lo editable está en `window.CONFIG`, en la cabecera de [`index.html`](index.html):

```js
window.CONFIG = {
  MARCA:    'YUNQUE',
  WHATSAPP: '51999999999',       // ← TU número, formato 51XXXXXXXXX
  PIXEL_ID: '',                  // ← Meta · Administrador de eventos
  TIKTOK_ID:'',                  // ← TikTok Ads
  PACKS:  [ … ],                 // ← precios
  UPSELL:      { … },            // ← añadido dentro del formulario
  POST_UPSELL: { … },            // ← oferta posterior al pedido
  PEDIDOS:{ url:'', token:'' }   // ← Apps Script, ver backend/README.md
};
```

Comprueba que está listo:

```bash
node test/compliance-check.js
```

Falla a propósito hasta que sustituyas el WhatsApp de ejemplo y las reseñas `[EJEMPLO]`
por datos reales.

---

## 📦 Pedidos y notificaciones

La landing no necesita servidor: el formulario escribe en una hoja de Google y te avisa al
móvil con sonido de caja registradora. Montaje en
[`backend/README.md`](backend/README.md).

```
Formulario → Apps Script → Google Sheets  (queda el pedido)
                        └→ Pushover       (💰 cha-ching en tu móvil)
                        └→ WhatsApp       (el cliente confirma contigo)
```

## 🧪 Tests

```bash
# Abre en el navegador: el título de la pestaña es el informe
start test/test-funcional.html
```

44 casos: totales, packs, upsell, post-upsell, validación del formulario, mensaje de
WhatsApp y fidelidad del sistema de diseño.

## 📚 Documentación

- [`docs/LANDING.md`](docs/LANDING.md) — decisiones de diseño, estructura y precios
- [`docs/PROMPTS-CREATIVOS.md`](docs/PROMPTS-CREATIVOS.md) — prompts para las imágenes y
  guiones de vídeo, con las palabras prohibidas en anuncios
