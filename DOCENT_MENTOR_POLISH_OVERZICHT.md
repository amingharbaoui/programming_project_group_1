# Polish-overzicht: Docent & Mentor (2026-06-20)

Vergelijking van de app tegen de twee HTML-prototypes (`stagify-docent-v28.html`, `stagify-mentor-v8.html`), per demo-stap uit hun ingebouwde "Demo"-dropdown.

## Status — laatste update

- **Bij docent: 88/100.** Functioneel volledig, alle 6 pagina's visueel gepolished naar de HTML, studentenoverzicht herbouwd naar de echte HTML-structuur, stepper-logica gecorrigeerd.
- **Bij mentor: 90/100.** Functioneel volledig, alle 7 pagina's gepolished, structuur klopte al, stepper-logica gecorrigeerd, logboek-pariteit met docent toegevoegd.
- **Database**: niets aangepast deze sessie. Enkel code (backend-controllers, frontend-pagina's/CSS) en documentatie.
- **Stagecommissie / administratie**: niets aangepast, geen enkel bestand aangeraakt.
- **Branch**: alles staat lokaal op `feature/docent-mentor-polish`, nog niet gepusht — eerst testen.

---

## Bij Docent

Prototype: `stagify-docent-v28.html` — demo-stappen 0 t.e.m. 16.

| Stap | Omschrijving prototype | App-pagina | Status |
|---|---|---|---|
| 6 | Goedgekeurd — contractfase | `DocentStudentDossierPage` (contractkaart + stepper) | ✓ Klopt |
| 9 | Week 1 ingediend — nalezen | `DocentLogbooksPage` (nakijkflow) | ✓ Klopt |
| 12 | Stage loopt — week 11 ontbreekt / week 12 nalezen (standaardstap) | `DocentLogbooksPage` (ontbrekende-weken-banner) | ✓ Klopt — bestond al |
| 15 | Eindresultaat vrijgeven | `DocentEvaluationsPage` (vrijgeven-knop) | ✓ Klopt |
| 16 | Afgerond — resultaat vrijgegeven | `DocentStudentDossierPage` (stepper volledig groen) | ✓ Klopt |

**Ontbrekend bij docent (bewust, niet gefixt voor maandag):**
- Stage-stappenbalk zelf (Voorstel→Beoordeling→Contract→Stage→Evaluatie) **was** ontbrekend, **nu toegevoegd**.
- "Opdracht"-tekst van het stagevoorstel staat niet op de dossierpagina — data bestaat (`opdrachtomschrijving`), wordt enkel niet getoond. Klein, bewust uitgesteld.
- Privé-notities + tijdlijn uit het prototype: bestaan nergens in de backend (geen tabel/kolom). Bewust geschrapt — zou een nieuwe feature zijn, geen polish.
- Geen UI-knop om een evaluatie te "openen" (`niet_open` → `open`) — bestaat ook niet in het prototype zelf. Geaccepteerd als bedoeld gedrag, geen bug.

---

## Bij Mentor

Prototype: `stagify-mentor-v8.html` — demo-stappen 0, 0b, 1 t.e.m. 12.

| Stap | Omschrijving prototype | App-pagina | Status |
|---|---|---|---|
| 1 | Contract — handtekening mentor nodig | `MentorDossierPage` / `MentorContractPage` | ✓ Klopt |
| 3 | Geregistreerd — praktische afspraken delen | `MentorDossierPage` (afsprakenkaart) | ✓ Klopt — bug gefixt (zie onder) |
| 6 | Week 1 ingediend — afchecken | `MentorLogbooksPage` | ✓ Klopt |
| 7 | Bedrijfsbezoek bevestigen | `MentorPlanningPage` / `MentorDossierPage` | ✓ Klopt |
| 9 | Stage loopt — week 11 ontbreekt / week 12 afchecken (standaardstap) | `MentorLogbooksPage` | ✓ **Nu pas toegevoegd** (zie onder) |
| 12 | Afgerond — geen acties | `MentorEvaluationPage` | ✓ Klopt |

**Ontbrekend bij mentor — nu opgelost deze sessie:**
- "Ontbrekende weken"-banner bestond bij docent, **niet** bij mentor → toegevoegd aan `MentorLogbooksPage.jsx` + `aantal_weken` toegevoegd aan de backend-respons (`mentorController.js`).
- Stepper (Contract/Voorbereiding/Stage/Evaluatie) op `MentorDossierPage` was weg na de herstructurering van Amin → terug toegevoegd.
- Bug: "Deel met de student" kon leeg gedeeld worden (datum gezet zonder tekst) → knop nu uitgeschakeld zonder tekst, functie weigert leeg op te slaan.
- 2 kleine class-bugs (`s-grijs` bestond niet, enkel `s_grijs`) → gefixt op `MentorDossierPage.jsx` en `MentorLogbooksPage.jsx`.

---

## Buiten scope (bewust niet aangeraakt)

- **Login-pagina**: gedeeld door alle rollen, niet aangepast.
- **Navbar / Sidebar / Notificatiebel**: gedeeld door alle rollen incl. stagecommissie en administratie — niet aangepast zonder akkoord.
- **Stagecommissie en administratie**: volledig buiten scope, niet aangeraakt.

## Apart gedocumenteerd

- Datakwaliteitsprobleem met "Codex..."-testdata (foute mentor-koppeling, onmogelijke weeknummers/jaartallen) → zie `KNOWN_ISSUES.md`. Geen codebug, te negeren voor de demo.

---

## Credentials — Docent

- **E-mail:** `docent@ehb.be`
- **Wachtwoord:** `Demo!2026`
- Account: Koen Wouters — heeft o.a. dossiers met volledige data (logboek, evaluatie, contract, planning) om alles te tonen.

*(Let op: live DB is gedeeld met het team en kan tussen sessies wijzigen — als dit account niet meer werkt, even melden.)*
