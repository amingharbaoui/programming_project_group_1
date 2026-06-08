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
GET /api/competencies
POST /api/competencies
PATCH /api/competencies/:id

## Evaluaties
GET /api/evaluations/:studentId
POST /api/evaluations
PATCH /api/evaluations/:id
