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
          <Link to="/">UNICEP</Link>
        </h1>
        {!hideNav ? (
          <div className="topbar-nav-wrapper">
            {!isAuthenticated ? (
              <Link to="/login" className="compact-login-short">
                Iniciar sesión
              </Link>
            ) : null}

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
              className={`topbar-nav ${isMenuOpen ? 'is-open' : ''}`}
            >
              <a href="/#inicio" className="nav-section-link">Inicio</a>
              <a href="/#quienes-somos" className="nav-section-link">Identidad Institucional</a>
              <a href="/#modelo" className="nav-section-link">Modelo Educativo</a>
              <a href="/#oferta" className="nav-section-link">Oferta Académica</a>
              <a href="/#horarios" className="nav-section-link">Horarios</a>
              <a href="/#campus" className="nav-section-link">Campus</a>
              <a href="/#servicios" className="nav-section-link">Servicios</a>
              <a href="/#planteles" className="nav-section-link">Planteles</a>
              <a href="/#contacto" className="nav-section-link">Contacto</a>
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
