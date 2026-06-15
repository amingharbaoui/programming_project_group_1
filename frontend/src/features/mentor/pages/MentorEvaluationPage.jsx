<<<<<<< HEAD
import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
}

/* Eén evaluatiemoment dat de mentor invult (tussentijds of finaal). */
function MentorEvalForm({ evaluatie, competenties, onSaved }) {
  const mentorScores = evaluatie.scores.filter((s) => s.rol === "mentor");
  const studentScores = evaluatie.scores.filter((s) => s.rol === "student");
  const alIngediend = !!evaluatie.mentor_ingediend_op;
  const kanInvullen = !alIngediend && evaluatie.status !== "vrijgegeven" && evaluatie.status !== "niet_open";

  const initScores = () =>
    competenties.reduce((acc, c) => {
      const b = mentorScores.find((s) => s.competentie_id === c.id);
      acc[c.id] = { score: b?.score ?? null, motivering: b?.motivering ?? "" };
      return acc;
    }, {});

  const [scores, setScores] = useState(initScores);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [succes, setSucces] = useState(null);

  function upd(cId, veld, val) {
    setScores((p) => ({ ...p, [cId]: { ...p[cId], [veld]: val } }));
  }

  async function opslaan(indienen) {
    setBezig(true);
    setFout(null);
    setSucces(null);
    try {
      await apiRequest("POST", `/evaluations/${evaluatie.id}/scores`, {
        ingediend: indienen,
        scores: competenties.map((c) => ({
          competentie_id: c.id,
          score: scores[c.id]?.score ?? null,
          motivering: scores[c.id]?.motivering ?? "",
        })),
      });
      setSucces(indienen ? "Mentorinput ingediend." : "Opgeslagen.");
      if (indienen) onSaved();
    } catch (err) {
      setFout(err.response?.data?.message || "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card_title">
        {evaluatie.type === "tussentijds" ? "Tussentijdse evaluatie" : "Finale evaluatie"}{" "}
        <span className="status s_info">{evaluatie.status}</span>
      </div>

      {fout && <div className="status s_amber" style={{ display: "block", marginBottom: 8 }}>{fout}</div>}
      {succes && <div className="status s_ok" style={{ display: "block", marginBottom: 8 }}>{succes}</div>}

      <table className="tbl">
        <thead>
          <tr>
            <th>Competentie</th>
            <th>Student</th>
            <th style={{ width: 120 }}>Jouw score (0–20)</th>
            <th>Motivering</th>
          </tr>
        </thead>
        <tbody>
          {competenties.map((c) => {
            const ss = studentScores.find((s) => s.competentie_id === c.id);
            return (
              <tr key={c.id}>
                <td>
                  <span className="status s_info">{c.code}</span> {c.naam}{" "}
                  <span className="muted">{c.gewicht_percentage}%</span>
                </td>
                <td>{ss?.score ?? "–"}</td>
                <td>
                  <input
                    type="number" min="0" max="20" step="0.5" className="form_input" style={{ width: 90 }}
                    value={scores[c.id]?.score ?? ""}
                    disabled={!kanInvullen || bezig}
                    onChange={(e) => upd(c.id, "score", e.target.value === "" ? null : Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    className="form_input" placeholder="Toelichting"
                    value={scores[c.id]?.motivering ?? ""}
                    disabled={!kanInvullen || bezig}
                    onChange={(e) => upd(c.id, "motivering", e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {kanInvullen ? (
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn" disabled={bezig} onClick={() => opslaan(false)}>{bezig ? "Bezig…" : "Opslaan"}</button>
          <button className="btn primary" disabled={bezig} onClick={() => opslaan(true)}>{bezig ? "Bezig…" : "Indienen"}</button>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>
          {alIngediend ? `Ingediend op ${formatDatum(evaluatie.mentor_ingediend_op)}.` : "Nog niet open om in te vullen."}
        </p>
      )}
    </div>
  );
}

export default function MentorEvaluationPage() {
  const { user } = useAuth();
  const [studenten, setStudenten] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  // herbruikbaar voor de handlers (verversen na opslaan/indienen)
  async function laadEvaluaties() {
    if (!studentId) return;
    try {
      const res = await apiRequest("GET", `/evaluations/${studentId}`);
      setData(res.data);
      setFout(null);
    } catch (err) {
      setFout(err.response?.data?.message || "Evaluaties laden mislukt.");
    }
  }

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const res = await apiRequest("GET", "/evaluations/my-students");
        const lijst = res.data || [];
        if (!active) return;
        setStudenten(lijst);
        if (lijst.length) setStudentId(lijst[0].student_id);
      } catch {
        if (active) setFout("Studenten laden mislukt.");
      }
    }
    run();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    async function run() {
      try {
        const res = await apiRequest("GET", `/evaluations/${studentId}`);
        if (active) { setData(res.data); setFout(null); }
      } catch (err) {
        if (active) setFout(err.response?.data?.message || "Evaluaties laden mislukt.");
      }
    }
    run();
    return () => { active = false; };
  }, [studentId]);

=======
import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function getEvalStatusClass(status) {
  if (status === "open") return "s_amber";
  if (status === "student_ingediend") return "s_info";
  if (status === "mentor_ingediend") return "s_ok";
  if (status === "geregistreerd") return "s_ok";
  if (status === "klaar_voor_vrijgave") return "s_ok";
  if (status === "vrijgegeven") return "s_ok";
  if (status === "niet_open") return "s_grijs";
  return "s_grijs";
}

function getEvalStatusLabel(status) {
  if (status === "open") return "Open";
  if (status === "student_ingediend") return "Student ingediend";
  if (status === "mentor_ingediend") return "Ingediend";
  if (status === "geregistreerd") return "Geregistreerd";
  if (status === "klaar_voor_vrijgave") return "Klaar voor vrijgave";
  if (status === "vrijgegeven") return "Vrijgegeven";
  if (status === "niet_open") return "Niet beschikbaar";
  return status || "-";
}

function ScoreKnoppen({ waarde, onChange, leesOnly }) {
  return (
    <div className="score_knoppen">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`score_knop${waarde === n ? " geselecteerd" : ""}`}
          onClick={() => !leesOnly && onChange && onChange(n)}
          disabled={leesOnly}
          style={leesOnly ? { cursor: "default", opacity: waarde === n ? 1 : 0.35 } : {}}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function MentorEvaluationPage() {
  const { user } = useAuth();

  const [studenten, setStudenten]               = useState([]);
  const [geselecteerdStudent, setGeselecteerdStudent] = useState(null);
  const [loadingStudenten, setLoadingStudenten] = useState(true);

  const [evalData, setEvalData]       = useState(null);
  const [loadingEval, setLoadingEval] = useState(false);

  const [activeTab, setActiveTab]               = useState("tussentijds");
  const [scoresTussentijds, setScoresTussentijds] = useState({});
  const [scoresFinaal, setScoresFinaal]           = useState({});

  const [bezig, setBezig]     = useState(false);
  const [melding, setMelding] = useState({ tekst: "", type: "" });

  // Laad studenten
  useEffect(() => {
    async function load() {
      try {
        setLoadingStudenten(true);
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        setStudenten(data);
        if (data.length > 0) setGeselecteerdStudent(data[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStudenten(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Laad evaluatiedata wanneer student verandert
  useEffect(() => {
    if (!geselecteerdStudent) return;
    async function load() {
      try {
        setLoadingEval(true);
        setEvalData(null);
        setMelding({ tekst: "", type: "" });
        const res = await api.get(`/evaluations/${geselecteerdStudent.id}`);
        const data = res.data.data;
        setEvalData(data);

        // Vul bestaande mentorscores in
        const newTussentijds = {};
        const newFinaal = {};
        for (const ev of data.evaluaties || []) {
          const mentorScores = (ev.scores || []).filter((s) => s.rol === "mentor");
          const obj = {};
          for (const s of mentorScores) {
            obj[s.competentie_id] = s.score;
          }
          if (ev.type === "tussentijds") Object.assign(newTussentijds, obj);
          if (ev.type === "finaal") Object.assign(newFinaal, obj);
        }
        setScoresTussentijds(newTussentijds);
        setScoresFinaal(newFinaal);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingEval(false);
      }
    }
    load();
  }, [geselecteerdStudent]);

  const huidigeEval = evalData?.evaluaties?.find((e) => e.type === activeTab) || null;
  const huidigScores = activeTab === "tussentijds" ? scoresTussentijds : scoresFinaal;
  const setHuidigScores = activeTab === "tussentijds" ? setScoresTussentijds : setScoresFinaal;

  const kanInvullen =
    huidigeEval &&
    !["niet_open", "mentor_ingediend", "geregistreerd", "klaar_voor_vrijgave", "vrijgegeven"].includes(
      huidigeEval.status
    );

  async function handleOpslaan(ingediend) {
    if (!huidigeEval) return;
    const competenties = evalData.competenties || [];

    if (ingediend) {
      const missing = competenties.filter((c) => !huidigScores[c.id]);
      if (missing.length > 0) {
        setMelding({ tekst: "Geef voor elke competentie een score in.", type: "s_amber" });
        return;
      }
    }

    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: huidigScores[c.id] || null,
      motivering: "",
    }));

    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(
        `/evaluations/${huidigeEval.id}/scores`,
        { scores: scoresArr, ingediend }
      );
      setMelding({
        tekst: ingediend ? "Evaluatie ingediend!" : "Scores opgeslagen als concept.",
        type: "s_ok",
      });
      // Herlaad evaldata
      const res = await api.get(`/evaluations/${geselecteerdStudent.id}`);
      setEvalData(res.data.data);
    } catch (err) {
      setMelding({
        tekst: err.response?.data?.message || "Opslaan mislukt",
        type: "s_rood",
      });
    } finally {
      setBezig(false);
    }
  }

>>>>>>> a57cd66e16e52f39d9f5f80769d136ff890403c2
  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluatie invullen</h1>
          <p>Beoordeel de competenties van je stagiair.</p>
        </div>
      </div>

<<<<<<< HEAD
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card_title">Student kiezen</div>
        {studenten.length === 0 ? (
          <p className="muted">Geen gekoppelde studenten gevonden.</p>
        ) : (
          <select className="form_input" value={studentId ?? ""} onChange={(e) => setStudentId(Number(e.target.value))}>
            {studenten.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.voornaam} {s.achternaam} — {s.bedrijf_naam}
              </option>
            ))}
          </select>
        )}
      </div>

      {fout && <div className="card" style={{ marginBottom: 12 }}><span className="status s_amber">{fout}</span></div>}
      {data && data.evaluaties.length === 0 && (
        <div className="card"><p className="muted">Nog geen evaluatie geopend voor deze student (docent/administratie opent ze).</p></div>
      )}
      {data && data.evaluaties.map((ev) => (
        <MentorEvalForm key={ev.id} evaluatie={ev} competenties={data.competenties} onSaved={laadEvaluaties} />
      ))}
=======
      {/* Student selector */}
      {!loadingStudenten && studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <div className="card_title">Stagiair kiezen</div>
          <div className="form_group" style={{ marginBottom: 0 }}>
            <label className="form_label">Stagiair</label>
            <select
              className="form_input"
              value={geselecteerdStudent?.id || ""}
              onChange={(e) => {
                const s = studenten.find((x) => x.id === Number(e.target.value));
                setGeselecteerdStudent(s || null);
              }}
            >
              {studenten.map((s) => (
                <option key={s.dossier_id} value={s.id}>
                  {s.voornaam} {s.achternaam} — {s.bedrijf}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loadingStudenten && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {!loadingStudenten && studenten.length === 0 && (
        <div className="empty_state">Geen stagiairs gevonden.</div>
      )}

      {/* Type tabs */}
      {!loadingStudenten && studenten.length > 0 && (
        <div className="chips" style={{ marginBottom: "12px" }}>
          <button
            className={`chip${activeTab === "tussentijds" ? " actief" : ""}`}
            onClick={() => { setActiveTab("tussentijds"); setMelding({ tekst: "", type: "" }); }}
          >
            Tussentijds
          </button>
          <button
            className={`chip${activeTab === "finaal" ? " actief" : ""}`}
            onClick={() => { setActiveTab("finaal"); setMelding({ tekst: "", type: "" }); }}
          >
            Finaal
          </button>
        </div>
      )}

      {loadingEval && (
        <div className="card">
          <p className="muted">Evaluatie laden...</p>
        </div>
      )}

      {/* Eval card */}
      {!loadingEval && evalData && (
        <div className="card">
          <div className="card_title">
            {activeTab === "tussentijds" ? "Tussentijdse evaluatie" : "Finale evaluatie"}
            {huidigeEval && (
              <span className={`status ${getEvalStatusClass(huidigeEval.status)}`}>
                {getEvalStatusLabel(huidigeEval.status)}
              </span>
            )}
          </div>

          {!huidigeEval || huidigeEval.status === "niet_open" ? (
            <p className="muted">Deze evaluatie is nog niet beschikbaar.</p>
          ) : (
            <>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: "70px" }}>Code</th>
                    <th>Competentie</th>
                    <th style={{ width: "200px" }}>Score (1–5)</th>
                  </tr>
                </thead>
                <tbody>
                  {(evalData.competenties || []).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="status s_info">{c.code}</span>
                      </td>
                      <td>{c.naam}</td>
                      <td>
                        <ScoreKnoppen
                          waarde={huidigScores[c.id] || null}
                          leesOnly={!kanInvullen}
                          onChange={(val) =>
                            setHuidigScores((prev) => ({ ...prev, [c.id]: val }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {melding.tekst && (
                <div style={{ marginTop: "12px" }}>
                  <span className={`status ${melding.type}`}>{melding.tekst}</span>
                </div>
              )}

              {kanInvullen && (
                <div className="actions" style={{ marginTop: "16px" }}>
                  <button
                    className="btn primary"
                    disabled={bezig}
                    onClick={() => handleOpslaan(true)}
                  >
                    {bezig ? "Bezig..." : "Indienen"}
                  </button>
                  <button
                    className="btn"
                    disabled={bezig}
                    onClick={() => handleOpslaan(false)}
                  >
                    Opslaan als concept
                  </button>
                </div>
              )}

              {!kanInvullen && huidigeEval.status !== "niet_open" && (
                <p className="muted" style={{ marginTop: "12px", fontSize: "13px" }}>
                  Evaluatie is ingediend en kan niet meer gewijzigd worden.
                </p>
              )}
            </>
          )}
        </div>
      )}
>>>>>>> a57cd66e16e52f39d9f5f80769d136ff890403c2
    </div>
  );
}
