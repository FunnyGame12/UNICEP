# UNICEP - Esqueleto de Proyecto

Estructura inicial del ecosistema digital UNICEP con:
- Frontend React + Vite + PWA
- Backend Node.js + Express
- ORM Sequelize + migraciones MySQL

## Estructura
- `frontend/`: aplicacion web PWA
- `backend/`: API REST
- `backend/migrations/`: migraciones Sequelize del esquema base

## Requisitos
- Node.js 20+
- MySQL 8+

## Backend
1. Copiar `backend/.env.example` a `backend/.env`.
2. Ajustar credenciales en `backend/config/config.json` y variables de entorno.
3. Crear base de datos `unicep_db` en MySQL.
4. Ejecutar:

```bash
cd backend
npm install
npm run migrate
npm run dev
```

API base:
- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/alumnos/tareas/:id_tarea/entregas` (requiere rol alumno e inscripcion en materia)
- `PATCH /api/v1/docentes/entregas/:id/calificar` (requiere rol docente y materia asignada)
- `PATCH /api/v1/admin/pagos/:id/validar` (registra auditoria)
- `GET /api/v1/admin/alumno-grupos` (consulta de asignaciones alumno-grupo)
- `POST /api/v1/admin/alumno-grupos` (alta o actualizacion de asignacion alumno-grupo)
- `DELETE /api/v1/admin/alumno-grupos/:id_alumno/:id_materia` (baja de asignacion alumno-grupo)

## Frontend
```bash
cd frontend
npm install
npm run dev
```

## Notas
- Este esqueleto incluye rutas por rol y middleware JWT basico.
- Incluye control de bloqueo financiero, pertenencia alumno-grupo y bitacora de auditoria en eventos criticos.

## Despliegue en VPS (Produccion)

### 1) Variables de entorno

Backend:

```bash
cd backend
cp .env.example .env
```

Edita `backend/.env` para produccion:

```env
NODE_ENV=production
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=unicep_prod_db
DB_USER=unicep_user
DB_PASSWORD=tu_password_seguro
JWT_SECRET=una_clave_larga_unica
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://tu-dominio.com
```

Frontend:

```bash
cd frontend
cp .env.production.example .env.production
```

Edita `frontend/.env.production`:

```env
VITE_API_URL=https://tu-dominio.com/api/v1
```

### 2) Configurar MySQL

```sql
CREATE DATABASE unicep_prod_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'unicep_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON unicep_prod_db.* TO 'unicep_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3) Deploy automatico (Ubuntu)

Copiar el proyecto a `/var/www/unicep` y ejecutar:

```bash
cd /var/www/unicep
sudo bash deploy/scripts/deploy-ubuntu.sh tu-dominio.com /var/www/unicep
```

### 4) HTTPS

```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

### 5) Verificacion

- `https://tu-dominio.com`
- `https://tu-dominio.com/api/v1/health`
- `pm2 status`
