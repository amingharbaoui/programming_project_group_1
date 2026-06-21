import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentEvaluationsPage.css";
import { IconCircleCheck, IconEye, IconX } from "@tabler/icons-react";
import { cacheGet, cacheSet, cacheDelete } from "../docentCache";

// Alle mogelijke statussen van evaluaties:
// niet_open · open · student_ingediend · mentor_ingediend · klaar_voor_docent
// geregistreerd · klaar_voor_vrijgave · vrijgegeven
function getEvalStatusClass(status) {
  if (status === "vrijgegeven" || status === "geregistreerd") return "s_ok";
  if (status === "klaar_voor_vrijgave") return "s_ok";
  if (status === "klaar_voor_docent") return "s_amber"; // actie vereist van docent
  if (status === "mentor_ingediend") return "s_info";
  if (status === "student_ingediend") return "s_info";
  if (status === "open") return "s_grijs";
  if (status === "niet_open") return "s_grijs";
  return "s_grijs";
}

function getEvalStatusLabel(status) {
  const labels = {
    niet_open:          "Nog niet beschikbaar",
    open:               "Geopend",
    student_ingediend:  "Student ingediend",
    mentor_ingediend:   "Mentor ingediend",
    klaar_voor_docent:  "Klaar om in te vullen",
    geregistreerd:      "Geregistreerd",
    klaar_voor_vrijgave:"Klaar om vrij te geven",
    vrijgegeven:        "Vrijgegeven",
  };
  return labels[status] || status || "-";
}

