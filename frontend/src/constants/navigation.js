import { ROLES } from "./roles";

export const NAVIGATION = {
  [ROLES.STUDENT]: [
    { label: "Stageaanvraag", path: "/student/application", icon: "ti-file-plus" },
    { label: "Mijn stage",    path: "/student/internship",  icon: "ti-briefcase" },
    { label: "Logboek",       path: "/student/logbook",     icon: "ti-notebook" },
    { label: "Evaluatie",     path: "/student/evaluation",  icon: "ti-clipboard-check" },
  ],

  [ROLES.COMMITTEE]: [
    { label: "Aanvragen", path: "/committee/applications", icon: "ti-inbox" },
  ],

  [ROLES.ADMIN]: [
    { label: "Dossiers",    path: "/admin/dossiers",      icon: "ti-folder" },
    { label: "Gebruikers",  path: "/admin/users",         icon: "ti-users" },
    { label: "Competenties",path: "/admin/competencies",  icon: "ti-target" },
  ],

  [ROLES.MENTOR]: [
    { label: "Stagiairs", path: "/mentor/students", icon: "ti-users" },
    { label: "Logboeken", path: "/mentor/logbooks", icon: "ti-notebook" },
    { label: "Evaluatie", path: "/mentor/evaluation", icon: "ti-clipboard-check" },
  ],

  [ROLES.DOCENT]: [
    { label: "Studenten",  path: "/docent/students",    icon: "ti-users" },
    { label: "Logboeken",  path: "/docent/logbooks",    icon: "ti-notebook" },
    { label: "Evaluaties", path: "/docent/evaluations", icon: "ti-clipboard-check" },
  ],
};

