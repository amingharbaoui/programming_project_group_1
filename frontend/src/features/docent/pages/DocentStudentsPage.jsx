import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../docent.css";

// Filterchips op actietype — zelfde indeling als het HTML-prototype (renderStudentenPage).
const FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "actie", label: "Actie nodig" },
  { key: "logboek", label: "Logboeken" },
  { key: "evaluatie", label: "Evaluaties" },
  { key: "planning", label: "Planning" },
  { key: "geen", label: "Geen actie" },
];

const ACTIEF_STATUSSEN = ["actief", "stage_loopt"];
const AFGEROND_STATUSSEN = ["afgerond", "voltooid", "resultaat_vrijgegeven"];

// Volledige status-lijst uit het schema: wacht_op_student, wacht_op_bedrijf,
// in_controle_bij_administratie, document_afgekeurd, geregistreerd, stage_loopt,
// resultaat_vrijgegeven, afgerond. Elke status krijgt een eigen, juiste label —
// niet langer alles vóór "stage_loopt" op één hoop "wacht op ondertekening".
const VOOR_STAGE_LABELS = {
  wacht_op_student: "Contract — wacht op student",
  wacht_op_bedrijf: "Contract — wacht op ondertekening",
  in_controle_bij_administratie: "Contract — in controle bij administratie",
  document_afgekeurd: "Contract — document afgekeurd",
  geregistreerd: "Geregistreerd — startklaar",
};

function formatDeadline(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Huidige stageweek afleiden uit startdatum + vandaag, geclamped op 1..aantal_weken.
function huidigeWeek(startdatum, aantalWeken) {
  if (!startdatum || !aantalWeken) return 0;
  const start = new Date(startdatum);
  const vandaag = new Date();
  const dagen = Math.floor((vandaag - start) / (1000 * 60 * 60 * 24));
  if (dagen < 0) return 0;
  return Math.max(1, Math.min(aantalWeken, Math.floor(dagen / 7) + 1));
}

function getStagefase(s) {
  if (AFGEROND_STATUSSEN.includes(s.dossier_status)) return "Afgerond";
  if (ACTIEF_STATUSSEN.includes(s.dossier_status)) {
    const wk = huidigeWeek(s.startdatum, s.aantal_weken);
    return wk > 0 ? `Week ${wk}/${s.aantal_weken}` : `Start ${formatDeadline(s.startdatum) || ""}`;
  }
  return VOOR_STAGE_LABELS[s.dossier_status] || s.dossier_status || "Onbekend";
}

function getVoortgang(s) {
  if (AFGEROND_STATUSSEN.includes(s.dossier_status)) return 100;
  if (ACTIEF_STATUSSEN.includes(s.dossier_status) && s.aantal_weken) {
    const wk = huidigeWeek(s.startdatum, s.aantal_weken);
    return Math.round((wk / s.aantal_weken) * 100);
  }
  return 0;
}

function getStatus(s) {
  if (AFGEROND_STATUSSEN.includes(s.dossier_status)) return { cls: "s-ok", txt: "Afgerond" };
  if (s.dossier_status === "document_afgekeurd") return { cls: "s-rood", txt: "Document afgekeurd" };
  if (s.actie_type === "evaluatie" || s.actie_type === "logboek") return { cls: "s-rood", txt: "Actie nodig" };
  if (s.actie_type === "planning") return { cls: "s-amber", txt: "Open" };
  if (!ACTIEF_STATUSSEN.includes(s.dossier_status)) return { cls: "s-grijs", txt: "Contractfase" };
  return { cls: "s-ok", txt: "In orde" };
}

export default function DocentStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("alle");

  async function loadStudenten() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/students", {
      });
      setStudenten(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Studenten ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudenten();
  }, []);

  const aantallen = {
    alle: studenten.length,
    actie: studenten.filter((s) => s.actie_type !== "geen").length,
    logboek: studenten.filter((s) => s.actie_type === "logboek").length,
    evaluatie: studenten.filter((s) => s.actie_type === "evaluatie").length,
    planning: studenten.filter((s) => s.actie_type === "planning").length,
    geen: studenten.filter((s) => s.actie_type === "geen").length,
  };

  const gefilterd =
    filter === "alle"
      ? studenten
      : filter === "actie"
      ? studenten.filter((s) => s.actie_type !== "geen")
      : studenten.filter((s) => s.actie_type === filter);

  return (
    <div className="doc">
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Mijn studenten</h1>
          <p>Overzicht van alle studenten die jij opvolgt als docent.</p>
        </div>
        <button className="btn sm" onClick={loadStudenten}>
          Vernieuwen
        </button>
      </div>

      {/* Filter chips — op actietype, zoals het prototype */}
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip${filter === f.key ? " aan" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({aantallen[f.key]})
          </button>
        ))}
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="status s-rood">{error}</span>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="card"><p className="muted">Geen studenten gevonden voor dit filter.</p></div>
      )}

      {!loading && gefilterd.length > 0 && (
        <div className="card" style={{ padding: "6px 14px" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Stagefase</th>
                <th>Eerstvolgende actie</th>
                <th>Deadline</th>
                <th>Voortgang</th>
                <th>Status</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((s) => {
                const status = getStatus(s);
                const pct = getVoortgang(s);
                return (
                  <tr key={s.dossier_id}>
                    <td>
                      <strong>{s.voornaam} {s.achternaam}</strong>
                      <br />
                      <span className="muted">{s.bedrijf}</span>
                    </td>

                    <td style={{ fontSize: 12.5, color: "var(--sub)", whiteSpace: "nowrap" }}>
                      {getStagefase(s)}
                    </td>

                    <td style={{ fontSize: 12.5 }}>
                      {s.actie_type !== "geen" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".3px", textTransform: "uppercase", color: "var(--faint)" }}>
                            {s.actie_type === "logboek" ? "Logboek" : s.actie_type === "evaluatie" ? "Evaluatie" : "Planning"}
                          </span>
                          {s.volgende_actie}
                        </span>
                      ) : (
                        <span className="muted">Geen open actie</span>
                      )}
                    </td>

                    <td style={{ fontSize: 12, color: "var(--sub)", whiteSpace: "nowrap" }}>
                      {s.actie_type !== "geen" ? (formatDeadline(s.deadline) || "—") : "—"}
                    </td>

                    <td style={{ minWidth: 110 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="prog-wrap" style={{ flex: 1 }}><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontSize: 11, color: "var(--sub)", minWidth: 30 }}>{pct}%</span>
                      </div>
                    </td>

                    <td><span className={`status ${status.cls}`}>{status.txt}</span></td>

                    <td className="right">
                      <button className="btn sm" onClick={() => navigate(`/docent/students/${s.dossier_id}/dossier`)}>
                        <i className={`ti ti-${s.actie_type !== "geen" ? "arrow-right" : "eye"}`} />
                        {s.actie_type !== "geen" ? "Openen" : "Bekijken"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}
