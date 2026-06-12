USE stageify;

INSERT INTO gebruikers
(id, voornaam, achternaam, email, auth_provider, externe_auth_id, wachtwoord_hash, hoofdrol, status, laatste_login_op, login_fout_teller, geblokkeerd_tot, laatst_gesynchroniseerd_op, sync_bron, aangemaakt_op, aangepast_op)
VALUES
(1, 'Demo', 'Student', 'student@ehb.be', 'school_sso', 'ehb-student-0001', NULL, 'student', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(2, 'Demo', 'Commissie', 'commissie@ehb.be', 'school_sso', 'ehb-medewerker-0002', NULL, 'stagecommissie', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(3, 'Demo', 'Docent', 'docent@ehb.be', 'school_sso', 'ehb-medewerker-0003', NULL, 'docent', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(4, 'Demo', 'Admin', 'admin@ehb.be', 'school_sso', 'ehb-medewerker-0004', NULL, 'administratie', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(5, 'Demo', 'Mentor', 'mentor@bedrijf.be', 'local', NULL, 'dev-placeholder-not-real-auth', 'mentor', 'actief', NULL, 0, NULL, NULL, 'manueel', NOW(), NOW()),
(6, 'Demo', 'Student 2', 'student2@ehb.be', 'school_sso', 'ehb-student-0002', NULL, 'student', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(7, 'Demo', 'Student 3', 'student3@ehb.be', 'school_sso', 'ehb-student-0003', NULL, 'student', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW()),
(8, 'Demo', 'Student 4', 'student4@ehb.be', 'school_sso', 'ehb-student-0004', NULL, 'student', 'actief', NULL, 0, NULL, NOW(), 'import', NOW(), NOW());

INSERT INTO studenten
(gebruiker_id, studentennummer, opleiding, klasgroep, academiejaar)
VALUES
(1, 'S000001', 'Toegepaste Informatica', '1TI-Groep1', '2025-2026'),
(6, 'S000002', 'Toegepaste Informatica', '1TI-Groep1', '2025-2026'),
(7, 'S000003', 'Toegepaste Informatica', '1TI-Groep1', '2025-2026'),
(8, 'S000004', 'Toegepaste Informatica', '1TI-Groep1', '2025-2026');

INSERT INTO medewerkers
(gebruiker_id, personeelsnummer, medewerker_type, functie, dienst)
VALUES
(2, 'P000002', 'stagecommissie', 'Lid stagecommissie', 'Toegepaste Informatica'),
(3, 'P000003', 'docent', 'Stagebegeleider', 'Toegepaste Informatica'),
(4, 'P000004', 'administratie', 'Administratief medewerker', 'Stageadministratie');

INSERT INTO bedrijven
(id, naam, afdeling, adres, postcode, stad, land, email, telefoon, website, aangemaakt_op, aangepast_op)
VALUES
(1, 'CodeLab Brussels', 'Software Development', 'Nijverheidsstraat 10', '1000', 'Brussel', 'Belgie', 'info@codelab.local', '+3200000000', 'https://codelab.local', NOW(), NOW());

INSERT INTO mentoren
(gebruiker_id, bedrijf_id, functie, telefoon, mag_stageovereenkomst_tekenen, uitnodiging_status, uitnodiging_token, uitnodiging_vervalt_op, geactiveerd_op)
VALUES
(5, 1, 'Lead Developer', '+3200000001', true, 'geactiveerd', NULL, NULL, NOW());

INSERT INTO stage_regels
(id, opleiding, academiejaar, stagevenster_start, stagevenster_einde, minimum_weken, minimum_uren, standaard_uren_per_week, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 'Toegepaste Informatica', '2025-2026', '2026-02-01', '2026-06-30', 12, 450, 38, 'actief', 3, NOW(), NOW());

INSERT INTO competentie_profielen
(id, opleiding, academiejaar, naam, versie, status, aangemaakt_door_id, gepubliceerd_door_id, gepubliceerd_op, aangemaakt_op, aangepast_op)
VALUES
(1, 'Toegepaste Informatica', '2025-2026', 'Toegepaste Informatica stageprofiel', 'v1.0', 'actief', 3, 3, NOW(), NOW(), NOW());

INSERT INTO competenties
(id, competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 'C1', 'Professioneel handelen', 'De student werkt professioneel binnen een bedrijfscontext.', 25.00, 1, true, NOW(), NOW()),
(2, 1, 'C2', 'Technische uitvoering', 'De student voert technische taken correct en zelfstandig uit.', 35.00, 2, true, NOW(), NOW()),
(3, 1, 'C3', 'Communicatie', 'De student communiceert duidelijk met mentor, docent en team.', 20.00, 3, true, NOW(), NOW()),
(4, 1, 'C4', 'Reflectie en groei', 'De student reflecteert op leerpunten en evolutie.', 20.00, 4, true, NOW(), NOW());

INSERT INTO document_soorten
(id, naam, type, is_verplicht, is_vast, opleiding, academiejaar, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 'Stageovereenkomst', 'stageovereenkomst', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(2, 'Verzekeringsbewijs', 'verzekeringsbewijs', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(3, 'Stageplan', 'stageplan', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(4, 'Eindoverzicht', 'eindoverzicht', false, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW());
