import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function getEvalStatusClass(status) {
  if (status === "open") return "s_amber";
  if (status === "student_ingediend") return "s_info";
  if (status === "mentor_ingediend") return "s_amber";
  if (status === "geregistreerd") return "s_ok";
  if (status === "klaar_voor_vrijgave") return "s_ok";
  if (status === "vrijgegeven") return "s_ok";
  if (status === "niet_open") return "s_grijs";
  return "s_grijs";
}

function getEvalStatusLabel(status) {
  if (status === "open") return "Open";
  if (status === "student_ingediend") return "Student ingediend";
  if (status === "mentor_ingediend") return "Mentor ingediend";
  if (status === "geregistreerd") return "Geregistreerd";
  if (status === "klaar_voor_vrijgave") return "Klaar voor vrijgave";
  if (status === "vrijgegeven") return "Vrijgegeven";
  if (status === "niet_open") return "Niet open";
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

function EvalDetail({ evalData, activeType, userId, onRefresh }) {
  const evaluatie = evalData?.evaluaties?.find((e) => e.type === activeType) || null;
  const competenties = evalData?.competenties || [];

  const mentorScoresMap = {};
  const docentScoresBestaand = {};
  if (evaluatie) {
    for (const s of evaluatie.scores || []) {
      if (s.rol === "mentor") mentorScoresMap[s.competentie_id] = s.score;
      if (s.rol === "docent") docentScoresBestaand[s.competentie_id] = s.score;
    }
  }

  const [docentScores, setDocentScores] = useState({ ...docentScoresBestaand });
  const [bezig, setBezig]   = useState(false);
  const [melding, setMelding] = useState({ tekst: "", type: "" });

  // Reset scores als evaluatie verandert
  useEffect(() => {
    const nieuw = {};
    if (evaluatie) {
      for (const s of evaluatie.scores || []) {
        if (s.rol === "docent") nieuw[s.competentie_id] = s.score;
      }
    }
    setDocentScores(nieuw);
    setMelding({ tekst: "", type: "" });
  }, [evaluatie?.id]);

  const kanInvullen =
    evaluatie &&
    !["niet_open", "vrijgegeven", "geregistreerd", "klaar_voor_vrijgave"].includes(evaluatie.status);

  async function handleOpslaan() {
    if (!evaluatie) return;
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: "",
    }));
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(
        `/evaluations/${evaluatie.id}/scores`,
        { scores: scoresArr, ingediend: false },
        {}
      );
      setMelding({ tekst: "Scores opgeslagen.", type: "s_ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s_rood" });
    } finally {
      setBezig(false);
    }
  }

  async function handleRegistreren() {
    if (!evaluatie) return;
    const missing = competenties.filter((c) => !docentScores[c.id]);
    if (missing.length > 0) {
      setMelding({ tekst: "Geef voor elke competentie een score in.", type: "s_amber" });
      return;
    }
    // Eerst scores opslaan
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: "",
    }));
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(
        `/evaluations/${evaluatie.id}/scores`,
        { scores: scoresArr, ingediend: false },
        {}
      );
      // Dan berekenen
      await api.post(
        `/evaluations/${evaluatie.id}/calculate`,
        {},
        {}
      );
      setMelding({ tekst: "Evaluatie geregistreerd!", type: "s_ok" });
      onRefresh && onRefresh();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Registreren mislukt", type: "s_rood" });
    } finally {
      setBezig(false);
    }
  }

  if (!evaluatie || evaluatie.status === "niet_open") {
    return (
      <div className="card">
        <p className="muted">
          {activeType === "tussentijds" ? "Tussentijdse" : "Finale"} evaluatie is nog niet beschikbaar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid_2" style={{ marginBottom: "12px" }}>
      {/* Mentor scores — leesonly */}
      <div className="card">
        <div className="card_title">
          Mentor{" "}
          <span className={`status ${getEvalStatusClass(evaluatie.status)}`}>
            {getEvalStatusLabel(evaluatie.status)}
          </span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Competentie</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {competenties.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="status s_info" style={{ marginRight: "6px" }}>
                    {c.code}
                  </span>
                  {c.naam}
                </td>
                <td>
                  <ScoreKnoppen waarde={mentorScoresMap[c.id] || null} leesOnly />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {["geregistreerd", "klaar_voor_vrijgave", "vrijgegeven"].includes(evaluatie.status) && (
          <p className="muted" style={{ marginTop: "10px", fontSize: "13px" }}>
            Evaluatie is geregistreerd.
          </p>
        )}
      </div>

      {/* Docent scores */}
      <div className="card">
        <div className="card_title">
          Docent{" "}
          <span className={`status ${getEvalStatusClass(evaluatie.status)}`}>
            {getEvalStatusLabel(evaluatie.status)}
          </span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Competentie</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {competenties.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="status s_info" style={{ marginRight: "6px" }}>
                    {c.code}
                  </span>
                  {c.naam}
                </td>
                <td>
                  <ScoreKnoppen
                    waarde={docentScores[c.id] || null}
                    leesOnly={!kanInvullen}
                    onChange={(val) =>
                      setDocentScores((prev) => ({ ...prev, [c.id]: val }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {melding.tekst && (
          <div style={{ marginTop: "10px" }}>
            <span className={`status ${melding.type}`}>{melding.tekst}</span>
          </div>
        )}

        {kanInvullen && (
          <div className="actions" style={{ marginTop: "14px" }}>
            <button className="btn primary" disabled={bezig} onClick={handleRegistreren}>
              {bezig ? "Bezig..." : "Registreren"}
            </button>
            <button className="btn" disabled={bezig} onClick={handleOpslaan}>
              Opslaan
            </button>
          </div>
        )}

        {!kanInvullen && (
          <p className="muted" style={{ marginTop: "10px", fontSize: "13px" }}>
            Evaluatie is {getEvalStatusLabel(evaluatie.status).toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DocentEvaluationsPage() {
  const { user } = useAuth();

  const [studenten, setStudenten]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [geselecteerdId, setGeselecteerdId] = useState(null);

  const [evalData, setEvalData]           = useState(null);
  const [loadingEval, setLoadingEval]     = useState(false);
  const [activeType, setActiveType]       = useState("tussentijds");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/docent/students");
        setStudenten(res.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function loadEval(studentId) {
    try {
      setLoadingEval(true);
      const res = await api.get(`/evaluations/${studentId}`);
      setEvalData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEval(false);
    }
  }

  function handleBekijken(student) {
    if (geselecteerdId === student.id) {
      setGeselecteerdId(null);
      setEvalData(null);
    } else {
      setGeselecteerdId(student.id);
      setActiveType("tussentijds");
      loadEval(student.id);
    }
  }

  const geselecteerdeStudent = studenten.find((s) => s.id === geselecteerdId);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluaties</h1>
          <p>Bekijk en registreer evaluaties van studenten.</p>
        </div>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {!loading && studenten.length === 0 && (
        <div className="empty_state">Geen studenten gevonden.</div>
      )}

      {!loading && studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="card_title">Studenten ({studenten.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Mentor</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {studenten.map((s) => (
                <tr key={s.dossier_id}>
                  <td>
                    <strong>
                      {s.voornaam} {s.achternaam}
                    </strong>
                    <br />
                    <span className="muted">{s.studentennummer}</span>
                  </td>
                  <td>{s.bedrijf || "-"}</td>
                  <td>
                    {s.mentor_voornaam
                      ? `${s.mentor_voornaam} ${s.mentor_achternaam}`
                      : "-"}
                  </td>
                  <td className="right">
                    <button
                      className="btn sm"
                      onClick={() => handleBekijken(s)}
                    >
                      {geselecteerdId === s.id ? "Sluiten" : "Bekijken"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail sectie */}
      {geselecteerdId && (
        <div>
          <div className="page_header" style={{ marginBottom: "10px" }}>
            <div>
              <h2 style={{ fontSize: "18px", margin: 0 }}>
                {geselecteerdeStudent
                  ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam}`
                  : ""}{" "}
                — evaluatiedetail
              </h2>
            </div>
            <div className="chips" style={{ marginBottom: 0 }}>
              <button
                className={`chip${activeType === "tussentijds" ? " actief" : ""}`}
                onClick={() => setActiveType("tussentijds")}
              >
                Tussentijds
              </button>
              <button
                className={`chip${activeType === "finaal" ? " actief" : ""}`}
                onClick={() => setActiveType("finaal")}
              >
                Finaal
              </button>
            </div>
          </div>

          {loadingEval && (
            <div className="card">
              <p className="muted">Evaluatie laden...</p>
            </div>
          )}

          {!loadingEval && evalData && (
            <EvalDetail
              evalData={evalData}
              activeType={activeType}
              userId={user.id}
              onRefresh={() => loadEval(geselecteerdId)}
            />
          )}
        </div>
      )}
    </div>
  );
}
