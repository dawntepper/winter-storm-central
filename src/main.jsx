import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StormEventPage from './components/StormEventPage.jsx'
import RadarPage from './components/RadarPage.jsx'
import AdminStorms from './components/AdminStorms.jsx'
import AdminHome from './pages/AdminHome.jsx'
import AdminWeatherSummary from './pages/AdminWeatherSummary.jsx'
import AdminSeo from './pages/AdminSeo.jsx'
import AdminAnalysis from './pages/AdminAnalysis.jsx'
import PrepPage from './pages/PrepPage.jsx'
import AddToHomePage from './pages/AddToHomePage.jsx'
import ForecastPage from './pages/ForecastPage.jsx'
import LiveAlertsPage from './components/LiveAlertsPage.jsx'
import AlertsRouteDispatch from './components/AlertsRouteDispatch.jsx'
import CountyAlertsPage from './components/CountyAlertsPage.jsx'
import CatalogCityAlertsPage from './components/CatalogCityAlertsPage.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import StripTrailingSlash from './components/StripTrailingSlash.jsx'
import VisitorSessionTracker from './components/VisitorSessionTracker.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import AuthCallback from './components/auth/AuthCallback.jsx'
import SignInPage from './pages/SignInPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <StripTrailingSlash />
        <VisitorSessionTracker />
        <Routes>
          <Route path="/" element={<App />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/storm/preview/:slug" element={<StormEventPage />} />
        <Route path="/storm/:slug" element={<StormEventPage />} />
        <Route path="/alerts" element={<LiveAlertsPage />} />
        <Route path="/alerts/county/:countySlug" element={<CountyAlertsPage />} />
        <Route path="/alerts/city/:citySlug" element={<CatalogCityAlertsPage />} />
        <Route path="/alerts/:slug" element={<AlertsRouteDispatch />} />
        <Route path="/prep" element={<PrepPage />} />
        <Route path="/add-to-home" element={<AddToHomePage />} />
        <Route path="/hurricane-prep" element={<Navigate to="/prep" replace />} />
        <Route path="/storm-prep" element={<Navigate to="/prep" replace />} />
        <Route path="/forecast/:slug" element={<ForecastPage />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/storms" element={<AdminStorms />} />
        <Route path="/admin/weather-summary" element={<AdminWeatherSummary />} />
        <Route path="/admin/seo" element={<AdminSeo />} />
        <Route path="/admin/analysis" element={<AdminAnalysis />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/account" element={<SignInPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
