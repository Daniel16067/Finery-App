import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev_secret_no_usar_en_produccion'

export const firmarToken = (usuario) =>
  jwt.sign({ id: usuario.id_usuario }, SECRET, { expiresIn: '7d' })

// Middleware: exige "Authorization: Bearer <token>" y deja req.userId
export const requerirAuth = (req, res, next) => {
  const cabecera = req.headers.authorization || ''
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    req.userId = jwt.verify(token, SECRET).id
    next()
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
}
