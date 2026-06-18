# Stagify — demo-accounts & rollen (team-referentie)

> Alle accounts hieronder zitten in de gedeelde demo-database (geseed via `backend/scripts/seed-demo.js`).
> **Demo-wachtwoord voor iedereen: `Stagify!2026`** (één uitzondering: de uitgenodigde mentor, zie onder).
> Inloggen via het loginscherm met **e-mail + wachtwoord**. Je rol bepaalt automatisch welk dashboard je krijgt.

---

## 1. Hoe het systeem je rol bewaakt (kort)

1. **Login** (`POST /api/auth/login`): e-mail + wachtwoord → de server controleert het wachtwoord en geeft een **gesigneerd sessietoken** terug (12 u geldig). In dat token zit je gebruikers-id, met een handtekening die je niet kunt namaken.
2. **Elke API-call** stuurt dat token mee (`Authorization: Bearer …`). De server haalt op basis van het id je **rol vers uit de database** — niet uit iets dat de browser meestuurt.
3. **Rol-poort per route** (`requireRole(...)`): elke routegroep eist een specifieke rol. Verkeerde rol → **403**, geen/ongeldig token → **401**.

→ Een student kan dus **nooit** een admin-pagina gebruiken, ook niet door de URL handmatig in te typen: de server blokkeert het (403). Knoppen verbergen in de frontend is alleen comfort; de échte beveiliging zit op de server.

| Routegroep | Vereiste rol |
|---|---|
| `/api/admin/*`, `/api/users/*`, competentie-beheer | `administratie` |
| `/api/committee/*` | `stagecommissie` |
| `/api/docent/*` | `docent` |
| `/api/mentor/*` | `mentor` |
| `/api/student/*`, `/api/logbooks/*`, `/api/internship/*`, contract, documenten | `student` |
| evaluaties | gedeeld, per actie afgeschermd (student/mentor/docent/administratie) |

---

## 2. Alle accounts

### Staf (school) — 3 per rol

| ID | Naam | E-mail | Rol | Wachtwoord |
|----|------|--------|-----|------------|
| 1 | Sara Commissie | `commissie@ehb.be` | stagecommissie | `Stagify!2026` |
| 18 | Bram Devos | `commissie2@ehb.be` | stagecommissie | `Stagify!2026` |
| 21 | Inge Vermeulen | `commissie3@ehb.be` | stagecommissie | `Stagify!2026` |
| 2 | Koen Wouters | `docent@ehb.be` | docent | `Stagify!2026` |
| 3 | Lien Maes | `docent2@ehb.be` | docent | `Stagify!2026` |
| 20 | Jeroen Claes | `docent3@ehb.be` | docent | `Stagify!2026` |
| 4 | Tom Admin | `admin@ehb.be` | administratie | `Stagify!2026` |
| 19 | Eva Janssens | `admin2@ehb.be` | administratie | `Stagify!2026` |
| 22 | Karim Haddad | `admin3@ehb.be` | administratie | `Stagify!2026` |

### Mentoren (bedrijf)

| ID | Naam | E-mail | Rol | Wachtwoord | Bijzonder |
|----|------|--------|-----|------------|-----------|
| 5 | Sofie Maris | `mentor@bedrijf.be` | mentor | `Stagify!2026` | gekoppeld aan de lopende stages |
| 6 | Jan Peeters | `mentor2@bedrijf.be` | mentor | `Stagify!2026` | tweede bedrijf (DataForge) |
| 7 | Nieuwe Mentor | `mentor3@bedrijf.be` | mentor | **— (nog te activeren)** | status `uitgenodigd`: test de activatieflow |

### Studenten — één per stage-staat (zo kun je elke fase tonen)

