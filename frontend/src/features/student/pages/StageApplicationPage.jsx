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
      </div>
    </div>
    </>
  )

}
