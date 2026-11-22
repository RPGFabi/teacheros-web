import { assignmentFailureTexts, type AssignmentConfig } from '../shared/assignments/assignments';

/**
 * Die Lehrkraft-Zuordnung zu einer Fachgruppe (Ticket #67; Glossar: Lehrkraft-Zuordnung, Gueltigkeitszeitraum) als Art von
 * Zuordnung fuer `AssignmentSection`: `GET /api/teacher-assignments?teaching_group_id=…`. Typen, Anzeige und gemeinsame
 * Fehlertexte stehen in `shared/assignments/assignments.ts`.
 */
export const TEACHER_ASSIGNMENTS: AssignmentConfig = {
  endpoint: '/api/teacher-assignments',
  parentKey: 'teaching_group_id',
  listKey: 'teacher_assignments',
  texts: {
    heading: 'Lehrkräfte',
    loading: 'Lehrkräfte werden geladen …',
    empty: 'Dieser Fachgruppe ist noch keine Lehrkraft zugeordnet.',
    loadError: 'Die Lehrkräfte der Fachgruppe konnten nicht geladen werden.',
    archivedNotice: 'Die Fachgruppe ist archiviert: Ihr lassen sich keine Lehrkräfte neu zuordnen. Bestehende Zuordnungen bleiben und lassen sich beenden.',
    createForm: 'Lehrkraft zuordnen',
    createHelp:
      'Ohne Beginn gilt die Zuordnung ab dem ersten Tag des Schuljahres, ohne Ende offen, also bis zum Ende des Schuljahres. Beide Tage liegen im Schuljahr der Fachgruppe. ' +
      'Mehrere Lehrkräfte können zugleich zugeordnet sein, bis zur Obergrenze der Schule; dieselbe Lehrkraft nicht mit sich überschneidendem Gültigkeitszeitraum.',
    created: (login) => `${login ?? 'Die Lehrkraft'} wurde der Fachgruppe zugeordnet.`,
    endForm: 'Zuordnung beenden',
    endTitle: (login) => `Zuordnung von ${login} beenden`,
    endHelp: 'Beenden setzt das Ende einer offenen Zuordnung oder verschiebt ein späteres Ende nach vorn. Was schon gegolten hat, bleibt unverändert: der letzte Tag liegt frühestens heute.',
    ended: (login) => `Die Zuordnung von ${login} wurde beendet.`,
    deleteTitle: (login) => `Zuordnung von ${login} löschen?`,
    deleteDescription: (validity) =>
      `Die Zuordnung (${validity}) wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. Nur eine Zuordnung, die noch nie gegolten hat, lässt sich löschen; sonst bleibt das Beenden.`,
    deleted: (login) => `Die Zuordnung von ${login} wurde gelöscht.`
  },
  failure: assignmentFailureTexts(
    {
      teaching_group_not_found: 'Die Fachgruppe gibt es nicht mehr. Bitte laden Sie die Seite neu.',
      teaching_group_archived: 'Die Fachgruppe ist archiviert. Ihr lassen sich keine Lehrkräfte neu zuordnen. Stellen Sie sie zuerst wieder her.',
      teacher_assignment_not_found: 'Die Zuordnung gibt es nicht mehr. Bitte laden Sie die Seite neu.',
      assignment_overlap: 'Die Lehrkraft ist an diesen Tagen schon dieser Fachgruppe zugeordnet. Gültigkeitszeiträume derselben Lehrkraft dürfen sich nicht überschneiden; nacheinander ist möglich.',
      assignment_limit_reached: 'An mindestens einem dieser Tage sind schon so viele Lehrkräfte zugleich zugeordnet, wie die Schule erlaubt (Schuleinstellung „Lehrkräfte je Fachgruppe“).',
      assignment_applied: 'Die Zuordnung hat schon gegolten. Sie lässt sich nicht löschen oder rückwirkend kürzen, nur beenden: frühestens heute.',
      assignment_ended: 'Die Zuordnung ist bereits beendet.',
      validity_outside_school_year: 'Beginn und Ende müssen innerhalb des Schuljahres der Fachgruppe liegen.'
    },
    {
      create: 'Die Zuordnung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
      end: 'Die Zuordnung konnte nicht beendet werden. Bitte versuchen Sie es erneut.',
      delete: 'Die Zuordnung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
    }
  )
};
