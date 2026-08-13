import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import './App.css';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const hideNav = ['/', '/login', '/registro-folio'].includes(location.pathname);

  return (
    <div className="layout">
      <header className={`topbar ${hideNav ? 'topbar-login' : ''}`}>
        <h1>UNICEP Merida</h1>
        {!hideNav ? (
          <nav>
            <Link to="/">Inicio</Link>
            <Link to="/alumno">Alumno</Link>
            <Link to="/docente">Docente</Link>
            <Link to="/administrativo">Administrativo</Link>
            {!isAuthenticated ? <Link to="/registro-folio">Registro</Link> : null}
            {!isAuthenticated ? (
              <Link to="/login">Login</Link>
            ) : (
              <button type="button" className="link-button" onClick={logout}>
                Salir ({user?.rol})
              </button>
            )}
          </nav>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
