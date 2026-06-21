# Stagify Functionele Audit — Volledig Overzicht (laatste update: 2026-06-21, nacht)

**Branch:** `feature/evaluaties`, alles **gepusht** naar `origin/feature/evaluaties`. Main is 2x gemerged (conflicten opgelost) zonder verlies van eigen fixes.

## 0. ALLE ROLLEN — algemeen overzicht, voor het hele team

Vandaag zijn alle 5 rollen tegen hun HTML-prototype getoetst (code-niveau), niet enkel docent/mentor. Resultaat per rol:

| Rol | Status | Wat moet nog gebeuren |
|---|---|---|
| **Student** | Goed, geen kapotte flows | 3 kleine afwijkingen: navigatie-volgorde wijkt licht af van de HTML ("Overeenkomst" staat in de HTML vóór Logboek/Evaluatie, in de app na), "Planning" is een extra pagina die niet in de HTML voorkomt, en stappen 14-16 (tussentijdse zelfevaluatie-substaten) zijn niet diepgaand 1-voor-1 gecheckt. Niets blokkerend. |
| **Administratie** | Volledige match met de HTML | Niets gevonden. Geen actie nodig. |
| **Stagecommissie** | Volledige match, zelfs meer functionaliteit dan de HTML | Niets gevonden. Geen actie nodig. |
| **Docent** | 15/17 HTML-stappen perfect, 2 kosmetisch | Label voor "voorstel ingetrokken" ontbreekt; eindpresentatie-planningpagina is soberder dan de HTML (geen gecombineerde datumsortering, geen mentor-bevestigingsstatus in de tabel). Niet blokkerend. |
| **Mentor** | Vanavond volledig gepolisht | Zie §1 hieronder — 2 echte bugs gefixt + functionele/visuele polish exact volgens de HTML. 3 kleine kosmetische restjes blijven (zie §2.4). |

### Alle 22 gebruikers — wie werkt, wie niet

Van de 22 testaccounts werken er **20 perfect** (juiste wachtwoord, juiste koppeling, tonen relevante data). **2 accounts hebben nog niets te demonstreren:**
- `mentor2@bedrijf.be` (Jan Peeters) — 0 dossiers gekoppeld.
- `docent3@ehb.be` (Jeroen Claes) — 0 dossiers gekoppeld.

`mentor3@bedrijf.be` heeft bewust geen wachtwoord (status "uitgenodigd") — dat is correct, dient om de activatieflow te demonstreren, geen bug.

**Enige actiepunt op "alle users moeten werken":** een 2de testdossier (idealiter bij een ander bedrijf) aanmaken en koppelen aan mentor2 + docent3. Verder is alles gelinkt en functioneel.

---

# Detail: Docent & Mentor

Scope: getoetst tegen David's flow-checklist en de twee HTML-prototypes (`stagify-docent-v28.html` demo-stappen 0-16, `stagify-mentor-v8.html` demo-stappen 0/0b/1-12).

## 1. Wat er écht gebeurd is vannacht (belangrijkste eerst)

### 2 echte bugs gevonden én live bevestigd gefixt
1. **`stagedossiers.status` sprong nooit automatisch van `geregistreerd` naar `stage_loopt`** — er bestond nergens een codepad dat dit deed. Fix: `startStageIndienNodig()` in `backend/src/controllers/logbookController.js`, zet de status automatisch zodra een student voor het eerst een logboekdag/-week indient. **Live getest en bevestigd werkend bij David Contract** (mentor + docent stepper toonde "Stage: Loopt" na logboekinvoer).
2. **Elke competentie (LO1, LO2...) verscheen 2-3x in elke evaluatiematrix** (mentor én docent), door een query in `evaluationController.js` (`getActiveCompetencies`) die niet filterde op het actief gepubliceerde competentieprofiel. Fix: `WHERE c.is_actief = 1 AND p.status = 'actief'`. **Live getest en bevestigd werkend bij Liam Loopt en Nora Afgerond** — elke LO komt nu maar 1x voor.

### Mentor-polish (functioneel + visueel), exact uit de HTML overgenomen
- **Tekenbevoegd-bevestiging** (`MentorDossierPage.jsx`): tekenen ging vroeger altijd door zonder bevestiging te vragen (`tekenbevoegd:true` hardcoded). Nu: checkbox + link "volledige overeenkomst lezen" (PDF) + foutmelding "Vink eerst de bevestiging aan." als je toch zonder vinkje probeert te tekenen — exact zoals `tekenContractM()` in de HTML.
- **"Verslag bekijken"-knop** (`MentorEvaluationPage.jsx`): zodra de docent de tussentijdse evaluatie registreert, ontbrak elke manier voor de mentor om het verslag te lezen. Nu: banner + knop + modal, exact zoals `toonVerslag()` in de HTML.
- **Tekstuele/visuele match met de HTML** (overal): knoptekstkleur, tabel-header-styling + hover-effect, sidebar "fase"-kaart (dikke rand + schaduw), sectielabels, contractbadge toont nu de echte registratiedatum ("Geregistreerd op [datum]"), logboekmelding vóór stagestart is nu letterlijk de HTML-tekst, finale-indienknop heet specifiek "Finale mentorinput indienen", eindresultaatkaart toont "Open acties: Geen".

## 2. Nog open — eerlijke lijst, niets verborgen

