import { useEffect, useState } from "react";
import api from "../../../services/api";

export default function MentorLogbooksPage() {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Per week houden we apart feedback bij.
  const [feedbackByWeek, setFeedbackByWeek] = useState({});

  // Hiermee blokkeren we tijdelijk de knop terwijl de backend bezig is.
  const [actionLoadingId, setActionLoadingId] = useState(null);

  async function loadLogbooks() {
    try {
      setLoading(true);
      setError("");

      // Demo: student 1 heeft normaal een stagedossier en logboek.
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
    if (status === "ingediend") return "s_info";
    if (status === "afgecheckt_door_mentor") return "s_ok";
    if (status === "goedgekeurd_door_docent") return "s_ok";
    if (status?.includes("teruggestuurd")) return "s_rood";
    return "s_grijs";
  }

  async function checkWeek(weekId, herindieningNodig = false) {
    try {
      setActionLoadingId(weekId);

      // Deze call stuurt mentorfeedback naar de backend.
      await api.patch(
        `/mentor/logbooks/${weekId}/check`,
        {
          feedback: feedbackByWeek[weekId] || "Week nagekeken door mentor.",
          herindieningNodig,
        },
        {
          headers: {
            // Demo-user: mentor heeft id 4.
            "x-user-id": "4",
          },
        }
      );

      // Na opslaan halen we opnieuw data op zodat status/feedback refreshen.
      await loadLogbooks();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Mentorcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="page_inner">
      <div className="page_header">
        <h1>Mentor logboeken</h1>
        <p>Bekijk weeklogboeken en check ze af.</p>
      </div>

      <button className="btn primary" onClick={loadLogbooks}>
        Vernieuwen
      </button>

      {loading && <div className="card"><p className="muted">Logboeken laden...</p></div>}

      {error && <div className="card"><span className="status s_rood">{error}</span></div>}

      {!loading && !error && weeks.length === 0 && (
        <div className="empty_state">Geen logboeken gevonden.</div>
      )}

      {!loading && !error && weeks.map((week) => (
        <div className="card" key={week.id}>
          <div className="card_title">Week {week.week_nummer}</div>

          <div className="kv">
            <span className="k">Periode</span>
            <span className="v">{formatDate(week.week_start)} - {formatDate(week.week_einde)}</span>
          </div>

          <div className="kv">
            <span className="k">Status</span>
            <span className={`status ${getStatusClass(week.status)}`}>{week.status}</span>
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

          <div className="form_group" style={{ marginTop: "14px" }}>
            <label className="form_label">Feedback mentor</label>
            <textarea
              className="form_textarea"
              placeholder="Geef korte feedback op deze week..."
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
              onClick={() => checkWeek(week.id, true)}
            >
              Aanpassing vragen
            </button>

            <button
              className="btn primary"
              disabled={actionLoadingId === week.id}
              onClick={() => checkWeek(week.id, false)}
            >
              Week afchecken
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}