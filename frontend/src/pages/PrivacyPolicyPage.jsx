import { useEffect } from 'react';
import './PrivacyPolicyPage.css';

const sections = [
  {
    title: '1. Responsable y alcance',
    paragraphs: [
      'UNICEP Mérida, institución educativa que opera esta plataforma académica, es responsable del tratamiento de los datos personales que se recaban mediante este sitio. Esta política aplica al sitio público y a los servicios del portal para alumnos, docentes y personal administrativo.',
      'La plataforma está dirigida a la comunidad educativa. Algunos servicios, como el registro y la consulta de expedientes, pueden involucrar datos de estudiantes menores de edad; en esos casos, las solicitudes de privacidad también pueden ser realizadas por su madre, padre o tutor legal.',
    ],
  },
  {
    title: '2. Datos personales que podemos tratar',
    paragraphs: [
      'Según el servicio utilizado, podemos tratar datos de identificación y contacto, como nombre, folio o matrícula, correo electrónico y, cuando se proporcione para trámites escolares, CURP y documentos de identidad.',
      'También se tratan datos académicos y administrativos necesarios para operar los servicios educativos: carrera o programa, cuatrimestre, grupo, inscripciones, calificaciones, asistencia, trámites, pagos y configuración de boletas.',
      'Cuando se carga un documento al expediente, se procesa el archivo, su nombre, tipo y fecha de carga, junto con el identificador y enlace de su ubicación. El portal también conserva información técnica necesaria para proteger y mantener el servicio, como registros de solicitudes y eventos de autenticación.',
      'Las contraseñas se almacenan como valores protegidos mediante funciones de hash; no se guardan como texto legible.',
    ],
  },
  {
    title: '3. Finalidades del tratamiento',
    paragraphs: [
      'Utilizamos los datos para crear y proteger cuentas, verificar la identidad y el acceso, administrar la trayectoria académica, prestar servicios escolares, atender trámites y solicitudes, gestionar pagos y comprobantes, emitir boletas, mantener expedientes digitales y brindar soporte.',
      'Además, los datos técnicos y registros de actividad se usan para prevenir accesos no autorizados, investigar incidentes, corregir errores y mantener la disponibilidad e integridad de la plataforma.',
      'No vendemos datos personales ni los utilizamos para publicidad comportamental. Si se propone una finalidad distinta que requiera consentimiento, se solicitará la autorización que corresponda antes de realizar ese tratamiento.',
    ],
  },
  {
    title: '4. Expedientes y Google Drive',
    paragraphs: [
      'Cuando un usuario autorizado carga un documento de expediente, el archivo se envía a Google Drive mediante una cuenta institucional autorizada. El sistema organiza el expediente por carrera, cuatrimestre, grupo y alumno, usando la información académica disponible en la base de datos. En esta integración se guardan en el perfil del alumno el identificador y el enlace de su carpeta, y en el sistema escolar el enlace del archivo.',
      'La integración accede a Google Drive para crear y organizar carpetas institucionales y almacenar los archivos que se envían al expediente. Los datos obtenidos de las API de Google se utilizan para proporcionar y mantener esta función; no se venden, no se usan para publicidad y no se usan para entrenar modelos generalizados de inteligencia artificial o aprendizaje automático. Google procesa los datos necesarios para prestar el servicio conforme a sus propios términos y políticas de privacidad.',
      'La institución configura el acceso a las carpetas para fines escolares; el acceso depende de los permisos asignados en Drive. No cargues documentos que no sean necesarios para el trámite correspondiente.',
    ],
  },
  {
    title: '5. Transferencias y encargados',
    paragraphs: [
      'El acceso a los datos se limita al personal autorizado que los necesita para sus funciones académicas, administrativas, de soporte o seguridad. Podemos utilizar proveedores de infraestructura tecnológica y almacenamiento, incluido Google Drive para los expedientes, para operar los servicios descritos en esta política.',
      'No compartimos datos personales con terceros para que los usen con fines publicitarios propios. También podremos comunicar información cuando sea necesario para atender una obligación legal, una solicitud válida de autoridad competente o proteger los derechos y la seguridad de la comunidad, dentro de los límites aplicables.',
    ],
  },
  {
    title: '6. Conservación y seguridad',
    paragraphs: [
      'Conservamos los datos durante el tiempo necesario para prestar los servicios educativos y administrativos, mantener el expediente y cumplir las obligaciones institucionales y legales aplicables. Al dejar de ser necesarios, se eliminan o se disocian conforme a los procesos de conservación y depuración de la institución.',
      'Aplicamos medidas administrativas, técnicas y organizativas razonables, como controles de acceso por cuenta y función, autenticación, protección de credenciales, registros operativos y permisos de almacenamiento. Ninguna transmisión o almacenamiento en Internet puede garantizar seguridad absoluta; por ello también es importante que cada usuario proteja sus credenciales y cierre su sesión en dispositivos compartidos.',
    ],
  },
  {
    title: '7. Derechos y solicitudes de privacidad',
    paragraphs: [
      'Puedes solicitar acceso a tus datos, su rectificación cuando sean inexactos, la cancelación cuando proceda u oponerte a su tratamiento (derechos ARCO). También puedes pedir orientación sobre el tratamiento de tus datos o retirar el consentimiento cuando el tratamiento se base en él, sin afectar la legalidad del tratamiento realizado previamente.',
      'Para iniciar una solicitud, comunícate al 999 970 8200 o acude a un plantel de UNICEP Mérida y pide que tu solicitud de privacidad sea canalizada al área responsable. Indica tu nombre, una forma segura de contactarte, el derecho que deseas ejercer y la información que permita localizar los datos. Para proteger la información, podremos pedir verificación razonable de identidad o representación legal. La solicitud se atenderá conforme a la legislación aplicable.',
    ],
  },
  {
    title: '8. Cookies y almacenamiento local',
    paragraphs: [
      'El portal utiliza almacenamiento local del navegador para conservar el estado de autenticación mientras utilizas la plataforma. No incluyas información sensible en dispositivos compartidos y cierra sesión al terminar. Puedes borrar el almacenamiento del sitio desde la configuración de tu navegador; al hacerlo, es posible que debas iniciar sesión de nuevo.',
    ],
  },
  {
    title: '9. Cambios a esta política',
    paragraphs: [
      'Esta política puede actualizarse cuando cambien los servicios, las prácticas de tratamiento o los requisitos legales. La versión vigente estará publicada en esta dirección, con su fecha de actualización. Si el cambio afecta de manera relevante el tratamiento, se comunicará por los medios institucionales disponibles.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Aviso de privacidad | UNICEP Mérida';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <article className="privacy-policy">
      <header className="privacy-policy-header">
        <p className="privacy-policy-eyebrow">UNICEP Mérida</p>
        <h1>Aviso de privacidad</h1>
        <p className="privacy-policy-updated">Última actualización: 22 de octubre de 2026</p>
        <p>
          En UNICEP Mérida respetamos la privacidad de nuestra comunidad y protegemos
          los datos personales que se tratan al utilizar este sitio y su plataforma académica.
          Este aviso explica qué información se utiliza, para qué se usa y cómo puedes ejercer
          tus derechos.
        </p>
      </header>

      <nav className="privacy-policy-toc" aria-label="Contenido del aviso de privacidad">
        <strong>Contenido</strong>
        <ol>
          {sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#privacy-section-${index + 1}`}>{section.title.replace(/^\d+\.\s/, '')}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="privacy-policy-sections">
        {sections.map((section, index) => (
          <section id={`privacy-section-${index + 1}`} key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </div>

      <footer className="privacy-policy-contact">
        <h2>Contacto</h2>
        <p>UNICEP Mérida, Mérida, Yucatán, México.</p>
        <p>
          Teléfono de atención: <a href="tel:9999708200">999 970 8200</a>
        </p>
        <p>
          Consulta también la <a href="/#contacto">sección de contacto institucional</a>.
        </p>
      </footer>
    </article>
  );
}
