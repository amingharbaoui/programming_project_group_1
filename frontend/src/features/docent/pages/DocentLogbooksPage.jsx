import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentLogbooksPage.css";
import { IconAlertTriangle, IconBell, IconCheck, IconX, IconRefresh, IconChevronDown } from "@tabler/icons-react";
import { cacheGet, cacheSet, cacheDelete } from "../docentCache";

// Alle mogelijke statussen van logboek_weken:
// niet_gestart · in_opbouw · ingediend · ontbreekt · afgecheckt_door_mentor
// teruggestuurd_door_mentor · klaar_voor_docent · teruggestuurd_door_docent
// goedgekeurd_door_docent · afgesloten
function getStatusClass(status) {
  if (status === "goedgekeurd_door_docent" || status === "afgesloten") return "s_ok";
  if (status === "klaar_voor_docent") return "s_amber";
  if (status === "afgecheckt_door_mentor" || status === "ingediend") return "s_info";
  if (status?.includes("teruggestuurd")) return "s_rood";
  if (status === "ontbreekt") return "s_rood";
  return "s_grijs"; // niet_gestart, in_opbouw, onbekend
}

function getStatusLabel(status) {
  const labels = {
    niet_gestart:             "Nog niet gestart",
    in_opbouw:                "In opbouw bij student",
    ingediend:                "Ingediend door student",
    ontbreekt:                "Niet ingediend",
    afgecheckt_door_mentor:   "Nagekeken door mentor",
    teruggestuurd_door_mentor:"Teruggestuurd door mentor",
    klaar_voor_docent:        "Klaar om na te lezen",
    teruggestuurd_door_docent:"Teruggestuurd door jou",
    goedgekeurd_door_docent:  "Goedgekeurd door jou",
    afgesloten:               "Afgesloten",
  };
  return labels[status] || status || "-";
}

// Weken waar de docent actie op kan nemen (feedback + goedkeuren/terugsturen)
const KAN_REVIEWEN = ["afgecheckt_door_mentor", "klaar_voor_docent"];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

