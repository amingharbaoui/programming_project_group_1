import { useEffect, useState, useCallback } from "react";
import "./CompetenciesPage.css";
import {
  IconCheck,
  IconCopyPlus,
  IconEdit,
  IconListDetails,
  IconId,
  IconTrash,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function CompetentieModal({ initial, onClose, onSaved, maxVolgorde }) {
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
                max={maxVolgorde}
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

function SuccesModal({ title, message, onClose }) {
  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">{title}</span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>
        <div className="modal_body">
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
            {message}
          </p>
        </div>
        <div className="modal_footer">
          <button className="btn primary" onClick={onClose} type="button">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicerenModal({ onClose, onConfirm, loading }) {
  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Competentieprofiel publiceren</span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>
        <div className="modal_body">
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
            Ben je zeker dat je dit competentieprofiel wil publiceren?
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
            Het profiel wordt actief gezet en alle andere profielen worden gearchiveerd. Dit kan niet ongedaan worden gemaakt.
          </p>
        </div>
        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button" disabled={loading}>
            Annuleren
          </button>
          <button
            className="btn primary"
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : <IconCheck size={16} stroke={1.8} />}
            Ja, publiceren
          </button>
        </div>
      </div>
    </div>
  );
}

function NieuweVersieModal({ onClose, onConfirm, loading }) {
  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Nieuwe versie maken</span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>
        <div className="modal_body">
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--dark)", lineHeight: 1.6 }}>
            Het profiel wordt volledig gereset:
          </p>
          <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", fontSize: 13, color: "var(--sub)", lineHeight: 2 }}>
            <li>De <strong>11 standaardcompetenties</strong> worden hersteld</li>
            <li>Alle <strong>gewichten</strong> worden teruggezet naar de standaardwaarden</li>
            <li>De status wordt teruggezet op <strong>concept</strong></li>
          </ul>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
            Deze actie kan niet ongedaan worden gemaakt.
          </p>
        </div>
        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button" disabled={loading}>
            Annuleren
          </button>
          <button
            className="btn primary"
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : <IconCopyPlus size={16} stroke={1.8} />}
            Ja, reset alles
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
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState("");
  const [gekoppeldeDossiers, setGekoppeldeDossiers] = useState(null);

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccesOpen, setPublishSuccesOpen] = useState(false);

  const [nieuweVersieLoading, setNieuweVersieLoading] = useState(false);
  const [nieuweVersieError, setNieuweVersieError] = useState("");
  const [nieuweVersieSuccesOpen, setNieuweVersieSuccesOpen] = useState(false);
  const [nieuweVersieModalOpen, setNieuweVersieModalOpen] = useState(false);
  const [publicerenModalOpen, setPublicerenModalOpen] = useState(false);

  // Modals
  const [toevoegenOpen, setToevoegenOpen] = useState(false);
  const [bewerkTarget, setBewerkTarget] = useState(null);
  const [verwijderTarget, setVerwijderTarget] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [compRes, dossierRes] = await Promise.all([
        api.get("/competencies", { params: { _t: Date.now() } }),
        api.get("/admin/dossiers").catch(() => null),
      ]);
      const { profiel: geladen_profiel, competenties: geladen_competenties } = compRes.data.data;
      setProfiel(geladen_profiel);
      setCompetenties(geladen_competenties);
      const weights = {};
      geladen_competenties.forEach((c) => {
        weights[c.id] = Number(c.gewicht_percentage);
      });
      setLocalGewichten(weights);

      if (dossierRes && geladen_profiel?.academiejaar) {
        const dossiers = dossierRes.data.data || [];
        const count = dossiers.filter(
          (d) => d.academiejaar === geladen_profiel.academiejaar
        ).length;
        setGekoppeldeDossiers(count);
      } else {
        setGekoppeldeDossiers(null);
      }
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
    try {
      await api.patch(`/competencies/profiles/${profiel.id}/publish`);
      setPublishSuccesOpen(true);
      fetchData();
    } catch (err) {
      setPublishError(err.response?.data?.message || "Publiceren mislukt");
    } finally {
      setPublishLoading(false);
    }
  }

  async function handleNieuweVersie() {
    if (!profiel?.id) return;
    setNieuweVersieModalOpen(false);
    setNieuweVersieLoading(true);
    setNieuweVersieError("");
    try {
      await api.post(`/competencies/profiles/${profiel.id}/duplicate`);
      const res = await api.get("/competencies", { params: { _t: Date.now() } });
      const { profiel: nieuwProfiel, competenties: nieuweCompetenties } = res.data.data;
      setProfiel(nieuwProfiel);
      setCompetenties(nieuweCompetenties);
      const weights = {};
      nieuweCompetenties.forEach((c) => {
        weights[c.id] = Number(c.gewicht_percentage);
      });
      setLocalGewichten(weights);
      setResetKey((k) => k + 1);
      setNieuweVersieSuccesOpen(true);
    } catch (err) {
      setNieuweVersieError(err.response?.data?.message || "Reset mislukt");
    } finally {
      setNieuweVersieLoading(false);
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
          maxVolgorde={competenties.length + 1}
        />
      )}
      {bewerkTarget && (
        <CompetentieModal
          initial={bewerkTarget}
          onClose={() => setBewerkTarget(null)}
          onSaved={() => { setBewerkTarget(null); fetchData(); }}
          maxVolgorde={competenties.length}
        />
      )}
      {verwijderTarget && (
        <VerwijderModal
          competentie={verwijderTarget}
          onClose={() => setVerwijderTarget(null)}
          onDeleted={() => { setVerwijderTarget(null); fetchData(); }}
        />
      )}
      {nieuweVersieModalOpen && (
        <NieuweVersieModal
          onClose={() => setNieuweVersieModalOpen(false)}
          onConfirm={handleNieuweVersie}
          loading={nieuweVersieLoading}
        />
      )}
      {publicerenModalOpen && (
        <PublicerenModal
          onClose={() => setPublicerenModalOpen(false)}
          onConfirm={() => { setPublicerenModalOpen(false); handlePublish(); }}
          loading={publishLoading}
        />
      )}
      {publishSuccesOpen && (
        <SuccesModal
          title="Competentieprofiel gepubliceerd"
          message="Het competentieprofiel is succesvol gepubliceerd en is nu actief."
          onClose={() => setPublishSuccesOpen(false)}
        />
      )}
      {nieuweVersieSuccesOpen && (
        <SuccesModal
          title="Nieuwe versie aangemaakt"
          message="De 11 standaardcompetenties zijn hersteld en de gewichten zijn teruggezet naar de standaardwaarden."
          onClose={() => setNieuweVersieSuccesOpen(false)}
        />
      )}

      <div className="competencies_page">
        <div className="competencies_main">
          {/* Hero */}
          <div className="card competencies_hero">
            <div className="competencies_hero_content">
              <span className={`page_chip${profiel?.status === "actief" ? " page_chip_actief" : ""}`}>
                {profiel?.status === "actief" ? "Actief profiel" : profiel?.status ?? "—"}
              </span>
              <h1>Competentieprofiel</h1>
              <p>
                Versioneerbaar beheer, wijzigingen gelden voor nieuwe dossiers en
                niet stilzwijgend voor lopende evaluaties.
              </p>
              {error && <p style={{ color: "var(--red)", margin: "6px 0 0" }}>{error}</p>}
              {publishError && <p style={{ color: "var(--red)", margin: "6px 0 0" }}>{publishError}</p>}
              {nieuweVersieError && <p style={{ color: "var(--red)", margin: "6px 0 0" }}>{nieuweVersieError}</p>}
            </div>

            <div className="competencies_hero_actions">
              <button
                className="btn"
                onClick={() => setNieuweVersieModalOpen(true)}
                disabled={nieuweVersieLoading}
              >
                {nieuweVersieLoading
                  ? <IconLoader2 size={16} stroke={1.8} className="spin" />
                  : <IconCopyPlus size={16} stroke={1.8} />}
                Nieuwe versie maken
              </button>
              <button
                className="btn primary"
                onClick={() => setPublicerenModalOpen(true)}
                disabled={publishLoading || !totaalOk}
              >
                {publishLoading
                  ? <IconLoader2 size={16} stroke={1.8} className="spin" />
                  : <IconCheck size={16} stroke={1.8} />}
                Publiceren
              </button>
            </div>
          </div>

          {/* Profiel kaart */}
          {!loading && profiel && (
            <div className="card profile_card">
              <div className="card_title">
                <IconId size={16} stroke={1.8} />
                Profiel
              </div>
              <div className="kv">
                <span className="k">Profiel</span>
                <span className="v">{profiel.opleiding}</span>
              </div>
              <div className="kv">
                <span className="k">Geldig vanaf</span>
                <span className="v">{profiel.academiejaar}</span>
              </div>
              {gekoppeldeDossiers !== null && (
                <div className="kv">
                  <span className="k">Gekoppelde dossiers</span>
                  <span className="v">
                    {gekoppeldeDossiers === 0
                      ? "Geen dossiers"
                      : `${gekoppeldeDossiers} ${gekoppeldeDossiers === 1 ? "actief dossier" : "actieve dossiers"}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Competenties tabel */}
          <div className="card competencies_card">
            <div className="competencies_head">
              <div className="card_title">
                <IconListDetails size={16} stroke={1.8} />
                Competenties
              </div>
              <button className="btn" onClick={() => setToevoegenOpen(true)}>
                <IconCopyPlus size={16} stroke={1.8} />
                Competentie toevoegen
              </button>
            </div>

            <div className="competency_table" key={resetKey}>
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
                        <IconEdit size={16} stroke={1.8} />
                      </button>
                      <button
                        className="icon_btn"
                        type="button"
                        aria-label="Competentie verwijderen"
                        onClick={() => setVerwijderTarget(c)}
                      >
                        <IconTrash size={16} stroke={1.8} />
                      </button>
                    </div>
                  </div>
                ))
              )}
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
            <button
              className="btn full_width"
              onClick={() => setNieuweVersieModalOpen(true)}
              disabled={nieuweVersieLoading}
            >
              {nieuweVersieLoading
                ? <IconLoader2 size={16} stroke={1.8} className="spin" />
                : <IconCopyPlus size={16} stroke={1.8} />}
              Nieuwe versie maken
            </button>
            <button
              className="btn primary full_width"
              onClick={handlePublish}
              disabled={publishLoading || !totaalOk}
            >
              {publishLoading
                ? <IconLoader2 size={16} stroke={1.8} className="spin" />
                : <IconCheck size={16} stroke={1.8} />}
              Publiceren
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
