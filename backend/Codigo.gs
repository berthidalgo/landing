/**
 * ══════════════════════════════════════════════════════════════════
 *  RECEPTOR DE PEDIDOS · landing → Google Sheets → "cha-ching"
 * ══════════════════════════════════════════════════════════════════
 *
 *  Esto sustituye a Shopify: la landing envía el pedido aquí, este script
 *  lo escribe en la hoja y te manda una notificación al móvil con sonido
 *  de caja registradora.
 *
 *  Se pega en Extensiones → Apps Script de una hoja de cálculo nueva.
 *  Instrucciones completas: backend/README.md
 */

// ─── Configuración ─────────────────────────────────────────────────
// Se leen de Propiedades del script (Configuración ⚙ → Propiedades del script),
// no se escriben aquí: así el token no acaba en el repo.
const P = PropertiesService.getScriptProperties();

const HOJA           = 'Pedidos';
const TOKEN          = P.getProperty('TOKEN');            // secreto compartido con la landing
const PUSHOVER_USER  = P.getProperty('PUSHOVER_USER');    // opcional
const PUSHOVER_TOKEN = P.getProperty('PUSHOVER_TOKEN');   // opcional
const TELEGRAM_TOKEN = P.getProperty('TELEGRAM_TOKEN');   // opcional
const TELEGRAM_CHAT  = P.getProperty('TELEGRAM_CHAT');    // opcional

// WhatsApp Business Cloud API — para escribirle TÚ al cliente (opcional).
// Sin esto, el cliente te escribe a ti y tú respondes con el mensaje de
// bienvenida de WhatsApp Business. Ver README, sección 5.
const WA_TOKEN   = P.getProperty('WA_TOKEN');       // token permanente de Meta
const WA_PHONE   = P.getProperty('WA_PHONE_ID');    // Phone Number ID
const WA_PLANTILLA = P.getProperty('WA_TEMPLATE');  // nombre de la plantilla aprobada
const MARCA = P.getProperty('MARCA') || 'nuestra tienda';

const COLUMNAS = ['Fecha', 'Pedido', 'Estado', 'Nombre', 'Celular', 'Departamento', 'Ciudad',
                  'Dirección', 'Referencia', 'Pack', 'Unidades', 'Adicional',
                  'Total S/', 'Adelanto S/', 'Origen', 'Campaña', 'Dispositivo'];

const COL_PEDIDO  = 2;   // B
const COL_CELULAR = 5;   // E
const COL_TOTAL   = 13;  // M
const COL_ADELANTO = 14; // N

// ─── Entrada HTTP ──────────────────────────────────────────────────

/** Prueba rápida: abre la URL del despliegue en el navegador. */
function doGet() {
  return json({ ok: true, mensaje: 'Receptor de pedidos activo' });
}

/**
 * La landing envía Content-Type: text/plain a propósito.
 * Con application/json el navegador manda un preflight OPTIONS que las
 * Web Apps de Apps Script no responden, y el pedido se pierde.
 */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    if (TOKEN && d.token !== TOKEN) {
      return json({ ok: false, error: 'token inválido' });
    }

    // Las suscripciones del pie no son pedidos: van a su propia hoja y no
    // suenan. Mezclarlas aquí las hacía colapsar todas en una sola fila.
    if (d.tipo === 'suscripcion') {
      hojaSuscriptores().appendRow([new Date(), d.correo || '', d.origen || 'directo']);
      return json({ ok: true, suscripcion: true });
    }

    const hoja = hojaPedidos();
    const fila = [
      new Date(),
      d.pedido || '',
      'PENDIENTE',
      d.nombre || '', d.celular || '', d.departamento || '', d.ciudad || '',
      d.direccion || '', d.referencia || '',
      d.pack || '', Number(d.unidades) || 0, d.adicional || '',
      Number(d.total) || 0, Number(d.adelanto) || 0,
      d.origen || 'directo', d.campana || '', d.dispositivo || ''
    ];

    // Si el cliente acepta el upsell posterior, el mismo pedido vuelve a
    // llegar con más importe: se actualiza la fila, no se duplica.
    const existente = buscarFila(hoja, d.pedido, d.celular);
    if (existente) {
      // Se respetan el estado y la hora del pedido original: la ampliación
      // llega segundos después, pero la venta se hizo antes.
      const previo = hoja.getRange(existente, 1, 1, 3).getValues()[0];
      fila[0] = previo[0] || fila[0];
      fila[2] = previo[2] || 'PENDIENTE';
      hoja.getRange(existente, 1, 1, COLUMNAS.length).setValues([fila]);
      notificar(d, true);
      return json({ ok: true, pedido: d.pedido, actualizado: true });
    }

    hoja.appendRow(fila);
    notificar(d, false);
    avisarAlCliente(d);          // solo si hay Cloud API configurada
    return json({ ok: true, pedido: d.pedido });

  } catch (err) {
    // Un fallo aquí no puede romper la venta: la landing sigue a WhatsApp igual.
    console.error(err);
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Hoja ──────────────────────────────────────────────────────────

function hojaPedidos() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length)
      .setFontWeight('bold').setBackground('#17130F').setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    hoja.getRange('M:N').setNumberFormat('S/ #,##0.00');
    // Estado como desplegable, para que el panel cuadre siempre.
    hoja.getRange('C2:C')
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'ANULADO'], true)
        .build());
  }
  return hoja;
}

