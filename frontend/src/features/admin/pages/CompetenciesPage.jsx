import { useEffect, useState, useCallback } from "react";
import "./CompetenciesPage.css";
import {
  IconArchive,
  IconChecks,
  IconCopyPlus,
  IconEdit,
  IconListDetails,
  IconTrash,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function CompetentieModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    naam: initial?.naam ?? "",
    beschrijving: initial?.beschrijving ?? "",
    gewichtPercentage: initial?.gewicht_percentage ?? 0,
    volgorde: initial?.volgorde ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setErr("");
    try {
      if (isEdit) {
        await api.patch(`/competencies/${initial.id}`, {
          naam: form.naam,
          beschrijving: form.beschrijving || null,
          gewichtPercentage: Number(form.gewichtPercentage),
          volgorde: form.volgorde !== "" ? Number(form.volgorde) : null,
        });
      } else {
        await api.post("/competencies", {
          code: form.code,
          naam: form.naam,
          beschrijving: form.beschrijving || null,
          gewichtPercentage: Number(form.gewichtPercentage),
          volgorde: form.volgorde !== "" ? Number(form.volgorde) : null,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">
            {isEdit ? "Competentie bewerken" : "Competentie toevoegen"}
          </span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>

        <div className="modal_body">
          {!isEdit && (
            <div className="modal_field">
              <label>Code <span className="modal_required">*</span></label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="bv. LO12"
              />
            </div>
          )}

          <div className="modal_field">
            <label>Naam <span className="modal_required">*</span></label>
            <input
              type="text"
              value={form.naam}
              onChange={(e) => set("naam", e.target.value)}
              placeholder="Naam van de competentie"
            />
          </div>

          <div className="modal_field">
            <label>Beschrijving</label>
            <textarea
              value={form.beschrijving}
              onChange={(e) => set("beschrijving", e.target.value)}
              rows={3}
              placeholder="Optionele beschrijving"
            />
          </div>

          <div className="modal_row">
            <div className="modal_field">
              <label>Gewicht (%)</label>
              <input
                type="number"
                value={form.gewichtPercentage}
                min="0"
                max="100"
                onChange={(e) => set("gewichtPercentage", e.target.value)}
              />
            </div>
            <div className="modal_field">
              <label>Volgorde</label>
              <input
                type="number"
                value={form.volgorde}
                min="1"
                onChange={(e) => set("volgorde", e.target.value)}
                placeholder="Optioneel"
              />
            </div>
          </div>

          {err && <p className="modal_error">{err}</p>}
        </div>

        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button">
            Annuleren
          </button>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={saving}
            type="button"
          >
            {saving ? (
              <IconLoader2 size={16} stroke={1.8} className="spin" />
            ) : null}
            {isEdit ? "Wijzigingen opslaan" : "Toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Verwijderen bevestigen ──────────────────────────────────────────
function VerwijderModal({ competentie, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setErr("");
    try {
      await api.delete(`/competencies/${competentie.id}`);
      onDeleted();
    } catch (e) {
      setErr(e.response?.data?.message || "Verwijderen mislukt");
      setDeleting(false);
    }
  }

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Competentie verwijderen</span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>

        <div className="modal_body">
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
            Ben je zeker dat je <strong>{competentie.naam}</strong> wil verwijderen?
            Deze actie kan niet ongedaan worden gemaakt.
          </p>
          {err && <p className="modal_error">{err}</p>}
        </div>

        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button">
            Annuleren
          </button>
          <button
            className="btn danger_outline"
            onClick={handleDelete}
            disabled={deleting}
            type="button"
          >
            {deleting ? (
              <IconLoader2 size={16} stroke={1.8} className="spin" />
            ) : (
              <IconTrash size={16} stroke={1.8} />
            )}
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompetenciesPage() {
  const { user } = useAuth();

  const [profiel, setProfiel] = useState(null);
  const [competenties, setCompetenties] = useState([]);
  const [localGewichten, setLocalGewichten] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");

  // Modals
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [bewerkTarget, setBewerkTarget] = useState(null); // competentie object
  const [verwijderTarget, setVerwijderTarget] = useState(null); // competentie object

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/competencies");
      const { profiel, competenties } = res.data.data;
      setProfiel(profiel);
      setCompetenties(competenties);
      const weights = {};
      competenties.forEach((c) => {
        weights[c.id] = Number(c.gewicht_percentage);
      });
      setLocalGewichten(weights);
    } catch (err) {
      setError(err.response?.data?.message || "Competenties ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const localTotaal = Object.values(localGewichten).reduce(
    (sum, w) => sum + Number(w || 0),
    0
  );
  const totaalOk = Math.abs(localTotaal - 100) < 0.01;

  async function handleWeightBlur(id, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    try {
      await api.patch(`/competencies/${id}`, { gewichtPercentage: parsed });
      const res = await api.get("/competencies");
      const weights = {};
      res.data.data.competenties.forEach((c) => {
        weights[c.id] = Number(c.gewicht_percentage);
      });
      setLocalGewichten(weights);
    } catch {
      // silent
    }
  }

  async function handlePublish() {
    if (!profiel?.id) return;
    setPublishLoading(true);
    setPublishError("");
    setPublishSuccess("");
    try {
      await api.patch(`/competencies/profiles/${profiel.id}/publish`);
      setPublishSuccess("Competentieprofiel succesvol gepubliceerd.");
      fetchData();
    } catch (err) {
      setPublishError(err.response?.data?.message || "Publiceren mislukt");
    } finally {
      setPublishLoading(false);
    }
  }

  const aantalActief = competenties.filter((c) => c.is_actief).length;

  return (
    <>
      {/* Modals */}
      {toevoegenOpen && (
        <CompetentieModal
          initial={null}
          onClose={() => setToevoegenOpen(false)}
          onSaved={() => { setToevoegenOpen(false); fetchData(); }}
        />
      )}
      {bewerkTarget && (
        <CompetentieModal
          initial={bewerkTarget}
          onClose={() => setBewerkTarget(null)}
          onSaved={() => { setBewerkTarget(null); fetchData(); }}
        />
      )}
      {verwijderTarget && (
        <VerwijderModal
          competentie={verwijderTarget}
          onClose={() => setVerwijderTarget(null)}
          onDeleted={() => { setVerwijderTarget(null); fetchData(); }}
        />
      )}

      <div className="competencies_page">
        <div className="competencies_main">
          {/* Hero */}
          <div className="card competencies_hero">
            <div className="competencies_hero_content">
              <span className="page_chip">
                {profiel?.status === "actief" ? "Actief profiel" : profiel?.status ?? "—"}
              </span>
              <h1>Competentieprofiel</h1>
              <p>
                Versioneerbaar beheer, wijzigingen gelden voor nieuwe dossiers en
                niet stilzwijgend voor lopende evaluaties.
              </p>
              {error && <p style={{ color: "var(--red)", margin: "6px 0 0" }}>{error}</p>}
              {publishError && <p style={{ color: "var(--red)", margin: "6px 0 0" }}>{publishError}</p>}
              {publishSuccess && <p style={{ color: "var(--green)", margin: "6px 0 0" }}>{publishSuccess}</p>}
            </div>

            <div className="competencies_hero_actions">
              <button className="btn">
                <IconCopyPlus size={18} stroke={1.8} />
                Nieuwe versie maken
              </button>
              <button className="btn">
                <IconArchive size={18} stroke={1.8} />
                Archiveren
              </button>
              <button
                className="btn primary"
                onClick={handlePublish}
                disabled={publishLoading || !totaalOk}
              >
                {publishLoading
                  ? <IconLoader2 size={18} stroke={1.8} className="spin" />
                  : <IconChecks size={18} stroke={1.8} />}
                Publiceren
              </button>
            </div>
          </div>

          {/* Profiel kaart */}
          {!loading && profiel && (
            <div className="card profile_card">
              <div className="card_title">
                <IconListDetails size={17} stroke={1.8} />
                Profiel
              </div>
              <div className="kv">
                <span className="k">Profiel</span>
                <span className="v">{profiel.opleiding} {profiel.academiejaar}</span>
              </div>
              <div className="kv">
                <span className="k">Versie</span>
                <span className="v">
                  {profiel.versie}
                  {profiel.status !== "actief" && (
                    <span className="concept_note"> conceptwijzigingen niet gepubliceerd</span>
                  )}
                </span>
              </div>
              <div className="kv">
                <span className="k">Status</span>
                <span className="v">
                  <span className={`status ${profiel.status === "actief" ? "s_ok" : ""}`}>
                    {profiel.status.charAt(0).toUpperCase() + profiel.status.slice(1)}
                  </span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Geldig vanaf</span>
                <span className="v">{profiel.academiejaar}</span>
              </div>
              <div className="profile_note">
                Wijzigingen aan een gepubliceerd competentieprofiel gelden alleen
                voor nieuwe dossiers of voor dossiers waarvoor deze versie
                expliciet wordt gekoppeld.
              </div>
            </div>
          )}

          {/* Competenties tabel */}
          <div className="card competencies_card">
            <div className="competencies_head">
              <div className="card_title">
                <IconListDetails size={17} stroke={1.8} />
                Competenties
              </div>
              <button className="btn" onClick={() => setToevoegenOpen(true)}>
                <IconCopyPlus size={18} stroke={1.8} />
                Competentie toevoegen
              </button>
            </div>

            <div className="competency_table">
              <div className="competency_table_head">
                <span>#</span>
                <span>Competentie</span>
                <span>Gewicht</span>
                <span>Acties</span>
              </div>

              {loading ? (
                <div style={{ padding: "12px 0", color: "var(--sub)", fontSize: 13 }}>Bezig met laden…</div>
              ) : competenties.length === 0 ? (
                <div style={{ padding: "12px 0", color: "var(--sub)", fontSize: 13 }}>
                  Geen competenties gevonden.
                </div>
              ) : (
                competenties.map((c, index) => (
                  <div className="competency_row" key={c.id}>
                    <span className="competency_index">{index + 1}</span>
                    <div className="competency_name">{c.naam}</div>
                    <div className="competency_weight">
                      <input
                        type="number"
                        value={localGewichten[c.id] ?? c.gewicht_percentage}
                        min="0"
                        max="100"
                        onChange={(e) =>
                          setLocalGewichten((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        onBlur={(e) => handleWeightBlur(c.id, e.target.value)}
                      />
                    </div>
                    <div className="competency_actions">
                      <button
                        className="icon_btn"
                        type="button"
                        aria-label="Competentie bewerken"
                        onClick={() => setBewerkTarget(c)}
                      >
                        <IconEdit size={17} stroke={1.8} />
                      </button>
                      <button
                        className="icon_btn"
                        type="button"
                        aria-label="Competentie verwijderen"
                        onClick={() => setVerwijderTarget(c)}
                      >
                        <IconTrash size={17} stroke={1.8} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="competencies_footer">
              Het totaalgewicht moet exact 100 zijn voordat je dit
              competentieprofiel kan publiceren.
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="competencies_side">
          <div className="card summary_card">
            <div className="card_title">Overzicht</div>
            <div className="summary_line">
              <span>Aantal competenties</span>
              <strong>{aantalActief}</strong>
            </div>
            <div className="summary_line">
              <span>Status</span>
              <strong className={profiel?.status === "actief" ? "ok_text" : ""}>
                {profiel
                  ? profiel.status.charAt(0).toUpperCase() + profiel.status.slice(1)
                  : "—"}
              </strong>
            </div>
          </div>

          <div className="card validation_card">
            <div className="card_title">Validatie</div>
            <p>
              Controleer of alle gewichten samen exact 100 zijn en publiceer pas
              daarna de nieuwe versie.
            </p>
            {totaalOk ? (
              <div className="validation_ok">Totaal: {localTotaal}%</div>
            ) : (
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "var(--red-light)", color: "var(--red)",
                fontSize: "12.5px", fontWeight: 600,
              }}>
                Totaal: {localTotaal}%
              </div>
            )}
          </div>

          <div className="card actions_card">
            <div className="card_title">Snelle acties</div>
            <button className="btn full_width">
              <IconCopyPlus size={18} stroke={1.8} />
              Nieuwe versie maken
            </button>
            <button className="btn full_width">
              <IconArchive size={18} stroke={1.8} />
              Dupliceren
            </button>
            <button className="btn full_width danger_outline">
              <IconTrash size={18} stroke={1.8} />
              Profiel archiveren
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
