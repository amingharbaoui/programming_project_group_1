import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentStudentsPage.css";
import { IconArrowRight, IconEye, IconRefresh, IconX } from "@tabler/icons-react";
import { cacheGet, cacheSet } from "../docentCache";

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
  if (AFGEROND_STATUSSEN.includes(s.dossier_status)) return { cls: "s_ok", txt: "Afgerond" };
  if (s.dossier_status === "document_afgekeurd") return { cls: "s_rood", txt: "Document afgekeurd" };
  if (s.actie_type === "evaluatie" || s.actie_type === "logboek") return { cls: "s_rood", txt: "Actie nodig" };
  if (s.actie_type === "planning") return { cls: "s_amber", txt: "Open" };
  if (!ACTIEF_STATUSSEN.includes(s.dossier_status)) return { cls: "s_grijs", txt: "Contractfase" };
  return { cls: "s_ok", txt: "In orde" };
}

export default function DocentStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("alle");
  const [zoek, setZoek] = useState("");

  async function loadStudenten(force = false) {
    try {
      setError("");
      if (!force) {
        const cached = cacheGet("docent_students");
        if (cached) { setStudenten(cached); setLoading(false); return; }
      }
      setLoading(true);
      const res = await api.get("/docent/students");
      const data = res.data.data || [];
      cacheSet("docent_students", data);
      setStudenten(data);
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

  const opActie =
    filter === "alle"
      ? studenten
      : filter === "actie"
      ? studenten.filter((s) => s.actie_type !== "geen")
      : studenten.filter((s) => s.actie_type === filter);

  const zoekTerm = zoek.trim().toLowerCase();
  const gefilterd = zoekTerm
    ? opActie.filter((s) =>
        `${s.voornaam} ${s.achternaam}`.toLowerCase().includes(zoekTerm) ||
        (s.bedrijf || "").toLowerCase().includes(zoekTerm)
      )
    : opActie;

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Mijn studenten</h1>
          <p>Overzicht van alle studenten die jij opvolgt als docent.</p>
        </div>
        <button className="btn primary" onClick={() => loadStudenten(true)}>
          <IconRefresh size={14} stroke={1.8} /> Vernieuwen
        </button>
      </div>

      <div className="doc_filters">
        <input
          className="doc_zoek"
          placeholder="Zoek op student of bedrijf..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="doc_select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
        {(filter !== "alle" || zoek) && (
          <button className="btn sm primary" onClick={() => { setFilter("alle"); setZoek(""); }}>
            <IconX size={16} stroke={1.8} /> Wis filters
          </button>
        )}
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="status s_rood">{error}</span>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="card"><p className="muted">Geen studenten gevonden voor dit filter.</p></div>
      )}

      {!loading && gefilterd.length > 0 && (
        <div className="card doc_students_card">
          <table className="doc_students_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Stagefase</th>
                <th>Eerstvolgende actie</th>
                <th>Deadline</th>
                <th>Voortgang</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((s) => {
                const status = getStatus(s);
                const pct = getVoortgang(s);
                const initialen = [s.voornaam, s.achternaam].filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                return (
                  <tr key={s.dossier_id}>
                    <td>
                      <div className="doc_student_cell">
                        <div className="doc_avatar">{initialen}</div>
                        <div className="doc_student_info">
                          <div className="doc_naam">{s.voornaam} {s.achternaam}</div>
                          <div className="doc_bedrijf">{s.bedrijf}</div>
                        </div>
                      </div>
                    </td>

                    <td className="doc_sub">{getStagefase(s)}</td>

                    <td>
                      {s.actie_type !== "geen" ? (
                        <span className="doc_actie_cell">
                          <span className="doc_actie_type">
                            {s.actie_type === "logboek" ? "Logboek" : s.actie_type === "evaluatie" ? "Evaluatie" : "Planning"}
                          </span>
                          {s.volgende_actie}
                        </span>
                      ) : (
                        <span className="muted">Geen open actie</span>
                      )}
                    </td>

                    <td className="doc_sub">{s.actie_type !== "geen" ? (formatDeadline(s.deadline) || "—") : "—"}</td>

                    <td style={{ minWidth: 120 }}>
                      <div className="doc_prog_row">
                        <div className="prog_wrap" style={{ flex: 1 }}><div className="prog_fill" style={{ width: `${pct}%` }} /></div>
                        <span className="doc_prog_pct">{pct}%</span>
                      </div>
                    </td>

                    <td><span className={`status ${status.cls}`}>{status.txt}</span></td>

                    <td style={{ textAlign: "right" }}>
                      <button className="btn sm" onClick={() => navigate(`/docent/students/${s.dossier_id}/dossier`)}>
                        {s.actie_type !== "geen" ? <IconArrowRight size={14} stroke={1.8} /> : <IconEye size={14} stroke={1.8} />}
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
  );
}