function hojaSuscriptores() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName('Suscriptores');
  if (!hoja) {
    hoja = libro.insertSheet('Suscriptores');
    hoja.appendRow(['Fecha', 'Correo', 'Origen']);
    hoja.getRange(1, 1, 1, 3)
      .setFontWeight('bold').setBackground('#17130F').setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  return hoja;
}

// ─── Notificación con sonido de caja ───────────────────────────────

/** Últimos 9 dígitos de un celular, para comparar sin importar el formato. */
function soloDigitos(v) {
  return String(v == null ? '' : v).replace(/\D/g, '').slice(-9);
}

/**
 * Devuelve el número de fila de un pedido ya registrado, o 0.
 *
 * Se compara el celular además del número: el número lo genera el navegador y
 * dos clientes distintos pueden coincidir. Sin esta comprobación, el segundo
 * pedido sobrescribiría la fila del primero y esa venta desaparecería.
 */
function buscarFila(hoja, numeroPedido, celular) {
  if (!numeroPedido) return 0;
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const ancho = COL_CELULAR - COL_PEDIDO + 1;
  const valores = hoja.getRange(2, COL_PEDIDO, ultima - 1, ancho).getValues();
  const cel = soloDigitos(celular);
  for (let i = valores.length - 1; i >= 0; i--) {          // de abajo arriba: los recientes primero
    if (String(valores[i][0]) !== String(numeroPedido)) continue;
    if (cel && soloDigitos(valores[i][ancho - 1]) !== cel) continue;   // mismo número, otro cliente
    return i + 2;
  }
  return 0;
}

function notificar(d, esAmpliacion) {
  const titulo = (esAmpliacion ? '⬆️ Pedido ampliado #' : '💰 Pedido #') +
                 (d.pedido || '') + ' · S/ ' + (Number(d.total) || 0);
  const cuerpo = [
    d.pack + (d.adicional ? ' + ' + d.adicional : ''),
    d.nombre + ' · ' + d.celular,
    d.ciudad + ', ' + d.departamento,
    d.direccion,
    d.origen ? 'Origen: ' + d.origen : ''
  ].filter(String).join('\n');

  // Pushover trae un sonido nativo llamado "cashregister": es el cha-ching.
  if (PUSHOVER_USER && PUSHOVER_TOKEN) {
    try {
      UrlFetchApp.fetch('https://api.pushover.net/1/messages.json', {
        method: 'post',
        payload: {
          token: PUSHOVER_TOKEN,
          user: PUSHOVER_USER,
          title: titulo,
          message: cuerpo,
          sound: 'cashregister',
          priority: '1'
        },
        muteHttpExceptions: true
      });
    } catch (err) { console.error('Pushover: ' + err); }
  }

  // Telegram como respaldo gratuito (el sonido se elige en el propio chat).
  if (TELEGRAM_TOKEN && TELEGRAM_CHAT) {
    try {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage', {
        method: 'post',
        payload: { chat_id: TELEGRAM_CHAT, text: titulo + '\n\n' + cuerpo },
        muteHttpExceptions: true
      });
    } catch (err) { console.error('Telegram: ' + err); }
  }
}

// ─── Escribirle al cliente (WhatsApp Cloud API) ────────────────────
//
// Meta solo deja iniciar una conversación con una PLANTILLA aprobada.
// Si no tienes Cloud API, deja estas propiedades vacías: el cliente te
// escribe primero y tu mensaje de bienvenida hace el mismo trabajo.

function avisarAlCliente(d) {
  if (!WA_TOKEN || !WA_PHONE || !WA_PLANTILLA) return;
  if (!d.celular) return;

  // Perú: 9 dígitos + prefijo 51. Se limpia por si llega con espacios.
  const numero = '51' + String(d.celular).replace(/\D/g, '').slice(-9);

  try {
    const respuesta = UrlFetchApp.fetch(
      'https://graph.facebook.com/v21.0/' + WA_PHONE + '/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + WA_TOKEN },
      payload: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: WA_PLANTILLA,
          language: { code: 'es' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: String(d.nombre || 'hola').split(' ')[0] },
              { type: 'text', text: String(d.pedido || '') },
              { type: 'text', text: 'S/ ' + (Number(d.total) || 0) }
            ]
          }]
        }
      }),
      muteHttpExceptions: true
    });
    const codigo = respuesta.getResponseCode();
    if (codigo >= 300) console.error('WhatsApp API ' + codigo + ': ' + respuesta.getContentText());
  } catch (err) {
    console.error('WhatsApp API: ' + err);   // nunca debe romper el pedido
  }
}

