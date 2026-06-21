import { apiRequest } from "../../services/api";

export const STUDENT_PATH_KEYS = {
  "/student": "stage",
  "/student/application": "stage",
  "/student/internship": "stage",
  "/student/contract": "overeenkomst",
  "/student/documents": "documenten",
  "/student/logbook": "logboek",
  "/student/evaluation": "evaluatie",
  // Planning is een eigen sleutel: een bedrijfsbezoek/eindpresentatie kan al gepland worden zodra de
  // stage geregistreerd (startklaar) is — los van het logboek, dat pas vanaf de startdatum opent.
  "/student/planning": "planning",
};

export const STUDENT_FASES = {
  geen: {
    faseIdx: 1,
    fase: "Voorstel",
    actie: "Dien je stagevoorstel in om te starten.",
    open: ["stage"],
    warn: [],
  },
  concept: {
    faseIdx: 1,
    fase: "Voorstel",
    actie: "Je concept staat klaar - werk het af en dien in.",
    open: ["stage"],
    warn: ["stage"],
  },
  ingediend: {
    faseIdx: 2,
    fase: "Beoordeling",
    actie: "Beslissing volgt op de commissievergadering.",
    open: ["stage"],
    warn: [],
  },
  aanpassingen: {
    faseIdx: 2,
    fase: "Beoordeling",
    actie: "De commissie vraagt aanpassingen. Dien opnieuw in.",
    open: ["stage"],
    warn: ["stage"],
  },
  heringediend: {
    faseIdx: 2,
    fase: "Beoordeling",
    actie: "Je aangepast voorstel is heringediend.",
    open: ["stage"],
    warn: [],
  },
  afgekeurd: {
    faseIdx: 2,
    fase: "Beoordeling",
    actie: "Je stagevoorstel werd afgekeurd.",
    open: ["stage"],
    warn: ["stage"],
  },
  ingetrokken: {
    faseIdx: 1,
    fase: "Voorstel",
    actie: "Je stagevoorstel werd ingetrokken.",
    open: ["stage"],
    warn: ["stage"],
  },
  goedgekeurd: {
    faseIdx: 3,
    fase: "Overeenkomst",
    actie: "Onderteken je stageovereenkomst digitaal.",
    open: ["stage", "overeenkomst", "documenten"],
    warn: ["overeenkomst", "documenten"],
  },
  teruggestuurd: {
    faseIdx: 3,
    fase: "Overeenkomst",
    actie: "Je hebt getekend - het stagebedrijf kreeg een uitnodiging om te tekenen.",
    open: ["stage", "overeenkomst", "documenten"],
    warn: ["documenten"],
  },
  validatie: {
    faseIdx: 3,
    fase: "Overeenkomst",
    actie: "Alle partijen hebben getekend - de overeenkomst is in controle bij de administratie.",
    open: ["stage", "overeenkomst", "documenten"],
    warn: ["documenten"],
  },
  startklaar: {
    faseIdx: 4,
    fase: "Stage",
    actie: "Alles is in orde. Je logboek opent vanaf je startdatum.",
    open: ["stage", "overeenkomst", "documenten", "planning"],
    warn: [],
  },
  gestart: {
    faseIdx: 4,
    fase: "Stage loopt",
    actie: "Vul je logboek van vandaag in.",
    open: ["stage", "overeenkomst", "logboek", "evaluatie", "documenten", "planning"],
    warn: [],
    dot: "logboek",
  },
  lopend: {
    faseIdx: 4,
    fase: "Stage loopt",
    actie: "Logboek van vandaag nog niet ingevuld.",
    open: ["stage", "overeenkomst", "logboek", "evaluatie", "documenten", "planning"],
    warn: [],
    dot: "logboek",
  },
  presentatie: {
    faseIdx: 5,
    fase: "Evaluatie",
    actie: "Bereid je eindpresentatie voor.",
    open: ["stage", "overeenkomst", "logboek", "evaluatie", "documenten", "planning"],
    warn: [],
  },
  afgerond: {
    faseIdx: 5,
    fase: "Afgerond",
    actie: "Je eindresultaat staat klaar bij Evaluatie.",
    open: ["stage", "overeenkomst", "logboek", "evaluatie", "documenten", "planning"],
    warn: [],
    dot: "evaluatie",
  },
};

function normaliseerVoorstelStatus(status) {
  if (status === "aanpassingen_gevraagd") return "aanpassingen";
  // Goedgekeurd met uitzondering is functioneel goedgekeurd: de backend maakt al een dossier aan, dus
  // de student hoort dezelfde flow te krijgen (contract/documenten/...) i.p.v. een lege pagina (340).
  if (status === "goedgekeurd_met_uitzondering") return "goedgekeurd";
  return status || "geen";
}

