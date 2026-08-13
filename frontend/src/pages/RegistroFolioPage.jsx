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

  async function handleSubmit(event) {
    event.preventDefault();
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
    <section className="card auth-card">
      <h2>Crear cuenta con folio</h2>
      <p>
        Si control escolar ya te asigno un folio, completa tu registro aqui para activar tu cuenta.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Folio asignado
          <input
            id="registro-folio"
            name="folio"
            type="text"
            value={folio}
            onChange={(event) => setFolio(event.target.value)}
            placeholder="Ej. ALU-FOLIO-001"
            required
          />
        </label>

        <label>
          Correo institucional o personal
          <input
            id="registro-correo"
            name="correo"
            type="email"
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            placeholder="nombre@correo.com"
            required
          />
        </label>

        <label>
          Password
          <input
            id="registro-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo 8 caracteres recomendado"
            required
          />
        </label>

        {error ? <p className="error-box">{error}</p> : null}
        {message ? <p className="ok-box">{message}</p> : null}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Activando...' : 'Activar cuenta'}
        </button>
      </form>

      <p>
        Ya tienes cuenta activa? <Link to="/login">Ir a iniciar sesion</Link>
      </p>
    </section>
  );
}
