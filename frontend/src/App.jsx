import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import './App.css';

function App() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const hideNav = ['/login', '/registro-folio'].includes(location.pathname);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  return (
    <div className="layout">
      <header className={`topbar ${hideNav ? 'topbar-login' : ''}`}>
        <h1>
          <Link to="/">UNICEP Merida</Link>
        </h1>
        {!hideNav ? (
          <div className="topbar-nav-wrapper">
            <button
              type="button"
              className="mobile-menu-toggle"
              aria-expanded={isMenuOpen}
              aria-controls="site-navigation"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? 'Cerrar' : 'Menú'}
            </button>

            <nav
              id="site-navigation"
              className={`topbar-nav ${isMenuOpen ? 'is-open' : ''} ${isAuthenticated ? 'is-auth-nav' : ''}`}
            >
              <Link to="/">Inicio</Link>
              <Link to="/alumno">Alumno</Link>
              <Link to="/docente">Docente</Link>
              <Link to="/administrativo">Administrativo</Link>
              {!isAuthenticated ? <Link to="/registro-folio">Registro</Link> : null}
              {!isAuthenticated ? (
                <Link to="/login" className="btn-navbar menu-login-link">
                  Iniciar sesión
                </Link>
              ) : (
                <button type="button" className="link-button" onClick={handleLogout}>
                  Salir ({user?.rol})
                </button>
              )}
            </nav>
          </div>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
