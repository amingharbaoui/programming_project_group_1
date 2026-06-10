import { useEffect, useState } from "react";
import api from "../../../services/api";

export default function MentorLogbooksPage() {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogbooks() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/mentor/logbooks/1");
      setWeeks(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Logboeken ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogbooks();
  }, []);

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("nl-BE");
  }

  function getStatusClass(status) {
    if (status === "ingediend") return "s-info";
    if (status === "afgecheckt_door_mentor") return "s-ok";
    if (status === "goedgekeurd_door_docent") return "s-ok";
    if (status?.includes("teruggestuurd")) return "s-rood";
    return "s-grijs";
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Mentor logboeken</h1>
        <p>Bekijk de ingediende weeklogboeken van de student.</p>
      </div>

      <button className="btn primary" onClick={loadLogbooks}>
        Vernieuwen
      </button>

      {loading && (
        <div className="card">
          <p className="muted">Logboeken laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="status s-rood">{error}</span>
        </div>
      )}

      {!loading && !error && weeks.length === 0 && (
        <div className="empty-state">
          Geen logboeken gevonden.
        </div>
      )}

      {!loading && !error && weeks.map((week) => (
        <div className="card" key={week.id}>
          <div className="card-title">
            Week {week.week_nummer}
          </div>

          <div className="kv">
            <span className="k">Periode</span>
            <span className="v">
              {formatDate(week.week_start)} - {formatDate(week.week_einde)}
            </span>
          </div>

          <div className="kv">
            <span className="k">Status</span>
            <span className={`status ${getStatusClass(week.status)}`}>
              {week.status}
            </span>
          </div>

          <div className="kv">
            <span className="k">Totaal uren</span>
            <span className="v">{week.totaal_uren || 0}</span>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Titel</th>
                <th>Taken</th>
                <th>Reflectie</th>
                <th>Uren</th>
              </tr>
            </thead>

            <tbody>
              {(week.dagen || []).map((day) => (
                <tr key={day.id}>
                  <td>{formatDate(day.datum)}</td>
                  <td>{day.titel || "-"}</td>
                  <td>{day.uitgevoerde_taken || "-"}</td>
                  <td>{day.reflectie || "-"}</td>
                  <td>{day.aantal_uren || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}