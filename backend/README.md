# 💰 Pedidos, "cha-ching" y panel en soles — sin Shopify

Lo que Shopify te daba (pedido guardado, notificación con sonido de caja, panel de ventas)
montado sobre **Google Sheets + Apps Script**, que es gratis y no tiene servidor que
mantener.

```
Landing  ──POST──▶  Apps Script  ──┬──▶  Google Sheets   (el pedido queda guardado)
(el cliente pulsa   (Web App)      ├──▶  Pushover        (💰 cha-ching en tu móvil)
 "Realizar pedido")                └──▶  Telegram        (respaldo gratis)
        │
        └──▶ WhatsApp con el pedido ya escrito (el cliente confirma contigo)
```

El registro se manda con `navigator.sendBeacon`, que **sobrevive a la navegación** a
WhatsApp. Si el envío falla, la venta sigue: nunca se bloquea al cliente por un fallo de
registro.

---

## 1 · La hoja de cálculo (5 minutos)

1. Crea una hoja nueva en [sheets.new](https://sheets.new) y llámala `Pedidos YUNQUE`.
2. **Extensiones → Apps Script**. Borra lo que haya y pega [`Codigo.gs`](Codigo.gs).
3. En el editor, ⚙ **Configuración del proyecto → Propiedades del script**, añade:

   | Propiedad | Valor |
   |---|---|
   | `TOKEN` | una palabra secreta que inventes (la misma irá en la landing) |

4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario** ← imprescindible, si no la landing no puede escribir
5. Copia la **URL del despliegue** (`https://script.google.com/macros/s/…/exec`).
6. En el editor, ejecuta la función **`crearPanel`** una vez. Te crea la pestaña *Panel*.

> ⚠️ Cada vez que edites el código tienes que hacer **Implementar → Gestionar
> implementaciones → editar → Versión: Nueva**. Si no, sigue corriendo la versión vieja.

## 2 · Conectar la landing

En `index.html`, dentro de `window.CONFIG`:

```js
PEDIDOS: {
  url:   'https://script.google.com/macros/s/AKfy…/exec',
  token: 'la-misma-palabra-secreta'
},
```

## 3 · El "cha-ching" 💰

### Opción recomendada — Pushover

Es la única con un sonido de caja registradora **nativo** (`cashregister`), que es
exactamente el de Shopify. Cuesta **5 USD una vez por plataforma** (Android/iOS), sin
suscripción.

1. Crea cuenta en [pushover.net](https://pushover.net) e instala la app en tu móvil.
2. Copia tu **User Key** del panel.
3. **Create an Application** → copia el **API Token**.
4. Añádelos a las Propiedades del script:

   | Propiedad | Valor |
   |---|---|
   | `PUSHOVER_USER` | tu User Key |
   | `PUSHOVER_TOKEN` | el API Token de la aplicación |

5. Ejecuta la función **`probar`** desde el editor. Debe sonar el cha-ching en tu móvil.

El sonido ya viene forzado desde el código (`sound: 'cashregister'`), así que no hace
falta tocar nada en la app.

### Opción gratis — Telegram

Sin coste, pero el sonido es el genérico de Telegram salvo que le pongas uno propio al
chat (Android permite sonido personalizado por conversación; iOS también, en los ajustes
de notificación del chat).

1. Escribe a [@BotFather](https://t.me/BotFather) → `/newbot` → copia el token.
2. Escríbele algo a tu bot, luego abre
   `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia tu `chat.id`.
3. Añade `TELEGRAM_TOKEN` y `TELEGRAM_CHAT` a las Propiedades del script.

Puedes tener las dos activas a la vez: si ambas están configuradas, se envían las dos.

## 4 · El panel de ventas

La pestaña **Panel** te da, en soles:

| Métrica | Qué responde |
|---|---|
| Pedidos hoy / Soles pedidos hoy | El pulso del día, comparable con tu gasto en ads |
| Pedidos y soles del mes | El acumulado |
| **COBRADO de verdad (entregados)** | El dinero que existe |
| Pendientes por entregar | Lo que está en la calle |
| Ticket medio | Si el pack de 2 está funcionando |
| Tasa de entrega / anulación | **La métrica que decide si el negocio aguanta** |

### Por qué "pedidos" y "cobrado" están separados

En contraentrega **un pedido no es una venta**. Una parte de la gente no está en casa, se
arrepiente o no contesta. Si mides tu ROAS contra los pedidos, estás midiendo humo.

Por eso la columna **Estado** es un desplegable —`PENDIENTE · CONFIRMADO · ENTREGADO ·
ANULADO`— y el panel solo suma como cobrado lo que está en `ENTREGADO`. Actualízala a
medida que el courier te confirma. Es literalmente el número que te dirá cuánto puedes
pagar por cada conversación de WhatsApp.

## 5 · La respuesta automática de WhatsApp (no te la saltes)

Cuando el cliente te escribe, tu primer mensaje decide si el pedido llega o se pierde.
Kenku responde en segundos y **no intenta vender nada: pide la ubicación**. Es la jugada
más rentable de todo su embudo, porque la entrega fallida es el mayor coste oculto del
contraentrega.

Configúralo como mensaje de bienvenida en **WhatsApp Business → Herramientas → Mensaje de
bienvenida**:

```
¡Hola! 👋
Te saluda [TU NOMBRE] de YUNQUE. Recibimos tu pedido y ya lo estamos preparando.

Para coordinar la entrega necesito confirmar una cosa:
📍 Compárteme tu ubicación por WhatsApp (clip → Ubicación).

Con eso el repartidor llega sin llamarte y sin vueltas.
Recuerda: pagas al recibir, nada por adelantado.
```

Tres cosas que hace este mensaje: confirma que el pedido existe (baja la ansiedad),
**pide una sola acción concreta**, y repite que no paga nada ahora.

> Kenku firma con un nombre de persona ("Te saluda Frankz de Kenku") aunque el mensaje sea
> automático. Cuesta cero y baja la sensación de bot: hazlo igual.

**Y un aviso, aprendido de su error:** su mensaje automático llegó con un
`insert here district name` sin sustituir, a un cliente real. Si usas variables en la
plantilla, **haz un pedido de prueba tú mismo y léelo entero** antes de gastar en tráfico.

## 6 · Comprobar que funciona

1. Abre la landing, rellena el formulario y pulsa **Realizar pedido**.
2. Debe pasar todo esto:
   - suena el cha-ching en tu móvil,
   - aparece una fila nueva en la pestaña *Pedidos*,
   - se abre WhatsApp con el pedido escrito.

Si no aparece la fila: abre el editor de Apps Script → **Ejecuciones**, ahí se ve el error.
La causa más común es haber dejado el acceso en "Solo yo" al implementar.

---

## Qué NO hace esto (y cuándo cambiarlo)

No hay control de stock, ni facturación, ni recuperación de carritos abandonados. Para
validar un producto sobra; si el volumen pasa de unos ~30 pedidos al día, la hoja se queda
corta y toca mover esto al panel FastAPI de [`plataforma/`](../../plataforma/), que ya
está desplegado y puede leer la misma hoja.
