-- Patch: checklist_items tabel voor configureerbare studentchecklist
-- Voer uit tegen de bestaande database

CREATE TABLE IF NOT EXISTS `checklist_items` (
  `id`            INT           NOT NULL AUTO_INCREMENT,
  `tekst`         VARCHAR(500)  NOT NULL,
  `volgorde`      INT           NOT NULL DEFAULT 0,
  `actief`        TINYINT(1)    NOT NULL DEFAULT 1,
  `aangemaakt_op` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `aangepast_op`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed: de 4 hardcoded checklist criteria
INSERT IGNORE INTO `checklist_items` (`id`, `tekst`, `volgorde`, `actief`) VALUES
(1, 'IT-gerelateerde opdracht met een ontwikkelcomponent',   1, 1),
(2, 'Mentor met een technische functie binnen het bedrijf',  2, 1),
(3, 'Concrete omschrijving: technologie, taken en team',     3, 1),
(4, 'Stage in een professionele bedrijfsomgeving',           4, 1);
