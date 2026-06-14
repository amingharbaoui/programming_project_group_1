# Stageify API Contract

## Auth
POST /api/auth/login
GET /api/auth/me

## Users
GET /api/users

## Student / Stagevoorstel
GET /api/internships/my
POST /api/internships
PATCH /api/internships/:id

## Stagecommissie
GET /api/committee/applications
GET /api/committee/applications/:id
PATCH /api/committee/applications/:id/decision

## Administratie
GET /api/admin/dossiers
GET /api/admin/dossiers/:id
PATCH /api/admin/dossiers/:id/status

## Mentor
GET /api/mentor/students
GET /api/mentor/logbooks/:studentId
PATCH /api/mentor/logbooks/:weekId/check

## Docent
GET /api/docent/students
GET /api/docent/students/:id
GET /api/docent/logbooks/:studentId
PATCH /api/docent/logbooks/:weekId/review

## Logboeken
POST /api/logbooks
GET /api/logbooks/:studentId

## Competenties
GET   /api/competencies                       (alle ingelogde rollen) -> { profiel, competenties, totaalGewicht }
POST  /api/competencies                       (administratie) body: { code, naam, beschrijving?, gewichtPercentage, volgorde?, competentieProfielId? }
PATCH /api/competencies/:id                   (administratie) body: { naam?, beschrijving?, gewichtPercentage?, volgorde?, isActief? }
PATCH /api/competencies/profiles/:id/publish  (administratie) -> publiceren, enkel als totaalgewicht = 100%

## Evaluaties
POST /api/evaluations/open                     (administratie, docent) body: { stagedossierId, type: "tussentijds" | "finaal" }
GET  /api/evaluations/:studentId               (student=eigen, mentor/docent indien gekoppeld, administratie) -> { stagedossierId, competenties, evaluaties: [{ ..., scores: [] }] }
POST /api/evaluations/:evaluationId/scores     (student, mentor, docent) body: { scores: [{ competentieId, score, motivering?, feedback? }], ingediend?: bool }
POST /api/evaluations/:evaluationId/calculate  (docent, administratie) -> tussentijds: registreren | finaal: eindcijfer berekenen (gewogen gemiddelde uit gewicht_percentage)
POST /api/evaluations/:evaluationId/release    (docent, administratie) -> resultaat vrijgeven (student ziet het dan)
