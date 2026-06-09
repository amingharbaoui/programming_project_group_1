export default function StudentDashboard() {
  return( 

  <div className = "page-inner">
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
        <button className="btn-primary">
          Stagevoorstel indienen
        </button>
      </div>
    </div>

 
  </div>
  )
}
