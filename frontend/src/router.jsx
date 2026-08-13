import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import HomePage from './pages/HomePage';
import AlumnoPage from './pages/AlumnoPage';
import DocentePage from './pages/DocentePage';
import AdminPage from './pages/AdminPage';
import DirectorPage from './pages/DirectorPage';
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
        path: 'director',
        element: (
          <ProtectedRoute roles={['director']}>
            <DirectorPage />
          </ProtectedRoute>
        ),
      },
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
          <ProtectedRoute roles={['control_escolar', 'coordinacion_academica']}>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;
