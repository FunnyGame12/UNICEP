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

  const directorLinks = [
    ['Resumen', '#director-supervision'],
    ['Folios', '#director-folios'],
    ['Finanzas', '#director-finanzas'],
    ['Académico', '#director-academico'],
    ['Aulas', '#director-infraestructura'],
    ['Auditoría', '#director-auditoria'],
  ];

  const authenticatedLinks = user?.rol === 'director'
    ? directorLinks
    : user?.rol === 'alumno'
      ? [['Mi panel', '/alumno']]
      : user?.rol === 'maestro'
        ? [['Mi panel', '/docente']]
        : user?.rol === 'control_escolar'
          ? [['Control Escolar', '/control-escolar']]
          : [['Panel coordinación', '/administrativo']];

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
              {(isAuthenticated ? authenticatedLinks : [
                ['Inicio', '/#inicio'],
                ['Identidad Institucional', '/#quienes-somos'],
                ['Modelo Educativo', '/#modelo'],
                ['Oferta Académica', '/#oferta'],
                ['Horarios', '/#horarios'],
                ['Campus', '/#campus'],
                ['Servicios', '/#servicios'],
                ['Planteles', '/#planteles'],
                ['Contacto', '/#contacto'],
              ]).map(([label, href]) => (
                href.startsWith('#') ? (
                  <a key={label} href={href} className="nav-section-link">{label}</a>
                ) : (
                  <Link key={label} to={href} className="nav-section-link">{label}</Link>
                )
              ))}
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
