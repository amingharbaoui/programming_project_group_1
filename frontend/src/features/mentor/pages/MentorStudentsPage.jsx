import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorStudentsPage.css";
import { cacheGet, cacheSet } from "../mentorCache";

function initialen(s) {
  const a = (s.voornaam || "").charAt(0);
  const b = (s.achternaam || "").charAt(0);
  return (a + b).toUpperCase() || "?";
}

// Volledige statuslijst uit het schema — niet langer alles vóór stage_loopt
// als "Stage loopt" tonen, dat klopte niet voor wacht_op_student/-bedrijf/
// in_controle_bij_administratie/document_afgekeurd/geregistreerd.
function faseLabel(status) {
  if (status === "afgerond" || status === "voltooid" || status === "resultaat_vrijgegeven") return "Afgerond";
  if (status === "actief" || status === "stage_loopt") return "Stage loopt";
  if (status === "geregistreerd") return "Geregistreerd — startklaar";
  if (status === "document_afgekeurd") return "Document afgekeurd";
  if (status === "in_controle_bij_administratie") return "In controle bij administratie";
  if (status === "wacht_op_bedrijf") return "Wacht op ondertekening";
  if (status === "wacht_op_student") return "Wacht op student";
  return "Niet gestart";
}

function logboekBadge(status) {
  if (status === "ingediend") return { cls: "s_info", icon: "ti-clock", txt: "Ingediend" };
  if (status === "afgecheckt_door_mentor") return { cls: "s_ok", icon: "ti-check", txt: "Afgetekend" };
  if (status === "goedgekeurd_door_docent") return { cls: "s_ok", icon: "ti-check", txt: "Goedgekeurd" };
  if (status && status.includes("teruggestuurd")) return { cls: "s_rood", icon: "ti-arrow-back", txt: "Teruggestuurd" };
  return { cls: "s_grijs", icon: "", txt: "Geen" };
}

export default function MentorStudentsPage() {
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const cached = cacheGet("mentor_students");
      if (cached) { setStudenten(cached); setLoading(false); return; }
      try {
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        cacheSet("mentor_students", data);
        setStudenten(data);
      } catch (err) {
        setError(err.response?.data?.message || "Studenten ophalen mislukt");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Mijn stagiairs</h1>
        <p>Studenten die stage lopen onder jouw begeleiding</p>
      </div>

      {loading && (
        <div className="card"><p className="muted">Stagiairs laden…</p></div>
      )}

      {error && (
        <div className="card"><span className="status s_rood">{error}</span></div>
      )}

      {!loading && !error && studenten.length === 0 && (
        <div className="card"><p className="muted">Geen stagiairs gevonden.</p></div>
      )}

      {!loading && !error && studenten.length > 0 && (
        <div className="card" style={{ padding: "6px 14px" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Fase</th>
                <th>Logboek</th>
                <th>Evaluatie</th>
                <th>Actie</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {studenten.map((s) => {
                const lb = logboekBadge(s.logboek_status);
                const teControleren = s.logboek_status === "ingediend";
                return (
                  <tr key={s.dossier_id ?? s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className="prof-av" style={{ width: 30, height: 30, fontSize: 11 }}>{initialen(s)}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          {s.voornaam} {s.achternaam}
                          <div style={{ fontSize: 11.5, fontWeight: 400, color: "var(--faint)" }}>{s.bedrijf || "-"}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ fontSize: 12.5, color: "var(--sub)" }}>
                      <div style={{ whiteSpace: "nowrap" }}>{faseLabel(s.dossier_status)}</div>
                    </td>

                    <td>
                      <span className={`status ${lb.cls}`}>
                        {lb.icon && <i className={`ti ${lb.icon}`} />}{lb.txt}
                      </span>
                    </td>

                    <td>
                      <span className="status s_grijs">Bekijken</span>
                    </td>

                    <td>
                      {teControleren ? (
                        <span className="status s_rood"><span className="warn-mini">!</span>Logboek na te kijken</span>
                      ) : (
                        <span className="status s_ok"><i className="ti ti-check" />Niets te doen</span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button className="btn sm" onClick={() => navigate(`/mentor/dossier?student=${s.id}`)}>
                        Open dossier <i className="ti ti-chevron-right" />
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
