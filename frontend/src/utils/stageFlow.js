export const DOSSIER_STATUS = {
  CONTRACT: ["wacht_op_student", "wacht_op_bedrijf", "in_controle_bij_administratie", "document_afgekeurd"],
  STARTKLAAR: ["geregistreerd"],
  LOPEND: ["actief", "stage_loopt"],
  AFGEROND: ["resultaat_vrijgegeven", "afgerond", "voltooid"],
};

export function isContractFase(status) {
  return DOSSIER_STATUS.CONTRACT.includes(status);
}

export function isStageStartklaar(status) {
  return DOSSIER_STATUS.STARTKLAAR.includes(status);
}

export function isStageLopend(status) {
  return DOSSIER_STATUS.LOPEND.includes(status);
}

export function isDossierAfgerond(status) {
  return DOSSIER_STATUS.AFGEROND.includes(status);
}

export function isPlanbaar(status) {
  return isStageStartklaar(status) || isStageLopend(status);
}

export function dossierFaseLabel(status) {
  if (isContractFase(status)) return "Stageovereenkomst";
  if (isStageStartklaar(status)) return "Voorbereiding - startklaar";
  if (isStageLopend(status)) return "Stage loopt";
  if (isDossierAfgerond(status)) return "Afgerond";
  return status || "-";
}

export function planningStatusLabel(moment) {
  const status = moment?.status;
  if (status === "voorgesteld") return "Wacht op bevestiging mentor";
  if (status === "gepland") return "Wacht op bevestiging mentor";
  if (status === "bevestigd") return "Bevestigd door mentor";
  if (status === "alternatief_gevraagd") return "Mentor stelt ander moment voor";
  if (status === "geweest") return "Geweest";
  if (status === "gegeven") return "Gegeven";
  if (status === "geannuleerd") return "Geannuleerd";
  return status || "-";
}

export function planningStatusClass(status) {
  if (status === "bevestigd") return "s_ok";
  if (status === "voorgesteld" || status === "gepland" || status === "alternatief_gevraagd") return "s_amber";
  if (status === "gegeven" || status === "geweest") return "s_info";
  if (status === "geannuleerd") return "s_rood";
  return "s_grijs";
}

export function canStudentSeePlanning(moment) {
  return ["bevestigd", "geweest", "gegeven"].includes(moment?.status);
}

export function canMentorHandlePlanning(moment, dossierStatus) {
  return !isDossierAfgerond(dossierStatus) &&
    ["bedrijfsbezoek", "eindpresentatie"].includes(moment?.type) &&
    ["voorgesteld", "gepland"].includes(moment?.status);
}

export function canMarkMomentDone(moment) {
  if (moment?.status !== "bevestigd") {
    return { ok: false, reason: "Dit moment moet eerst bevestigd zijn door de mentor." };
  }
  if (moment?.gepland_op) {
    const gepland = new Date(moment.gepland_op);
    if (!Number.isNaN(gepland.getTime()) && gepland > new Date()) {
      return { ok: false, reason: "Dit moment ligt nog in de toekomst." };
    }
  }
  return { ok: true, reason: "" };
}

export function canPlanVisit(student) {
  if (!isPlanbaar(student?.dossier_status)) {
    return { ok: false, reason: "Planning kan pas zodra de stage geregistreerd is of loopt." };
  }
  if (!student?.mentor_voornaam && !student?.mentor_id && !student?.mentor_naam) {
    return { ok: false, reason: "Koppel eerst een mentor aan dit dossier." };
  }
  return { ok: true, reason: "" };
}

export function canPlanPresentation(student) {
  const visit = canPlanVisit(student);
  if (!visit.ok) return visit;
  if (Number(student?.bezoek_geweest || 0) === 0) {
    return { ok: false, reason: "Registreer eerst het bedrijfsbezoek als geweest." };
  }
  if (Number(student?.tussentijds_geregistreerd || 0) === 0) {
    return { ok: false, reason: "Registreer eerst de tussentijdse evaluatie." };
  }
  return { ok: true, reason: "" };
}

export function evaluationGate(type, evaluatie, student) {
  if (!evaluatie || evaluatie.status === "niet_open") {
    if (!isPlanbaar(student?.dossier_status)) {
      return { open: false, reason: "Nog niet beschikbaar zolang de stage niet geregistreerd of gestart is." };
    }
    if (type === "finaal") {
      const pres = Number(student?.presentatie_gegeven || 0);
      if (Number(student?.tussentijds_geregistreerd || 0) === 0) {
        return { open: false, reason: "Opent na de geregistreerde tussentijdse evaluatie." };
      }
      if (pres === 0) {
        return { open: false, reason: "Opent nadat de eindpresentatie als gegeven geregistreerd is." };
      }
    }
    return { open: true, reason: "" };
  }
  return { open: true, reason: "" };
}

export function evaluationStatusLabel(status) {
  const labels = {
    niet_open: "Nog niet beschikbaar",
    open: "Open",
    student_ingediend: "Wacht op mentorinput",
    mentor_ingediend: "Wacht op docent",
    klaar_voor_docent: "Klaar voor docent",
    geregistreerd: "Geregistreerd",
    klaar_voor_vrijgave: "Klaar om vrij te geven",
    vrijgegeven: "Vrijgegeven",
  };
  return labels[status] || status || "-";
}
