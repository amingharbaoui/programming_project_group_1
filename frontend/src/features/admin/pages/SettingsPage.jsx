import { useEffect, useState } from "react";
import "../../../index.css";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { IconTrash, IconPencil, IconCheck, IconX, IconPlus } from "@tabler/icons-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [regels, setRegels] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [melding, setMelding] = useState({ tekst: "", type: "" });
  const [nieuwType, setNieuwType] = useState({ naam: "", isVerplicht: false });
  const [nieuwItem, setNieuwItem] = useState("");
  const [bewerkItem, setBewerkItem] = useState(null); // { id, tekst }

  async function laden() {
    try {
      setLoading(true);
      const res = await api.get("/admin/settings");
      setRegels(res.data.data?.stageRegels || []);
      setDocTypes(res.data.data?.documentSoorten || []);
      setChecklistItems(res.data.data?.checklistItems || []);
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Instellingen ophalen mislukt", type: "s_rood" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { laden(); }, [user.id]);

  function zetRegel(id, veld, waarde) {
    setRegels((prev) => prev.map((r) => (r.id === id ? { ...r, [veld]: waarde } : r)));
  }

  async function bewaarRegel(regel) {
    try {
      setMelding({ tekst: "", type: "" });
      await api.patch(`/admin/stage-rules/${regel.id}`, {
        stagevensterStart: (regel.stagevenster_start || "").slice(0, 10),
        stagevensterEinde: (regel.stagevenster_einde || "").slice(0, 10),
        minimumWeken: Number(regel.minimum_weken),
        minimumUren: Number(regel.minimum_uren),
        standaardUrenPerWeek: regel.standaard_uren_per_week ? Number(regel.standaard_uren_per_week) : null,
      });
      setMelding({ tekst: "Stageregel opgeslagen.", type: "s_ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s_rood" });
    }
  }

  async function toggleVerplicht(dt) {
    try {
      await api.patch(`/admin/document-types/${dt.id}`, { isVerplicht: !dt.is_verplicht });
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Wijzigen mislukt", type: "s_rood" });
    }
  }

  async function verwijderType(dt) {
    if (!window.confirm(`Documenttype "${dt.naam}" verwijderen?`)) return;
    try {
      await api.delete(`/admin/document-types/${dt.id}`);
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Verwijderen mislukt", type: "s_rood" });
    }
  }

  async function voegTypeToe(e) {
    e.preventDefault();
    if (!nieuwType.naam.trim()) return;
    try {
      setMelding({ tekst: "", type: "" });
      await api.post("/admin/document-types", { naam: nieuwType.naam.trim(), isVerplicht: nieuwType.isVerplicht });
      setNieuwType({ naam: "", isVerplicht: false });
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Toevoegen mislukt", type: "s_rood" });
    }
  }

  async function voegChecklistItemToe(e) {
    e.preventDefault();
    if (!nieuwItem.trim()) return;
    try {
      setMelding({ tekst: "", type: "" });
      await api.post("/admin/checklist-items", { tekst: nieuwItem.trim(), volgorde: checklistItems.length + 1 });
      setNieuwItem("");
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Toevoegen mislukt", type: "s_rood" });
    }
  }

  async function bewaarChecklistItem() {
    if (!bewerkItem || !bewerkItem.tekst.trim()) return;
    try {
      setMelding({ tekst: "", type: "" });
      await api.patch(`/admin/checklist-items/${bewerkItem.id}`, { tekst: bewerkItem.tekst.trim() });
      setBewerkItem(null);
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s_rood" });
    }
  }

  async function toggleChecklistActief(item) {
    try {
      await api.patch(`/admin/checklist-items/${item.id}`, { actief: !item.actief });
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Wijzigen mislukt", type: "s_rood" });
    }
  }

  async function verwijderChecklistItem(item) {
    if (!window.confirm(`Checklist item "${item.tekst}" verwijderen?`)) return;
    try {
      await api.delete(`/admin/checklist-items/${item.id}`);
      laden();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Verwijderen mislukt", type: "s_rood" });
    }
  }

  return (
    <div className="page_inner">
      <div className="page_header">
        <div className="page_title_wrap">
          <div>
            <h1>Instellingen</h1>
            <p>Stageperiode, minimumvereisten en verplichte documenttypes beheren.</p>
          </div>
        </div>
      </div>

      {melding.tekst && (
        <div style={{ marginBottom: "12px" }}>
          <span className={`status ${melding.type}`}>{melding.tekst}</span>
        </div>
      )}

      {loading && <div className="card"><p className="muted">Laden...</p></div>}

      {!loading && regels.map((regel) => (
        <div className="card" key={regel.id} style={{ marginBottom: "12px" }}>
          <div className="card_title">
            Stageperiode — {regel.opleiding || "opleiding"} {regel.academiejaar || ""}
            {regel.status === "actief" && <span className="status s_ok" style={{ marginLeft: "8px" }}>Actief</span>}
          </div>
          <div className="grid_2" style={{ gap: "12px" }}>
            <label>Start stagevenster
              <input type="date" value={(regel.stagevenster_start || "").slice(0, 10)}
                onChange={(e) => zetRegel(regel.id, "stagevenster_start", e.target.value)} />
            </label>
            <label>Einde stagevenster
              <input type="date" value={(regel.stagevenster_einde || "").slice(0, 10)}
                onChange={(e) => zetRegel(regel.id, "stagevenster_einde", e.target.value)} />
            </label>
            <label>Minimum weken
              <input type="number" min="1" value={regel.minimum_weken ?? ""}
                onChange={(e) => zetRegel(regel.id, "minimum_weken", e.target.value)} />
            </label>
            <label>Minimum uren
              <input type="number" min="1" value={regel.minimum_uren ?? ""}
                onChange={(e) => zetRegel(regel.id, "minimum_uren", e.target.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: "12px" }}>
            <button className="btn primary" onClick={() => bewaarRegel(regel)}>Opslaan</button>
          </div>
        </div>
      ))}

      {!loading && (
        <div className="card">
          <div className="card_title">Verplichte documenttypes</div>
          <table className="tbl">
            <thead>
              <tr><th>Naam</th><th>Type</th><th style={{ textAlign: "center" }}>Verplicht</th><th></th></tr>
            </thead>
            <tbody>
              {docTypes.map((dt) => (
                <tr key={dt.id}>
                  <td>{dt.naam}</td>
                  <td>{dt.type || "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!dt.is_verplicht} onChange={() => toggleVerplicht(dt)} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {dt.is_vast ? (
                      <span className="status s_grijs">Vast</span>
                    ) : (
                      <button className="btn sm" onClick={() => verwijderType(dt)}>Verwijderen</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form onSubmit={voegTypeToe} className="actions" style={{ marginTop: "12px", gap: "8px", alignItems: "center" }}>
            <input type="text" placeholder="Nieuw documenttype" value={nieuwType.naam}
              onChange={(e) => setNieuwType((p) => ({ ...p, naam: e.target.value }))} />
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={nieuwType.isVerplicht}
                onChange={(e) => setNieuwType((p) => ({ ...p, isVerplicht: e.target.checked }))} />
              Verplicht
            </label>
            <button className="btn primary" type="submit">Toevoegen</button>
          </form>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ marginTop: "12px" }}>
          <div className="card_title">Checklist criteria</div>
          <p style={{ fontSize: 13, color: "var(--sub)", margin: "0 0 12px" }}>
            Deze criteria worden getoond aan studenten bij het indienen van een stagevoorstel. Je kan ze bewerken, uit- of inschakelen en verwijderen.
          </p>
          <table className="tbl">
            <thead>
              <tr>
                <th>Criterium</th>
                <th style={{ textAlign: "center", width: 80 }}>Actief</th>
                <th style={{ textAlign: "right", width: 100 }}>Actie</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    {bewerkItem?.id === item.id ? (
                      <input
                        type="text"
                        value={bewerkItem.tekst}
                        onChange={(e) => setBewerkItem({ ...bewerkItem, tekst: e.target.value })}
                        style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontFamily: "var(--font)" }}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: item.actief ? "var(--dark)" : "var(--faint)" }}>{item.tekst}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!item.actief} onChange={() => toggleChecklistActief(item)} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {bewerkItem?.id === item.id ? (
                        <>
                          <button className="btn sm" onClick={bewaarChecklistItem}>
                            <IconCheck size={14} stroke={2} /> Opslaan
                          </button>
                          <button className="btn sm" onClick={() => setBewerkItem(null)}>
                            <IconX size={14} stroke={2} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn sm" onClick={() => setBewerkItem({ id: item.id, tekst: item.tekst })}>
                            <IconPencil size={14} stroke={1.8} /> Bewerken
                          </button>
                          <button className="btn sm" style={{ color: "var(--red)" }} onClick={() => verwijderChecklistItem(item)}>
                            <IconTrash size={14} stroke={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form onSubmit={voegChecklistItemToe} className="actions" style={{ marginTop: "12px", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Nieuw criterium toevoegen..."
              value={nieuwItem}
              onChange={(e) => setNieuwItem(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn primary" type="submit">
              <IconPlus size={14} stroke={2} /> Toevoegen
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
