// Cliente para hablar con el backend de Finery (proxy /api -> http://localhost:3000)
import { ref } from 'vue'

const TOKEN_KEY = 'finery_token'
const USER_KEY = 'finery_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const getUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const guardarSesion = ({ token, usuario }) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(usuario))
}

export const cerrarSesion = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function api(ruta, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido el backend?')
  }

  // Sesión vencida (menos en login/registro, donde 401 = credenciales malas)
  if (res.status === 401 && !ruta.startsWith('/auth/login')) {
    cerrarSesion()
    window.location.href = '/'
    throw new Error('Sesión expirada')
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error')
  return data
}

// ---------- Fechas: la BD usa 'YYYY-MM-DD', la interfaz '14 Sep, 2026' ----------
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export const fechaVista = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return iso || ''
  return `${m[3]} ${MESES[Number(m[2]) - 1]}, ${m[1]}`
}

export const fechaISO = (texto) => {
  const t = String(texto || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]+),?\s+(\d{4})$/)
  if (!m) return null
  const mes = MESES.findIndex((x) => x.toLowerCase() === m[2].slice(0, 3).toLowerCase())
  if (mes === -1) return null
  return `${m[3]}-${String(mes + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Tiempo relativo para notificaciones ("Hace 5 min")
export const tiempoRelativo = (fecha) => {
  const d = new Date(String(fecha).replace(' ', 'T'))
  if (isNaN(d)) return ''
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Hace ${h} ${h === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(h / 24)
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`
}

// Contador compartido: Sidebar lo incrementa (p. ej. al aceptar una invitación)
// y las vistas lo observan con watch() para recargar sus datos.
export const cambiosAhorro = ref(0)
