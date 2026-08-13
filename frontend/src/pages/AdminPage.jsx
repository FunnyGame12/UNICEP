import { useEffect, useState } from 'react';
import api from '../services/api';

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    id_alumno: '',
    id_materia: '',
    grupo: '',
  });

  const [form, setForm] = useState({
    id_alumno: '',
    id_materia: '',
    grupo: '',
  });

  async function loadAsignaciones() {
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (filters.id_alumno.trim()) params.id_alumno = filters.id_alumno.trim();
      if (filters.id_materia.trim()) params.id_materia = filters.id_materia.trim();
      if (filters.grupo.trim()) params.grupo = filters.grupo.trim();

      const response = await api.get('/admin/alumno-grupos', { params });
      setItems(response.data.items || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo consultar alumno-grupos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsignaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/admin/alumno-grupos', {
        id_alumno: Number(form.id_alumno),
        id_materia: Number(form.id_materia),
        grupo: form.grupo.trim(),
      });

      setMessage('Asignacion guardada correctamente.');
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la asignacion.');
    }
  }

  async function handleDelete(idAlumno, idMateria) {
    setError('');
    setMessage('');

    try {
      await api.delete(`/admin/alumno-grupos/${idAlumno}/${idMateria}`);
      setMessage('Asignacion eliminada.');
      await loadAsignaciones();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar la asignacion.');
    }
  }

  return (
    <section className="card admin-panel">
      <h2>Panel Administrativo - Alumno Grupo</h2>
      <p>Gestion de altas, actualizaciones y bajas de asignacion por materia y grupo.</p>

      <form className="form-grid" onSubmit={handleSave}>
        <h3>Asignar o actualizar</h3>

        <label>
          ID Alumno
          <input
            id="asignacion-id-alumno"
            name="id_alumno"
            type="number"
            min="1"
            value={form.id_alumno}
            onChange={(event) => setForm((prev) => ({ ...prev, id_alumno: event.target.value }))}
            required
          />
        </label>

        <label>
          ID Materia
          <input
            id="asignacion-id-materia"
            name="id_materia"
            type="number"
            min="1"
            value={form.id_materia}
            onChange={(event) => setForm((prev) => ({ ...prev, id_materia: event.target.value }))}
            required
          />
        </label>

        <label>
          Grupo
          <input
            id="asignacion-grupo"
            name="grupo"
            type="text"
            value={form.grupo}
            onChange={(event) => setForm((prev) => ({ ...prev, grupo: event.target.value }))}
            placeholder="A1"
            required
          />
        </label>

        <button type="submit" className="btn-primary">Guardar asignacion</button>
      </form>

      <form
        className="form-grid filter-box"
        onSubmit={(event) => {
          event.preventDefault();
          loadAsignaciones();
        }}
      >
        <h3>Filtros de consulta</h3>

        <label>
          ID Alumno
          <input
            id="filtro-id-alumno"
            name="filtro_id_alumno"
            type="number"
            min="1"
            value={filters.id_alumno}
            onChange={(event) => setFilters((prev) => ({ ...prev, id_alumno: event.target.value }))}
          />
        </label>

        <label>
          ID Materia
          <input
            id="filtro-id-materia"
            name="filtro_id_materia"
            type="number"
            min="1"
            value={filters.id_materia}
            onChange={(event) => setFilters((prev) => ({ ...prev, id_materia: event.target.value }))}
          />
        </label>

        <label>
          Grupo
          <input
            id="filtro-grupo"
            name="filtro_grupo"
            type="text"
            value={filters.grupo}
            onChange={(event) => setFilters((prev) => ({ ...prev, grupo: event.target.value }))}
            placeholder="A1"
          />
        </label>

        <button type="submit" className="btn-secondary">Consultar</button>
      </form>

      {message ? <p className="ok-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Alumno</th>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Fecha Alta</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">Cargando...</td>
              </tr>
            ) : null}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan="6">Sin resultados.</td>
              </tr>
            ) : null}

            {!loading
              ? items.map((item) => (
                <tr key={item.id_alumno_grupo}>
                  <td>{item.id_alumno_grupo}</td>
                  <td>{item.id_alumno}</td>
                  <td>{item.id_materia}</td>
                  <td>{item.grupo}</td>
                  <td>{new Date(item.fecha_alta).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleDelete(item.id_alumno, item.id_materia)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
