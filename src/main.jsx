import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StormEventPage from './components/StormEventPage.jsx'
import RadarPage from './components/RadarPage.jsx'
import AdminStorms from './components/AdminStorms.jsx'
import StateAlertsPage from './components/StateAlertsPage.jsx'
import LiveAlertsPage from './components/LiveAlertsPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/storm/:slug" element={<StormEventPage />} />
        <Route path="/alerts" element={<LiveAlertsPage />} />
        <Route path="/alerts/:state" element={<StateAlertsPage />} />
        <Route path="/admin/storms" element={<AdminStorms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
