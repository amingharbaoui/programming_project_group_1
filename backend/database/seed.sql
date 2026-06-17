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
( 1, 1, 'LO1',  'Beheersing van het planningsproces',     'De student plant, bewaakt en stuurt het eigen werkproces binnen de stagecontext.',           9.00,  1, true, NOW(), NOW()),
( 2, 1, 'LO2',  'Ontwerpen van IT-oplossingen',           'De student analyseert requirements en ontwerpt passende IT-oplossingen.',                    10.00,  2, true, NOW(), NOW()),
( 3, 1, 'LO3',  'Implementatie van digitale producten',   'De student bouwt en test digitale producten volgens professionele standaarden.',             12.00,  3, true, NOW(), NOW()),
( 4, 1, 'LO4',  'Integratie van technologie en infrastructuur', 'De student integreert systemen, services en infrastructuur in een bedrijfsomgeving.',   10.00,  4, true, NOW(), NOW()),
( 5, 1, 'LO5',  'Onderzoekende houding',                  'De student verkent nieuwe technologieën en onderbouwt keuzes met bronnenonderzoek.',          9.00,  5, true, NOW(), NOW()),
( 6, 1, 'LO6',  'Helder en transparant communiceren',     'De student communiceert duidelijk en proactief met mentor, docent en teamleden.',            10.00,  6, true, NOW(), NOW()),
( 7, 1, 'LO7',  'Probleemoplossend vermogen',             'De student analyseert problemen zelfstandig en werkt naar een onderbouwde oplossing.',       10.00,  7, true, NOW(), NOW()),
( 8, 1, 'LO8',  'Persoonlijke ontwikkeling',              'De student reflecteert op eigen functioneren en stelt doelen bij.',                           9.00,  8, true, NOW(), NOW()),
( 9, 1, 'LO9',  'Professionele attitude',                 'De student gedraagt zich professioneel en respectvol binnen de bedrijfscontext.',            10.00,  9, true, NOW(), NOW()),
(10, 1, 'LO10', 'Ondernemend handelen',                   'De student toont initiatief, denkt oplossingsgericht en draagt actief bij aan het team.',     8.00, 10, true, NOW(), NOW()),
(11, 1, 'LO11', 'Ethisch en deontologisch handelen',      'De student handelt integer, respecteert privacy en volgt professionele gedragscodes.',        3.00, 11, true, NOW(), NOW());

