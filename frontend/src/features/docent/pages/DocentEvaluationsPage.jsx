import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
}

/* Eén evaluatiemoment: docent scoort, berekent en geeft vrij. */
function DocentEvalForm({ evaluatie, competenties, onChanged }) {
  const docentScores = evaluatie.scores.filter((s) => s.rol === "docent");
  const mentorScores = evaluatie.scores.filter((s) => s.rol === "mentor");
  const studentScores = evaluatie.scores.filter((s) => s.rol === "student");

  const vrijgegeven = evaluatie.status === "vrijgegeven";
  const klaarVoorVrijgave = evaluatie.status === "klaar_voor_vrijgave";
  const berekend = klaarVoorVrijgave || evaluatie.status === "geregistreerd" || vrijgegeven;
  const kanInvullen = !berekend && evaluatie.status !== "niet_open";
  const kanBerekenen = kanInvullen; // pas berekenen nadat scores zijn ingevuld/ingediend

  const initScores = () =>
    competenties.reduce((acc, c) => {
      const b = docentScores.find((s) => s.competentie_id === c.id);
      acc[c.id] = { score: b?.score ?? null, motivering: b?.motivering ?? "" };
      return acc;
    }, {});

  const [scores, setScores] = useState(initScores);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [succes, setSucces] = useState(null);

  function upd(cId, val) {
    setScores((p) => ({ ...p, [cId]: { ...p[cId], score: val } }));
  }

  async function actie(fn, okMsg, refresh = true) {
    setBezig(true);
    setFout(null);
    setSucces(null);
    try {
      await fn();
      setSucces(okMsg);
      if (refresh) onChanged();
    } catch (err) {
      setFout(err.response?.data?.message || "Actie mislukt.");
    } finally {
      setBezig(false);
    }
  }

  const opslaan = (indienen) =>
    actie(
      () =>
        apiRequest("POST", `/evaluations/${evaluatie.id}/scores`, {
          ingediend: indienen,
          scores: competenties.map((c) => ({
            competentie_id: c.id,
            score: scores[c.id]?.score ?? null,
            motivering: scores[c.id]?.motivering ?? "",
          })),
        }),
      indienen ? "Scores ingediend." : "Opgeslagen.",
      indienen
    );

  const berekenen = () =>
    actie(() => apiRequest("POST", `/evaluations/${evaluatie.id}/calculate`),
      evaluatie.type === "finaal" ? "Eindresultaat berekend." : "Tussentijdse evaluatie geregistreerd.");

  const vrijgeven = () =>
    actie(() => apiRequest("POST", `/evaluations/${evaluatie.id}/release`), "Eindresultaat vrijgegeven.");

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card_title">
        {evaluatie.type === "tussentijds" ? "Tussentijdse evaluatie" : "Finale evaluatie"}{" "}
        <span className="status s_info">{evaluatie.status}</span>
        {evaluatie.eindcijfer != null && (
          <span className="status s_ok" style={{ marginLeft: 8 }}>Eindcijfer {Number(evaluatie.eindcijfer).toFixed(1)}/20</span>
        )}
      </div>

      {fout && <div className="status s_amber" style={{ display: "block", marginBottom: 8 }}>{fout}</div>}
      {succes && <div className="status s_ok" style={{ display: "block", marginBottom: 8 }}>{succes}</div>}

      <table className="tbl">
        <thead>
          <tr>
            <th>Competentie</th>
            <th>Student</th>
            <th>Mentor</th>
            <th style={{ width: 120 }}>Jouw score (0–20)</th>
          </tr>
        </thead>
        <tbody>
          {competenties.map((c) => {
            const ss = studentScores.find((s) => s.competentie_id === c.id);
            const ms = mentorScores.find((s) => s.competentie_id === c.id);
            const ds = docentScores.find((s) => s.competentie_id === c.id);
            return (
              <tr key={c.id}>
                <td>
                  <span className="status s_info">{c.code}</span> {c.naam}{" "}
                  <span className="muted">{c.gewicht_percentage}%</span>
                </td>
                <td>{ss?.score ?? "–"}</td>
                <td>{ms?.score ?? "–"}</td>
                <td>
                  {kanInvullen ? (
                    <input
                      type="number" min="0" max="20" step="0.5" className="form_input" style={{ width: 90 }}
                      value={scores[c.id]?.score ?? ""}
                      disabled={bezig}
                      onChange={(e) => upd(c.id, e.target.value === "" ? null : Number(e.target.value))}
                    />
                  ) : (
                    <strong>{ds?.score ?? "–"}</strong>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="actions" style={{ marginTop: 10 }}>
        {kanInvullen && <button className="btn" disabled={bezig} onClick={() => opslaan(false)}>Opslaan</button>}
        {kanInvullen && <button className="btn primary" disabled={bezig} onClick={() => opslaan(true)}>Indienen</button>}
        {kanBerekenen && (
          <button className="btn primary" disabled={bezig} onClick={berekenen}>
            {evaluatie.type === "finaal" ? "Eindresultaat berekenen" : "Registreren"}
          </button>
        )}
        {klaarVoorVrijgave && <button className="btn primary" disabled={bezig} onClick={vrijgeven}>Vrijgeven</button>}
        {vrijgegeven && <span className="status s_ok">Vrijgegeven op {formatDatum(evaluatie.vrijgegeven_op)}</span>}
      </div>
    </div>
  );
}

export default function DocentEvaluationsPage() {
  const { user } = useAuth();
  const [studenten, setStudenten] = useState([]);
  const [studentId, setStudentId] = useState(null);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  const [bezigOpen, setBezigOpen] = useState(false);

  // herbruikbaar voor de handlers (verversen na scores/berekenen/vrijgeven)
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

  async function openEval(type) {
    if (!data?.stagedossierId) return;
    setBezigOpen(true);
    setFout(null);
    try {
      await apiRequest("POST", "/evaluations/open", { stagedossierId: data.stagedossierId, type });
      await laadEvaluaties();
    } catch (err) {
      setFout(err.response?.data?.message || "Evaluatie openen mislukt.");
    } finally {
      setBezigOpen(false);
    }
  }

  const heeft = (type) => data?.evaluaties.some((e) => e.type === type);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluaties</h1>
          <p>Beoordeel, bereken en geef het eindresultaat vrij.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card_title">Student kiezen</div>
        {studenten.length === 0 ? (
          <p className="muted">Geen toegewezen studenten gevonden.</p>
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

      {data && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card_title">Evaluatiemomenten</div>
          <div className="actions">
            {!heeft("tussentijds") && <button className="btn" disabled={bezigOpen} onClick={() => openEval("tussentijds")}>Open tussentijdse evaluatie</button>}
            {!heeft("finaal") && <button className="btn" disabled={bezigOpen} onClick={() => openEval("finaal")}>Open finale evaluatie</button>}
            {heeft("tussentijds") && heeft("finaal") && <span className="muted">Beide evaluatiemomenten zijn geopend.</span>}
          </div>
        </div>
      )}

      {data && data.evaluaties.map((ev) => (
        <DocentEvalForm key={ev.id} evaluatie={ev} competenties={data.competenties} onChanged={laadEvaluaties} />
      ))}
    </div>
  );
}