function formatDagNaam(datum) {
  if (!datum) return "Dag";
  const t = new Date(datum).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function DocentLogbooksPage() {
  const { user } = useAuth();

  const [searchParams] = useSearchParams();
  const [studenten, setStudenten] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [feedbackByWeek, setFeedbackByWeek] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [remindLoading, setRemindLoading] = useState(false);
  const [remindModal, setRemindModal] = useState({ open: false, succes: true, tekst: "" });
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  // Laad studenten van API
  useEffect(() => {
    async function loadStudenten() {
      try {
        let data = cacheGet("docent_students");
        if (!data) {
          const res = await api.get("/docent/students");
          data = res.data.data || [];
          cacheSet("docent_students", data);
        }
        setStudenten(data);
        if (data.length > 0) {
          const param = Number(searchParams.get("student"));
          const gekozen = data.find((s) => (s.student_id || s.id) === param) || data[0];
          const sid = gekozen.student_id || gekozen.id;
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

  async function loadLogbooks(sid, force = false) {
    try {
      setLoading(true);
      setError("");
      setWeeks([]);
      if (!force) {
        const cached = cacheGet(`docent_logbooks_${sid}`);
        if (cached) { setWeeks(cached); setLoading(false); return; }
      }
      const response = await api.get(`/docent/logbooks/${sid}`);
      const data = response.data.data || [];
      cacheSet(`docent_logbooks_${sid}`, data);
      setWeeks(data);
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
    setRemindModal({ open: false, succes: true, tekst: "" });
    loadLogbooks(newId);
  }

  async function reviewWeek(weekId, herindieningNodig = false) {
    try {
      setActionLoadingId(weekId);
      await api.patch(`/docent/logbooks/${weekId}/review`, {
        feedback: feedbackByWeek[weekId] || "Logboek nagekeken door docent.",
        herindieningNodig,
      });
      cacheDelete(`docent_logbooks_${studentId}`);
      cacheDelete("docent_students");
      await loadLogbooks(studentId, true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Docentcontrole mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleHerinner(weekNr) {
    try {
      setRemindLoading(true);
      await api.post(`/docent/logbooks/${studentId}/remind`, { weken: weekNr ? [weekNr] : [] });
      setRemindModal({
        open: true,
        succes: true,
        tekst: weekNr === "algemeen"
          ? "De student heeft een algemene herinnering ontvangen om de ontbrekende logboekweken in te dienen."
          : `De student heeft een herinnering ontvangen voor week ${weekNr}.`,
      });
    } catch (err) {
      setRemindModal({
        open: true,
        succes: false,
        tekst: err.response?.data?.message || "Herinnering versturen mislukt. Probeer opnieuw.",
      });
    } finally {
      setRemindLoading(false);
    }
  }

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    function handleOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const geselecteerdeStudent = studenten.find(
    (s) => (s.student_id || s.id) === studentId
  );

  // Bereken ontbrekende weeknummers: weken 1..aantal_weken die nog niet bestaan EN al voorbij zijn.
  // Zelfde logica als de backend (getMissingLogbooksForDocent) — geen toekomstige weken of eindfase markeren.
  function getOntbrekendeWeken(weeks) {
    // In de eindfase of vóór de start zijn er geen ontbrekende weken om op te volgen.
    if (["resultaat_vrijgegeven", "afgerond", "voltooid"].includes(geselecteerdeStudent?.dossier_status)) {
      return [];
    }
    const ingevuld = new Set(
      weeks.filter((w) => w.status && w.status !== "ontbreekt").map((w) => w.week_nummer)
    );
    // Totaal verwachte weken: uit de stage (aantal_weken), met fallback op de hoogste ingediende week.
    const totaal = Number(geselecteerdeStudent?.aantal_weken)
      || (weeks.length > 0 ? Math.max(...weeks.map((w) => w.week_nummer)) : 0);

    const startD = geselecteerdeStudent?.startdatum ? new Date(geselecteerdeStudent.startdatum) : null;
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

  const ontbrekendeWeken = getOntbrekendeWeken(weeks);

  // Combineer bestaande weken + ontbrekende, gesorteerd aflopend
  const alleWeken = [
    ...weeks.map((w) => ({ ...w, ontbreekt: false })),
    ...ontbrekendeWeken.map((n) => ({ week_nummer: n, ontbreekt: true })),
  ].sort((a, b) => b.week_nummer - a.week_nummer);

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Logboeken</h1>
          <p>Bekijk logboeken, mentorfeedback en geef docentfeedback.</p>
        </div>
        <button className="btn primary" onClick={() => studentId && loadLogbooks(studentId, true)}>
          <IconRefresh size={14} stroke={1.8} /> Vernieuwen
        </button>
      </div>

      {/* Student selector */}
      {studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <div className="card_title">Student kiezen</div>
          <div className="form_group" style={{ marginBottom: 0 }}>
            <label className="form_label">Student</label>
            <div className="lb_drop_wrap" ref={dropRef}>
              <button
                type="button"
                className="lb_drop_trigger"
                onClick={() => setDropOpen((o) => !o)}
              >
                <span>
                  {geselecteerdeStudent
                    ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam}${geselecteerdeStudent.bedrijf ? ` — ${geselecteerdeStudent.bedrijf}` : ""}`
                    : "Kies een student"}
                </span>
                <IconChevronDown size={15} stroke={1.8} className={`lb_drop_chevron${dropOpen ? " open" : ""}`} />
              </button>
              {dropOpen && (
                <div className="lb_drop_menu">
                  {studenten.map((s) => {
                    const sid = s.student_id || s.id;
                    const label = `${s.voornaam} ${s.achternaam}${s.bedrijf ? ` — ${s.bedrijf}` : ""}`;
                    return (
                      <button
                        key={s.dossier_id}
                        type="button"
                        className={`lb_drop_item${sid === studentId ? " actief" : ""}`}
                        onClick={() => {
                          setDropOpen(false);
                          handleStudentChange({ target: { value: sid } });
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
          <span className="status s_rood">{error}</span>
        </div>
      )}

      {!loading && !error && alleWeken.length === 0 && (
        <div className="card"><p className="muted">Geen logboeken gevonden voor deze student.</p></div>
      )}

      {/* Ontbrekende weken samenvatting */}
      {!loading && ontbrekendeWeken.length > 0 && (
        <div className="card lb_missing_banner">
          <div className="lb_missing_left">
            <IconAlertTriangle size={15} stroke={1.8} className="lb_missing_icon" />
            <div>
              <span className="lb_missing_title">
                {ontbrekendeWeken.length === 1
                  ? `Week ${ontbrekendeWeken[0]} ontbreekt`
                  : `${ontbrekendeWeken.length} weken ontbreken`}
              </span>
              <span className="lb_missing_sub">
                {geselecteerdeStudent ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam} heeft deze weken nog niet ingediend.` : ""}
              </span>
            </div>
          </div>
          <button className="btn sm" onClick={() => handleHerinner("algemeen")} disabled={remindLoading}>
            <IconBell size={14} stroke={1.8} /> Herinnering sturen
          </button>
        </div>
      )}


      {!loading && !error && alleWeken.map((week) => {
        if (week.ontbreekt) {
          return (
            <div key={`ontbreekt_${week.week_nummer}`} className="card lb_week_missing">
              <span className="lb_week_nr">Week {week.week_nummer}</span>
              <span className="lb_week_missing_lbl">Niet ingediend</span>
              <button className="btn sm" disabled={remindLoading} onClick={() => handleHerinner(week.week_nummer)} style={{ marginLeft: "auto" }}>
                <IconBell size={14} stroke={1.8} /> Herinnering sturen
              </button>
            </div>
          );
        }

        // Bestaande week
        return (
          <div className="card" key={week.id} style={{ marginBottom: "8px" }}>
            <div className="card_title">
              Week {week.week_nummer}
              <span className={`status ${getStatusClass(week.status)}`}>
                {getStatusLabel(week.status)}
              </span>
              {week.blokkade && (
                <span className="status s_rood" style={{ marginLeft: "4px" }}>
                  <IconAlertTriangle size={14} stroke={1.8} /> {week.blokkade}
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
              <div className="lb_dagen" style={{ marginTop: 12 }}>
                {week.dagen.map((dag) => {
                  const comps = Array.isArray(dag.competenties)
                    ? dag.competenties
                    : (dag.competenties ? JSON.parse(dag.competenties) : []);
                  const geenStage = dag.status === "geen_stagedag";
                  return (
                    <div className="lb_dag" key={dag.id}>
                      <div className="lb_dag_hoofd">
                        <span className="lb_dag_naam">
                          {formatDagNaam(dag.datum)}
                          {dag.titel && <span className="lb_dag_titel"> — {dag.titel}</span>}
                        </span>
                        <div className="lb_dag_rechts">
                          <span className="lb_dag_uren">{dag.aantal_uren || 0}u</span>
                          {geenStage && <span className="status s_grijs" style={{ fontSize: 10 }}>Geen stagedag</span>}
                          {!geenStage && dag.mentor_bevestigd_op && (
                            <span className="status s_ok" style={{ fontSize: 10 }}>
                              <IconCheck size={10} stroke={2} /> Mentor bevestigd
                            </span>
                          )}
                          {!geenStage && !dag.mentor_bevestigd_op && (
                            <span className="status s_grijs" style={{ fontSize: 10 }}>Niet bevestigd</span>
                          )}
                        </div>
                      </div>
                      {!geenStage && (
                        <div className="lb_dag_body">
                          {dag.uitgevoerde_taken && (
                            <div className="lb_dag_veld">
                              <span className="lb_veld_k">Taken</span>
                              <span>{dag.uitgevoerde_taken}</span>
                            </div>
                          )}
                          {dag.reflectie && (
                            <div className="lb_dag_veld">
                              <span className="lb_veld_k">Reflectie</span>
                              <span>{dag.reflectie}</span>
                            </div>
                          )}
                          {dag.problemen && (
                            <div className="lb_dag_veld">
                              <span className="lb_veld_k">Problemen</span>
                              <span>{dag.problemen}</span>
                            </div>
                          )}
                          {comps.length > 0 && (
                            <div className="lb_dag_chips">
                              {comps.map((c) => <span key={c} className="lb_dag_chip">{c}</span>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {KAN_REVIEWEN.includes(week.status) && (
              <>
                <div className="form_group" style={{ marginTop: "12px" }}>
                  <label className="form_label">Feedback (optioneel)</label>
                  <textarea
                    className="form_input"
                    rows={2}
                    value={feedbackByWeek[week.id] || ""}
                    onChange={(e) =>
                      setFeedbackByWeek((prev) => ({ ...prev, [week.id]: e.target.value }))
                    }
                    placeholder="Voeg eventuele feedback toe voor de student..."
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div className="actions" style={{ marginTop: "8px" }}>
                  <button
                    className="btn primary"
                    disabled={actionLoadingId === week.id}
                    onClick={() => reviewWeek(week.id, false)}
                  >
                    <IconCheck size={14} stroke={2} />
                    {actionLoadingId === week.id ? "Bezig..." : "Goedkeuren"}
                  </button>
                  <button
                    className="btn"
                    disabled={actionLoadingId === week.id}
                    onClick={() => reviewWeek(week.id, true)}
                  >
                    Terugsturen
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Herinnering modal */}
      {remindModal.open && (
        <div className="modal_overlay" onClick={() => setRemindModal({ open: false, succes: true, tekst: "" })}>
          <div className="modal_box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">
                {remindModal.succes ? "Herinnering verstuurd" : "Actie vereist"}
              </span>
              <button className="icon_btn" onClick={() => setRemindModal({ open: false, succes: true, tekst: "" })}>
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--sub)" }}>{remindModal.tekst}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn primary" onClick={() => setRemindModal({ open: false, succes: true, tekst: "" })}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
