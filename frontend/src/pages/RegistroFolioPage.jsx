import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function RegistroFolioPage() {
  const navigate = useNavigate();

  const [folio, setFolio] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState({ folio: false, correo: false, password: false });

  const errores = {
    folio: !folio.trim() ? 'Ingresa el folio que te proporcionó control escolar.' : '',
    correo: !correo.trim()
      ? 'Ingresa un correo para activar tu cuenta.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
        ? 'Escribe un correo válido.'
        : '',
    password: !password
      ? 'Crea una contraseña para continuar.'
      : password.length < 8
        ? 'Usa al menos 8 caracteres.'
        : '',
  };
  const formularioValido = !errores.folio && !errores.correo && !errores.password;

  function marcarCampo(campo) {
    setTouched((actual) => ({ ...actual, [campo]: true }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ folio: true, correo: true, password: true });
    if (!formularioValido) {
      setError('Revisa los campos marcados antes de continuar.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/registro-folio', {
        folio_matricula: folio.trim(),
        correo: correo.trim().toLowerCase(),
        password,
      });

      setMessage(response.data?.message || 'Cuenta activada. Ya puedes iniciar sesion.');

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo activar la cuenta con folio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-shell registration-shell">
      <article className="auth-card registration-card">
        <p className="auth-eyebrow">Activación institucional</p>
        <h2>Crear cuenta con folio</h2>
        <p className="auth-intro">
          Si control escolar ya te asignó un folio, completa tu registro aquí para activar tu cuenta.
        </p>

        <form className="form-grid registration-form" onSubmit={handleSubmit}>
        <label className={`field-group ${touched.folio && errores.folio ? 'field-group-error' : touched.folio ? 'field-group-success' : ''}`}>
          Folio asignado
          <input
            id="registro-folio"
            name="folio"
            type="text"
            value={folio}
            onChange={(event) => setFolio(event.target.value)}
            onBlur={() => marcarCampo('folio')}
            placeholder="Ej. ALU-FOLIO-001"
            autoComplete="one-time-code"
            aria-describedby="registro-folio-help"
            aria-invalid={touched.folio && errores.folio ? 'true' : 'false'}
            required
          />
          <span id="registro-folio-help" className={`field-help ${touched.folio && errores.folio ? 'field-help-error' : ''}`}>
            {touched.folio && errores.folio ? errores.folio : 'Escribe el folio exactamente como aparece en tu documento.'}
          </span>
        </label>

        <label className={`field-group ${touched.correo && errores.correo ? 'field-group-error' : touched.correo ? 'field-group-success' : ''}`}>
          Correo institucional o personal
          <input
            id="registro-correo"
            name="correo"
            type="email"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            onBlur={() => marcarCampo('correo')}
            placeholder="nombre@correo.com"
            autoComplete="email"
            aria-describedby="registro-correo-help"
            aria-invalid={touched.correo && errores.correo ? 'true' : 'false'}
            required
          />
          <span id="registro-correo-help" className={`field-help ${touched.correo && errores.correo ? 'field-help-error' : ''}`}>
            {touched.correo && errores.correo ? errores.correo : 'Usaremos este correo para tu acceso institucional.'}
          </span>
        </label>

        <label className={`field-group ${touched.password && errores.password ? 'field-group-error' : touched.password ? 'field-group-success' : ''}`}>
          Password
          <input
            id="registro-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => marcarCampo('password')}
            placeholder="Minimo 8 caracteres recomendado"
            autoComplete="new-password"
            aria-describedby="registro-password-help"
            aria-invalid={touched.password && errores.password ? 'true' : 'false'}
            required
          />
          <span id="registro-password-help" className={`field-help ${touched.password && errores.password ? 'field-help-error' : ''}`}>
            {touched.password && errores.password ? errores.password : 'Mínimo 8 caracteres.'}
          </span>
        </label>

          {error ? <p className="error-box" role="alert" aria-live="polite">{error}</p> : null}
          {message ? <p className="ok-box" role="status" aria-live="polite">{message}</p> : null}

          <button type="submit" className="btn-primary" disabled={loading || !formularioValido}>
            {loading ? 'Activando...' : 'Activar cuenta'}
          </button>
        </form>

        <p className="registration-login-prompt">
          ¿Ya tienes cuenta activa? <Link to="/login">Ir a iniciar sesión</Link>
        </p>
      </article>
    </section>
  );
}
