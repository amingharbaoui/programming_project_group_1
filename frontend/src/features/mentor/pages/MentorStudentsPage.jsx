import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import "./MentorStudentsPage.css";
import { cacheGet, cacheSet } from "../mentorCache";

function initialen(s) {
  const a = (s.voornaam || "").charAt(0);
  const b = (s.achternaam || "").charAt(0);
  return (a + b).toUpperCase() || "?";
}

function faseSub(status) {
  if (status === "wacht_op_student" || status === "wacht_op_bedrijf") return "Stageovereenkomst";
  if (status === "in_controle_bij_administratie") return "Stageovereenkomst";
  if (status === "geregistreerd") return "Voorbereiding — startklaar";
  if (status === "actief" || status === "stage_loopt") return "Stage loopt";
  if (status === "afgerond" || status === "voltooid" || status === "resultaat_vrijgegeven") return "Afgerond";
  return "—";
}

function voortgangPct(s) {
  const stageLoopt = ["actief", "stage_loopt"].includes(s.dossier_status);
  if (!stageLoopt || !s.aantal_weken) return null;
  const gedaan = s.weken_gedaan ?? Math.round(s.aantal_weken * 0.6); // fallback
  return Math.min(100, Math.round((gedaan / s.aantal_weken) * 100));
}

function logboekBadge(status) {
  if (status === "ingediend") return { cls: "s_rood", icon: "ti-hourglass", txt: "Af te checken" };
  if (status === "afgecheckt_door_mentor") return { cls: "s_ok", icon: "ti-checks", txt: "Afgecheckt" };
  if (status === "goedgekeurd_door_docent") return { cls: "s_ok", icon: "ti-checks", txt: "Goedgekeurd" };
  if (status && status.includes("teruggestuurd")) return { cls: "s_amber", icon: "ti-hourglass", txt: "Teruggestuurd" };
  if (status === "in_opbouw") return { cls: "s_info", icon: "ti-pencil", txt: "In opbouw" };
  return { cls: "s_grijs", icon: "", txt: "Nog niet gestart" };
}

function evalBadge(dossierStatus) {
  if (["actief", "stage_loopt"].includes(dossierStatus)) return { cls: "s_grijs", icon: "ti-lock", txt: "Nog niet open" };
  if (dossierStatus === "resultaat_vrijgegeven") return { cls: "s_ok", icon: "ti-award", txt: "Afgerond" };
  if (["afgerond", "voltooid"].includes(dossierStatus)) return { cls: "s_ok", icon: "ti-check", txt: "Ingediend" };
  return { cls: "s_grijs", icon: "ti-lock", txt: "Nog niet open" };
}

function eersteActie(s) {
  if (s.logboek_status === "ingediend") return "Logboek af te checken";
  const ds = s.dossier_status;
  if (ds === "wacht_op_bedrijf") return "Stageovereenkomst ondertekenen";
  if (ds === "geregistreerd") return "Praktische afspraken delen";
  return null;
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

      {loading && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Stagiairs laden…</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}
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
                const eb = evalBadge(s.dossier_status);
                const actie = eersteActie(s);
                const pct = voortgangPct(s);
                return (
                  <tr key={s.dossier_id ?? s.id}>
                    {/* Student */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className="prof-av" style={{ width: 30, height: 30, fontSize: 11 }}>{initialen(s)}</div>
                        <div
                          style={{ fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                          onClick={() => navigate(`/mentor/dossier?student=${s.id}`)}
                        >
                          {s.voornaam} {s.achternaam}
                        </div>
                      </div>
                    </td>

                    {/* Fase + voortgangsbalk */}
                    <td style={{ fontSize: 12.5, color: "var(--sub)" }}>
                      <div style={{ whiteSpace: "nowrap" }}>{faseSub(s.dossier_status)}</div>
                      {pct !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                          <div className="prog-wrap" style={{ flex: 1, maxWidth: 120 }}>
                            <div className="prog-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span style={{ fontSize: 11, color: "var(--faint)", minWidth: 30 }}>{pct}%</span>
                        </div>
                      )}
                    </td>

                    {/* Logboek — klikbaar */}
                    <td
                      style={{ cursor: "pointer" }}
                      title="Open het logboek"
                      onClick={() => navigate(`/mentor/logbooks?student=${s.id}`)}
                    >
                      <span className={`status ${lb.cls}`}>
                        {lb.icon && <i className={`ti ${lb.icon}`} />}{lb.txt}
                      </span>
                    </td>

                    {/* Evaluatie — klikbaar */}
                    <td
                      style={{ cursor: "pointer" }}
                      title="Open de evaluatie"
                      onClick={() => navigate(`/mentor/evaluation?student=${s.id}`)}
                    >
                      <span className={`status ${eb.cls}`}>
                        {eb.icon && <i className={`ti ${eb.icon}`} />}{eb.txt}
                      </span>
                    </td>

                    {/* Actie */}
                    <td>
                      {actie ? (
                        <span className="status s_rood">
                          <span className="warn-mini">!</span>{actie}
                        </span>
                      ) : (
                        <span className="status s_ok"><i className="ti ti-check" />Niets te doen</span>
                      )}
                    </td>

                    {/* Knop */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn sm"
                        onClick={() => actie
                          ? navigate(`/mentor/dossier?student=${s.id}`)
                          : navigate(`/mentor/dossier?student=${s.id}`)
                        }
                      >
                        {actie ? "Ga" : "Open dossier"} <i className="ti ti-chevron-right" />
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
