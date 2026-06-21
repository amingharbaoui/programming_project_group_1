import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorLogbooksPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";

const DAG_KORT = ["Ma", "Di", "Wo", "Do", "Vr"];

function initialen(s) {
  return ((s.voornaam || "").charAt(0) + (s.achternaam || "").charAt(0)).toUpperCase() || "?";
}

function weekBadge(status) {
  if (status === "ingediend") return { cls: "s_rood", icon: "ti-hourglass", txt: "Af te checken" };
  if (status === "afgecheckt_door_mentor") return { cls: "s_ok", icon: "ti-checks", txt: "Afgecheckt" };
  if (status === "goedgekeurd_door_docent") return { cls: "s_ok", icon: "ti-checks", txt: "Goedgekeurd" };
  if (status && status.includes("teruggestuurd")) return { cls: "s_amber", icon: "ti-hourglass", txt: "Teruggestuurd" };
  return { cls: "s_info", icon: "ti-pencil", txt: "In opbouw" };
}

// Fase-bewuste status voor het overzicht: een student buiten de logboekfase mag geen "In opbouw" tonen.
function logboekBadge(s) {
  const ds = s.dossier_status;
  if (["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(ds)) return { cls: "s_grijs", icon: "ti-flag-check", txt: "Afgerond" };
  if (!["stage_loopt", "actief", "geregistreerd"].includes(ds)) return { cls: "s_grijs", icon: "ti-clock", txt: "Nog niet gestart" };
  if (!s.logboek_status) return { cls: "s_grijs", icon: "ti-minus", txt: "Nog geen logboek" };
  return weekBadge(s.logboek_status);
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

// Zelfde berekening als bij de docent: welke weken (1..aantal_weken) ontbreken EN al voorbij zijn.
// Geen toekomstige weken of weken in de eindfase als "ontbrekend" tonen.
function getOntbrekendeWeken(weken, aantalWeken, startdatum, dossierStatus) {
  if (["resultaat_vrijgegeven", "afgerond", "voltooid"].includes(dossierStatus)) return [];
  const ingevuld = new Set(weken.map((w) => w.week_nummer));
  const totaal = Number(aantalWeken) || (weken.length > 0 ? Math.max(...weken.map((w) => w.week_nummer)) : 0);
  const startD = startdatum ? new Date(startdatum) : null;
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const weekVoorbij = (n) => {
    if (!startD || Number.isNaN(startD.getTime())) return true;
    const einde = new Date(startD); einde.setDate(einde.getDate() + n * 7);
    return einde <= vandaag;
  };
  const ontbrekend = [];
  for (let n = 1; n <= totaal; n++) {
    if (!ingevuld.has(n) && weekVoorbij(n)) ontbrekend.push(n);
  }
  return ontbrekend;
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
      const cached = cacheGet("mentor_students");
      if (cached) { setStudenten(cached); return; }
      try {
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        cacheSet("mentor_students", data);
        setStudenten(data);
      } catch (err) {
        setError(err.response?.data?.message || "Stagiairs ophalen mislukt");
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!detailId) return;
    async function load() {
      const cached = cacheGet(`mentor_logbooks_${detailId}`);
      if (cached) {
        setWeeks(cached);
        const teCheck = cached.find((w) => w.status === "ingediend") || cached[cached.length - 1];
        setOpenWeeks(new Set(teCheck ? [teCheck.id] : []));
        setLoadingDetail(false);
        return;
      }
      try {
        setLoadingDetail(true);
        setError("");
        const res = await api.get(`/mentor/logbooks/${detailId}`);
        const data = res.data.data || [];
        cacheSet(`mentor_logbooks_${detailId}`, data);
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
      });
      cacheDelete(`mentor_logbooks_${detailId}`, "mentor_students");
      const res = await api.get(`/mentor/logbooks/${detailId}`);
      const data = res.data.data || [];
      cacheSet(`mentor_logbooks_${detailId}`, data);
      setWeeks(data);
    } catch (err) {
      alert(err.response?.data?.message || "Mentorcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function confirmDag(dayId) {
    try {
      setActionLoadingId(`dag-${dayId}`);
      await api.patch(`/mentor/logbooks/days/${dayId}/confirm`, {});
      cacheDelete(`mentor_logbooks_${detailId}`);
      const res = await api.get(`/mentor/logbooks/${detailId}`);
      const data = res.data.data || [];
      cacheSet(`mentor_logbooks_${detailId}`, data);
      setWeeks(data);
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
      <div className="page-inner">
          <div className="page-header">
            <h1>Logboeken</h1>
            <p>Je stagiairs vullen dagelijks hun logboek in; jij checkt elke week af — daarna leest de docent mee</p>
          </div>
          {error && <div className="card"><span className="status s_rood">{error}</span></div>}
          {!error && studenten.length === 0 && (
            <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen stagiairs gevonden.</p></div>
          )}
          {studenten.length > 0 && (
            <div className="card" style={{ padding: "6px 14px" }}>
              <table className="tbl">
                <thead><tr><th>Student</th><th>Bedrijf</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {studenten.map((s) => {
                    const lb = logboekBadge(s);
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
    );
  }

  // ─── DETAIL ───
  const ontbrekendeWeken = getOntbrekendeWeken(weeks, detailStudent?.aantal_weken, detailStudent?.startdatum, detailStudent?.dossier_status);

  return (
    <div className="page-inner">
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setDetailId(null)}><i className="ti ti-arrow-left" />Alle logboeken</button>
        </div>
        <div className="page-header">
          <h1>{detailStudent ? `${detailStudent.voornaam} ${detailStudent.achternaam}` : "Logboek"}</h1>
          <p>Daglogs per week — jij checkt af, daarna leest de docent mee</p>
        </div>

        {loadingDetail && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Logboeken laden…</p></div>}
        {error && <div className="card"><span className="status s_rood">{error}</span></div>}
        {!loadingDetail && !error && weeks.length === 0 && ontbrekendeWeken.length === 0 && (
          <div className="zone-act leeg"><i className="ti ti-info-circle" style={{ color: "var(--sub)" }} /><span>De stage is nog niet gestart — het logboek opent op de eerste stagedag.</span></div>
        )}

        {!loadingDetail && ontbrekendeWeken.length > 0 && (
          <div className="card" style={{
            borderColor: "var(--red)", background: "#fff8f8", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          }}>
            <i className="ti ti-alert-triangle" style={{ color: "var(--red)", fontSize: 16 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {ontbrekendeWeken.length === 1
                ? `Week ${ontbrekendeWeken[0]} niet ingediend`
                : `${ontbrekendeWeken.length} weken niet ingediend (${ontbrekendeWeken.join(", ")})`}
            </div>
          </div>
        )}

        {!loadingDetail && ontbrekendeWeken.map((n) => (
          <div key={`ontbreekt_${n}`} className="card" style={{ borderColor: "var(--red)", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Week {n}</span>
              <span className="status s_rood"><i className="ti ti-alert-triangle" />Niet ingediend door student</span>
            </div>
          </div>
        ))}

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
                <span className="status s_grijs">{week.totaal_uren || 0}u</span>
                <span className={`status ${wb.cls}`}>{wb.icon && <i className={`ti ${wb.icon}`} />}{wb.txt}</span>
                <i className="ti ti-chevron-down logweek-chevron" />
              </div>
              <div className={`logweek-body ${open ? "open" : ""}`}>
                {dagen.length === 0 && <p style={{ color: "var(--faint)", fontSize: 12.5 }}>Geen dagen ingevuld.</p>}
                {dagen.map((d) => {
                  const comps = Array.isArray(d.competenties)
                    ? d.competenties
                    : (d.competenties ? JSON.parse(d.competenties) : []);
                  const geenStage = d.status === "geen_stagedag";
                  return (
                    <div className="entry" key={d.id}>
                      <div className="e-dag">
                        {weekdagLang(d.datum)}
                        {d.titel && <span style={{ fontWeight: 400, color: "var(--sub)" }}>&nbsp;— {d.titel}</span>}
                        {geenStage && <span className="status s_grijs" style={{ fontSize: 10, marginLeft: 6 }}>Geen stagedag</span>}
                        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--sub)" }}>
                          {d.aantal_uren || 0}u
                        </span>
                      </div>
                      {!geenStage && (
                        <>
                          {d.uitgevoerde_taken && <div className="e-veld"><b>Taken</b><span style={{ flex: 1 }}>{d.uitgevoerde_taken}</span></div>}
                          {d.reflectie      && <div className="e-veld"><b>Reflectie</b><span style={{ flex: 1 }}>{d.reflectie}</span></div>}
                          {d.problemen      && <div className="e-veld"><b>Problemen</b><span style={{ flex: 1 }}>{d.problemen}</span></div>}
                          {comps.length > 0 && (
                            <div className="e-chips">
                              {comps.map((c) => <span key={c} className="e-chip">{c}</span>)}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                            {d.mentor_bevestigd_op ? (
                              <span className="status s_ok"><i className="ti ti-check" />Dag bevestigd</span>
                            ) : (
                              <button className="btn sm" disabled={actionLoadingId === `dag-${d.id}`} onClick={() => confirmDag(d.id)}>
                                <i className="ti ti-check" />Dag bevestigen
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {(week.mentor_feedback || week.student_antwoord) && (
                  <div className="comment-thread">
                    {week.mentor_feedback && (
                      <div className="comment"><div className="wie">Jouw feedback</div><div className="wat">{week.mentor_feedback}</div></div>
                    )}
                    {week.student_antwoord && (
                      <div className="comment"><div className="wie">Antwoord student</div><div className="wat">{week.student_antwoord}</div></div>
                    )}
                  </div>
                )}

                {kanChecken && (
                  <>
                    <div className="form_group" style={{ marginTop: 12 }}>
                      <label className="form_label">Feedback (optioneel)</label>
                      <textarea
                        className="form_input"
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
  );
}
