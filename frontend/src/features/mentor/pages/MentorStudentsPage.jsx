import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../mentor.css";

function initialen(s) {
  const a = (s.voornaam || "").charAt(0);
  const b = (s.achternaam || "").charAt(0);
  return (a + b).toUpperCase() || "?";
}

function faseLabel(status) {
  if (status === "afgerond" || status === "voltooid") return "Afgerond";
  if (status === "in_aanvraag" || status === "aangevraagd") return "Niet gestart";
  return "Stage loopt";
}

function logboekBadge(status) {
  if (status === "ingediend") return { cls: "s-info", icon: "ti-clock", txt: "Ingediend" };
  if (status === "afgecheckt_door_mentor") return { cls: "s-ok", icon: "ti-check", txt: "Afgetekend" };
  if (status === "goedgekeurd_door_docent") return { cls: "s-ok", icon: "ti-check", txt: "Goedgekeurd" };
  if (status && status.includes("teruggestuurd")) return { cls: "s-rood", icon: "ti-arrow-back", txt: "Teruggestuurd" };
  return { cls: "s-grijs", icon: "", txt: "Geen" };
}

export default function MentorStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const res = await api.get("/mentor/students", {
        });
        setStudenten(res.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Studenten ophalen mislukt");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mtr">
      <div className="page-inner">
        <div className="page-header">
          <h1>Mijn stagiairs</h1>
          <p>Studenten die stage lopen onder jouw begeleiding</p>
        </div>

        {loading && (
          <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Stagiairs laden…</p></div>
        )}

        {error && (
          <div className="card"><span className="status s-rood">{error}</span></div>
        )}

        {!loading && !error && studenten.length === 0 && (
          <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen stagiairs gevonden.</p></div>
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
                          <div
                            style={{ fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                            onClick={() => navigate(`/mentor/dossier?student=${s.id}`)}
                          >
                            {s.voornaam} {s.achternaam}
                            <div style={{ fontSize: 11.5, fontWeight: 400, color: "var(--faint)" }}>{s.bedrijf || "-"}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: 12.5, color: "var(--sub)" }}>
                        <div style={{ whiteSpace: "nowrap" }}>{faseLabel(s.dossier_status)}</div>
                      </td>

                      <td style={{ cursor: "pointer" }} title="Open het logboek" onClick={() => navigate(`/mentor/logbooks?student=${s.id}`)}>
                        <span className={`status ${lb.cls}`}>
                          {lb.icon && <i className={`ti ${lb.icon}`} />}{lb.txt}
                        </span>
                      </td>

                      <td style={{ cursor: "pointer" }} title="Open de evaluatie" onClick={() => navigate(`/mentor/evaluation?student=${s.id}`)}>
                        <span className="status s-grijs">Bekijken</span>
                      </td>

                      <td>
                        {teControleren ? (
                          <span className="status s-rood"><span className="warn-mini">!</span>Logboek na te kijken</span>
                        ) : (
                          <span className="status s-ok"><i className="ti ti-check" />Niets te doen</span>
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
    </div>
  );
}
