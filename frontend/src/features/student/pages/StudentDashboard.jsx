import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom"

export default function StudentDashboard() {
      const navigate = useNavigate();
      const location = useLocation();
      const [ingediend, setIngediend] = useState (location.state?.ingediend || false)
      const [showPopup, setShowPopup] = useState (location.state?.ingediend || false)
      
      function handleBegrepen(){
        setShowPopup(false);

      }
  return( 

  <div className = "page-inner">
    {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <div className="popup-header">
              <div className="card-title">
                <i className="ti ti-send" />
                Stagevoorstel ingediend
              </div>
              <button className="btn" onClick={handleBegrepen}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="popup-body">
              <p>Je stagevoorstel werd ingediend bij de stagecommissie. Je krijgt een melding na de beoordeling.</p>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={handleBegrepen}>
                <i className="ti ti-check" />
                Begrepen
              </button>
            </div>
          </div>
        </div>
      )}
    <div className = "page-header">
      <h1>Mijn stage</h1>
      <p>Academiejaar 2025-2026</p>
    </div>
    
    <div className="card">
      <div className="card-title">
        <i className="ti ti-briefcase"/>
        Stageaanvraag
      </div>
      <p>Je hebt nog geen stage. <span> Alles start met je stagevoorstel: bedrijf, mentor, opdracht en periode. Na indiening bekijkt de stagecommisie je voorstel</span> </p>
      <div className="actions">
        <button className="btn primary" onClick={() => navigate("/student/application")}>
          <i className="ti ti-plus"/>
          Stagevoorstel indienen
        </button>
      </div>
    </div>

 
  </div>
  )
}
