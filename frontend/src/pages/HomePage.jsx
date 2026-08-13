import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const ofertas = [
  { label: 'Administración', file: 'ADMINISTRACION.PDF' },
  { label: 'Contabilidad', file: 'CONTABILIDAD.PDF' },
  { label: 'Derecho', file: 'DERECHO.PDF' },
  { label: 'Pedagogía', file: 'PEDAGOGIA.PDF' },
  { label: 'Psicología', file: 'PSICOLOGIA.PDF' },
  { label: 'Prepa', file: 'PREPA.PDF' },
];

const campusAreas = [
  {
    id: 'licenciaturas',
    title: 'Campus Licenciaturas',
    subtitle: 'Educación Superior',
    description:
      'Espacios ejecutivos orientados a las licenciaturas, con enfoque profesional y ambientes de trabajo colaborativo.',
    images: [
      { label: 'Campus Licenciaturas Mérida', src: '/images/campus/Campus_Merida.jpeg' },
      { label: 'Aula de licenciaturas con alumnos', src: '/images/campus/Salon_con_alumnos2.jpeg' },
      { label: 'Salón académico de licenciaturas', src: '/images/campus/Salo_con_alumnos1.jpeg' },
    ],
  },
  {
    id: 'prepa',
    title: 'Campus Prepa',
    subtitle: 'Educación Media Superior',
    description:
      'Instalaciones enfocadas en bachillerato, con ambientes formativos para la etapa previa al ingreso universitario.',
    images: [
      { label: 'Campus Prepa UNICEP', src: '/images/campus/Campus_prepa.jpeg' },
      { label: 'Área académica Prepa 1', src: '/images/campus/prepa1.jpeg' },
      { label: 'Área académica Prepa 2', src: '/images/campus/prepa2.jpeg' },
      { label: 'Área académica Prepa 3', src: '/images/campus/prepa3.jpeg' },
      { label: 'Área académica Prepa 4', src: '/images/campus/prepa4.jpeg' },
      { label: 'Área académica Prepa 5', src: '/images/campus/prepa5.jpeg' },
    ],
  },
];

const initialCampusSelection = campusAreas.reduce((selection, area) => {
  selection[area.id] = area.images[0];
  return selection;
}, {});

const horarios = [
  {
    modalidad: 'Rango de Horario Oficial',
    periodo: 'Entre Semana',
    turno: 'Clases Entre Semana',
    horario: '5:00 PM - 9:00 PM',
    descripcion: 'Clases presenciales y ejecutivas para profesionales que estudian entre semana.',
  },
  {
    modalidad: 'Rango de Horario Oficial',
    periodo: 'Fin de Semana',
    turno: 'Turno Matutino',
    horario: '7:00 AM - 1:20 PM',
    descripcion: 'Clases sabatino/dominical en horario matutino para mayor flexibilidad.',
  },
  {
    modalidad: 'Rango de Horario Oficial',
    periodo: 'Fin de Semana',
    turno: 'Turno Vespertino',
    horario: '2:00 PM - 8:20 PM',
    descripcion: 'Turno vespertino con actividades académicas y espacios de apoyo complementario.',
  },
];

const campusServicios = [
  {
    icono: '👥',
    titulo: 'Equipo de Asesores',
    descripcion: 'Acompañamiento docente y académico personalizado constante.',
  },
  {
    icono: '📚',
    titulo: 'Biblioteca 24/7',
    descripcion: 'Acceso a recursos de información físicos y digitales en cualquier momento.',
  },
  {
    icono: '🩺',
    titulo: 'Clínica Universitaria',
    descripcion: 'Ecosistema de práctica real y vinculación social para el alumnado.',
  },
  {
    icono: '🎬',
    titulo: 'Cineteca 24/7',
    descripcion: 'Espacios culturales y de proyección audiovisual multimedia.',
  },
];

const planteles = [
  {
    titulo: 'Plantel Universitario',
    nivel: 'Educación Superior',
    direccion: 'Calle 90 #477, cerca de la Avenida Itzaes, Mérida, Yucatán, México.',
    referencia: 'Acceso por Avenida Itzaes; rodeado de circuitos viales principales de la ciudad.',
    mapaUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+90+%23477+Mérida+Yucatán',
  },
  {
    titulo: 'Plantel Preparatoria',
    nivel: 'Educación Media Superior',
    direccion: 'Calle 60 #729 por calle 91, Colonia Centro, Mérida, Yucatán, México.',
    referencia: 'Ubicado en el centro histórico, a pocos pasos de Plaza Grande y principales servicios.',
    mapaUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+60+%23729+Colonia+Centro+Mérida+Yucatán',
  },
];

