# Known issues — te checken na de frontend-polish

## 1. Mentor ziet stagiairs bij bedrijven waar hij/zij niet werkt (databank-probleem, geen codebug)

**Wat:** Mentor `mentor@bedrijf.be` (Sofie Maris) ziet in "Mijn stagiairs" studenten bij meerdere, niet-verwante bedrijven: CodeLab Brussels, ConceptCo, Codex Demo BV en Codex Alt Bedrijf. Logisch gezien hoort een mentor bij één bedrijf en zou hij/zij enkel stagiairs van dát bedrijf mogen zien.

**Bevestigd: dit is GEEN bug in de code.** Elke query in `backend/src/controllers/mentorController.js` filtert correct op `WHERE sd.mentor_id = ?` (het ID van de ingelogde mentor) — nergens wordt er cross-bedrijf data opgehaald. Geverifieerd op 2026-06-20.

**Oorzaak: foute data in de gedeelde live databank.** Een aantal teststudenten/dossiers (te herkennen aan de naam "Codex ..." — bv. "Codex Student142801", "Codex AltFlow — Codex Alt Bedrijf") hebben per ongeluk `mentor_id` = Sofie Maris toegewezen gekregen, terwijl die dossiers bij bedrijven horen waar zij niet werkt. Geen script in onze repo (`backend/scripts/`) maakt deze rijen aan — waarschijnlijk rechtstreeks in de databank ingevoegd door een test/tool buiten de repo.

**Wat moet er nog gebeuren (later, na de frontend-polish):**
- De `mentor_id` van de "Codex ..."-dossiers in de live DB nakijken en corrigeren (juiste mentor toewijzen, of de testrijen verwijderen als het toch maar rommel is).
- Geen actie nodig in de frontend- of backend-code zelf.

**Beslissing van Amin (2026-06-20):** even laten liggen, nu enkel focussen op de frontend-polish. Terugkomen op dit punt zodra de frontend af is.

## 2. "Codex ..."-dossiers tonen onmogelijke statuscombinaties op de stepper (databank-probleem, geen codebug)

**Wat:** Bij docent én mentor toont de dossier-stepper (Contract/Voorbereiding/Stage/Evaluatie) tegenstrijdige combinaties bij dezelfde "Codex ..."-testdossiers:
- **Codex Student142801**: contract staat op "wacht op registratie" (nooit geregistreerd), maar Stage staat op "Afgerond" en Evaluatie was op "Loopt"/"Vrijgegeven" — onmogelijk in de praktijk (je kan geen eindresultaat vrijgeven van een stage waarvan het contract nooit geregistreerd is).
- **Codex AltFlow**: contract staat op "Geregistreerd" (correct), maar Stage staat op "Nog niet gestart" terwijl Evaluatie toch al "Loopt" — ook onmogelijk (geen evaluatie vóór de stage zelf gestart is).

**Bevestigd op 2026-06-20: de stepper-code is gecorrigeerd zodat dit zich niet meer kan voordoen door losse, tegenstrijdige datavelden.** Concreet: Evaluatie kan in de stepper nooit meer "Loopt" of "Vrijgegeven" tonen als Stage niet minstens actief is (`DocentStudentDossierPage.jsx` en `MentorDossierPage.jsx`, functie `getStappen`). Dit verbergt het onderliggende dataprobleem niet, het zorgt enkel dat de stepper zelf niet langer een onmogelijke combinatie kan tonen.

**Wat blijft een datafout (niet door de stepper-fix opgelost):** bij Codex Student142801 is en blijft het contract niet geregistreerd terwijl de rest van het dossier (logboek, evaluatie) wél als afgerond/lopend in de databank staat. Dat is een reële inconsistentie in de testdata zelf — dezelfde "Codex ..."-rommel als probleem 1 hierboven. Oplossing: dezelfde opkuisbeurt als bij probleem 1 (mentor_id + dossierstatus van de Codex-rijen nakijken/corrigeren), niet iets om in de frontend-code te verbergen.
