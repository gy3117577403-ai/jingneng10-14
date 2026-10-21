import { useEffect, type ReactNode } from "react";
import { Button } from "./basic";
import "./ui.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ title, onClose, children, footer, width = 560 }: ModalProps) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Drawer({ title, onClose, children, footer, width = 640 }: DrawerProps) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="overlay drawer-wrap" onClick={onClose}>
      <div className="drawer" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title?: string;
  content: string;
  okText?: string;
  danger?: boolean;
  onOk: () => void;
  onCancel: () => void;
}

export function Confirm({ title = "请确认", content, okText = "确定", danger, onOk, onCancel }: ConfirmProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <Button onClick={onCancel}>取消</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onOk}>{okText}</Button>
        </>
      }
    >
      <p style={{ color: "var(--color-text-2)" }}>{content}</p>
    </Modal>
  );
}

/* —— Toast（极简全局提示） —— */
let toastRoot: HTMLDivElement | null = null;

export function toast(msg: string, icon = "✓") {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";
    document.body.appendChild(toastRoot);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${icon}</span><span></span>`;
  el.lastElementChild!.textContent = msg;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px)";
    setTimeout(() => el.remove(), 320);
  }, 2200);
}
