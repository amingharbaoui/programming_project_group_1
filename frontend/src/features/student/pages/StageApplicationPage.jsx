export default function StageApplicationPage() {
  return(
    <>
    <div className="page-inner">
      <div className="page-header">
        <h1>Stagevoorstel</h1>
        <p>Vul alles in - je kan tussentijds opslaan als concept</p>
      </div>
      
      <div className="grid-2">
        <div className="card-title">
          <i className="ti ti-building" />
              Bedrijf
        </div>
        <div className="form-row">
          <div className="form-group">
             <label className="form-label">Bedrijfsnaam<span className="req">*</span></label>
            <input className="form-input" type="text" placeholder="Naam van het bedrijf" />
          </div>
          <div className="form-group">
            <label className="form-label">Afdeling</label>
            <input className="form-input" type="text" placeholder="Afdeling of team" />
          </div>
          <div className="form-group">
              <label className="form-label">Adres<span className="req">*</span></label>
              <input className="form-input" type="text" placeholder="Straat nr, postcode gemeente" required />
          </div>
          </div>
      <div className="card">
            <div className="card-title">
              <i className="ti ti-user-check" />
              Mentor
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Naam<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="Naam van je mentor" required />
              </div>
              <div className="form-group">
                <label className="form-label">Functie<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="Functie" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-mail<span className="req">*</span></label>
                <input className="form-input" type="email" required />
              </div>
              <div className="form-group">
                <label className="form-label">Telefoon</label>
                <input className="form-input" type="tel" />
              </div>
            </div>
          </div>

           <div className="card">
            <div className="card-title">
              <i className="ti ti-clipboard-text" />
              Opdracht
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Functie<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="bv. Webdeveloper" required />
              </div>
              <div className="form-group">
                <label className="form-label">Uren per week<span className="req">*</span></label>
                <input className="form-input" type="number" placeholder="38" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Omschrijving van de opdracht<span className="req">*</span></label>
              <textarea className="form-textarea" placeholder="Technologie, taken, team..." required />
            </div>
          </div>
        
      </div>
    </div>
    
    </>
  )

}
