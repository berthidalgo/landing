# 💰 Pedidos, "cha-ching" y panel en soles — sin Shopify

Lo que Shopify te daba (pedido guardado, notificación con sonido de caja, panel de ventas)
montado sobre **Google Sheets + Apps Script**, que es gratis y no tiene servidor que
mantener.

```
Landing  ──POST──▶  /api/pedido  ──POST──▶  Apps Script  ──┬──▶  Google Sheets  (queda guardado)
(el cliente pulsa   (función de              (Web App)     ├──▶  Pushover       (💰 cha-ching)
 "Realizar pedido")  Vercel: guarda                        └──▶  Telegram       (respaldo gratis)
        │            el secreto)
        └──▶ WhatsApp con el pedido ya escrito (el cliente confirma contigo)
```

El registro se manda con `navigator.sendBeacon`, que **sobrevive a la navegación** a
WhatsApp. Si el envío falla, la venta sigue: nunca se bloquea al cliente por un fallo de
registro.

### Por qué hay una función en medio

La landing es HTML público: **cualquier credencial que viva ahí la puede leer cualquiera**
con ver el código fuente. Si el navegador llamara directo a Apps Script, la URL y el token
del receptor estarían a la vista, y un bot podría llenarte la hoja de pedidos falsos —o
agotarte la cuota diaria de Apps Script y dejarte sin registrar los pedidos de verdad.

[`api/pedido.mjs`](../api/pedido.mjs) resuelve eso: el navegador habla con **tu** función,
y solo esa función conoce el destino y el token, guardados en las variables de entorno de
Vercel. Es exactamente el modelo de las apps COD de Shopify (Releasit y compañía): un
servidor en medio que guarda las credenciales. La diferencia es que aquí no cuesta nada.

De paso, la función descarta los campos que no reconoce y **frena a quien intente más de 6
envíos por minuto** desde la misma IP.

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

**En `index.html` no se toca nada**: ya apunta a `/api/pedido`, que es la función que vive
en tu propio dominio.

```js
PEDIDOS: { url: '/api/pedido' },   // ya está así, no hay secretos aquí
```

Lo que sí hay que rellenar son las **variables de entorno de Vercel** (proyecto → Settings →
Environment Variables). Es el único sitio donde vive el secreto:

| Variable | Valor |
|---|---|
| `PEDIDOS_URL` | la URL del despliegue: `https://script.google.com/macros/s/AKfy…/exec` |
| `PEDIDOS_TOKEN` | la misma palabra secreta que pusiste en `TOKEN` del Apps Script |

Márcalas para **Production** (y Preview si quieres probar antes). Después de añadirlas,
**vuelve a desplegar**: Vercel solo las inyecta en despliegues nuevos.

> Si estas dos variables faltan, el pedido no se registra pero **la venta no se rompe**: el
> cliente llega igual a WhatsApp. Lo verás en los *Logs* del proyecto en Vercel.

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

5. Ejecuta la función **`probar`** desde el editor. Recorre el mismo camino que un pedido
   real: escribe una fila marcada `PRUEBA-…` en la hoja **y** suena el cha-ching en tu
   móvil. Bórrala a mano cuando lo hayas comprobado.

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
| **Por cobrar en la puerta** | Lo que el motorizado debe cobrar: el total **menos los adelantos** ya pagados |
| Ticket medio | Si el pack de 2 está funcionando |
| Tasa de entrega / anulación | **La métrica que decide si el negocio aguanta** |

