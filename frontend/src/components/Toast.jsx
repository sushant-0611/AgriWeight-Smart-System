import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Icon from './Icons.jsx'

const ToastContext = createContext(null)
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const remove = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'success') => {
      nextId += 1
      const id = nextId
      setToasts((prev) => [...prev, { id, message, type }])
      timers.current.set(
        id,
        setTimeout(() => remove(id), 4500)
      )
    },
    [remove]
  )

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer)
      activeTimers.clear()
    }
  }, [])

  const api = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="aw-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`aw-toast aw-toast-${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            <span className="aw-toast-icon" aria-hidden="true">
              <Icon
                name={toast.type === 'error' ? 'alert' : toast.type === 'info' ? 'info' : 'check'}
                size={18}
              />
            </span>
            <span className="aw-toast-message">{toast.message}</span>
            <button
              type="button"
              className="aw-toast-close"
              onClick={() => remove(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
