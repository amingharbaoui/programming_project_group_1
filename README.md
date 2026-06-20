# Stagify

A centralized internship management platform built for Erasmushogeschool Brussel.

![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white&labelColor=20232a)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## What is Stagify?

Stagify is a web application built as a group project for EHB. It supports the full internship process for students, from proposal to final evaluation.

The platform supports five roles: **student**, **stagecommissie**, **administratie**, **mentor** (company-side supervisor) and **docent** (teacher). Each role has its own interface and only sees what's relevant to them.

## What it does

**For students**, the platform handles the full journey: submitting a proposal, signing the internship agreement digitally, uploading required documents, writing weekly logbooks and self-evaluations, and tracking their progress.

**For the stagecommissie**, it provides the proposals to review: approve, request changes, or reject with motivation.

**For administratie**, it's the control center: a full overview of all dossiers, approving or rejecting documents, assigning teachers to students, inviting mentors, registering internship agreements, sending reminders, managing users and competency profiles, and generating end-of-internship reports.

**For mentors**, it provides access to their student's dossier, lets them sign the agreement on behalf of the company, share practical arrangements, check logbooks and give input on evaluations.

**For docenten**, it gives an overview of the students they supervise, with access to logbooks, planning, evaluations and competency tracking.

## Tech stack

| | |
|---|---|
| Frontend | React 19, Vite, React Router v7 |
| UI | Tabler Icons, custom CSS |
| HTTP | Axios |
| Backend | Node.js, Express 5 |
| Database | MySQL with mysql2 |
| File uploads | Multer |
| Email | Nodemailer |
| Version control | Git & GitHub |

## Project structure

```
programming_project_group_1/
├── frontend/
│   └── src/
│       ├── assets/
│       ├── components/        # Shared layout (Sidebar, Navbar, NotificationBell...)
│       ├── constants/
│       ├── context/
│       ├── features/          # admin, student, mentor, docent, committee, auth
│       └── services/          # Axios API layer
│
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── utils/             # PDF generation, notifications, responses, mail
│
├── database/
└── README.md
```

## Getting started

You'll need Node.js 18+, MySQL 8+, and npm.

```bash
git clone https://github.com/amingharbaoui/programming_project_group_1.git
cd programming_project_group_1
```

Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Environment variables

Create a `.env` file in `backend/` based on `backend/.env.example`:

```bash
cd backend
cp .env.example .env
```

Fill in the database settings and set your own `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Database

Load the demo data (users for every phase plus their internship data):

```bash
cd backend
node scripts/seed-demo.js
```

## Running

```bash
# Backend (port 5000)
cd backend
npm start

# Frontend (port 5173), in a second terminal
cd frontend
npm run dev
```

Open http://localhost:5173 and log in with an e-mail address and password.

## Demo accounts

The seed script creates accounts for every role. **Password for everyone: `Demo!2026`.**

| Role | E-mail |
|------|--------|
| Student (internship running) | student.loopt@ehb.be |
| Student (finished) | student.afgerond@ehb.be |
| Stagecommissie | commissie@ehb.be |
| Administratie | admin@ehb.be |
| Docent | docent@ehb.be |
| Mentor | mentor@bedrijf.be |

The student accounts are named after their phase (`student.geen`, `student.ingediend`,
`student.contract`, `student.startklaar`, …) so each step can be demonstrated.

## Authors

| | |
|---|---|
| Amin Gharbaoui | [@amingharbaoui](https://github.com/amingharbaoui) |
| David Vuy | [@davidvuy](https://github.com/davidvuy) |
| Mohamad Azhar | [@mohamad-azhar](https://github.com/mohamad-azhar) |
| Nathan Madimba | [@Ehbnathanmadimba](https://github.com/Ehbnathanmadimba) |

## License

Released under the MIT License.
