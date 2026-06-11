import { useEffect, useState } from "react";
import api from "../../../services/api";
import "../../../index.css";
import "./ApplicationsPage.css";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  async function loadApplications() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/committee/applications");
      setApplications(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Aanvragen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, []);

  async function decideApplication(id, beslissing) {
    const feedback =
      beslissing === "aanpassingen_gevraagd"
        ? window.prompt("Welke aanpassingen zijn nodig?")
        : "";

    if (beslissing === "aanpassingen_gevraagd" && !feedback) {
      return;
    }

    const motivering =
      beslissing === "goedgekeurd"
        ? "Stagevoorstel voldoet aan de criteria."
        : beslissing === "afgekeurd"
          ? "Stagevoorstel voldoet niet aan de criteria."
          : null;

    try {
      setActionLoadingId(id);

      await api.patch(
        `/committee/applications/${id}/decision`,
        {
          beslissing,
          feedback,
          motivering,
        },
        {
          headers: {
            "x-user-id": "2",
          },
        }
      );

      await loadApplications();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Beslissing opslaan mislukt");
    } finally {
      setActionLoadingId(null);
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("nl-BE");
  }

  function getStatusClass(status) {
    if (status === "goedgekeurd") return "s_ok";
    if (status === "afgekeurd") return "s_rood";
    if (status === "aanpassingen_gevraagd") return "s_amber";
    if (status === "ingediend") return "s_info";
    return "s_grijs";
  }

  function canDecide(status) {
    return ["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(status);
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Stageaanvragen</h1>
        <p>Beoordeel ingediende stagevoorstellen van studenten.</p>
      </div>

      {loading && (
        <div className="card">
          <p className="muted">Aanvragen laden...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="status s-rood">{error}</p>
        </div>
      )}

      {!loading && !error && applications.length === 0 && (
        <div className="empty-state">
          Er zijn momenteel geen stageaanvragen.
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="card">
          <div className="toolbar">
            <div className="card-title">Ingediende aanvragen</div>
            <button className="btn sm" onClick={loadApplications}>
              Vernieuwen
            </button>
          </div>

          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Periode</th>
                <th>Status</th>
                <th className="right">Acties</th>
              </tr>
            </thead>

            <tbody>
              {applications.map((app) => {
                const decisionOpen = canDecide(app.status);

                return (
                  <tr key={app.id}>
                    <td>
                      <strong>
                        {app.student_voornaam} {app.student_achternaam}
                      </strong>
                      <br />
                      <span className="muted">{app.studentennummer || "-"}</span>
                    </td>

                    <td>
                      <strong>{app.bedrijf_naam || "-"}</strong>
                      <br />
                      <span className="muted">{app.stagefunctie || "-"}</span>
                    </td>

                    <td>
                      {formatDate(app.startdatum)} - {formatDate(app.einddatum)}
                      <br />
                      <span className="muted">
                        {app.aantal_weken || "?"} weken - {app.totaal_uren || "?"} uur
                      </span>
                    </td>

                    <td>
                      <span className={`status ${getStatusClass(app.status)}`}>
                        {app.status}
                      </span>
                    </td>

                    <td className="right">
                      {decisionOpen ? (
                        <div className="actions">
                          <button
                            className="btn primary sm"
                            disabled={actionLoadingId === app.id}
                            onClick={() => decideApplication(app.id, "goedgekeurd")}
                          >
                            Goedkeuren
                          </button>

                          <button
                            className="btn danger sm"
                            disabled={actionLoadingId === app.id}
                            onClick={() => decideApplication(app.id, "afgekeurd")}
                          >
                            Afkeuren
                          </button>

                          <button
                            className="btn sm"
                            disabled={actionLoadingId === app.id}
                            onClick={() => decideApplication(app.id, "aanpassingen_gevraagd")}
                          >
                            Aanpassing vragen
                          </button>
                        </div>
                      ) : (
                        <span className="muted">Behandeld</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="grid_2">
          {applications.map((app) => (
            <div className="card" key={`detail-${app.id}`}>
              <div className="card-title">
                {app.bedrijf_naam || "Stagevoorstel"}
              </div>

              <div className="kv">
                <span className="k">Student</span>
                <span className="v">
                  {app.student_voornaam} {app.student_achternaam}
                </span>
              </div>

              <div className="kv">
                <span className="k">Mentor</span>
                <span className="v">{app.mentor_naam || "-"}</span>
              </div>

              <div className="kv">
                <span className="k">Mentor e-mail</span>
                <span className="v">{app.mentor_email || "-"}</span>
              </div>

              <div className="kv">
                <span className="k">Uren/week</span>
                <span className="v">{app.uren_per_week || "-"}</span>
              </div>

              <p className="card-subtitle" style={{ marginTop: "10px" }}>
                {app.opdrachtomschrijving || "Geen omschrijving beschikbaar."}
              </p>

              {app.laatste_feedback && (
                <p className="card-subtitle" style={{ marginTop: "10px" }}>
                  <strong>Laatste feedback:</strong> {app.laatste_feedback}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
