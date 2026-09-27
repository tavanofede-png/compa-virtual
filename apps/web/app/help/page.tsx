import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ayuda · Kusiy" };

export default function HelpPage() {
  return <main className="public-help">
    <a href="/">← Volver a Kusiy</a>
    <p className="eyebrow">KUSIY · AYUDA</p>
    <h1>¿Necesitás ayuda?</h1>
    <p>Si tenés una cuenta, entrá a <strong>Ajustes → Ayuda y soporte</strong> para enviar una consulta y ver las respuestas del equipo. No ofrecemos atención humana inmediata durante las 24 horas.</p>
    <section><h2>No puedo entrar</h2><p>En la pantalla de ingreso elegí <strong>Olvidé mi contraseña</strong> y revisá el correo de tu cuenta. Si ya tenés una sesión abierta en otro dispositivo, podés crear una consulta desde allí.</p></section>
    <section><h2>Un archivo o una sesión no se guardó</h2><p>Volvé a abrir la app con conexión y comprobá si aparece en Materiales o en el historial. Si continúa el problema, enviá una consulta desde tu cuenta con el nombre del material o el momento aproximado, sin adjuntar contraseñas.</p></section>
    <section><h2>Algo pasó en un encuentro</h2><p>Usá <strong>Reportar</strong> o <strong>Bloquear</strong> en el chat del encuentro. También podés crear una consulta de categoría Seguridad. Si hay peligro inmediato, buscá ayuda de un adulto de confianza o de los servicios de emergencia de tu localidad.</p></section>
    <a className="public-help-action" href="/">Ir a Kusiy</a>
  </main>;
}
