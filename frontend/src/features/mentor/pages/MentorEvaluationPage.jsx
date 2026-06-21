import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorEvaluationPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";

const SCORE_LBL = ["", "Onvoldoende", "Matig", "Voldoende", "Goed", "Uitstekend"];
const KLAAR = ["mentor_ingediend", "klaar_voor_docent", "geregistreerd", "klaar_voor_vrijgave", "vrijgegeven"];

function initialen(s) {
  return ((s.voornaam || "").charAt(0) + (s.achternaam || "").charAt(0)).toUpperCase() || "?";
}
function stapStatus(ev) {
  if (!ev || ev.status === "niet_open") return "locked";
  if (KLAAR.includes(ev.status)) return "done";
  return "actief";
}
function stapIcon(st) {
  return st === "done" ? "ti-check" : st === "actief" ? "ti-pencil" : "ti-lock";
}

export default function MentorEvaluationPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const vooraf = Number(searchParams.get("student")) || null;

  const [studenten, setStudenten] = useState([]);
  const [detailId, setDetailId] = useState(vooraf);
  const [evalData, setEvalData] = useState(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("tussentijds");
  const [scores, setScores] = useState({ tussentijds: {}, finaal: {} });
  const [motiv, setMotiv] = useState({ tussentijds: {}, finaal: {} });
  const [modalCompId, setModalCompId] = useState(null);
  const [verslagOpen, setVerslagOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState({ tekst: "", type: "" });

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
      const cached = cacheGet(`mentor_evaluation_${detailId}`);
      if (cached) {
        setEvalData(cached);
        const ns = { tussentijds: {}, finaal: {} };
        const nm = { tussentijds: {}, finaal: {} };
        for (const ev of cached.evaluaties || []) {
          const key = ev.type === "finaal" ? "finaal" : "tussentijds";
          for (const s of (ev.scores || []).filter((x) => x.rol === "mentor")) {
            ns[key][s.competentie_id] = s.score;
            nm[key][s.competentie_id] = s.motivering || "";
          }
        }
        setScores(ns);
        setMotiv(nm);
        setLoadingEval(false);
        return;
      }
      try {
        setLoadingEval(true);
        setError("");
        setMelding({ tekst: "", type: "" });
        const res = await api.get(`/evaluations/${detailId}`);
        const data = res.data.data;
        cacheSet(`mentor_evaluation_${detailId}`, data);
        setEvalData(data);
        const ns = { tussentijds: {}, finaal: {} };
        const nm = { tussentijds: {}, finaal: {} };
        for (const ev of data.evaluaties || []) {
          const key = ev.type === "finaal" ? "finaal" : "tussentijds";
          for (const s of (ev.scores || []).filter((x) => x.rol === "mentor")) {
            ns[key][s.competentie_id] = s.score;
            nm[key][s.competentie_id] = s.motivering || "";
          }
        }
        setScores(ns);
        setMotiv(nm);
      } catch (err) {
        setError(err.response?.data?.message || "Evaluaties ophalen mislukt");
      } finally {
        setLoadingEval(false);
      }
    }
    load();
  }, [detailId]);

  const detailStudent = studenten.find((s) => s.id === detailId);
  const competenties = evalData?.competenties || [];
  const huidigeEval = evalData?.evaluaties?.find((e) => e.type === activeTab) || null;
  const tussentijdsEval = evalData?.evaluaties?.find((e) => e.type === "tussentijds") || null;
  const finaalEval = evalData?.evaluaties?.find((e) => e.type === "finaal") || null;
  const kanInvullen = huidigeEval && !["niet_open", ...KLAAR].includes(huidigeEval.status);

  function studentScore(compId) {
    const sc = (huidigeEval?.scores || []).find((s) => s.rol === "student" && s.competentie_id === compId);
    return sc || null;
  }
  function zetScore(compId, n) {
    setScores((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [compId]: n } }));
  }
  function zetMotiv(compId, txt) {
    setMotiv((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [compId]: txt } }));
  }

  async function dienIn(ingediend) {
    if (!huidigeEval) return;
    if (ingediend) {
      const missing = competenties.filter((c) => !scores[activeTab][c.id]);
      if (missing.length > 0) {
        setMelding({ tekst: "Geef voor elke competentie een score in.", type: "s_amber" });
        return;
      }
    }
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: scores[activeTab][c.id] || null,
      motivering: motiv[activeTab][c.id] || "",
    }));
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(`/evaluations/${huidigeEval.id}/scores`, { scores: scoresArr, ingediend });
      setMelding({ tekst: ingediend ? "Mentorinput ingediend!" : "Opgeslagen als concept.", type: "s_ok" });
      cacheDelete(`mentor_evaluation_${detailId}`);
      const res = await api.get(`/evaluations/${detailId}`);
      const fresh = res.data.data;
      cacheSet(`mentor_evaluation_${detailId}`, fresh);
      setEvalData(fresh);
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s_rood" });
    } finally {
      setBezig(false);
    }
  }

  // ─── TABEL ───
  if (!detailId) {
    return (
      <div className="page-inner">
          <div className="page-header">
            <h1>Evaluaties</h1>
            <p>Competentieprofiel: Toegepaste Informatica 2025–2026 — de student motiveert, jij scoort als advies</p>
          </div>
          {error && <div className="card"><span className="status s_rood">{error}</span></div>}
          {!error && studenten.length === 0 && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen stagiairs gevonden.</p></div>}
          {studenten.length > 0 && (
            <div className="card" style={{ padding: "6px 14px" }}>
              <table className="tbl">
                <thead><tr><th>Student</th><th>Bedrijf</th><th></th></tr></thead>
                <tbody>
                  {studenten.map((s) => (
                    <tr key={s.dossier_id ?? s.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div className="prof-av" style={{ width: 30, height: 30, fontSize: 11 }}>{initialen(s)}</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.voornaam} {s.achternaam}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--sub)" }}>{s.bedrijf || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn sm" onClick={() => setDetailId(s.id)}><i className="ti ti-eye" />Open</button>
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

  // ─── DETAIL ───
  const t1 = stapStatus(tussentijdsEval);
  const t2 = stapStatus(finaalEval);
  const t3 = finaalEval?.status === "vrijgegeven" ? "done" : "locked";
  const modalComp = competenties.find((c) => c.id === modalCompId) || null;
  const modalStudent = modalComp ? studentScore(modalComp.id) : null;

  return (
    <div className="page-inner">
        <div style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => setDetailId(null)}><i className="ti ti-arrow-left" />Alle evaluaties</button>
        </div>
        <div className="page-header">
          <h1>{detailStudent ? `${detailStudent.voornaam} ${detailStudent.achternaam}` : "Evaluatie"}</h1>
          <p>Competentieprofiel: Toegepaste Informatica 2025–2026 · versie 1.0</p>
        </div>

        {/* stepper */}
        <div className="card" style={{ padding: "20px 14px" }}>
          <div className="ev-track">
            <div className={`ev-stap ${t1}`}>
              <div className="ev-circle"><i className={`ti ${stapIcon(t1)}`} /></div>
              <div className="ev-label">Evaluatie 1 · Tussentijds</div>
              <div className="ev-sub">{t1 === "done" ? "Verwerkt" : t1 === "actief" ? "Jouw input gevraagd" : "Opent na de zelfevaluatie"}</div>
            </div>
            <div className="ev-lijn" />
            <div className={`ev-stap ${t2}`}>
              <div className="ev-circle"><i className={`ti ${stapIcon(t2)}`} /></div>
              <div className="ev-label">Evaluatie 2 · Finale</div>
              <div className="ev-sub">{t2 === "done" ? "Ingediend" : t2 === "actief" ? "Jouw input gevraagd" : "Na de finale zelfevaluatie"}</div>
            </div>
            <div className="ev-lijn" />
            <div className={`ev-stap ${t3}`}>
              <div className="ev-circle"><i className={`ti ${stapIcon(t3)}`} /></div>
              <div className="ev-label">Afronding</div>
              <div className="ev-sub">{t3 === "done" ? "Vrijgegeven aan de student" : "Door de docent, na de eindpresentatie"}</div>
            </div>
          </div>
        </div>

        {/* Resultaatkaart — enkel zichtbaar nadat de docent het eindresultaat heeft vrijgegeven (story 34) */}
        {finaalEval?.status === "vrijgegeven" && (
          <div className="card" style={{ marginTop: 14, borderLeft: "3px solid var(--green, #16a34a)" }}>
            <div className="card_title"><i className="ti ti-trophy" /> Eindresultaat vrijgegeven</div>
            <div className="kv"><span className="k">Eindcijfer</span><span className="v"><b>{finaalEval.eindcijfer != null ? `${Number(finaalEval.eindcijfer).toFixed(1)}/20` : "-"}</b></span></div>
            {finaalEval.competentie_score != null && (
              <div className="kv"><span className="k">Competentiescore</span><span className="v">{Number(finaalEval.competentie_score).toFixed(1)}/5</span></div>
            )}
            {finaalEval.verslag && (
              <div className="kv"><span className="k">Eindfeedback</span><span className="v">{finaalEval.verslag}</span></div>
            )}
            <div className="kv"><span className="k">Open acties</span><span className="v">Geen</span></div>
          </div>
        )}

        {loadingEval && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Evaluatie laden…</p></div>}

        {!loadingEval && evalData && (
          <>
            <div className="chips" style={{ marginTop: 14 }}>
              <button className={`chip ${activeTab === "tussentijds" ? "actief" : ""}`} onClick={() => { setActiveTab("tussentijds"); setMelding({ tekst: "", type: "" }); }}>Tussentijds</button>
              <button className={`chip ${activeTab === "finaal" ? "actief" : ""}`} onClick={() => { setActiveTab("finaal"); setMelding({ tekst: "", type: "" }); }}>Finaal</button>
            </div>

            {!huidigeEval || huidigeEval.status === "niet_open" ? (
              <div className="zone-act leeg"><i className="ti ti-lock" style={{ color: "var(--sub)" }} /><span>Deze evaluatie is nog niet beschikbaar — je krijgt een melding zodra de student zijn zelfevaluatie indient.</span></div>
            ) : (
              <>
                <div className="mtx mtx2">
                  <div className="mtx-row mtx-head">
                    <span />
                    <span>Competentie</span>
                    <span style={{ textAlign: "center" }}>student</span>
                    <span style={{ textAlign: "center" }}>jij</span>
                    <span />
                  </div>
                  {competenties.map((c) => {
                    const ss = studentScore(c.id);
                    const ms = scores[activeTab][c.id];
                    return (
                      <div className="mtx-row klik" key={c.id} onClick={() => setModalCompId(c.id)}>
                        <span className="m-code">{c.code}</span>
                        <span className="m-naam">{c.naam}</span>
                        <span className="m-sc">{ss?.score ? <span className="pil">{ss.score}<span style={{ color: "var(--faint)", fontWeight: 400 }}>/5</span></span> : <span style={{ color: "#d4d4d4" }}>—</span>}</span>
                        <span className="m-sc">{ms ? <span className="pil jij">{ms}<span style={{ color: "var(--faint)", fontWeight: 400 }}>/5</span></span> : <span style={{ color: "#d4d4d4" }}>—</span>}</span>
                        <span className="m-chev"><i className="ti ti-chevron-right" /></span>
                      </div>
                    );
                  })}
                </div>

                <div className="card" style={{ marginTop: 12 }}>
                  <div className="card_title"><i className="ti ti-message" style={{ color: "var(--red)" }} />Algemene praktijkfeedback</div>
                  <textarea
                    className="form_input"
                    style={{ minHeight: 60, fontSize: 12.5 }}
                    placeholder="Hoe draait je stagiair mee op de werkvloer?"
                    value={motiv[activeTab].algemeen || ""}
                    onChange={(e) => zetMotiv("algemeen", e.target.value)}
                    disabled={!kanInvullen}
                  />
                </div>

                {melding.tekst && <div style={{ marginTop: 12 }}><span className={`status ${melding.type}`}>{melding.tekst}</span></div>}

                {kanInvullen ? (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                    <button className="btn" disabled={bezig} onClick={() => dienIn(false)}>Opslaan als concept</button>
                    <button className="btn primary" disabled={bezig} onClick={() => dienIn(true)}><i className="ti ti-send" />{activeTab === "finaal" ? "Finale mentorinput indienen" : "Mentorinput indienen"}</button>
                  </div>
                ) : activeTab === "tussentijds" && huidigeEval?.status === "geregistreerd" ? (
                  <div className="zone-act leeg" style={{ marginTop: 12 }}>
                    <i className="ti ti-circle-check" />
                    <span>Je tussentijdse mentorinput is ingediend en werd verwerkt: de docent registreerde de tussentijdse bespreking. {detailStudent?.voornaam || "De student"} kan het verslag bekijken; jouw input staat hierboven read-only.</span>
                    <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setVerslagOpen(true)}><i className="ti ti-file-text" />Verslag bekijken</button>
                  </div>
                ) : (
                  <p style={{ marginTop: 12, fontSize: 13, color: "var(--sub)" }}>Je mentorinput is ingediend en staat read-only.</p>
                )}
              </>
            )}
          </>
        )}

      {/* verslag-modal — net als toonVerslag() in de HTML-prototype */}
      {verslagOpen && (
        <div className="modal-overlay" onClick={() => setVerslagOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="mh-icon"><i className="ti ti-file-text" /></div>
              <div>
                <div className="mh-t">Verslag tussentijdse bespreking</div>
                <div className="mh-s">Geregistreerd door de docent</div>
              </div>
              <button className="icon-btn mh-x btn sm" onClick={() => setVerslagOpen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>{tussentijdsEval?.verslag || "Geen verslag ingevuld door de docent."}</p>
              <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10 }}>Dit verslag is ook zichtbaar voor de student.</div>
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setVerslagOpen(false)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* score-modal */}
      {modalComp && (
        <div className="modal-overlay" onClick={() => setModalCompId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="mh-icon"><i className="ti ti-clipboard-check" /></div>
              <div>
                <div className="mh-t">{modalComp.code} · {modalComp.naam}</div>
                <div className="mh-s">{activeTab === "finaal" ? "Finale evaluatie" : "Tussentijdse evaluatie"}</div>
              </div>
              <button className="icon-btn mh-x btn sm" onClick={() => setModalCompId(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {modalComp.beschrijving && <div style={{ marginBottom: 12 }}>{modalComp.beschrijving}</div>}
              <div className="fb-blok">
                <div className="fb-wie">{detailStudent ? `${detailStudent.voornaam} ${detailStudent.achternaam}` : "Student"} <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700 }}>{modalStudent?.score ? `${modalStudent.score}/5` : "—"}</span></div>
                <div className="fb-wat">{modalStudent?.motivering || "Geen motivering."}</div>
              </div>

              {kanInvullen ? (
                <>
                  <div className="form_label" style={{ margin: "12px 0 6px" }}>Jouw advies-score<span className="req">*</span></div>
                  <div className="scale" style={{ marginBottom: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} className={`scale-btn ${scores[activeTab][modalComp.id] === n ? "selected" : ""}`} onClick={() => zetScore(modalComp.id, n)}>{n}</button>
                    ))}
                    <span className="scale-lbl">{scores[activeTab][modalComp.id] ? SCORE_LBL[scores[activeTab][modalComp.id]] : ""}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>1 onvoldoende · 3 voldoende · 5 uitstekend</div>
                  <div className="form_group" style={{ marginTop: 12 }}>
                    <label className="form_label">Praktijkfeedback (optioneel)</label>
                    <textarea className="form_input" style={{ minHeight: 48, fontSize: 12.5 }} value={motiv[activeTab][modalComp.id] || ""} onChange={(e) => zetMotiv(modalComp.id, e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="fb-blok">
                  <div className="fb-wie">Jouw score <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700 }}>{scores[activeTab][modalComp.id] ? `${scores[activeTab][modalComp.id]}/5` : "—"}</span></div>
                  <div className="fb-wat">{motiv[activeTab][modalComp.id] || "Geen opmerking bij deze competentie."}</div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setModalCompId(null)}><i className="ti ti-check" />{kanInvullen ? "Bewaar" : "Sluiten"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
