import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const sumaOtros = async (idUsuario, excluirId = 0) => {
  const [[r]] = await pool.query(
    'SELECT COALESCE(SUM(porcentaje),0) AS s FROM presupuesto WHERE id_usuario = ? AND id_presupuesto <> ?',
    [idUsuario, excluirId]
  )
  return Number(r.s)
}

router.put('/usuario/salario', async (req, res) => {
  const salario = Number(req.body.salario)
  if (!(salario >= 0)) return res.status(400).json({ error: 'Salario inválido' })
  await pool.query('UPDATE usuario SET salario_mensual = ? WHERE id_usuario = ?', [salario, req.userId])
  res.json({ salario })
})

router.get('/presupuestos', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id_presupuesto AS id, nombre, porcentaje FROM presupuesto WHERE id_usuario = ? ORDER BY id_presupuesto',
    [req.userId]
  )
  res.json(rows)
})

router.post('/presupuestos', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim()
  const porcentaje = Number(req.body.porcentaje)
  if (!nombre) return res.status(400).json({ error: 'Ingresa un nombre' })
  if (!(porcentaje > 0)) return res.status(400).json({ error: 'El porcentaje debe ser mayor a 0%' })

  const libre = 100 - (await sumaOtros(req.userId))
  if (porcentaje > libre)
    return res.status(400).json({ error: `El porcentaje supera el disponible (${libre}% libre)` })

  const [r] = await pool.query(
    'INSERT INTO presupuesto (id_usuario, nombre, porcentaje) VALUES (?, ?, ?)',
    [req.userId, nombre, porcentaje]
  )
  res.status(201).json({ id: r.insertId, nombre, porcentaje })
})

router.put('/presupuestos/:id', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim()
  const porcentaje = Number(req.body.porcentaje)
  if (!nombre) return res.status(400).json({ error: 'Ingresa un nombre' })
  if (!(porcentaje >= 0)) return res.status(400).json({ error: 'Porcentaje inválido' })

  const maximo = 100 - (await sumaOtros(req.userId, Number(req.params.id)))
  if (porcentaje > maximo)
    return res.status(400).json({ error: `El porcentaje debe estar entre 0% y ${maximo}%` })

  const [r] = await pool.query(
    'UPDATE presupuesto SET nombre = ?, porcentaje = ? WHERE id_presupuesto = ? AND id_usuario = ?',
    [nombre, porcentaje, req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Presupuesto no encontrado' })
  res.json({ id: Number(req.params.id), nombre, porcentaje })
})

router.delete('/presupuestos/:id', async (req, res) => {
  const [r] = await pool.query(
    'DELETE FROM presupuesto WHERE id_presupuesto = ? AND id_usuario = ?',
    [req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Presupuesto no encontrado' })
  res.status(204).end()
})

export default router
