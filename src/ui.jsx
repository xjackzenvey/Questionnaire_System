import { X, LoaderCircle } from "lucide-react";
export function Button({
  children,
  icon: Icon,
  variant = "",
  busy = false,
  ...props
}) {
  return (
    <button
      className={`button ${variant}`}
      disabled={busy || props.disabled}
      {...props}
    >
      {busy ? (
        <LoaderCircle size={16} className="spin" />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
    </button>
  );
}
export function Modal({ title, children, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
