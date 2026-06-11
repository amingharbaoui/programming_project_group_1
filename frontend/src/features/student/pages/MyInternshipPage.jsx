import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import "./MyInternshipPage.css"

export default function MyInternshipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPopup, setShowPopup] = useState(location.state?.ingediend || false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [internship, setInternship] = useState(null);
  const [loading, setLoading] = useState(true);

  // Demo data — David vervangt later door GET /api/internships/my
  const demoInternship = {
    status: "ingediend",
    bedrijfNaam: "Demo bedrijf",
    mentorNaam: "Demo mentor",
    startDatum: "2026-02-09",
    eindDatum: "2026-06-26",
    opdrachtTitel: "Stageopdracht applicatieontwikkeling",
    opdrachtOmschrijving: "Student werkt mee aan een interne webapplicatie.",
  };

  // Status configuratie met bijhorende CSS klasse, icoon en label
  const statusConfig = {
    ingediend: { cls: "s_grijs", icon: "ti-hourglass", label: "In behandeling" },
    goedgekeurd: { cls: "s_ok", icon: "ti-check", label: "Goedgekeurd" },
    afgekeurd: { cls: "s_rood", icon: "ti-x", label: "Afgekeurd" },
    aanpassingen_gevraagd: { cls: "s_amber", icon: "ti-pencil", label: "Aanpassingen gevraagd" },
  };

  // Gebruik backend data als die beschikbaar is, anders demo data
  const data = internship || demoInternship;
  const status = statusConfig[data.status] || statusConfig["ingediend"];
  const ingediend = !!internship || location.state?.ingediend;

  function handleBegrepen() {
    setShowPopup(false);
  }

  // Datums formatteren van ISO naar leesbaar formaat
  function formatDatum(datum) {
    if (!datum) return "—";
    return new Date(datum).toLocaleDateString("nl-BE");
  }

  // Haal het voorstel op bij het laden van de pagina
  useEffect(() => {
    async function fetchInternship() {
      try {
        const res = await apiRequest("GET", "/internships/my");
        if (res.data) {
          setInternship(res.data);
        }
      } catch (err) {
        console.error("Kan stage niet ophalen:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInternship();
  }, []);

  // Laadscherm terwijl backend geraadpleegd wordt
  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Mijn stage</h1>
        </div>
        <div className="card">
          <p>Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">

      {/* Popup na indienen */}
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

      {/* Geen stage ingediend */}
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

          {/* Progressbar */}
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

          {/* Huidige status */}
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
          {/* Feedback van de commissie, het is alleen zichtbaar als aanpassingen gevraagd */}
          {data.status === "aanpassingen_gevraagd" && (
          <div className="card">
            <div className="card_title">
              <i className="ti ti-message-circle" />
              Feedback van de commissie
            </div>
            <p>{data.laatste_feedback || data.feedback || "—"}</p>
            <div className="actions">
              <button className="btn primary" onClick={() => navigate("/student/application")}>
              <i className="ti ti-pencil" />
              Aanvraag aanpassen
              </button>
            </div>
          </div>
          )}


          {/* Begeleiding — altijd zichtbaar */}
          <div className="card">
            <div className="card_title">
              <i className="ti ti-users" />
              Begeleiding
            </div>
            <div className="kv"><span className="k">Naam</span><span className="v">{data.mentorNaam || data.mentor_naam || "—"}</span></div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{data.bedrijfNaam || data.bedrijf_naam || "—"}</span></div>
            <div className="kv"><span className="k">E-mail</span><span className="v">{data.mentorEmail || data.mentor_email || "—"}</span></div>
            <div className="kv"><span className="k">Stagebegeleider</span><span className="v">—</span></div>
          </div>

          {/* Uitklapbaar voorsteldetail */}
          <div className="card" onClick={() => setVoorstelOpen(!voorstelOpen)}>
            <div className="card_title">
              <i className="ti ti-file-description" />
              Volledig voorstel bekijken
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
                  <div className="kv"><span className="k">Naam</span><span className="v">{data.bedrijfNaam || data.bedrijf_naam || "—"}</span></div>
                  <div className="kv"><span className="k">Afdeling</span><span className="v">{data.bedrijfsafdeling || "—"}</span></div>
                </div>
                <div className="card">
                  <div className="card_title">
                    <i className="ti ti-calendar" />
                    Periode
                  </div>
                  <div className="kv"><span className="k">Start</span><span className="v">{formatDatum(data.startDatum || data.startdatum)}</span></div>
                  <div className="kv"><span className="k">Einde</span><span className="v">{formatDatum(data.eindDatum || data.einddatum)}</span></div>
                  <div className="kv"><span className="k">Uren/week</span><span className="v">{data.uren_per_week ? `${data.uren_per_week}u` : "—"}</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card_title">
                  <i className="ti ti-user-check" />
                  Mentor
                </div>
                <div className="kv"><span className="k">Naam</span><span className="v">{data.mentorNaam || data.mentor_naam || "—"}</span></div>
                <div className="kv"><span className="k">Functie</span><span className="v">{data.mentorFunctie || data.mentor_functie || "—"}</span></div>
                <div className="kv"><span className="k">E-mail</span><span className="v">{data.mentorEmail || data.mentor_email || "—"}</span></div>
              </div>

              <div className="card">
                <div className="card_title">
                  <i className="ti ti-clipboard-text" />
                  Opdracht
                </div>
                <div className="kv"><span className="k">Titel</span><span className="v">{data.opdrachtTitel || data.stagefunctie || "—"}</span></div>
                <p>{data.opdrachtOmschrijving || data.opdrachtomschrijving || "—"}</p>
              </div>

              <div className="card">
                <button className="btn">
                  <i className="ti ti-arrow-back-up" />
                  Voorstel intrekken
                </button>
              </div>
            </>
          )}

          {/* Knop naar logboek — alleen zichtbaar als stage goedgekeurd is */}
          {data.status === "goedgekeurd" && (
            <div className="card">
              <div className="card_title">
                <i className="ti ti-notebook" />
                Logboek
              </div>
              <p>Je stage is goedgekeurd. Je kan nu je logboek invullen.</p>
              <div className="actions">
                <button className="btn primary" onClick={() => navigate("/student/logbook")}>
                  <i className="ti ti-arrow-right" />
                  Naar logboek
                </button>
              </div>
            </div>
          )}

        </>

      )}

    </div>
  );
}