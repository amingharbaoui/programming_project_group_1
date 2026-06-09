export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">


        {/* Hier moet ik nog de foto toevoegen */}

        <div className="login-subtitle">
          Stage Monitoring Tool · Erasmushogeschool Brussel
        </div>

        <div className="form-group">
          <label className="form-label">
            E-mailadres<span className="req">*</span>
          </label>
          <input
            type="email"
            className="form-input"
            placeholder="voornaam.naam@student.ehb.be"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Wachtwoord<span className="req">*</span>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
          />
        </div>

        <button className="btn primary login-btn">
          <i className="ti ti-login-2" />
          Aanmelden
        </button>

        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">of</span>
          <span className="login-divider-line" />
        </div>

        <button className="login-btn">
          <i className="ti ti-school" />
          Aanmelden met je EhB-account
        </button>

        <div className="login-version">
          Stagify · versie 1.0 (prototype)
        </div>

      </div>
    </div>
  );
}
