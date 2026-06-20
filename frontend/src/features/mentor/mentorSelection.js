// Houdt de gekozen stagiair vast over de losse mentorpagina's heen,
// zodat contract/afspraken/planning dezelfde stagiair tonen als het dossier.
const KEY = "mentor_dossier";

export function kiesMentorStagiair(lijst, searchParams) {
  if (!lijst || lijst.length === 0) return null;
  const vSt = Number(searchParams?.get("student")) || null;
  const vDos = Number(searchParams?.get("dossier")) || null;
  const onthouden = Number(sessionStorage.getItem(KEY)) || null;
  return (
    lijst.find((s) => s.id === vSt) ||
    lijst.find((s) => s.dossier_id === vDos) ||
    lijst.find((s) => s.dossier_id === onthouden) ||
    lijst[0] ||
    null
  );
}

export function onthoudMentorDossier(dossierId) {
  if (dossierId) sessionStorage.setItem(KEY, String(dossierId));
}
