import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const SELECT_MOV = `
  SELECT m.id_movimiento AS id, m.concepto, t.nombre AS tipoPago,
         m.monto, m.fecha
    FROM movimiento m
    JOIN tipo_pago t ON t.id_tipo_pago = m.id_tipo_pago`

const idTipoPago = async (nombre) => {
  const [[t]] = await pool.query('SELECT id_tipo_pago FROM tipo_pago WHERE nombre = ?', [nombre])
  return t ? t.id_tipo_pago : null
}

const hoy = () => new Date().toISOString().slice(0, 10)

router.get('/tipos-pago', async (_req, res) => {
  const [rows] = await pool.query('SELECT id_tipo_pago AS id, nombre FROM tipo_pago ORDER BY id_tipo_pago')
  res.json(rows)
})

router.get('/movimientos', async (req, res) => {
  const [rows] = await pool.query(
    `${SELECT_MOV} WHERE m.id_usuario = ? ORDER BY m.fecha DESC, m.id_movimiento DESC`,
    [req.userId]
  )
  res.json(rows)
})

router.post('/movimientos', async (req, res) => {
  const { concepto, tipoPago, monto, fecha } = req.body
  const idTipo = await idTipoPago(tipoPago)
  if (!String(concepto || '').trim() || !idTipo || !(Number(monto) > 0))
    return res.status(400).json({ error: 'Datos del movimiento inválidos' })

  const [r] = await pool.query(
    `INSERT INTO movimiento (id_usuario, id_tipo_pago, concepto, monto, fecha)
     VALUES (?, ?, ?, ?, ?)`,
    [req.userId, idTipo, String(concepto).trim(), Number(monto), fecha || hoy()]
  )
  const [[mov]] = await pool.query(`${SELECT_MOV} WHERE m.id_movimiento = ?`, [r.insertId])
  res.status(201).json(mov)
})

router.put('/movimientos/:id', async (req, res) => {
  const { concepto, tipoPago, monto, fecha } = req.body
  const idTipo = await idTipoPago(tipoPago)
  if (!String(concepto || '').trim() || !idTipo || !(Number(monto) > 0))
    return res.status(400).json({ error: 'Datos del movimiento inválidos' })

  const [r] = await pool.query(
    `UPDATE movimiento
        SET concepto = ?, id_tipo_pago = ?, monto = ?, fecha = COALESCE(?, fecha)
      WHERE id_movimiento = ? AND id_usuario = ?`,
    [String(concepto).trim(), idTipo, Number(monto), fecha || null, req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Movimiento no encontrado' })
  const [[mov]] = await pool.query(`${SELECT_MOV} WHERE m.id_movimiento = ?`, [req.params.id])
  res.json(mov)
})

router.delete('/movimientos/:id', async (req, res) => {
  const [r] = await pool.query(
    'DELETE FROM movimiento WHERE id_movimiento = ? AND id_usuario = ?',
    [req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Movimiento no encontrado' })
  res.status(204).end()
})

export default router