| ID | Naam | E-mail | Stage-staat / wat je ziet |
|----|------|--------|----------------------------|
| 8 | Emma Geen | `student.geen@ehb.be` | nog **geen** voorstel — startpunt, kan indienen |
| 9 | Noah Ingediend | `student.ingediend@ehb.be` | voorstel **ingediend**, wacht op beoordeling |
| 10 | Lina Aanpassingen | `student.aanpassingen@ehb.be` | **aanpassingen gevraagd** door docent |
| 11 | Mila Heringediend | `student.heringediend@ehb.be` | **heringediend** (versie 2) |
| 12 | Sam Afgekeurd | `student.afgekeurd@ehb.be` | voorstel **afgekeurd** |
| 13 | Yara Ingetrokken | `student.ingetrokken@ehb.be` | voorstel **ingetrokken** door student |
| 14 | David Contract | `student.contract@ehb.be` | goedgekeurd → **contract/overeenkomst**-fase |
| 15 | Aya Startklaar | `student.startklaar@ehb.be` | alles rond → **startklaar** |
| 16 | Liam Loopt | `student.loopt@ehb.be` | stage **loopt** (logboek, evaluaties bezig) |
| 17 | Nora Afgerond | `student.afgerond@ehb.be` | stage **afgerond** (eindevaluatie) |

---

## 3. Hoe komt een **nieuw** account binnen? (per rol)

Belangrijk om eerlijk te weten voor de demo — niet elke rol heeft al een volledige zelf-aanmaak-flow:

| Rol | Hoe het account ontstaat | Status in de code |
|-----|--------------------------|-------------------|
| **Mentor** | Admin nodigt uit (`POST /api/admin/invitations` → `inviteMentor`). De mentor krijgt een **e-mail met activatielink** (14 dagen geldig), opent die en **kiest zelf een wachtwoord** (`activateMentor`). Pas daarna kan hij inloggen. | ✅ **volledig gebouwd** — test met account 7 |
| **Student / docent / stagecommissie / administratie** | Bestaan nu **alleen omdat het seed-script ze aanmaakt** met een vast wachtwoord. Er is (nog) **geen UI/endpoint** om er nieuwe aan te maken of om zelf een wachtwoord in te stellen. | ⚠️ **nog niet gebouwd** |

**Concreet: wat gebeurt er als er een nieuwe student bijkomt?**
Op dit moment: niets automatisch — die student moet in de database gezet worden (zoals de seed doet). Er is geen registratiescherm en geen "school stuurt studentenlijst in".

**De drie realistische manieren om dit op te lossen** (keuze voor het team):

1. **School-import / SSO** (meest realistisch voor een hogeschool): studenten komen uit het schoolsysteem (de `auth_provider` is in de DB al `school_sso` voor niet-mentoren). Login zou dan via de schoolaccount lopen i.p.v. een eigen wachtwoord. Veel werk, buiten de scope van de demo.
2. **Admin maakt accounts aan** (zelfde patroon als mentor): een `POST /api/users`-endpoint + adminscherm waarmee de administratie een student/docent toevoegt; die krijgt een activatie-/wachtwoordmail. Dit is de **kleinste, consistente uitbreiding** — hergebruikt de bestaande uitnodig-/activatie-bouwstenen van de mentor.
3. **Zelfregistratie** met schoolmail (`@ehb.be`/`@student.ehb.be`): student maakt zelf een account. Eenvoudig, maar minder gecontroleerd (wie mag zich registreren?).

> **Aanbeveling:** optie 2 (admin nodigt uit, net als bij mentoren) past het best bij wat er al staat en is in een halve dag te bouwen. Voor de demo zelf volstaan de geseede accounts — maar dit is wél een eerlijk gat om te benoemen bij de verdediging.

---

## 4. Opnieuw seeden / accounts toevoegen

- **Volledige reset + demo-data** (wist álles in de DB, VPN vereist):
  `cd backend && node scripts/seed-demo.js`
- **Alleen extra staf toevoegen, zónder iets te wissen** (idempotent, veilig dubbel te draaien):
  `cd backend && node scripts/add-staff.js`
- Elke staf-rol heeft nu **3 accounts** (commissie/docent/administratie). Ze zitten zowel in het seed-script als in `add-staff.js`.
