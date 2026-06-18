import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../mentor.css";

const DAG_KORT = ["Ma", "Di", "Wo", "Do", "Vr"];

function initialen(s) {
  return ((s.voornaam || "").charAt(0) + (s.achternaam || "").charAt(0)).toUpperCase() || "?";
}

function weekBadge(status) {
  if (status === "ingediend") return { cls: "s-rood", icon: "ti-hourglass", txt: "Af te checken" };
  if (status === "afgecheckt_door_mentor") return { cls: "s-ok", icon: "ti-checks", txt: "Afgecheckt" };
  if (status === "goedgekeurd_door_docent") return { cls: "s-ok", icon: "ti-checks", txt: "Goedgekeurd" };
  if (status && status.includes("teruggestuurd")) return { cls: "s-amber", icon: "ti-hourglass", txt: "Teruggestuurd" };
  return { cls: "s-info", icon: "ti-pencil", txt: "In opbouw" };
}

function dagIndex(datum) {
  return (new Date(datum).getDay() + 6) % 7; // ma=0 … zo=6
}
function weekdagLang(datum) {
  if (!datum) return "Dag";
  const t = new Date(datum).toLocaleDateString("nl-BE", { weekday: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function dat(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

export default function MentorLogbooksPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const vooraf = Number(searchParams.get("student")) || null;

  const [studenten, setStudenten] = useState([]);
  const [detailId, setDetailId] = useState(vooraf); // null = tabel
  const [weeks, setWeeks] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [openWeeks, setOpenWeeks] = useState(new Set());
  const [feedbackByWeek, setFeedbackByWeek] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await api.get("/mentor/students", { headers: { "x-user-id": String(user.id) } });
        setStudenten(res.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Stagiairs ophalen mislukt");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!detailId) return;
    async function load() {
      try {
        setLoadingDetail(true);
        setError("");
        const res = await api.get(`/mentor/logbooks/${detailId}`, { headers: { "x-user-id": String(user.id) } });
        const data = res.data.data || [];
        setWeeks(data);
        const teCheck = data.find((w) => w.status === "ingediend") || data[data.length - 1];
        setOpenWeeks(new Set(teCheck ? [teCheck.id] : []));
      } catch (err) {
        setError(err.response?.data?.message || "Logboeken ophalen mislukt");
      } finally {
        setLoadingDetail(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId]);

  function toggleWeek(id) {
    setOpenWeeks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function checkWeek(weekId, herindieningNodig) {
    try {
      setActionLoadingId(weekId);
      await api.patch(`/mentor/logbooks/${weekId}/check`, {
        feedback: feedbackByWeek[weekId] || "Week nagekeken door mentor.",
        herindieningNodig,
      }, { headers: { "x-user-id": String(user.id) } });
      const res = await api.get(`/mentor/logbooks/${detailId}`, { headers: { "x-user-id": String(user.id) } });
      setWeeks(res.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || "Mentorcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function bevestigDag(dayId) {
    try {
      setActionLoadingId(dayId);
      await api.patch(`/mentor/logbooks/days/${dayId}/confirm`, {}, { headers: { "x-user-id": String(user.id) } });
      const res = await api.get(`/mentor/logbooks/${detailId}`, { headers: { "x-user-id": String(user.id) } });
      setWeeks(res.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || "Dag bevestigen mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  const detailStudent = studenten.find((s) => s.id === detailId);

  // ─── TABEL ───
  if (!detailId) {
    return (
      <div className="mtr">
        <div className="page-inner">
          <div className="page-header">
            <h1>Logboeken</h1>
            <p>Je stagiairs vullen dagelijks hun logboek in; jij checkt elke week af — daarna leest de docent mee</p>
          </div>
          {error && <div className="card"><span className="status s-rood">{error}</span></div>}
          {!error && studenten.length === 0 && (
            <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen stagiairs gevonden.</p></div>
          )}
          {studenten.length > 0 && (
            <div className="card" style={{ padding: "6px 14px" }}>
              <table className="tbl">
                <thead><tr><th>Student</th><th>Stand</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {studenten.map((s) => {
                    const lb = weekBadge(s.logboek_status);
                    return (
                      <tr key={s.dossier_id ?? s.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="prof-av" style={{ width: 30, height: 30, fontSize: 11 }}>{initialen(s)}</div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetailId(s.id)}>{s.voornaam} {s.achternaam}</div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--sub)" }}>{s.bedrijf || "-"}</td>
                        <td><span className={`status ${lb.cls}`}>{lb.icon && <i className={`ti ${lb.icon}`} />}{lb.txt}</span></td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn sm" onClick={() => setDetailId(s.id)}><i className="ti ti-eye" />Open</button>
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

  // ─── DETAIL ───
  return (
    <div className="mtr">
      <div className="page-inner">
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setDetailId(null)}><i className="ti ti-arrow-left" />Alle logboeken</button>
        </div>
        <div className="page-header">
          <h1>{detailStudent ? `${detailStudent.voornaam} ${detailStudent.achternaam}` : "Logboek"}</h1>
          <p>Daglogs per week — jij checkt af, daarna leest de docent mee</p>
        </div>

        {loadingDetail && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Logboeken laden…</p></div>}
        {error && <div className="card"><span className="status s-rood">{error}</span></div>}
        {!loadingDetail && !error && weeks.length === 0 && (
          <div className="zone-act leeg"><i className="ti ti-info-circle" style={{ color: "var(--sub)" }} /><span>Nog geen ingediende weken voor deze student.</span></div>
        )}

        {!loadingDetail && weeks.map((week) => {
          const wb = weekBadge(week.status);
          const open = openWeeks.has(week.id);
          const dagen = week.dagen || [];
          const aanwezig = new Set(dagen.map((d) => dagIndex(d.datum)));
          const kanChecken = week.status === "ingediend";
          return (
            <div className="logweek" key={week.id}>
              <div className={`logweek-header ${open ? "open" : ""}`} onClick={() => toggleWeek(week.id)}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Week {week.week_nummer}</span>
                <span style={{ fontSize: 12, color: "var(--sub)" }}>{dat(week.week_start)} – {dat(week.week_einde)}</span>
                <span className="wk-pills">
                  {DAG_KORT.map((d, i) => <span key={i} className={`wk-pill ${aanwezig.has(i) ? "" : "mis"}`}>{d}</span>)}
                </span>
                <span className="status s-grijs">{week.totaal_uren || 0}u</span>
                <span className={`status ${wb.cls}`}>{wb.icon && <i className={`ti ${wb.icon}`} />}{wb.txt}</span>
                <i className="ti ti-chevron-down logweek-chevron" />
              </div>
              <div className={`logweek-body ${open ? "open" : ""}`}>
                {dagen.length === 0 && <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Geen dagen ingevuld.</p>}
                {dagen.map((d) => (
                  <div className="entry" key={d.id}>
                    <div className="e-dag">
                      {weekdagLang(d.datum)}{d.titel ? <span style={{ fontWeight: 400, color: "var(--sub)" }}>&nbsp;— {d.titel}</span> : null}
                      {d.status !== "geen_stagedag" && (d.mentor_bevestigd_op
                        ? <span className="status s-ok" style={{ marginLeft: 8 }}>Bevestigd</span>
                        : <button className="btn sm" style={{ marginLeft: 8 }} disabled={actionLoadingId === d.id} onClick={() => bevestigDag(d.id)}>Bevestig dag</button>)}
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--sub)" }}>{d.aantal_uren || 0}u</span>
                    </div>
                    {d.uitgevoerde_taken && <div className="e-veld"><b>Taken</b><span style={{ flex: 1 }}>{d.uitgevoerde_taken}</span></div>}
                    {d.reflectie && <div className="e-veld"><b>Reflectie</b><span style={{ flex: 1 }}>{d.reflectie}</span></div>}
                  </div>
                ))}

                {week.mentor_feedback && (
                  <div className="comment-thread">
                    <div className="comment"><div className="wie">Jouw feedback</div><div className="wat">{week.mentor_feedback}</div></div>
                  </div>
                )}

                {kanChecken && (
                  <>
                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label className="form-label">Feedback (optioneel)</label>
                      <textarea
                        className="form-input"
                        style={{ minHeight: 48, fontSize: 12.5 }}
                        placeholder="Korte feedback voor deze week…"
                        value={feedbackByWeek[week.id] || ""}
                        onChange={(e) => setFeedbackByWeek({ ...feedbackByWeek, [week.id]: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="btn sm" disabled={actionLoadingId === week.id} onClick={() => checkWeek(week.id, true)}>
                        <i className="ti ti-arrow-back-up" />Aanpassing vragen
                      </button>
                      <button className="btn primary sm" disabled={actionLoadingId === week.id} onClick={() => checkWeek(week.id, false)}>
                        <i className="ti ti-check" />Week afchecken
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