// Korte fase-omschrijving van het dossier voor de evaluatielijst.
function faseLabelKort(status) {
  if (["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(status)) return "Afgerond";
  if (["actief", "stage_loopt"].includes(status)) return "Stage loopt";
  if (status === "geregistreerd") return "Startklaar";
  if (status === "document_afgekeurd") return "Document afgekeurd";
  if (status === "in_controle_bij_administratie") return "In controle";
  if (status === "wacht_op_bedrijf") return "Wacht op ondertekening";
  if (status === "wacht_op_student") return "Wacht op student";
  return status || "—";
}

// Evaluatie-actie/-status per student, afgeleid uit de velden van /docent/students.
function evalActieBadge(s) {
  if (["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(s.dossier_status)) return { cls: "s_grijs", txt: "Afgerond" };
  if (Number(s.eval_te_vrijgeven) > 0) return { cls: "s_rood", txt: "Vrij te geven" };
  if (Number(s.eval_te_registreren) > 0) return { cls: "s_rood", txt: "Te registreren" };
  if (s.actie_type === "evaluatie") return { cls: "s_amber", txt: s.volgende_actie || "Actie nodig" };
  if (["geregistreerd", "stage_loopt", "actief"].includes(s.dossier_status)) return { cls: "s_grijs", txt: "Geen open actie" };
  return { cls: "s_grijs", txt: "Nog niet van toepassing" };
}

function ScoreKnoppen({ waarde, onChange, leesOnly }) {
  return (
    <div className="doc_scale">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`doc_scale_btn${waarde === n ? " selected" : ""}`}
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

function EvalDetail({ evalData, activeType, userId, onRefresh, stagedossierId, dossierStatus }) {
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
  const [foutModal, setFoutModal] = useState("");
  const [succesModal, setSuccesModal] = useState("");
  const [motOpen, setMotOpen] = useState({});

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

  // De docent vult pas in nadat student én mentor hebben ingediend (status klaar_voor_docent).
  const kanInvullen =
    evaluatie &&
    evaluatie.status === "klaar_voor_docent";

  async function handleOpslaan() {
    if (!evaluatie) return;
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: docentMotiveringen[c.id] || "",
    }));
    try {
      setBezig(true);
      await api.post(
        `/evaluations/${evaluatie.id}/scores`,
        { scores: scoresArr, ingediend: false },
        {}
      );
      onRefresh && onRefresh();
      // Concept-save bewaart enkel de competentiescores; verslag en eindpresentatiescore worden pas
      // bij Registreren weggeschreven — dat hier eerlijk vermelden.
      setSuccesModal("Competentiescores opgeslagen. Het verslag en de eindpresentatiescore bewaar je bij 'Registreren'.");
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Opslaan mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function handleVrijgeven() {
    if (!evaluatie) return;
    if (!window.confirm("Ben je zeker dat je het eindresultaat wil vrijgeven? De student zal dit kunnen zien.")) return;
    try {
      setBezig(true);
      await api.post(`/evaluations/${evaluatie.id}/release`, {});
      setVrijgaveMelding({ tekst: "Eindresultaat vrijgegeven!", type: "s_ok" });
      onRefresh && onRefresh();
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Vrijgeven mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function handleRegistreren() {
    if (!evaluatie) return;
    const missing = competenties.filter((c) => !docentScores[c.id]);
    if (missing.length > 0) {
      setFoutModal("Geef voor elke competentie een score in.");
      return;
    }
    if (activeType === "finaal" && (eindpresentatieScore === null || eindpresentatieScore === "" || eindpresentatieScore === undefined)) {
      setFoutModal("Geef een score (0–20) voor de eindpresentatie in.");
      return;
    }
    const scoresArr = competenties.map((c) => ({
      competentieId: c.id,
      score: docentScores[c.id] || null,
      motivering: docentMotiveringen[c.id] || "",
    }));
    try {
      setBezig(true);
      await api.post(
        `/evaluations/${evaluatie.id}/scores`,
        { scores: scoresArr, ingediend: false },
        {}
      );
      await api.post(
        `/evaluations/${evaluatie.id}/calculate`,
        {
          eindpresentatieScore: activeType === "finaal" ? eindpresentatieScore : null,
          verslag: verslag?.trim() ? verslag.trim() : null,
        },
        {}
      );
      setMelding({ tekst: "Evaluatie geregistreerd!", type: "s_ok" });
      onRefresh && onRefresh();
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Registreren mislukt");
    } finally {
      setBezig(false);
    }
  }

  async function handleOpenEval() {
    if (!stagedossierId) return;
    try {
      setBezig(true);
      await api.post("/evaluations/open", { stagedossierId, type: activeType });
      onRefresh && onRefresh();
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Evaluatie openen mislukt");
    } finally {
      setBezig(false);
    }
  }

  if (!evaluatie || evaluatie.status === "niet_open") {
    // De docent kan de evaluatie openen zodra de stage geregistreerd is of loopt (niet in contract-/eindfase).
    const planbaar = ["geregistreerd", "stage_loopt", "actief"].includes(dossierStatus);
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          {activeType === "tussentijds" ? "Tussentijdse" : "Finale"} evaluatie is nog niet beschikbaar.
        </p>
        {planbaar && !evaluatie && (
          <div style={{ marginTop: 10 }}>
            <button className="btn primary sm" disabled={bezig} onClick={handleOpenEval}>
              <IconCircleCheck size={14} stroke={1.8} /> {activeType === "tussentijds" ? "Tussentijdse" : "Finale"} evaluatie openen
            </button>
          </div>
        )}
        {foutModal && <p className="status s_rood" style={{ marginTop: 10 }}>{foutModal}</p>}
      </div>
    );
  }

  return (
    <>
    {/* Matrix — Student · Mentor · Docent scores in één tabel */}
    <div className="card doc_students_card" style={{ marginBottom: "12px" }}>
      <div className="card_title" style={{ marginBottom: 0, paddingBottom: 14 }}>
        Competenties
      </div>
      <table className="doc_students_tbl">
        <thead>
          <tr>
            <th style={{ width: "60px" }}>Code</th>
            <th>Competentie</th>
            <th style={{ width: "80px", textAlign: "center" }}>Student</th>
            <th style={{ width: "80px", textAlign: "center" }}>Mentor</th>
            <th style={{ width: kanInvullen ? "220px" : "80px", textAlign: kanInvullen ? "left" : "center" }}>Docent</th>
          </tr>
        </thead>
        <tbody>
          {competenties.map((c) => (
            <tr key={c.id}>
              <td><span className="status s_info">{c.code}</span></td>
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
                        setDocentScores((prev) => ({
                          ...prev,
                          [c.id]: prev[c.id] === val ? null : val,
                        }))
                      }
                    />
                    <div className="doc_mot_wrap">
                      <textarea
                        className="doc_mot_input"
                        rows={2}
                        value={docentMotiveringen[c.id] || ""}
                        onChange={(e) =>
                          setDocentMotiveringen((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Motivering toevoegen (optioneel)..."
                      />
                    </div>
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

      {foutModal && (
        <div className="modal_overlay" onClick={() => setFoutModal("")}>
          <div className="modal_box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Actie vereist</span>
              <button className="icon_btn" onClick={() => setFoutModal("")}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--sub)" }}>{foutModal}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn primary" onClick={() => setFoutModal("")}>Sluiten</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {succesModal && (
        <div className="modal_overlay" onClick={() => setSuccesModal("")}>
          <div className="modal_box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Opgeslagen</span>
              <button className="icon_btn" onClick={() => setSuccesModal("")}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--sub)" }}>{succesModal}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn primary" onClick={() => setSuccesModal("")}>OK</button>
              </div>
            </div>
          </div>
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
            Opslaan als concept
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
        <div className="card_title">
          Eindresultaat{" "}
          <span className={`status ${getEvalStatusClass(evaluatie.status)}`}>
            {getEvalStatusLabel(evaluatie.status)}
          </span>
        </div>

        <div className="grid_2" style={{ marginBottom: "12px" }}>
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
  const [zoek, setZoek]                   = useState("");
  const [filterStatus, setFilterStatus]   = useState("alle");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function load() {
      try {
        const cached = cacheGet("docent_students");
        if (cached) { setStudenten(cached); setLoading(false); return; }
        setLoading(true);
        const res = await api.get("/docent/students");
        const data = res.data.data || [];
        cacheSet("docent_students", data);
        setStudenten(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function loadEval(studentId, force = false) {
    try {
      setLoadingEval(true);
      if (!force) {
        const cached = cacheGet(`docent_eval_${studentId}`);
        if (cached) { setEvalData(cached); setLoadingEval(false); return; }
      }
      const res = await api.get(`/evaluations/${studentId}`);
      const data = res.data.data;
      cacheSet(`docent_eval_${studentId}`, data);
      setEvalData(data);
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

  useEffect(() => {
    const studentParam = Number(searchParams.get("student"));
    if (studentParam && geselecteerdId !== studentParam && studenten.some((s) => s.id === studentParam)) {
      setGeselecteerdId(studentParam);
      setActiveType("tussentijds");
      loadEval(studentParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studenten, searchParams]);

  const geselecteerdeStudent = studenten.find((s) => s.id === geselecteerdId);

  const gefilterd = studenten.filter((s) => {
    if (zoek) {
      const q = zoek.toLowerCase();
      if (!`${s.voornaam} ${s.achternaam}`.toLowerCase().includes(q) &&
          !(s.bedrijf || "").toLowerCase().includes(q)) return false;
    }
    if (filterStatus === "actie") return s.actie_type === "evaluatie";
    return true;
  });

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Evaluaties</h1>
          <p>Bekijk en registreer evaluaties van studenten.</p>
        </div>
      </div>

      <div className="doc_filters" style={{ marginBottom: 16 }}>
        <input
          className="doc_zoek"
          placeholder="Zoek op student of bedrijf..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="doc_select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="alle">Alle studenten</option>
          <option value="actie">Actie nodig</option>
        </select>
        {(zoek || filterStatus !== "alle") && (
          <button className="btn sm primary" onClick={() => { setZoek(""); setFilterStatus("alle"); }}>
            Wis filters
          </button>
        )}
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {!loading && gefilterd.length === 0 && (
        <div className="card"><p className="muted">Geen studenten gevonden.</p></div>
      )}

      {!loading && gefilterd.length > 0 && (
        <div className="card doc_students_card" style={{ marginBottom: "16px" }}>
          <table className="doc_students_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Mentor</th>
                <th>Fase</th>
                <th>Evaluatie</th>
                <th style={{ textAlign: "right" }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((s) => {
                const initialen = [s.voornaam, s.achternaam].filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                return (
                  <tr key={s.dossier_id}>
                    <td>
                      <div className="doc_student_cell">
                        <div className="doc_avatar">{initialen}</div>
                        <div className="doc_student_info">
                          <div className="doc_naam">{s.voornaam} {s.achternaam}</div>
                          {s.studentennummer && <div className="doc_bedrijf">{s.studentennummer}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="doc_sub">{s.bedrijf || "-"}</td>
                              <td className="doc_sub">
                      {s.mentor_voornaam ? `${s.mentor_voornaam} ${s.mentor_achternaam || ""}`.trim() : "-"}
                    </td>
                    <td className="doc_sub">{faseLabelKort(s.dossier_status)}</td>
                    <td>
                      {(() => { const b = evalActieBadge(s); return <span className={`status ${b.cls}`}>{b.txt}</span>; })()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`btn sm${geselecteerdId === s.id ? " primary" : ""}`}
                        onClick={() => handleBekijken(s)}
                      >
                        <IconEye size={14} stroke={1.8} />
                        {geselecteerdId === s.id ? "Sluiten" : "Bekijken"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Eval detail */}
      {geselecteerdeStudent && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {geselecteerdeStudent.voornaam} {geselecteerdeStudent.achternaam}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--sub)" }}>{geselecteerdeStudent.bedrijf || "-"}</div>
            </div>
            <div className="actions">
              <button
                className={`btn sm${activeType === "tussentijds" ? " primary" : ""}`}
                onClick={() => setActiveType("tussentijds")}
              >
                Tussentijds
              </button>
              <button
                className={`btn sm${activeType === "finaal" ? " primary" : ""}`}
                onClick={() => setActiveType("finaal")}
              >
                Finaal
              </button>
            </div>
          </div>

          {loadingEval && (
            <div className="card"><p className="muted">Evaluatie laden...</p></div>
          )}

          {!loadingEval && evalData && (
            <EvalDetail
              evalData={evalData}
              activeType={activeType}
              userId={geselecteerdId}
              onRefresh={() => { cacheDelete(`docent_eval_${geselecteerdId}`); cacheDelete("docent_students"); loadEval(geselecteerdId, true); }}
              stagedossierId={evalData.stagedossierId ?? geselecteerdeStudent?.dossier_id}
              dossierStatus={geselecteerdeStudent?.dossier_status}
            />
          )}
        </>
      )}
    </div>
  );
}
