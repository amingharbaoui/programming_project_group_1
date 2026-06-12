import { useEffect, useState } from "react";
import api from "../../../services/api";

// Demo data — gebruikt wanneer de backend nog geen echte studenten terugstuurt.
const DEMO_STUDENTEN = [
  {
    id: 1,
    voornaam: "Milan",
    achternaam: "Peeters",
    studentennummer: "202301234",
    fase: "Lopend",
    logboek_status: "ingediend",
    eval_status: "open",
    bedrijf: "Cronos Group",
  },
  {
    id: 2,
    voornaam: "Lena",
    achternaam: "Wouters",
    studentennummer: "202301235",
    fase: "Lopend",
    logboek_status: "afgecheckt_door_mentor",
    eval_status: "nog_niet_open",
    bedrijf: "Telenet",
  },
  {
    id: 3,
    voornaam: "Bram",
    achternaam: "Claes",
    studentennummer: "202301236",
    fase: "Niet gestart",
    logboek_status: "geen",
    eval_status: "niet_van_toepassing",
    bedrijf: "Proximus",
  },
];

function getLogboekClass(status) {
  if (status === "ingediend") return "s_info";
  if (status === "afgecheckt_door_mentor") return "s_ok";
  if (status === "goedgekeurd_door_docent") return "s_ok";
  if (status?.includes("teruggestuurd")) return "s_rood";
  if (status === "geen") return "s_grijs";
  return "s_grijs";
}

function getLogboekLabel(status) {
  if (status === "ingediend") return "Ingediend";
  if (status === "afgecheckt_door_mentor") return "Afgetekend";
  if (status === "goedgekeurd_door_docent") return "Goedgekeurd";
  if (status?.includes("teruggestuurd")) return "Teruggestuurd";
  if (status === "geen") return "Geen";
  return status;
}

function getEvalClass(status) {
  if (status === "open") return "s_amber";
  if (status === "geregistreerd") return "s_ok";
  if (status === "vrijgegeven") return "s_ok";
  if (status === "nog_niet_open") return "s_grijs";
  if (status === "niet_van_toepassing") return "s_grijs";
  return "s_grijs";
}

function getEvalLabel(status) {
  if (status === "open") return "Open";
  if (status === "geregistreerd") return "Geregistreerd";
  if (status === "vrijgegeven") return "Vrijgegeven";
  if (status === "nog_niet_open") return "Nog niet open";
  if (status === "niet_van_toepassing") return "N.v.t.";
  return status;
}

export default function MentorStudentsPage() {
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStudenten() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/mentor/students");
      const data = res.data.data || [];
      // Backend stuurt nog geen echte data terug → demo gebruiken.
      setStudenten(data.length > 0 ? data : DEMO_STUDENTEN);
    } catch {
      // Bij een fout toch demo tonen zodat de pagina bruikbaar blijft.
      setStudenten(DEMO_STUDENTEN);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudenten();
  }, []);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Mijn stagiairs</h1>
          <p>Overzicht van alle studenten die jij begeleidt.</p>
        </div>
        <button className="btn sm" onClick={loadStudenten}>
          Vernieuwen
        </button>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Studenten laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="status s_rood">{error}</span>
        </div>
      )}

      {!loading && studenten.length === 0 && (
        <div className="empty_state">Geen stagiairs gevonden.</div>
      )}

      {!loading && studenten.length > 0 && (
        <div className="card">
          <div className="card_title">Stagiairs ({studenten.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Fase</th>
                <th>Logboek</th>
                <th>Evaluatie</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {studenten.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>
                      {s.voornaam} {s.achternaam}
                    </strong>
                    <br />
                    <span className="muted">{s.studentennummer}</span>
                  </td>

                  <td>{s.bedrijf || "-"}</td>

                  <td>
                    <span
                      className={`status ${
                        s.fase === "Lopend" ? "s_ok" : "s_grijs"
                      }`}
                    >
                      {s.fase}
                    </span>
                  </td>

                  <td>
                    <span className={`status ${getLogboekClass(s.logboek_status)}`}>
                      {getLogboekLabel(s.logboek_status)}
                    </span>
                  </td>

                  <td>
                    <span className={`status ${getEvalClass(s.eval_status)}`}>
                      {getEvalLabel(s.eval_status)}
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
