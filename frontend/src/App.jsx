import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Farmers from './components/Farmers.jsx'
import Hardware from './components/Hardware.jsx'
import History from './components/History.jsx'
import { ToastProvider } from './components/Toast.jsx'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [deviceOnline, setDeviceOnline] = useState(false)

  return (
    <ToastProvider>
      <div className="app-shell">
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          deviceOnline={deviceOnline}
        />
        <main className="app-main">
          {activeTab === 'dashboard' && (
            <Dashboard onStatusChange={setDeviceOnline} onNavigate={setActiveTab} />
          )}
          {activeTab === 'farmers' && <Farmers />}
          {activeTab === 'hardware' && <Hardware onNavigate={setActiveTab} />}
          {activeTab === 'history' && <History />}
        </main>
        <footer className="app-footer text-center small">
          AgriWeight Smart System &middot; ESP32 Live Weighing Monitor
        </footer>
      </div>
    </ToastProvider>
  )
}