const programas = [
  {
    title: 'Lic. en Administración de Empresas',
    description:
      'Desarrollo de habilidades gerenciales, dirección estratégica, finanzas, emprendimiento y optimización de recursos organizacionales.',
    status: 'RVOE: 20090174 · Centro Ed. de Puebla',
  },
  {
    title: 'Lic. en Derecho',
    description:
      'Formación jurídica sólida en litigio, derecho corporativo, civil y constitucional con una perspectiva ética y de procuración de justicia.',
    status: 'Vigente SEP',
  },
  {
    title: 'Lic. en Contabilidad',
    description:
      'Especialización en auditoría, consultoría fiscal, finanzas corporativas, gestión presupuestal y análisis de riesgo en los negocios.',
    status: 'Vigente SEP',
  },
  {
    title: 'Lic. en Pedagogía',
    description:
      'Diseño curricular, innovación en los procesos de enseñanza-aprendizaje, gestión de instituciones educativas y evaluación pedagógica.',
    status: 'Vigente SEP',
  },
  {
    title: 'Lic. en Psicología',
    description:
      'Análisis del comportamiento humano con aplicaciones prácticas en los ámbitos clínico, laboral, corporativo y socioeducativo.',
    status: 'Vigente SEP',
  },
  {
    title: 'Preparatoria',
    description:
      'Formación de nivel medio superior en un entorno maduro, humanista y con valores sólidos. Preparación clave para el éxito universitario.',
    status: 'Nivel Medio Superior',
  },
];

