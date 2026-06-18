-- Auto-exported schema from database: stageify
-- No passwords or private credentials in this file.

CREATE DATABASE IF NOT EXISTS `stageify` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stageify`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `bedrijven`;
CREATE TABLE `bedrijven` (
  `id` int NOT NULL AUTO_INCREMENT,
  `naam` varchar(255) NOT NULL,
  `afdeling` varchar(255) DEFAULT NULL,
  `adres` text,
  `postcode` varchar(255) DEFAULT NULL,
  `stad` varchar(255) DEFAULT NULL,
  `land` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `telefoon` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `competentie_profielen`;
CREATE TABLE `competentie_profielen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opleiding` varchar(255) NOT NULL,
  `academiejaar` varchar(255) NOT NULL,
  `naam` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld Toegepaste Informatica 2025-2026',
  `versie` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld v1.0',
  `status` varchar(255) NOT NULL COMMENT 'concept, actief, gearchiveerd',
  `aangemaakt_door_id` int DEFAULT NULL,
  `gepubliceerd_door_id` int DEFAULT NULL,
  `gepubliceerd_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `competentie_profielen_index_4` (`opleiding`,`academiejaar`,`versie`),
  KEY `aangemaakt_door_id` (`aangemaakt_door_id`),
  KEY `gepubliceerd_door_id` (`gepubliceerd_door_id`),
  CONSTRAINT `competentie_profielen_ibfk_1` FOREIGN KEY (`aangemaakt_door_id`) REFERENCES `medewerkers` (`gebruiker_id`),
  CONSTRAINT `competentie_profielen_ibfk_2` FOREIGN KEY (`gepubliceerd_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `competentie_scores`;
CREATE TABLE `competentie_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `evaluatie_id` int NOT NULL,
  `competentie_id` int NOT NULL,
  `ingevuld_door_id` int NOT NULL,
  `rol` varchar(255) NOT NULL COMMENT 'student, mentor, docent',
  `score` decimal(3,1) DEFAULT NULL,
  `motivering` text,
  `feedback` text,
  `ingediend` tinyint(1) DEFAULT '0',
  `ingediend_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `competentie_scores_index_7` (`evaluatie_id`,`competentie_id`,`ingevuld_door_id`,`rol`),
  KEY `competentie_id` (`competentie_id`),
  KEY `ingevuld_door_id` (`ingevuld_door_id`),
  CONSTRAINT `competentie_scores_ibfk_1` FOREIGN KEY (`evaluatie_id`) REFERENCES `evaluaties` (`id`),
  CONSTRAINT `competentie_scores_ibfk_2` FOREIGN KEY (`competentie_id`) REFERENCES `competenties` (`id`),
  CONSTRAINT `competentie_scores_ibfk_3` FOREIGN KEY (`ingevuld_door_id`) REFERENCES `gebruikers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `competenties`;
CREATE TABLE `competenties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `competentie_profiel_id` int NOT NULL,
  `code` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld LO1',
  `naam` varchar(255) NOT NULL,
  `beschrijving` text,
  `gewicht_percentage` decimal(5,2) NOT NULL,
  `volgorde` int DEFAULT NULL,
  `is_actief` tinyint(1) DEFAULT '1',
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `competenties_index_5` (`competentie_profiel_id`,`code`),
  CONSTRAINT `competenties_ibfk_1` FOREIGN KEY (`competentie_profiel_id`) REFERENCES `competentie_profielen` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `document_soorten`;
CREATE TABLE `document_soorten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `naam` varchar(255) NOT NULL COMMENT 'Stageovereenkomst, verzekeringsbewijs, stageplan, eindoverzicht',
  `type` varchar(255) NOT NULL COMMENT 'stageovereenkomst, verzekeringsbewijs, stageplan, tussentijds_verslag, eindoverzicht, attest, ander',
  `is_verplicht` tinyint(1) DEFAULT '1',
  `is_vast` tinyint(1) DEFAULT '0',
  `opleiding` varchar(255) DEFAULT NULL,
  `academiejaar` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL COMMENT 'concept, actief, gearchiveerd',
  `aangemaakt_door_id` int DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `aangemaakt_door_id` (`aangemaakt_door_id`),
  CONSTRAINT `document_soorten_ibfk_1` FOREIGN KEY (`aangemaakt_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `documenten`;
CREATE TABLE `documenten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagedossier_id` int NOT NULL,
  `document_soort_id` int DEFAULT NULL,
  `status` varchar(255) NOT NULL COMMENT 'ontbreekt, ingediend, in_controle, afgekeurd, goedgekeurd, geregistreerd',
  `versie_nummer` int DEFAULT '1',
  `bestand_url` text,
  `bestand_naam` varchar(255) DEFAULT NULL,
  `opgeladen_door_id` int DEFAULT NULL,
  `opgeladen_op` timestamp NULL DEFAULT NULL,
  `gecontroleerd_door_id` int DEFAULT NULL,
  `gecontroleerd_op` timestamp NULL DEFAULT NULL,
  `afkeurreden` text,
  `zichtbaar_voor_student` tinyint(1) DEFAULT '1',
  `zichtbaar_voor_docent` tinyint(1) DEFAULT '1',
  `zichtbaar_voor_mentor` tinyint(1) DEFAULT '0',
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `documenten_index_1` (`stagedossier_id`,`document_soort_id`),
  KEY `document_soort_id` (`document_soort_id`),
  KEY `opgeladen_door_id` (`opgeladen_door_id`),
  KEY `gecontroleerd_door_id` (`gecontroleerd_door_id`),
  CONSTRAINT `documenten_ibfk_1` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `documenten_ibfk_2` FOREIGN KEY (`document_soort_id`) REFERENCES `document_soorten` (`id`),
  CONSTRAINT `documenten_ibfk_3` FOREIGN KEY (`opgeladen_door_id`) REFERENCES `gebruikers` (`id`),
  CONSTRAINT `documenten_ibfk_4` FOREIGN KEY (`gecontroleerd_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `evaluaties`;
CREATE TABLE `evaluaties` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagedossier_id` int NOT NULL,
  `type` varchar(255) NOT NULL COMMENT 'tussentijds, finaal',
  `status` varchar(255) NOT NULL COMMENT 'niet_open, open, student_ingediend, mentor_ingediend, klaar_voor_docent, geregistreerd, klaar_voor_vrijgave, vrijgegeven',
  `deadline_student` date DEFAULT NULL,
  `deadline_mentor` date DEFAULT NULL,
  `deadline_docent` date DEFAULT NULL,
  `student_ingediend_op` timestamp NULL DEFAULT NULL,
  `mentor_ingediend_op` timestamp NULL DEFAULT NULL,
  `docent_geregistreerd_op` timestamp NULL DEFAULT NULL,
  `verslag` text COMMENT 'Bijvoorbeeld verslag tussentijdse bespreking',
  `eindpresentatie_score` decimal(4,2) DEFAULT NULL,
  `competentie_score` decimal(4,2) DEFAULT NULL,
  `eindcijfer` decimal(4,2) DEFAULT NULL,
  `vrijgegeven_door_id` int DEFAULT NULL,
  `vrijgegeven_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `evaluaties_index_6` (`stagedossier_id`,`type`),
  KEY `vrijgegeven_door_id` (`vrijgegeven_door_id`),
  CONSTRAINT `evaluaties_ibfk_1` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `evaluaties_ibfk_2` FOREIGN KEY (`vrijgegeven_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `gebruikers`;
CREATE TABLE `gebruikers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `voornaam` varchar(255) NOT NULL COMMENT 'Lokale cache uit schooldata of ingevuld bij externe mentor',
  `achternaam` varchar(255) NOT NULL COMMENT 'Lokale cache uit schooldata of ingevuld bij externe mentor',
  `email` varchar(255) NOT NULL COMMENT 'Schoolmail of extern mentor-emailadres',
  `auth_provider` varchar(255) NOT NULL DEFAULT 'school_sso' COMMENT 'school_sso voor studenten/medewerkers, local voor externe mentoren',
  `externe_auth_id` varchar(255) DEFAULT NULL COMMENT 'Unieke gebruikers-id uit schoolauth/SSO; NULL voor local/externe mentoraccounts',
  `wachtwoord_hash` varchar(255) DEFAULT NULL COMMENT 'NULL bij school_sso; enkel gevuld voor local/externe mentoraccounts of fallback',
  `hoofdrol` varchar(255) NOT NULL COMMENT 'student, docent, mentor, stagecommissie, administratie',
  `status` varchar(255) NOT NULL COMMENT 'uitgenodigd, actief, geblokkeerd, inactief',
  `laatste_login_op` timestamp NULL DEFAULT NULL,
  `login_fout_teller` int DEFAULT '0',
  `geblokkeerd_tot` timestamp NULL DEFAULT NULL,
  `laatst_gesynchroniseerd_op` timestamp NULL DEFAULT NULL COMMENT 'Laatste moment waarop naam/email/rol uit schooldata werd gesynchroniseerd',
  `sync_bron` varchar(255) DEFAULT NULL COMMENT 'school_api, sso, import, manueel',
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `gebruikers_externe_auth_index` (`auth_provider`,`externe_auth_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `logboek_dagen`;
CREATE TABLE `logboek_dagen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `logboek_week_id` int NOT NULL,
  `datum` date NOT NULL,
  `status` varchar(255) NOT NULL COMMENT 'concept, ingevuld, geen_stagedag, afwezig',
  `titel` varchar(255) DEFAULT NULL,
  `uitgevoerde_taken` text,
  `reflectie` text,
  `problemen` text,
  `leerpunten` text,
  `aantal_uren` decimal(4,2) DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logboek_dagen_index_3` (`logboek_week_id`,`datum`),
  CONSTRAINT `logboek_dagen_ibfk_1` FOREIGN KEY (`logboek_week_id`) REFERENCES `logboek_weken` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `logboek_dag_competenties`;
CREATE TABLE `logboek_dag_competenties` (
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

DROP TABLE IF EXISTS `logboek_weken`;
CREATE TABLE `logboek_weken` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagedossier_id` int NOT NULL,
  `week_nummer` int NOT NULL,
  `week_start` date NOT NULL,
  `week_einde` date NOT NULL,
  `status` varchar(255) NOT NULL COMMENT 'niet_gestart, in_opbouw, ingediend, ontbreekt, afgecheckt_door_mentor, teruggestuurd_door_mentor, klaar_voor_docent, teruggestuurd_door_docent, goedgekeurd_door_docent, afgesloten',
  `totaal_uren` decimal(5,2) DEFAULT NULL,
  `ingediend_op` timestamp NULL DEFAULT NULL,
  `mentor_id` int DEFAULT NULL,
  `mentor_feedback` text,
  `mentor_nagekeken_op` timestamp NULL DEFAULT NULL,
  `docent_id` int DEFAULT NULL,
  `docent_feedback` text,
  `docent_nagekeken_op` timestamp NULL DEFAULT NULL,
  `student_antwoord` text,
  `herindiening_nodig` tinyint(1) DEFAULT '0',
  `blokkade` text COMMENT 'Bijvoorbeeld week 11 ontbreekt',
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `logboek_weken_index_2` (`stagedossier_id`,`week_nummer`),
  KEY `mentor_id` (`mentor_id`),
  KEY `docent_id` (`docent_id`),
  CONSTRAINT `logboek_weken_ibfk_1` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `logboek_weken_ibfk_2` FOREIGN KEY (`mentor_id`) REFERENCES `mentoren` (`gebruiker_id`),
  CONSTRAINT `logboek_weken_ibfk_3` FOREIGN KEY (`docent_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `medewerkers`;
CREATE TABLE `medewerkers` (
  `gebruiker_id` int NOT NULL,
  `personeelsnummer` varchar(255) DEFAULT NULL,
  `medewerker_type` varchar(255) NOT NULL COMMENT 'docent, stagecommissie, administratie',
  `functie` varchar(255) DEFAULT NULL,
  `dienst` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`gebruiker_id`),
  CONSTRAINT `medewerkers_ibfk_1` FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `mentoren`;
CREATE TABLE `mentoren` (
  `gebruiker_id` int NOT NULL,
  `bedrijf_id` int NOT NULL,
  `functie` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld Lead Developer',
  `telefoon` varchar(255) DEFAULT NULL,
  `mag_stageovereenkomst_tekenen` tinyint(1) DEFAULT '0',
  `uitnodiging_status` varchar(255) DEFAULT NULL COMMENT 'niet_verstuurd, verstuurd, geactiveerd, verlopen',
  `uitnodiging_token` varchar(255) DEFAULT NULL,
  `uitnodiging_vervalt_op` timestamp NULL DEFAULT NULL,
  `geactiveerd_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`gebruiker_id`),
  KEY `bedrijf_id` (`bedrijf_id`),
  CONSTRAINT `mentoren_ibfk_1` FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers` (`id`),
  CONSTRAINT `mentoren_ibfk_2` FOREIGN KEY (`bedrijf_id`) REFERENCES `bedrijven` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `planning_momenten`;
CREATE TABLE `planning_momenten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagedossier_id` int NOT NULL,
  `type` varchar(255) NOT NULL COMMENT 'bedrijfsbezoek, tussentijdse_bespreking, eindpresentatie',
  `status` varchar(255) NOT NULL COMMENT 'voorgesteld, bevestigd, alternatief_gevraagd, gepland, gegeven, geannuleerd',
  `gepland_op` timestamp NULL DEFAULT NULL,
  `locatie` varchar(255) DEFAULT NULL,
  `voorgesteld_door_id` int DEFAULT NULL,
  `bevestigd_door_id` int DEFAULT NULL,
  `alternatief_voorstel` text,
  `verslag` text,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stagedossier_id` (`stagedossier_id`),
  KEY `voorgesteld_door_id` (`voorgesteld_door_id`),
  KEY `bevestigd_door_id` (`bevestigd_door_id`),
  CONSTRAINT `planning_momenten_ibfk_1` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `planning_momenten_ibfk_2` FOREIGN KEY (`voorgesteld_door_id`) REFERENCES `gebruikers` (`id`),
  CONSTRAINT `planning_momenten_ibfk_3` FOREIGN KEY (`bevestigd_door_id`) REFERENCES `gebruikers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `stage_regels`;
CREATE TABLE `stage_regels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opleiding` varchar(255) NOT NULL,
  `academiejaar` varchar(255) NOT NULL,
  `stagevenster_start` date NOT NULL,
  `stagevenster_einde` date NOT NULL,
  `minimum_weken` int NOT NULL,
  `minimum_uren` int NOT NULL,
  `standaard_uren_per_week` int DEFAULT NULL,
  `status` varchar(255) NOT NULL COMMENT 'concept, actief, gearchiveerd',
  `aangemaakt_door_id` int DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `aangemaakt_door_id` (`aangemaakt_door_id`),
  CONSTRAINT `stage_regels_ibfk_1` FOREIGN KEY (`aangemaakt_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `stagedossiers`;
CREATE TABLE `stagedossiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dossiernummer` varchar(255) NOT NULL,
  `stagevoorstel_id` int NOT NULL,
  `student_id` int NOT NULL,
  `bedrijf_id` int NOT NULL,
  `stagebegeleider_id` int NOT NULL COMMENT 'EhB-docent',
  `mentor_id` int DEFAULT NULL,
  `status` varchar(255) NOT NULL COMMENT 'wacht_op_student, wacht_op_bedrijf, in_controle_bij_administratie, document_afgekeurd, geregistreerd, stage_loopt, resultaat_vrijgegeven, afgerond',
  `opleiding` varchar(255) NOT NULL,
  `academiejaar` varchar(255) NOT NULL,
  `startdatum` date NOT NULL,
  `einddatum` date NOT NULL,
  `aantal_weken` int NOT NULL,
  `uren_per_week` int NOT NULL,
  `totaal_uren` int NOT NULL,
  `verzekering_in_orde` tinyint(1) DEFAULT '0',
  `praktische_afspraken` text,
  `praktische_afspraken_gedeeld_op` timestamp NULL DEFAULT NULL,
  `eindresultaat` decimal(4,2) DEFAULT NULL,
  `eindresultaat_vrijgegeven_op` timestamp NULL DEFAULT NULL,
  `eindoverzicht_gegenereerd_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dossiernummer` (`dossiernummer`),
  UNIQUE KEY `stagevoorstel_id` (`stagevoorstel_id`),
  KEY `student_id` (`student_id`),
  KEY `bedrijf_id` (`bedrijf_id`),
  KEY `stagebegeleider_id` (`stagebegeleider_id`),
  KEY `mentor_id` (`mentor_id`),
  CONSTRAINT `stagedossiers_ibfk_1` FOREIGN KEY (`stagevoorstel_id`) REFERENCES `stagevoorstellen` (`id`),
  CONSTRAINT `stagedossiers_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `studenten` (`gebruiker_id`),
  CONSTRAINT `stagedossiers_ibfk_3` FOREIGN KEY (`bedrijf_id`) REFERENCES `bedrijven` (`id`),
  CONSTRAINT `stagedossiers_ibfk_4` FOREIGN KEY (`stagebegeleider_id`) REFERENCES `medewerkers` (`gebruiker_id`),
  CONSTRAINT `stagedossiers_ibfk_5` FOREIGN KEY (`mentor_id`) REFERENCES `mentoren` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `stageovereenkomsten`;
CREATE TABLE `stageovereenkomsten` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagedossier_id` int NOT NULL,
  `status` varchar(255) NOT NULL COMMENT 'klaar_voor_student, getekend_door_student, wacht_op_bedrijf, volledig_ondertekend, in_controle_bij_administratie, afgekeurd, geregistreerd',
  `bestand_url` text,
  `versie_nummer` int DEFAULT '1',
  `student_getekend_op` timestamp NULL DEFAULT NULL,
  `bedrijf_getekend_op` timestamp NULL DEFAULT NULL,
  `opleiding_getekend_op` timestamp NULL DEFAULT NULL,
  `gecontroleerd_door_id` int DEFAULT NULL,
  `gecontroleerd_op` timestamp NULL DEFAULT NULL,
  `geregistreerd_door_id` int DEFAULT NULL,
  `geregistreerd_op` timestamp NULL DEFAULT NULL,
  `afkeurreden` text,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stagedossier_id` (`stagedossier_id`),
  KEY `gecontroleerd_door_id` (`gecontroleerd_door_id`),
  KEY `geregistreerd_door_id` (`geregistreerd_door_id`),
  CONSTRAINT `stageovereenkomsten_ibfk_1` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `stageovereenkomsten_ibfk_2` FOREIGN KEY (`gecontroleerd_door_id`) REFERENCES `medewerkers` (`gebruiker_id`),
  CONSTRAINT `stageovereenkomsten_ibfk_3` FOREIGN KEY (`geregistreerd_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `stagevoorstel_versies`;
CREATE TABLE `stagevoorstel_versies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagevoorstel_id` int NOT NULL,
  `versie_nummer` int NOT NULL,
  `bedrijf_id` int DEFAULT NULL,
  `bedrijf_naam` varchar(255) DEFAULT NULL,
  `bedrijfsafdeling` varchar(255) DEFAULT NULL,
  `bedrijfsadres` text,
  `mentor_naam` varchar(255) NOT NULL,
  `mentor_email` varchar(255) NOT NULL,
  `mentor_telefoon` varchar(255) DEFAULT NULL,
  `mentor_functie` varchar(255) DEFAULT NULL,
  `stagefunctie` varchar(255) NOT NULL,
  `opdrachtomschrijving` text NOT NULL,
  `startdatum` date NOT NULL,
  `einddatum` date NOT NULL,
  `aantal_weken` int NOT NULL,
  `uren_per_week` int NOT NULL,
  `totaal_uren` int NOT NULL,
  `ingediend_door_id` int NOT NULL,
  `ingediend_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stagevoorstel_versies_index_0` (`stagevoorstel_id`,`versie_nummer`),
  KEY `bedrijf_id` (`bedrijf_id`),
  KEY `ingediend_door_id` (`ingediend_door_id`),
  CONSTRAINT `stagevoorstel_versies_ibfk_1` FOREIGN KEY (`stagevoorstel_id`) REFERENCES `stagevoorstellen` (`id`),
  CONSTRAINT `stagevoorstel_versies_ibfk_2` FOREIGN KEY (`bedrijf_id`) REFERENCES `bedrijven` (`id`),
  CONSTRAINT `stagevoorstel_versies_ibfk_3` FOREIGN KEY (`ingediend_door_id`) REFERENCES `gebruikers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `stagevoorstellen`;
CREATE TABLE `stagevoorstellen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `bedrijf_id` int DEFAULT NULL,
  `stage_regel_id` int NOT NULL,
  `voorlopige_stagebegeleider_id` int DEFAULT NULL,
  `status` varchar(255) NOT NULL COMMENT 'concept, ingediend, aanpassingen_gevraagd, heringediend, goedgekeurd, afgekeurd, ingetrokken',
  `huidige_versie_nummer` int DEFAULT '1',
  `ingediend_op` timestamp NULL DEFAULT NULL,
  `heringediend_op` timestamp NULL DEFAULT NULL,
  `goedgekeurd_op` timestamp NULL DEFAULT NULL,
  `afgekeurd_op` timestamp NULL DEFAULT NULL,
  `ingetrokken_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  `aangepast_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `bedrijf_id` (`bedrijf_id`),
  KEY `stage_regel_id` (`stage_regel_id`),
  KEY `voorlopige_stagebegeleider_id` (`voorlopige_stagebegeleider_id`),
  CONSTRAINT `stagevoorstellen_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `studenten` (`gebruiker_id`),
  CONSTRAINT `stagevoorstellen_ibfk_2` FOREIGN KEY (`bedrijf_id`) REFERENCES `bedrijven` (`id`),
  CONSTRAINT `stagevoorstellen_ibfk_3` FOREIGN KEY (`stage_regel_id`) REFERENCES `stage_regels` (`id`),
  CONSTRAINT `stagevoorstellen_ibfk_4` FOREIGN KEY (`voorlopige_stagebegeleider_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `studenten`;
CREATE TABLE `studenten` (
  `gebruiker_id` int NOT NULL,
  `studentennummer` varchar(255) NOT NULL,
  `opleiding` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld Toegepaste Informatica',
  `klasgroep` varchar(255) DEFAULT NULL,
  `academiejaar` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld 2025-2026',
  PRIMARY KEY (`gebruiker_id`),
  UNIQUE KEY `studentennummer` (`studentennummer`),
  CONSTRAINT `studenten_ibfk_1` FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `systeem_meldingen`;
CREATE TABLE `systeem_meldingen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ontvanger_id` int DEFAULT NULL,
  `aangemaakt_door_id` int DEFAULT NULL,
  `stagevoorstel_id` int DEFAULT NULL,
  `stagedossier_id` int DEFAULT NULL,
  `document_id` int DEFAULT NULL,
  `logboek_week_id` int DEFAULT NULL,
  `type` varchar(255) NOT NULL COMMENT 'notificatie, login_fout, upload_fout, uitnodiging_fout, permissie_fout, workflow_blokkade, systeem_fout, herinnering',
  `ernst` varchar(255) NOT NULL COMMENT 'laag, medium, hoog, kritisch',
  `titel` varchar(255) NOT NULL,
  `bericht` text NOT NULL,
  `status` varchar(255) NOT NULL COMMENT 'nieuw, verzonden, gelezen, opgelost, gesloten',
  `kanaal` varchar(255) DEFAULT NULL COMMENT 'in_app, email',
  `foutcode` varchar(255) DEFAULT NULL,
  `foutdetails` text,
  `gelezen_op` timestamp NULL DEFAULT NULL,
  `opgelost_op` timestamp NULL DEFAULT NULL,
  `aangemaakt_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ontvanger_id` (`ontvanger_id`),
  KEY `aangemaakt_door_id` (`aangemaakt_door_id`),
  KEY `stagevoorstel_id` (`stagevoorstel_id`),
  KEY `stagedossier_id` (`stagedossier_id`),
  KEY `document_id` (`document_id`),
  KEY `logboek_week_id` (`logboek_week_id`),
  CONSTRAINT `systeem_meldingen_ibfk_1` FOREIGN KEY (`ontvanger_id`) REFERENCES `gebruikers` (`id`),
  CONSTRAINT `systeem_meldingen_ibfk_2` FOREIGN KEY (`aangemaakt_door_id`) REFERENCES `gebruikers` (`id`),
  CONSTRAINT `systeem_meldingen_ibfk_3` FOREIGN KEY (`stagevoorstel_id`) REFERENCES `stagevoorstellen` (`id`),
  CONSTRAINT `systeem_meldingen_ibfk_4` FOREIGN KEY (`stagedossier_id`) REFERENCES `stagedossiers` (`id`),
  CONSTRAINT `systeem_meldingen_ibfk_5` FOREIGN KEY (`document_id`) REFERENCES `documenten` (`id`),
  CONSTRAINT `systeem_meldingen_ibfk_6` FOREIGN KEY (`logboek_week_id`) REFERENCES `logboek_weken` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `voorstel_beslissingen`;
CREATE TABLE `voorstel_beslissingen` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagevoorstel_id` int NOT NULL,
  `stagevoorstel_versie_id` int NOT NULL,
  `beslist_door_id` int NOT NULL,
  `beslissing` varchar(255) NOT NULL COMMENT 'goedgekeurd, afgekeurd, aanpassingen_gevraagd, goedgekeurd_met_uitzondering',
  `feedback` text COMMENT 'Voor aanpassingen vereist',
  `onderdeel` varchar(255) DEFAULT NULL COMMENT 'Onderdeel van het voorstel waarop de aanpassing slaat',
  `motivering` text COMMENT 'Voor afkeuring of beslissing',
  `uitzondering_motivering` text,
  `beslist_op` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `stagevoorstel_id` (`stagevoorstel_id`),
  KEY `stagevoorstel_versie_id` (`stagevoorstel_versie_id`),
  KEY `beslist_door_id` (`beslist_door_id`),
  CONSTRAINT `voorstel_beslissingen_ibfk_1` FOREIGN KEY (`stagevoorstel_id`) REFERENCES `stagevoorstellen` (`id`),
  CONSTRAINT `voorstel_beslissingen_ibfk_2` FOREIGN KEY (`stagevoorstel_versie_id`) REFERENCES `stagevoorstel_versies` (`id`),
  CONSTRAINT `voorstel_beslissingen_ibfk_3` FOREIGN KEY (`beslist_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `voorstel_checklist`;
CREATE TABLE `voorstel_checklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stagevoorstel_versie_id` int NOT NULL,
  `criterium` varchar(255) NOT NULL COMMENT 'Bijvoorbeeld minimum 12 weken, mentorfunctie, ontwikkelcomponent',
  `is_verplicht` tinyint(1) DEFAULT '1',
  `is_in_orde` tinyint(1) NOT NULL,
  `opmerking` text,
  `gecontroleerd_door_id` int DEFAULT NULL,
  `gecontroleerd_op` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stagevoorstel_versie_id` (`stagevoorstel_versie_id`),
  KEY `gecontroleerd_door_id` (`gecontroleerd_door_id`),
  CONSTRAINT `voorstel_checklist_ibfk_1` FOREIGN KEY (`stagevoorstel_versie_id`) REFERENCES `stagevoorstel_versies` (`id`),
  CONSTRAINT `voorstel_checklist_ibfk_2` FOREIGN KEY (`gecontroleerd_door_id`) REFERENCES `medewerkers` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
