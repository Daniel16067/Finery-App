import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db.js'
import { firmarToken, requerirAuth } from '../auth.js'

const router = Router()

const publico = (u) => ({
  id: u.id_usuario,
  nombre: u.nombre_completo,
  correo: u.correo,
  salario: u.salario_mensual
})

router.post('/registro', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim()
  const correo = String(req.body.correo || '').trim().toLowerCase()
  const contrasena = String(req.body.contrasena || '')

  if (!nombre || !correo || !contrasena)
    return res.status(400).json({ error: 'Completa todos los campos' })
  if (!correo.includes('@'))
    return res.status(400).json({ error: 'Correo inválido' })
  if (contrasena.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  const [existe] = await pool.query('SELECT 1 FROM usuario WHERE correo = ?', [correo])
  if (existe.length) return res.status(409).json({ error: 'Ese correo ya está registrado' })

  const hash = await bcrypt.hash(contrasena, 10)
  const [r] = await pool.query(
    'INSERT INTO usuario (nombre_completo, correo, contrasena) VALUES (?, ?, ?)',
    [nombre, correo, hash]
  )
  const [[u]] = await pool.query('SELECT * FROM usuario WHERE id_usuario = ?', [r.insertId])
  res.status(201).json({ token: firmarToken(u), usuario: publico(u) })
})

router.post('/login', async (req, res) => {
  const correo = String(req.body.correo || '').trim().toLowerCase()
  const contrasena = String(req.body.contrasena || '')

  const [[u]] = await pool.query('SELECT * FROM usuario WHERE correo = ?', [correo])
  const ok = u && u.contrasena && (await bcrypt.compare(contrasena, u.contrasena))
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos' })

  res.json({ token: firmarToken(u), usuario: publico(u) })
})

router.get('/me', requerirAuth, async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM usuario WHERE id_usuario = ?', [req.userId])
  if (!u) return res.status(401).json({ error: 'Usuario no existe' })
  res.json(publico(u))
})

export default router
