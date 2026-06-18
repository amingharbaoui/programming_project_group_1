import { useEffect, useState } from "react";
import "../../../index.css";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [regels, setRegels] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [melding, setMelding] = useState({ tekst: "", type: "" });
  const [nieuwType, setNieuwType] = useState({ naam: "", isVerplicht: false });

  async function laden() {
    try {
      setLoading(true);
      const res = await api.get("/admin/settings");
      setRegels(res.data.data?.stageRegels || []);
      setDocTypes(res.data.data?.documentSoorten || []);
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
    </div>
  );
}
