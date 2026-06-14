import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./StudentEvaluationPage.css";
import {
  IconClipboardCheck,
  IconCircleCheck,
  IconAlertCircle,
  IconClock,
  IconSend,
  IconDeviceFloppy,
  IconStar,
  IconTrophy,
} from "@tabler/icons-react";

/* ── Helpers ── */
function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
}

/* ── Status badge evaluatie ── */
const STATUS_MAP = {
  niet_open:          ["badge-grijs",  "Nog niet open"],
  open:               ["badge-blauw",  "Open"],
  student_ingediend:  ["badge-geel",   "Ingediend door jou"],
  mentor_ingediend:   ["badge-geel",   "Mentor ingediend"],
  klaar_voor_docent:  ["badge-blauw",  "Bij docent"],
  geregistreerd:      ["badge-groen",  "Geregistreerd"],
  klaar_voor_vrijgave:["badge-geel",   "Wacht op vrijgave"],
  vrijgegeven:        ["badge-groen",  "Vrijgegeven"],
};

function StatusBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["badge-grijs", status ?? "–"];
  return <span className={`ev-badge ${cls}`}>{label}</span>;
}

/* ── Score input (0–20) ── */
function ScoreInput({ value, onChange, disabled }) {
  return (
    <div className="score-input-wrap">
      <input
        type="number"
        min="0"
        max="20"
        step="0.5"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
        className="score-input"
        placeholder="0–20"
      />
      <span className="score-max">/20</span>
    </div>
  );
}

