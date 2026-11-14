import Modal from './Modal.jsx'

export default function ConfirmDialog({
  title,
  message,
  note,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-success'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && (
              <span
                className="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              />
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
      {note && <div className="aw-callout aw-callout-warning mt-3">{note}</div>}
    </Modal>
  )
}
