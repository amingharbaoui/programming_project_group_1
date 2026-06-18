-- Voeg competenties JSON kolom toe aan logboek_dagen
ALTER TABLE logboek_dagen
  ADD COLUMN competenties JSON DEFAULT NULL AFTER leerpunten;
