-- Aparte velden voor het mentor-alternatief, zodat het officiële moment (gepland_op/locatie) pas wijzigt
-- nadat de docent het alternatief accepteert (auditpunten 478/479/480). Eén keer uitvoeren.

ALTER TABLE `planning_momenten`
  ADD COLUMN `alternatief_gepland_op` DATETIME NULL AFTER `alternatief_voorstel`,
  ADD COLUMN `alternatief_locatie` VARCHAR(255) NULL AFTER `alternatief_gepland_op`;
