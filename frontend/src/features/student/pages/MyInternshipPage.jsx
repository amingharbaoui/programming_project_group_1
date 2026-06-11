import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import "./MyInternshipPage.css";
import {
  IconSend, IconX, IconCheck, IconBriefcase, IconPlus,
  IconInfoCircle, IconUsers, IconFileDescription, IconChevronUp,
  IconChevronDown, IconBuilding, IconCalendar, IconUserCheck,
  IconClipboardText, IconArrowBackUp, IconNotebook, IconArrowRight,
  IconHourglass, IconPencil
} from "@tabler/icons-react";

export default function MyInternshipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPopup, setShowPopup] = useState(location.state?.ingediend || false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [internship, setInternship] = useState(null);
  const [loading, setLoading] = useState(true);

  const submittedInternship = {
    status: "ingediend",
  };

  // Status configuratie met bijhorende CSS klasse, icoon en label
  const statusConfig = {
    ingediend: { cls: "s_grijs", icon: <IconHourglass size={14} />, label: "In behandeling" },
    goedgekeurd: { cls: "s_ok", icon: <IconCheck size={14} />, label: "Goedgekeurd" },
    afgekeurd: { cls: "s_rood", icon: <IconX size={14} />, label: "Afgekeurd" },
    aanpassingen_gevraagd: { cls: "s_amber", icon: <IconPencil size={14} />, label: "Aanpassingen gevraagd" },
  };

  const data = internship || (location.state?.ingediend ? submittedInternship : null);
  const status = statusConfig[data?.status] || statusConfig["ingediend"];
  const ingediend = !!internship || location.state?.ingediend;
  const decisionMessage = data?.laatste_feedback || data?.laatste_motivering || data?.feedback || data?.motivering;
  const hasDecision = ["goedgekeurd", "afgekeurd", "aanpassingen_gevraagd"].includes(data?.status);

  function handleBegrepen() {
    setShowPopup(false);
  }

  // Datums formatteren van ISO naar leesbaar formaat
  function formatDatum(datum) {
    if (!datum) return "-";
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
                <IconSend size={16} />
                Stagevoorstel ingediend
              </div>
              <button className="btn" onClick={handleBegrepen}>
                <IconX size={16} />
              </button>
            </div>
            <div className="popup-body">
              <p>Je stagevoorstel werd ingediend bij de stagecommissie. Je krijgt een melding na de beoordeling.</p>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={handleBegrepen}>
                <IconCheck size={16} />
                Begrepen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>Mijn stage</h1>
        <p>Academiejaar 2025-2026</p>
      </div>

      {/* Geen stage ingediend */}
      {!ingediend ? (

        <div className="card">
          <div className="card_title">
            <IconBriefcase size={16} />
            Stageaanvraag
          </div>
          <p>Je hebt nog geen stage. Alles start met je stagevoorstel: bedrijf, mentor, opdracht en periode. Na indiening bekijkt de stagecommissie je voorstel.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => navigate("/student/application")}>
              <IconPlus size={16} />
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
                  <IconCheck size={16} />
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
              <IconInfoCircle size={16} />
              Status
            </div>
            <span className={`status ${status.cls}`}>
              {status.icon}
              {status.label}
            </span>
          </div>

          {hasDecision && (
            <div className="card">
              <div className="card_title">
                <IconPencil size={16} />
                Beslissing van de commissie
              </div>
              <p>{decisionMessage || "De stagecommissie heeft je voorstel beoordeeld."}</p>
              {data.status === "aanpassingen_gevraagd" && (
                <div className="actions">
                  <button className="btn primary" onClick={() => navigate("/student/application")}>
                    <IconPencil size={16} />
                    Aanvraag aanpassen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Begeleiding — altijd zichtbaar */}
          <div className="card">
            <div className="card_title">
              <IconUsers size={16} />
              Begeleiding
            </div>
            <div className="kv"><span className="k">Naam</span><span className="v">{data.mentorNaam || data.mentor_naam || "-"}</span></div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{data.bedrijfNaam || data.bedrijf_naam || "-"}</span></div>
            <div className="kv"><span className="k">E-mail</span><span className="v">{data.mentorEmail || data.mentor_email || "-"}</span></div>
            <div className="kv"><span className="k">Stagebegeleider</span><span className="v">-</span></div>
          </div>

          {/* Uitklapbaar voorsteldetail */}
          <div className="card" onClick={() => setVoorstelOpen(!voorstelOpen)}>
            <div className="card_title">
              <IconFileDescription size={16} />
              Volledig voorstel bekijken
              {voorstelOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </div>
          </div>

          {voorstelOpen && (
            <>
              <div className="grid_2">
                <div className="card">
                  <div className="card_title">
                    <IconBuilding size={16} />
                    Bedrijf
                  </div>
                  <div className="kv"><span className="k">Naam</span><span className="v">{data.bedrijfNaam || data.bedrijf_naam || "-"}</span></div>
                  <div className="kv"><span className="k">Afdeling</span><span className="v">{data.bedrijfsafdeling || "-"}</span></div>
                </div>
                <div className="card">
                  <div className="card_title">
                    <IconCalendar size={16} />
                    Periode
                  </div>
                  <div className="kv"><span className="k">Start</span><span className="v">{formatDatum(data.startDatum || data.startdatum)}</span></div>
                  <div className="kv"><span className="k">Einde</span><span className="v">{formatDatum(data.eindDatum || data.einddatum)}</span></div>
                  <div className="kv"><span className="k">Uren/week</span><span className="v">{data.uren_per_week ? `${data.uren_per_week}u` : "-"}</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card_title">
                  <IconUserCheck size={16} />
                  Mentor
                </div>
                <div className="kv"><span className="k">Naam</span><span className="v">{data.mentorNaam || data.mentor_naam || "-"}</span></div>
                <div className="kv"><span className="k">Functie</span><span className="v">{data.mentorFunctie || data.mentor_functie || "-"}</span></div>
                <div className="kv"><span className="k">E-mail</span><span className="v">{data.mentorEmail || data.mentor_email || "-"}</span></div>
              </div>

              <div className="card">
                <div className="card_title">
                  <IconClipboardText size={16} />
                  Opdracht
                </div>
                <div className="kv"><span className="k">Titel</span><span className="v">{data.opdrachtTitel || data.stagefunctie || "-"}</span></div>
                <p>{data.opdrachtOmschrijving || data.opdrachtomschrijving || "-"}</p>
              </div>

              <div className="card">
                <button className="btn">
                  <IconArrowBackUp size={16} />
                  Voorstel intrekken
                </button>
              </div>
            </>
          )}

          {/* Knop naar logboek — alleen zichtbaar als stage goedgekeurd is */}
          {data.status === "goedgekeurd" && (
            <div className="card">
              <div className="card_title">
                <IconNotebook size={16} />
                Logboek
              </div>
              <p>Je stage is goedgekeurd. Je kan nu je logboek invullen.</p>
              <div className="actions">
                <button className="btn primary" onClick={() => navigate("/student/logbook")}>
                  <IconArrowRight size={16} />
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
