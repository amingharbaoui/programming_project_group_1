import { ROLES } from "./roles";

export const NAVIGATION = {
  [ROLES.STUDENT]: [
    { label: "Mijn stage",        path: "/student/internship",  icon: "ti-briefcase" },
    { label: "Logboek",           path: "/student/logbook",     icon: "ti-notebook",        lockGroup: "logboek_eval" },
    { label: "Evaluatie",         path: "/student/evaluation",  icon: "ti-clipboard-check", lockGroup: "logboek_eval" },
    { label: "Stageovereenkomst", path: "/student/contract",    icon: "ti-writing",         lockGroup: "contract_docs" },
    { label: "Documenten",        path: "/student/documents",   icon: "ti-files",           lockGroup: "contract_docs" },
    { label: "Planning",          path: "/student/planning",    icon: "ti-calendar-event",  lockGroup: "logboek_eval" },
  ],

  [ROLES.COMMITTEE]: [
    { label: "Aanvragen", path: "/committee/applications", icon: "ti-inbox" },
  ],

  [ROLES.ADMIN]: [
    { label: "Dossiers",     path: "/admin/dossiers",     icon: "ti-folder" },
    { label: "Toewijzingen", path: "/admin/toewijzingen", icon: "ti-link" },
    { label: "Gebruikers",   path: "/admin/users",        icon: "ti-users" },
    { label: "Competenties", path: "/admin/competencies", icon: "ti-target" },
    { label: "Instellingen", path: "/admin/instellingen", icon: "ti-settings" },
  ],

  [ROLES.MENTOR]: [
    { label: "Stagiairs",  path: "/mentor/students",   icon: "ti-users" },
    { label: "Logboeken",  path: "/mentor/logbooks",   icon: "ti-notebook" },
    { label: "Evaluatie",  path: "/mentor/evaluation", icon: "ti-clipboard-check" },
  ],

  [ROLES.DOCENT]: [
    { label: "Studenten",   path: "/docent/students",    icon: "ti-users" },
    { label: "Voorstellen", path: "/docent/proposals",   icon: "ti-file-text" },
    { label: "Logboeken",   path: "/docent/logbooks",    icon: "ti-notebook" },
    { label: "Evaluaties",  path: "/docent/evaluations", icon: "ti-clipboard-check" },
    { label: "Planning",    path: "/docent/planning",    icon: "ti-calendar-event" },
  ],
};
