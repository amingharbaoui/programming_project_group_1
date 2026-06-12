import { useEffect, useState } from "react";
import "./CompetenciesPage.css";
import { IconArchive, IconChecks, IconCopyPlus, IconEdit, IconListDetails, IconTrash,} from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function CompetenciesPage() {
  const { user } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      try {
        setError("");
        await api.get("/competencies");
      } catch (err) {
        setError(err.response?.data?.message || "Competenties ophalen mislukt");
      }
    }

    checkAccess();
  }, [user.id]);

  return (
      <div className="competencies_page">
        <div className="competencies_main">
          <div className="card competencies_hero">
            <div className="competencies_hero_content">
              <span className="page_chip">Actief profiel</span>
              <h1>Competentieprofiel</h1>
              <p>
                Versioneerbaar beheer, wijzigingen gelden voor nieuwe dossiers en
                niet stilzwijgend voor lopende evaluaties.
              </p>
              {error && <p>{error}</p>}
            </div>

            <div className="competencies_hero_actions">
              <button className="btn">
                <IconCopyPlus size={18} stroke={1.8} />
                Nieuwe versie maken
              </button>

              <button className="btn">
                <IconArchive size={18} stroke={1.8} />
                Archiveren
              </button>

              <button className="btn primary">
                <IconChecks size={18} stroke={1.8} />
                Publiceren
              </button>
            </div>
          </div>

          <div className="card profile_card">
            <div className="card_title">
              <IconListDetails size={17} stroke={1.8} />
              Profiel
            </div>

            <div className="kv">
              <span className="k">Profiel</span>
              <span className="v">Toegepaste Informatica 2025–2026</span>
            </div>

            <div className="kv">
              <span className="k">Versie</span>
              <span className="v">
              v1.0{" "}
                <span className="concept_note">
                conceptwijzigingen niet gepubliceerd
              </span>
            </span>
            </div>

            <div className="kv">
              <span className="k">Status</span>
              <span className="v">
              <span className="status s_ok">Actief</span>
            </span>
            </div>

            <div className="kv">
              <span className="k">Geldig vanaf</span>
              <span className="v">2025–2026</span>
            </div>

            <div className="kv">
              <span className="k">Gekoppelde dossiers</span>
              <span className="v">1 actief dossier</span>
            </div>

            <div className="profile_note">
              Wijzigingen aan een gepubliceerd competentieprofiel gelden alleen
              voor nieuwe dossiers of voor dossiers waarvoor deze versie
              expliciet wordt gekoppeld.
            </div>
          </div>

          <div className="card competencies_card">
            <div className="competencies_head">
              <div className="card_title">
                <IconListDetails size={17} stroke={1.8} />
                Competenties
                <span className="competencies_total ok">Totaal gewicht 100</span>
              </div>

              <button className="btn">
                <IconCopyPlus size={18} stroke={1.8} />
                Competentie toevoegen
              </button>
            </div>

            <div className="competency_table">
              <div className="competency_table_head">
                <span>#</span>
                <span>Competentie</span>
                <span>Gewicht</span>
                <span>Acties</span>
              </div>

              {[
                ["Beheersing van het planningsproces", 8],
                ["Ontwerpen van IT-oplossingen", 12],
                ["Implementatie van digitale producten", 15],
                ["Integratie van technologie en infrastructuur", 8],
                ["Onderzoekende houding", 8],
                ["Helder en transparant communiceren", 10],
                ["Probleemoplossend vermogen", 12],
                ["Persoonlijke ontwikkeling", 8],
                ["Professionele attitude", 7],
                ["Ondernemend handelen", 6],
                ["Ethisch en deontologisch handelen", 6],
              ].map(([name, weight], index) => (
                  <div className="competency_row" key={name}>
                    <span className="competency_index">{index + 1}</span>

                    <div className="competency_name">{name}</div>

                    <div className="competency_weight">
                      <input
                          type="number"
                          defaultValue={weight}
                          min="0"
                          max="100"
                      />
                    </div>

                    <div className="competency_actions">
                      <button
                          className="icon_btn"
                          type="button"
                          aria-label="Competentie bewerken"
                      >
                        <IconEdit size={17} stroke={1.8} />
                      </button>

                      <button
                          className="icon_btn"
                          type="button"
                          aria-label="Competentie verwijderen"
                      >
                        <IconTrash size={17} stroke={1.8} />
                      </button>
                    </div>
                  </div>
              ))}
            </div>

            <div className="competencies_footer">
              Het totaalgewicht moet exact 100 zijn voordat je dit
              competentieprofiel kan publiceren.
            </div>
          </div>
        </div>

        <aside className="competencies_side">
          <div className="card summary_card">
            <div className="card_title">Overzicht</div>

            <div className="summary_line">
              <span>Aantal competenties</span>
              <strong>11</strong>
            </div>

            <div className="summary_line">
              <span>Totaal gewicht</span>
              <strong>100%</strong>
            </div>

            <div className="summary_line">
              <span>Versie</span>
              <strong>v1.0</strong>
            </div>

            <div className="summary_line">
              <span>Status</span>
              <strong className="ok_text">Actief</strong>
            </div>
          </div>

          <div className="card validation_card">
            <div className="card_title">Validatie</div>
            <p>
              Controleer of alle gewichten samen exact 100 zijn en publiceer pas
              daarna de nieuwe versie.
            </p>
            <div className="validation_ok">Totaal correct: 100%</div>
          </div>

          <div className="card actions_card">
            <div className="card_title">Snelle acties</div>

            <button className="btn full_width">
              <IconCopyPlus size={18} stroke={1.8} />
              Nieuwe versie maken
            </button>

            <button className="btn full_width">
              <IconArchive size={18} stroke={1.8} />
              Dupliceren
            </button>

            <button className="btn full_width danger_outline">
              <IconTrash size={18} stroke={1.8} />
              Profiel archiveren
            </button>
          </div>
        </aside>
      </div>
  );
}
