import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ children, onClose }: ModalProps) {
  useEffect(() => {
    // trava scroll
    document.body.classList.add("modal-open");

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose} // clique fora fecha
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()} // clique dentro não fecha
      >
        {children}
      </div>
    </div>,
    document.getElementById("modal-root")!
  );
}
