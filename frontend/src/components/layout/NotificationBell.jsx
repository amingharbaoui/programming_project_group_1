import "./NotificationBell.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// Ernst-veld → icoonkleur + tabler-icoon
function ernstConfig(ernst, type) {
  if (ernst === "urgent" || ernst === "error") {
    return { colorCls: "ni-red", icon: "ti-alert-circle" };
  }
  if (ernst === "warning") {
    return { colorCls: "ni-amber", icon: "ti-alert-triangle" };
  }
  if (ernst === "success") {
    return { colorCls: "ni-green", icon: "ti-circle-check" };
  }
  // type-specifieke iconen (info/gray)
  if (type === "document") return { colorCls: "ni-gray", icon: "ti-file" };
  if (type === "contract") return { colorCls: "ni-gray", icon: "ti-writing" };
  if (type === "logboek")  return { colorCls: "ni-gray", icon: "ti-book" };
  return { colorCls: "ni-gray", icon: "ti-bell" };
}

// Relatieve tijdstring voor timestamp
function formatTS(d) {
  if (!d) return "";
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60)    return "zojuist";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [meldingen, setMeldingen] = useState([]);
  const [ongelezen, setOngelezen] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("get", "/notifications");
      if (res?.success && res.data) {
        setMeldingen(res.data.meldingen || []);
        setOngelezen(res.data.ongelezen || 0);
      }
    } catch {
      // stil falen: bel mag de app niet breken
    }
  }, []);

  // (her)laden wanneer de (demo)gebruiker wisselt
  useEffect(() => { load(); }, [user?.id]);

  // paneel sluiten bij klik buiten
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function deleteEen(id) {
    // optimistisch: verwijder meteen uit de lijst
    setMeldingen(prev => prev.filter(m => m.id !== id));
    setOngelezen(prev => {
      const m = meldingen.find(m => m.id === id);
      return m && m.status !== "gelezen" ? Math.max(0, prev - 1) : prev;
    });
    try {
      await apiRequest("delete", `/notifications/${id}`);
    } catch { load(); /* herstel bij fout */ }
  }

  async function markAlles() {
    // optimistisch: markeer alles als gelezen meteen
    setMeldingen(prev => prev.map(m => ({ ...m, status: "gelezen" })));
    setOngelezen(0);
    try {
      await apiRequest("post", "/notifications/read-all");
    } catch { load(); /* herstel bij fout */ }
  }

  return (
    <div className="notif-wrap" ref={ref}>
      {/* Belknop */}
      <button
        className="icon-btn notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Meldingen"
      >
        <i className="ti ti-bell"></i>
        {ongelezen > 0 && (
          <span className="notif-badge">{ongelezen > 9 ? "9+" : ongelezen}</span>
        )}
      </button>

      {/* Paneel */}
      {open && (
        <div className="notif-panel">
          <div className="np-head">
            <span>Meldingen</span>
            {ongelezen > 0 && (
              <button className="notif-mark-all" onClick={markAlles}>
                Alles gelezen
              </button>
            )}
          </div>

          <div className="np-body">
            {meldingen.length === 0 ? (
              <div className="notif-empty">Geen meldingen</div>
            ) : (
              meldingen.map((m) => {
                const { colorCls, icon } = ernstConfig(m.ernst, m.type);
                const gelezen = m.status === "gelezen";
                return (
                  <div
                    key={m.id}
                    className={`notif-item${!gelezen ? " sel" : ""}`}
                  >
                    <div className={`notif-icon ${colorCls}`}>
                      <i className={`ti ${icon}`}></i>
                    </div>
                    <div className="notif-body">
                      <div className="nt">
                        <strong>{m.titel}</strong>
                        {m.bericht && <> — {m.bericht}</>}
                      </div>
                      <div className="ts">{formatTS(m.aangemaakt_op)}</div>
                    </div>
                    <button
                      className="notif-x"
                      onClick={(e) => { e.stopPropagation(); deleteEen(m.id); }}
                      title="Verwijderen"
                    >
                      <i className="ti ti-x"></i>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
