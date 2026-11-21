import { describe, expect, it } from 'vitest';
import {
  assignmentFormProblem,
  canDelete,
  canEnd,
  describeTeacherAssignmentFailure,
  periodText,
  statusLabel,
  teacherLabel,
  type TeacherAssignment
} from './teacherAssignments';

const assignment = (over: Partial<TeacherAssignment> = {}): TeacherAssignment => ({
  id: 'a1',
  teaching_group_id: 'g1',
  teacher: { id: 't1', login_name: 'mueller', email: 'mueller@example.test', status: 'active' },
  starts_on: '2026-09-14',
  ends_on: null,
  last_day: '2027-07-29',
  status: 'running',
  ...over
});

const failure = (status: number, code?: string) => ({ response: { status, data: code ? { code, error: 'x' } : {} } });

describe('periodText', () => {
  it('zeigt Beginn und letzten Tag einschliesslich', () => {
    expect(periodText(assignment({ ends_on: '2026-12-18', last_day: '2026-12-18' }))).toBe('14.09.2026 bis 18.12.2026');
  });

  it('nennt ein offenes Ende „bis Schuljahresende“ mit dem Tag', () => {
    expect(periodText(assignment())).toBe('ab 14.09.2026, offen (bis Schuljahresende 29.07.2027)');
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
  it('zeigt den Anmeldenamen mit E-Mail, ohne E-Mail nur den Namen', () => {
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

describe('describeTeacherAssignmentFailure', () => {
  it('uebersetzt die Fehlercodes der API', () => {
    expect(describeTeacherAssignmentFailure(failure(409, 'assignment_overlap'))).toContain('überschneiden');
    expect(describeTeacherAssignmentFailure(failure(409, 'assignment_limit_reached'))).toContain('Schuleinstellung');
    expect(describeTeacherAssignmentFailure(failure(409, 'teacher_not_selectable'), 'create')).toContain('Lehrkraft');
    expect(describeTeacherAssignmentFailure(failure(409, 'assignment_applied'), 'delete')).toContain('beenden');
    expect(describeTeacherAssignmentFailure(failure(409, 'assignment_ended'), 'end')).toContain('bereits beendet');
    expect(describeTeacherAssignmentFailure(failure(422, 'period_outside_school_year'))).toContain('Schuljahres');
    expect(describeTeacherAssignmentFailure(failure(403, 'forbidden'))).toContain('Lehrkraft-Zuordnungen verwalten');
  });

  it('faellt je Aktion auf einen allgemeinen Text zurueck', () => {
    expect(describeTeacherAssignmentFailure(failure(500), 'create')).toBe('Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.');
    expect(describeTeacherAssignmentFailure(failure(500), 'end')).toBe('Die Zuordnung konnte nicht beendet werden. Bitte versuchen Sie es erneut.');
    expect(describeTeacherAssignmentFailure(failure(500), 'delete')).toBe('Die Zuordnung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.');
  });
});
