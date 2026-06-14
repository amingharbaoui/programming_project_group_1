import "./NotificationBell.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function NotificationBell() {
  const { user } = useAuth();
  const [meldingen, setMeldingen] = useState([]);
  const [ongelezen, setOngelezen] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // herbruikbare fetch voor de handlers (markeren als gelezen)
  const load = useCallback(async () => {
    try {
      const res = await apiRequest("get", "/notifications");
      if (res?.success && res.data) {
        setMeldingen(res.data.meldingen || []);
        setOngelezen(res.data.ongelezen || 0);
      }
    } catch {
      // stil falen: een bel mag de app niet breken
    }
  }, []);

  // (her)laden wanneer de (demo)gebruiker wisselt
  useEffect(() => {
    async function fetchMeldingen() {
      try {
        const res = await apiRequest("get", "/notifications");
        if (res?.success && res.data) {
          setMeldingen(res.data.meldingen || []);
          setOngelezen(res.data.ongelezen || 0);
        }
      } catch {
        // stil
      }
    }
    fetchMeldingen();
  }, [user?.id]);

  // sluiten bij klik buiten het paneel
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function markEen(id) {
    try {
      await apiRequest("post", `/notifications/${id}/read`);
      load();
    } catch {
      /* stil */
    }
  }

  async function markAlles() {
    try {
      await apiRequest("post", "/notifications/read-all");
      load();
    } catch {
      /* stil */
    }
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="icon-btn notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meldingen"
      >
        <i className="ti ti-bell"></i>
        {ongelezen > 0 && <span className="notif-badge">{ongelezen > 9 ? "9+" : ongelezen}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span>Meldingen</span>
            {ongelezen > 0 && (
              <button className="notif-mark" onClick={markAlles}>
                Alles gelezen
              </button>
            )}
          </div>

          {meldingen.length === 0 ? (
            <div className="notif-empty">Geen meldingen</div>
          ) : (
            <ul className="notif-list">
              {meldingen.map((m) => (
                <li
                  key={m.id}
                  className={m.status === "gelezen" ? "notif-item read" : "notif-item unread"}
                  onClick={() => m.status !== "gelezen" && markEen(m.id)}
                >
                  <div className="notif-titel">{m.titel}</div>
                  <div className="notif-bericht">{m.bericht}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
