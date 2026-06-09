import { useState } from "react";

export default function ApplicationsPage() {
  const [applications] = useState([
    {
      id: 1,
      student: "Nathan",
      company: "Microsoft",
      period: "01/09/2026 - 31/01/2027",
      status: "Pending",
      description: "Ontwikkeling van Stageify",
    },
  ]);

  return (
    <div>
      <h1>Stageaanvragen</h1>

      {applications.map((app) => (
        <div key={app.id}>
          <h3>{app.student}</h3>
          <p>{app.company}</p>
          <p>{app.period}</p>
          <p>Status: {app.status}</p>
          <p>{app.description}</p>

          <button>Goedkeuren</button>
          <button>Afkeuren</button>
          <button>Aanpassing vragen</button>
        </div>
      ))}
    </div>
  );
}