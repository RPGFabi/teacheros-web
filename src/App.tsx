export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TeacherOS</p>
          <h1>Schulmanagement & Unterrichts-OS</h1>
        </div>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Core</h2>
          <ul>
            <li>Schuljahre und Klassen</li>
            <li>Lehrkräfte und Berechtigungen</li>
            <li>Stammdaten und Imports</li>
          </ul>
        </article>

        <article className="card">
          <h2>Bewertung</h2>
          <ul>
            <li>ICE-Schnellerfassung</li>
            <li>Beobachtungen und Noten</li>
            <li>Feedbackvorlagen</li>
          </ul>
        </article>

        <article className="card">
          <h2>Unterricht</h2>
          <ul>
            <li>Stundenplan und Terminlogik</li>
            <li>Klassenbuch und Stoffplan</li>
            <li>Anwesenheit und Materialien</li>
          </ul>
        </article>

        <article className="card">
          <h2>Schule</h2>
          <ul>
            <li>Formulare und Rückläufer</li>
            <li>Nachrichten und Benachrichtigungen</li>
            <li>Vertretungen und Ausplanung</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
