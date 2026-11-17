import { useState } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import { portals, type PortalId } from './app/routes';



export default function App() {
  const [active, setActive] = useState<PortalId>('teacher');
  const [menuOpen, setMenuOpen] = useState(false);
  const portal = portals.find((p) => p.id === active)!;

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Schulplattform</span>
        <Button
          variant="ghost"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menü
        </Button>
      </header>
      <nav id="main-nav" aria-label="Hauptnavigation" className={menuOpen ? 'nav nav-open' : 'nav'}>
        {portals.map((p) => (
          <a
            key={p.id}
            href={p.path}
            aria-current={p.id === active ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActive(p.id);
              setMenuOpen(false);
            }}
          >
            {p.label}
          </a>
        ))}
      </nav>
      <main className="content">
        <h1>{portal.label}</h1>
        <Card>
          <p>{portal.description}</p>
        </Card>
      </main>
    </div>
  );
}
