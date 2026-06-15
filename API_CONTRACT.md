# Stageify API Contract

## Auth
POST /api/auth/login
GET /api/auth/me

## Users (administratie)
GET   /api/users
PATCH /api/users/:id/deactivate
PATCH /api/users/:id/reactivate

## Student / Stagevoorstel
GET   /api/internships/my
POST  /api/internships               (indienen; upgrade bestaand concept -> ingediend)
POST  /api/internships/draft         (concept opslaan)
PATCH /api/internships/my/intrekken  (voorstel intrekken)

## Student / Contract & Documenten
GET  /api/contracts/my
POST /api/contracts/sign
GET  /api/documents/soorten
GET  /api/documents/my
POST /api/documents/upload           (multipart, multer)

## Stagecommissie
GET   /api/committee/applications
GET   /api/committee/applications/:id/versions   (alle versies — heringediend vergelijken)
PATCH /api/committee/applications/:id/decision   body: { beslissing: "goedgekeurd"|"afgekeurd"|"aanpassingen_gevraagd", feedback?, motivering?, uitzonderingMotivering? }

## Administratie (administratie)
GET   /api/admin/dossiers
GET   /api/admin/dossiers/:id
PATCH /api/admin/dossiers/:id/status
PATCH /api/admin/dossiers/:id/assign         body: { stagebegeleiderId?, mentorId? }
PATCH /api/admin/dossiers/:id/startklaar     -> checkt contract + verplichte docs, status -> active
POST  /api/admin/dossiers/:id/eindoverzicht  -> enkel na vrijgave eindresultaat
POST  /api/admin/dossiers/:id/reminder       -> herinnering naar partij die nog moet tekenen
GET   /api/admin/settings                    -> { stageRegels, documentSoorten }
PATCH /api/admin/stage-rules/:id             body: { stagevensterStart?, stagevensterEinde?, minimumWeken?, minimumUren?, standaardUrenPerWeek? }
PATCH /api/admin/document-types/:id          body: { naam?, isVerplicht? }
POST  /api/admin/invitations                 body: { voornaam, achternaam, email, bedrijfId | bedrijfNaam, functie? } -> { mentorId, activatielink }
PATCH /api/admin/documents/:id/approve
PATCH /api/admin/documents/:id/reject        body: { afkeurreden } (verplicht)

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
GET  /api/evaluations/my-students              (docent/mentor/administratie) -> studenten van de ingelogde docent/mentor (voor selector)
POST /api/evaluations/open                     (administratie, docent) body: { stagedossierId, type: "tussentijds" | "finaal" }
GET  /api/evaluations/:studentId               (student=eigen, mentor/docent indien gekoppeld, administratie) -> { stagedossierId, competenties, evaluaties: [{ ..., scores: [] }] }
POST /api/evaluations/:evaluationId/scores     (student, mentor, docent) body: { scores: [{ competentieId, score, motivering?, feedback? }], ingediend?: bool }
POST /api/evaluations/:evaluationId/calculate  (docent, administratie) -> tussentijds: registreren | finaal: eindcijfer berekenen (gewogen gemiddelde uit gewicht_percentage)
POST /api/evaluations/:evaluationId/release    (docent, administratie) -> resultaat vrijgeven (student ziet het dan)

## Meldingen (alle ingelogde rollen)
GET  /api/notifications              -> { meldingen, ongelezen }
POST /api/notifications/:id/read
POST /api/notifications/read-all
