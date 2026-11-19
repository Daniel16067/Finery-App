import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// Notificaciones no leídas del usuario
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id_notificacion AS id, n.tipo, n.titulo, n.mensaje, n.fecha,
            n.id_ahorro AS idAhorro,
            r.correo AS remitente,
            a.nombre AS nombreAhorro,
            a.monto_objetivo AS metaTotal,
            a.icono, a.color AS colorIcono
       FROM notificacion n
       LEFT JOIN usuario r ON r.id_usuario = n.id_remitente
       LEFT JOIN ahorro_compartido a ON a.id_ahorro = n.id_ahorro
      WHERE n.id_usuario = ? AND n.leida = FALSE
      ORDER BY n.fecha DESC, n.id_notificacion DESC`,
    [req.userId]
  )
  res.json(rows)
})

const propia = async (id, idUsuario) => {
  const [[n]] = await pool.query(
    'SELECT * FROM notificacion WHERE id_notificacion = ? AND id_usuario = ?',
    [id, idUsuario]
  )
  return n
}

router.post('/:id/leer', async (req, res) => {
  const n = await propia(req.params.id, req.userId)
  if (!n) return res.status(404).json({ error: 'Notificación no encontrada' })
  await pool.query('UPDATE notificacion SET leida = TRUE WHERE id_notificacion = ?', [n.id_notificacion])
  res.status(204).end()
})

router.post('/:id/aceptar', async (req, res) => {
  const n = await propia(req.params.id, req.userId)
  if (!n || n.tipo !== 'invitacion') return res.status(404).json({ error: 'Invitación no encontrada' })
  await pool.query(
    `UPDATE participante_ahorro SET estado = 'Compartiendo'
      WHERE id_ahorro = ? AND id_usuario = ?`,
    [n.id_ahorro, req.userId]
  )
  await pool.query('UPDATE notificacion SET leida = TRUE WHERE id_notificacion = ?', [n.id_notificacion])
  res.status(204).end()
})

router.post('/:id/rechazar', async (req, res) => {
  const n = await propia(req.params.id, req.userId)
  if (!n || n.tipo !== 'invitacion') return res.status(404).json({ error: 'Invitación no encontrada' })
  await pool.query(
    `DELETE FROM participante_ahorro
      WHERE id_ahorro = ? AND id_usuario = ? AND estado = 'Pendiente'`,
    [n.id_ahorro, req.userId]
  )
  await pool.query('UPDATE notificacion SET leida = TRUE WHERE id_notificacion = ?', [n.id_notificacion])
  res.status(204).end()
})

export default router
