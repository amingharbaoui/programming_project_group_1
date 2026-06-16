USE stageify;

-- Zorg dat de demo stage-regel bestaat (INSERT IGNORE = skip als al bestaat)
INSERT IGNORE INTO stage_regels
(id, opleiding, academiejaar, stagevenster_start, stagevenster_einde, minimum_weken, minimum_uren, standaard_uren_per_week, status, aangemaakt_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 'Toegepaste Informatica', '2025-2026', '2026-02-01', '2026-06-30', 12, 450, 38, 'actief', 3, NOW(), NOW());

-- Stagevoorstel voor Demo Student (id=1)
INSERT IGNORE INTO stagevoorstellen
(id, student_id, bedrijf_id, stage_regel_id, voorlopige_stagebegeleider_id, status, huidige_versie_nummer, ingediend_op, goedgekeurd_op, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 1, 1, 3, 'goedgekeurd', 1, NOW(), NOW(), NOW(), NOW());

-- Stagedossier gekoppeld aan mentor 5 + docent 3
INSERT IGNORE INTO stagedossiers
(id, dossiernummer, stagevoorstel_id, student_id, bedrijf_id, stagebegeleider_id, mentor_id, status, opleiding, academiejaar, startdatum, einddatum, aantal_weken, uren_per_week, totaal_uren, aangemaakt_op, aangepast_op)
VALUES
(1, 'D-2026-0001', 1, 1, 1, 3, 5, 'stage_loopt', 'Toegepaste Informatica', '2025-2026', '2026-02-09', '2026-06-27', 13, 38, 494, NOW(), NOW());

-- Planning momenten: bedrijfsbezoek te bevestigen + tussentijdse al bevestigd
INSERT IGNORE INTO planning_momenten
(id, stagedossier_id, type, status, gepland_op, locatie, voorgesteld_door_id, aangemaakt_op, aangepast_op)
VALUES
(1, 1, 'bedrijfsbezoek', 'voorgesteld', '2026-06-25 10:00:00', 'CodeLab Brussels — Nijverheidsstraat 10, 1000 Brussel', 3, NOW(), NOW()),
(2, 1, 'tussentijdse_bespreking', 'bevestigd', '2026-05-14 14:00:00', 'Online (Teams)', 3, NOW(), NOW());

SELECT 'Seed planning klaar!' AS resultaat;
