import { useEffect, useState } from "react";
import "./DossiersPage.css";
import "../../../index.css";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function DossiersPage() {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDossiers() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/admin/dossiers");
        setDossiers(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Dossiers ophalen mislukt");
      } finally {
        setLoading(false);
      }
    }

    loadDossiers();
  }, [user.id]);

  function formatDossier(dossier) {
    const student = `${dossier.student_voornaam || ""} ${dossier.student_achternaam || ""}`.trim();
    const docent = `${dossier.docent_voornaam || ""} ${dossier.docent_achternaam || ""}`.trim();
    const documenten = `${dossier.documenten_in_orde || 0}/${dossier.verplichte_documenten || 0} in orde`;

    return {
      id: dossier.id,
      initials: student
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "ST",
      student: student || "Onbekende student",
      opleiding: dossier.opleiding || dossier.academiejaar || "-",
      bedrijf: dossier.bedrijf_naam || "-",
      begeleider: docent || "Nog niet gekoppeld",
      begeleiderStatus: dossier.mentor_voornaam ? "Mentor gekoppeld" : "Mentor ontbreekt",
      dossiernr: dossier.dossiernummer,
      overeenkomst: dossier.overeenkomst_status || "Nog niet gestart",
      documenten,
      status: dossier.status,
      actie: "Controleren"
    };
  }

  return (
      <div className="page">
        <div className="page_header">
          <h1>Dossiers</h1>
          <p>
            Controleer en registreer de stageovereenkomst van de student.
          </p>
        </div>

        <div className="card dossiers_card">
          <table className="tbl dossiers_tbl">
            <thead>
            <tr>
              <th>Student</th>
              <th>Stagebedrijf</th>
              <th>Stagebegeleider</th>
              <th>Stagedossier</th>
              <th>Stageovereenkomst</th>
              <th>Documenten</th>
              <th>Status</th>
              <th className="right">Actie</th>
            </tr>
            </thead>

            <tbody>
            {loading && (
                <tr>
                  <td colSpan="8">Dossiers laden...</td>
                </tr>
            )}

            {!loading && error && (
                <tr>
                  <td colSpan="8">{error}</td>
                </tr>
            )}

            {!loading && !error && dossiers.length === 0 && (
                <tr>
                  <td colSpan="8">Geen dossiers gevonden.</td>
                </tr>
            )}

            {!loading && !error && dossiers.map((rawDossier) => {
              const dossier = formatDossier(rawDossier);

              return (
                <tr key={dossier.id}>
                  <td>
                    <div className="student_cell">
                      <div className="student_avatar">{dossier.initials}</div>
                      <div className="student_info">
                        <div className="student_name">{dossier.student}</div>
                        <div className="student_meta">{dossier.opleiding}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="cell_main">{dossier.bedrijf}</div>
                  </td>

                  <td>
                    <div className="cell_main">{dossier.begeleider}</div>
                    <div className="cell_sub">{dossier.begeleiderStatus}</div>
                  </td>

                  <td>
                    <div className="cell_dossier">{dossier.dossiernr}</div>
                  </td>

                  <td>
                    <div className="cell_main">{dossier.overeenkomst}</div>
                  </td>

                  <td>
                    <div className="cell_main">{dossier.documenten}</div>
                  </td>

                  <td>
                  <span className="status s_amber">
                    {dossier.status}
                  </span>
                  </td>

                  <td className="right">
                    <button className="btn primary dossiers_action_btn">
                      {dossier.actie}
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
  );
}
