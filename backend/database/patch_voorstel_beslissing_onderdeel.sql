-- Onderdeel bij commissiefeedback (story 13).
-- Eén keer uitvoeren op een bestaande database (schema.sql bevat de kolom al voor een verse opzet).

ALTER TABLE `voorstel_beslissingen`
  ADD COLUMN `onderdeel` varchar(255) DEFAULT NULL COMMENT 'Onderdeel van het voorstel waarop de aanpassing slaat' AFTER `feedback`;
