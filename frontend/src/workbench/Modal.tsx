import { useEffect, useRef, type ReactNode } from 'react';
export function WorkbenchModal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current!;
    const focusTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    return () => {
      node.close();
      queueMicrotask(() => {
        if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`wb-modal${wide ? ' wide' : ''}`}
      aria-labelledby="wb-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="wb-modal-head">
        <h2 id="wb-dialog-title">{title}</h2>
        <button className="wb-button quiet" onClick={onClose} aria-label="关闭对话框">
          关闭 ×
        </button>
      </div>
      <div className="wb-modal-body">{children}</div>
    </dialog>
  );
}
