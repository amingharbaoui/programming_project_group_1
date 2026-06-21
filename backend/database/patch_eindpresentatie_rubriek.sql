-- Flexibele rubriek voor de eindpresentatie (door admin beheerd) + scores per evaluatie.
-- Eén keer uitvoeren op een bestaande database.

CREATE TABLE IF NOT EXISTS `rubriek_criteria` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `titel` VARCHAR(255) NOT NULL,
  `beschrijving` TEXT NULL,
  `max_score` INT NOT NULL DEFAULT 5,
  `volgorde` INT NOT NULL DEFAULT 0,
  `actief` TINYINT NOT NULL DEFAULT 1,
  `aangemaakt_op` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `aangepast_op` DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `rubriek_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `evaluatie_id` INT NOT NULL,
  `rubriek_criterium_id` INT NOT NULL,
  `score` DECIMAL(4,2) NULL,
  `feedback` TEXT NULL,
  `beoordeeld_door_id` INT NULL,
  `aangemaakt_op` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `aangepast_op` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniek_eval_criterium` (`evaluatie_id`, `rubriek_criterium_id`),
  CONSTRAINT `fk_rs_eval` FOREIGN KEY (`evaluatie_id`) REFERENCES `evaluaties`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rs_crit` FOREIGN KEY (`rubriek_criterium_id`) REFERENCES `rubriek_criteria`(`id`) ON DELETE CASCADE
);

-- 5 standaard rubriek-criteria (admin kan aanpassen, deactiveren of toevoegen).
INSERT INTO `rubriek_criteria` (`titel`, `volgorde`) VALUES
  ('Inhoud en technische diepgang', 1),
  ('Structuur en opbouw', 2),
  ('Communicatie en presentatie', 3),
  ('Beantwoording van vragen', 4),
  ('Professionaliteit', 5);
