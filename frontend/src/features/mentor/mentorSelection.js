// Houdt de gekozen stagiair vast over de losse mentorpagina's heen,
// zodat contract/afspraken/planning dezelfde stagiair tonen als het dossier.
const KEY = "mentor_dossier";

export function kiesMentorStagiair(lijst, searchParams) {
  if (!lijst || lijst.length === 0) return null;
  const vSt = Number(searchParams?.get("student")) || null;
  const vDos = Number(searchParams?.get("dossier")) || null;
  const onthouden = Number(sessionStorage.getItem(KEY)) || null;
  // Bij geen expliciete keuze (query/onthouden): eerst een lopend/actief dossier kiezen,
  // pas als laatste een afgerond dossier — anders opent de mentor standaard in een historisch dossier.
  const afgerondeFases = ["afgerond", "voltooid", "resultaat_vrijgegeven"];
  const eersteActief = lijst.find((s) => !afgerondeFases.includes(s.dossier_status));
  return (
    lijst.find((s) => s.id === vSt) ||
    lijst.find((s) => s.dossier_id === vDos) ||
    lijst.find((s) => s.dossier_id === onthouden) ||
    eersteActief ||
    lijst[0] ||
    null
  );
}

export function onthoudMentorDossier(dossierId) {
  if (dossierId) sessionStorage.setItem(KEY, String(dossierId));
}
