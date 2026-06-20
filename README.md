# Stageify

A centralized internship management platform built for Erasmushogeschool Brussel.

![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white&labelColor=20232a)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## What is Stageify?

Stageify is a web application we built as a group project for EHB. It was a school assignment focused on building a real, functional platform as a team.

The platform supports four roles: **student**, **teacher (docent)**, **company mentor**, and **admin (administratie)**. Each role has its own interface and only sees what's relevant to them.

## What it does

**For students**, the platform handles the full journey: submitting a proposal, signing the internship agreement digitally, uploading required documents, writing weekly logbooks, and tracking their progress. They also receive notifications whenever something changes in their dossier.

**For mentors** (the company-side supervisor), it provides access to the student's dossier, lets them sign the agreement on behalf of the company, and keeps them informed of key updates.

**For teachers**, it gives an overview of the students they supervise, with access to logbooks, evaluations, and competency tracking.

**For admins**, it's the control center: a full overview of all dossiers, the ability to approve or reject documents with feedback, assign teachers to students, register internship agreements, send reminders, manage users, and generate end-of-internship reports.

## Tech stack

| | |
|---|---|
| Frontend | React 19, Vite 8, React Router v7 |
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
│       ├── features/
│       │   ├── admin/
│       │   ├── student/
│       │   ├── mentor/
│       │   └── docent/
│       └── services/          # Axios API layer
│
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── utils/             # PDF generation, notifications, responses
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

Set up the database:

```bash
mysql -u root -p your_database < database/seed_planning.sql
```

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The API runs on `http://localhost:3000` and the frontend on `http://localhost:5173`.

A production `dist/` build will be added later, which bundles everything into a single deployable folder.

## Environment variables

Create a `.env` file in `backend/`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name

PORT=3000

MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your_email@example.com
MAIL_PASS=your_email_password
```

## Acknowledgements

- [readme.so](https://readme.so) for making README creation straightforward
- [Perplexity](https://www.perplexity.ai) for research and technical documentation lookups
- The teachers and staff at Erasmushogeschool Brussel for their guidance throughout the project
- [Claude](https://claude.ai) for development assistance and code support

## Authors

| | |
|---|---|
| Amin Gharbaoui | [@amingharbaoui](https://github.com/amingharbaoui) |
| David Vuy | [@davidvuy](https://github.com/davidvuy) |
| Mohamad Azhar | [@mohamad-azhar](https://github.com/mohamad-azhar) |
| Nathan Madimba | [@Ehbnathanmadimba](https://github.com/Ehbnathanmadimba) |


## License

Released under the MIT License.