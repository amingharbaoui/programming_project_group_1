# Stagify Functionele Audit — Docent & Mentor (2026-06-20)

Scope: enkel **docent** en **mentor**, getoetst tegen David's flow-checklist en de twee HTML-prototypes (`stagify-docent-v28.html` demo-stappen 0-16, `stagify-mentor-v8.html` demo-stappen 0/0b/1-12). Stagecommissie/administratie/student: niet aangeraakt, niet in dit rapport.

## 1. Setup

- Code-audit uitgevoerd op branch `feature/evaluaties`, geen live-DB-toegang vanuit deze sessie (remote DB niet bereikbaar) — oordelen zijn code-niveau (routes/controllers/validaties), niet een live doorklik-test. Functionele tests die je zelf in de browser deed (David Contract, logboek week 1) zijn wel meegenomen.
- Net gefixt: `stagedossiers.status` ging nooit automatisch van `geregistreerd` naar `stage_loopt`. Helper `startStageIndienNodig()` toegevoegd in `backend/src/controllers/logbookController.js`, aangeroepen vanuit `createLogbook()` en `saveLogbookDay()` — zodra de student voor het eerst een logboekdag/-week indient op een `geregistreerd`-dossier, springt de status automatisch naar `stage_loopt`.
- **Let op:** dit fixt enkel nieuwe activiteit. Het dossier van **David Contract** had de logboekactiviteit al vóór de fix — die status staat dus nog op `geregistreerd` in de DB. Vul een extra logboekdag in (of bewerk er één) om de transitie alsnog te triggeren, of laat weten of je een eenmalig script wil om dat dossier direct te corrigeren.

## 2. Samenvatting

| Rol | Hoofdflows getest | PASS | PARTIAL | FAIL |
|---|---|---|---|---|
| Docent | 10 | 10 | 0 | 0 |
| Mentor | 10 | 10 | 0 | 0 |

| Rol | Alt-flows getest | PASS | PARTIAL | FAIL |
|---|---|---|---|---|
| Docent | 9 | 9 | 0 | 0 |
| Mentor | 6 | 6 | 0 | 0 |

| Rol | Error-flows getest | PASS | PARTIAL | FAIL |
|---|---|---|---|---|
| Docent | 10 | 10 | 0 | 0 |
| Mentor | 9 | 7 | 2 | 0 |

**Kritieke demo-risico's:** geen P0. Twee P1/P2-punten bij mentor (zie §6), beide in de frontend van `MentorDossierPage.jsx`, backend blijft overal de echte poortwachter.

## 3. Hoofdflows

### Bij docent

| # | Flow | Status | Bewijs | Demo-stap |
|---|---|---|---|---|
| 1 | Ziet toegewezen studenten | PASS | `getDocentStudents` filtert op `stagebegeleider_id` (docentController.js:49) | 7-16 |
| 2 | Opent studentdossier | PASS | query met `stagebegeleider_id`-check (docentController.js:212) | 7-16 |
| 3 | Bekijkt stagevoorstel read-only | PASS | geen write-route op `/docent/proposals*` | 1-5 |
| 4 | Logboekweek nakijken na mentorcontrole | PASS | 409 tenzij mentor al afgecheckt (logbookController.js:696-699) | 9, 12 |
| 5 | Plant bedrijfsbezoek | PASS (nu pas werkend dankzij stage_loopt-fix) | `planningController.js:95-137`; actie verschijnt pas bij `actief(dossier_status)` | 8, 13 |
| 6 | Registreert tussentijdse evaluatie | PASS | gate op status + volledige scores (evaluationController.js:323-341) | 10-11 |
| 7 | Plant eindpresentatie | PASS | zelfde toegangscontrole als bedrijfsbezoek | 13 |
| 8 | Vult finale beoordeling in | PASS | score 1-5 + volledigheidscheck (evaluationController.js:168-174, 337-341) | 14 |
| 9 | Berekent eindresultaat | PASS | mentorinput + eindpresentatie verplicht, 80/20-formule (evaluationController.js:344-383) | 14 |
| 10 | Geeft eindresultaat vrij | PASS | status moet `klaar_voor_vrijgave` zijn, alle weken goedgekeurd (evaluationController.js:439-471) | 15-16 |

