import { ROLES } from "./roles";

export const NAVIGATION = {
  [ROLES.STUDENT]: [
    { label: "Dashboard", path: "/student" },
    { label: "Stageaanvraag", path: "/student/application" },
    { label: "Mijn stage", path: "/student/internship" },
    { label: "Logboek", path: "/student/logbook" },
    { label: "Evaluatie", path: "/student/evaluation" },
  ],

  [ROLES.COMMITTEE]: [
    { label: "Dashboard", path: "/committee" },
    { label: "Aanvragen", path: "/committee/applications" },
  ],

  [ROLES.ADMIN]: [
    { label: "Dashboard", path: "/admin" },
    { label: "Dossiers", path: "/admin/dossiers" },
    { label: "Gebruikers", path: "/admin/users" },
    { label: "Competenties", path: "/admin/competencies" },
  ],

  [ROLES.MENTOR]: [
    { label: "Dashboard", path: "/mentor" },
    { label: "Stagiairs", path: "/mentor/students" },
    { label: "Logboeken", path: "/mentor/logbooks" },
    { label: "Evaluatie", path: "/mentor/evaluation" },
  ],

  [ROLES.DOCENT]: [
    { label: "Dashboard", path: "/docent" },
    { label: "Studenten", path: "/docent/students" },
    { label: "Logboeken", path: "/docent/logbooks" },
    { label: "Evaluaties", path: "/docent/evaluations" },
  ],
};

