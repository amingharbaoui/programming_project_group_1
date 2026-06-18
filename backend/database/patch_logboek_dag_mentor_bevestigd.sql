-- Mentor kan een logboekdag bevestigen (story 31).
-- Eén keer uitvoeren op een bestaande database (schema.sql bevat de kolom al voor een verse opzet).

ALTER TABLE `logboek_dagen`
  ADD COLUMN `mentor_bevestigd_op` timestamp NULL DEFAULT NULL AFTER `aantal_uren`;
