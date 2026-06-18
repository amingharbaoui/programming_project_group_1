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
