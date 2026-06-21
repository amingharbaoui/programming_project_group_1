-- Voeg student_reactie toe aan logboek_dagen zodat de student kan reageren op de mentor-opmerking per dag.
-- Eén keer uitvoeren op een bestaande database.
ALTER TABLE `logboek_dagen`
  ADD COLUMN `student_reactie` text NULL DEFAULT NULL AFTER `mentor_opmerking`;
