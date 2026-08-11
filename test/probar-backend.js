#!/usr/bin/env node
/**
 * Ejercita backend/Codigo.gs en Node con las APIs de Apps Script simuladas.
 *
 * Cubre lo que no se ve hasta que hay varios pedidos a la vez: que dos clientes
 * distintos no se pisen la fila, que la ampliación por upsell actualice en vez
 * de duplicar, y que el adelanto de provincia quede guardado.
 *
 *   node landing-cuchillo/test/probar-backend.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RUTA = path.join(__dirname, '..', 'backend', 'Codigo.gs');

function crearHoja(nombre) {
  const datos = [];
  const letra = (n) => String.fromCharCode(64 + n);
  const hoja = {
    nombre,
    datos,
    appendRow: (fila) => datos.push(fila.slice()),
    getLastRow: () => datos.length,
    setFrozenRows: () => hoja,
    setColumnWidth: () => hoja,
    getRange(a, b, c, d) {
      // getRange('A:A') o getRange(fila, col, nFilas, nCols)
      if (typeof a === 'string') {
        const nulo = {};
        for (const m of ['setNumberFormat', 'setDataValidation', 'setFontWeight',
                         'setBackground', 'setFontColor', 'setFontSize'])
          nulo[m] = () => nulo;
        return nulo;
      }
      const fila = a, col = b, nf = c || 1, nc = d || 1;
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nf; i++) {
            const f = datos[fila - 1 + i] || [];
            out.push(f.slice(col - 1, col - 1 + nc));
          }
          return out;
        },
        getValue() { return this.getValues()[0][0]; },
        setValues: (vals) => {
          for (let i = 0; i < vals.length; i++) {
            const f = datos[fila - 1 + i] || (datos[fila - 1 + i] = []);
            for (let j = 0; j < vals[i].length; j++) f[col - 1 + j] = vals[i][j];
          }
        },
        setValue(v) { this.setValues([[v]]); },
        setNumberFormat: () => {}, setBackground() { return this; },
        setFontWeight() { return this; }, setFontColor() { return this; },
        setFontSize() { return this; }, setDataValidation: () => {}
      };
    }
  };
  return hoja;
}

const hojas = {};
const libro = {
  getSheetByName: (n) => hojas[n] || null,
  insertSheet: (n) => (hojas[n] = crearHoja(n)),
  deleteSheet: (h) => { delete hojas[h.nombre]; }
};

const contexto = {
  console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => libro,
    newDataValidation: () => ({ requireValueInList: () => ({ build: () => ({}) }) })
  },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (t) => ({ setMimeType: () => ({ getContent: () => t }) })
  },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) }
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(RUTA, 'utf8'), contexto);

const post = (obj) =>
  JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());

const base = {
  departamento: 'Lima', ciudad: 'Los Olivos', direccion: 'Av. Prueba 123',
  referencia: '', pack: '2 unidades', unidades: 2, adicional: '',
  total: 89, adelanto: 0, origen: 'meta', campana: 'c1', dispositivo: 'iPhone'
};

let fallos = 0;
const comprobar = (que, cond) => {
  console.log(`${cond ? 'PASA ' : 'FALLA'} :: ${que}`);
  if (!cond) fallos++;
};

// 1 · Dos clientes distintos con el MISMO número de pedido
post({ ...base, pedido: 5001, nombre: 'Ana',  celular: '987654321' });
post({ ...base, pedido: 5001, nombre: 'Beto', celular: '912345678', total: 69 });
const pedidos = hojas['Pedidos'].datos.slice(1);
comprobar('dos clientes con el mismo número generan DOS filas', pedidos.length === 2);
comprobar('no se pierde el pedido de Ana', pedidos.some((f) => f[3] === 'Ana'));

// 2 · El mismo cliente amplía su pedido (upsell)
post({ ...base, pedido: 5001, nombre: 'Ana', celular: '987654321',
       total: 118, adicional: 'Piedra afiladora' });
const filas2 = hojas['Pedidos'].datos.slice(1);
comprobar('la ampliación actualiza, no duplica', filas2.length === 2);
const ana = filas2.find((f) => f[3] === 'Ana');
comprobar('el total de Ana se actualizó a 118', ana[12] === 118);
comprobar('el adicional quedó registrado', ana[11] === 'Piedra afiladora');

// 3 · El celular con otro formato sigue siendo el mismo cliente
post({ ...base, pedido: 5001, nombre: 'Ana', celular: '+51 987 654 321', total: 150 });
comprobar('el celular con espacios/prefijo no crea fila nueva',
  hojas['Pedidos'].datos.slice(1).length === 2);

// 4 · El adelanto de provincia se guarda
post({ ...base, pedido: 6001, nombre: 'Carla', celular: '911111111',
       departamento: 'Arequipa', total: 89, adelanto: 20 });
const carla = hojas['Pedidos'].datos.slice(1).find((f) => f[3] === 'Carla');
comprobar('el adelanto se guarda en la columna N', carla[13] === 20);
comprobar('el estado por defecto es PENDIENTE', carla[2] === 'PENDIENTE');

// 5 · Las suscripciones no ensucian los pedidos
post({ tipo: 'suscripcion', correo: 'uno@correo.com', origen: 'directo' });
post({ tipo: 'suscripcion', correo: 'dos@correo.com', origen: 'directo' });
comprobar('las suscripciones van a su propia hoja',
  hojas['Suscriptores'] && hojas['Suscriptores'].datos.length === 3);
comprobar('dos suscripciones NO se sobrescriben',
  hojas['Suscriptores'].datos.slice(1).length === 2);
comprobar('los pedidos no crecen con las suscripciones',
  hojas['Pedidos'].datos.slice(1).length === 3);

// 6 · Las cabeceras cuadran con las filas
comprobar('la cabecera tiene tantas columnas como los datos',
  hojas['Pedidos'].datos[0].length === hojas['Pedidos'].datos[1].length);

// 7 · El panel se construye sin romperse
contexto.crearPanel();
const panel = hojas['Panel'].datos;
comprobar('el panel incluye "Por cobrar en la puerta"',
  panel.some((f) => f[0] === 'Por cobrar en la puerta'));

console.log(`\n${fallos === 0 ? 'OK — backend verificado' : fallos + ' fallo(s)'}`);
process.exit(fallos === 0 ? 0 : 1);
