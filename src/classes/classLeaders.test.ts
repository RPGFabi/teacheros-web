import { describe, expect, it } from 'vitest';
import { describeClassLeaderFailure } from './classLeaders';

const failure = (status: number, code?: string) => ({ response: { status, data: code ? { code, error: 'x' } : {} } });

describe('describeClassLeaderFailure', () => {
  it('uebersetzt die Codes der Klassenleitung mit den Worten der Klasse', () => {
    expect(describeClassLeaderFailure(failure(404, 'class_not_found'))).toContain('Die Klasse gibt es nicht mehr');
    expect(describeClassLeaderFailure(failure(404, 'class_leader_not_found'), 'end')).toContain('Die Klassenleitung gibt es nicht mehr');
    expect(describeClassLeaderFailure(failure(409, 'class_archived'))).toContain('Die Klasse ist archiviert');
    expect(describeClassLeaderFailure(failure(409, 'assignment_overlap'))).toContain('überschneiden');
    expect(describeClassLeaderFailure(failure(409, 'assignment_limit_reached'))).toContain('Klassenleitungen je Klasse');
    expect(describeClassLeaderFailure(failure(409, 'teacher_not_selectable'))).toContain('keine wählbare Lehrkraft');
    expect(describeClassLeaderFailure(failure(409, 'assignment_applied'), 'delete')).toContain('frühestens heute');
    expect(describeClassLeaderFailure(failure(422, 'period_outside_school_year'))).toContain('Schuljahres der Klasse');
    expect(describeClassLeaderFailure(failure(403, 'forbidden'))).toContain('Lehrkraft-Zuordnungen verwalten');
  });

  it('nennt ohne passenden Code den allgemeinen Text zur Aktion', () => {
    expect(describeClassLeaderFailure(failure(500))).toContain('Die Klassenleitung konnte nicht angelegt werden');
    expect(describeClassLeaderFailure(failure(500), 'end')).toContain('nicht beendet werden');
    expect(describeClassLeaderFailure(failure(500), 'delete')).toContain('nicht gelöscht werden');
  });
});
