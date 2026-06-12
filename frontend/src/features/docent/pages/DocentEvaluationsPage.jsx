import { useState } from "react";

// Competenties — later dynamisch uit backend.
const COMPETENTIES = [
  { id: 1, code: "LO1", naam: "Zelfsturend leren" },
  { id: 2, code: "LO2", naam: "Professioneel communiceren" },
  { id: 3, code: "LO3", naam: "Probleemoplossend denken" },
  { id: 4, code: "LO4", naam: "Vakkennis toepassen" },
];

// Demo evaluatiedata per student.
const DEMO_EVALUATIES = [
  {
    id: 1,
    student: "Milan Peeters",
    studentennummer: "202301234",
    tussentijds_mentor: { status: "ingediend", scores: { 1: 3, 2: 4, 3: 3, 4: 4 } },
    tussentijds_docent: { status: "open", scores: {} },
    finaal_mentor: { status: "niet_open", scores: {} },
    finaal_docent: { status: "niet_open", scores: {} },
  },
  {
    id: 2,
    student: "Lena Wouters",
    studentennummer: "202301235",
    tussentijds_mentor: { status: "ingediend", scores: { 1: 4, 2: 5, 3: 4, 4: 5 } },
    tussentijds_docent: { status: "geregistreerd", scores: { 1: 4, 2: 4, 3: 4, 4: 5 } },
    finaal_mentor: { status: "niet_open", scores: {} },
    finaal_docent: { status: "niet_open", scores: {} },
  },
  {
    id: 3,
    student: "Bram Claes",
    studentennummer: "202301236",
    tussentijds_mentor: { status: "niet_open", scores: {} },
    tussentijds_docent: { status: "niet_open", scores: {} },
    finaal_mentor: { status: "niet_open", scores: {} },
    finaal_docent: { status: "niet_open", scores: {} },
  },
];

function getStatusClass(status) {
  if (status === "ingediend") return "s_info";
  if (status === "geregistreerd") return "s_ok";
  if (status === "vrijgegeven") return "s_ok";
  if (status === "open") return "s_amber";
  if (status === "niet_open") return "s_grijs";
  return "s_grijs";
}

function getStatusLabel(status) {
  if (status === "ingediend") return "Ingediend";
  if (status === "geregistreerd") return "Geregistreerd";
  if (status === "vrijgegeven") return "Vrijgegeven";
  if (status === "open") return "Open";
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
          style={leesOnly ? { cursor: "default", opacity: waarde === n ? 1 : 0.4 } : {}}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function EvalDetail({ evaluatie, type }) {
  // type = "tussentijds" | "finaal"
  const mentorData = type === "tussentijds" ? evaluatie.tussentijds_mentor : evaluatie.finaal_mentor;
  const docentData = type === "tussentijds" ? evaluatie.tussentijds_docent : evaluatie.finaal_docent;

  const [docentScores, setDocentScores] = useState({ ...docentData.scores });
  const [feedback, setFeedback] = useState("");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");

  const kanInvullen = docentData.status === "open";

  async function handleSubmit() {
    const aantalIngevuld = COMPETENTIES.filter((c) => docentScores[c.id]).length;
    if (aantalIngevuld < COMPETENTIES.length) {
      setMelding("Geef voor elke competentie een score in.");
      return;
    }
    setBezig(true);
    setMelding("");
    // TODO: POST /api/evaluaties koppelen
    await new Promise((r) => setTimeout(r, 800));
    setMelding("Evaluatie opgeslagen! (demo — backend nog niet gekoppeld)");
    setBezig(false);
  }

  return (
    <div>
      <div className="grid_2" style={{ marginBottom: "12px" }}>
        {/* Mentorscores — read only */}
        <div className="card">
          <div className="card_title">
            Mentor{" "}
            <span className={`status ${getStatusClass(mentorData.status)}`}>
              {getStatusLabel(mentorData.status)}
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
              {COMPETENTIES.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="status s_info" style={{ marginRight: "6px" }}>
                      {c.code}
                    </span>
                    {c.naam}
                  </td>
                  <td>
                    <ScoreKnoppen
                      waarde={mentorData.scores[c.id] || null}
                      leesOnly
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Docentscores — bewerkbaar als open */}
        <div className="card">
          <div className="card_title">
            Docent{" "}
            <span className={`status ${getStatusClass(docentData.status)}`}>
              {getStatusLabel(docentData.status)}
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
              {COMPETENTIES.map((c) => (
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

          {kanInvullen && (
            <>
              <div className="form_group" style={{ marginTop: "14px" }}>
                <label className="form_label">Feedback docent</label>
                <textarea
                  className="form_textarea"
                  placeholder="Algemene feedback als docent..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
              {melding && (
                <p style={{ fontSize: "12px", color: "var(--sub)", margin: "6px 0" }}>
                  {melding}
                </p>
              )}
              <div className="actions" style={{ marginTop: "8px" }}>
                <button
                  className="btn primary"
                  disabled={bezig}
                  onClick={handleSubmit}
                >
                  {bezig ? "Opslaan..." : "Evaluatie registreren"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocentEvaluationsPage() {
  const [geselecteerd, setGeselecteerd] = useState(null);
  const [activeType, setActiveType] = useState("tussentijds");

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluaties</h1>
          <p>Bekijk en registreer evaluaties van studenten.</p>
        </div>
      </div>

      {/* Overzichtstabel */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card_title">Evaluatieoverzicht</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Student</th>
              <th>Tussentijds mentor</th>
              <th>Tussentijds docent</th>
              <th>Finaal mentor</th>
              <th>Finaal docent</th>
              <th className="right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_EVALUATIES.map((e) => (
              <tr
                key={e.id}
                style={{ cursor: "pointer" }}
                onClick={() => setGeselecteerd(e.id === geselecteerd ? null : e.id)}
              >
                <td>
                  <strong>{e.student}</strong>
                  <br />
                  <span className="muted">{e.studentennummer}</span>
                </td>
                <td>
                  <span className={`status ${getStatusClass(e.tussentijds_mentor.status)}`}>
                    {getStatusLabel(e.tussentijds_mentor.status)}
                  </span>
                </td>
                <td>
                  <span className={`status ${getStatusClass(e.tussentijds_docent.status)}`}>
                    {getStatusLabel(e.tussentijds_docent.status)}
                  </span>
                </td>
                <td>
                  <span className={`status ${getStatusClass(e.finaal_mentor.status)}`}>
                    {getStatusLabel(e.finaal_mentor.status)}
                  </span>
                </td>
                <td>
                  <span className={`status ${getStatusClass(e.finaal_docent.status)}`}>
                    {getStatusLabel(e.finaal_docent.status)}
                  </span>
                </td>
                <td className="right">
                  <button className="btn sm">
                    {geselecteerd === e.id ? "Sluiten" : "Bekijken"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail sectie */}
      {geselecteerd !== null && (() => {
        const eval_ = DEMO_EVALUATIES.find((e) => e.id === geselecteerd);
        if (!eval_) return null;
        return (
          <div>
            <div className="page_header" style={{ marginBottom: "10px" }}>
              <div>
                <h1 style={{ fontSize: "18px" }}>{eval_.student} — detail</h1>
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

            <EvalDetail evaluatie={eval_} type={activeType} />
          </div>
        );
      })()}
    </div>
  );
}
