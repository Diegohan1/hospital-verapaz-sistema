import test from "node:test";
import assert from "node:assert/strict";
import "./_entorno.mjs";
import { createRateLimiter, _resetVentanas } from "../../src/middlewares/rate-limit.middleware.js";

function llamar(limiter, ip = "1.2.3.4") {
  const res = { cabeceras: {}, codigo: null, cuerpo: null,
    setHeader(k, v) { this.cabeceras[k] = v; },
    status(c) { this.codigo = c; return this; },
    json(b) { this.cuerpo = b; return this; } };
  let siguio = false;
  limiter({ ip }, res, () => { siguio = true; });
  return { siguio, res };
}

test("permite hasta el maximo y luego responde 429 con Retry-After", () => {
  _resetVentanas();
  const lim = createRateLimiter({ windowMs: 60_000, max: 3 });
  for (let i = 0; i < 3; i++) assert.equal(llamar(lim).siguio, true);
  const cuarto = llamar(lim);
  assert.equal(cuarto.siguio, false);
  assert.equal(cuarto.res.codigo, 429);
  assert.ok(Number(cuarto.res.cabeceras["Retry-After"]) >= 1);
});

test("cada limitador tiene su propio contador (login no bloquea recuperar contraseña)", () => {
  _resetVentanas();
  const login = createRateLimiter({ windowMs: 60_000, max: 2 });
  const reset = createRateLimiter({ windowMs: 60_000, max: 2 });
  llamar(login); llamar(login);
  assert.equal(llamar(login).res.codigo, 429, "login agotado");
  assert.equal(llamar(reset).siguio, true, "reset sigue disponible desde la misma IP");
});

test("cada IP cuenta aparte", () => {
  _resetVentanas();
  const lim = createRateLimiter({ windowMs: 60_000, max: 1 });
  assert.equal(llamar(lim, "10.0.0.1").siguio, true);
  assert.equal(llamar(lim, "10.0.0.1").res.codigo, 429);
  assert.equal(llamar(lim, "10.0.0.2").siguio, true);
});

test("la ventana se libera despues de windowMs", async () => {
  _resetVentanas();
  const lim = createRateLimiter({ windowMs: 40, max: 1 });
  assert.equal(llamar(lim).siguio, true);
  assert.equal(llamar(lim).res.codigo, 429);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(llamar(lim).siguio, true);
});
