import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const correoValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="password-toggle-icon">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.88 5.09A9.77 9.77 0 0112 4c5 0 8.27 3.11 9.5 8-1.01 4-3.93 6.72-8.25 7.63"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.61 6.62C4.8 7.9 3.57 9.72 2.5 12c.69 2.33 2.33 4.84 5.27 6.38"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="password-toggle-icon">
      <path
        d="M2.5 12S6 4 12 4s9.5 8 9.5 8-3.5 8-9.5 8-9.5-8-9.5-8z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({ correo: false, password: false });

  const correoLimpio = correo.trim();
  const errores = {
    correo: !correoLimpio
      ? 'Ingresa tu correo electrónico institucional o personal.'
      : !correoValido(correoLimpio)
        ? 'Escribe un correo válido, por ejemplo nombre@dominio.com.'
        : '',
    password: !password
      ? 'Ingresa tu contraseña para continuar.'
      : password.length < 8
        ? 'La contraseña debe tener al menos 8 caracteres.'
        : '',
  };
  const formularioValido = !errores.correo && !errores.password;

  function marcarCampo(campo) {
    setTouched((actual) => ({ ...actual, [campo]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ correo: true, password: true });

    if (!formularioValido) {
      setError('Corrige los campos marcados antes de continuar.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const auth = await login({
        correo: correo.trim(),
        password,
      });

      if (['director', 'control_escolar', 'coordinacion_academica', 'soporte_ti'].includes(auth.user?.rol)) {
        navigate('/administrativo', { replace: true });
      } else if (auth.user?.rol === 'maestro') {
        navigate('/docente', { replace: true });
      } else {
        navigate('/alumno', { replace: true });
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell">
      <article className="auth-card">
        <p className="auth-eyebrow">Acceso institucional</p>
        <h2>Iniciar sesión</h2>
        <p className="auth-intro">
          Ingresa con tu correo electrónico y tu contraseña para acceder a la plataforma académica.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className={`field-group ${touched.correo && errores.correo ? 'field-group-error' : touched.correo ? 'field-group-success' : ''}`}>
            Correo electrónico
            <input
              id="login-correo"
              name="correo"
              type="email"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
              onBlur={() => marcarCampo('correo')}
              placeholder="ejemplo@unicep.edu.mx"
              required
              aria-invalid={touched.correo && errores.correo ? 'true' : 'false'}
            />
            <span className={`field-help ${touched.correo && errores.correo ? 'field-help-error' : ''}`}>
              {touched.correo && errores.correo ? errores.correo : 'Usa el correo con el que activaste tu cuenta.'}
            </span>
          </label>

          <label className={`field-group ${touched.password && errores.password ? 'field-group-error' : touched.password && !errores.password ? 'field-group-success' : ''}`}>
            Contraseña
            <div className="password-field">
              <input
                id="login-password"
                name="password"
                type={mostrarPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => marcarCampo('password')}
                required
                placeholder="Escribe tu contraseña"
                aria-invalid={touched.password && errores.password ? 'true' : 'false'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setMostrarPassword((valor) => !valor)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon visible={mostrarPassword} />
              </button>
            </div>
            <span className={`field-help ${touched.password && errores.password ? 'field-help-error' : ''}`}>
              {touched.password && errores.password ? errores.password : 'Debe coincidir con la contraseña registrada en tu cuenta.'}
            </span>
          </label>

          {error ? <p className="error-box">{error}</p> : null}

          <button type="submit" className="btn-primary auth-submit" disabled={loading || !formularioValido}>
            {loading ? 'Validando acceso...' : 'Entrar a mi cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Te asignaron folio y todavía no activas tu cuenta?{' '}
          <Link to="/registro-folio">Actívala aquí</Link>.
        </p>
      </article>
    </section>
  );
}
