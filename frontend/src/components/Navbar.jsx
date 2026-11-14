import Icon from './Icons.jsx'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'activity' },
  { id: 'farmers', label: 'Farmers', icon: 'users' },
  { id: 'hardware', label: 'Hardware', icon: 'device' },
  { id: 'history', label: 'History', icon: 'history' },
]

export default function Navbar({ activeTab, onTabChange, deviceOnline }) {
  return (
    <nav className="navbar aw-navbar sticky-top">
      <div className="container d-flex align-items-center flex-wrap gap-2 py-2">
        <span className="navbar-brand d-flex align-items-center gap-2 mb-0">
          <span className="aw-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C7 7 5 10 5 14a7 7 0 0 0 14 0c0-4-2-7-7-12z"
                fill="#16a34a"
              />
              <path d="M12 6v12" stroke="#0f2a43" strokeWidth="1.4" />
            </svg>
          </span>
          <span className="aw-brand-text">
            AgriWeight <span className="aw-brand-accent">Smart System</span>
          </span>
        </span>

        <div className="ms-auto d-flex align-items-center gap-2 gap-sm-3 aw-nav-actions">
          <div className="aw-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`aw-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon name={tab.icon} size={15} className="aw-tab-icon" />
                {tab.label}
              </button>
            ))}
          </div>
          <span
            className={`badge rounded-pill aw-status-pill ${deviceOnline ? 'bg-success' : 'bg-danger'}`}
            title={deviceOnline ? 'Hardware is communicating' : 'Hardware not communicating'}
          >
            <span className="aw-dot" aria-hidden="true" />
            {deviceOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </nav>
  )
}
