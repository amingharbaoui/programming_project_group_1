-- Aparte velden voor het mentor-alternatief, zodat het officiële moment (gepland_op/locatie)
-- pas wijzigt nadat de docent het alternatief accepteert (auditpunten 478/479/480).
-- Idempotent: veilig opnieuw uit te voeren op een bestaande database.

SET @db_name = DATABASE();

SET @has_alt_gepland = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'planning_momenten'
    AND COLUMN_NAME = 'alternatief_gepland_op'
);
SET @sql = IF(
  @has_alt_gepland = 0,
  'ALTER TABLE `planning_momenten` ADD COLUMN `alternatief_gepland_op` DATETIME NULL AFTER `alternatief_voorstel`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_alt_locatie = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'planning_momenten'
    AND COLUMN_NAME = 'alternatief_locatie'
);
SET @sql = IF(
  @has_alt_locatie = 0,
  'ALTER TABLE `planning_momenten` ADD COLUMN `alternatief_locatie` VARCHAR(255) NULL AFTER `alternatief_gepland_op`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
