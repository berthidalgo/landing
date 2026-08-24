# Contexto: landing del cuchillo YUNQUE → Shopify

## Lo que hay que saber antes de proponer nada

La conversión a Shopify **ya está hecha y funcionando**. No la rehagas desde cero.
Lo que necesito es que la revises y me digas qué falta o qué está mal.

El repo `github.com/berthidalgo/landing` que clonaste es solo el **destino de
despliegue**, no el proyecto. Un `deploy.sh` copia ahí únicamente `index.html`,
`fonts/`, `img/`, `test/`, `backend/` y `api/`. Por eso no encontraste el script
de build ni el `.liquid`: viven en el repo de campañas, en local.

## Arquitectura real

```
index.html  ──build-shopify.mjs──>  page.cuchillo.liquid + assets/
    │                                          │
    │  fetch POST /api/pedido                  │  {% layout none %}
    ▼                                          ▼
api/pedido.mjs  (función serverless Vercel)   tema de Shopify
    │
    │  reenvía con token
    ▼
backend/Codigo.gs  (Google Apps Script)
    │
    ▼
Google Sheets  +  Pushover / Telegram / WhatsApp
```

No hay carrito de Shopify. El pedido se registra en Google Sheets y el cierre
se hace por WhatsApp. Es contra-entrega, no checkout.

## Dominio de producción

`https://landing-rho-two-62.vercel.app`

Verificado ahora mismo: la landing da 200, `/img/demo.mp4` da 200, y
`/api/pedido` da 405 en GET (correcto: solo acepta POST).

## Las dos trampas que el build ya resuelve

**1. `/api/pedido` tiene que ser URL ABSOLUTA.**
En Shopify una ruta relativa resuelve a `tu-tienda.myshopify.com/api/pedido`,
que no existe. Y `registrarPedido()` usa `mode:'no-cors'` con un `catch` vacío
a propósito ("la venta nunca se bloquea por el registro"), así que cada pedido
se perdería **sin error visible**. El build reescribe a la URL de Vercel.

**2. Los `.mp4` NO van a `assets/` del tema.**
`assets/` de Shopify es para "image, CSS and JavaScript files". Los vídeos dan
*"file format is not supported"* de forma intermitente aunque estén bajo el
límite de 20 MB. Se sirven desde Vercel, que se queda igualmente por `/api/pedido`.

## Estado del build (regenerado hoy)

    imágenes y fuentes  30 referencias → 26 archivos a assets/
    vídeos              5 referencias → https://landing-rho-two-62.vercel.app/img/
    endpoint            https://landing-rho-two-62.vercel.app/api/pedido
    templates/page.cuchillo.liquid   83.8 KB
    assets/                          26 archivos · 1261 KB

Despliegue:

    shopify theme push --store TU-TIENDA.myshopify.com --path landing-cuchillo/shopify --nodelete

## Archivos adjuntos

| # | Archivo | Qué es |
|---|---------|--------|
| 1 | `index.html` | La landing original. Autocontenida: 1 `<style>`, 2 `<script>` inline, cero CSS/JS externo |
| 2 | `page.cuchillo.liquid` | El tema ya generado, con el dominio real inyectado |
| 3 | `build-shopify.mjs` | El conversor. Reescribe 33 rutas relativas |
| 4 | `api-pedido.mjs` | Función serverless de Vercel que recibe el pedido |
| 5 | `backend-Codigo.gs.txt` | Google Apps Script: Sheets + notificaciones |

Los assets (26 imágenes y fuentes) no los subo: son binarios y ya están
preparados en `shopify/assets/`.

## Lo que te pido

1. Revisa el `.liquid` y dime si hay algo que rompa dentro de un tema de Shopify.
2. Dime si falta algún archivo del tema (`sections/`, `config/`, `snippets/`).
3. Señala cualquier fallo de conversión que veas comparando `index.html` con el `.liquid`.

No hace falta que reconstruyas el HTML.
