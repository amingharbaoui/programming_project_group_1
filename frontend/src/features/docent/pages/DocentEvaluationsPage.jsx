import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../docent.css";

function getEvalStatusClass(status) {
  if (status === "open") return "s-amber";
  if (status === "student_ingediend") return "s-info";
  if (status === "mentor_ingediend") return "s-amber";
  if (status === "geregistreerd") return "s-ok";
  if (status === "klaar_voor_vrijgave") return "s-ok";
  if (status === "vrijgegeven") return "s-ok";
  if (status === "niet_open") return "s-grijs";
  return "s-grijs";
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
    <div className="scale">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`scale-btn${waarde === n ? " selected" : ""}`}
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

function ScoreDisplay({ waarde }) {
  if (!waarde) return <span style={{ color: "var(--faint)", fontSize: "12px" }}>—</span>;
  return (
    <span style={{ fontSize: "13px", fontWeight: 600 }}>
      {waarde}
      <span style={{ color: "var(--faint)", fontWeight: 400, fontSize: "10px" }}>/5</span>
    </span>
  );
}

function EvalDetail({ evalData, activeType, userId, onRefresh }) {
  const evaluatie = evalData?.evaluaties?.find((e) => e.type === activeType) || null;
  const competenties = evalData?.competenties || [];

  const studentScoresMap = {};
  const mentorScoresMap = {};
  const docentScoresBestaand = {};
  const docentMotiveringenBestaand = {};
  if (evaluatie) {
    for (const s of evaluatie.scores || []) {
      if (s.rol === "student") studentScoresMap[s.competentie_id] = s.score;
      if (s.rol === "mentor") mentorScoresMap[s.competentie_id] = s.score;
      if (s.rol === "docent") {
        docentScoresBestaand[s.competentie_id] = s.score;
        if (s.motivering) docentMotiveringenBestaand[s.competentie_id] = s.motivering;
      }
    }
  }

  const [docentScores, setDocentScores] = useState({ ...docentScoresBestaand });
  const [docentMotiveringen, setDocentMotiveringen] = useState({ ...docentMotiveringenBestaand });
  const [verslag, setVerslag] = useState(evaluatie?.verslag ?? "");
  const [eindpresentatieScore, setEindpresentatieScore] = useState(evaluatie?.eindpresentatie_score ?? null);
  const [bezig, setBezig]   = useState(false);
  const [melding, setMelding] = useState({ tekst: "", type: "" });
  const [vrijgaveMelding, setVrijgaveMelding] = useState({ tekst: "", type: "" });

  // Reset scores als evaluatie verandert
  useEffect(() => {
    const nieuw = {};
    const nieuweMot = {};
    if (evaluatie) {
      for (const s of evaluatie.scores || []) {
        if (s.rol === "docent") {
          nieuw[s.competentie_id] = s.score;
          if (s.motivering) nieuweMot[s.competentie_id] = s.motivering;
        }
      }
    }
    setDocentScores(nieuw);
    setDocentMotiveringen(nieuweMot);
    setVerslag(evaluatie?.verslag ?? "");
    setEindpresentatieScore(evaluatie?.eindpresentatie_score ?? null);
    setMelding({ tekst: "", type: "" });
    setVrijgaveMelding({ tekst: "", type: "" });
  }, [evaluatie?.id]);

  const kanInvullen =
    evaluatie &&
    !["niet_open", "vrijgegeven", "geregistreerd", "klaar_voor_vrijgave"].includes(evaluatie.status);

  async function handleOpslaan() {
    if (!evaluatie) return;
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: docentMotiveringen[c.id] || "",
    }));
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(
        `/evaluations/${evaluatie.id}/scores`,
        { scores: scoresArr, ingediend: false },
        {}
      );
      setMelding({ tekst: "Scores opgeslagen.", type: "s-ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s-rood" });
    } finally {
      setBezig(false);
    }
  }

  async function handleVrijgeven() {
    if (!evaluatie) return;
    if (!window.confirm("Ben je zeker dat je het eindresultaat wil vrijgeven? De student zal dit kunnen zien.")) return;
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.post(`/evaluations/${evaluatie.id}/release`, {});
      setVrijgaveMelding({ tekst: "Eindresultaat vrijgegeven!", type: "s-ok" });
      onRefresh && onRefresh();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Vrijgeven mislukt", type: "s-rood" });
    } finally {
      setBezig(false);
    }
  }

  async function handleRegistreren() {
    if (!evaluatie) return;
    const missing = competenties.filter((c) => !docentScores[c.id]);
    if (missing.length > 0) {
      setMelding({ tekst: "Geef voor elke competentie een score in.", type: "s-amber" });
      return;
    }
    if (activeType === "finaal" && (eindpresentatieScore === null || eindpresentatieScore === "" || eindpresentatieScore === undefined)) {
      setMelding({ tekst: "Geef een score (0–20) voor de eindpresentatie in.", type: "s-amber" });
      return;
    }
    // Eerst scores opslaan
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: docentMotiveringen[c.id] || "",
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
        {
          eindpresentatieScore: activeType === "finaal" ? eindpresentatieScore : null,
          verslag: verslag?.trim() ? verslag.trim() : null,
        },
        {}
      );
      setMelding({ tekst: "Evaluatie geregistreerd!", type: "s-ok" });
      onRefresh && onRefresh();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Registreren mislukt", type: "s-rood" });
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
    <>
    {/* Matrix — Student · Mentor · Docent scores in één tabel */}
    <div className="card" style={{ marginBottom: "12px" }}>
      <div className="card-title">
        Competenties{" "}
        <span className={`status ${getEvalStatusClass(evaluatie.status)}`}>
          {getEvalStatusLabel(evaluatie.status)}
        </span>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: "52px" }}>Code</th>
            <th>Competentie</th>
            <th style={{ width: "72px", textAlign: "center" }}>Student</th>
            <th style={{ width: "72px", textAlign: "center" }}>Mentor</th>
            <th style={{ width: kanInvullen ? "200px" : "72px", textAlign: "center" }}>Docent</th>
          </tr>
        </thead>
        <tbody>
          {competenties.map((c) => (
            <tr key={c.id}>
              <td><span className="status s-info">{c.code}</span></td>
              <td>{c.naam}</td>
              <td style={{ textAlign: "center" }}>
                <ScoreDisplay waarde={studentScoresMap[c.id]} />
              </td>
              <td style={{ textAlign: "center" }}>
                <ScoreDisplay waarde={mentorScoresMap[c.id]} />
              </td>
              <td style={{ textAlign: kanInvullen ? "left" : "center" }}>
                {kanInvullen ? (
                  <>
                    <ScoreKnoppen
                      waarde={docentScores[c.id] || null}
                      onChange={(val) =>
                        setDocentScores((prev) => ({ ...prev, [c.id]: val }))
                      }
                    />
                    <input
                      className="form_input"
                      type="text"
                      value={docentMotiveringen[c.id] || ""}
                      onChange={(e) =>
                        setDocentMotiveringen((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Motivering (optioneel)"
                      style={{ marginTop: 6, fontSize: "12px", padding: "4px 6px" }}
                    />
                  </>
                ) : (
                  <>
                    <ScoreDisplay waarde={docentScores[c.id]} />
                    {docentMotiveringenBestaand[c.id] && (
                      <div style={{ fontSize: "11.5px", color: "var(--sub)", marginTop: 4 }}>
                        {docentMotiveringenBestaand[c.id]}
                      </div>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legende */}
      <div style={{
        fontSize: "11.5px", color: "var(--sub)", marginTop: "10px",
        borderTop: "0.5px solid var(--border)", paddingTop: "8px",
        display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center"
      }}>
        <strong style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Legende</strong>
        <span>1 Onvoldoende · 2 Matig · 3 Voldoende · 4 Goed · 5 Uitstekend</span>
      </div>

      {melding.tekst && (
        <div style={{ marginTop: "10px" }}>
          <span className={`status ${melding.type}`}>{melding.tekst}</span>
        </div>
      )}

      {kanInvullen && (
        <div className="form_group" style={{ marginTop: "14px" }}>
          <label className="form_label">
            Verslag van de {activeType === "tussentijds" ? "tussentijdse bespreking" : "finale bespreking"} (optioneel)
          </label>
          <textarea
            className="form_input"
            rows={4}
            value={verslag}
            onChange={(e) => setVerslag(e.target.value)}
            style={{ resize: "vertical" }}
            placeholder="Noteer hier de bespreking met student en mentor..."
          />
        </div>
      )}

      {kanInvullen && activeType === "finaal" && (
        <div className="form_group" style={{ marginTop: "14px" }}>
          <label className="form_label">Eindpresentatie score op 20 (werkstuk · 20%) <span style={{ color: "var(--red)" }}>*</span></label>
          <input
            className="form_input"
            type="number"
            min="0"
            max="20"
            step="0.5"
            style={{ maxWidth: 140 }}
            value={eindpresentatieScore ?? ""}
            onChange={(e) => setEindpresentatieScore(e.target.value === "" ? null : Number(e.target.value))}
          />
          <p style={{ fontSize: "11.5px", color: "var(--sub)", marginTop: "4px" }}>
            Eindcijfer (op 20) = competentiescore×4 × 80% + presentatiescore × 20%
          </p>
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
          {["geregistreerd", "klaar_voor_vrijgave", "vrijgegeven"].includes(evaluatie.status)
            ? "Evaluatie is geregistreerd."
            : `Evaluatie is ${getEvalStatusLabel(evaluatie.status).toLowerCase()}.`}
        </p>
      )}
    </div>

    {/* Story 43 — Eindresultaatkaart na finale registratie */}
    {activeType === "finaal" && ["klaar_voor_vrijgave", "vrijgegeven"].includes(evaluatie.status) && (
      <div className="card" style={{ border: "1.5px solid var(--dark)", boxShadow: "0 4px 14px rgba(0,0,0,.08)" }}>
        <div className="card-title">
          Eindresultaat{" "}
          <span className={`status ${getEvalStatusClass(evaluatie.status)}`}>
            {getEvalStatusLabel(evaluatie.status)}
          </span>
        </div>

        <div className="grid-2" style={{ marginBottom: "12px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11.5px", color: "var(--sub)", marginBottom: "6px" }}>
              Competentiescore
            </div>
            <div style={{ fontSize: "26px", fontWeight: 600, color: "var(--red)" }}>
              {evaluatie.competentie_score ?? "—"}
              {evaluatie.competentie_score && (
                <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--faint)" }}>/5</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11.5px", color: "var(--sub)", marginBottom: "6px" }}>
              Eindcijfer
            </div>
            <div style={{ fontSize: "26px", fontWeight: 600, color: "var(--red)" }}>
              {evaluatie.eindcijfer ?? "—"}
              {evaluatie.eindcijfer && (
                <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--faint)" }}>/20</span>
              )}
            </div>
          </div>
        </div>

        {vrijgaveMelding.tekst && (
          <div style={{ marginTop: "10px" }}>
            <span className={`status ${vrijgaveMelding.type}`}>{vrijgaveMelding.tekst}</span>
          </div>
        )}

        {/* Story 44 — Vrijgeven knop */}
        {evaluatie.status === "klaar_voor_vrijgave" && (
          <>
            <div style={{ fontSize: "12px", color: "var(--sub)", marginBottom: "12px", display: "flex", gap: "7px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--amber)" }}>⚠</span>
              <span>Na vrijgave kan de student het resultaat bekijken. Dit kan niet meer ongedaan gemaakt worden.</span>
            </div>
            <div className="actions">
              <button className="btn primary" disabled={bezig} onClick={handleVrijgeven}>
                {bezig ? "Bezig..." : "Eindresultaat vrijgeven"}
              </button>
            </div>
          </>
        )}

        {evaluatie.status === "vrijgegeven" && (
          <p className="muted" style={{ fontSize: "13px", display: "flex", gap: "6px", alignItems: "center" }}>
            <span style={{ color: "var(--green)" }}>✓</span>
            Eindresultaat is vrijgegeven — de student kan het resultaat bekijken.
          </p>
        )}
      </div>
    )}
    </>
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
    <div className="doc">
    <div className="page-inner">
      <div className="page-header">
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
        <div className="card"><p className="muted">Geen studenten gevonden.</p></div>
      )}

      {!loading && studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="card-title">Studenten ({studenten.length})</div>
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
          <div className="page-header" style={{ marginBottom: "10px" }}>
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
                className={`chip${activeType === "tussentijds" ? " aan" : ""}`}
                onClick={() => setActiveType("tussentijds")}
              >
                Tussentijds
              </button>
              <button
                className={`chip${activeType === "finaal" ? " aan" : ""}`}
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
    </div>
  );
}
