# Frontend-wiring TODO (student + stagecommissie)

Deze branch port de verbeterde **student- en commissie-frontend** bovenop de huidige `main`.
De **backend van `main` bleef ongemoeid** (die is recenter/completer dan de oude fix-branch).
Daardoor moeten enkele frontend-onderdelen nog gekoppeld worden aan het **bestaande backend-contract van `main`**.

Build + module-load zijn groen; onderstaande punten zijn **functionele** koppelingen, geen build-fouten.

## ✅ Werkt al (frontend ↔ main-backend)
- Student: stagevoorstel indienen/concept/herindienen/intrekken, contract bekijken + **PDF download** (`/contracts/my/pdf`), documenten, logboek.
- Student: **eindoverzicht-download** en **historiek** via toegevoegde endpoints
  `GET /api/students/me/eindoverzicht.pdf`, `GET /api/students/me/final-result`, `GET /api/internships/my/historiek`.
- Commissie: overzicht (filter + versie-kolom), detail, versievergelijking, **echte historiek** via
  `GET /api/committee/applications/:id/historiek`, afkeuren + aanpassingen vragen (incl. onderdeel).

## ⚠️ Nog te koppelen — commissie-goedkeuringsflow (`ApplicationsPage.jsx`)
De backend van `main` (`decideApplication`) verwacht een **ander contract** dan de huidige frontend stuurt:

1. **Criteria-checklist apart opslaan.**
   `main` leest de criteria uit tabel `voorstel_checklist` (gevuld via `PUT /api/committee/applications/:id/checklist`)
   en weigert een **gewone** goedkeuring als niet alle verplichte criteria in orde zijn.
   → Voor goedkeuren: eerst `PUT /applications/:id/checklist` aanroepen met de aangevinkte criteria,
   dan pas `PATCH /applications/:id/decision`.
   (De huidige frontend stuurt `criteria` + `alleCriteriaOk` mee in de decision-PATCH; dat negeert `main`.)

2. **Goedkeuren met uitzondering.**
   `main` verwacht `beslissing: "goedgekeurd_met_uitzondering"` (+ `uitzonderingMotivering`).
   → De huidige frontend stuurt `beslissing: "goedgekeurd"` + `metUitzondering: true`; pas dit aan naar de
   `goedgekeurd_met_uitzondering`-waarde.

3. **Opgeslagen checklist tonen / decisions-historiek.**
   - `GET /applications/:id/checklist` response van `main` controleren en de matrix-vinkjes ermee vullen
     (veldnamen kunnen afwijken van `{criterium, is_in_orde}`).
   - Optioneel: `GET /applications/:id/decisions` gebruiken voor een rijkere beslissingshistoriek.

## ⚠️ Aandachtspunt — eindoverzicht serveren
`GET /api/students/me/eindoverzicht.pdf` genereert de PDF on-the-fly (werkt onafhankelijk).
De via-admin gegenereerde eindoverzicht-bestanden staan onder `/uploads/eindoverzichten/...`;
de statische `/uploads`-handler in `server.js` serveert geen subpaden — controleer dat apart indien nodig.

## Niet aangeraakt (bewust)
- `main`-backend logica (decideApplication, checklist-endpoints, registerOvereenkomst, saveLogbookDay, eindcijfer-maskering): blijft zoals in `main`.
- `/api/documents/bestand/:filename` is publiek (iframe-preview); echte afscherming = aparte rol-overschrijdende taak.

---

# Mentor (stories 27–34) — gefixt + resterend

## ✅ Gefixt in deze ronde
- **28** Ondertekenen werkt nu (`tekenbevoegd: true` meegestuurd i.p.v. lege body, in MentorContractPage én MentorDossierPage) + **mentor-PDF-download** (`GET /mentor/contract/:dossierId/pdf`).
- **27** Activatie werkt via de link (de onbestaande "verificatiecode" is uit de UI gehaald; backend gebruikt enkel de token).
- **31** "Dag bevestigen"-knop toegevoegd (`PATCH /mentor/logbooks/days/:dayId/confirm`) + server-side status-guard: enkel een *ingediende* week kan nagekeken worden (ontbrekende/afgesloten week niet).
- **32** Mentor (+ docent) krijgt nu een **melding bij studentantwoord**; het antwoord wordt getoond in de mentor-logboek-UI.
- **34** **Resultaatkaart** (eindcijfer + competentiescore + eindfeedback) wordt nu getoond zodra de docent vrijgeeft.
- Navigatie: mentormenu heeft nu links naar **Overeenkomst / Afspraken / Bedrijfsbezoek** (waren onbereikbaar).

## ⚠️ Nog te doen (vereist schema/grotere keuze)
1. **Echte feedback-thread (story 32).** `mentor_feedback` en `student_antwoord` zijn elk één tekstveld dat overschreven wordt → enkel het laatste bericht overleeft. Een volledige thread vereist een aparte tabel (bv. `logboek_feedback`). Nu: laatste feedback + laatste antwoord zichtbaar.
2. **Ontbrekende weken voor mentor (story 31).** Detectie/aanduiding + melding van ontbrekende weken bestaat alleen voor de docent (`getMissingLogbooksForDocent`). Een mentor-variant (op basis van `aantal_weken`) ontbreekt nog.
3. **Algemene praktijkfeedback mentor-evaluatie (story 33).** De UI heeft een "algemene feedback"-veld maar er is geen backend-veld om dit per evaluatiemoment op te slaan (`saveScores` werkt per competentie). Of: veld verwijderen, of een kolom toevoegen.
4. **Gestructureerd afsprakenformulier (story 29).** Backend `updateAfspraken` ondersteunt losse velden (werkuren, eerste dag, contactpersoon…), maar de mentor-UI stuurt enkel één vrij tekstveld. Frontend nog uit te bouwen naar de aparte velden.