En provincia el cliente adelanta el envío (`CONFIG.ADELANTO_PROVINCIA`) y paga el resto al
recoger. Ese importe queda en la columna **Adelanto S/**, y por eso "pendiente por entregar"
y "por cobrar en la puerta" no son el mismo número: cobrar de más en la puerta es un reclamo.

### Por qué "pedidos" y "cobrado" están separados

En contraentrega **un pedido no es una venta**. Una parte de la gente no está en casa, se
arrepiente o no contesta. Si mides tu ROAS contra los pedidos, estás midiendo humo.

Por eso la columna **Estado** es un desplegable —`PENDIENTE · CONFIRMADO · ENTREGADO ·
ANULADO`— y el panel solo suma como cobrado lo que está en `ENTREGADO`. Actualízala a
medida que el courier te confirma. Es literalmente el número que te dirá cuánto puedes
pagar por cada conversación de WhatsApp.

## 5 · Quién le escribe a quién (importante)

Hay **dos mensajes distintos** y conviene no confundirlos:

| | Quién lo manda | Cómo |
|---|---|---|
| **1. El pedido** | **El cliente → tú** | `wa.me` le abre WhatsApp con el mensaje ya escrito. Solo pulsa enviar |
| **2. La confirmación** | **Tú → el cliente** | Mensaje de bienvenida de WhatsApp Business, o Cloud API |

**Una página web no puede escribirle al cliente.** Solo el titular de un WhatsApp puede
iniciar una conversación; por eso el enlace `wa.me` apunta a *tu* número. Es correcto: el
cliente escribe, tú recibes el pedido con su número y ya puedes responderle.

Es exactamente lo que hace Kenku: el cliente manda *"quiero confirmar mi pedido #KP127434"*
y a los segundos les responde *"Te saluda Frankz de Kenku…"*.

Para el mensaje 2 tienes dos opciones:

### Opción A — Mensaje de bienvenida (gratis, 2 minutos)

La de abajo. Se dispara solo cuando el cliente te escribe por primera vez. **Es la que
recomiendo para empezar.**

### Opción B — Cloud API (automático, sin esperar a que escriba)

Si tienes WhatsApp Business Platform, el script le escribe **en cuanto entra el pedido**,
aunque el cliente no llegue a pulsar enviar — recuperas los que abandonan en ese paso.

Meta obliga a usar una **plantilla aprobada** para iniciar conversación. Crea una en
*Administrador de WhatsApp → Plantillas*, categoría **Utilidad**, con tres variables:

> ¡Hola {{1}}! 👋 Recibimos tu pedido **#{{2}}** por **{{3}}**.
> Para coordinar la entrega, ¿me compartes tu ubicación? 📍
> Recuerda: pagas recién cuando lo recibes.

Y añade a las Propiedades del script:

| Propiedad | Valor |
|---|---|
| `WA_TOKEN` | Token permanente de la app de Meta |
| `WA_PHONE_ID` | Phone Number ID del número |
| `WA_TEMPLATE` | El nombre exacto de la plantilla aprobada |

Si esas tres están vacías, el envío se salta sin romper nada.

## 6 · La respuesta automática de WhatsApp (no te la saltes)

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

## 7 · Comprobar que funciona

Sin salir del repo, y sin desplegar nada:

```bash
node landing-cuchillo/test/probar-backend.js   # el receptor, con Google simulado
node landing-cuchillo/test/probar-api.mjs      # la función intermediaria
```

El primero comprueba lo que no se ve hasta que hay varios pedidos a la vez: que dos clientes
distintos no se pisen la fila, que la ampliación por upsell actualice en vez de duplicar, que
el adelanto quede guardado y que las suscripciones no ensucien los pedidos.

El segundo comprueba que el token nunca salga del servidor, que un token enviado desde fuera
se descarte, que el spam se frene y —lo más importante— que **si Apps Script está caído el
cliente no vea ningún error** y siga su camino a WhatsApp.

Y el circuito completo, ya con la hoja montada:

1. Abre la landing, rellena el formulario y pulsa **Realizar pedido**.
2. Debe pasar todo esto:
   - suena el cha-ching en tu móvil,
   - aparece una fila nueva en la pestaña *Pedidos*,
   - se abre WhatsApp con el pedido escrito.

Si no aparece la fila: abre el editor de Apps Script → **Ejecuciones**, ahí se ve el error.
La causa más común es haber dejado el acceso en "Solo yo" al implementar.

## 8 · Las dos hojas

| Pestaña | Qué guarda |
|---|---|
| **Pedidos** | Un pedido por fila. La columna *Estado* es la que tú actualizas |
| **Suscriptores** | Los correos del formulario del pie. Se crea sola con la primera suscripción |

---

## Qué NO hace esto (y cuándo cambiarlo)

No hay control de stock, ni facturación, ni recuperación de carritos abandonados. Para
validar un producto sobra; si el volumen pasa de unos ~30 pedidos al día, la hoja se queda
corta y toca mover esto al panel FastAPI de [`plataforma/`](../../plataforma/), que ya
está desplegado y puede leer la misma hoja.
