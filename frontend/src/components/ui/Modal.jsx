import "./Modal.css";
import { useEffect } from "react";

/**
 * Herbruikbare modal — overeenkomend met #modalOverlay + .modal uit de HTML-prototype.
 *
 * Props:
 *   open      – boolean, toon/verberg het overlay
 *   onClose   – callback bij kruisje of klik buiten
 *   icon      – tabler-icoon string, bv. "ti-circle-check"
 *   titel     – hoofdtitel in de kop
 *   sub       – ondertitel in de kop (optioneel)
 *   children  – body-inhoud (JSX)
 *   footer    – knoppenrij onderaan (JSX, optioneel)
 */
export default function Modal({ open, onClose, icon, titel, sub, children, footer, wide, noPad, headerAction }) {
  // Sluiten bij Escape-toets
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`modal${wide ? " modal--wide" : ""}`} role="dialog" aria-modal="true">
        {/* Kop */}
        <div className="modal-head">
          {icon && (
            <div className="mh-icon">
              <i className={`ti ${icon}`}></i>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mh-t">{titel}</div>
            {sub && <div className="mh-s">{sub}</div>}
          </div>
          {headerAction && <div className="mh-action">{headerAction}</div>}
          <button
            className="icon-btn mh-x"
            onClick={onClose}
            aria-label="Sluiten"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        {/* Body */}
        {children && <div className={`modal-body${noPad ? " modal-body--no-pad" : ""}`}>{children}</div>}

        {/* Footer met knoppen */}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
