import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import StripTrailingSlash from './components/StripTrailingSlash.jsx'
import VisitorSessionTracker from './components/VisitorSessionTracker.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'

// Keep homepage eager; lazy-load everything else so admin/recharts and
// secondary pages are not on the critical path for first paint.
const StormEventPage = lazy(() => import('./components/StormEventPage.jsx'))
const RadarPage = lazy(() => import('./components/RadarPage.jsx'))
const AdminStorms = lazy(() => import('./components/AdminStorms.jsx'))
const AdminHome = lazy(() => import('./pages/AdminHome.jsx'))
const AdminWeatherSummary = lazy(() => import('./pages/AdminWeatherSummary.jsx'))
const AdminSeo = lazy(() => import('./pages/AdminSeo.jsx'))
const AdminAnalysis = lazy(() => import('./pages/AdminAnalysis.jsx'))
const PrepPage = lazy(() => import('./pages/PrepPage.jsx'))
const AddToHomePage = lazy(() => import('./pages/AddToHomePage.jsx'))
const ForecastPage = lazy(() => import('./pages/ForecastPage.jsx'))
const LiveAlertsPage = lazy(() => import('./components/LiveAlertsPage.jsx'))
const AlertsRouteDispatch = lazy(() => import('./components/AlertsRouteDispatch.jsx'))
const CountyAlertsPage = lazy(() => import('./components/CountyAlertsPage.jsx'))
const CatalogCityAlertsPage = lazy(() => import('./components/CatalogCityAlertsPage.jsx'))
const AuthCallback = lazy(() => import('./components/auth/AuthCallback.jsx'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'))
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'))
const SevereWeatherHazardPage = lazy(() => import('./pages/SevereWeatherHazardPage.jsx'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="text-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <StripTrailingSlash />
        <VisitorSessionTracker />
        <Suspense fallback={<RouteFallback />}>
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
            <Route path="/severe-weather/:hazardSlug" element={<SevereWeatherHazardPage />} />
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/admin/storms" element={<AdminStorms />} />
            <Route path="/admin/weather-summary" element={<AdminWeatherSummary />} />
            <Route path="/admin/seo" element={<AdminSeo />} />
            <Route path="/admin/analysis" element={<AdminAnalysis />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
