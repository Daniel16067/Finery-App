# Conectar Finery con la base de datos

Arquitectura: **Vue (frontend)  →  Express (backend/)  →  MariaDB/MySQL (finery_db)**

## 1. Base de datos
```
mysql -u root -p < finery_db.sql
mysql -u root -p finery_db < finery_triggers.sql   # opcional
```

## 2. Backend (carpeta `backend/`)
```
cd backend
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
```
Edita `.env` con tu usuario/contraseña de MariaDB y un `JWT_SECRET` propio. Luego:
```
npm run dev
```
Debe imprimir: `API Finery en http://localhost:3000 (base de datos conectada)`.

## 3. Frontend (raíz del proyecto), en otra terminal
```
npm install
npm run dev
```
Vite reenvía todo lo que empiece por `/api` hacia `http://localhost:3000`.

## 4. Probar
Entra a http://localhost:5173/registro, crea una cuenta y revisa en la BD:
`SELECT id_usuario, correo FROM usuario;`

> Los usuarios de prueba de `finery_db.sql` tienen un hash falso: no se puede iniciar sesión con ellos.
> Regístrate desde la app, o borra esos datos de prueba.
