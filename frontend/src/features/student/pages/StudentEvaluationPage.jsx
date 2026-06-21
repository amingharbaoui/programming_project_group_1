import { useState, useEffect } from "react";
import api, { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { cacheGet, cacheSet, cacheDelete } from "../studentCache";
import "./StudentEvaluationPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconClipboardCheck, IconCircleCheck, IconAlertCircle,
  IconSend, IconDeviceFloppy, IconTrophy,
  IconChevronRight, IconPrinter, IconLock, IconPencil,
  IconCheck, IconDownload,
} from "@tabler/icons-react";

const SCORE_LBL = ["", "Onvoldoende", "Matig", "Voldoende", "Goed", "Uitstekend"];

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
}

/* ── Eval-track: 3 stappen ── */
function EvalTrack({ tussentijds, finale }) {
  function stapInfo(ev, fallbackLabel, fallbackSub) {
    if (!ev) return { status: "", label: fallbackLabel, sub: fallbackSub };
    const ingediend = !!ev.student_ingediend_op;
    const open = ev.status === "open";
    return {
      status: ingediend ? "done" : open ? "actief" : "",
      label: fallbackLabel,
      sub: ingediend
        ? `Ingediend op ${formatDatum(ev.student_ingediend_op)}`
        : open
        ? fallbackSub
        : "Nog niet geopend",
    };
  }

  const s1 = stapInfo(tussentijds, "Tussentijdse evaluatie", "In te vullen vóór het bedrijfsbezoek");
  const vrijgegeven = finale?.status === "vrijgegeven";
  const s2 = stapInfo(finale, "Finale zelfevaluatie", "Opent in de laatste stageweken");
  const s3 = {
    status: vrijgegeven ? "actief" : "",
    label: "Eindresultaat",
    sub: vrijgegeven
      ? `Vrijgegeven op ${formatDatum(finale?.vrijgegeven_op)}`
      : "Na je eindpresentatie",
  };

  const stappen = [s1, s2, s3];
  const iconen = {
    done: <IconCheck size={16} />,
    actief: <IconPencil size={16} />,
    "": <IconLock size={16} />,
  };

  return (
    <div className="card">
      <div className="eval-track">
        {stappen.map((s, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={`ev-stap${s.status ? " " + s.status : ""}`}>
              <div className="ev-circle">{iconen[s.status]}</div>
              <div className="ev-label">{s.label}</div>
              <div className="ev-sub">{s.sub}</div>
            </div>
            {i < stappen.length - 1 && <div className="ev-lijn" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Rol-badge ── */
const ROL_STIJL = {
  student: { background: "#e3effb", color: "#1e6fb8" },
  mentor:  { background: "var(--red-light)", color: "var(--red)" },
  docent:  { background: "#0a0a0a", color: "#fff" },
};
function RolBadge({ rol }) {
  const st = ROL_STIJL[rol] || { background: "var(--muted)", color: "var(--sub)" };
  return (
    <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 9, fontWeight: 700, letterSpacing: .2, ...st }}>
      {rol}
    </span>
  );
}

/* ── Score pilletje ── */
function Pil({ score, variant, leeg }) {
  if (!score || leeg) return <span className="m-sc leeg">–</span>;
  return (
    <span className="m-sc">
      <span className={`pil${variant ? " " + variant : ""}`}>
        {score}<span style={{ color: "var(--faint)", fontWeight: 400 }}>/5</span>
      </span>
    </span>
  );
}

/* ── Scorematrix ── */
function Matrix({ competenties, studentScores, mentorScores, docentScores, kanInvullen, vrijgegeven, leeg, onKlik }) {
  const kol3Label = vrijgegeven ? "Eind" : "docent";
  return (
    <div className="mtx">
      <div className="mtx-row mtx-head">
        <span />
        <span>Competentie</span>
        <span style={{ textAlign: "center" }}><RolBadge rol="student" /></span>
        <span style={{ textAlign: "center" }}><RolBadge rol="mentor" /></span>
        <span style={{ textAlign: "center" }}>
          {vrijgegeven ? "Eind" : <RolBadge rol="docent" />}
        </span>
        <span />
      </div>
      {competenties.map((c) => {
        const zScore = studentScores?.[c.id]?.score ?? null;
        const mScore = mentorScores?.[c.id] ?? null;
        const dScore = docentScores?.[c.id] ?? null;
        return (
          <div
            key={c.id}
            className={`mtx-row${kanInvullen ? " klik" : ""}`}
            onClick={() => kanInvullen && onKlik(c)}
          >
            <span className="m-code">{c.code}</span>
            <span className="m-naam">
              {c.naam}
              {c.gewicht_percentage != null && (
                <span style={{ display: "block", fontSize: 11, color: "var(--sub)", fontWeight: 400 }}>
                  Weging {c.gewicht_percentage}%
                </span>
              )}
            </span>
            <Pil score={zScore} variant="jij" leeg={leeg} />
            <Pil score={mScore} leeg={leeg} />
            <Pil score={dScore} variant={vrijgegeven ? "eind" : undefined} leeg={leeg} />
            <span className="m-chev">
              {kanInvullen && <IconChevronRight size={15} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Competentie-modal ── */
function CompModal({ competentie, huidigScore, huidigMot, onSave, onSluit }) {
  const [score, setScore] = useState(huidigScore ?? null);
  const [motivering, setMotivering] = useState(huidigMot ?? "");
  const [fout, setFout] = useState("");

  function handleSave() {
    // Motivering staat als verplicht (*) — dwing dat ook echt af, samen met een score.
    if (!score) { setFout("Kies eerst een score."); return; }
    if (!motivering.trim()) { setFout("Motivering is verplicht — verwijs naar concrete voorbeelden uit je logboek."); return; }
    setFout("");
    onSave(competentie.id, score, motivering);
    onSluit();
  }

  return (
    <Modal
      open={true}
      onClose={onSluit}
      icon="ti-clipboard-check"
      titel={`${competentie.code} · ${competentie.naam}`}
      footer={
        <>
          <button className="btn" onClick={onSluit}>Annuleren</button>
          <button className="btn primary" onClick={handleSave}>
            <IconDeviceFloppy size={16} />
            Opslaan
          </button>
        </>
      }
    >
      {competentie.beschrijving && (
        <p style={{ marginBottom: 14 }}>{competentie.beschrijving}</p>
      )}

      <div className="form_label" style={{ marginBottom: 6 }}>Jouw score</div>
      <div className="scale" style={{ marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`scale-btn${score && n <= score ? " selected" : ""}`}
            onClick={() => setScore(n)}
          >
            {n}
          </button>
        ))}
        <span className="scale-lbl">{score ? SCORE_LBL[score] : ""}</span>
      </div>

      <div className="form_group">
        <label className="form_label">
          Motivering <span style={{ color: "var(--red)" }}>*</span>
        </label>
        <textarea
          className="form_textarea"
          rows={3}
          placeholder="Verwijs naar concrete voorbeelden uit je logboek"
          value={motivering}
          onChange={(e) => setMotivering(e.target.value)}
        />
      </div>

      {fout && <p className="status s_rood" style={{ marginTop: 4 }}>{fout}</p>}
    </Modal>
  );
}

/* ══════════════════════════════════════
   Hoofdpagina
══════════════════════════════════════ */
export default function StudentEvaluationPage() {
  const { user } = useAuth();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [fout, setFout]           = useState(null);
  const [scores, setScores]       = useState({});   // { [compId]: { score, motivering } }
  const [bezig, setBezig]         = useState(false);
  const [melding, setMelding]     = useState(null);
  const [openComp, setOpenComp]   = useState(null); // competentie object
  const [activeType, setActiveType] = useState(null); // null = automatische keuze (tussentijds/finaal)

  async function laadData() {
    setLoading(true);
    setFout(null);
    try {
      const KEY = `student_evaluation_${user.id}`;
      const cached = cacheGet(KEY);
      const data = cached ?? (await apiRequest("GET", `/evaluations/${user.id}`)).data;
      if (!cached && data) cacheSet(KEY, data);
      setData(data);
      const actief = huidigeEval();
      if (actief) {
        const init = {};
        (actief.scores || []).filter((s) => s.rol === "student").forEach((s) => {
          init[s.competentie_id] = { score: s.score, motivering: s.motivering };
        });
        setScores(init);
      }
    } catch (err) {
      setFout(err.response?.data?.message || "Evaluaties konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { laadData(); }, []);

  function getActieveEval(evaluaties) {
    if (!evaluaties) return null;
    return evaluaties.find((e) => e.status === "open") || evaluaties[evaluaties.length - 1] || null;
  }

  // De evaluatie die nu getoond/bewerkt wordt: de gekozen tab, anders de automatische keuze.
  function huidigeEval() {
    const evs = data?.evaluaties;
    return (activeType && evs?.find((e) => e.type === activeType)) || getActieveEval(evs);
  }

  // Wisselen tussen tussentijdse en finale evaluatie: scores opnieuw inladen voor die evaluatie.
  function kiesTab(type) {
    setActiveType(type);
    const ev = data?.evaluaties?.find((e) => e.type === type);
    const init = {};
    (ev?.scores || []).filter((s) => s.rol === "student").forEach((s) => {
      init[s.competentie_id] = { score: s.score, motivering: s.motivering };
    });
    setScores(init);
  }

  async function handleDownloadEindoverzicht() {
    try {
      const res = await api.get("/students/me/eindoverzicht.pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "eindoverzicht.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMelding({ type: "fout", tekst: "Eindoverzicht downloaden mislukt." });
    }
  }

  function buildScoreMap(evaluatie, rol) {
    const map = {};
    (evaluatie?.scores || []).filter((s) => s.rol === rol).forEach((s) => {
      map[s.competentie_id] = s.score;
    });
    return map;
  }

  async function handleSaveScore(compId, score, motivering) {
    setScores((prev) => ({ ...prev, [compId]: { score, motivering } }));
    // Auto-opslaan in achtergrond
    const actief = huidigeEval();
    if (!actief) return;
    try {
      const allScores = { ...scores, [compId]: { score, motivering } };
      const payload = {
        ingediend: false,
        scores: (data?.competenties || []).map((c) => ({
          competentie_id: c.id,
          score: allScores[c.id]?.score ?? null,
          motivering: allScores[c.id]?.motivering ?? "",
        })),
      };
      await apiRequest("POST", `/evaluations/${actief.id}/scores`, payload);
    } catch (err) {
      // Autosave-fout zichtbaar maken i.p.v. stil inslikken — anders denkt de student dat het bewaard is.
      setMelding({ type: "fout", tekst: err.response?.data?.message || "Automatisch opslaan mislukt — probeer opnieuw of dien later in." });
    }
  }

  async function handleIndienen() {
    const actief = huidigeEval();
    if (!actief) return;
    // Indienen vereist per competentie zowel een score als een motivering (zoals de UI met * aangeeft).
    const comps = data?.competenties || [];
    const onvolledig = comps.find((c) => !scores[c.id]?.score || !String(scores[c.id]?.motivering || "").trim());
    if (onvolledig) {
      setMelding({ type: "fout", tekst: "Vul voor elke competentie een score én een motivering in voor je indient." });
      return;
    }
    setBezig(true);
    setMelding(null);
    try {
      const payload = {
        ingediend: true,
        scores: comps.map((c) => ({
          competentie_id: c.id,
          score: scores[c.id]?.score ?? null,
          motivering: scores[c.id]?.motivering ?? "",
        })),
      };
      await apiRequest("POST", `/evaluations/${actief.id}/scores`, payload);
      cacheDelete(`student_evaluation_${user.id}`);
      setMelding({ type: "ok", tekst: "Zelfevaluatie succesvol ingediend." });
      await laadData();
    } catch (err) {
      setMelding({ type: "fout", tekst: err.response?.data?.message || "Indienen mislukt." });
    } finally {
      setBezig(false);
    }
  }

  if (loading) return <div className="page-inner"><div className="laadbericht">Evaluaties laden…</div></div>;

  if (fout) return (
    <div className="page-inner">
      <div className="melding melding-fout"><IconAlertCircle size={15} /> {fout}</div>
    </div>
  );

  if (!data || !data.evaluaties || data.evaluaties.length === 0) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Evaluatie</h1><p>Competentieprofiel · Toegepaste Informatica 2025–2026</p></div>
        <div className="card">
          <div className="geen-data">
            <IconClipboardCheck size={36} />
            <p>Er zijn nog geen evaluaties beschikbaar. Je docent opent je evaluatie bij het bedrijfsbezoek.</p>
          </div>
        </div>
      </div>
    );
  }

  const { evaluaties, competenties } = data;
  const tussentijds = evaluaties.find((e) => e.type === "tussentijds") || null;
  const finale      = evaluaties.find((e) => e.type === "finaal")      || null;
  const actief      = huidigeEval();

  const isIngediend   = !!actief?.student_ingediend_op;
  const isVrijgegeven = actief?.status === "vrijgegeven";
  const kanInvullen   = actief?.status === "open" && !isIngediend;

  const ingevuld = competenties.filter((c) => scores[c.id]?.score).length;
  const totaal   = competenties.length;
  const allesIn  = ingevuld === totaal;

  const studentScoreMap = scores;
  const mentorScoreMap  = buildScoreMap(actief, "mentor");
  const docentScoreMap  = buildScoreMap(actief, "docent");

  return (
    <div className="page-inner">

      {openComp && (
        <CompModal
          competentie={openComp}
          huidigScore={scores[openComp.id]?.score ?? null}
          huidigMot={scores[openComp.id]?.motivering ?? ""}
          onSave={handleSaveScore}
          onSluit={() => setOpenComp(null)}
        />
      )}

      <div className="page-header">
        <h1>Evaluatie</h1>
        <p>Competentieprofiel · Toegepaste Informatica 2025–2026</p>
      </div>

      <EvalTrack tussentijds={tussentijds} finale={finale} />

      {tussentijds && finale && (
        <div className="actions" style={{ margin: "0 0 12px", gap: 8 }}>
          <button
            className={`btn sm${actief?.type === "tussentijds" ? " primary" : ""}`}
            onClick={() => kiesTab("tussentijds")}
          >
            Tussentijdse evaluatie
          </button>
          <button
            className={`btn sm${actief?.type === "finaal" ? " primary" : ""}`}
            onClick={() => kiesTab("finaal")}
          >
            Finale evaluatie
          </button>
        </div>
      )}

      {melding && (
        <div className={`melding melding-${melding.type === "ok" ? "ok" : "fout"}`}>
          {melding.type === "ok" ? <IconCircleCheck size={15} /> : <IconAlertCircle size={15} />}
          {melding.tekst}
        </div>
      )}

      {/* Banner: vrijgegeven */}
      {isVrijgegeven && (
        <div className="banner groen">
          <IconTrophy size={18} />
          <div>
            <div className="b-title">
              Eindresultaat{actief.eindcijfer != null ? `: ${Number(actief.eindcijfer).toFixed(1)}/20` : ""}
            </div>
            <div className="b-text">
              Vrijgegeven op {formatDatum(actief.vrijgegeven_op)}. Je scores per competentie staan in de matrix hieronder.
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary sm" onClick={handleDownloadEindoverzicht}>
                <IconDownload size={14} /> Eindoverzicht downloaden
              </button>
              <button className="btn sm" onClick={() => window.print()}>
                <IconPrinter size={14} /> Afdrukken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner: ingediend, wacht op verwerking */}
      {isIngediend && !isVrijgegeven && (
        <div className="banner groen">
          <IconCircleCheck size={18} />
          <div>
            <div className="b-title">Zelfevaluatie ingediend op {formatDatum(actief.student_ingediend_op)}</div>
            <div className="b-text">Je mentor en docent vullen hun deel in. De definitieve scores verschijnen hier na vrijgave.</div>
          </div>
        </div>
      )}

      {/* Banner: open, nog in te vullen */}
      {kanInvullen && (
        <>
          <div className="banner blauw">
            <IconClipboardCheck size={18} />
            <div>
              <div className="b-title">
                {actief.type === "tussentijds" ? "Tussentijdse zelfevaluatie" : "Finale zelfevaluatie"}
              </div>
              <div className="b-text">
                Klik op een competentie, geef jezelf een score op 5 en motiveer kort.
                Competenties niet ingevuld vóór de deadline tellen als <strong>0/5 — niet ingediend</strong>.
              </div>
            </div>
          </div>

          {/* Voortgang + indienen */}
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--sub)" }}>
              <strong>{ingevuld}/{totaal}</strong> competenties ingevuld
            </span>
            <button
              className="btn primary sm"
              disabled={!allesIn || bezig}
              title={!allesIn ? "Vul eerst alle competenties in" : ""}
              onClick={handleIndienen}
            >
              <IconSend size={14} />
              {bezig ? "Bezig…" : "Indienen"}
            </button>
          </div>
        </>
      )}

      {/* Rubric: scoreschaal — altijd zichtbaar (ook bij de finale/vrijgegeven evaluatie) */}
      <div className="scale-legend">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}><strong>{n}</strong> {SCORE_LBL[n]}</span>
        ))}
      </div>

      {/* Matrix */}
      <Matrix
        competenties={competenties}
        studentScores={studentScoreMap}
        mentorScores={mentorScoreMap}
        docentScores={docentScoreMap}
        kanInvullen={kanInvullen}
        vrijgegeven={isVrijgegeven}
        leeg={!kanInvullen && !isIngediend && !isVrijgegeven}
        onKlik={(c) => setOpenComp(c)}
      />

    </div>
  );
}
