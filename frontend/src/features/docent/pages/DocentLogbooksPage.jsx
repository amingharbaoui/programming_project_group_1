import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../docent.css";

function getStatusClass(status) {
  if (status === "goedgekeurd_door_docent") return "s-ok";
  if (status === "afgecheckt_door_mentor") return "s-info";
  if (status === "ingediend") return "s-info";
  if (status?.includes("teruggestuurd")) return "s-rood";
  return "s-grijs";
}

function getStatusLabel(status) {
  if (status === "goedgekeurd_door_docent") return "Goedgekeurd door docent";
  if (status === "afgecheckt_door_mentor") return "Afgecheckt door mentor";
  if (status === "ingediend") return "Ingediend door student";
  if (status === "teruggestuurd_door_docent") return "Teruggestuurd door docent";
  if (status === "teruggestuurd_door_mentor") return "Teruggestuurd door mentor";
  if (status === "in_opbouw") return "In opbouw";
  return status || "-";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

export default function DocentLogbooksPage() {
  const { user } = useAuth();

  const [studenten, setStudenten] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [feedbackByWeek, setFeedbackByWeek] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [remindLoading, setRemindLoading] = useState(false);
  const [remindMelding, setRemindMelding] = useState({ weekNr: null, tekst: "", type: "" });

  // Laad studenten van API
  useEffect(() => {
    async function loadStudenten() {
      try {
        const res = await api.get("/docent/students", {
        });
        const data = res.data.data || [];
        setStudenten(data);
        if (data.length > 0) {
          const sid = data[0].student_id || data[0].id;
          setStudentId(sid);
          loadLogbooks(sid);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    }
    loadStudenten();
  }, []);

  async function loadLogbooks(sid) {
    try {
      setLoading(true);
      setError("");
      setWeeks([]);
      const response = await api.get(`/docent/logbooks/${sid}`, {
      });
      setWeeks(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Logboeken ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  function handleStudentChange(e) {
    const newId = Number(e.target.value);
    setStudentId(newId);
    setFeedbackByWeek({});
    setRemindMelding({ weekNr: null, tekst: "", type: "" });
    loadLogbooks(newId);
  }

  async function reviewWeek(weekId, herindieningNodig = false) {
    try {
      setActionLoadingId(weekId);
      await api.patch(`/docent/logbooks/${weekId}/review`, {
        feedback: feedbackByWeek[weekId] || "Logboek nagekeken door docent.",
        herindieningNodig,
      }, {
      });
      await loadLogbooks(studentId);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Docentcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleHerinner(weekNr) {
    try {
      setRemindLoading(true);
      setRemindMelding({ weekNr: null, tekst: "", type: "" });
      await api.post(`/docent/logbooks/${studentId}/remind`, { weken: weekNr ? [weekNr] : [] }, {
      });
      setRemindMelding({ weekNr, tekst: "Herinnering verstuurd naar student.", type: "s-ok" });
    } catch (err) {
      setRemindMelding({
        weekNr,
        tekst: err.response?.data?.message || "Herinnering versturen mislukt.",
        type: "s-rood",
      });
    } finally {
      setRemindLoading(false);
    }
  }

  const geselecteerdeStudent = studenten.find(
    (s) => (s.student_id || s.id) === studentId
  );

  // Bereken ontbrekende weeknummers: alle weken 1..aantal_weken die nog niet (volledig) bestaan.
  function getOntbrekendeWeken(weeks) {
    const ingevuld = new Set(
      weeks.filter((w) => w.status && w.status !== "ontbreekt").map((w) => w.week_nummer)
    );
    // Totaal verwachte weken: uit de stage (aantal_weken), met fallback op de hoogste ingediende week.
    const totaal = Number(geselecteerdeStudent?.aantal_weken)
      || (weeks.length > 0 ? Math.max(...weeks.map((w) => w.week_nummer)) : 0);
    const ontbrekend = [];
    for (let n = 1; n <= totaal; n++) {
      if (!ingevuld.has(n)) ontbrekend.push(n);
    }
    return ontbrekend;
  }

  const ontbrekendeWeken = getOntbrekendeWeken(weeks);

  // Combineer bestaande weken + ontbrekende, gesorteerd aflopend
  const alleWeken = [
    ...weeks.map((w) => ({ ...w, ontbreekt: false })),
    ...ontbrekendeWeken.map((n) => ({ week_nummer: n, ontbreekt: true })),
  ].sort((a, b) => b.week_nummer - a.week_nummer);

  return (
    <div className="doc">
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Logboeken</h1>
          <p>Bekijk logboeken, mentorfeedback en geef docentfeedback.</p>
        </div>
        <button className="btn sm" onClick={() => studentId && loadLogbooks(studentId)}>
          Vernieuwen
        </button>
      </div>

      {/* Student selector */}
      {studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <div className="card-title">Student kiezen</div>
          <div className="form_group" style={{ marginBottom: 0 }}>
            <label className="form_label">Student</label>
            <select
              className="form_input"
              value={studentId || ""}
              onChange={handleStudentChange}
            >
              {studenten.map((s) => (
                <option key={s.dossier_id} value={s.student_id || s.id}>
                  {s.voornaam} {s.achternaam}
                  {s.bedrijf ? ` — ${s.bedrijf}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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

      {!loading && !error && alleWeken.length === 0 && (
        <div className="card"><p className="muted">Geen logboeken gevonden voor deze student.</p></div>
      )}

      {/* Ontbrekende weken banner */}
      {!loading && ontbrekendeWeken.length > 0 && (
        <div className="card" style={{
          borderColor: "var(--red)",
          background: "#fff8f8",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "12px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <i className="ti ti-alert-triangle" style={{ color: "var(--red)", fontSize: "16px" }} />
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                {ontbrekendeWeken.length === 1
                  ? `Week ${ontbrekendeWeken[0]} niet ingediend`
                  : `${ontbrekendeWeken.length} weken niet ingediend (${ontbrekendeWeken.join(", ")})`}
              </div>
              {geselecteerdeStudent && (
                <div style={{ fontSize: "12px", color: "var(--sub)" }}>
                  {geselecteerdeStudent.voornaam} {geselecteerdeStudent.achternaam} loopt achter op het logboek.
                </div>
              )}
            </div>
          </div>
          <button
            className="btn sm"
            onClick={() => handleHerinner("algemeen")}
            disabled={remindLoading}
          >
            <i className="ti ti-bell" /> Herinnering sturen
          </button>
        </div>
      )}

      {remindMelding.tekst && (
        <div style={{ marginBottom: "10px" }}>
          <span className={`status ${remindMelding.type}`}>{remindMelding.tekst}</span>
        </div>
      )}

      {!loading && !error && alleWeken.map((week) => {
        if (week.ontbreekt) {
          // Ontbrekende week rij
          return (
            <div
              key={`ontbreekt_${week.week_nummer}`}
              className="card"
              style={{ borderColor: "var(--red)", marginBottom: "8px" }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: "13.5px", fontWeight: 600 }}>Week {week.week_nummer}</span>
                <span className="status s-rood">
                  <i className="ti ti-alert-triangle" /> Niet ingediend door student
                </span>
                <div style={{ marginLeft: "auto" }}>
                  <button
                    className="btn sm"
                    disabled={remindLoading}
                    onClick={() => handleHerinner(week.week_nummer)}
                  >
                    <i className="ti ti-bell" /> Herinnering sturen
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Bestaande week
        return (
          <div className="card" key={week.id} style={{ marginBottom: "8px" }}>
            <div className="card-title">
              Week {week.week_nummer}
              <span className={`status ${getStatusClass(week.status)}`}>
                {getStatusLabel(week.status)}
              </span>
              {week.blokkade && (
                <span className="status s-rood" style={{ marginLeft: "4px" }}>
                  <i className="ti ti-alert-triangle" /> {week.blokkade}
                </span>
              )}
            </div>

            <div className="kv">
              <span className="k">Periode</span>
              <span className="v">{formatDate(week.week_start)} – {formatDate(week.week_einde)}</span>
            </div>

            {week.mentor_feedback && (
              <div className="kv">
                <span className="k">Mentorfeedback</span>
                <span className="v">{week.mentor_feedback}</span>
              </div>
            )}

            {week.docent_feedback && (
              <div className="kv">
                <span className="k">Jouw feedback</span>
                <span className="v">{week.docent_feedback}</span>
              </div>
            )}

            {(week.dagen || []).length > 0 && (
              <table className="tbl" style={{ marginTop: "12px" }}>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Taken</th>
                    <th>Reflectie</th>
                    <th>Uren</th>
                  </tr>
                </thead>
                <tbody>
                  {week.dagen.map((day) => (
                    <tr key={day.id}>
                      <td>{formatDate(day.datum)}</td>
                      <td>{day.uitgevoerde_taken || "-"}</td>
                      <td>{day.reflectie || "-"}</td>
                      <td>{day.aantal_uren || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!["goedgekeurd_door_docent"].includes(week.status) && (
              <>
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
                    {actionLoadingId === week.id ? "Verwerken..." : "Nagekeken"}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
