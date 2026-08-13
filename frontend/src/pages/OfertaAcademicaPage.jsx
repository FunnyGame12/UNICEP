import { Link } from 'react-router-dom';

export default function OfertaAcademicaPage() {
  return (
    <section className="card auth-card">
      <p className="hero-badge">Oferta academica</p>
      <h2>Programas y planes de estudio</h2>
      <p>
        Aqui se concentran las carreras, materias y lineas formativas disponibles
        para alumnos y aspirantes.
      </p>

      <div className="quick-links hero-actions">
        <Link to="/login">Ir al acceso</Link>
        <Link to="/registro-folio">Activar cuenta</Link>
      </div>
    </section>
  );
}