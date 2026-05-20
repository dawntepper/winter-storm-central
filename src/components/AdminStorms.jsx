/**
 * Admin Storms Page
 * Password-protected page to manage storm events
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllStormEvents } from '../services/stormEventsService';

/**
 * Convert the admin form's internal camelCase state into the snake_case
 * JSON shape that lives in src/content/storms/[slug].json.
 */
function formDataToJSON(formData) {
  return {
    title: formData.title,
    slug: formData.slug,
    type: formData.type,
    type_label: formData.typeLabel,
    status: formData.status,
    start_date: formData.startDate,
    end_date: formData.endDate,
    description: formData.description,
    impacts: (formData.impacts || []).filter(i => i && i.trim()),
    affected_states: formData.affectedStates || [],
    alert_categories: formData.alertCategories || [],
    map_center: {
      latitude: formData.mapCenter?.lat ?? 39.0,
      longitude: formData.mapCenter?.lon ?? -98.0,
      zoom: formData.mapZoom ?? 5
    },
    seo: {
      title: formData.seoTitle || '',
      description: formData.seoDescription || '',
      og_image_url: formData.ogImageUrl || '',
      keywords: (formData.keywords || []).filter(k => k && k.trim()).join(', ')
    },
    peak_alert_count: formData.peakAlertCount ?? null,
    total_alerts_issued: formData.totalAlertsIssued ?? null
  };
}

