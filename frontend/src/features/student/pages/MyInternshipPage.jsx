import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function MyInternshipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ingediend, setIngediend] = useState(location.state?.ingediend || false);
  const [showPopup, setShowPopup] = useState(location.state?.ingediend || false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);

  const statusConfig = {
    pending: { cls: "s_grijs", icon: "ti-hourglass", label: "In behandeling" },
    approved: { cls: "s_ok", icon: "ti-check", label: "Goedgekeurd" },
    rejected: { cls: "s_rood", icon: "ti-x", label: "Afgekeurd" },
    changes_requested: { cls: "s_amber", icon: "ti-pencil", label: "Aanpassingen gevraagd" },
  };

  const status = statusConfig["pending"];

  function handleBegrepen() {
    setShowPopup(false);
  }

  return (
    <div className="page-inner">

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <div className="popup-header">
              <div className="card_title">
                <i className="ti ti-send" />
                Stagevoorstel ingediend
              </div>
              <button className="btn" onClick={handleBegrepen}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="popup-body">
              <p>Je stagevoorstel werd ingediend bij de stagecommissie. Je krijgt een melding na de beoordeling.</p>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={handleBegrepen}>
                <i className="ti ti-check" />
                Begrepen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>Mijn stage</h1>
        <p>Academiejaar 2025–2026</p>
      </div>

      {!ingediend ? (

        <div className="card">
          <div className="card_title">
            <i className="ti ti-briefcase" />
            Stageaanvraag
          </div>
          <p>Je hebt nog geen stage. Alles start met je stagevoorstel: bedrijf, mentor, opdracht en periode. Na indiening bekijkt de stagecommissie je voorstel.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => navigate("/student/application")}>
              <i className="ti ti-plus" />
              Stagevoorstel indienen
            </button>
          </div>
        </div>

      ) : (

        <>

          <div className="card">
            <div className="progress-steps">
              <div className="progress-step done">
                <div className="progress-circle">
                  <i className="ti ti-check" />
                </div>
                <div className="progress-label">Voorstel</div>
              </div>
              <div className="progress-line active" />
              <div className="progress-step active">
                <div className="progress-circle">2</div>
                <div className="progress-label">Beoordeling</div>
              </div>
              <div className="progress-line" />
              <div className="progress-step">
                <div className="progress-circle">3</div>
                <div className="progress-label">Contract</div>
              </div>
              <div className="progress-line" />
              <div className="progress-step">
                <div className="progress-circle">4</div>
                <div className="progress-label">Stage</div>
              </div>
              <div className="progress-line" />
              <div className="progress-step">
                <div className="progress-circle">5</div>
                <div className="progress-label">Evaluatie</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card_title">
              <i className="ti ti-info-circle" />
              Status
            </div>
            <span className={`status ${status.cls}`}>
              <i className={`ti ${status.icon}`} />
              {status.label}
            </span>
          </div>

          <div className="card">
            <div className="card_title">
              <i className="ti ti-users" />
              Begeleiding
            </div>
            <div className="kv">
              <span className="k">Mentor</span>
              <span className="status s_amber">In afwachting</span>
            </div>
            <div className="kv"><span className="k">Naam</span><span className="v">—</span></div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">—</span></div>
            <div className="kv"><span className="k">E-mail</span><span className="v">—</span></div>
            <div className="kv"><span className="k">Stagebegeleider</span><span className="v">—</span></div>
          </div>

          <div className="card" onClick={() => setVoorstelOpen(!voorstelOpen)}>
            <div className="card_title">
              <i className="ti ti-file-description" />
              Je voorstel zoals ingediend — nog niet goedgekeurd
              <i className={`ti ${voorstelOpen ? "ti-chevron-up" : "ti-chevron-down"}`} />
            </div>
          </div>

          {voorstelOpen && (
            <>
              <div className="grid_2">
                <div className="card">
                  <div className="card_title">
                    <i className="ti ti-building" />
                    Bedrijf
                  </div>
                  <div className="kv"><span className="k">Naam</span><span className="v">—</span></div>
                  <div className="kv"><span className="k">Afdeling</span><span className="v">—</span></div>
                  <div className="kv"><span className="k">Adres</span><span className="v">—</span></div>
                </div>
                <div className="card">
                  <div className="card_title">
                    <i className="ti ti-calendar" />
                    Periode
                  </div>
                  <div className="kv"><span className="k">Start</span><span className="v">—</span></div>
                  <div className="kv"><span className="k">Einde</span><span className="v">—</span></div>
                  <div className="kv"><span className="k">Uren/week</span><span className="v">—</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card_title">
                  <i className="ti ti-user-check" />
                  Mentor
                </div>
                <div className="kv"><span className="k">Naam</span><span className="v">—</span></div>
                <div className="kv"><span className="k">Functie</span><span className="v">—</span></div>
                <div className="kv"><span className="k">E-mail</span><span className="v">—</span></div>
              </div>

              <div className="card">
                <div className="card_title">
                  <i className="ti ti-clipboard-text" />
                  Opdracht
                </div>
                <div className="kv"><span className="k">Functie</span><span className="v">—</span></div>
                <p>—</p>
              </div>

              <div className="card">
                <button className="btn">
                  <i className="ti ti-arrow-back-up" />
                  Voorstel intrekken
                </button>
              </div>
            </>
          )}

        </>

      )}

    </div>
  );
}