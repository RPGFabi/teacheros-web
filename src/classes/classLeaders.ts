import { assignmentFailureTexts, type AssignmentConfig } from '../shared/assignments/assignments';

/**
 * Die Klassenleitung (Ticket #68; Glossar: Klassenleitung, Gueltigkeitszeitraum) als Art von Zuordnung fuer
 * `AssignmentSection`: `GET /api/class-leaders?class_id=…`. Gleiche Form wie die Lehrkraft-Zuordnung zu einer Fachgruppe
 * (Ticket #67), aber an der Klasse. Typen, Anzeige und gemeinsame Fehlertexte stehen in `shared/assignments/assignments.ts`.
 */
export const CLASS_LEADERS: AssignmentConfig = {
  endpoint: '/api/class-leaders',
  parentKey: 'class_id',
  listKey: 'class_leaders',
  texts: {
    heading: 'Klassenleitung',
    loading: 'Klassenleitungen werden geladen …',
    empty: 'Dieser Klasse ist noch keine Klassenleitung zugeordnet.',
    loadError: 'Die Klassenleitungen der Klasse konnten nicht geladen werden.',
    archivedNotice: 'Die Klasse ist archiviert: Ihr lässt sich keine Klassenleitung neu zuordnen. Bestehende Klassenleitungen bleiben und lassen sich beenden.',
    createForm: 'Klassenleitung zuordnen',
    createHelp:
      'Ohne Beginn gilt die Klassenleitung ab dem ersten Tag des Schuljahres, ohne Ende offen, also bis zum Ende des Schuljahres. Beide Tage liegen im Schuljahr der Klasse. ' +
      'Mehrere Lehrkräfte können zugleich Klassenleitung sein, bis zur Obergrenze der Schule; dieselbe Lehrkraft nicht mit sich überschneidendem Gültigkeitszeitraum.',
    created: (login) => `${login ?? 'Die Lehrkraft'} wurde als Klassenleitung eingesetzt.`,
    endForm: 'Klassenleitung beenden',
    endTitle: (login) => `Klassenleitung von ${login} beenden`,
    endHelp: 'Beenden setzt das Ende einer offenen Klassenleitung oder verschiebt ein späteres Ende nach vorn. Was schon gegolten hat, bleibt unverändert: der letzte Tag liegt frühestens heute.',
    ended: (login) => `Die Klassenleitung von ${login} wurde beendet.`,
    deleteTitle: (login) => `Klassenleitung von ${login} löschen?`,
    deleteDescription: (validity) =>
      `Die Klassenleitung (${validity}) wird endgültig gelöscht. Das lässt sich nicht rückgängig machen. Nur eine Klassenleitung, die noch nie gegolten hat, lässt sich löschen; sonst bleibt das Beenden.`,
    deleted: (login) => `Die Klassenleitung von ${login} wurde gelöscht.`
  },
  failure: assignmentFailureTexts(
    {
      class_not_found: 'Die Klasse gibt es nicht mehr. Bitte laden Sie die Seite neu.',
      class_archived: 'Die Klasse ist archiviert. Ihr lässt sich keine Klassenleitung neu zuordnen. Stellen Sie sie zuerst wieder her.',
      class_leader_not_found: 'Die Klassenleitung gibt es nicht mehr. Bitte laden Sie die Seite neu.',
      assignment_overlap: 'Die Lehrkraft ist an diesen Tagen schon Klassenleitung dieser Klasse. Gültigkeitszeiträume derselben Lehrkraft dürfen sich nicht überschneiden; nacheinander ist möglich.',
      assignment_limit_reached: 'An mindestens einem dieser Tage hat die Klasse schon so viele Klassenleitungen zugleich, wie die Schule erlaubt (Schuleinstellung „Klassenleitungen je Klasse“).',
      assignment_applied: 'Die Klassenleitung hat schon gegolten. Sie lässt sich nicht löschen oder rückwirkend kürzen, nur beenden: frühestens heute.',
      assignment_ended: 'Die Klassenleitung ist bereits beendet.',
      validity_outside_school_year: 'Beginn und Ende müssen innerhalb des Schuljahres der Klasse liegen.'
    },
    {
      create: 'Die Klassenleitung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
      end: 'Die Klassenleitung konnte nicht beendet werden. Bitte versuchen Sie es erneut.',
      delete: 'Die Klassenleitung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.'
    }
  )
};