/* ── Evaluatie formulier voor één evaluatiemoment ── */
function EvaluatieFormulier({ evaluatie, competenties, userId, onIngediend }) {
  const isIngediend = !!evaluatie.student_ingediend_op;
  const isVrijgegeven = evaluatie.status === "vrijgegeven";
  const kanInvullen = evaluatie.status === "open" && !isIngediend;

  /* Huidige student scores uit de data */
  const studentScores = evaluatie.scores.filter((s) => s.rol === "student");

  const initScores = () =>
    competenties.reduce((acc, c) => {
      const bestaand = studentScores.find((s) => s.competentie_id === c.id);
      acc[c.id] = { score: bestaand?.score ?? null, motivering: bestaand?.motivering ?? "" };
      return acc;
    }, {});

  const [scores, setScores] = useState(initScores);
  const [bezig, setBezig]   = useState(false);
  const [fout, setFout]     = useState(null);
  const [succes, setSucces] = useState(null);

  function updateScore(cId, veld, waarde) {
    setScores((prev) => ({ ...prev, [cId]: { ...prev[cId], [veld]: waarde } }));
  }

  async function opslaan(indienen = false) {
    setBezig(true);
    setFout(null);
    setSucces(null);
    try {
      const payload = {
        ingediend: indienen,
        scores: competenties.map((c) => ({
          competentie_id: c.id,
          score: scores[c.id]?.score ?? null,
          motivering: scores[c.id]?.motivering ?? "",
        })),
      };
      await apiRequest("POST", `/evaluations/${evaluatie.id}/scores`, payload);
      setSucces(indienen ? "Zelfevaluatie succesvol ingediend." : "Scores opgeslagen.");
      if (indienen) onIngediend();
    } catch (err) {
      setFout(err.response?.data?.message || "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  }

  /* ── Eindresultaat sectie (alleen als vrijgegeven) ── */
  if (isVrijgegeven) {
    const docentScores = evaluatie.scores.filter((s) => s.rol === "docent");
    return (
      <div className="ev-formulier">
        <div className="ev-resultaat-header">
          <IconTrophy size={22} className="trophy-icon" />
          <div>
            <div className="ev-resultaat-titel">Eindresultaat</div>
            <div className="ev-resultaat-datum">Vrijgegeven op {formatDatum(evaluatie.vrijgegeven_op)}</div>
          </div>
          {evaluatie.eindcijfer !== null && (
            <div className="ev-eindcijfer">{Number(evaluatie.eindcijfer).toFixed(1)}<span>/20</span></div>
          )}
        </div>

        <div className="ev-scores-overzicht">
          {competenties.map((c) => {
            const mijnScore   = studentScores.find((s) => s.competentie_id === c.id);
            const docentScore = docentScores.find((s) => s.competentie_id === c.id);
            return (
              <div key={c.id} className="ev-score-rij">
                <div className="ev-score-competentie">
                  <span className="ev-code">{c.code}</span>
                  <span className="ev-naam">{c.naam}</span>
                  <span className="ev-gewicht">{c.gewicht_percentage}%</span>
                </div>
                <div className="ev-score-kolommen">
                  <div className="ev-score-kolom">
                    <div className="ev-kolom-label">Jouw score</div>
                    <div className="ev-kolom-waarde">{mijnScore?.score ?? "–"}</div>
                  </div>
                  <div className="ev-score-kolom">
                    <div className="ev-kolom-label">Docent</div>
                    <div className="ev-kolom-waarde highlight">{docentScore?.score ?? "–"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Readonly weergave na indienen ── */
  if (isIngediend) {
    return (
      <div className="ev-formulier">
        <div className="ev-ingediend-melding">
          <IconCircleCheck size={18} />
          Zelfevaluatie ingediend op {formatDatum(evaluatie.student_ingediend_op)}. Wacht op verdere verwerking.
        </div>
        <div className="ev-readonly-lijst">
          {competenties.map((c) => {
            const s = studentScores.find((x) => x.competentie_id === c.id);
            return (
              <div key={c.id} className="ev-readonly-rij">
                <div className="ev-readonly-header">
                  <span className="ev-code">{c.code}</span>
                  <span className="ev-naam">{c.naam}</span>
                  <span className="ev-score-pill">{s?.score ?? "–"}/20</span>
                </div>
                {s?.motivering && <p className="ev-readonly-motivering">{s.motivering}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Invulformulier ── */
  if (!kanInvullen) {
    return (
      <div className="ev-formulier">
        <div className="ev-nog-niet">
          <IconClock size={18} />
          Deze evaluatie is nog niet geopend.
        </div>
      </div>
    );
  }

  return (
    <div className="ev-formulier">
      {fout   && <div className="melding melding-fout"><IconAlertCircle size={15} /> {fout}</div>}
      {succes && <div className="melding melding-ok"><IconCircleCheck size={15} /> {succes}</div>}

      <div className="ev-competenties">
        {competenties.map((c) => (
          <div key={c.id} className="ev-competentie-kaart">
            <div className="ev-competentie-info">
              <span className="ev-code">{c.code}</span>
              <span className="ev-naam">{c.naam}</span>
              <span className="ev-gewicht">{c.gewicht_percentage}%</span>
            </div>
            {c.beschrijving && <p className="ev-beschrijving">{c.beschrijving}</p>}
            <div className="ev-invul-rij">
              <div className="ev-invul-veld">
                <label className="ev-label">Score</label>
                <ScoreInput
                  value={scores[c.id]?.score}
                  onChange={(v) => updateScore(c.id, "score", v)}
                  disabled={bezig}
                />
              </div>
              <div className="ev-invul-veld ev-invul-motivering">
                <label className="ev-label">Motivering</label>
                <textarea
                  className="ev-textarea"
                  placeholder="Licht je score toe…"
                  value={scores[c.id]?.motivering ?? ""}
                  onChange={(e) => updateScore(c.id, "motivering", e.target.value)}
                  disabled={bezig}
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ev-acties">
        <button className="btn-opslaan" onClick={() => opslaan(false)} disabled={bezig}>
          <IconDeviceFloppy size={16} />
          {bezig ? "Bezig…" : "Opslaan"}
        </button>
        <button className="btn-indienen" onClick={() => opslaan(true)} disabled={bezig}>
          <IconSend size={16} />
          {bezig ? "Bezig…" : "Indienen"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Hoofdpagina
══════════════════════════════════════════ */
export default function StudentEvaluationPage() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [fout, setFout]       = useState(null);

  useEffect(() => { laadData(); }, []);

  async function laadData() {
    setLoading(true);
    setFout(null);
    try {
      const res = await apiRequest("GET", `/evaluations/${user.id}`);
      setData(res.data);
    } catch (err) {
      setFout(err.response?.data?.message || "Evaluaties konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="ev-page"><div className="laadbericht">Evaluaties laden…</div></div>;

  if (fout) return (
    <div className="ev-page">
      <div className="melding melding-fout"><IconAlertCircle size={15} /> {fout}</div>
    </div>
  );

  if (!data || data.evaluaties.length === 0) {
    return (
      <div className="ev-page">
        <div className="geen-data">
          <IconClipboardCheck size={40} />
          <p>Er zijn nog geen evaluaties beschikbaar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ev-page">
      {data.evaluaties.map((ev) => (
        <div key={ev.id} className="ev-sectie">
          <div className="ev-sectie-header">
            <div>
              <h2 className="ev-type">
                {ev.type === "tussentijds" ? "Tussentijdse evaluatie" : "Finale evaluatie"}
              </h2>
              {ev.student_ingediend_op && (
                <p className="ev-datum">Ingediend op {formatDatum(ev.student_ingediend_op)}</p>
              )}
            </div>
            <StatusBadge status={ev.status} />
          </div>

          <EvaluatieFormulier
            evaluatie={ev}
            competenties={data.competenties}
            userId={user.id}
            onIngediend={laadData}
          />
        </div>
      ))}
    </div>
  );
}
