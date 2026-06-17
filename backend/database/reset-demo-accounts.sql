-- Heractiveert de demo-accounts.
-- Gebruik wanneer een demo-rol (bv. docent of mentor) plots "niet gevonden of niet actief"
-- geeft — meestal omdat de deactiveer-functie getest is zonder te heractiveren.
--
-- Draaien:
--   mysql -h <host> -u groep1 -p stageify < backend/database/reset-demo-accounts.sql
--   of plak de UPDATE in MySQL Workbench.

UPDATE gebruikers
SET status = 'actief', geblokkeerd_tot = NULL, login_fout_teller = 0, aangepast_op = NOW()
WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8);

-- Controle:
SELECT id, voornaam, hoofdrol, status FROM gebruikers ORDER BY id;
