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

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Evaluatie invullen</h1>
          <p>Beoordeel de competenties van je stagiair.</p>
        </div>
      </div>

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
    </div>
  );
}
