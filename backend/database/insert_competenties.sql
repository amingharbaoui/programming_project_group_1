DELETE FROM competentie_scores WHERE competentie_id IN (1,2,3,4);
DELETE FROM competenties WHERE competentie_profiel_id = 1;

INSERT INTO competenties
(id, competentie_profiel_id, code, naam, beschrijving, gewicht_percentage, volgorde, is_actief, aangemaakt_op, aangepast_op)
VALUES
( 1, 1, 'LO1',  'Beheersing van het planningsproces',          'De student plant, bewaakt en stuurt het eigen werkproces binnen de stagecontext.',           9.00,  1, true, NOW(), NOW()),
( 2, 1, 'LO2',  'Ontwerpen van IT-oplossingen',                'De student analyseert requirements en ontwerpt passende IT-oplossingen.',                   10.00,  2, true, NOW(), NOW()),
( 3, 1, 'LO3',  'Implementatie van digitale producten',        'De student bouwt en test digitale producten volgens professionele standaarden.',            12.00,  3, true, NOW(), NOW()),
( 4, 1, 'LO4',  'Integratie van technologie en infrastructuur','De student integreert systemen, services en infrastructuur in een bedrijfsomgeving.',       10.00,  4, true, NOW(), NOW()),
( 5, 1, 'LO5',  'Onderzoekende houding',                       'De student verkent nieuwe technologieen en onderbouwt keuzes met bronnenonderzoek.',        9.00,  5, true, NOW(), NOW()),
( 6, 1, 'LO6',  'Helder en transparant communiceren',          'De student communiceert duidelijk en proactief met mentor, docent en teamleden.',           10.00,  6, true, NOW(), NOW()),
( 7, 1, 'LO7',  'Probleemoplossend vermogen',                  'De student analyseert problemen zelfstandig en werkt naar een onderbouwde oplossing.',      10.00,  7, true, NOW(), NOW()),
( 8, 1, 'LO8',  'Persoonlijke ontwikkeling',                   'De student reflecteert op eigen functioneren en stelt doelen bij.',                          9.00,  8, true, NOW(), NOW()),
( 9, 1, 'LO9',  'Professionele attitude',                      'De student gedraagt zich professioneel en respectvol binnen de bedrijfscontext.',           10.00,  9, true, NOW(), NOW()),
(10, 1, 'LO10', 'Ondernemend handelen',                        'De student toont initiatief, denkt oplossingsgericht en draagt actief bij aan het team.',    8.00, 10, true, NOW(), NOW()),
(11, 1, 'LO11', 'Ethisch en deontologisch handelen',           'De student handelt integer, respecteert privacy en volgt professionele gedragscodes.',       3.00, 11, true, NOW(), NOW());