function startVanDag(datum) {
  if (!datum) return null;
  const d = new Date(datum);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDatumKort(datum) {
  const d = startVanDag(datum);
  if (!d) return null;
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

function isStageGestart(startdatum) {
  const start = startVanDag(startdatum);
  if (!start) return false;
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  return vandaag >= start;
}

const DOSSIER_STATUSSEN_GEREGISTREERD = new Set([
  "geregistreerd",
  "stage_loopt",
  "resultaat_vrijgegeven",
  "afgerond",
]);

function isContractGeregistreerd(contract, dossierStatus) {
  return !!(
    contract?.opleiding_getekend_op ||
    contract?.geregistreerd_op ||
    contract?.status === "geregistreerd" ||
    DOSSIER_STATUSSEN_GEREGISTREERD.has(dossierStatus)
  );
}

export function berekenStudentAccess(voorstel, contract) {
  const voorstelStatus = normaliseerVoorstelStatus(voorstel?.status);
  const dossierStatus = voorstel?.dossier_status;
  const startdatum = contract?.startdatum ?? voorstel?.startdatum ?? voorstel?.startDatum;

  if (voorstelStatus !== "goedgekeurd") {
    const key = STUDENT_FASES[voorstelStatus] ? voorstelStatus : "geen";
    return { key, startdatum, ...STUDENT_FASES[key] };
  }

  if (!contract || !contract.student_getekend_op) {
    return { key: "goedgekeurd", startdatum, ...STUDENT_FASES.goedgekeurd };
  }

  if (!contract.bedrijf_getekend_op) {
    return { key: "teruggestuurd", startdatum, ...STUDENT_FASES.teruggestuurd };
  }

  if (!isContractGeregistreerd(contract, dossierStatus)) {
    return { key: "validatie", startdatum, ...STUDENT_FASES.validatie };
  }

  if (!isStageGestart(startdatum)) {
    return { key: "startklaar", startdatum, ...STUDENT_FASES.startklaar };
  }

  // Na vrijgave van het resultaat zit de student in de eindfase (evaluatie/eindoverzicht), niet meer "Stage loopt".
  if (dossierStatus === "afgerond" || dossierStatus === "resultaat_vrijgegeven" || contract?.status === "afgerond") {
    return { key: "afgerond", startdatum, ...STUDENT_FASES.afgerond };
  }
  if (dossierStatus === "presentatie") {
    return { key: "presentatie", startdatum, ...STUDENT_FASES.presentatie };
  }
  if (dossierStatus === "lopend") {
    return { key: "lopend", startdatum, ...STUDENT_FASES.lopend };
  }

  return { key: "gestart", startdatum, ...STUDENT_FASES.gestart };
}

export async function fetchStudentAccess() {
  const [internshipRes, contractRes] = await Promise.allSettled([
    apiRequest("GET", "/internships/my"),
    apiRequest("GET", "/contracts/my"),
  ]);

  const voorstel = internshipRes.status === "fulfilled" ? internshipRes.value?.data : null;
  const contract = contractRes.status === "fulfilled" ? contractRes.value?.data : null;
  const access = berekenStudentAccess(voorstel, contract);
  // Faalt de voorstel-call (netwerk/500), dan is de berekende fase onbetrouwbaar: signaleer dat met een
  // laadFout-vlag i.p.v. de student onterecht in "geen toegang" te zetten (auditpunt 339).
  if (internshipRes.status === "rejected") return { ...access, laadFout: true };
  return access;
}

export function isStudentRouteOpen(access, path) {
  const key = STUDENT_PATH_KEYS[path];
  if (!key) return true;
  return access.open.includes(key);
}

export function getStudentRouteLock(access, path) {
  const key = STUDENT_PATH_KEYS[path];
  const startLabel = formatDatumKort(access.startdatum);

  if (path === "/student/planning") {
    return {
      titel: access.key === "startklaar" && startLabel ? `Opent op ${startLabel}` : "Planning nog niet beschikbaar",
      uitleg: access.key === "startklaar"
        ? "Je planning opent vanaf de startdatum van je stage."
        : "Je planning opent zodra je stagedossier in orde is en je stage gestart is.",
    };
  }

  if (key === "overeenkomst") {
    return {
      titel: "Stageovereenkomst nog niet beschikbaar",
      uitleg: "Je stageovereenkomst opent zodra je stagevoorstel is goedgekeurd.",
    };
  }

  if (key === "documenten") {
    return {
      titel: "Documenten nog niet beschikbaar",
      uitleg: "Je documenten openen zodra je stagevoorstel is goedgekeurd.",
    };
  }

  if (key === "logboek") {
    return {
      titel: access.key === "startklaar" && startLabel ? `Opent op ${startLabel}` : "Logboek nog niet beschikbaar",
      uitleg: access.key === "startklaar"
        ? "Je logboek opent vanaf de startdatum van je stage."
        : "Je logboek opent zodra je stagedossier in orde is en je stage gestart is.",
    };
  }

  if (key === "evaluatie") {
    return {
      titel: "Evaluatie nog niet beschikbaar",
      uitleg: "Je evaluatie opent zodra je stagedossier startklaar is.",
    };
  }

  return {
    titel: "Nog niet beschikbaar",
    uitleg: "Dit onderdeel is nog niet beschikbaar in deze fase.",
  };
}
