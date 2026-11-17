export type Role =
  | 'teacher'
  | 'school_admin'
  | 'secretary'
  | 'student'
  | 'parent';

export interface SchoolYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  classId?: string;
}

export interface AssessmentRecord {
  id: string;
  studentId: string;
  courseId: string;
  kind: 'observation' | 'test' | 'portfolio';
  value: number | null;
  updatedAt: string;
}
