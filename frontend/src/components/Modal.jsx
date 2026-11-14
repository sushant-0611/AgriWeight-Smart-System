import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons.jsx'

export default function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}) {
  const titleId = useId()

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="aw-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`aw-modal aw-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="aw-modal-header">
          <div>
            <h2 id={titleId} className="aw-modal-title">
              {title}
            </h2>
            {description && <p className="aw-modal-description">{description}</p>}
          </div>
          <button
            type="button"
            className="aw-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="aw-modal-body">{children}</div>
        {footer && <div className="aw-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
