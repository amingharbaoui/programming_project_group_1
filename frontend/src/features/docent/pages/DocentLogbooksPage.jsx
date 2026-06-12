import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

// Demo studenten die gekoppeld kunnen zijn aan een docent.
// De backend beslist zelf of de ingelogde docent toegang heeft.
const DEMO_STUDENTEN = [
  { id: 1, naam: "Demo Student" },
  { id: 6, naam: "Demo Student 2" },
  { id: 7, naam: "Demo Student 3" },
  { id: 8, naam: "Demo Student 4" },
];

function getStatusClass(status) {
  if (status === "goedgekeurd_door_docent") return "s_ok";
  if (status === "afgecheckt_door_mentor") return "s_info";
  if (status === "ingediend") return "s_info";
  if (status?.includes("teruggestuurd")) return "s_rood";
  return "s_grijs";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

export default function DocentLogbooksPage() {
  const { user } = useAuth();

  const [studentId, setStudentId] = useState(1);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [feedbackByWeek, setFeedbackByWeek] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  async function loadLogbooks(sid) {
    try {
      setLoading(true);
      setError("");
      setWeeks([]);
      const response = await api.get(`/docent/logbooks/${sid}`, {
        headers: { "x-user-id": String(user.id) },
      });
      setWeeks(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Logboeken ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogbooks(studentId);
  }, []);

  function handleStudentChange(e) {
    const newId = Number(e.target.value);
    setStudentId(newId);
    setFeedbackByWeek({});
    loadLogbooks(newId);
  }

  async function reviewWeek(weekId, herindieningNodig = false) {
    try {
      setActionLoadingId(weekId);

      // Geen hardcoded x-user-id — de api instantie gebruikt automatisch
      // de ingelogde gebruiker (ingesteld via AuthContext/setApiUserId).
      await api.patch(`/docent/logbooks/${weekId}/review`, {
        feedback: feedbackByWeek[weekId] || "Logboek nagekeken door docent.",
        herindieningNodig,
      }, {
        headers: { "x-user-id": String(user.id) },
      });

      await loadLogbooks(studentId);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Docentcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Docent logboeken</h1>
          <p>Bekijk logboeken, mentorfeedback en geef docentfeedback.</p>
        </div>
        <button className="btn sm" onClick={() => loadLogbooks(studentId)}>
          Vernieuwen
        </button>
      </div>

      {/* Student selector */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div className="card_title">Student kiezen</div>
        <div className="form_group">
          <label className="form_label">Student</label>
          <select
            className="form_input"
            value={studentId}
            onChange={handleStudentChange}
          >
            {DEMO_STUDENTEN.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam} (ID {s.id})
              </option>
            ))}
          </select>
        </div>
        <p className="muted">
          Ingelogd als: <strong>{user?.name}</strong> (ID {user?.id})
        </p>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Logboeken laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="status s_rood">{error}</span>
        </div>
      )}

      {!loading && !error && weeks.length === 0 && (
        <div className="empty_state">Geen logboeken gevonden voor deze student.</div>
      )}

      {!loading && !error && weeks.map((week) => (
        <div className="card" key={week.id}>
          <div className="card_title">Week {week.week_nummer}</div>

          <div className="kv">
            <span className="k">Periode</span>
            <span className="v">{formatDate(week.week_start)} – {formatDate(week.week_einde)}</span>
          </div>

          <div className="kv">
            <span className="k">Status</span>
            <span className={`status ${getStatusClass(week.status)}`}>{week.status}</span>
          </div>

          <div className="kv">
            <span className="k">Mentorfeedback</span>
            <span className="v">{week.mentor_feedback || "Nog geen feedback van mentor"}</span>
          </div>

          {week.docent_feedback && (
            <div className="kv">
              <span className="k">Jouw feedback</span>
              <span className="v">{week.docent_feedback}</span>
            </div>
          )}

          <table className="tbl" style={{ marginTop: "12px" }}>
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

          <div className="form_group" style={{ marginTop: "14px" }}>
            <label className="form_label">Feedback docent</label>
            <textarea
              className="form_textarea"
              placeholder="Geef feedback als docent..."
              value={feedbackByWeek[week.id] || ""}
              onChange={(e) =>
                setFeedbackByWeek({ ...feedbackByWeek, [week.id]: e.target.value })
              }
            />
          </div>

          <div className="actions" style={{ marginTop: "8px" }}>
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
