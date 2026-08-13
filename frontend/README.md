# UNICEP Frontend

Frontend web del ecosistema digital UNICEP para alumnos, docentes y administracion.

## Stack
- React 19
- Vite 8
- React Router
- Axios

## Funcionalidad principal
- Inicio institucional
- Oferta academica
- Acceso de usuario por login
- Registro con folio
- Panel de alumno
- Panel de docente
- Panel administrativo

## Rutas principales
- `/inicio`: pagina principal
- `/oferta-academica`: oferta academica
- `/login`: acceso al sistema
- `/registro-folio`: activacion de cuenta con folio
- `/alumno`: panel de alumno
- `/docente`: panel de docente
- `/administrativo`: panel administrativo

## Scripts
```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Variables de entorno
El frontend consume la API definida en variables de entorno. Usa como referencia los archivos del proyecto para configurar la URL del backend segun el entorno.

## Estructura general
- `src/App.jsx`: layout principal y navbar
- `src/router.jsx`: rutas de la aplicacion
- `src/auth/`: contexto y logica de autenticacion
- `src/pages/`: vistas por modulo
- `src/services/`: cliente HTTP y helpers de API

## Notas de despliegue
- El build final se genera en `dist/`.
- El frontend se publica detras de Nginx y se conecta con la API por la URL configurada en entorno.
- Si cambian rutas estaticas, limpiar cache del navegador antes de validar en produccion.
