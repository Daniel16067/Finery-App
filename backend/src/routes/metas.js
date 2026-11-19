import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const SELECT = `SELECT id_meta AS id, nombre, monto_objetivo AS valorTotal, monto_ahorrado AS valorActual
                  FROM meta_personal`

const validar = (b) => {
  const nombre = String(b.nombre || '').trim()
  const total = Number(b.valorTotal)
  const actual = Number(b.valorActual || 0)
  if (!nombre) return { error: 'Ingresa un nombre para la meta' }
  if (!(total > 0)) return { error: 'El valor total debe ser mayor a $0' }
  if (!(actual >= 0)) return { error: 'El valor actual no puede ser negativo' }
  return { nombre, total, actual }
}

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE id_usuario = ? ORDER BY id_meta`, [req.userId])
  res.json(rows)
})

router.post('/', async (req, res) => {
  const v = validar(req.body)
  if (v.error) return res.status(400).json({ error: v.error })
  const [r] = await pool.query(
    'INSERT INTO meta_personal (id_usuario, nombre, monto_objetivo, monto_ahorrado) VALUES (?, ?, ?, ?)',
    [req.userId, v.nombre, v.total, v.actual]
  )
  res.status(201).json({ id: r.insertId, nombre: v.nombre, valorTotal: v.total, valorActual: v.actual })
})

router.put('/:id', async (req, res) => {
  const v = validar(req.body)
  if (v.error) return res.status(400).json({ error: v.error })
  const [r] = await pool.query(
    `UPDATE meta_personal SET nombre = ?, monto_objetivo = ?, monto_ahorrado = ?
      WHERE id_meta = ? AND id_usuario = ?`,
    [v.nombre, v.total, v.actual, req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Meta no encontrada' })
  res.json({ id: Number(req.params.id), nombre: v.nombre, valorTotal: v.total, valorActual: v.actual })
})

router.delete('/:id', async (req, res) => {
  const [r] = await pool.query(
    'DELETE FROM meta_personal WHERE id_meta = ? AND id_usuario = ?',
    [req.params.id, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Meta no encontrada' })
  res.status(204).end()
})

export default router
