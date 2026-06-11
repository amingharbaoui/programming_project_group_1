import { useEffect, useState } from "react";
import api from "../../../services/api";

export default function DocentLogbooksPage() {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // feedback per week
  const [feedbackByWeek, setFeedbackByWeek] = useState({});

  // knop blokkeren tijdens opslaan
  const [actionLoadingId, setActionLoadingId] = useState(null);

  async function loadLogbooks() {
    try {
      setLoading(true);
      setError("");

      // logboeken ophalen
      const response = await api.get("/docent/logbooks/1");
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
    if (status === "goedgekeurd_door_docent") return "s-ok";
    if (status === "afgecheckt_door_mentor") return "s-info";
    if (status === "ingediend") return "s-info";
    if (status?.includes("teruggestuurd")) return "s-rood";
    return "s-grijs";
  }

  async function reviewWeek(weekId, herindieningNodig = false) {
    try {
      setActionLoadingId(weekId);

      // feedback opslaan
      await api.patch(
        `/docent/logbooks/${weekId}/review`,
        {
          feedback: feedbackByWeek[weekId] || "Logboek nagekeken door docent.",
          herindieningNodig,
        },
        {
          headers: {
            "x-user-id": "5",
          },
        }
      );

      // status opnieuw ophalen
      await loadLogbooks();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Docentcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Docent logboeken</h1>
        <p>Bekijk logboeken, mentorfeedback en geef docentfeedback.</p>
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
          <div className="card-title">Week {week.week_nummer}</div>

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
            <span className="k">Mentorfeedback</span>
            <span className="v">{week.mentor_feedback || "Nog geen feedback"}</span>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Titel</th>
                <th>Taken</th>
                <th>Reflectie</th>
                <th>Problemen</th>
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
                  <td>{day.problemen || "-"}</td>
                  <td>{day.aantal_uren || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="form-group" style={{ marginTop: "14px" }}>
            <label className="form-label">Feedback docent</label>

            <textarea
              className="form-textarea"
              placeholder="Geef feedback als docent..."
              value={feedbackByWeek[week.id] || ""}
              onChange={(e) =>
                setFeedbackByWeek({
                  ...feedbackByWeek,
                  [week.id]: e.target.value,
                })
              }
            />
          </div>

          <div className="actions">
            <button
              className="btn"
              disabled={actionLoadingId === week.id}
              onClick={() => reviewWeek(week.id, true)}
            >
              Aanpassing vragen
            </button>

            <button
              className="btn primary"
              disabled={actionLoadingId === week.id}
              onClick={() => reviewWeek(week.id, false)}
            >
              Nagekeken
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}