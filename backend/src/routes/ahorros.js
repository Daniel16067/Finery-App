import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const SELECT_AHORRO = `
  SELECT a.id_ahorro AS id, a.nombre, a.icono, a.color AS colorIcono,
         a.monto_objetivo AS metaTotal,
         COALESCE((SELECT SUM(ap.monto) FROM aporte_ahorro ap
                    WHERE ap.id_ahorro = a.id_ahorro), 0) AS valorActual
    FROM ahorro_compartido a`

// Participantes distintos del usuario (el front cuenta "participantes + 1")
const participantesDe = async (idAhorro, idUsuario) => {
  const [rows] = await pool.query(
    `SELECT u.id_usuario AS id, u.correo, p.estado
       FROM participante_ahorro p
       JOIN usuario u ON u.id_usuario = p.id_usuario
      WHERE p.id_ahorro = ? AND p.id_usuario <> ?
      ORDER BY u.correo`,
    [idAhorro, idUsuario]
  )
  return rows
}

const ahorroCompleto = async (idAhorro, idUsuario) => {
  const [[a]] = await pool.query(`${SELECT_AHORRO} WHERE a.id_ahorro = ?`, [idAhorro])
  if (!a) return null
  a.participantes = await participantesDe(idAhorro, idUsuario)
  return a
}

// Devuelve true si el usuario participa activamente en el ahorro
const esParticipante = async (idAhorro, idUsuario) => {
  const [r] = await pool.query(
    `SELECT 1 FROM participante_ahorro
      WHERE id_ahorro = ? AND id_usuario = ? AND estado = 'Compartiendo'`,
    [idAhorro, idUsuario]
  )
  return r.length > 0
}

const nombreUsuario = async (conn, id) => {
  const [[u]] = await conn.query('SELECT nombre_completo FROM usuario WHERE id_usuario = ?', [id])
  return u?.nombre_completo || 'Alguien'
}

const crearInvitacion = async (conn, { idAhorro, idInvitado, idRemitente, nombreAhorro }) => {
  await conn.query(
    `INSERT INTO participante_ahorro (id_ahorro, id_usuario, estado) VALUES (?, ?, 'Pendiente')`,
    [idAhorro, idInvitado]
  )
  const remitente = await nombreUsuario(conn, idRemitente)
  await conn.query(
    `INSERT INTO notificacion (id_usuario, id_remitente, id_ahorro, tipo, titulo, mensaje)
     VALUES (?, ?, ?, 'invitacion', 'Invitación a Ahorro Compartido', ?)`,
    [idInvitado, idRemitente, idAhorro, `${remitente} te invitó a participar en "${nombreAhorro}".`]
  )
}

// ---------------- LISTAR ----------------
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `${SELECT_AHORRO}
       JOIN participante_ahorro p
         ON p.id_ahorro = a.id_ahorro AND p.id_usuario = ? AND p.estado = 'Compartiendo'
      ORDER BY a.id_ahorro`,
    [req.userId]
  )
  for (const a of rows) a.participantes = await participantesDe(a.id, req.userId)
  res.json(rows)
})

// ---------------- CREAR ----------------
router.post('/', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim()
  const metaTotal = Number(req.body.metaTotal)
  const valorActual = Number(req.body.valorActual || 0)
  const icono = String(req.body.icono || 'bi-piggy-bank-fill')
  const color = String(req.body.colorIcono || '#FF5722')
  const correos = [...new Set((req.body.participantes || [])
    .map((p) => String(p.correo || '').trim().toLowerCase()).filter(Boolean))]

  if (!nombre) return res.status(400).json({ error: 'Ingresa un nombre para el ahorro compartido.' })
  if (!(metaTotal > 0)) return res.status(400).json({ error: 'La meta total debe ser mayor a $0.' })
  if (!(valorActual >= 0)) return res.status(400).json({ error: 'El valor actual no puede ser negativo.' })
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return res.status(400).json({ error: 'Color inválido.' })

  // Todos los invitados deben estar registrados
  const invitados = []
  const noRegistrados = []
  for (const correo of correos) {
    const [[u]] = await pool.query('SELECT id_usuario FROM usuario WHERE correo = ?', [correo])
    if (!u) noRegistrados.push(correo)
    else if (u.id_usuario !== req.userId) invitados.push(u.id_usuario)
  }
  if (noRegistrados.length)
    return res.status(400).json({
      error: `Estos correos no están registrados en Finery: ${noRegistrados.join(', ')}`
    })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [r] = await conn.query(
      'INSERT INTO ahorro_compartido (nombre, icono, color, monto_objetivo) VALUES (?, ?, ?, ?)',
      [nombre, icono, color, metaTotal]
    )
    const idAhorro = r.insertId
    await conn.query(
      `INSERT INTO participante_ahorro (id_ahorro, id_usuario, estado) VALUES (?, ?, 'Compartiendo')`,
      [idAhorro, req.userId]
    )
    if (valorActual > 0)
      await conn.query(
        'INSERT INTO aporte_ahorro (id_ahorro, id_usuario, monto) VALUES (?, ?, ?)',
        [idAhorro, req.userId, valorActual]
      )
    for (const idInvitado of invitados)
      await crearInvitacion(conn, { idAhorro, idInvitado, idRemitente: req.userId, nombreAhorro: nombre })
    await conn.commit()
    res.status(201).json(await ahorroCompleto(idAhorro, req.userId))
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
})

