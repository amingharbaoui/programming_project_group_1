import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import "./MyInternshipPage.css";
import {
  IconSend, IconX, IconCheck, IconBriefcase, IconPlus,
  IconInfoCircle, IconUsers, IconFileDescription, IconChevronUp,
  IconChevronDown, IconBuilding, IconCalendar, IconUserCheck,
  IconClipboardText, IconArrowBackUp, IconNotebook, IconArrowRight,
  IconHourglass, IconPencil, IconAlertCircle, IconDeviceFloppy,
} from "@tabler/icons-react";

const STATUS_CONFIG = {
  concept:               { cls: "s_grijs",  icon: <IconDeviceFloppy size={14} />,  label: "Concept — nog niet ingediend" },
  ingediend:             { cls: "s_grijs",  icon: <IconHourglass size={14} />,      label: "In behandeling" },
  heringediend:          { cls: "s_grijs",  icon: <IconHourglass size={14} />,      label: "Heringediend — in behandeling" },
  aanpassingen_gevraagd: { cls: "s_amber",  icon: <IconPencil size={14} />,         label: "Aanpassingen gevraagd" },
  goedgekeurd:           { cls: "s_ok",     icon: <IconCheck size={14} />,           label: "Goedgekeurd" },
  afgekeurd:             { cls: "s_rood",   icon: <IconX size={14} />,               label: "Afgekeurd" },
  ingetrokken:           { cls: "s_grijs",  icon: <IconArrowBackUp size={14} />,     label: "Ingetrokken" },
};