### Bij mentor

| # | Flow | Status | Bewijs | Demo-stap |
|---|---|---|---|---|
| 1 | Activeert account via uitnodiging | PASS | `getMentorInvitation`/`activateMentor` checken vervaldatum (userController.js:252-339) | 0b |
| 2 | Logt in | PASS | status='actief'-check + lockout (authRoutes.js:13-71) | 0 |
| 3 | Ziet eigen stagiair(s) | PASS | `WHERE sd.mentor_id = ?` (mentorController.js:8-48) | 5-6 |
| 4 | Tekent overeenkomst | PASS (backend) — zie P1 hieronder | `tekenContract` weigert zonder tekenbevoegd/student-handtekening (mentorController.js:77-146) | 1 |
| 5 | Deelt praktische afspraken | PASS | `updateAfspraken` (mentorController.js:171-227) | 3 |
| 6 | Controleert logboekweken | PASS | alleen status `ingediend` accepteerbaar (logbookController.js:546-643) | 6 |
| 7 | Bevestigt bedrijfsbezoek | PASS | `confirmMentorPlanning` (planningController.js:220-258) | 7 |
| 8 | Vult tussentijdse mentorinput in | PASS | `saveScores` (evaluationController.js:156-290) | 8 |
| 9 | Vult finale mentorinput in | PASS | idem + verplicht voor docent's berekening | 10 |
| 10 | Bekijkt eindresultaat na vrijgave | PASS | resultaat verborgen tot `vrijgegeven` (evaluationController.js:120-127) | 12 |

## 4. Alternative / Side Flows

**Bij docent (alle PASS):** ontbrekende logboekweken opvolgen, student herinneren, logboekweek terugsturen, bedrijfsbezoek/eindpresentatie als geweest/gegeven markeren, tussentijdse evaluatie toont ontbrekende input, finale beoordeling voorlopig bewaren, eindresultaat toont ontbrekende voorwaarden, voorstelhistoriek read-only — zie bewijs in de volledige audit-output (logbookController.js, evaluationController.js, planningController.js, docentController.js).

**Bij mentor (alle PASS):** alternatief bedrijfsbezoek voorstellen, logboekweek terugsturen, logboekdag afzonderlijk bevestigen, meerdere stagiairs opvolgen, mentorinput voorlopig bewaren, resultaat pas na vrijgave tonen.

## 5. Error / Failure Flows

**Bij docent: 10/10 PASS** — geen niet-toegewezen student kunnen openen, voorstel niet kunnen wijzigen, logboekweek niet vóór mentorcontrole, ontbrekende week niet goedkeurbaar, tussentijds/finaal berekenen met ontbrekende input geweigerd, dubbel vrijgeven voorkomen. Allemaal bevestigd op code-niveau (zie agent-rapport).

**Bij mentor: 7/9 PASS, 2 PARTIAL:**

| Flow | Status | Detail |
|---|---|---|
| Activatielink verlopen/al gebruikt | PASS | 410/404 correct afgehandeld |
| Niet tekenen vóór student getekend heeft | PASS | 409 in `tekenContract` |
| **Niet tekenen zonder tekenbevoegdheid te bevestigen** | **PARTIAL** | Backend weigert correct zonder `tekenbevoegd:true`. Maar in `MentorDossierPage.jsx` (regel ~197-209/312-314) wordt `tekenbevoegd:true` **hardcoded meegestuurd zonder checkbox/bevestiging** — op `MentorContractPage.jsx` staat die checkbox wél. Als de mentor via de dossierpagina tekent, wordt er nooit expliciet om bevoegdheidsbevestiging gevraagd. |
| **Geen niet-gekoppelde stagiair kunnen openen** | **PARTIAL** | Alle API's controleren correct (403). Maar `MentorDossierPage.jsx` (regel ~106-128) valt bij een ongeldige/niet-gekoppelde student-querystring stilzwijgend terug op de eerste eigen stagiair, in plaats van een foutmelding te tonen. Enkel relevant bij directe URL-manipulatie, niet in normale demo-navigatie. |
| Logboekweek niet afchecken zonder indiening | PASS | 409 tenzij status `ingediend` |
| Terugsturen zonder feedback geweigerd | PASS | 400 zonder feedback |
| Mentorinput met ontbrekende competenties geweigerd | PASS | client + server check |
| Eindresultaat verborgen vóór vrijgave | PASS | backend + frontend gate |

