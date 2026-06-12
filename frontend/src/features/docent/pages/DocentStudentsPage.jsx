import { useEffect, useState } from "react";
import api from "../../../services/api";

// Demo data — gebruikt wanneer backend nog geen echte data terugstuurt.
const DEMO_STUDENTEN = [
  {
    id: 1,
    voornaam: "Milan",
    achternaam: "Peeters",
    studentennummer: "202301234",
    bedrijf: "Cronos Group",
    mentor: "Jan Vermeersch",
    fase: "Lopend",
    voortgang: 60,
    logboek_status: "ingediend",
  },
  {
    id: 2,
    voornaam: "Lena",
    achternaam: "Wouters",
    studentennummer: "202301235",
    bedrijf: "Telenet",
    mentor: "Sarah De Backer",
    fase: "Lopend",
    voortgang: 35,
    logboek_status: "afgecheckt_door_mentor",
  },
  {
    id: 3,
    voornaam: "Bram",
    achternaam: "Claes",
    studentennummer: "202301236",
    bedrijf: "Proximus",
    mentor: "Tom Leclercq",
    fase: "Niet gestart",
    voortgang: 0,
    logboek_status: "geen",
  },
];

const FILTERS = ["Alle", "Lopend", "Niet gestart", "Afgerond"];

function getStatusClass(fase) {
  if (fase === "Lopend") return "s_ok";
  if (fase === "Afgerond") return "s_info";
  if (fase === "Niet gestart") return "s_grijs";
  return "s_grijs";
}

function getLogboekClass(status) {
  if (status === "ingediend") return "s_info";
  if (status === "afgecheckt_door_mentor") return "s_amber";
  if (status === "goedgekeurd_door_docent") return "s_ok";
  if (status?.includes("teruggestuurd")) return "s_rood";
  return "s_grijs";
}

function getLogboekLabel(status) {
  if (status === "ingediend") return "Ingediend";
  if (status === "afgecheckt_door_mentor") return "Wacht op docent";
  if (status === "goedgekeurd_door_docent") return "Goedgekeurd";
  if (status?.includes("teruggestuurd")) return "Teruggestuurd";
  if (status === "geen") return "Geen";
  return status || "-";
}

function ProgBar({ pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div className="prog_wrap">
        <div className="prog_fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="muted">{pct}%</span>
    </div>
  );
}

export default function DocentStudentsPage() {
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Alle");

  async function loadStudenten() {
    try {
      setLoading(true);
      const res = await api.get("/docent/students");
      const data = res.data.data || [];
      setStudenten(data.length > 0 ? data : DEMO_STUDENTEN);
    } catch {
      setStudenten(DEMO_STUDENTEN);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudenten();
  }, []);

  const gefilterd =
    filter === "Alle"
      ? studenten
      : studenten.filter((s) => s.fase === filter);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Mijn studenten</h1>
          <p>Overzicht van alle studenten die jij opvolgt als docent.</p>
        </div>
        <button className="btn sm" onClick={loadStudenten}>
          Vernieuwen
        </button>
      </div>

      {/* Filter chips */}
      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${filter === f ? " actief" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {!loading && gefilterd.length === 0 && (
        <div className="empty_state">Geen studenten gevonden voor dit filter.</div>
      )}

      {!loading && gefilterd.length > 0 && (
        <div className="card">
          <div className="card_title">Studenten ({gefilterd.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Mentor</th>
                <th>Voortgang</th>
                <th>Logboek</th>
                <th>Fase</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>
                      {s.voornaam} {s.achternaam}
                    </strong>
                    <br />
                    <span className="muted">{s.studentennummer}</span>
                  </td>

                  <td>{s.bedrijf || "-"}</td>

                  <td>{s.mentor || "-"}</td>

                  <td>
                    <ProgBar pct={s.voortgang ?? 0} />
                  </td>

                  <td>
                    <span className={`status ${getLogboekClass(s.logboek_status)}`}>
                      {getLogboekLabel(s.logboek_status)}
                    </span>
                  </td>

                  <td>
                    <span className={`status ${getStatusClass(s.fase)}`}>
                      {s.fase}
                    </span>
                  </td>

                  <td className="right">
                    <div className="actions">
                      <button className="btn sm">Logboek</button>
                      <button className="btn sm">Evaluatie</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
