import { useEffect, useState, useCallback } from "react";
import { IconCheck, IconCirclePlus, IconCopyPlus, IconLoader2, IconPlus, IconX, IconPencil, IconTrash } from "@tabler/icons-react";
import "./InstellingenPage.css";
import "../../../index.css";
import api from "../../../services/api";
import { cacheGet, cacheSet, cacheDelete } from "../adminCache";

function fmtDate(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function InstellingenPage() {
  const [stageRegels, setStageRegels] = useState([]);
  const [docSoorten, setDocSoorten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [regelSaving, setRegelSaving] = useState({});
  const [regelForm, setRegelForm] = useState({});

  const [docSaving, setDocSaving] = useState({});

  const [nieuwDoc, setNieuwDoc] = useState({ naam: "", is_verplicht: false });
  const [nieuwDocSaving, setNieuwDocSaving] = useState(false);
  const [nieuwDocError, setNieuwDocError] = useState("");

  const [nieuweVersieOpen, setNieuweVersieOpen] = useState(false);
  const [nieuweVersieSaving, setNieuweVersieSaving] = useState(false);

  const [bevestigRegelId, setBevestigRegelId] = useState(null);

  const [checklistItems, setChecklistItems] = useState([]);
  const [nieuwItem, setNieuwItem] = useState("");
  const [nieuwItemSaving, setNieuwItemSaving] = useState(false);
  const [nieuwItemError, setNieuwItemError] = useState("");
  const [bewerkItem, setBewerkItem] = useState(null);
  const [resetChecklistOpen, setResetChecklistOpen] = useState(false);
  const [resetChecklistSaving, setResetChecklistSaving] = useState(false);
  const [verwijderTarget, setVerwijderTarget] = useState(null);

  const [rubriekCriteria, setRubriekCriteria] = useState([]);
  const [nieuwRubriek, setNieuwRubriek] = useState("");
  const [nieuwRubriekMax, setNieuwRubriekMax] = useState(5);
  const [nieuwRubriekSaving, setNieuwRubriekSaving] = useState(false);
  const [bewerkRubriek, setBewerkRubriek] = useState(null);
  const [verwijderRubriek, setVerwijderRubriek] = useState(null);

  const [toast, setToast] = useState(null);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    try {
      setError("");
      const cached = cacheGet("admin_settings");
      if (cached) {
        const regels = cached.stageRegels || [];
        setStageRegels(regels);
        setDocSoorten(cached.documentSoorten || []);
        setChecklistItems(cached.checklistItems || []);
        setRubriekCriteria(cached.rubriekCriteria || []);
        const initForm = {};
        regels.forEach((r) => {
          initForm[r.id] = {
            stagevenster_start: fmtDate(r.stagevenster_start),
            stagevenster_einde: fmtDate(r.stagevenster_einde),
            minimum_weken: r.minimum_weken ?? "",
            minimum_uren: r.minimum_uren ?? "",
            standaard_uren_per_week: r.standaard_uren_per_week ?? "",
          };
        });
        setRegelForm(initForm);
        setLoading(false);
        return;
      }
      setLoading(true); setError("");
      const res = await api.get("/admin/settings");
      const data = res.data.data || res.data;
      cacheSet("admin_settings", data);
      const regels = data.stageRegels || [];
      setStageRegels(regels);
      setDocSoorten(data.documentSoorten || []);
      setChecklistItems(data.checklistItems || []);
      setRubriekCriteria(data.rubriekCriteria || []);
      const initForm = {};
      regels.forEach((r) => {
        initForm[r.id] = {
          stagevenster_start: fmtDate(r.stagevenster_start),
          stagevenster_einde: fmtDate(r.stagevenster_einde),
          minimum_weken: r.minimum_weken ?? "",
          minimum_uren: r.minimum_uren ?? "",
          standaard_uren_per_week: r.standaard_uren_per_week ?? "",
        };
      });
      setRegelForm(initForm);
    } catch (err) {
      setError(err.response?.data?.message || "Instellingen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setRegelField(id, field, value) {
    setRegelForm((f) => ({ ...f, [id]: { ...f[id], [field]: value } }));
  }

  async function saveRegel(id) {
    setRegelSaving((s) => ({ ...s, [id]: true }));
    try {
      const f = regelForm[id];
      await api.patch(`/admin/stage-rules/${id}`, {
        stagevensterStart: f.stagevenster_start || null,
        stagevensterEinde: f.stagevenster_einde || null,
        minimumWeken: f.minimum_weken !== "" ? Number(f.minimum_weken) : null,
        minimumUren: f.minimum_uren !== "" ? Number(f.minimum_uren) : null,
        standaardUrenPerWeek: f.standaard_uren_per_week !== "" ? Number(f.standaard_uren_per_week) : null,
      });
      showToast("Stageregel opgeslagen.");
      cacheDelete("admin_settings");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Opslaan mislukt", "error");
    } finally {
      setRegelSaving((s) => ({ ...s, [id]: false }));
    }
  }

  async function toggleVerplicht(doc) {
    setDocSoorten((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_verplicht: !doc.is_verplicht } : d));
    try {
      await api.patch(`/admin/document-types/${doc.id}`, { isVerplicht: !doc.is_verplicht });
      cacheDelete("admin_settings");
    } catch (err) {
      setDocSoorten((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_verplicht: doc.is_verplicht } : d));
      showToast(err.response?.data?.message || "Bijwerken mislukt", "error");
    }
  }

  async function addDocType() {
    if (!nieuwDoc.naam.trim()) { setNieuwDocError("Naam is verplicht."); return; }
    setNieuwDocSaving(true); setNieuwDocError("");
    try {
      const res = await api.post("/admin/document-types", {
        naam: nieuwDoc.naam.trim(),
        type: "stage",
        isVerplicht: nieuwDoc.is_verplicht,
      });
      const nieuw = res.data.data || { id: Date.now(), naam: nieuwDoc.naam.trim(), type: "stage", is_verplicht: nieuwDoc.is_verplicht ? 1 : 0, status: "actief" };
      setDocSoorten((prev) => [...prev, nieuw]);
      setNieuwDoc({ naam: "", is_verplicht: false });
      showToast("Documenttype aangemaakt.");
      cacheDelete("admin_settings");
    } catch (err) {
      setNieuwDocError(err.response?.data?.message || "Aanmaken mislukt");
    } finally {
      setNieuwDocSaving(false);
    }
  }

  async function deleteDocType(doc) {
    if (!window.confirm(`"${doc.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    setDocSoorten((prev) => prev.filter((d) => d.id !== doc.id));
    try {
      await api.delete(`/admin/document-types/${doc.id}`);
      showToast("Documenttype verwijderd.");
      cacheDelete("admin_settings");
    } catch (err) {
      setDocSoorten((prev) => [...prev, doc]);
      showToast(err.response?.data?.message || "Verwijderen mislukt", "error");
    }
  }

  async function handleNieuweVersie() {
    setNieuweVersieOpen(false);
    setNieuweVersieSaving(true);
    try {
      await api.post("/admin/document-types/reset");
      showToast("Documenttypes gereset naar standaardwaarden.");
      cacheDelete("admin_settings");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Reset mislukt", "error");
    } finally {
      setNieuweVersieSaving(false);
    }
  }

  async function handleResetChecklist() {
    setResetChecklistOpen(false);
    setResetChecklistSaving(true);
    try {
      await api.post("/admin/checklist-items/reset");
      showToast("Checklist criteria gereset naar standaardwaarden.");
      cacheDelete("admin_settings");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Reset mislukt", "error");
    } finally {
      setResetChecklistSaving(false);
    }
  }

  async function voegChecklistItemToe(e) {
    e.preventDefault();
    if (!nieuwItem.trim()) { setNieuwItemError("Criterium is verplicht."); return; }
    setNieuwItemSaving(true); setNieuwItemError("");
    try {
      const res = await api.post("/admin/checklist-items", { tekst: nieuwItem.trim(), volgorde: checklistItems.length + 1 });
      const nieuw = res.data.data || { id: Date.now(), tekst: nieuwItem.trim(), volgorde: checklistItems.length + 1, actief: 1 };
      setChecklistItems((prev) => [...prev, nieuw]);
      setNieuwItem("");
      showToast("Checklist item toegevoegd.");
      cacheDelete("admin_settings");
    } catch (err) {
      setNieuwItemError(err.response?.data?.message || "Toevoegen mislukt");
    } finally {
      setNieuwItemSaving(false);
    }
  }

  async function bewaarChecklistItem() {
    if (!bewerkItem || !bewerkItem.tekst.trim()) return;
    const tekst = bewerkItem.tekst.trim();
    setChecklistItems((prev) => prev.map((i) => i.id === bewerkItem.id ? { ...i, tekst } : i));
    setBewerkItem(null);
    try {
      await api.patch(`/admin/checklist-items/${bewerkItem.id}`, { tekst });
      showToast("Checklist item opgeslagen.");
      cacheDelete("admin_settings");
    } catch (err) {
      showToast(err.response?.data?.message || "Opslaan mislukt", "error");
    }
  }

  async function toggleChecklistActief(item) {
    setChecklistItems((prev) => prev.map((i) => i.id === item.id ? { ...i, actief: !item.actief } : i));
    try {
      await api.patch(`/admin/checklist-items/${item.id}`, { actief: !item.actief });
      cacheDelete("admin_settings");
    } catch (err) {
      setChecklistItems((prev) => prev.map((i) => i.id === item.id ? { ...i, actief: item.actief } : i));
      showToast(err.response?.data?.message || "Wijzigen mislukt", "error");
    }
  }

  async function bevestigVerwijder() {
    const item = verwijderTarget;
    setVerwijderTarget(null);
    setChecklistItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.delete(`/admin/checklist-items/${item.id}`);
      showToast("Checklist item verwijderd.");
      cacheDelete("admin_settings");
    } catch (err) {
      setChecklistItems((prev) => [...prev, item]);
      showToast(err.response?.data?.message || "Verwijderen mislukt", "error");
    }
  }

  // ── Rubriek eindpresentatie (telt 20% mee in het eindcijfer) ──
  async function voegRubriekToe(e) {
    e.preventDefault();
    const titel = nieuwRubriek.trim();
    if (!titel) return;
    const maxScore = Number(nieuwRubriekMax) || 5;
    setNieuwRubriekSaving(true);
    try {
      const res = await api.post("/admin/rubriek-criteria", { titel, maxScore, volgorde: rubriekCriteria.length + 1 });
      const nieuw = res.data.data || { id: Date.now(), titel, max_score: maxScore, volgorde: rubriekCriteria.length + 1, actief: 1 };
      setRubriekCriteria((prev) => [...prev, nieuw]);
      setNieuwRubriek("");
      setNieuwRubriekMax(5);
      showToast("Rubriekcriterium toegevoegd.");
      cacheDelete("admin_settings");
    } catch (err) {
      showToast(err.response?.data?.message || "Toevoegen mislukt", "error");
    } finally {
      setNieuwRubriekSaving(false);
    }
  }

  async function bewaarRubriek() {
    const titel = (bewerkRubriek?.titel || "").trim();
    if (!titel) return;
    setRubriekCriteria((prev) => prev.map((i) => i.id === bewerkRubriek.id ? { ...i, titel } : i));
    setBewerkRubriek(null);
    try {
      await api.patch(`/admin/rubriek-criteria/${bewerkRubriek.id}`, { titel });
      showToast("Rubriekcriterium opgeslagen.");
      cacheDelete("admin_settings");
    } catch (err) {
      showToast(err.response?.data?.message || "Opslaan mislukt", "error");
    }
  }

  async function toggleRubriekActief(item) {
    setRubriekCriteria((prev) => prev.map((i) => i.id === item.id ? { ...i, actief: !item.actief } : i));
    try {
      await api.patch(`/admin/rubriek-criteria/${item.id}`, { actief: !item.actief });
      cacheDelete("admin_settings");
    } catch (err) {
      setRubriekCriteria((prev) => prev.map((i) => i.id === item.id ? { ...i, actief: item.actief } : i));
      showToast(err.response?.data?.message || "Wijzigen mislukt", "error");
    }
  }

  async function bevestigVerwijderRubriek() {
    const item = verwijderRubriek;
    setVerwijderRubriek(null);
    setRubriekCriteria((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.delete(`/admin/rubriek-criteria/${item.id}`);
      showToast("Rubriekcriterium verwijderd.");
      cacheDelete("admin_settings");
    } catch (err) {
      setRubriekCriteria((prev) => [...prev, item]);
      showToast(err.response?.data?.message || "Verwijderen mislukt", "error");
    }
  }

  if (loading) return <div className="page"><div className="inst_state">Instellingen laden...</div></div>;
  if (error)   return <div className="page"><div className="inst_state inst_error">{error}</div></div>;

  return (
    <div className="page">
      <div className="page_header">
        <h1>Instellingen</h1>
        <p>Beheer stageperiodes, minimum eisen en verplichte documenttypes per academiejaar.</p>
      </div>

      {/* ── Stageperiodes ── */}
      {stageRegels.map((regel) => {
        const f = regelForm[regel.id] || {};
        const isSaving = regelSaving[regel.id];
        return (
          <div key={regel.id} className="card inst_card">
            <div className="inst_card_title">
              Stageperiode — {regel.opleiding || "Alle opleidingen"}
              {regel.academiejaar && <span className="inst_chip">{regel.academiejaar}</span>}
            </div>

            <div className="inst_grid">
              <div className="modal_field">
                <label className="modal_label">Startdatum stagevenster</label>
                <input className="modal_input" type="date" value={f.stagevenster_start || ""}
                  onChange={(e) => setRegelField(regel.id, "stagevenster_start", e.target.value)} />
              </div>
              <div className="modal_field">
                <label className="modal_label">Einddatum stagevenster</label>
                <input className="modal_input" type="date" value={f.stagevenster_einde || ""}
                  onChange={(e) => setRegelField(regel.id, "stagevenster_einde", e.target.value)} />
              </div>
              <div className="modal_field">
                <label className="modal_label">Minimum weken</label>
                <input className="modal_input" type="number" min="1" value={f.minimum_weken}
                  onChange={(e) => setRegelField(regel.id, "minimum_weken", e.target.value)} />
              </div>
              <div className="modal_field">
                <label className="modal_label">Minimum uren totaal</label>
                <input className="modal_input" type="number" min="1" value={f.minimum_uren}
                  onChange={(e) => setRegelField(regel.id, "minimum_uren", e.target.value)} />
              </div>
              <div className="modal_field">
                <label className="modal_label">Standaard uren/week</label>
                <input className="modal_input" type="number" min="1" value={f.standaard_uren_per_week}
                  onChange={(e) => setRegelField(regel.id, "standaard_uren_per_week", e.target.value)} />
              </div>
            </div>

            <div className="inst_card_footer">
              <button className="btn primary" onClick={() => setBevestigRegelId(regel.id)} disabled={isSaving}>
                {isSaving ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : <IconCheck size={16} stroke={1.8} />}
                {isSaving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>
        );
      })}

      {stageRegels.length === 0 && (
        <div className="card inst_state">Geen stageperiodes gevonden.</div>
      )}

      {/* ── Documenttypes ── */}
      <div className="card inst_card">
        <div className="inst_card_title">
          Documenttypes
          <button
            className="btn sm"
            style={{ marginLeft: "auto", fontWeight: 500 }}
            onClick={() => setNieuweVersieOpen(true)}
            disabled={nieuweVersieSaving}
          >
            <IconCopyPlus size={16} stroke={1.8} />
            {nieuweVersieSaving ? "Bezig..." : "Reset naar standaardwaarden"}
          </button>
        </div>
        <p className="inst_sub">Stel in welke documenten studenten verplicht moeten indienen bij hun stagedossier.</p>

        <table className="tbl inst_tbl">
          <thead>
            <tr>
              <th>Naam</th>
              <th>Type</th>
              <th>Verplicht</th>
              <th>Status</th>
              <th style={{ textAlign: "right", width: 90 }}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {docSoorten.map((doc) => (
              <tr key={doc.id}>
                <td style={{ fontWeight: 500 }}>{doc.naam}</td>
                <td style={{ fontSize: 12, color: "var(--faint)" }}>{doc.type}</td>
                <td>
                  <label className="inst_toggle">
                    <input
                      type="checkbox"
                      checked={!!doc.is_verplicht}
                      disabled={docSaving[doc.id]}
                      onChange={() => toggleVerplicht(doc)}
                    />
                    <span className="inst_toggle_label">{doc.is_verplicht ? "Verplicht" : "Optioneel"}</span>
                  </label>
                </td>
                <td>
                  <span style={{ color: doc.status === "actief" ? "var(--green)" : "var(--faint)" }}>{doc.status}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  {/* Vaste documenttypes (is_vast=1) mogen niet verwijderd worden, enkel zelf toegevoegde */}
                  {!doc.is_vast && (
                    <button className="btn sm" style={{ color: "var(--red)" }} onClick={() => deleteDocType(doc)} title="Verwijderen">
                      <IconTrash size={14} stroke={1.8} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Nieuw documenttype */}
        <div className="inst_new_doc">
          <div className="inst_new_doc_title">
            <IconCirclePlus size={16} stroke={1.8} />
            Nieuw documenttype toevoegen
          </div>
          <div className="inst_new_doc_row">
            <div className="modal_field inst_doc_field">
              <label className="modal_label">Naam <span className="modal_required">*</span></label>
              <input
                className="modal_input"
                placeholder="bv. Motivatiebrief, Portfolio..."
                value={nieuwDoc.naam}
                onChange={(e) => { setNieuwDoc((d) => ({ ...d, naam: e.target.value })); setNieuwDocError(""); }}
              />
            </div>
            <div className="inst_new_doc_check_wrap">
              <label className="modal_label">Verplicht</label>
              <label className="inst_verplicht_toggle">
                <input
                  type="checkbox"
                  checked={nieuwDoc.is_verplicht}
                  onChange={(e) => setNieuwDoc((d) => ({ ...d, is_verplicht: e.target.checked }))}
                />
                <span>{nieuwDoc.is_verplicht ? "Verplicht" : "Optioneel"}</span>
              </label>
            </div>
            <div className="inst_new_doc_btn_wrap">
              <label className="modal_label inst_label_spacer">&nbsp;</label>
              <button className="btn primary" onClick={addDocType} disabled={nieuwDocSaving}>
                <IconPlus size={16} stroke={1.8} />
                {nieuwDocSaving ? "Bezig..." : "Toevoegen"}
              </button>
            </div>
          </div>
          {nieuwDocError && <p className="modal_error" style={{ marginTop: 8 }}>{nieuwDocError}</p>}
        </div>
      </div>

      {/* ── Checklist criteria ── */}
      <div className="card inst_card">
        <div className="inst_card_title">
          Checklist criteria
          <button
            className="btn sm"
            style={{ marginLeft: "auto", fontWeight: 500 }}
            onClick={() => setResetChecklistOpen(true)}
            disabled={resetChecklistSaving}
          >
            <IconCopyPlus size={16} stroke={1.8} />
            {resetChecklistSaving ? "Bezig..." : "Reset naar standaardwaarden"}
          </button>
        </div>
        <p className="inst_sub">Deze criteria worden getoond aan studenten bij het indienen van een stagevoorstel.</p>

        <table className="tbl inst_tbl">
          <thead>
            <tr>
              <th>Criterium</th>
              <th style={{ textAlign: "center", width: 90 }}>Actief</th>
              <th style={{ textAlign: "right", width: 140 }}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {checklistItems.length === 0 && (
              <tr><td colSpan="3" style={{ color: "var(--faint)", fontSize: 13, padding: "16px 8px" }}>Nog geen criteria — voeg er hieronder een toe.</td></tr>
            )}
            {checklistItems.map((item) => {
              const isBewerken = bewerkItem?.id === item.id;
              return (
                <tr key={item.id}>
                  <td>
                    {isBewerken ? (
                      <input
                        type="text"
                        value={bewerkItem.tekst}
                        onChange={(e) => setBewerkItem({ ...bewerkItem, tekst: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); bewaarChecklistItem(); } if (e.key === "Escape") setBewerkItem(null); }}
                        style={{
                          width: "100%",
                          fontSize: 13,
                          fontFamily: "var(--font)",
                          color: "var(--dark)",
                          border: "0.5px solid var(--border)",
                          borderRadius: 7,
                          padding: "7px 10px",
                          outline: "none",
                          background: "var(--white)",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "var(--red)"}
                        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: item.actief ? "var(--dark)" : "var(--faint)", fontWeight: 500 }}>{item.tekst}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!isBewerken && (
                      <label className="inst_toggle" style={{ gap: 4 }}>
                        <input type="checkbox" checked={!!item.actief} onChange={() => toggleChecklistActief(item)} />
                        <span className="inst_toggle_label">{item.actief ? "Actief" : "Uit"}</span>
                      </label>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {isBewerken ? (
                        <>
                          <button className="btn sm primary" onClick={bewaarChecklistItem}>
                            <IconCheck size={14} stroke={2} /> Opslaan
                          </button>
                          <button className="btn sm" onClick={() => setBewerkItem(null)}>
                            Annuleren
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn sm" onClick={() => setBewerkItem({ id: item.id, tekst: item.tekst })}>
                            <IconPencil size={14} stroke={1.8} /> Bewerken
                          </button>
                          <button className="btn sm" style={{ color: "var(--red)" }} onClick={() => setVerwijderTarget(item)}>
                            <IconTrash size={14} stroke={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form onSubmit={voegChecklistItemToe} className="inst_new_doc">
          <div className="inst_new_doc_title">
            <IconCirclePlus size={16} stroke={1.8} />
            Nieuw criterium toevoegen
          </div>
          <div className="inst_new_doc_row">
            <div className="modal_field inst_doc_field">
              <label className="modal_label">Criterium <span className="modal_required">*</span></label>
              <input
                className="modal_input"
                placeholder="bv. IT-gerelateerde opdracht..."
                value={nieuwItem}
                onChange={(e) => { setNieuwItem(e.target.value); setNieuwItemError(""); }}
              />
            </div>
            <div className="inst_new_doc_btn_wrap">
              <label className="modal_label inst_label_spacer">&nbsp;</label>
              <button className="btn primary" type="submit" disabled={nieuwItemSaving}>
                <IconPlus size={16} stroke={1.8} />
                {nieuwItemSaving ? "Bezig..." : "Toevoegen"}
              </button>
            </div>
          </div>
          {nieuwItemError && <p className="modal_error" style={{ marginTop: 8 }}>{nieuwItemError}</p>}
        </form>
      </div>

      {/* ── Rubriek eindpresentatie ── */}
      <div className="card inst_card">
        <div className="inst_card_title">Rubriek eindpresentatie</div>
        <p className="inst_sub">De docent scoort deze criteria bij de eindpresentatie. Samen tellen ze voor <b>20%</b> van het eindcijfer (competenties 80%).</p>

        <table className="tbl inst_tbl">
          <thead>
            <tr>
              <th>Criterium</th>
              <th style={{ textAlign: "center", width: 90 }}>Actief</th>
              <th style={{ textAlign: "right", width: 140 }}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {rubriekCriteria.length === 0 && (
              <tr><td colSpan="3" style={{ color: "var(--faint)", fontSize: 13, padding: "16px 8px" }}>Nog geen rubriekcriteria — voeg er hieronder een toe.</td></tr>
            )}
            {rubriekCriteria.map((item) => {
              const isBewerken = bewerkRubriek?.id === item.id;
              return (
                <tr key={item.id}>
                  <td>
                    {isBewerken ? (
                      <input
                        type="text"
                        value={bewerkRubriek.titel}
                        onChange={(e) => setBewerkRubriek({ ...bewerkRubriek, titel: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); bewaarRubriek(); } if (e.key === "Escape") setBewerkRubriek(null); }}
                        style={{ width: "100%", fontSize: 13, fontFamily: "var(--font)", color: "var(--dark)", border: "0.5px solid var(--border)", borderRadius: 7, padding: "7px 10px", outline: "none", background: "var(--white)", boxSizing: "border-box" }}
                        onFocus={(e) => e.target.style.borderColor = "var(--red)"}
                        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: item.actief ? "var(--dark)" : "var(--faint)", fontWeight: 500 }}>{item.titel}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!isBewerken && (
                      <label className="inst_toggle" style={{ gap: 4 }}>
                        <input type="checkbox" checked={!!item.actief} onChange={() => toggleRubriekActief(item)} />
                        <span className="inst_toggle_label">{item.actief ? "Actief" : "Uit"}</span>
                      </label>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {isBewerken ? (
                        <>
                          <button className="btn sm primary" onClick={bewaarRubriek}>
                            <IconCheck size={14} stroke={2} /> Opslaan
                          </button>
                          <button className="btn sm" onClick={() => setBewerkRubriek(null)}>Annuleren</button>
                        </>
                      ) : (
                        <>
                          <button className="btn sm" onClick={() => setBewerkRubriek({ id: item.id, titel: item.titel })}>
                            <IconPencil size={14} stroke={1.8} /> Bewerken
                          </button>
                          <button className="btn sm" style={{ color: "var(--red)" }} onClick={() => setVerwijderRubriek(item)}>
                            <IconTrash size={14} stroke={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form onSubmit={voegRubriekToe} className="inst_new_doc">
          <div className="inst_new_doc_title">
            <IconCirclePlus size={16} stroke={1.8} />
            Nieuw rubriekcriterium toevoegen
          </div>
          <div className="inst_new_doc_row">
            <div className="modal_field inst_doc_field">
              <label className="modal_label">Criterium <span className="modal_required">*</span></label>
              <input
                className="modal_input"
                placeholder="bv. Communicatie en presentatie..."
                value={nieuwRubriek}
                onChange={(e) => setNieuwRubriek(e.target.value)}
              />
            </div>
            <div className="modal_field" style={{ maxWidth: 110 }}>
              <label className="modal_label">Max score</label>
              <input
                className="modal_input"
                type="number"
                min="1"
                max="100"
                value={nieuwRubriekMax}
                onChange={(e) => setNieuwRubriekMax(e.target.value)}
              />
            </div>
            <div className="inst_new_doc_btn_wrap">
              <label className="modal_label inst_label_spacer">&nbsp;</label>
              <button className="btn primary" type="submit" disabled={nieuwRubriekSaving}>
                <IconPlus size={16} stroke={1.8} />
                {nieuwRubriekSaving ? "Bezig..." : "Toevoegen"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {verwijderRubriek && (
        <div className="modal_overlay" onClick={() => setVerwijderRubriek(null)}>
          <div className="modal_box modal_box_sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Rubriekcriterium verwijderen</span>
              <button className="icon_btn" onClick={() => setVerwijderRubriek(null)} type="button"><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dark)" }}>
                Wil je "{verwijderRubriek.titel}" verwijderen? Bestaande presentatiescores blijven bewaard.
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setVerwijderRubriek(null)}>Annuleren</button>
              <button className="btn primary" style={{ background: "var(--red)" }} onClick={bevestigVerwijderRubriek}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {bevestigRegelId !== null && (
        <div className="modal_overlay" onClick={() => setBevestigRegelId(null)}>
          <div className="modal_box modal_box_sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Wijzigingen opslaan</span>
              <button className="icon_btn" onClick={() => setBevestigRegelId(null)} type="button">
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dark)" }}>
                Ben je zeker dat je de stageperiode wil opslaan? De wijzigingen worden onmiddellijk van kracht.
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setBevestigRegelId(null)} type="button">
                Annuleren
              </button>
              <button
                className="btn primary"
                onClick={() => { const id = bevestigRegelId; setBevestigRegelId(null); saveRegel(id); }}
                type="button"
              >
                <IconCheck size={16} stroke={1.8} />
                Ja, opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {nieuweVersieOpen && (
        <div className="modal_overlay" onClick={() => setNieuweVersieOpen(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Reset naar standaardwaarden</span>
              <button className="icon_btn" onClick={() => setNieuweVersieOpen(false)} type="button">
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
                De documenttypes worden gereset naar de standaardwaarden:
              </p>
              <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", fontSize: 13, color: "var(--sub)", lineHeight: 2 }}>
                <li>De <strong>4 vaste documenttypes</strong> worden hersteld en geactiveerd</li>
                <li>Alle <strong>zelf toegevoegde types</strong> worden verwijderd</li>
              </ul>
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                Deze actie kan niet ongedaan worden gemaakt.
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setNieuweVersieOpen(false)} type="button">
                Annuleren
              </button>
              <button className="btn primary" onClick={handleNieuweVersie} type="button">
                <IconCopyPlus size={16} stroke={1.8} />
                Ja, reset alles
              </button>
            </div>
          </div>
        </div>
      )}

      {verwijderTarget && (
        <div className="modal_overlay" onClick={() => setVerwijderTarget(null)}>
          <div className="modal_box modal_box_sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Criterium verwijderen</span>
              <button className="icon_btn" onClick={() => setVerwijderTarget(null)} type="button">
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dark)", lineHeight: 1.6 }}>
                Ben je zeker dat je dit criterium wil verwijderen?
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--sub)", fontStyle: "italic" }}>
                "{verwijderTarget.tekst}"
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setVerwijderTarget(null)} type="button">Annuleren</button>
              <button className="btn primary" onClick={bevestigVerwijder} type="button">
                <IconTrash size={16} stroke={1.8} />
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {resetChecklistOpen && (
        <div className="modal_overlay" onClick={() => setResetChecklistOpen(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Reset naar standaardwaarden</span>
              <button className="icon_btn" onClick={() => setResetChecklistOpen(false)} type="button">
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
                De checklist criteria worden gereset naar de standaardwaarden:
              </p>
              <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", fontSize: 13, color: "var(--sub)", lineHeight: 2 }}>
                <li>IT-gerelateerde opdracht met een ontwikkelcomponent</li>
                <li>Mentor met een technische functie binnen het bedrijf</li>
                <li>Concrete omschrijving: technologie, taken en team</li>
                <li>Stage in een professionele bedrijfsomgeving</li>
              </ul>
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                Alle huidige aanpassingen worden overschreven. Deze actie kan niet ongedaan worden gemaakt.
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setResetChecklistOpen(false)} type="button">
                Annuleren
              </button>
              <button className="btn primary" onClick={handleResetChecklist} type="button">
                <IconCopyPlus size={16} stroke={1.8} />
                Ja, reset alles
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={"dd_toast" + (toast.type === "error" ? " dd_toast_error" : "")}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
