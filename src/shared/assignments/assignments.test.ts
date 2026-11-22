import { describe, expect, it } from 'vitest';
import {
  assignmentFormProblem,
  canDelete,
  canEnd,
  describeAssignmentFailure,
  statusLabel,
  teacherLabel,
  validityText,
  type Assignment
} from './assignments';
import { CLASS_LEADERS } from '../../classes/classLeaders';
import { TEACHER_ASSIGNMENTS } from '../../teaching-groups/teacherAssignments';

const assignment = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'a1',
  teacher: { id: 't1', login_name: 'mueller' },
  starts_on: '2026-09-14',
  ends_on: null,
  last_day: '2027-07-29',
  status: 'running',
  ...over
});

const failure = (status: number, code?: string) => ({ response: { status, data: code ? { code, error: 'x' } : {} } });

describe('validityText', () => {
  it('zeigt Beginn und letzten Tag einschliesslich', () => {
    expect(validityText(assignment({ ends_on: '2026-12-18', last_day: '2026-12-18' }))).toBe('14.09.2026 bis 18.12.2026');
  });

  it('nennt ein offenes Ende „bis Schuljahresende“ mit dem Tag', () => {
    expect(validityText(assignment())).toBe('ab 14.09.2026, offen (bis Schuljahresende 29.07.2027)');
  });
});

describe('statusLabel, canEnd, canDelete', () => {
  it('benennt den Status auf Deutsch', () => {
    expect([statusLabel('upcoming'), statusLabel('running'), statusLabel('ended')]).toEqual(['kommend', 'laufend', 'beendet']);
  });

  it('beenden geht, solange sie nicht beendet ist; loeschen nur, was noch nie gegolten hat (kommend)', () => {
    expect([canEnd(assignment({ status: 'upcoming' })), canEnd(assignment({ status: 'running' })), canEnd(assignment({ status: 'ended' }))]).toEqual([true, true, false]);
    expect([canDelete(assignment({ status: 'upcoming' })), canDelete(assignment({ status: 'running' })), canDelete(assignment({ status: 'ended' }))]).toEqual([true, false, false]);
  });
});

describe('teacherLabel', () => {
  it('zeigt in der Auswahl den Anmeldenamen mit E-Mail, ohne E-Mail nur den Namen', () => {
    expect(teacherLabel({ id: 't', login_name: 'mueller', email: 'm@example.test', status: 'active' })).toBe('mueller (m@example.test)');
    expect(teacherLabel({ id: 't', login_name: 'mueller', email: null, status: 'invited' })).toBe('mueller');
  });
});

describe('assignmentFormProblem', () => {
  it('verlangt eine Lehrkraft', () => {
    expect(assignmentFormProblem('', '', '')).toBe('Bitte wählen Sie eine Lehrkraft.');
  });

  it('laesst Beginn und Ende leer (Standard) und verlangt das Ende nicht vor dem Beginn', () => {
    expect(assignmentFormProblem('t1', '', '')).toBeUndefined();
    expect(assignmentFormProblem('t1', '2026-10-01', '')).toBeUndefined();
    expect(assignmentFormProblem('t1', '2026-10-01', '2026-10-01')).toBeUndefined();
    expect(assignmentFormProblem('t1', '2026-10-02', '2026-10-01')).toBe('Das Ende darf nicht vor dem Beginn liegen.');
  });
});

describe('describeAssignmentFailure: Fachgruppe', () => {
  const describe_ = (status: number, code?: string, action?: 'create' | 'end' | 'delete') => describeAssignmentFailure(TEACHER_ASSIGNMENTS, failure(status, code), action);

  it('uebersetzt die Fehlercodes der API', () => {
    expect(describe_(409, 'assignment_overlap')).toContain('überschneiden');
    expect(describe_(409, 'assignment_limit_reached')).toContain('Schuleinstellung');
    expect(describe_(409, 'teacher_not_selectable', 'create')).toContain('Lehrkraft');
    expect(describe_(409, 'assignment_applied', 'delete')).toContain('beenden');
    expect(describe_(409, 'assignment_ended', 'end')).toContain('bereits beendet');
    expect(describe_(422, 'validity_outside_school_year')).toContain('Schuljahres der Fachgruppe');
    expect(describe_(422, 'invalid_validity')).toContain('Gültigkeitszeitraum');
    expect(describe_(404, 'teaching_group_not_found')).toContain('Die Fachgruppe gibt es nicht mehr');
    expect(describe_(409, 'teaching_group_archived')).toContain('Die Fachgruppe ist archiviert');
    expect(describe_(404, 'teacher_assignment_not_found', 'end')).toContain('Die Zuordnung gibt es nicht mehr');
    expect(describe_(403, 'forbidden')).toContain('Lehrkraft-Zuordnungen verwalten');
  });

  it('kennt die frueheren Codes `period_outside_school_year` und `invalid_period` fuer Zuordnungen nicht mehr', () => {
    expect(describe_(422, 'period_outside_school_year')).toBe('Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.');
    expect(describe_(422, 'invalid_period')).toBe('Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.');
  });

  it('faellt je Aktion auf einen allgemeinen Text zurueck', () => {
    expect(describe_(500, undefined, 'create')).toBe('Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.');
    expect(describe_(500, undefined, 'end')).toBe('Die Zuordnung konnte nicht beendet werden. Bitte versuchen Sie es erneut.');
    expect(describe_(500, undefined, 'delete')).toBe('Die Zuordnung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.');
  });
});

describe('describeAssignmentFailure: Klassenleitung', () => {
  const describe_ = (status: number, code?: string, action?: 'create' | 'end' | 'delete') => describeAssignmentFailure(CLASS_LEADERS, failure(status, code), action);

  it('uebersetzt die Codes der Klassenleitung mit den Worten der Klasse', () => {
    expect(describe_(404, 'class_not_found')).toContain('Die Klasse gibt es nicht mehr');
    expect(describe_(404, 'class_leader_not_found', 'end')).toContain('Die Klassenleitung gibt es nicht mehr');
    expect(describe_(409, 'class_archived')).toContain('Die Klasse ist archiviert');
    expect(describe_(409, 'assignment_overlap')).toContain('überschneiden');
    expect(describe_(409, 'assignment_limit_reached')).toContain('Klassenleitungen je Klasse');
    expect(describe_(409, 'teacher_not_selectable')).toContain('keine wählbare Lehrkraft');
    expect(describe_(409, 'assignment_applied', 'delete')).toContain('frühestens heute');
    expect(describe_(422, 'validity_outside_school_year')).toContain('Schuljahres der Klasse');
    expect(describe_(422, 'invalid_validity')).toContain('Gültigkeitszeitraum');
    expect(describe_(403, 'forbidden')).toContain('Lehrkraft-Zuordnungen verwalten');
  });

  it('nennt ohne passenden Code den allgemeinen Text zur Aktion', () => {
    expect(describe_(500)).toContain('Die Klassenleitung konnte nicht angelegt werden');
    expect(describe_(500, undefined, 'end')).toContain('nicht beendet werden');
    expect(describe_(500, undefined, 'delete')).toContain('nicht gelöscht werden');
  });
});
