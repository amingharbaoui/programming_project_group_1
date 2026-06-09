import { useState, useEffect } from "react";
import axios from "axios";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState([]);

  const handleApprove = (id) => {
    axios.patch(
      `http://localhost:5000/api/committee/applications/${id}/decision`,
      {
        decision: "approved",
      }
    )
    .then(() => {
      alert("Goedgekeurd");
    })
    .catch(console.error);
  };

  const handleReject = (id) => {
    axios.patch(
      `http://localhost:5000/api/committee/applications/${id}/decision`,
      {
        decision: "rejected",
      }
    )
    .then(() => {
      alert("Afgekeurd");
    })
    .catch(console.error);
  };

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/committee/applications")
      .then((response) => {
        console.log(response.data);
        setApplications(response.data.data);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

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

          <button onClick={() => handleApprove(app.id)}>
            Goedkeuren
          </button>

          <button onClick={() => handleReject(app.id)}>
            Afkeuren
          </button>

          <button>Aanpassing vragen</button>
        </div>
      ))}
    </div>
  );
}