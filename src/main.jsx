import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StormEventPage from './components/StormEventPage.jsx'
import AdminStorms from './components/AdminStorms.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/storm/:slug" element={<StormEventPage />} />
        <Route path="/admin/storms" element={<AdminStorms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
