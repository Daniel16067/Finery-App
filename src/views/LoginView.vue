<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, guardarSesion } from '../api'

const router = useRouter()
const correo = ref('')
const contrasena = ref('')
const error = ref('')
const cargando = ref(false)

const iniciarSesion = async () => {
  error.value = ''
  cargando.value = true
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { correo: correo.value, contrasena: contrasena.value }
    })
    guardarSesion(data)
    router.push('/resumen')
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const loginGoogle = () => {
  error.value = 'El inicio de sesión con Google aún no está disponible.'
}
</script>

<template>
  <div class="container-fluid p-0">
    <div class="row g-0 vh-100">
      <!-- COLUMNA IZQUIERDA: IMAGEN DE FONDO Y LOGO -->
      <div 
        class="col-md-7 text-white p-5 d-md-block" 
        style="background-image: url('/img/loginBG.jpg'); background-size: cover; background-position: center 25%;"
      >
        <div class="w-75 mx-auto">
          <h1 class="mt-5 fw-bold display-3">
            Finery<span style="color: #FF5722;">.</span>
          </h1>
          <h3 class="mt-3 fw-bold">
            Toma el control de tus finanzas<br>hoy.
          </h3>
          <br><br><br><br><br><br>
        </div>
      </div>
      
      <!-- COLUMNA DERECHA: FORMULARIO DE INICIO DE SESIÓN -->
      <div class="col-md-5 d-flex align-items-center justify-content-center text-white" style="background-color: #000000">
        <div class="w-75">
          <h3 class="mb-4">Iniciar Sesión</h3>

          <form @submit.prevent="iniciarSesion">
            <div class="mb-3">
              <div class="input-group">
                <span class="input-group-text bg-white" id="basic-addon1">@</span>
                <input v-model="correo" type="email" class="form-control" placeholder="Correo electrónico" required>
              </div>
            </div>

            <div class="mb-4">
              <input v-model="contrasena" type="password" class="form-control" placeholder="********" required>
            </div>

            <div v-if="error" class="alert alert-danger py-2 small mb-3">{{ error }}</div>

            <div class="d-grid gap-2 mb-4">
              <button type="submit" :disabled="cargando" class="btn rounded-pill text-white" style="background-color: #FF5722;">
                {{ cargando ? 'Ingresando...' : 'Log In' }}
              </button>
            </div>

            <div class="text-center mb-4">
              <router-link to="/registro" class="text-decoration-none text-white fw-bold">
                ¿No tienes una cuenta? Regístrate
              </router-link>
            </div>

            <hr class="mb-4">

            <div class="d-grid gap-2">
              <button type="button" class="btn btn-outline-light rounded-pill" @click="loginGoogle">
                <i class="bi bi-google me-2"></i>Google Log In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>