export default function HomePage() {
  const [selectedOffer, setSelectedOffer] = useState(ofertas[0]);
  const [selectedCampusByArea, setSelectedCampusByArea] = useState(initialCampusSelection);
  const [viewerError, setViewerError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [isMobilePdfMode, setIsMobilePdfMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 760px)').matches;
  });
  const buildPdfUrl = (file) => {
    const path = encodeURI(`/pdf/${file}`);
    return typeof window === 'undefined' ? path : new URL(path, window.location.origin).href;
  };

  const handleOfferSelect = (oferta) => {
    setViewerError('');
    setSelectedOffer(oferta);
  };

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    if (isMobilePdfMode) {
      setPdfBlobUrl('');
      return undefined;
    }

    setViewerError('');
    fetch(selectedOfferPdfUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`No se pudo cargar el PDF (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setViewerError('No se pudo cargar el documento. Intenta seleccionar de nuevo.');
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isMobilePdfMode, selectedOfferPdfUrl]);

  const handleCampusImageSelect = (areaId, image) => {
    setSelectedCampusByArea((current) => ({
      ...current,
      [areaId]: image,
    }));
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 760px)');

    const syncMobileMode = (event) => {
      setIsMobilePdfMode(event.matches);
    };

    setIsMobilePdfMode(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMobileMode);
      return () => mediaQuery.removeEventListener('change', syncMobileMode);
    }

    mediaQuery.addListener(syncMobileMode);
    return () => mediaQuery.removeListener(syncMobileMode);
  }, []);

  const selectedOfferPdfUrl = buildPdfUrl(selectedOffer.file);
  const openSelectedPdf = () => {
    window.location.assign(selectedOfferPdfUrl);
  };

  return (
    <main className="hero-page">
      <section id="inicio" className="hero">
        <div className="hero-copy">
          <p className="hero-badge">Plataforma Institucional</p>
          <h1>Plataforma Académica UNICEP</h1>
          <p className="hero-subtitle">
            Innovación, tecnología y educación en un solo lugar.
          </p>

          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary">
              Explorar Plataforma
            </Link>
            <a href="#quienes-somos" className="btn btn-outline">
              Conocer Más
            </a>
          </div>
        </div>
      </section>

      <section id="quienes-somos" className="institucional-section">
        <div className="section-header">
          <span className="hero-badge">Identidad Institucional</span>
          <h2>Quiénes Somos</h2>
        </div>

        <div className="institucional-grid">
          <article className="institution-card">
            <h3>Misión Institucional</h3>
            <p>
              "Ser la UNIVERSIDAD HUMANISTA con el compromiso de fomentar en los estudiantes nuestra filosofía de vida competitiva, altruista y visionaria para crear Destinos Sólidos."
            </p>
          </article>

          <article className="institution-card">
            <h3>Visión de Futuro</h3>
            <p>
              "Ser reconocidos en la formación profesional creando destinos de éxito y liderazgo, nos proyectamos como el espacio ejecutivo donde el estudiante alcanza su máximo potencial Siempre Respetando su Esencia."
            </p>
          </article>

          <article className="institution-card">
            <h3>Lema Universitario</h3>
            <p>
              "Crear destinos respetando esencias."
            </p>
          </article>

          <article className="institution-card">
            <h3>Pilares de la Filosofía de Vida UNICEP</h3>
            <div className="pillar-list">
              <div>
                <strong>Competitiva:</strong>
                <span>
                  Orientada a la excelencia académica y herramientas prácticas para destacar con éxito en los mercados corporativos actuales.
                </span>
              </div>
              <div>
                <strong>Altruista:</strong>
                <span>
                  Centrada en el sentido humanista, la ética profesional y el compromiso real hacia el bienestar y desarrollo social.
                </span>
              </div>
              <div>
                <strong>Visionaria:</strong>
                <span>
                  Enfocada en la innovación constante, la anticipación a las tendencias globales y la formación de líderes de cambio.
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section id="modelo" className="modelo-section">
        <div className="section-subheader">
          <span className="hero-badge">Oferta Académica y Modelo Educativo</span>
          <h3>Parámetros Generales de los Programas</h3>
        </div>

        <div className="modelo-parameters">
          <div>
            <strong>Duración:</strong>
            <span>3 años / 9 cuatrimestres (Licenciaturas).</span>
          </div>
          <div>
            <strong>Modalidad de Estudio:</strong>
            <span>Ejecutiva, Centrada en el desarrollo humano, 100% Flexible combinando clases presenciales intensivas y área virtual.</span>
          </div>
          <div>
            <strong>Certificación:</strong>
            <span>Titulación con Validez Oficial SEP (RVOE Federal Vigente). Incluye título, certificado y carta de pasante.</span>
          </div>
        </div>

        <div className="program-grid">
          {programas.map((program) => (
            <article key={program.title} className="program-card">
              <header>
                <h4>{program.title}</h4>
                <p className="program-status">{program.status}</p>
              </header>
              <p>{program.description}</p>
              <footer>
                <span>Duración: 3 años / 9 cuatrimestres</span>
                <span>Modalidad Ejecutiva / Flexible</span>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section id="oferta" className="oferta-section">
        <div className="section-header">
          <span className="hero-badge">Oferta Académica</span>
          <h2>Selecciona una oferta para verla en PDF</h2>
          <p>
            Revisa las carreras y planes disponibles directamente en este visor de documentos.
          </p>
        </div>

        <div className="oferta-grid">
          <aside className="oferta-list">
            {ofertas.map((oferta) => (
              <button
                key={oferta.file}
                type="button"
                className={`oferta-item ${selectedOffer.file === oferta.file ? 'active' : ''}`}
                onClick={() => {
                  handleOfferSelect(oferta);
                }}
              >
                {oferta.label}
              </button>
            ))}
          </aside>

          <section className="oferta-viewer">
            <div className="viewer-header">
              <span>Visualizando:</span>
              <strong>{selectedOffer.label}</strong>
            </div>

            {isMobilePdfMode ? (
              <div className="oferta-mobile-card">
                <p>
                  En celular te mostramos el documento en pantalla completa para mejor lectura.
                </p>
                <div className="oferta-mobile-actions">
                  <button
                    type="button"
                    onClick={openSelectedPdf}
                    className="btn btn-primary oferta-mobile-btn"
                  >
                    Abrir PDF
                  </button>
                  <a
                    href={selectedOfferPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={selectedOffer.file}
                    className="btn btn-outline oferta-mobile-btn"
                  >
                    Descargar PDF
                  </a>
                </div>
              </div>
            ) : viewerError ? (
              <div className="feature-card" role="alert">
                <p>{viewerError}</p>
              </div>
            ) : !pdfBlobUrl ? (
              <div className="feature-card" role="status">
                <p>Cargando documento...</p>
              </div>
            ) : (
              <iframe
                key={selectedOffer.file}
                title={`Oferta PDF ${selectedOffer.label}`}
                src={pdfBlobUrl}
                className="oferta-iframe"
              />
            )}
          </section>
        </div>
      </section>

      <section id="horarios" className="schedule-section feature-card">
        <div className="section-header">
          <span className="hero-badge">Horarios Flexibles</span>
          <h2>Esquema de horarios con valores de flexibilidad</h2>
          <p>Modalidades de clase para atender a estudiantes ejecutivos y estudiantes que prefieren fines de semana.</p>
        </div>

        <div className="schedule-grid">
          {horarios.map((item) => (
            <article key={`${item.periodo}-${item.turno}`} className="schedule-card">
              <div>
                <span className="schedule-label">{item.modalidad}</span>
                <h3>{item.turno}</h3>
                <p>{item.periodo}</p>
              </div>
              <div className="schedule-time">{item.horario}</div>
              <p>{item.descripcion}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hero-panels hero-panels-campus">
        <article id="campus" className="campus-card feature-card">
          <div className="campus-intro">
            <h2>Campus</h2>
            <p>
              Recorre visualmente nuestros dos espacios en Mérida y distingue el entorno de Licenciaturas y el de Prepa.
            </p>
          </div>

          <div className="campus-groups">
            {campusAreas.map((area) => {
              const selectedCampus = selectedCampusByArea[area.id] || area.images[0];

              return (
                <section key={area.id} className={`campus-group-card campus-group-${area.id}`}>
                  <header className="campus-group-header">
                    <span className="campus-group-badge">{area.subtitle}</span>
                    <h3>{area.title}</h3>
                    <p>{area.description}</p>
                  </header>

                  <div className="campus-gallery showcase">
                    <div className="campus-main-image">
                      <img src={selectedCampus.src} alt={selectedCampus.label} />
                    </div>
                    <div className="campus-main-caption">{selectedCampus.label}</div>

                    <div className="campus-thumbnails">
                      {area.images.map((image) => (
                        <button
                          key={image.src}
                          type="button"
                          className={`thumbnail-button ${selectedCampus.src === image.src ? 'active' : ''}`}
                          onClick={() => handleCampusImageSelect(area.id, image)}
                        >
                          <img src={image.src} alt={image.label} />
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </article>
      </section>

      <section id="servicios" className="service-section">
        <div className="section-header">
          <span className="hero-badge">Servicios de Valor Agregado</span>
          <h2>Soporte integral del campus</h2>
          <p>Espacios y servicios diseñados para acompañar el proceso académico y cultural del estudiante.</p>
        </div>

        <div className="service-grid">
          {campusServicios.map((servicio) => (
            <article key={servicio.titulo} className="service-card">
              <div className="service-icon">{servicio.icono}</div>
              <h3>{servicio.titulo}</h3>
              <p>{servicio.descripcion}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planteles" className="plantel-section feature-card">
        <div className="section-header">
          <span className="hero-badge">Planteles Mérida</span>
          <h2>Infraestructura y direcciones físicas</h2>
          <p>Ubica cada plantel exacto según el nivel educativo de tu interés y accede directamente a la navegación.</p>
        </div>

        <div className="plantel-grid">
          {planteles.map((plantel) => (
            <article key={plantel.titulo} className="plantel-card">
              <div className="plantel-card-header">
                <div>
                  <h3>{plantel.titulo}</h3>
                  <p className="plantel-level">{plantel.nivel}</p>
                </div>
                <a
                  href={plantel.mapaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="map-link"
                >
                  Ver en Google Maps
                </a>
              </div>
              <p className="plantel-address">{plantel.direccion}</p>
              <p>{plantel.referencia}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contacto" className="contact-section feature-card">
        <div className="section-header">
          <span className="hero-badge">Atención y Soporte</span>
          <h2>Contacto</h2>
          <p>
            Estamos listos para atenderte por llamada o por redes sociales.
          </p>
        </div>

        <div className="contact-grid">
          <article className="contact-card">
            <h3>Número de contacto de atención</h3>
            <a href="tel:9999708200" className="contact-link-primary">
              999 970 8200
            </a>
            <p>Llámanos para informes académicos, inscripciones y soporte general.</p>
          </article>

          <article className="contact-card">
            <h3>Redes sociales</h3>
            <div className="contact-social-list">
              <a
                href="https://www.facebook.com/search/top/?q=Unicep%20M%C3%A9rida"
                target="_blank"
                rel="noreferrer"
                className="contact-social-link"
              >
                Unicep Mérida (Facebook)
              </a>
              <a
                href="https://www.instagram.com/unicep_punto_evolutivo/"
                target="_blank"
                rel="noreferrer"
                className="contact-social-link"
              >
                Unicep_punto_evolutivo (Instagram)
              </a>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
