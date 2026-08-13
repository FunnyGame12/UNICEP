import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import HomePage from './pages/HomePage';
import AlumnoPage from './pages/AlumnoPage';
import DocentePage from './pages/DocentePage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegistroFolioPage from './pages/RegistroFolioPage';
import ProtectedRoute from './components/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'inicio', element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'registro-folio', element: <RegistroFolioPage /> },
      {
        path: 'alumno',
        element: (
          <ProtectedRoute roles={['alumno']}>
            <AlumnoPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'docente',
        element: (
          <ProtectedRoute roles={['maestro']}>
            <DocentePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'administrativo',
        element: (
          <ProtectedRoute roles={['director', 'control_escolar', 'coordinacion_academica', 'soporte_ti']}>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;
