import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

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
  if (status === "afgecheckt_door_mentor") return "s_ok";
  if (status === "goedgekeurd_door_docent") return "s_ok";
  if (status?.includes("teruggestuurd")) return "s_rood";
  if (!status || status === "geen") return "s_grijs";
  return "s_grijs";
}

function getLogboekLabel(status) {
  if (status === "ingediend") return "Ingediend";
  if (status === "afgecheckt_door_mentor") return "Afgetekend";
  if (status === "goedgekeurd_door_docent") return "Goedgekeurd";
  if (status?.includes("teruggestuurd")) return "Teruggestuurd";
  if (!status || status === "geen") return "Geen";
  return status;
}

export default function MentorStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStudenten() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/mentor/students", {
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
    async function init() {
      try {
        const res = await api.get("/mentor/students", {
          headers: { "x-user-id": String(user.id) },
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
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Mijn stagiairs</h1>
          <p>Overzicht van alle studenten die jij begeleidt.</p>
        </div>
        <button className="btn sm" onClick={loadStudenten}>
          Vernieuwen
        </button>
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

      {!loading && !error && studenten.length === 0 && (
        <div className="empty_state">Geen stagiairs gevonden.</div>
      )}

      {!loading && studenten.length > 0 && (
        <div className="card">
          <div className="card_title">Stagiairs ({studenten.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Fase</th>
                <th>Logboek</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {studenten.map((s) => (
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
                    <span className={`status ${getDossierFaseClass(s.dossier_status)}`}>
                      {getDossierFaseLabel(s.dossier_status)}
                    </span>
                  </td>

                  <td>
                    <span className={`status ${getLogboekClass(s.logboek_status)}`}>
                      {getLogboekLabel(s.logboek_status)}
                    </span>
                  </td>

                  <td className="right">
                    <div className="actions">
                      <button className="btn sm" onClick={() => navigate(`/mentor/logbooks?student=${s.id}`)}>Logboek</button>
                      <button className="btn sm" onClick={() => navigate(`/mentor/evaluation?student=${s.id}`)}>Evaluatie</button>
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