## 6. Kritieke Fixlijst Voor Maandag

| Prioriteit | Wat is stuk | Rol/Flow | Waar in code | Hoe te fixen | Hoe te testen |
|---|---|---|---|---|---|
| **P1** | Mentor kan via dossierpagina tekenen zonder expliciete bevoegdheidsbevestiging (UX-gat, backend blijft veilig) | Mentor — overeenkomst tekenen | `frontend/src/features/mentor/pages/MentorDossierPage.jsx` (~regel 197-209, 312-314) | Checkbox/bevestigingsstap toevoegen zoals in `MentorContractPage.jsx`, `tekenbevoegd` pas `true` na expliciete actie | Login als mentor, open dossier David Contract (al getekend, dus test met een ander dossier zonder bedrijfshandtekening), klik "Digitaal ondertekenen", controleer dat bevestiging gevraagd wordt |
| **P2** | Bij ongeldige/niet-gekoppelde student-id in URL valt mentor-dossierpagina stil terug op eerste eigen stagiair i.p.v. foutmelding | Mentor — niet-gekoppelde stagiair openen | `frontend/src/features/mentor/pages/MentorDossierPage.jsx` (~regel 106-128) | Bij geen match: foutmelding "Stagiair niet gevonden of niet aan jou gekoppeld" tonen i.p.v. fallback | Als mentor, navigeer naar `/mentor/dossier?student=99999` (niet-bestaand), verwacht foutmelding i.p.v. andere stagiair |
| **P2** | David Contract-dossier staat nog op `geregistreerd` ondanks logboekactiviteit (van vóór de fix) | Mentor/Docent — stage-stepper toont "Nog niet gestart" | live DB, dossier_id 1 | Eén extra logboekdag invullen (triggert nieuwe fix automatisch), of apart vragen om eenmalige DB-correctie | Open dossier David Contract bij mentor én docent, controleer dat stepper "Stage: Loopt" toont |

Geen P0's — niets blokkeert de demo zelf.

## 7. Demo-Script Dat Nu Wel Werkt

1. Login als mentor: `mentor@bedrijf.be` / `Demo!2026` → zie 4 stagiairs (David Contract, Aya Startklaar, Liam Loopt, Nora Afgerond), allemaal bij CodeLab Brussels.
2. Open Liam Loopt → dossier toont contract geregistreerd, stage loopt, logboek + evaluatie actief — beste "gouden pad" voor live demo.
3. Bij Liam Loopt: open Logboeken → bekijk ingediende/afgecheckte weken, check een nieuwe week af.
4. Login als docent: `docent@ehb.be` / `Demo!2026` → "Mijn studenten" toont Liam Loopt en David Contract.
5. Open Liam Loopt bij docent → logboekweek nakijken (na mentorcontrole), tussentijdse evaluatie invullen, bedrijfsbezoek/eindpresentatie plannen.
6. Login als docent2: `docent2@ehb.be` / `Demo!2026` → Nora Afgerond toont volledig afgeronde flow met vrijgegeven eindresultaat (let op: logboekweken zijn placeholders, zie eerder genoteerd in `KNOWN_ISSUES.md`).

## Buiten scope (bewust niet aangeraakt)

Login-pagina, navbar/sidebar/notificatiebel (gedeeld met alle rollen), stagecommissie, administratie — niet aangepast zonder akkoord.

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

*(Live DB is gedeeld met het team en kan tussen sessies wijzigen.)*
