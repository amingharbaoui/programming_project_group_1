import { useEffect, useState, useCallback } from "react";
import { IconCheck, IconCirclePlus, IconCopyPlus, IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
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
    setDocSaving((s) => ({ ...s, [doc.id]: true }));
    try {
      await api.patch(`/admin/document-types/${doc.id}`, { isVerplicht: !doc.is_verplicht });
      setDocSoorten((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_verplicht: !doc.is_verplicht } : d));
    } catch (err) {
      showToast(err.response?.data?.message || "Bijwerken mislukt", "error");
    } finally {
      setDocSaving((s) => ({ ...s, [doc.id]: false }));
    }
  }

  async function addDocType() {
    if (!nieuwDoc.naam.trim()) { setNieuwDocError("Naam is verplicht."); return; }
    setNieuwDocSaving(true); setNieuwDocError("");
    try {
      await api.post("/admin/document-types", {
        naam: nieuwDoc.naam.trim(),
        type: "stage",
        isVerplicht: nieuwDoc.is_verplicht,
      });
      setNieuwDoc({ naam: "", is_verplicht: false });
      showToast("Documenttype aangemaakt.");
      cacheDelete("admin_settings");
      load();
    } catch (err) {
      setNieuwDocError(err.response?.data?.message || "Aanmaken mislukt");
    } finally {
      setNieuwDocSaving(false);
    }
  }

  async function deleteDocType(doc) {
    if (!window.confirm(`"${doc.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    setDocSaving((s) => ({ ...s, [doc.id]: true }));
    try {
      await api.delete(`/admin/document-types/${doc.id}`);
      setDocSoorten((prev) => prev.filter((d) => d.id !== doc.id));
      showToast("Documenttype verwijderd.");
      cacheDelete("admin_settings");
    } catch (err) {
      showToast(err.response?.data?.message || "Verwijderen mislukt", "error");
    } finally {
      setDocSaving((s) => ({ ...s, [doc.id]: false }));
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
            {nieuweVersieSaving ? "Bezig..." : "Nieuwe versie maken"}
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
          {nieuwDocError && <p className="modal_error">{nieuwDocError}</p>}
        </div>
      </div>

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
              <span className="modal_title">Nieuwe versie maken</span>
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

      {toast && (
        <div className={"dd_toast" + (toast.type === "error" ? " dd_toast_error" : "")}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
