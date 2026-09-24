// Controlador: catalogo de categorias fiscales (23/09/2026). Editable por
// el Administrador -- las tasas y regimenes de la SAT cambian, asi que no
// se dejan fijas en el codigo. Usado por Gastos del Hospital para
// clasificar cada gasto (IVA general, Pequeño Contribuyente, regimenes de
// ISR, etc). "tasa" es solo informativa; el calculo real del impuesto lo
// sigue haciendo el contador del hospital.
import { prisma } from "../config/prisma.js";
import { registrarActividad } from "../services/actividad.service.js";

// GET /api/facturacion/categorias-fiscales?activo=true
export async function listar(req, res) {
  const where = req.query.activo !== undefined ? { activo: req.query.activo === "true" } : undefined;
  const categorias = await prisma.categoriaFiscal.findMany({ where, orderBy: { nombre: "asc" } });
  res.json(categorias);
}

// POST /api/facturacion/categorias-fiscales
export async function crear(req, res) {
  const { nombre, tasa } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "El nombre es requerido" });
  if (tasa !== undefined && tasa !== null && tasa !== "" && (Number.isNaN(Number(tasa)) || Number(tasa) < 0)) {
    return res.status(422).json({ error: "La tasa debe ser un número mayor o igual a 0" });
  }

  const existente = await prisma.categoriaFiscal.findUnique({ where: { nombre: nombre.trim() } });
  if (existente) return res.status(409).json({ error: `Ya existe una categoría fiscal llamada "${nombre.trim()}"` });

  const categoria = await prisma.categoriaFiscal.create({
    data: { nombre: nombre.trim(), tasa: tasa !== undefined && tasa !== "" ? Number(tasa) : null },
  });
  await registrarActividad(req.user.id, "crear_categoria_fiscal", categoria.nombre);
  res.status(201).json(categoria);
}

// PUT /api/facturacion/categorias-fiscales/:id -- editar nombre/tasa o
// desactivarla (no se borra: los gastos ya registrados con ella deben
// seguir mostrando con cual se clasificaron).
export async function actualizar(req, res) {
  const id = Number(req.params.id);
  const categoria = await prisma.categoriaFiscal.findUnique({ where: { id } });
  if (!categoria) return res.status(404).json({ error: "Categoría fiscal no encontrada" });

  const data = {};
  if (req.body.nombre !== undefined) {
    if (!req.body.nombre.trim()) return res.status(400).json({ error: "El nombre no puede quedar vacío" });
    data.nombre = req.body.nombre.trim();
  }
  if (req.body.tasa !== undefined) {
    if (req.body.tasa !== null && req.body.tasa !== "" && (Number.isNaN(Number(req.body.tasa)) || Number(req.body.tasa) < 0)) {
      return res.status(422).json({ error: "La tasa debe ser un número mayor o igual a 0" });
    }
    data.tasa = req.body.tasa === null || req.body.tasa === "" ? null : Number(req.body.tasa);
  }
  if (req.body.activo !== undefined) data.activo = !!req.body.activo;

  try {
    const actualizada = await prisma.categoriaFiscal.update({ where: { id }, data });
    await registrarActividad(req.user.id, "actualizar_categoria_fiscal", actualizada.nombre);
    res.json(actualizada);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: `Ya existe una categoría fiscal llamada "${data.nombre}"` });
    throw err;
  }
}