// ─── Panel de ventas en soles ──────────────────────────────────────
// Ejecuta esta función UNA vez desde el editor para crear la pestaña.

function crearPanel() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  hojaPedidos();
  let p = libro.getSheetByName('Panel');
  if (p) libro.deleteSheet(p);
  p = libro.insertSheet('Panel', 0);

  const F = "'" + HOJA + "'!";
  // Contraentrega: lo pedido no es lo cobrado. Por eso se separan las dos cifras.
  const filas = [
    ['PANEL DE VENTAS', ''],
    ['', ''],
    ['Pedidos hoy',            `=COUNTIFS(${F}A:A,">="&TODAY(),${F}A:A,"<"&TODAY()+1)`],
    ['Soles pedidos hoy',      `=SUMIFS(${F}M:M,${F}A:A,">="&TODAY(),${F}A:A,"<"&TODAY()+1)`],
    ['', ''],
    ['Pedidos este mes',       `=COUNTIFS(${F}A:A,">="&EOMONTH(TODAY(),-1)+1)`],
    ['Soles pedidos este mes', `=SUMIFS(${F}M:M,${F}A:A,">="&EOMONTH(TODAY(),-1)+1)`],
    ['', ''],
    ['COBRADO de verdad (entregados)', `=SUMIF(${F}C:C,"ENTREGADO",${F}M:M)`],
    ['Pendientes por entregar',        `=SUMIFS(${F}M:M,${F}C:C,"<>ENTREGADO",${F}C:C,"<>ANULADO")`],
    // Lo que el motorizado debe cobrar en la puerta: el total menos lo ya adelantado.
    ['Por cobrar en la puerta',
      `=SUMIFS(${F}M:M,${F}C:C,"<>ENTREGADO",${F}C:C,"<>ANULADO")` +
      `-SUMIFS(${F}N:N,${F}C:C,"<>ENTREGADO",${F}C:C,"<>ANULADO")`],
    ['', ''],
    ['Ticket medio',   `=IFERROR(ROUND(AVERAGE(${F}M2:M),2),0)`],
    ['Unidades vendidas', `=SUMIF(${F}C:C,"ENTREGADO",${F}K:K)`],
    ['', ''],
    ['Tasa de entrega',   `=IFERROR(COUNTIF(${F}C:C,"ENTREGADO")/COUNTA(${F}C2:C),0)`],
    ['Tasa de anulación', `=IFERROR(COUNTIF(${F}C:C,"ANULADO")/COUNTA(${F}C2:C),0)`]
  ];
  p.getRange(1, 1, filas.length, 2).setValues(filas);

  // Los formatos se anclan a la etiqueta, no al número de fila: así insertar
  // una métrica nueva no descuadra el formato de todas las de abajo.
  const filaDe = (etiqueta) => filas.findIndex((f) => f[0] === etiqueta) + 1;

  p.getRange('A1').setFontSize(18).setFontWeight('bold');
  p.getRange(3, 1, filas.length - 2, 1).setFontWeight('bold');
  ['Soles pedidos hoy', 'Soles pedidos este mes', 'COBRADO de verdad (entregados)',
   'Pendientes por entregar', 'Por cobrar en la puerta', 'Ticket medio']
    .forEach((e) => p.getRange(filaDe(e), 2).setNumberFormat('S/ #,##0.00'));
  ['Tasa de entrega', 'Tasa de anulación']
    .forEach((e) => p.getRange(filaDe(e), 2).setNumberFormat('0.0%'));
  p.getRange(filaDe('COBRADO de verdad (entregados)'), 1, 1, 2).setBackground('#E8F5EC');
  p.setColumnWidth(1, 260);
  p.setColumnWidth(2, 150);
}

/**
 * Prueba de extremo a extremo sin tocar la landing: recorre el mismo camino
 * que un pedido real (escribe la fila y dispara el cha-ching).
 * Deja una fila marcada PRUEBA en la hoja — bórrala luego a mano.
 */
function probar() {
  const respuesta = doPost({ postData: { contents: JSON.stringify({
    token: TOKEN,
    pedido: 'PRUEBA-' + Math.floor(Math.random() * 10000),
    nombre: 'Pedido de prueba', celular: '987654321',
    departamento: 'Lima', ciudad: 'Los Olivos',
    direccion: 'Av. Prueba 123', referencia: 'Portón azul',
    pack: '2 unidades', unidades: 2, adicional: '',
    total: 89, adelanto: 0,
    origen: 'prueba manual', dispositivo: 'editor de Apps Script'
  }) } });
  console.log(respuesta.getContent());
}
