import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import { requerirAuth } from './auth.js'
import authRoutes from './routes/auth.js'
import movimientosRoutes from './routes/movimientos.js'
import presupuestosRoutes from './routes/presupuestos.js'
import metasRoutes from './routes/metas.js'
import ahorrosRoutes from './routes/ahorros.js'
import notificacionesRoutes from './routes/notificaciones.js'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

app.get('/api/salud', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)

// Todo lo de abajo requiere sesión iniciada
app.use('/api', requerirAuth)
app.use('/api', movimientosRoutes)      // /movimientos y /tipos-pago
app.use('/api', presupuestosRoutes)     // /presupuestos y /usuario/salario
app.use('/api/metas', metasRoutes)
app.use('/api/ahorros', ahorrosRoutes)
app.use('/api/notificaciones', notificacionesRoutes)

// Manejo de errores
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1')
    console.log(`API Finery en http://localhost:${PORT}  (base de datos conectada)`)
  } catch (e) {
    console.error('No se pudo conectar a la base de datos:', e.message)
  }
})