1. **`mentor2@bedrijf.be` (Jan Peeters) en `docent3@ehb.be` (Jeroen Claes) hebben nog 0 dossiers.** Enige "niet alle users werken"-gat dat nog bestaat. Vraagt een tweede testdossier/bedrijf.
2. **De volledige keten bedrijfsbezoek → tussentijdse evaluatie → eindpresentatie → finale beoordeling → vrijgeven is nog NOOIT door iemand zelf live van A tot Z doorlopen.** Nora Afgerond toont al een afgeronde flow, maar dat is vermoedelijk seed-data, geen bewijs dat de workflow zelf werkt als je hem zelf doorklikt. Stappenplan staat klaar (zie hieronder) — gewoon nog niet uitgevoerd zonder onderbreking.
3. **Aya Startklaar is nog niet getest** (enkel David Contract, Liam Loopt, Nora Afgerond wel).
4. Kleine kosmetische restjes, niet blokkerend: geen automatische pop-up bij bedrijfsbezoek-bevestiging (mentor), eindpresentatie-planningpagina bij docent is soberder dan de HTML, label voor "ingetrokken voorstel" bij docent ontbreekt.

## 3. Risico dat vannacht 2x voor verwarring zorgde: gedeelde live database

De database staat live en gedeeld op het team. **2x vanavond werd een dossier (David Contract) plots terug op de begintoestand gezet** (contract opnieuw "wacht op student", logboekweken weg) terwijl er actief getest werd — vermoedelijk door een seed/reset-script dat iemand draaide. Dit is geen codebug, maar het kost wel telkens een hele testronde. **Afspraak nodig binnen het team: niet meer zomaar seed-scripts draaien op de gedeelde DB terwijl iemand actief test.**

## 4. Hoofd-/alt-/error-flows — volledige audit (uitgevoerd vóór de fixes hierboven, conclusies blijven geldig)

| Rol | Hoofdflows | Alt-flows | Error-flows |
|---|---|---|---|
| Docent | 10/10 PASS | 9/9 PASS | 10/10 PASS |
| Mentor | 10/10 PASS | 6/6 PASS | 7/9 PASS, 2 PARTIAL (**beide nu opgelost, zie §1**) |

Geen enkele FAIL gevonden bij docent of mentor, op welk niveau dan ook. Volledige tabel met bewijs per flow (bestand/regel) stond in de vorige versie van dit rapport — ongewijzigd geldig, beschikbaar in git-historiek van dit bestand.

## 5. Stappenplan voor de nog niet geteste volledige evaluatieketen

Te volgen op **Liam Loopt** (staat al op het juiste punt — tussentijdse evaluatie staat open):

1. Docent (`docent@ehb.be`): Planning → bedrijfsbezoek plannen voor Liam.
2. Mentor (`mentor@bedrijf.be`): Planning → bevestigen.
3. Student (`student.loopt@ehb.be`): Evaluatie → Tussentijds → invullen → indienen.
4. Mentor: Evaluatie bij Liam → Tussentijds → invullen → indienen.
5. Docent: Evaluaties → Liam → Tussentijds → scores invullen → "Registreren".
6. Docent: Planning → eindpresentatie plannen voor Liam.
7. Docent: die eindpresentatie → "Markeer als gegeven".
8. Student: Evaluatie → Finaal → invullen → indienen.
9. Mentor: Evaluatie bij Liam → Finaal → invullen → indienen.
10. Docent: Evaluaties → Liam → Finaal → scores + eindpresentatiescore → "Registreren".
11. Docent: "Eindresultaat vrijgeven".
12. Student/mentor: resultaat moet nu zichtbaar zijn.

## 6. Demo-Script Dat Nu Wel Werkt

1. Login als mentor: `mentor@bedrijf.be` / `Demo!2026` → 4 stagiairs bij CodeLab Brussels.
2. Open Liam Loopt → contract geregistreerd, stage loopt, logboek + evaluatie actief — beste "gouden pad".
3. Bij Liam Loopt: Logboeken → check een week af.
4. Login als docent: `docent@ehb.be` → "Mijn studenten" toont Liam Loopt en David Contract.
5. Open Liam Loopt bij docent → logboekweek nakijken, tussentijdse evaluatie, planning.
6. Login als docent2: `docent2@ehb.be` → Nora Afgerond toont volledig afgeronde flow met vrijgegeven eindresultaat.

**Let op:** door de DB-reset (zie §3) kan David Contract weer op de begintoestand staan op het moment dat je dit leest — even checken vóór je hem demonstreert.

## Buiten scope (bewust niet aangeraakt)

Login-pagina, navbar/sidebar/notificatiebel (gedeeld met alle rollen), stagecommissie, administratie.

## Credentials

| Rol | E-mail | Wachtwoord |
|---|---|---|
| Docent | docent@ehb.be (Koen Wouters) | Demo!2026 |
| Docent | docent2@ehb.be (Lien Maes) | Demo!2026 |
| Docent | docent3@ehb.be (Jeroen Claes — 0 dossiers) | Demo!2026 |
| Mentor | mentor@bedrijf.be (Sofie Maris) | Demo!2026 |
| Mentor | mentor2@bedrijf.be (Jan Peeters — 0 dossiers) | Demo!2026 |
| Student | student.contract@ehb.be (David Contract) | Demo!2026 |
| Student | student.loopt@ehb.be (Liam Loopt) | Demo!2026 |
| Student | student.startklaar@ehb.be (Aya Startklaar) | Demo!2026 |
| Student | student.afgerond@ehb.be (Nora Afgerond) | Demo!2026 |

*(Live DB is gedeeld met het team en kan tussen sessies wijzigen — zie §3.)*
