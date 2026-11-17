import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InvitationCards, { invitationUrl } from './InvitationCards';

const ORIGIN = 'https://schule.example.test';
const CARD = { loginName: 'schueler.eins', code: 'ABCD-EFGH-JKMN-PQRS' };

describe('Einladungskarte', () => {
  it('zeigt Schule, Anmeldename, Code und die Eingabe-Zeile', () => {
    render(<InvitationCards cards={[CARD]} schoolName="Goethe-Schule" origin={ORIGIN} />);

    const card = screen.getByRole('article');
    expect(within(card).getByText('Goethe-Schule')).toBeInTheDocument();
    expect(within(card).getByText('schueler.eins')).toBeInTheDocument();
    expect(within(card).getByText('ABCD-EFGH-JKMN-PQRS')).toBeInTheDocument();
    expect(card).toHaveTextContent('Code scannen oder unter schule.example.test/einladung eingeben');
  });

  it('setzt den Einladungslink mit dem Code in den QR-Code', () => {
    const { container } = render(<InvitationCards cards={[CARD]} schoolName="Goethe-Schule" origin={ORIGIN} />);

    const qr = screen.getByTestId('invitation-qr');
    expect(qr).toHaveAttribute('data-qr-value', 'https://schule.example.test/einladung?code=ABCD-EFGH-JKMN-PQRS');
    expect(qr.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('kodiert Sonderzeichen im Code und kappt einen Schraegstrich am Ende der Origin', () => {
    expect(invitationUrl('https://schule.example.test/', 'A B&C')).toBe('https://schule.example.test/einladung?code=A%20B%26C');
  });

  it('zeigt "gueltig bis" nur, wenn das Datum bekannt ist', () => {
    const { rerender } = render(<InvitationCards cards={[CARD]} schoolName="S" origin={ORIGIN} />);
    expect(screen.queryByText(/gültig bis/i)).not.toBeInTheDocument();

    rerender(<InvitationCards cards={[{ ...CARD, validUntil: '2026-11-20T12:00:00+00:00' }]} schoolName="S" origin={ORIGIN} />);
    expect(screen.getByText('gültig bis 20.11.2026')).toBeInTheDocument();
  });

  it('nimmt mehrere Karten auf, je mit eigenem Code und eigenem QR-Wert', () => {
    const cards = [CARD, { loginName: 'schuelerin.zwei', code: 'WXYZ-2345-6789-ABCD' }, { loginName: 'drei', code: '2222-3333-4444-5555' }];
    render(<InvitationCards cards={cards} schoolName="S" origin={ORIGIN} />);

    const rendered = screen.getAllByRole('article');
    expect(rendered).toHaveLength(3);
    expect(screen.getAllByTestId('invitation-qr').map((e) => e.getAttribute('data-qr-value'))).toEqual(
      cards.map((c) => `https://schule.example.test/einladung?code=${c.code}`)
    );
    expect(within(rendered[1]).getByText('schuelerin.zwei')).toBeInTheDocument();
  });
});
