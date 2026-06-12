import "./DossiersPage.css";
import "../../../index.css";

export default function DossiersPage() {
  const dossiers = [
    {
      id: 1,
      initials: "MP",
      student: "Milan Peeters",
      opleiding: "3 Toegepaste Informatica",
      bedrijf: "Nodea Software",
      begeleider: "K. Wouters",
      begeleiderStatus: "Definitief gekoppeld",
      dossiernr: "DOS-2026-014",
      overeenkomst: "Volledig ondertekend",
      documenten: "Te controleren",
      status: "In controle bij administratie",
      actie: "Controleren",
    },
  ];

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
            {dossiers.map((dossier) => (
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
            ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}