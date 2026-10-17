import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import History from './components/History.jsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [deviceOnline, setDeviceOnline] = useState(false)

  return (
    <div className="app-shell">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        deviceOnline={deviceOnline}
      />
      <main className="app-main">
        {activeTab === 'dashboard' ? (
          <Dashboard onStatusChange={setDeviceOnline} />
        ) : (
          <History />
        )}
      </main>
      <footer className="app-footer text-center small">
        AgriWeight Smart System &middot; ESP32 Live Weighing Monitor
      </footer>
    </div>
  )
}