function downloadStormJSON(formData) {
  const json = formDataToJSON(formData);
  const blob = new Blob([JSON.stringify(json, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${formData.slug || 'storm'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

// US State options for affected states
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Storm type options
const STORM_TYPES = [
  { value: 'winter_storm', label: 'Winter Storm' },
  { value: 'hurricane', label: 'Hurricane' },
  { value: 'severe_weather', label: 'Severe Weather' },
  { value: 'flooding', label: 'Flooding' },
  { value: 'heat_wave', label: 'Heat Wave' },
  { value: 'wildfire', label: 'Wildfire' }
];

// Alert category options
const ALERT_CATEGORIES = [
  { value: 'winter', label: 'Winter' },
  { value: 'severe', label: 'Severe' },
  { value: 'flood', label: 'Flood' },
  { value: 'heat', label: 'Heat' },
  { value: 'fire', label: 'Fire' },
  { value: 'tropical', label: 'Tropical' }
];

// Status options
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-purple-500/20 text-purple-400', isPublic: false },
  { value: 'forecasted', label: 'Forecasted', color: 'bg-amber-500/20 text-amber-400', isPublic: true },
  { value: 'active', label: 'Active', color: 'bg-emerald-500/20 text-emerald-400', isPublic: true },
  { value: 'completed', label: 'Completed', color: 'bg-slate-500/20 text-slate-400', isPublic: true }
];

// Custom marker icon (Leaflet default icons have path issues with bundlers)
const markerIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #0ea5e9;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Map click handler component
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Map picker modal
function MapPicker({ currentLat, currentLon, onSelect, onClose }) {
  const [selectedLat, setSelectedLat] = useState(currentLat || 39.0);
  const [selectedLon, setSelectedLon] = useState(currentLon || -98.0);

  const handleLocationSelect = (lat, lon) => {
    setSelectedLat(Math.round(lat * 1000) / 1000);
    setSelectedLon(Math.round(lon * 1000) / 1000);
  };

  const handleConfirm = () => {
    onSelect(selectedLat, selectedLon);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-700 border-b border-slate-600 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Pick Map Center</h3>
            <p className="text-xs text-slate-400">Click on the map to select coordinates</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div className="h-80">
          <MapContainer
            center={[selectedLat, selectedLon]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            <Marker position={[selectedLat, selectedLon]} icon={markerIcon} />
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-700 border-t border-slate-600 flex items-center justify-between">
          <div className="text-sm text-slate-300">
            <span className="text-slate-500">Lat:</span> {selectedLat.toFixed(3)}
            <span className="text-slate-500 ml-4">Lon:</span> {selectedLon.toFixed(3)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-white rounded-lg cursor-pointer"
            >
              Use This Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Password login component
function PasswordGate({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      onAuthenticate();
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-4">Admin Access</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 mb-3"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Login
          </button>
        </form>
        <Link to="/" className="block text-center mt-4 text-slate-400 text-sm hover:text-white">
          ← Back to site
        </Link>
      </div>
    </div>
  );
}

const LOCALSTORAGE_KEY = 'storm_admin_draft';

// Storm form component
function StormForm({ event, onSave, onCancel }) {
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', message }
  const fileInputRef = useRef(null);

  const defaultFormData = {
    title: '',
    slug: '',
    type: 'winter_storm',
    typeLabel: 'Winter Storm',
    status: 'draft',
    startDate: '',
    endDate: '',
    description: '',
    impacts: [''],
    affectedStates: [],
    alertCategories: ['winter'],
    mapCenter: { lat: 39.0, lon: -98.0 },
    mapZoom: 5,
    keywords: [''],
    seoTitle: '',
    seoDescription: '',
    ogImageUrl: '',
    peakAlertCount: null,
    totalAlertsIssued: null
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Load saved draft from localStorage on mount (only for new storms)
  useEffect(() => {
    if (!event) {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed.data);
          setHasSavedDraft(true);
          setLastSaved(new Date(parsed.timestamp));
        } catch (e) {
          console.error('Failed to parse saved draft:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (event) {
      setFormData({
        ...event,
        impacts: event.impacts?.length ? event.impacts : [''],
        keywords: event.keywords?.length ? event.keywords : [''],
        affectedStates: event.affectedStates || [],
        alertCategories: event.alertCategories || ['winter'],
        mapCenter: event.mapCenter || { lat: 39.0, lon: -98.0 },
        peakAlertCount: event.peakAlertCount || null,
        totalAlertsIssued: event.totalAlertsIssued || null
      });
    }
  }, [event]);

  const saveToBrowser = () => {
    const saveData = {
      data: formData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(saveData));
    setHasSavedDraft(true);
    setLastSaved(new Date());
  };

  const clearSavedDraft = () => {
    localStorage.removeItem(LOCALSTORAGE_KEY);
    setHasSavedDraft(false);
    setLastSaved(null);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (type) => {
    const typeOption = STORM_TYPES.find(t => t.value === type);
    setFormData(prev => ({
      ...prev,
      type,
      typeLabel: typeOption?.label || type
    }));
  };

  const handleArrayChange = (field, index, value) => {
    setFormData(prev => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const toggleState = (state) => {
    setFormData(prev => {
      const states = prev.affectedStates.includes(state)
        ? prev.affectedStates.filter(s => s !== state)
        : [...prev.affectedStates, state];
      return { ...prev, affectedStates: states };
    });
  };

  const toggleCategory = (category) => {
    setFormData(prev => {
      const categories = prev.alertCategories.includes(category)
        ? prev.alertCategories.filter(c => c !== category)
        : [...prev.alertCategories, category];
      return { ...prev, alertCategories: categories };
    });
  };

  const generateSlug = () => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    handleChange('slug', slug);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-imported
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);

        // Validate required fields
        const missing = [];
        if (!json.title) missing.push('title');
        if (!json.type) missing.push('type');
        if (!json.startDate) missing.push('startDate');
        if (!json.endDate) missing.push('endDate');
        if (missing.length > 0) {
          setImportStatus({ type: 'error', message: `Missing required fields: ${missing.join(', ')}` });
          setTimeout(() => setImportStatus(null), 5000);
          return;
        }

        // Resolve typeLabel from type value
        const typeOption = STORM_TYPES.find(t => t.value === json.type);

        // Map JSON → formData, supporting both flat and nested schemas
        const imported = {
          ...defaultFormData,
          title: json.title || '',
          slug: json.slug || '',
          type: json.type || 'winter_storm',
          typeLabel: typeOption?.label || json.typeLabel || json.type,
          status: json.status || 'draft',
          startDate: json.startDate || '',
          endDate: json.endDate || '',
          description: json.description || '',
          impacts: Array.isArray(json.impacts) ? json.impacts : (Array.isArray(json.expectedImpacts) ? json.expectedImpacts : ['']),
          affectedStates: Array.isArray(json.affectedStates) ? json.affectedStates : [],
          alertCategories: Array.isArray(json.alertCategories) ? json.alertCategories : ['winter'],
          mapCenter: {
            lat: json.mapCenter?.lat ?? json.mapCenter?.latitude ?? 39.0,
            lon: json.mapCenter?.lon ?? json.mapCenter?.longitude ?? -98.0,
          },
          mapZoom: json.mapZoom ?? json.mapCenter?.zoom ?? 5,
          seoTitle: json.seoTitle ?? json.seo?.title ?? '',
          seoDescription: json.seoDescription ?? json.seo?.description ?? '',
          ogImageUrl: json.ogImageUrl ?? json.seo?.ogImageUrl ?? '',
          keywords: Array.isArray(json.keywords)
            ? json.keywords
            : (typeof json.seo?.keywords === 'string'
              ? json.seo.keywords.split(',').map(k => k.trim()).filter(Boolean)
              : (Array.isArray(json.seo?.keywords) ? json.seo.keywords : [''])),
          peakAlertCount: json.peakAlertCount ?? null,
          totalAlertsIssued: json.totalAlertsIssued ?? null,
        };

        // Ensure array fields have at least one entry for the form UI
        if (imported.impacts.length === 0) imported.impacts = [''];
        if (imported.keywords.length === 0) imported.keywords = [''];

        setFormData(imported);
        setImportStatus({ type: 'success', message: 'Storm data imported — review and submit' });
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err) {
        setImportStatus({ type: 'error', message: `Invalid JSON file: ${err.message}` });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Clean up empty array items
    const cleanedData = {
      ...formData,
      impacts: formData.impacts.filter(i => i.trim()),
      keywords: formData.keywords.filter(k => k.trim())
    };
    // Clear saved draft on submit (will be cleared after successful save)
    clearSavedDraft();
    onSave(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Import JSON */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportJSON}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-600"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import JSON
        </button>
        {importStatus && (
          <span className={`text-xs ${importStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {importStatus.message}
          </span>
        )}
      </div>

      {/* Title & Slug */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="Nor'easter - January 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Slug *
            <button type="button" onClick={generateSlug} className="ml-2 text-xs text-sky-400 hover:text-sky-300">
              Generate from title
            </button>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            placeholder="noreaster-january-2026"
          />
        </div>
      </div>

      {/* Type & Status */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Type *</label>
          <select
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            {STORM_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Status *</label>
          <select
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Start Date *</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">End Date *</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Description *</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          required
          rows={3}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
          placeholder="Brief description of the storm event..."
        />
      </div>

      {/* Impacts */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {formData.status === 'completed' ? 'Final Summary / Impacts' : 'Expected Impacts'}
        </label>
        <p className="text-xs text-slate-500 mb-2">
          {formData.status === 'completed'
            ? 'Update with actual storm impacts and final totals'
            : 'List expected impacts based on forecast'}
        </p>
        {formData.impacts.map((impact, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              value={impact}
              onChange={(e) => handleArrayChange('impacts', i, e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
              placeholder={formData.status === 'completed'
                ? "Peak snowfall: 24\" in Denver suburbs..."
                : "Heavy snow accumulations of 8-16 inches..."}
            />
            {formData.impacts.length > 1 && (
              <button
                type="button"
                onClick={() => removeArrayItem('impacts', i)}
                className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addArrayItem('impacts')}
          className="text-sm text-sky-400 hover:text-sky-300 cursor-pointer"
        >
          + Add impact
        </button>
      </div>

      {/* Historical Stats - only shown for completed storms */}
      {formData.status === 'completed' && (
        <div className="border border-slate-600 rounded-lg p-4 bg-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>📊</span> Historical Statistics
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Peak Alert Count</label>
              <input
                type="number"
                min="0"
                value={formData.peakAlertCount || ''}
                onChange={(e) => handleChange('peakAlertCount', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
                placeholder="Max alerts at any one time"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Total Alerts Issued</label>
              <input
                type="number"
                min="0"
                value={formData.totalAlertsIssued || ''}
                onChange={(e) => handleChange('totalAlertsIssued', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
                placeholder="Total alerts during event"
              />
            </div>
          </div>
        </div>
      )}

      {/* Affected States */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Affected States</label>
        <div className="flex flex-wrap gap-1">
          {US_STATES.map(state => (
            <button
              key={state}
              type="button"
              onClick={() => toggleState(state)}
              className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                formData.affectedStates.includes(state)
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Categories */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Alert Categories to Show</label>
        <div className="flex flex-wrap gap-2">
          {ALERT_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1 text-sm rounded cursor-pointer transition-colors ${
                formData.alertCategories.includes(cat.value)
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Center */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">Map Center & Zoom</label>
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="text-sm text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Pick on Map
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Latitude</label>
            <input
              type="number"
              step="0.001"
              value={formData.mapCenter.lat}
              onChange={(e) => handleChange('mapCenter', { ...formData.mapCenter, lat: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Longitude</label>
            <input
              type="number"
              step="0.001"
              value={formData.mapCenter.lon}
              onChange={(e) => handleChange('mapCenter', { ...formData.mapCenter, lon: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Zoom (1-15)</label>
            <input
              type="number"
              min="1"
              max="15"
              value={formData.mapZoom}
              onChange={(e) => handleChange('mapZoom', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Map Picker Modal */}
      {showMapPicker && (
        <MapPicker
          currentLat={formData.mapCenter.lat}
          currentLon={formData.mapCenter.lon}
          onSelect={(lat, lon) => handleChange('mapCenter', { lat, lon })}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* SEO */}
      <div className="border-t border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">SEO Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">SEO Title</label>
            <input
              type="text"
              value={formData.seoTitle}
              onChange={(e) => handleChange('seoTitle', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
              placeholder="Nor'easter January 2026 Live Tracker | Real-Time Alerts"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">SEO Description</label>
            <textarea
              value={formData.seoDescription}
              onChange={(e) => handleChange('seoDescription', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
              placeholder="Track the January 2026 nor'easter in real-time..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">OG Image URL</label>
            <input
              type="url"
              value={formData.ogImageUrl}
              onChange={(e) => handleChange('ogImageUrl', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
              placeholder="https://example.com/storm-image.jpg"
            />
            <p className="text-xs text-slate-500 mt-1">Custom Open Graph image URL. Leave empty to auto-generate from radar map.</p>
            {formData.ogImageUrl && (
              <div className="mt-2">
                <img
                  src={formData.ogImageUrl}
                  alt="OG image preview"
                  className="h-32 rounded border border-slate-600 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  onLoad={(e) => { e.target.style.display = 'block'; }}
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={formData.keywords.join(', ')}
              onChange={(e) => handleChange('keywords', e.target.value.split(',').map(k => k.trim()))}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
              placeholder="noreaster, winter storm, northeast snow"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-slate-700 space-y-3">
        {/* Save to browser indicator */}
        {!event && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {hasSavedDraft && lastSaved && (
                <span className="text-emerald-400">
                  ✓ Saved to browser {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasSavedDraft && (
                <button
                  type="button"
                  onClick={clearSavedDraft}
                  className="text-slate-400 hover:text-red-400 cursor-pointer"
                >
                  Clear saved
                </button>
              )}
              <button
                type="button"
                onClick={saveToBrowser}
                className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded cursor-pointer flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save to Browser
              </button>
            </div>
          </div>
        )}

        {/* How to publish */}
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-xs text-sky-100 leading-relaxed">
          <strong className="text-sky-300">How to publish:</strong> Click{' '}
          <span className="font-medium">{event ? 'Update Storm' : 'Create Storm'}</span> to
          download the JSON file. Save it to{' '}
          <code className="px-1 py-0.5 bg-slate-900/60 rounded text-sky-300">src/content/storms/</code>{' '}
          in the repo, commit, and push. Netlify will rebuild and the storm page will be
          live at <code className="px-1 py-0.5 bg-slate-900/60 rounded text-sky-300">/storm/{formData.slug || '[slug]'}</code>.
        </div>

        {/* Main action buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {event ? 'Update Storm (download JSON)' : 'Create Storm (download JSON)'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// Storm list item — static mode: shows storms from src/content/storms/.
// Status/delete are managed by editing or removing the JSON file in the repo.
function StormListItem({ event, onEdit, onRemove }) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === event.status);
  const canRemoveBanner = event.status === 'active' || event.status === 'forecasted';

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">{event.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusOption?.color}`}>
              {statusOption?.label || event.status}
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-2">/{event.slug}</p>
          <p className="text-sm text-slate-300 line-clamp-2">{event.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>{event.startDate} → {event.endDate}</span>
            <span>{event.affectedStates?.length || 0} states</span>
            <span className="text-slate-600">src/content/storms/{event.slug}.json</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(event)}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded cursor-pointer"
          >
            Edit & re-export
          </button>
          <Link
            to={`/storm/${event.slug}`}
            className="px-3 py-1.5 text-xs text-center bg-slate-700 hover:bg-slate-600 text-white rounded"
          >
            View
          </Link>
          {canRemoveBanner && (
            <button
              onClick={() => onRemove(event)}
              title="Mark this storm as completed and remove its banner from the site"
              className="px-3 py-1.5 text-xs bg-red-900/40 hover:bg-red-800/50 text-red-300 rounded cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Site Settings Keys
const SITE_SETTINGS_KEY = 'stormtracking_site_settings';

function getSiteSettings() {
  try {
    const saved = localStorage.getItem(SITE_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { showBetaBadge: true };
  } catch {
    return { showBetaBadge: true };
  }
}

function saveSiteSettings(settings) {
  localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(settings));
  // Dispatch event so Header can react to changes
  window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: settings }));
}

// Site Settings Panel
function SiteSettingsPanel() {
  const [settings, setSettings] = useState(getSiteSettings);

  const handleToggleBeta = () => {
    const newSettings = { ...settings, showBetaBadge: !settings.showBetaBadge };
    setSettings(newSettings);
    saveSiteSettings(newSettings);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span>⚙️</span> Site Settings
      </h3>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-white">Show Beta Badge</span>
          <p className="text-xs text-slate-500">Display the BETA badge and tooltip next to the logo</p>
        </div>
        <button
          onClick={handleToggleBeta}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            settings.showBetaBadge ? 'bg-sky-600' : 'bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.showBetaBadge ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// Main admin component
export default function AdminStorms() {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('admin_authenticated') === 'true'
  );
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [downloadedSlug, setDownloadedSlug] = useState(null);

  useEffect(() => {
    if (authenticated) {
      loadEvents();
    }
  }, [authenticated]);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await getAllStormEvents();
    if (error) {
      setError(error.message || 'Failed to load events');
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const handleSave = (formData) => {
    setError(null);
    try {
      downloadStormJSON(formData);
      setDownloadedSlug(formData.slug);
      setShowForm(false);
      setEditingEvent(null);
    } catch (err) {
      setError(err.message || 'Failed to generate JSON file');
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleRemove = (event) => {
    const confirmed = window.confirm(
      `Remove banner for "${event.title}"?\n\n` +
      `This downloads an updated ${event.slug}.json with status set to "completed". ` +
      `Move it to src/content/storms/, commit, and push — Netlify will rebuild and the banner ` +
      `will disappear from the landing page and affected state pages.`
    );
    if (!confirmed) return;
    setError(null);
    try {
      downloadStormJSON({ ...event, status: 'completed' });
      setDownloadedSlug(event.slug);
    } catch (err) {
      setError(err.message || 'Failed to generate JSON file');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-lg font-bold text-white">Storm Events Admin</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">Dismiss</button>
          </div>
        )}

        {downloadedSlug && (
          <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg text-emerald-200 text-sm flex items-start justify-between gap-3">
            <div>
              <strong className="text-emerald-300">Downloaded {downloadedSlug}.json.</strong>{' '}
              Move it to <code className="px-1 py-0.5 bg-slate-900/60 rounded">src/content/storms/</code>,
              commit, and push. Netlify will rebuild and publish to{' '}
              <code className="px-1 py-0.5 bg-slate-900/60 rounded">/storm/{downloadedSlug}</code>.
            </div>
            <button onClick={() => setDownloadedSlug(null)} className="text-emerald-300 hover:text-white cursor-pointer flex-shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* Site Settings - always visible */}
        <SiteSettingsPanel />

        {showForm ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editingEvent ? 'Edit Storm Event' : 'Create Storm Event'}
            </h2>
            <StormForm
              event={editingEvent}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingEvent(null); }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">All Storm Events</h2>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg cursor-pointer"
              >
                + New Storm
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Storms are stored as JSON files in <code className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">src/content/storms/</code>.
              To <strong>delete</strong> a storm or <strong>change its status</strong>, edit (or remove) the JSON file in the repo and commit.
              Use <em>Edit & re-export</em> below to download an updated version after changes.
            </p>

            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-slate-400 mb-4">No storm events yet</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg cursor-pointer"
                >
                  Create your first storm
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(event => (
                  <StormListItem
                    key={event.id}
                    event={event}
                    onEdit={handleEdit}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
