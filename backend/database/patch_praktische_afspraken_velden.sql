-- Praktische afspraken als aparte velden (story 29).
-- Eén keer uitvoeren op een bestaande database (schema.sql bevat de kolom al voor een verse opzet).
-- De leesbare samenvatting blijft in `praktische_afspraken` staan (voor student/docent),
-- de losse velden komen in deze JSON-kolom.

ALTER TABLE `stagedossiers`
  ADD COLUMN `praktische_afspraken_velden` json DEFAULT NULL AFTER `praktische_afspraken`;
