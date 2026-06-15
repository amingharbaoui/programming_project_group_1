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

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluatie invullen</h1>
          <p>Beoordeel de competenties van je stagiair.</p>
        </div>
      </div>

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
    </div>
  );
}
