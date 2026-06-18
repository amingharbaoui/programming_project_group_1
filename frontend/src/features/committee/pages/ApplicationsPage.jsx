import React, { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";
import "../../../index.css";
import "./ApplicationsPage.css";

/* ── Criteria definitie ── */
const CRITERIA_DEFS = [
  { id: "min_weken",    label: "Minstens 12 weken voltijds binnen het stagevenster" },
  { id: "min_uren",     label: "Minstens 456 uur" },
  { id: "it_relevant",  label: "IT-gerelateerde opdracht met ontwikkelcomponent" },
  { id: "tech_mentor",  label: "Mentor met technische functie binnen het bedrijf" },
  { id: "omschrijving", label: "Concrete opdrachtomschrijving met technologie, taken en team" },
  { id: "prof_omgeving",label: "Professionele bedrijfsomgeving" },
  { id: "stagevenster", label: "Stageperiode ligt binnen het toegelaten stagevenster" },
];

const FASES = ["Ingediend", "Beoordeling", "Beslissing", "Naar administratie"];

/* ── Helpers ── */
function formatDate(v) {
  if (!v) return "–";
  return new Date(v).toLocaleDateString("nl-BE");
}

function kanBeslissen(status) {
  return ["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(status);
}

function statusLabel(status) {
  return {
    ingediend:             "In beoordeling",
    aanpassingen_gevraagd: "Aanpassingen vereist",
    heringediend:          "Heringediend",
    goedgekeurd:           "Goedgekeurd",
    afgekeurd:             "Afgekeurd",
    ingetrokken:           "Ingetrokken",
  }[status] || status;
}

function statusKlasse(status) {
  if (status === "goedgekeurd")            return "s_ok";
  if (status === "afgekeurd")              return "s_rood";
  if (status === "aanpassingen_gevraagd")  return "s_amber";
  if (status === "ingediend")              return "s_info";
  if (status === "heringediend")           return "s_amber";
  return "s_grijs";
}

function statusIconKlasse(status) {
  return {
    ingediend:             "ti-hourglass",
    aanpassingen_gevraagd: "ti-message-circle",
    heringediend:          "ti-refresh",
    goedgekeurd:           "ti-check",
    afgekeurd:             "ti-x",
    ingetrokken:           "ti-arrow-back-up",
  }[status] || "ti-hourglass";
}

function stappenIndex(status) {
  return {
    ingediend:             1,
    aanpassingen_gevraagd: 2,
    heringediend:          1,
    goedgekeurd:           3,
    afgekeurd:             3,
    ingetrokken:           3,
  }[status] ?? 1;
}

function stappenSubs(status, aanvraag) {
  const ingDatum = formatDate(aanvraag?.ingediend_op);
  return {
    ingediend:             [ingDatum, "Commissievergadering", "", ""],
    aanpassingen_gevraagd: [ingDatum, "Feedback verstuurd", "Aanpassingen vereist", ""],
    heringediend:          [ingDatum, "Herbeoordeling", "", ""],
    goedgekeurd:           [ingDatum, "Afgerond", "Goedgekeurd", "Dossier opstarten"],
    afgekeurd:             [ingDatum, "Afgerond", "Afgekeurd", "Geen dossier"],
    ingetrokken:           [ingDatum, "Gestopt", "Ingetrokken door student", "Geen dossier"],
  }[status] || ["", "", "", ""];
}

/* ── Auto-hints berekenen op basis van aanvraagdata ── */
function computeHints(aanvraag) {
  if (!aanvraag) return CRITERIA_DEFS.map(() => ({ cls: "ok", txt: "Ok" }));
  const weken = Number(aanvraag.aantal_weken) || 0;
  const uren  = Number(aanvraag.totaal_uren || aanvraag.uren_per_week * weken) || 0;
  const heeftMentorFunctie = !!(aanvraag.mentor_functie && aanvraag.mentor_functie.trim());
  const geldige = aanvraag.startdatum && aanvraag.einddatum &&
    new Date(aanvraag.startdatum) < new Date(aanvraag.einddatum);

  return [
    weken >= 12
      ? { cls: "ok",  txt: `Ok — ${weken} weken` }
      : { cls: "nok", txt: `Niet ok — ${weken} weken` },
    uren >= 456
      ? { cls: "ok",  txt: `Ok — ${uren} uur` }
      : { cls: "nok", txt: `Niet ok — ${uren || "?"} uur` },
    { cls: "ok", txt: "Beoordeel de opdrachtomschrijving" },
    heeftMentorFunctie
      ? { cls: "ok",  txt: `Ok — ${aanvraag.mentor_functie}` }
      : { cls: "nok", txt: "Mentorfunctie ontbreekt" },
    { cls: "ok", txt: "Beoordeel de opdrachtomschrijving" },
    { cls: "ok", txt: "Ok" },
    geldige
      ? { cls: "ok",  txt: `Ok — ${formatDate(aanvraag.startdatum)} – ${formatDate(aanvraag.einddatum)}` }
      : { cls: "nok", txt: "Controleer de data" },
  ];
}

/* ══════════════════════════════════════════
   PROGRESS STEPS
══════════════════════════════════════════ */
function Steps({ status, aanvraag }) {
  const idx  = stappenIndex(status);
  const subs = stappenSubs(status, aanvraag);

  return (
    <div className="comm-steps">
      {FASES.map((f, i) => {
        const done   = i < idx;
        const active = i === idx;
        const cls    = done ? "done" : active ? "active" : "";
        return (
          <React.Fragment key={f}>
            <div className={`comm-step ${cls}`}>
              <div className="comm-step-circle">
                {done ? <i className="ti ti-check" /> : i + 1}
              </div>
              <div className="comm-step-labels">
                <span className="comm-step-label">{f}</span>
                {subs[i] && <span className="comm-step-sub">{subs[i]}</span>}
              </div>
            </div>
            {i < FASES.length - 1 && (
              <div className={`comm-step-line${done ? " done" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   VOORSTEL KAART
══════════════════════════════════════════ */
function VoorstelKaart({ aanvraag, versie }) {
  if (!aanvraag) return null;
  const a = versie || aanvraag;
  const versienr = a.versie_nummer || aanvraag.huidige_versie_nummer || 1;
  const isV1probleem = versienr === 1 && (
    Number(aanvraag.aantal_weken) < 12 ||
    !aanvraag.mentor_functie?.trim()
  );

  return (
    <div className="card">
      <div className="card_title">
        <i className="ti ti-file-text" />
        Voorstel
      </div>

      <div className="kv"><span className="k">Student</span><span className="v">{aanvraag.student_voornaam} {aanvraag.student_achternaam}</span></div>
      <div className="kv"><span className="k">Bedrijf</span><span className="v">{aanvraag.bedrijf_naam || "–"}{aanvraag.bedrijfsafdeling ? ` · ${aanvraag.bedrijfsafdeling}` : ""}</span></div>
      {aanvraag.bedrijfsadres && <div className="kv"><span className="k">Adres</span><span className="v">{aanvraag.bedrijfsadres}</span></div>}
      <div className="kv">
        <span className="k">Mentor</span>
        <span className="v">
          {aanvraag.mentor_naam || "–"}
          {a.mentor_functie
            ? ` · ${a.mentor_functie}`
            : <span style={{ color: "#b04258" }}> · functie ontbreekt</span>}
          {aanvraag.mentor_email ? <span style={{ color: "var(--sub)", fontSize: 12, display: "block" }}>{aanvraag.mentor_email}</span> : null}
        </span>
      </div>
      <div className="kv">
        <span className="k">Periode</span>
        <span className="v">
          {formatDate(a.startdatum || aanvraag.startdatum)} – {formatDate(a.einddatum || aanvraag.einddatum)}
          {" "}
          <span style={{ color: "var(--sub)", fontSize: 12 }}>
            · {(a.aantal_weken || aanvraag.aantal_weken) || "?"} weken · {(a.uren_per_week || aanvraag.uren_per_week) || "?"}u/week
          </span>
          {Number(a.aantal_weken || aanvraag.aantal_weken) < 12 && (
            <span style={{ color: "#b04258", fontSize: 12 }}> · minder dan 12 weken</span>
          )}
        </span>
      </div>

      {(a.opdrachtomschrijving || aanvraag.opdrachtomschrijving) && (
        <div style={{ paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>
            Opdrachtomschrijving
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--gray)" }}>
            {a.opdrachtomschrijving || aanvraag.opdrachtomschrijving}
          </div>
        </div>
      )}


      {aanvraag.laatste_feedback && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--red-light)", borderRadius: 8, fontSize: 12.5, color: "var(--red)" }}>
          <strong>Eerdere feedback:</strong> {aanvraag.laatste_feedback}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   CRITERIA KAART
══════════════════════════════════════════ */
function CriteriaKaart({ aanvraag, criteria, onChange, readonly }) {
  const hints    = computeHints(aanvraag);
  const aangevinkt = CRITERIA_DEFS.filter((c) => criteria[c.id]).length;

  return (
    <div className="card">
      <div className="card_title">
        <i className="ti ti-list-check" />
        Checklist ({aangevinkt}/{CRITERIA_DEFS.length})
      </div>
      <p style={{ fontSize: 11.5, color: "var(--sub)", margin: "-4px 0 10px" }}>
        Verplichte criteria — vink elk criterium af. Goedkeuren kan pas als alles in orde is, of met een expliciet gemotiveerde uitzondering.
      </p>
      {CRITERIA_DEFS.map((c, i) => {
        const hint = hints[i];
        const ok   = hint.cls === "ok";
        return (
          <label key={c.id} className={`comm-crit${ok ? "" : " nok"}`} style={{ cursor: readonly ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={!!criteria[c.id]}
              disabled={readonly}
              onChange={(e) => onChange(c.id, e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--red)", flexShrink: 0 }}
            />
            <span>
              {c.label}
              <span style={{ display: "block", fontSize: 11, color: ok ? "var(--green)" : "var(--amber)" }}>
                {hint.txt}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════
   BESLIS KAART
══════════════════════════════════════════ */
function BeslisKaart({ onAanpassingen, onAfkeuren, onGoedkeuren }) {
  return (
    <div className="card comm-beslis-kaart">
      <div className="card_title">
        <i className="ti ti-gavel" />
        Beslissing
      </div>
      <p style={{ fontSize: 11.5, color: "var(--sub)", margin: "-4px 0 12px" }}>
        De stagecommissie beslist over het stagevoorstel. Na goedkeuring volgt de administratie het dossier en de stageovereenkomst op.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button className="btn" onClick={onAanpassingen}>
          <i className="ti ti-message-circle" /> Aanpassingen vragen
        </button>
        <button className="btn" style={{ color: "var(--red)", borderColor: "var(--red-mid)" }} onClick={onAfkeuren}>
          <i className="ti ti-x" /> Afkeuren
        </button>
        <button className="btn primary" onClick={onGoedkeuren}>
          <i className="ti ti-check" /> Goedkeuren
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   HISTORIEK KAART
══════════════════════════════════════════ */
function HistoriekKaart({ aanvraag }) {
  const status = aanvraag?.status;
  const items  = [];

  if (status === "aanpassingen_gevraagd") {
    items.push({ label: "Aanpassingen gevraagd door stagecommissie", actief: true });
    items.push({ label: "Versie 1 ingediend" });
  } else if (status === "heringediend") {
    items.push({ label: "Heringediend door student", actief: true });
    items.push({ label: "Aanpassingen gevraagd door stagecommissie" });
    items.push({ label: "Versie 1 ingediend" });
  } else if (status === "goedgekeurd") {
    items.push({ label: "Goedgekeurd door stagecommissie", actief: true });
    if (aanvraag.huidige_versie_nummer > 1) items.push({ label: "Heringediend door student" });
    if (aanvraag.laatste_feedback) items.push({ label: "Aanpassingen gevraagd door stagecommissie" });
    items.push({ label: "Versie 1 ingediend" });
  } else if (status === "afgekeurd") {
    items.push({ label: "Afgekeurd door stagecommissie", actief: true });
    items.push({ label: "Versie 1 ingediend" });
  } else if (status === "ingetrokken") {
    items.push({ label: "Ingetrokken door student", actief: true });
    items.push({ label: "Versie 1 ingediend" });
  } else {
    return null;
  }

  return (
    <div className="card">
      <div className="card_title"><i className="ti ti-history" /> Historiek</div>
      {items.map((it, i) => (
        <div key={i} className={`comm-versie${it.actief ? " actief" : ""}`}>
          <span className="comm-v-dot" />
          <span className="comm-v-wat">
            <b>{it.label}</b>
          </span>
          {it.ts && <span className="comm-v-tijd">{it.ts}</span>}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   DIFF KAART (versievergelijking)
══════════════════════════════════════════ */
function DiffKaart({ oud, nieuw }) {
  if (!oud || !nieuw) return null;

  const velden = [
    { key: "opdrachtomschrijving", label: "Opdrachtomschrijving" },
    { key: "mentor_functie",       label: "Mentorfunctie" },
    { key: "aantal_weken",         label: "Aantal weken" },
    { key: "startdatum",           label: "Startdatum", fmt: formatDate },
    { key: "einddatum",            label: "Einddatum",  fmt: formatDate },
    { key: "totaal_uren",          label: "Totaal uren" },
  ];

  const gewijzigd = velden.filter(({ key }) =>
    String(oud[key] ?? "") !== String(nieuw[key] ?? "")
  );

  if (gewijzigd.length === 0) return null;

  return (
    <div className="card">
      <div className="card_title"><i className="ti ti-refresh" /> Wat de student aanpaste</div>
      {gewijzigd.map(({ key, label, fmt }) => (
        <div key={key} className="comm-diff">
          <div className="comm-d-k">{label}</div>
          <div>
            <div className="comm-d-oud">{fmt ? fmt(oud[key]) : (oud[key] ?? "–")}</div>
            <div className="comm-d-nieuw">{fmt ? fmt(nieuw[key]) : (nieuw[key] ?? "–")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   BESLIS MODAL
══════════════════════════════════════════ */
function BeslisModal({ type, aanvraag, criteria, onSluit, onBeslissing }) {
  const [feedback, setFeedback]   = useState("");
  const [motivering, setMotivering] = useState("");
  const [uitzMot, setUitzMot]     = useState("");
  const [uitzondering, setUitz]   = useState(false);
  const [bezig, setBezig]         = useState(false);
  const [fout, setFout]           = useState("");

  const allesCriteria = CRITERIA_DEFS.every((c) => criteria[c.id]);

  async function verstuur() {
    if (type === "aanpassingen" && !feedback.trim()) { setFout("Feedback is verplicht."); return; }
    if (type === "afkeuren" && !motivering.trim())   { setFout("Motivering is verplicht."); return; }
    if (type === "goedkeuren" && uitzondering && !uitzMot.trim()) { setFout("Motivering uitzondering is verplicht."); return; }

    setBezig(true);
    setFout("");
    try {
      const beslissing = type === "aanpassingen" ? "aanpassingen_gevraagd"
                       : type === "afkeuren"     ? "afgekeurd"
                       : "goedgekeurd";
      await api.patch(`/committee/applications/${aanvraag.id}/decision`, {
        beslissing,
        feedback:               type === "aanpassingen" ? feedback   : null,
        motivering:             type !== "aanpassingen" ? motivering : null,
        uitzonderingMotivering: uitzondering ? uitzMot : null,
      });
      onBeslissing();
      onSluit();
    } catch (err) {
      setFout(err.response?.data?.message || "Beslissing opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  }

  const TITELS = {
    aanpassingen: { icon: "ti-message-circle", titel: "Aanpassingen vragen" },
    afkeuren:     { icon: "ti-x",              titel: "Stagevoorstel afkeuren" },
    goedkeuren:   { icon: "ti-circle-check",   titel: "Stagevoorstel goedkeuren" },
  };
  const { icon, titel } = TITELS[type] || {};

  return (
    <div className="popup-overlay">
      <div className="popup" style={{ maxWidth: 560, width: "100%" }}>
        <div className="popup-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 18, color: "var(--sub)" }} />
          <div style={{ flex: 1 }}>
            <div className="card_title" style={{ margin: 0 }}>{titel}</div>
            <div style={{ fontSize: 12, color: "var(--sub)" }}>
              {aanvraag.student_voornaam} {aanvraag.student_achternaam} · {aanvraag.bedrijf_naam}
            </div>
          </div>
          <button className="btn" onClick={onSluit}>✕</button>
        </div>

        <div className="popup-body">
          {/* Samenvatting */}
          <div className="kv"><span className="k">Student</span><span className="v">{aanvraag.student_voornaam} {aanvraag.student_achternaam}</span></div>
          <div className="kv"><span className="k">Stagebedrijf</span><span className="v">{aanvraag.bedrijf_naam}</span></div>
          <div className="kv"><span className="k">Periode</span><span className="v">{formatDate(aanvraag.startdatum)} – {formatDate(aanvraag.einddatum)} ({aanvraag.aantal_weken || "?"} weken)</span></div>

          {/* Checklist-waarschuwing bij goedkeuren */}
          {type === "goedkeuren" && !allesCriteria && (
            <div className="banner amber" style={{ margin: "14px 0 4px" }}>
              <i className="ti ti-alert-circle" />
              <div>
                <div className="b-title">Niet alle criteria zijn aangevinkt</div>
                <div className="b-text">Je kan goedkeuren met een expliciet gemotiveerde uitzondering.</div>
              </div>
            </div>
          )}

          {/* Feedback / motivering */}
          {type === "aanpassingen" && (
            <div className="form_group" style={{ marginTop: 14 }}>
              <label className="form_label">Feedback aan student <span style={{ color: "var(--red)" }}>*</span></label>
              <textarea
                className="form_textarea"
                rows={4}
                placeholder="Welke aanpassingen zijn nodig?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
          )}

          {(type === "afkeuren") && (
            <div className="form_group" style={{ marginTop: 14 }}>
              <label className="form_label">Motivering voor de student <span style={{ color: "var(--red)" }}>*</span></label>
              <textarea
                className="form_textarea"
                rows={3}
                placeholder="De student ziet deze motivering…"
                value={motivering}
                onChange={(e) => setMotivering(e.target.value)}
              />
            </div>
          )}

          {type === "goedkeuren" && (
            <>
              <div style={{ marginTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uitzondering}
                    onChange={(e) => setUitz(e.target.checked)}
                    style={{ accentColor: "var(--red)" }}
                  />
                  Goedkeuren met uitzondering
                </label>
              </div>
              {uitzondering && (
                <div className="form_group" style={{ marginTop: 10 }}>
                  <label className="form_label">Motivering uitzondering <span style={{ color: "var(--red)" }}>*</span></label>
                  <textarea
                    className="form_textarea"
                    rows={3}
                    placeholder="Waarom wordt er een uitzondering toegestaan?"
                    value={uitzMot}
                    onChange={(e) => setUitzMot(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {fout && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--red-light)", borderRadius: 8, fontSize: 13, color: "var(--red)" }}>
              {fout}
            </div>
          )}
        </div>

        <div className="actions" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button className="btn" onClick={onSluit} disabled={bezig}>Annuleren</button>
          {type === "afkeuren" ? (
            <button
              className="btn"
              style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }}
              disabled={bezig}
              onClick={verstuur}
            >
              <i className="ti ti-x" />
              {bezig ? "Bezig…" : "Afkeuren"}
            </button>
          ) : (
            <button className="btn primary" disabled={bezig} onClick={verstuur}>
              {bezig ? "Bezig…" : type === "aanpassingen" ? "Aanpassingen vragen" : "Goedkeuren"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   VERSIES VERGELIJK MODAL
══════════════════════════════════════════ */
const VERGELIJK_VELDEN = [
  { key: "bedrijf_naam",         label: "Bedrijfsnaam" },
  { key: "bedrijfsafdeling",     label: "Afdeling" },
  { key: "bedrijfsadres",        label: "Adres" },
  { key: "mentor_naam",          label: "Mentor" },
  { key: "mentor_email",         label: "Mentor e-mail" },
  { key: "mentor_functie",       label: "Mentor functie" },
  { key: "stagefunctie",         label: "Stagefunctie" },
  { key: "opdrachtomschrijving", label: "Opdrachtomschrijving" },
  { key: "startdatum",           label: "Startdatum",  fmt: formatDate },
  { key: "einddatum",            label: "Einddatum",   fmt: formatDate },
  { key: "aantal_weken",         label: "Aantal weken" },
  { key: "uren_per_week",        label: "Uren/week" },
];

function VergelijkModal({ aanvraagId, feedbackVorige, onSluit }) {
  const [versies, setVersies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/committee/applications/${aanvraagId}/versions`)
      .then((r) => setVersies(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [aanvraagId]);

  const oud   = versies[versies.length - 2] || null;
  const nieuw = versies[versies.length - 1] || null;

  return (
    <div className="popup-overlay">
      <div className="popup" style={{ maxWidth: 820, width: "100%" }}>
        <div className="popup-header">
          <div className="card_title">Versies vergelijken</div>
          <button className="btn" onClick={onSluit}>✕</button>
        </div>
        <div className="popup-body">
          {loading && <p style={{ color: "var(--sub)", fontSize: 13 }}>Versies laden…</p>}
          {!loading && (!oud || !nieuw) && (
            <p style={{ color: "var(--sub)", fontSize: 13 }}>Slechts één versie beschikbaar.</p>
          )}
          {!loading && oud && nieuw && (
            <>
              {feedbackVorige && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--red-light)", borderRadius: 8, fontSize: 12.5, color: "var(--red)" }}>
                  <strong>Eerdere feedback aan student:</strong> {feedbackVorige}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <span />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: .3 }}>Versie {oud.versie_nummer} (oud)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: .3 }}>Versie {nieuw.versie_nummer} (nieuw)</span>
              </div>
              {VERGELIJK_VELDEN.map(({ key, label, fmt }) => {
                const oudVal  = fmt ? fmt(oud[key])  : (oud[key]  ?? "–");
                const nieuwVal = fmt ? fmt(nieuw[key]) : (nieuw[key] ?? "–");
                const gewijzigd = String(oud[key] ?? "") !== String(nieuw[key] ?? "");
                return (
                  <div key={key} style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", gap: 8, padding: "7px 0", borderBottom: "0.5px solid var(--border)", background: gewijzigd ? "#fffbeb" : "transparent", borderRadius: gewijzigd ? 6 : 0, paddingLeft: gewijzigd ? 6 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sub)" }}>{label}</span>
                    <span style={{ fontSize: 13, color: gewijzigd ? "#92400e" : "var(--dark)", textDecoration: gewijzigd ? "line-through" : "none", opacity: gewijzigd ? .7 : 1 }}>{oudVal}</span>
                    <span style={{ fontSize: 13, color: gewijzigd ? "#16a34a" : "var(--dark)", fontWeight: gewijzigd ? 600 : 400 }}>{nieuwVal}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="actions" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button className="btn" onClick={onSluit}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   AANVRAAG DETAIL VIEW
══════════════════════════════════════════ */
function AanvraagView({ aanvraag, onTerug, onBeslissing }) {
  const [criteria, setCriteria]     = useState({});
  const [beslissModal, setBeslis]   = useState(null); // 'aanpassingen'|'afkeuren'|'goedkeuren'
  const [vergelijkOpen, setVergelijk] = useState(false);
  const [versies, setVersies]       = useState([]);
  const [versiesLoading, setVLaden] = useState(false);

  const status     = aanvraag.status;
  const isBeslis   = ["ingediend", "heringediend"].includes(status);
  const isWacht    = status === "aanpassingen_gevraagd";
  const isGoed     = status === "goedgekeurd";
  const isAfgekeurd = status === "afgekeurd";
  const isIngetrokken = status === "ingetrokken";
  const heeftMeerdereVersies = aanvraag.huidige_versie_nummer > 1;

  useEffect(() => {
    if (status === "heringediend" && heeftMeerdereVersies) {
      setVLaden(true);
      api.get(`/committee/applications/${aanvraag.id}/versions`)
        .then((r) => setVersies(r.data.data || []))
        .catch(() => {})
        .finally(() => setVLaden(false));
    }
  }, [aanvraag.id, status, heeftMeerdereVersies]);

  function toggleCrit(id, val) {
    setCriteria((prev) => ({ ...prev, [id]: val }));
  }

  const paginaTitel = {
    ingediend:             "Aanvraag beoordelen",
    aanpassingen_gevraagd: "Aanpassingen gevraagd",
    heringediend:          "Aanvraag herbeoordelen",
    goedgekeurd:           "Stagevoorstel goedgekeurd",
    afgekeurd:             "Stagevoorstel afgekeurd",
    ingetrokken:           "Voorstel ingetrokken door student",
  }[status] || "Aanvraag bekijken";

  return (
    <>
      {beslissModal && (
        <BeslisModal
          type={beslissModal}
          aanvraag={aanvraag}
          criteria={criteria}
          onSluit={() => setBeslis(null)}
          onBeslissing={onBeslissing}
        />
      )}
      {vergelijkOpen && (
        <VergelijkModal
          aanvraagId={aanvraag.id}
          feedbackVorige={aanvraag.laatste_feedback}
          onSluit={() => setVergelijk(false)}
        />
      )}

      <div className="page-inner">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onTerug(); }}
          style={{ fontSize: 12.5, color: "var(--red)", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10 }}
        >
          <i className="ti ti-arrow-left" /> Terug naar aanvragen
        </a>

        <div className="page-header">
          <div>
            <h1>{paginaTitel}</h1>
            <p>
              {aanvraag.student_voornaam} {aanvraag.student_achternaam} · {aanvraag.bedrijf_naam}
              {heeftMeerdereVersies && (
                <>
                  {" "}&nbsp;
                  <button
                    className="btn sm"
                    style={{ marginLeft: 4, verticalAlign: "middle" }}
                    onClick={() => setVergelijk(true)}
                  >
                    <i className="ti ti-git-compare" /> Versies vergelijken
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <Steps status={status} aanvraag={aanvraag} />

        {/* ── Banner: aanpassingen gevraagd ── */}
        {isWacht && (
          <div className="banner amber" style={{ marginBottom: 16 }}>
            <i className="ti ti-hourglass" />
            <div>
              <div className="b-title">Aanpassingen gevraagd — wacht op heringediende versie door de student</div>
              <div className="b-text">Geen beslisknoppen actief. De student kan een nieuwe versie herindienen.</div>
            </div>
          </div>
        )}

        {/* ── Banner: goedgekeurd ── */}
        {isGoed && (
          <div className="banner groen" style={{ marginBottom: 16 }}>
            <i className="ti ti-check" />
            <div>
              <div className="b-title">Stagevoorstel goedgekeurd</div>
              <div className="b-text">Het stagevoorstel voldoet aan de criteria. Administratie start de stageovereenkomst en registratieflow op.</div>
            </div>
          </div>
        )}

        {/* ── Banner: afgekeurd ── */}
        {isAfgekeurd && (
          <div className="banner rood" style={{ marginBottom: 16 }}>
            <i className="ti ti-x" />
            <div>
              <div className="b-title">Stagevoorstel afgekeurd</div>
              <div className="b-text">De student kan een nieuw stagevoorstel starten — er wordt geen stagedossier aangemaakt.</div>
            </div>
          </div>
        )}

        {/* ── Banner: ingetrokken ── */}
        {isIngetrokken && (
          <div className="banner" style={{ marginBottom: 16, background: "var(--muted)", borderColor: "var(--border)", color: "var(--dark)" }}>
            <i className="ti ti-arrow-back-up" />
            <div>
              <div className="b-title">Voorstel ingetrokken door student</div>
              <div className="b-text">De stagecommissie hoeft dit voorstel niet meer te behandelen. Er wordt geen stagedossier aangemaakt.</div>
            </div>
          </div>
        )}

        {/* ── Aanpassingen gevraagd: feedback + voorstel ── */}
        {isWacht && (
          <>
            <div className="comm-grid-2b">
              {aanvraag.laatste_feedback && (
                <div className="card">
                  <div className="card_title"><i className="ti ti-message-circle" /> Feedback van de stagecommissie</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--gray)" }}>{aanvraag.laatste_feedback}</div>
                </div>
              )}
              <VoorstelKaart aanvraag={aanvraag} />
            </div>
            <HistoriekKaart aanvraag={aanvraag} />
          </>
        )}

        {/* ── Heringediend: diff + criteria + voorstel ── */}
        {status === "heringediend" && (
          <>
            {(versies.length >= 2 || versiesLoading) && (
              <div className="comm-grid-2b" style={{ marginBottom: 16 }}>
                {aanvraag.laatste_feedback && (
                  <div className="card">
                    <div className="card_title"><i className="ti ti-message-circle" /> Vorige feedback</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--gray)" }}>{aanvraag.laatste_feedback}</div>
                  </div>
                )}
                {versiesLoading
                  ? <div className="card" style={{ color: "var(--sub)", fontSize: 13 }}>Versies laden…</div>
                  : <DiffKaart oud={versies[versies.length - 2]} nieuw={versies[versies.length - 1]} />
                }
              </div>
            )}
            <div className="comm-grid-2">
              <div className="comm-gap-16">
                <VoorstelKaart aanvraag={aanvraag} versie={versies[versies.length - 1]} />
                <BeslisKaart
                  onAanpassingen={() => setBeslis("aanpassingen")}
                  onAfkeuren={() => setBeslis("afkeuren")}
                  onGoedkeuren={() => setBeslis("goedkeuren")}
                />
              </div>
              <div className="comm-gap-16">
                <CriteriaKaart aanvraag={aanvraag} criteria={criteria} onChange={toggleCrit} readonly={false} />
                <HistoriekKaart aanvraag={aanvraag} />
              </div>
            </div>
          </>
        )}

        {/* ── Ingediend: voorstel + beslis + criteria ── */}
        {status === "ingediend" && (
          <div className="comm-grid-2">
            <div className="comm-gap-16">
              <VoorstelKaart aanvraag={aanvraag} />
              <BeslisKaart
                onAanpassingen={() => setBeslis("aanpassingen")}
                onAfkeuren={() => setBeslis("afkeuren")}
                onGoedkeuren={() => setBeslis("goedkeuren")}
              />
            </div>
            <div className="comm-gap-16">
              <CriteriaKaart aanvraag={aanvraag} criteria={criteria} onChange={toggleCrit} readonly={false} />
            </div>
          </div>
        )}

        {/* ── Goedgekeurd / afgekeurd / ingetrokken ── */}
        {(isGoed || isAfgekeurd || isIngetrokken) && (
          <>
            <VoorstelKaart aanvraag={aanvraag} />
            <CriteriaKaart aanvraag={aanvraag} criteria={{}} onChange={() => {}} readonly />
            <HistoriekKaart aanvraag={aanvraag} />
          </>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   OVERZICHT VIEW
══════════════════════════════════════════ */
function OverzichtView({ aanvragen, loading, fout, onVernieuwen, onOpen }) {
  const stats = [
    { lbl: "Nieuwe aanvragen", n: aanvragen.filter((a) => a.status === "ingediend").length,             ic: "ti-file-plus" },
    { lbl: "Heringediend",     n: aanvragen.filter((a) => a.status === "heringediend").length,           ic: "ti-refresh" },
    { lbl: "Wacht op student", n: aanvragen.filter((a) => a.status === "aanpassingen_gevraagd").length,  ic: "ti-hourglass" },
    { lbl: "Afgerond",         n: aanvragen.filter((a) => ["goedgekeurd","afgekeurd","ingetrokken"].includes(a.status)).length, ic: "ti-circle-check" },
  ];

  /* Sorteer: openstaand eerst, dan behandeld */
  const gesorteerd = [...aanvragen].sort((a, b) => {
    const aOpen = kanBeslissen(a.status) ? 0 : 1;
    const bOpen = kanBeslissen(b.status) ? 0 : 1;
    return aOpen - bOpen;
  });

  function knopConfig(status) {
    if (status === "ingediend")             return { label: "Beoordelen",          primary: true };
    if (status === "heringediend")          return { label: "Opnieuw beoordelen",  primary: true };
    if (status === "aanpassingen_gevraagd") return { label: "Feedback bekijken",   primary: false };
    return { label: "Bekijken", primary: false };
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Aanvragen</h1>
        </div>
        <button className="btn sm" onClick={onVernieuwen}>
          <i className="ti ti-refresh" /> Vernieuwen
        </button>
      </div>

      {/* Stats */}
      <div className="comm-stats-rij">
        {stats.map(({ lbl, n, ic }) => (
          <div key={lbl} className="card comm-stat-card">
            <div className={`comm-stat-icon${n > 0 ? " accent" : ""}`}>
              <i className={`ti ${ic}`} />
            </div>
            <div>
              <div className="comm-stat-val">{n}</div>
              <div className="comm-stat-lbl">{lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="laadbericht">Aanvragen laden…</div>}
      {fout    && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{fout}</div>}

      {/* Gecombineerde tabel */}
      {!loading && (
        <div className="card">
          {gesorteerd.length === 0 ? (
            <div className="empty-state">Nog geen aanvragen.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Stagebedrijf</th>
                  <th>Ingediend</th>
                  <th>Status</th>
                  <th className="right">Actie</th>
                </tr>
              </thead>
              <tbody>
                {gesorteerd.map((a) => {
                  const { label, primary } = knopConfig(a.status);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div className="comm-ava">
                            {(a.student_voornaam?.[0] || "") + (a.student_achternaam?.[0] || "")}
                          </div>
                          <div>
                            <strong>{a.student_voornaam} {a.student_achternaam}</strong>
                            <br />
                            <span className="muted">{a.studentennummer || "–"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{a.bedrijf_naam || "–"}</span>
                      </td>
                      <td>
                        <span className="muted">{formatDate(a.ingediend_op)}</span>
                      </td>
                      <td>
                        <span className={`status ${statusKlasse(a.status)}`}>
                          <i className={`ti ${statusIconKlasse(a.status)}`} />
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="right">
                        <button
                          className={`btn sm${primary ? " primary" : ""}`}
                          onClick={() => onOpen(a)}
                        >
                          <i className="ti ti-eye" /> {label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   HOOFDPAGINA
══════════════════════════════════════════ */
export default function ApplicationsPage() {
  const [aanvragen, setAanvragen]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fout, setFout]             = useState("");
  const [view, setView]             = useState("overzicht");
  const [geselecteerd, setGesel]    = useState(null);

  const laadAanvragen = useCallback(async () => {
    try {
      setLoading(true);
      setFout("");
      const res = await api.get("/committee/applications");
      setAanvragen(res.data.data || []);
    } catch (err) {
      setFout(err.response?.data?.message || err.message || "Aanvragen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { laadAanvragen(); }, [laadAanvragen]);

  function openAanvraag(a) {
    setGesel(a);
    setView("aanvraag");
  }

  async function naBeslissing() {
    // Herlaad de lijst en update ook het geselecteerde item
    try {
      const res = await api.get("/committee/applications");
      const lijst = res.data.data || [];
      setAanvragen(lijst);
      // Update geselecteerd item met nieuwe status
      if (geselecteerd) {
        const updated = lijst.find((a) => a.id === geselecteerd.id);
        if (updated) setGesel(updated);
      }
    } catch {
      // ignore
    }
  }

  if (view === "aanvraag" && geselecteerd) {
    return (
      <AanvraagView
        aanvraag={geselecteerd}
        onTerug={() => { setView("overzicht"); setGesel(null); }}
        onBeslissing={naBeslissing}
      />
    );
  }

  return (
    <OverzichtView
      aanvragen={aanvragen}
      loading={loading}
      fout={fout}
      onVernieuwen={laadAanvragen}
      onOpen={openAanvraag}
    />
  );
}
