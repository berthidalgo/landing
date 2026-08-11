#!/usr/bin/env node
/**
 * Prueba la función intermediaria api/pedido.mjs sin desplegar nada.
 *
 * Lo que importa comprobar aquí: que el token NUNCA salga del servidor, que
 * un pedido válido llegue completo a Apps Script, y que la venta del cliente
 * no se rompa aunque el receptor esté caído.
 *
 *   node landing-cuchillo/test/probar-api.mjs
 */
import handler from '../api/pedido.mjs';

process.env.PEDIDOS_URL = 'https://script.google.com/macros/s/PRUEBA/exec';
process.env.PEDIDOS_TOKEN = 'secreto-del-servidor';

let enviado = null;
let simular = 'ok';
globalThis.fetch = async (url, opciones) => {
  enviado = { url, cuerpo: JSON.parse(opciones.body) };
  if (simular === 'caido') throw new Error('red caída');
  if (simular === 'error') return { ok: false, status: 500, text: async () => 'boom' };
  return { ok: true, status: 200, text: async () => '{"ok":true}' };
};

const respuestaFalsa = () => {
  const r = { codigo: 0, cuerpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (o) => { r.cuerpo = o; return r; };
  return r;
};

const llamar = async (cuerpo, metodo = 'POST', ip = '1.2.3.4') => {
  const res = respuestaFalsa();
  await handler({ method: metodo, headers: { 'x-forwarded-for': ip }, body: cuerpo }, res);
  return res;
};

const PEDIDO = {
  pedido: 7001, nombre: 'Ana', celular: '987654321',
  departamento: 'Lima', ciudad: 'Los Olivos', direccion: 'Av. Prueba 123',
  pack: '2 unidades', unidades: 2, total: 89, adelanto: 0, origen: 'meta'
};

let fallos = 0;
const comprobar = (que, cond) => {
  console.log(`${cond ? 'PASA ' : 'FALLA'} :: ${que}`);
  if (!cond) fallos++;
};

// 1 · Un pedido normal llega entero, con el token puesto por el servidor
let res = await llamar(JSON.stringify(PEDIDO));
comprobar('el pedido se acepta', res.codigo === 200);
comprobar('se reenvía a Apps Script', enviado.url === process.env.PEDIDOS_URL);
comprobar('el token lo pone el servidor', enviado.cuerpo.token === 'secreto-del-servidor');
comprobar('los datos del cliente llegan completos',
  enviado.cuerpo.nombre === 'Ana' && enviado.cuerpo.total === 89 &&
  enviado.cuerpo.direccion === 'Av. Prueba 123');

// 2 · Nada que venga de fuera se reenvía tal cual
enviado = null;
await llamar(JSON.stringify({ ...PEDIDO, token: 'intento-de-inyección', admin: true }));
comprobar('un token enviado por el cliente se descarta',
  enviado.cuerpo.token === 'secreto-del-servidor');
comprobar('los campos desconocidos no pasan', enviado.cuerpo.admin === undefined);

// 3 · Entradas inválidas
comprobar('rechaza GET', (await llamar(null, 'GET')).codigo === 405);
comprobar('rechaza un cuerpo que no es JSON', (await llamar('{roto')).codigo === 400);
comprobar('rechaza un pedido sin número',
  (await llamar(JSON.stringify({ nombre: 'X' })).then((r) => r)).codigo === 400);
comprobar('rechaza un cuerpo desmesurado',
  (await llamar(JSON.stringify({ ...PEDIDO, nombre: 'x'.repeat(5000) }))).codigo === 400);

// 4 · Las suscripciones sí pueden ir sin número de pedido
comprobar('acepta una suscripción',
  (await llamar(JSON.stringify({ tipo: 'suscripcion', correo: 'a@b.com' }))).codigo === 200);

// 5 · Si el receptor falla, la venta NO se rompe
simular = 'caido';
res = await llamar(JSON.stringify(PEDIDO), 'POST', '9.9.9.9');
comprobar('si Apps Script está caído, el cliente no ve un error', res.codigo === 200);
simular = 'error';
res = await llamar(JSON.stringify(PEDIDO), 'POST', '9.9.9.8');
comprobar('si Apps Script devuelve 500, el cliente tampoco', res.codigo === 200);
simular = 'ok';

// 6 · Freno anti-spam por IP
const spam = '5.5.5.5';
let bloqueado = false;
for (let i = 0; i < 10; i++) {
  const r = await llamar(JSON.stringify(PEDIDO), 'POST', spam);
  if (r.codigo === 429) { bloqueado = true; break; }
}
comprobar('corta el spam desde una misma IP', bloqueado);
comprobar('y no afecta a otro cliente',
  (await llamar(JSON.stringify(PEDIDO), 'POST', '7.7.7.7')).codigo === 200);

// 7 · Sin configurar, avisa en vez de fingir que funciona
delete process.env.PEDIDOS_URL;
comprobar('sin PEDIDOS_URL responde error de configuración',
  (await llamar(JSON.stringify(PEDIDO), 'POST', '8.8.8.8')).codigo === 500);

console.log(`\n${fallos === 0 ? 'OK — función verificada' : fallos + ' fallo(s)'}`);
process.exit(fallos === 0 ? 0 : 1);
