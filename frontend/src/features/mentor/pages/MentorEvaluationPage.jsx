import { useState } from "react";

// Competenties — worden later dynamisch uit de backend gehaald.
// Voor nu: demo op basis van de database schema (4 competenties).
const COMPETENTIES = [
  { id: 1, code: "LO1", naam: "Zelfsturend leren" },
  { id: 2, code: "LO2", naam: "Professioneel communiceren" },
  { id: 3, code: "LO3", naam: "Probleemoplossend denken" },
  { id: 4, code: "LO4", naam: "Vakkennis toepassen" },
];

// Demo studenten voor de selector.
const DEMO_STUDENTEN = [
  { id: 1, naam: "Milan Peeters" },
  { id: 2, naam: "Lena Wouters" },
  { id: 3, naam: "Bram Claes" },
];

function ScoreKnoppen({ waarde, onChange }) {
  return (
    <div className="score_knoppen">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`score_knop${waarde === n ? " geselecteerd" : ""}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function EvalForm({ type, scores, setScores, onSubmit, bezig }) {
  return (
    <div className="card">
      <div className="card_title">
        {type === "tussentijds" ? "Tussentijdse evaluatie" : "Finale evaluatie"}
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "70px" }}>Code</th>
            <th>Competentie</th>
            <th style={{ width: "180px" }}>Score (1–5)</th>
          </tr>
        </thead>
        <tbody>
          {COMPETENTIES.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="status s_info">{c.code}</span>
              </td>
              <td>{c.naam}</td>
              <td>
                <ScoreKnoppen
                  waarde={scores[c.id] || null}
                  onChange={(val) =>
                    setScores((prev) => ({ ...prev, [c.id]: val }))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="form_group" style={{ marginTop: "16px" }}>
        <label className="form_label">Algemene feedback</label>
        <textarea
          className="form_textarea"
          placeholder="Schrijf hier je algemene evaluatie..."
          value={scores.__feedback || ""}
          onChange={(e) =>
            setScores((prev) => ({ ...prev, __feedback: e.target.value }))
          }
        />
      </div>

      <div className="actions" style={{ marginTop: "10px" }}>
        <button className="btn primary" disabled={bezig} onClick={onSubmit}>
          {bezig ? "Opslaan..." : "Evaluatie indienen"}
        </button>
      </div>
    </div>
  );
}

export default function MentorEvaluationPage() {
  const [studentId, setStudentId] = useState(1);
  const [activeTab, setActiveTab] = useState("tussentijds");

  const [scoresTussentijds, setScoresTussentijds] = useState({});
  const [scoresFinaal, setScoresFinaal] = useState({});
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");

  async function handleSubmit() {
    const scores = activeTab === "tussentijds" ? scoresTussentijds : scoresFinaal;
    const aantalIngevuld = COMPETENTIES.filter((c) => scores[c.id]).length;

    if (aantalIngevuld < COMPETENTIES.length) {
      setMelding("Geef voor elke competentie een score in.");
      return;
    }

    setBezig(true);
    setMelding("");

    // TODO: koppelen aan POST /api/evaluaties zodra backend klaar is.
    await new Promise((r) => setTimeout(r, 800));
    setMelding("Evaluatie opgeslagen! (demo — backend nog niet gekoppeld)");
    setBezig(false);
  }

  const geselecteerdeStudent = DEMO_STUDENTEN.find((s) => s.id === studentId);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluatie invullen</h1>
          <p>Beoordeel de competenties van een stagiair.</p>
        </div>
      </div>

      {/* Student selector */}
      <div className="card" style={{ marginBottom: "12px" }}>
        <div className="card_title">Student kiezen</div>
        <div className="form_group">
          <label className="form_label">Stagiair</label>
          <select
            className="form_input"
            value={studentId}
            onChange={(e) => setStudentId(Number(e.target.value))}
          >
            {DEMO_STUDENTEN.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type tabs */}
      <div className="chips" style={{ marginBottom: "12px" }}>
        <button
          className={`chip${activeTab === "tussentijds" ? " actief" : ""}`}
          onClick={() => setActiveTab("tussentijds")}
        >
          Tussentijds
        </button>
        <button
          className={`chip${activeTab === "finaal" ? " actief" : ""}`}
          onClick={() => setActiveTab("finaal")}
        >
          Finaal
        </button>
      </div>

      {melding && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <span className="status s_info">{melding}</span>
        </div>
      )}

      {activeTab === "tussentijds" ? (
        <EvalForm
          type="tussentijds"
          scores={scoresTussentijds}
          setScores={setScoresTussentijds}
          onSubmit={handleSubmit}
          bezig={bezig}
        />
      ) : (
        <EvalForm
          type="finaal"
          scores={scoresFinaal}
          setScores={setScoresFinaal}
          onSubmit={handleSubmit}
          bezig={bezig}
        />
      )}

      <div className="card" style={{ marginTop: "4px" }}>
        <p className="muted">
          Evaluatie voor: <strong>{geselecteerdeStudent?.naam}</strong> — type:{" "}
          <strong>{activeTab}</strong>
        </p>
      </div>
    </div>
  );
}