## ℹ️ Bekend (app-breed, geen mentor-bug)
- Login verifieert geen wachtwoord (e-mail-only) en auth is een `x-user-id`-demostub. Het mentor-wachtwoord wordt wél veilig (pbkdf2) opgeslagen bij activatie, maar bij login niet gecontroleerd — aanpakken hoort bij een app-brede auth-taak.

---

# Docent (stories 35–44) — gefixt + resterend

## ✅ Gefixt in deze ronde
- **37** Studentdossier laadt nu (route-param `:dossierId` ↔ controller gelijkgetrokken + filter op `d.id`); frontend leest de juiste velden (`student_naam`, `mentor_naam`, `stageovereenkomst.*`), **documentenkaart** + **snelle links** (logboek/evaluatie/planning) toegevoegd.
- **40** `/docent/logbooks/missing` staat nu vóór `/:studentId` (was onbereikbaar); "Herinner student" stuurt het **weeknummer** mee; ontbrekende weken worden berekend o.b.v. **`aantal_weken`** (i.p.v. enkel gaten tussen ingediende weken).
- **43** **Rekenbug gefixt**: eindpresentatie wordt nu op **/20** ingevoerd (matcht de gewogen backend-berekening) i.p.v. 1–5.
- **38** Bedrijfsbezoek: "Markeer als geweest" zet nu status `geweest` (i.p.v. `gegeven`) + label/kleur toegevoegd.
- **36** Voorstellen-tabel toont nu correcte velden (`voorstel_status`, `stagefunctie`); detail haalt **commissiefeedback + versiehistoriek** op via `getDocentProposalById`.
- Schema: `logboek_dagen.competenties` toegevoegd aan `schema.sql` (verse install brak voorheen).

## ⚠️ Nog te doen
1. **Story 35** — kolom "openstaande actie / deadline" in het studentenoverzicht (backend moet volgende actie/deadline berekenen).
2. **Story 41** — docent-evaluatie-UI: feedbackveld **per competentie**, weergave van student-/mentor-motivering, logboekbewijzen, en een **verslag-invoerveld** (backend slaat `verslag` + per-competentie `feedback` al op; UI ontbreekt).
3. **Story 42** — **deelnemers**-veld bij eindpresentatie (vereist kolom in `planning_momenten`) + expliciete koppeling presentatie ↔ finale beoordeling.
4. **Story 43** — vooraf-**checklist met ontbrekende voorwaarden** (logboek/mentorinput/presentatie) in de UI; nu worden ontbrekende voorwaarden enkel als foutmelding ná een poging getoond (backend dwingt ze wél correct af).
5. **Story 39** — competenties per logboekdag tonen in het docent-weekdetail (data wordt al opgehaald, kolom nog niet gerenderd).

## ℹ️ Kleinere/cosmetische punten
- Story 44 gebruikt `window.confirm` i.p.v. een echte bevestigingsmodal (functioneel gelijkwaardig).

---

# Cross-user verificatie (tegen Stagify-FLOWS-VOLLEDIG.md)

## ✅ Gefixt in deze ronde
- **Week indienen** dwingt nu server-side af dat alle verplichte werkdagen ingevuld/geen-stagedag zijn (was client-only — regressie hersteld).
- **Melding "logboekweek ingediend → mentor"** opnieuw toegevoegd (was verloren bij de forward-port).
- **Logboek-gate**: indienen kan pas zodra het dossier voorbij de contract-/controlefase is (blokkeert `wacht_op_student/_bedrijf/in_controle/document_afgekeurd`).
- **Docent-melding tussentijdse/finale evaluatie**: docent wordt nu ook verwittigd wanneer de **student als laatste** indient en de evaluatie daardoor `klaar_voor_docent` wordt.

## ℹ️ Bewust niet gewijzigd (consistent of bewuste keuze)
- `decideApplication` weigert `aanpassingen_gevraagd`: dit is **correct** per de flow (student herindient eerst → `heringediend`). De commissie-UI toont de beslis-knoppen ook enkel bij `ingediend`/`heringediend` (`isBeslis`), dus geen 409-mismatch.
- Eindcijfer-maskering, vrijgave-gating, handtekeningvolgorde, mentor→docent-logboekvolgorde: allemaal correct server-side afgedwongen.

## ⚠️ Resterend (klein / latere ronde)
- Geen generieke **audit-log** bij begeleider-koppeling (`assignDossier`) en eindoverzicht-generatie (enkel timestamp + meldingen).
- "Dubbele actieve mentor-uitnodiging" leunt op e-mailuniciteit i.p.v. een expliciete uitnodiging-statuscheck.
- Eindpresentatie "gegeven" stuurt een generieke "Planning bijgewerkt"-melding i.p.v. een specifieke.
- **App-breed:** auth is een `x-user-id`-demostub (geen wachtwoord/sessie). Alle cross-user beveiliging steunt op de per-controller ownership-checks (die zijn correct). Echte authenticatie = aparte app-brede taak.
