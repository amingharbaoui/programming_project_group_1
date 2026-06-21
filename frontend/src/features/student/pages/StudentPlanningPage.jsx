import { useEffect, useState } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { cacheSet } from "../studentCache";

const TYPE_LABEL = {
  bedrijfsbezoek: "Bedrijfsbezoek",
  tussentijdse_bespreking: "Tussentijdse bespreking",
  eindpresentatie: "Eindpresentatie",
};

// Nette labels i.p.v. ruwe databasestatussen (zoals docent-/mentorplanning).
const STATUS_LABEL = {
  voorgesteld: "Wacht op bevestiging",
  bevestigd: "Bevestigd",
  alternatief_gevraagd: "Nieuw moment gevraagd",
  gepland: "Gepland",
  geweest: "Geweest",
  gegeven: "Gegeven",
  geannuleerd: "Geannuleerd",
};

function formatMoment(v) {
  if (!v) return "Nog niet gepland";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("nl-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function StudentPlanningPage() {
  const { user } = useAuth();
  const [momenten, setMomenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function laden() {
    try {
      setLoading(true);
      setError("");
      // Planning wordt door docent/mentor gewijzigd → altijd live ophalen i.p.v. (mogelijk verouderde) cache.
      const data = (await apiRequest("GET", "/planning/my")).data ?? [];
      cacheSet("student_planning", data);
      setMomenten(data);
    } catch (err) {
      setError(err.response?.data?.message || "Planning ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return (
    <div className="page-inner">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Planning</h1>
        <button className="btn sm" onClick={laden} disabled={loading}>Vernieuwen</button>
      </div>

      {loading && <div className="card"><p>Laden…</p></div>}
      {!loading && error && <div className="card"><p className="status s_rood">{error}</p></div>}
      {!loading && !error && momenten.length === 0 && (
        <div className="card">
          <p>Er zijn nog geen geplande momenten. Je docent plant het bedrijfsbezoek en de eindpresentatie in.</p>
        </div>
      )}

      {!loading && !error && momenten.map((m) => (
        <div className="card" key={m.id} style={{ marginBottom: "12px" }}>
          <div className="card_title">{TYPE_LABEL[m.type] || m.type}</div>
          <p><strong>Wanneer:</strong> {formatMoment(m.gepland_op)}</p>
          <p><strong>Waar:</strong> {m.locatie || "—"}</p>
          <p><strong>Status:</strong> {STATUS_LABEL[m.status] || m.status}</p>
          {m.docent_naam && <p><strong>Gepland door:</strong> {m.docent_naam}</p>}
          {m.verslag && <p><strong>Verslag:</strong> {m.verslag}</p>}
        </div>
      ))}
    </div>
  );
}
