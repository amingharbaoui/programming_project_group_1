-- Per-dag competenties in het logboek (story 7).
-- Eén keer uitvoeren op een bestaande database (schema.sql bevat de tabel al voor een verse opzet).

CREATE TABLE IF NOT EXISTS `logboek_dag_competenties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `logboek_dag_id` int NOT NULL,
  `competentie_id` int NOT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logboek_dag_competenties_index_1` (`logboek_dag_id`,`competentie_id`),
  KEY `logboek_dag_competenties_comp` (`competentie_id`),
  CONSTRAINT `logboek_dag_competenties_ibfk_1` FOREIGN KEY (`logboek_dag_id`) REFERENCES `logboek_dagen` (`id`) ON DELETE CASCADE,
  CONSTRAINT `logboek_dag_competenties_ibfk_2` FOREIGN KEY (`competentie_id`) REFERENCES `competenties` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