INSERT INTO document_soorten
(id, naam, type, is_verplicht, is_vast, opleiding, academiejaar, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 'Stageovereenkomst', 'stageovereenkomst', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(2, 'Verzekeringsbewijs', 'verzekeringsbewijs', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(3, 'Stageplan', 'stageplan', true, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW()),
(4, 'Eindoverzicht', 'eindoverzicht', false, true, 'Toegepaste Informatica', '2025-2026', 'actief', 3, NOW(), NOW());

-- Demo stagevoorstel + stagedossier (student 1, mentor 5, docent 3, bedrijf 1)
INSERT INTO stagevoorstellen
(id, student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer, ingediend_op, goedgekeurd_op, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 1, 1, 3, 'goedgekeurd', 1, NOW(), NOW(), NOW(), NOW());

INSERT INTO stagevoorstel_versies
(stagevoorstel_id, versie_nummer, bedrijf_id, bedrijf_naam, bedrijfsafdeling, bedrijfsadres,
 mentor_naam, mentor_email, mentor_telefoon, mentor_functie, stagefunctie, opdrachtomschrijving,
 startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, ingediend_door_id, ingediend_op, aangemaakt_op)
VALUES
(1, 1, 1, 'CodeLab Brussels', 'Software Development', 'Nijverheidsstraat 10, 1000 Brussel',
 'Demo Mentor', 'mentor@bedrijf.be', '+3200000001', 'Lead Developer', 'Software Developer Stagiair',
 'De stagiair werkt mee aan de ontwikkeling en het testen van webapplicaties binnen het team en volgt de sprintwerking mee op.',
 '2026-02-09', '2026-06-27', 13, 38, 494, 1, NOW(), NOW());

INSERT INTO stagedossiers
(id, dossiernummer, stagevoorstel_id, student_id, bedrijf_id, stagebegeleider_id, mentor_id, status, opleiding, academiejaar, startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, aangemaakt_op, aangepast_op)
VALUES
(1, 'D-2026-0001', 1, 1, 1, 3, 5, 'stage_loopt', 'Toegepaste Informatica', '2025-2026', '2026-02-09', '2026-06-27', 13, 38, 494, NOW(), NOW());

-- Demo planning_momenten: bedrijfsbezoek te bevestigen door mentor
INSERT INTO planning_momenten
(stagedossier_id, type, status, gepland_op, locatie, voorgesteld_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 'bedrijfsbezoek', 'voorgesteld', '2026-06-25 10:00:00', 'CodeLab Brussels — Nijverheidsstraat 10, 1000 Brussel', 3, NOW(), NOW()),
(1, 'tussentijdse_bespreking', 'bevestigd', '2026-05-14 14:00:00', 'Online (Teams)', 3, NOW(), NOW());

-- Goedkeuringsbeslissing van de commissie voor het voorstel.
INSERT INTO voorstel_beslissingen
(stagevoorstel_id, stagevoorstel_versie_id, beslist_door_id, beslissing, feedback, motivering, beslist_op)
VALUES
(1, 1, 2, 'goedgekeurd', NULL, 'Sterk voorstel — voldoet aan alle criteria.', NOW());

-- Stageovereenkomst: volledig ondertekend en geregistreerd door de administratie.
INSERT INTO stageovereenkomsten
(id, stagedossier_id, status, versie_nummer, bestand_url, student_getekend_op, bedrijf_getekend_op, opleiding_getekend_op, gecontroleerd_door_id, gecontroleerd_op, geregistreerd_door_id, geregistreerd_op, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 'geregistreerd', 1, '/uploads/demo-overeenkomst.pdf', '2026-02-06 10:00:00', '2026-02-07 09:00:00', '2026-02-10 11:00:00', 4, '2026-02-10 11:00:00', 4, '2026-02-10 11:00:00', NOW(), NOW());

UPDATE stagedossiers SET verzekering_in_orde = 1 WHERE id = 1;

-- Documenten: overeenkomst geregistreerd, stageplan goedgekeurd, verzekeringsbewijs nog te controleren (admin-actie).
INSERT INTO documenten
(stagedossier_id, document_soort_id, status, versie_nummer, bestand_url, bestand_naam, opgeladen_door_id, opgeladen_op, gecontroleerd_door_id, gecontroleerd_op, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 'geregistreerd', 1, '/uploads/demo-overeenkomst.pdf', 'stageovereenkomst.pdf', 1, '2026-02-06 10:00:00', 4, '2026-02-10 11:00:00', NOW(), NOW()),
(1, 3, 'goedgekeurd',   1, '/uploads/demo-stageplan.pdf',    'stageplan.pdf',         1, '2026-02-12 09:30:00', 4, '2026-02-13 10:00:00', NOW(), NOW()),
(1, 2, 'ingediend',     1, '/uploads/demo-verzekering.pdf',  'verzekeringsbewijs.pdf', 1, '2026-02-12 09:00:00', NULL, NULL, NOW(), NOW());

-- Evaluatiemomenten: tussentijds staat open (student/mentor/docent kunnen invullen), finaal nog niet open.
INSERT INTO evaluaties
(id, stagedossier_id, type, status, deadline_student, deadline_mentor, deadline_docent, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 'tussentijds', 'open',      '2026-05-08', '2026-05-11', '2026-05-15', NOW(), NOW()),
(2, 1, 'finaal',      'niet_open', '2026-06-19', '2026-06-21', '2026-06-26', NOW(), NOW());

-- Logboek: week 1 volledig nagekeken, week 2 ingediend (mentor moet afchecken).
INSERT INTO logboek_weken
(id, stagedossier_id, week_nummer, week_start, week_einde, status, totaal_uren, ingediend_op, mentor_id, mentor_feedback, mentor_nagekeken_op, docent_id, docent_feedback, docent_nagekeken_op, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 1, '2026-02-09', '2026-02-13', 'goedgekeurd_door_docent', 38.0, '2026-02-13 17:00:00', 5, 'Goede eerste week, mooi op dreef.', '2026-02-16 09:00:00', 3, 'Prima logboek.', '2026-02-17 10:00:00', NOW(), NOW()),
(2, 1, 2, '2026-02-16', '2026-02-20', 'ingediend',                38.0, '2026-02-20 17:00:00', 5, NULL, NULL, 3, NULL, NULL, NOW(), NOW());

INSERT INTO logboek_dagen
(logboek_week_id, datum, status, titel, uitgevoerde_taken, reflectie, aantal_uren, aangemaakt_op, aangepast_op)
VALUES
(1, '2026-02-09', 'ingevuld', 'Onboarding',  'Kennismaking team, dev-omgeving opgezet.', 'Veel nieuwe tools, maar goed begeleid.', 7.6, NOW(), NOW()),
(1, '2026-02-10', 'ingevuld', 'Eerste taak', 'Bug gefixt in de loginflow.',              'Codebase wordt duidelijker.',           7.6, NOW(), NOW()),
(1, '2026-02-11', 'ingevuld', 'Code review', 'Mee in een code review gezeten.',          'Geleerd hoe het team kwaliteit bewaakt.', 7.6, NOW(), NOW()),
(1, '2026-02-12', 'ingevuld', 'Feature',     'Kleine UI-aanpassing gebouwd.',            'Trots op eerste merge.',                7.6, NOW(), NOW()),
(1, '2026-02-13', 'ingevuld', 'Retro',       'Sprint-retro bijgewoond.',                 'Begrijp de sprintwerking nu beter.',    7.6, NOW(), NOW()),
(2, '2026-02-16', 'ingevuld', 'API-werk',    'Endpoint uitgebreid met validatie.',       'Backend wordt vertrouwder.',            7.6, NOW(), NOW()),
(2, '2026-02-17', 'ingevuld', 'Tests',       'Unit tests geschreven.',                   'Testen vangt fouten vroeg.',            7.6, NOW(), NOW()),
(2, '2026-02-18', 'ingevuld', 'Bugfix',      'Edge case opgelost.',                      'Debuggen gaat vlotter.',                7.6, NOW(), NOW()),
(2, '2026-02-19', 'ingevuld', 'Docs',        'Documentatie aangevuld.',                  'Schrijven dwingt tot helder denken.',   7.6, NOW(), NOW()),
(2, '2026-02-20', 'ingevuld', 'Demo',        'Feature gedemod aan het team.',            'Spannend maar leerrijk.',               7.6, NOW(), NOW());
