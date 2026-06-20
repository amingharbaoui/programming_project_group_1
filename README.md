# Stagify

Stagify ondersteunt het volledige stageproces van studenten binnen de EhB: van stagevoorstel,
goedkeuring en overeenkomst tot logboeken, evaluatie en eindresultaat.

## Rollen
- **Student** — dient een stagevoorstel in, tekent de overeenkomst, uploadt documenten, vult logboeken en zelfevaluatie in.
- **Stagecommissie** — beoordeelt voorstellen (goedkeuren, aanpassingen vragen, afkeuren).
- **Administratie** — volgt dossiers op, koppelt docenten, nodigt mentoren uit, controleert documenten en registreert de overeenkomst.
- **Mentor** — tekent de overeenkomst, deelt afspraken, checkt logboeken af, geeft mentorinput.
- **Docent** — kijkt logboeken na, plant bedrijfsbezoek en eindpresentatie, registreert en geeft het eindresultaat vrij.

## Stack
- **Backend:** Node + Express + mysql2 (`backend/`, poort 5000)
- **Frontend:** React + Vite (`frontend/`, poort 5173)
- **Database:** MySQL

## Installatie
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Configuratie (backend/.env)
Maak een `backend/.env` aan op basis van `backend/.env.example`:
```bash
cd backend
cp .env.example .env
```
Vul de databasegegevens in en zet een eigen `AUTH_SECRET`. Genereer er een met:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Commit `.env` nooit — die staat in `.gitignore`.

## Database vullen
De demo-data (gebruikers over alle fases + bijhorende stagegegevens) wordt geladen met:
```bash
cd backend
node scripts/seed-demo.js
```

## Starten
```bash
# Backend (poort 5000)
cd backend
npm start

# Frontend (poort 5173), in een tweede terminal
cd frontend
npm run dev
```
Open daarna http://localhost:5173 en log in met e-mailadres + wachtwoord.

## Demo-accounts
Het seed-script maakt voor elke rol accounts aan. **Wachtwoord voor iedereen: `Demo!2026`.**

| Rol | E-mail |
|-----|--------|
| Student (stage loopt) | student.loopt@ehb.be |
| Student (afgerond) | student.afgerond@ehb.be |
| Stagecommissie | commissie@ehb.be |
| Administratie | admin@ehb.be |
| Docent | docent@ehb.be |
| Mentor | mentor@bedrijf.be |

De studentaccounts zijn benoemd naar hun fase (`student.geen`, `student.ingediend`,
`student.contract`, `student.startklaar`, …) zodat elke stap demonstreerbaar is.

## Belangrijkste flows om te demonstreren
1. Student dient een stagevoorstel in → commissie keurt goed → stagedossier ontstaat.
2. Student en mentor tekenen de overeenkomst → administratie registreert ze.
3. Student uploadt documenten → administratie keurt ze goed → dossier startklaar.
4. Student vult logboeken in → mentor checkt af → docent kijkt na.
5. Tussentijdse en finale evaluatie → docent berekent en geeft het eindresultaat vrij.

## Authors
- [@amingharbaoui](https://www.github.com/amingharbaoui)
- [@david](https://www.github.com/davidvuy)
- [@mohamad](https://www.github.com/mohamad-azhar)
- [@nathan](https://www.github.com/Ehbnathanmadimba)
