import { QRCodeSVG } from 'qrcode.react';

export interface InvitationCardData {
  loginName: string;
  /** Einladungscode (einmalig, nur im Speicher der Seite). */
  code: string;
  /** ISO 8601; "gültig bis" erscheint nur, wenn der Anmeldedienst das Ablaufdatum nennt. */
  validUntil?: string | null;
}

interface Props {
  cards: InvitationCardData[];
  schoolName: string;
  /** Web-Origin der Plattform, z. B. `https://schule.example`; sie steht im QR-Code und in der Eingabe-Zeile. */
  origin: string;
}

/** Link, den der QR-Code der Einladungskarte enthaelt. */
export function invitationUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/einladung?code=${encodeURIComponent(code)}`;
}

function enterAt(origin: string): string {
  return `${origin.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/einladung`;
}

/**
 * Einladungskarten (GLOSSARY.md): je 10 x 3 cm mit QR-Code links und Text rechts. Die Komponente nimmt eine
 * Liste auf (spaeter der Klassen-Druck). `@media print` (styles.css) legt sie auf A4 im Raster 2 x 9 mit Schnittlinien aus.
 */
export default function InvitationCards({ cards, schoolName, origin }: Props) {
  return (
    <div className="invitation-sheet">
      {cards.map((card) => (
        <article className="invitation-card" key={card.code}>
          <div className="invitation-card__qr" data-testid="invitation-qr" data-qr-value={invitationUrl(origin, card.code)}>
            <QRCodeSVG value={invitationUrl(origin, card.code)} level="M" marginSize={1} size={128} bgColor="#ffffff" fgColor="#000000" />
          </div>
          <div className="invitation-card__text">
            <p className="invitation-card__school">{schoolName}</p>
            <p className="invitation-card__name">{card.loginName}</p>
            <p className="invitation-card__code">{card.code}</p>
            {card.validUntil && <p className="invitation-card__small">gültig bis {new Date(card.validUntil).toLocaleDateString('de-DE')}</p>}
            <p className="invitation-card__small">Code scannen oder unter {enterAt(origin)} eingeben</p>
          </div>
        </article>
      ))}
    </div>
  );
}
