import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

const FILTERS = ["Alle", "Lopend", "Niet gestart", "Afgerond"];

function getDossierFaseLabel(status) {
  if (!status) return "Onbekend";
  if (status === "actief") return "Lopend";
  if (status === "afgerond" || status === "voltooid") return "Afgerond";
  if (status === "in_aanvraag" || status === "aangevraagd") return "Niet gestart";
  return "Lopend";
}

function getDossierFaseClass(status) {
  if (status === "actief") return "s_ok";
  if (status === "afgerond" || status === "voltooid") return "s_info";
  return "s_grijs";
}

function getLogboekClass(status) {
  if (status === "ingediend") return "s_info";
  if (status === "afgecheckt_door_mentor") return "s_amber";
  if (status === "goedgekeurd_door_docent") return "s_ok";
  if (status?.includes("teruggestuurd")) return "s_rood";
  return "s_grijs";
}

function getLogboekLabel(status) {
  if (status === "ingediend") return "Ingediend";
  if (status === "afgecheckt_door_mentor") return "Wacht op docent";
  if (status === "goedgekeurd_door_docent") return "Goedgekeurd";
  if (status?.includes("teruggestuurd")) return "Teruggestuurd";
  if (!status || status === "geen") return "Geen";
  return status || "-";
}

function formatDeadline(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DocentStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Alle");

  async function loadStudenten() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/students", {
        headers: { "x-user-id": String(user.id) },
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

  const gefilterd =
    filter === "Alle"
      ? studenten
      : studenten.filter(
          (s) => getDossierFaseLabel(s.dossier_status) === filter
        );

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Mijn studenten</h1>
          <p>Overzicht van alle studenten die jij opvolgt als docent.</p>
        </div>
        <button className="btn sm" onClick={loadStudenten}>
          Vernieuwen
        </button>
      </div>

      {/* Filter chips */}
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${filter === f ? " actief" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
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
          <span className="status s_rood">{error}</span>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="empty_state">Geen studenten gevonden voor dit filter.</div>
      )}

      {!loading && gefilterd.length > 0 && (
        <div className="card">
          <div className="card_title">Studenten ({gefilterd.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Mentor</th>
                <th>Logboek</th>
                <th>Fase</th>
                <th>Volgende actie</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((s) => (
                <tr key={s.dossier_id}>
                  <td>
                    <strong>
                      {s.voornaam} {s.achternaam}
                    </strong>
                    <br />
                    <span className="muted">{s.studentennummer}</span>
                  </td>

                  <td>{s.bedrijf || "-"}</td>

                  <td>
                    {s.mentor_voornaam
                      ? `${s.mentor_voornaam} ${s.mentor_achternaam}`
                      : "-"}
                  </td>

                  <td>
                    <span className={`status ${getLogboekClass(s.logboek_status)}`}>
                      {getLogboekLabel(s.logboek_status)}
                    </span>
                  </td>

                  <td>
                    <span className={`status ${getDossierFaseClass(s.dossier_status)}`}>
                      {getDossierFaseLabel(s.dossier_status)}
                    </span>
                  </td>

                  <td>
                    {s.volgende_actie ? (
                      <>
                        <span>{s.volgende_actie}</span>
                        {(s.deadline || s.actie_deadline) && (
                          <>
                            <br />
                            <span className="muted" style={{ fontSize: "12px" }}>
                              tegen {formatDeadline(s.deadline || s.actie_deadline)}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>

                  <td className="right">
                    <div className="actions">
                      <button className="btn sm" onClick={() => navigate("/docent/logbooks")}>Logboek</button>
                      <button className="btn sm" onClick={() => navigate("/docent/evaluations")}>Evaluatie</button>
                      <button className="btn sm primary" onClick={() => navigate(`/docent/students/${s.dossier_id}/dossier`)}>Dossier</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