// Progressstap op basis van status (0=concept/geen, 1=ingediend, 2=goedgekeurd)
function getProgressStep(status) {
  if (!status || status === "concept") return 0;
  if (["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(status)) return 1;
  if (status === "goedgekeurd") return 2;
  return 1;
}

function ProgressBar({ status }) {
  const stap = getProgressStep(status);
  const stappen = ["Voorstel", "Beoordeling", "Contract", "Stage", "Evaluatie"];

  return (
    <div className="progress-steps">
      {stappen.map((label, i) => {
        const done   = stap > i;
        const active = stap === i;
        return (
          <div key={label} style={{ display: "contents" }}>
            <div className={`progress-step${done ? " done" : active ? " active" : ""}`}>
              <div className="progress-circle">
                {done ? <IconCheck size={16} /> : i + 1}
              </div>
              <div className="progress-label">{label}</div>
            </div>
            {i < stappen.length - 1 && (
              <div className={`progress-line${done || (active && i === 0) ? " active" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyInternshipPage() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [showPopup,    setShowPopup]    = useState(location.state?.ingediend || false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [internship,   setInternship]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [intrekModal,  setIntrekModal]  = useState(false);
  const [intrekken,    setIntrekken]    = useState(false);
  const [intrekFout,   setIntrekFout]   = useState(null);

  useEffect(() => {
    async function fetchInternship() {
      try {
        const res = await apiRequest("GET", "/internships/my");
        if (res.data) setInternship(res.data);
      } catch {
        // geen voorstel
      } finally {
        setLoading(false);
      }
    }
    fetchInternship();
  }, []);

  function formatDatum(datum) {
    if (!datum) return "-";
    return new Date(datum).toLocaleDateString("nl-BE");
  }

  async function handleIntrekken() {
    setIntrekken(true);
    setIntrekFout(null);
    try {
      await apiRequest("PATCH", "/internships/my/intrekken");
      setIntrekModal(false);
      // Herlaad pagina data
      const res = await apiRequest("GET", "/internships/my");
      setInternship(res.data || null);
    } catch (err) {
      setIntrekFout(err.response?.data?.message || "Intrekken mislukt.");
    } finally {
      setIntrekken(false);
    }
  }

  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Mijn stage</h1></div>
        <div className="card"><p>Bezig met laden...</p></div>
      </div>
    );
  }

  const currentStatus = internship?.status || (location.state?.ingediend ? "ingediend" : null);
  const statusInfo    = STATUS_CONFIG[currentStatus] || STATUS_CONFIG["ingediend"];
  const heeftVoorstel = !!internship || location.state?.ingediend;
  const isConcept     = currentStatus === "concept";
  const isAfgesloten  = ["afgekeurd", "ingetrokken"].includes(currentStatus);
  const isActief      = heeftVoorstel && !isConcept && !isAfgesloten;

  const data             = internship;
  const hasDecision      = ["goedgekeurd", "afgekeurd", "aanpassingen_gevraagd"].includes(currentStatus);
  const decisionMessage  = data?.laatste_feedback || data?.laatste_motivering || data?.feedback || data?.motivering;
  const kanIntrekken     = ["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(currentStatus);

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
              <button className="btn" onClick={() => setShowPopup(false)}>
                <IconX size={16} />
              </button>
            </div>
            <div className="popup-body">
              <p>Je stagevoorstel werd ingediend bij de stagecommissie. Je krijgt een melding na de beoordeling.</p>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={() => setShowPopup(false)}>
                <IconCheck size={16} />
                Begrepen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bevestigingsmodal intrekken */}
      {intrekModal && (
        <div className="popup-overlay">
          <div className="popup">
            <div className="popup-header">
              <div className="card_title">
                <IconAlertCircle size={16} />
                Voorstel intrekken
              </div>
              <button className="btn" onClick={() => setIntrekModal(false)}>
                <IconX size={16} />
              </button>
            </div>
            <div className="popup-body">
              <p>Ben je zeker dat je je stagevoorstel wil intrekken? Het voorstel wordt niet meer beoordeeld door de stagecommissie.</p>
              {intrekFout && <p className="status s_rood" style={{ marginTop: 8 }}>{intrekFout}</p>}
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setIntrekModal(false)} disabled={intrekken}>
                Annuleren
              </button>
              <button className="btn primary" style={{ background: "var(--red)" }} onClick={handleIntrekken} disabled={intrekken}>
                <IconArrowBackUp size={16} />
                {intrekken ? "Bezig..." : "Ja, intrekken"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>Mijn stage</h1>
        <p>Academiejaar 2025-2026</p>
      </div>

      {/* Geen voorstel */}
      {!heeftVoorstel && (
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
      )}

      {/* Concept — nog niet ingediend */}
      {isConcept && (
        <>
          <div className="card">
            <div className="card_title">
              <IconDeviceFloppy size={16} />
              Concept opgeslagen
            </div>
            <span className={`status ${statusInfo.cls}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--sub)" }}>
              Je hebt een onvolledig concept bewaard. Werk het af en dien in om de stagecommissie te bereiken.
            </p>
            <div className="actions">
              <button className="btn primary" onClick={() => navigate("/student/application")}>
                <IconPencil size={16} />
                Concept afwerken
              </button>
              <button className="btn" onClick={() => setIntrekModal(true)}>
                <IconArrowBackUp size={16} />
                Concept verwijderen
              </button>
            </div>
          </div>
        </>
      )}

      {/* Afgekeurd of ingetrokken — nieuw starten */}
      {isAfgesloten && (
        <>
          <div className="card">
            <div className="card_title">
              <IconInfoCircle size={16} />
              Status
            </div>
            <span className={`status ${statusInfo.cls}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
            {hasDecision && decisionMessage && (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--sub)" }}>{decisionMessage}</p>
            )}
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--sub)" }}>
              Je kan een nieuw stagevoorstel indienen.
            </p>
            <div className="actions">
              <button className="btn primary" onClick={() => navigate("/student/application")}>
                <IconPlus size={16} />
                Nieuw voorstel starten
              </button>
            </div>
          </div>

          {/* Historiek van ingetrokken/afgekeurd voorstel */}
          {data && (
            <div className="card" onClick={() => setVoorstelOpen(!voorstelOpen)} style={{ cursor: "pointer" }}>
              <div className="card_title">
                <IconFileDescription size={16} />
                Vorig voorstel bekijken
                {voorstelOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </div>
            </div>
          )}
          {voorstelOpen && data && (
            <div className="grid_2">
              <div className="card">
                <div className="card_title"><IconBuilding size={16} />Bedrijf</div>
                <div className="kv"><span className="k">Naam</span><span className="v">{data.bedrijf_naam || "-"}</span></div>
              </div>
              <div className="card">
                <div className="card_title"><IconCalendar size={16} />Periode</div>
                <div className="kv"><span className="k">Start</span><span className="v">{formatDatum(data.startdatum)}</span></div>
                <div className="kv"><span className="k">Einde</span><span className="v">{formatDatum(data.einddatum)}</span></div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Actief voorstel — ingediend / aanpassingen / goedgekeurd */}
      {isActief && (
        <>
          {/* Progressbar */}
          <div className="card">
            <ProgressBar status={currentStatus} />
          </div>

          {/* Status */}
          <div className="card">
            <div className="card_title">
              <IconInfoCircle size={16} />
              Status
            </div>
            <span className={`status ${statusInfo.cls}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
          </div>

          {/* Commissiebeslissing */}
          {hasDecision && (
            <div className="card">
              <div className="card_title">
                <IconPencil size={16} />
                Beslissing van de commissie
              </div>
              <p>{decisionMessage || "De stagecommissie heeft je voorstel beoordeeld."}</p>
              {currentStatus === "aanpassingen_gevraagd" && (
                <div className="actions">
                  <button className="btn primary" onClick={() => navigate("/student/application")}>
                    <IconPencil size={16} />
                    Aanvraag aanpassen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Begeleiding */}
          <div className="card">
            <div className="card_title">
              <IconUsers size={16} />
              Begeleiding
            </div>
            <div className="kv"><span className="k">Naam</span><span className="v">{data?.mentor_naam || "-"}</span></div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{data?.bedrijf_naam || "-"}</span></div>
            <div className="kv"><span className="k">E-mail</span><span className="v">{data?.mentor_email || "-"}</span></div>
            <div className="kv"><span className="k">Stagebegeleider</span><span className="v">-</span></div>
          </div>

          {/* Uitklapbaar voorsteldetail */}
          <div className="card" onClick={() => setVoorstelOpen(!voorstelOpen)} style={{ cursor: "pointer" }}>
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
                  <div className="card_title"><IconBuilding size={16} />Bedrijf</div>
                  <div className="kv"><span className="k">Naam</span><span className="v">{data?.bedrijf_naam || "-"}</span></div>
                  <div className="kv"><span className="k">Afdeling</span><span className="v">{data?.bedrijfsafdeling || "-"}</span></div>
                </div>
                <div className="card">
                  <div className="card_title"><IconCalendar size={16} />Periode</div>
                  <div className="kv"><span className="k">Start</span><span className="v">{formatDatum(data?.startdatum)}</span></div>
                  <div className="kv"><span className="k">Einde</span><span className="v">{formatDatum(data?.einddatum)}</span></div>
                  <div className="kv"><span className="k">Uren/week</span><span className="v">{data?.uren_per_week ? `${data.uren_per_week}u` : "-"}</span></div>
                </div>
              </div>

              <div className="card">
                <div className="card_title"><IconUserCheck size={16} />Mentor</div>
                <div className="kv"><span className="k">Naam</span><span className="v">{data?.mentor_naam || "-"}</span></div>
                <div className="kv"><span className="k">Functie</span><span className="v">{data?.mentor_functie || "-"}</span></div>
                <div className="kv"><span className="k">E-mail</span><span className="v">{data?.mentor_email || "-"}</span></div>
              </div>

              <div className="card">
                <div className="card_title"><IconClipboardText size={16} />Opdracht</div>
                <div className="kv"><span className="k">Titel</span><span className="v">{data?.stagefunctie || "-"}</span></div>
                <p>{data?.opdrachtomschrijving || "-"}</p>
              </div>

              {/* Intrekken knop — alleen tonen als nog intrekbaar */}
              {kanIntrekken && (
                <div className="card">
                  <button className="btn" onClick={() => setIntrekModal(true)}>
                    <IconArrowBackUp size={16} />
                    Voorstel intrekken
                  </button>
                </div>
              )}
            </>
          )}

          {/* Logboek — alleen bij goedgekeurd */}
          {currentStatus === "goedgekeurd" && (
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
