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
GET  /api/contracts/my/pdf          (stageovereenkomst als pdf downloaden)
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
POST  /api/admin/dossiers/:id/eindoverzicht  -> enkel na vrijgave eindresultaat; maakt PDF-document aan en geeft bestandUrl terug
POST  /api/admin/dossiers/:id/reminder       -> herinnering naar partij die nog moet tekenen; registreert ook e-mailkanaal
GET   /api/admin/settings                    -> { stageRegels, documentSoorten }
PATCH /api/admin/stage-rules/:id             body: { stagevensterStart?, stagevensterEinde?, minimumWeken?, minimumUren?, standaardUrenPerWeek? }
POST  /api/admin/document-types              body: { naam, type?, isVerplicht?, opleiding?, academiejaar? }
PATCH /api/admin/document-types/:id          body: { naam?, isVerplicht? }
POST  /api/admin/invitations                 body: { voornaam, achternaam, email, bedrijfId | bedrijfNaam, functie? } -> { mentorId, activatielink, emailStatus }
PATCH /api/admin/documents/:id/approve
PATCH /api/admin/documents/:id/reject        body: { afkeurreden } (verplicht)

## Planning (alle ingelogde rollen)
GET /api/planning/my                         -> planningmomenten voor huidige rol/gebruiker

## Mentor
GET /api/mentor/students
GET /api/mentor/logbooks/:studentId
PATCH /api/mentor/logbooks/:weekId/check
GET /api/mentor/invitations/:token              (publiek, voor accountactivatie)
POST /api/mentor/activate                       body: { token, wachtwoord?, telefoon? }
GET /api/mentor/planning
PATCH /api/mentor/planning/:id/confirm
PATCH /api/mentor/planning/:id/alternative      body: { alternatief? | reden?, geplandOp? | datum? }

## Docent
GET /api/docent/students
GET /api/docent/students/:id/dossier            -> dossierdetail met documenten, contract, planning, logboeken, evaluaties
GET /api/docent/proposals                       -> read-only voorstellen van toegewezen studenten
GET /api/docent/proposals/:id                   -> voorstel met versies en commissiehistoriek
GET /api/docent/logbooks/missing              -> ontbrekende weken per gekoppelde student
POST /api/docent/logbooks/missing/:studentId/reminder body: { weken?: number[] } -> logboekherinnering + e-mailkanaal
GET /api/docent/logbooks/:studentId
PATCH /api/docent/logbooks/:weekId/review
GET /api/docent/planning
POST /api/docent/planning/visit                 body: { dossierId | stagedossierId, geplandOp | datum, locatie?, verslag? }
POST /api/docent/planning/presentation          body: { dossierId | stagedossierId, geplandOp | datum, locatie?, verslag? }
PATCH /api/docent/planning/:id                  body: { geplandOp?, datum?, locatie?, status?, verslag? }

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
POST /api/evaluations/:evaluationId/scores     (student, mentor, docent) body: { scores: [{ competentieId, score, motivering?, feedback? }], ingediend?: bool } -> status kan klaar_voor_docent worden
POST /api/evaluations/:evaluationId/calculate  (docent, administratie) -> competentieScore op /5; finaal eindcijfer op /20
POST /api/evaluations/:evaluationId/release    (docent, administratie) -> resultaat vrijgeven (student ziet het dan)

## Meldingen (alle ingelogde rollen)
GET  /api/notifications              -> { meldingen, ongelezen }
POST /api/notifications/:id/read
POST /api/notifications/read-all
