import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import HomePage from './pages/HomePage';
import AlumnoPage from './pages/AlumnoPage';
import DocentePage from './pages/DocentePage';
import DirectorPage from './pages/DirectorPage';
import ControlEscolarPage from './pages/ControlEscolarPage';
import CoordinacionAcademicaPage from './pages/CoordinacionAcademicaPage';
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
        path: 'control-escolar',
        element: (
          <ProtectedRoute roles={['control_escolar']}>
            <ControlEscolarPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'administrativo',
        element: (
          <ProtectedRoute roles={['coordinacion_academica']}>
            <CoordinacionAcademicaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'coordinacion-academica',
        element: (
          <ProtectedRoute roles={['coordinacion_academica']}>
            <CoordinacionAcademicaPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;
