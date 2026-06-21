-- Voeg mentor_opmerking toe aan logboek_dagen zodat de mentor per dag een korte notitie/feedback kan geven.
-- Eén keer uitvoeren op een bestaande database.
ALTER TABLE `logboek_dagen`
  ADD COLUMN `mentor_opmerking` text NULL DEFAULT NULL AFTER `mentor_bevestigd_op`;