// ---------------- EDITAR (nombre, meta, icono, color) ----------------
// El monto ahorrado NO se edita aquí: sale de la suma de aportes.
router.put('/:id', async (req, res) => {
  const idAhorro = Number(req.params.id)
  if (!(await esParticipante(idAhorro, req.userId)))
    return res.status(404).json({ error: 'Ahorro no encontrado' })

  const nombre = String(req.body.nombre || '').trim()
  const metaTotal = Number(req.body.metaTotal)
  const icono = String(req.body.icono || 'bi-piggy-bank-fill')
  const color = String(req.body.colorIcono || '#FF5722')
  if (!nombre) return res.status(400).json({ error: 'El nombre del ahorro no puede estar vacío.' })
  if (!(metaTotal > 0)) return res.status(400).json({ error: 'La meta total debe ser mayor a $0.' })
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return res.status(400).json({ error: 'Color inválido.' })

  await pool.query(
    'UPDATE ahorro_compartido SET nombre = ?, monto_objetivo = ?, icono = ?, color = ? WHERE id_ahorro = ?',
    [nombre, metaTotal, icono, color, idAhorro]
  )
  res.json(await ahorroCompleto(idAhorro, req.userId))
})

// ---------------- APORTAR ----------------
router.post('/:id/aportes', async (req, res) => {
  const idAhorro = Number(req.params.id)
  const monto = Number(req.body.monto)
  if (!(monto > 0)) return res.status(400).json({ error: 'Ingresa un monto válido mayor a $0.' })
  if (!(await esParticipante(idAhorro, req.userId)))
    return res.status(404).json({ error: 'Ahorro no encontrado' })

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      'INSERT INTO aporte_ahorro (id_ahorro, id_usuario, monto) VALUES (?, ?, ?)',
      [idAhorro, req.userId, monto]
    )
    const [[a]] = await conn.query('SELECT nombre FROM ahorro_compartido WHERE id_ahorro = ?', [idAhorro])
    const quien = await nombreUsuario(conn, req.userId)
    const [otros] = await conn.query(
      `SELECT id_usuario FROM participante_ahorro
        WHERE id_ahorro = ? AND id_usuario <> ? AND estado = 'Compartiendo'`,
      [idAhorro, req.userId]
    )
    const dinero = Math.round(monto).toLocaleString('es-CO')
    for (const o of otros)
      await conn.query(
        `INSERT INTO notificacion (id_usuario, id_remitente, id_ahorro, tipo, titulo, mensaje)
         VALUES (?, ?, ?, 'aporte', 'Nuevo Aporte en Grupo', ?)`,
        [o.id_usuario, req.userId, idAhorro, `${quien} aportó $${dinero} al objetivo compartido "${a.nombre}".`]
      )
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
  res.status(201).json(await ahorroCompleto(idAhorro, req.userId))
})

// ---------------- INVITAR ----------------
router.post('/:id/invitar', async (req, res) => {
  const idAhorro = Number(req.params.id)
  const correo = String(req.body.correo || '').trim().toLowerCase()
  if (!(await esParticipante(idAhorro, req.userId)))
    return res.status(404).json({ error: 'Ahorro no encontrado' })

  const [[u]] = await pool.query('SELECT id_usuario FROM usuario WHERE correo = ?', [correo])
  if (!u) return res.status(404).json({ error: 'Ese correo no está registrado en Finery.' })
  if (u.id_usuario === req.userId) return res.status(400).json({ error: 'Ya participas en este ahorro.' })

  const [yaEsta] = await pool.query(
    'SELECT 1 FROM participante_ahorro WHERE id_ahorro = ? AND id_usuario = ?',
    [idAhorro, u.id_usuario]
  )
  if (yaEsta.length)
    return res.status(409).json({ error: 'Este usuario ya fue invitado o ya participa en el ahorro.' })

  const [[a]] = await pool.query('SELECT nombre FROM ahorro_compartido WHERE id_ahorro = ?', [idAhorro])
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await crearInvitacion(conn, {
      idAhorro, idInvitado: u.id_usuario, idRemitente: req.userId, nombreAhorro: a.nombre
    })
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
  res.status(201).json({ id: u.id_usuario, correo, estado: 'Pendiente' })
})

// ---------------- CANCELAR INVITACIÓN PENDIENTE ----------------
router.delete('/:id/invitaciones/:idUsuario', async (req, res) => {
  const idAhorro = Number(req.params.id)
  if (!(await esParticipante(idAhorro, req.userId)))
    return res.status(404).json({ error: 'Ahorro no encontrado' })
  await pool.query(
    `DELETE FROM participante_ahorro
      WHERE id_ahorro = ? AND id_usuario = ? AND estado = 'Pendiente'`,
    [idAhorro, req.params.idUsuario]
  )
  await pool.query(
    `DELETE FROM notificacion
      WHERE id_ahorro = ? AND id_usuario = ? AND tipo = 'invitacion'`,
    [idAhorro, req.params.idUsuario]
  )
  res.status(204).end()
})

// ---------------- SALIRSE DEL AHORRO ----------------
router.delete('/:id/participacion', async (req, res) => {
  const idAhorro = Number(req.params.id)
  const [r] = await pool.query(
    'DELETE FROM participante_ahorro WHERE id_ahorro = ? AND id_usuario = ?',
    [idAhorro, req.userId]
  )
  if (!r.affectedRows) return res.status(404).json({ error: 'Ahorro no encontrado' })

  // Si ya no queda nadie activo, se elimina el ahorro (y sus aportes en cascada)
  const [[{ activos }]] = await pool.query(
    `SELECT COUNT(*) AS activos FROM participante_ahorro
      WHERE id_ahorro = ? AND estado = 'Compartiendo'`,
    [idAhorro]
  )
  if (activos === 0) await pool.query('DELETE FROM ahorro_compartido WHERE id_ahorro = ?', [idAhorro])
  res.status(204).end()
})

export default router
