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

const COLUMNAS = ['Fecha', 'Pedido', 'Estado', 'Nombre', 'Celular', 'Departamento', 'Ciudad',
                  'Dirección', 'Referencia', 'Pack', 'Unidades', 'Adicional',
                  'Total S/', 'Origen', 'Campaña', 'Dispositivo'];

const COL_PEDIDO = 2;   // B
const COL_TOTAL  = 13;  // M

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

    const hoja = hojaPedidos();
    const fila = [
      new Date(),
      d.pedido || '',
      'PENDIENTE',
      d.nombre || '', d.celular || '', d.departamento || '', d.ciudad || '',
      d.direccion || '', d.referencia || '',
      d.pack || '', Number(d.unidades) || 0, d.adicional || '',
      Number(d.total) || 0,
      d.origen || 'directo', d.campana || '', d.dispositivo || ''
    ];

    // Si el cliente acepta el upsell posterior, el mismo pedido vuelve a
    // llegar con más importe: se actualiza la fila, no se duplica.
    const existente = buscarFila(hoja, d.pedido);
    if (existente) {
      const estado = hoja.getRange(existente, 3).getValue();   // se respeta el estado
      hoja.getRange(existente, 1, 1, COLUMNAS.length).setValues([fila]);
      hoja.getRange(existente, 3).setValue(estado || 'PENDIENTE');
      notificar(d, true);
      return json({ ok: true, pedido: d.pedido, actualizado: true });
    }

    hoja.appendRow(fila);
    notificar(d, false);
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
    hoja.getRange('M:M').setNumberFormat('S/ #,##0.00');
    // Estado como desplegable, para que el panel cuadre siempre.
    hoja.getRange('C2:C')
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'ANULADO'], true)
        .build());
  }
  return hoja;
}

// ─── Notificación con sonido de caja ───────────────────────────────

/** Devuelve el número de fila de un pedido ya registrado, o 0. */
function buscarFila(hoja, numeroPedido) {
  if (!numeroPedido) return 0;
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const valores = hoja.getRange(2, COL_PEDIDO, ultima - 1, 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) {          // de abajo arriba: los recientes primero
    if (String(valores[i][0]) === String(numeroPedido)) return i + 2;
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
    ['', ''],
    ['Ticket medio',   `=IFERROR(ROUND(AVERAGE(${F}M2:M),2),0)`],
    ['Unidades vendidas', `=SUMIF(${F}C:C,"ENTREGADO",${F}K:K)`],
    ['', ''],
    ['Tasa de entrega',   `=IFERROR(COUNTIF(${F}C:C,"ENTREGADO")/COUNTA(${F}C2:C),0)`],
    ['Tasa de anulación', `=IFERROR(COUNTIF(${F}C:C,"ANULADO")/COUNTA(${F}C2:C),0)`]
  ];
  p.getRange(1, 1, filas.length, 2).setValues(filas);

  p.getRange('A1').setFontSize(18).setFontWeight('bold');
  p.getRange('A3:A16').setFontWeight('bold');
  p.getRange('B4').setNumberFormat('S/ #,##0.00');
  p.getRange('B7').setNumberFormat('S/ #,##0.00');
  p.getRange('B9:B10').setNumberFormat('S/ #,##0.00');
  p.getRange('B12').setNumberFormat('S/ #,##0.00');
  p.getRange('B15:B16').setNumberFormat('0.0%');
  p.getRange('A9:B9').setBackground('#E8F5EC');
  p.setColumnWidth(1, 260);
  p.setColumnWidth(2, 150);
}

/** Prueba de extremo a extremo sin tocar la landing. */
function probar() {
  notificar({
    pedido: 1041, total: 89, pack: '2 unidades', nombre: 'Prueba Prueba',
    celular: '987654321', ciudad: 'Los Olivos', departamento: 'Lima',
    direccion: 'Av. Prueba 123', origen: 'prueba manual'
  }, false);
}
