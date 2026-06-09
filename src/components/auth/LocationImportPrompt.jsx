import { useState } from 'react';
import { useSavedLocations } from '../../hooks/useSavedLocations';

/**
 * Device → account migration prompt.
 *
 * Shown once, on the first authenticated load, when localStorage holds saved
 * locations that haven't been imported yet. One-click import; "Not now"
 * dismisses and marks migrated so it won't nag on every visit.
 */
export default function LocationImportPrompt() {
  const { needsMigration, localLocationCount, importLocalLocations, markMigrated } =
    useSavedLocations();
  const [dismissed, setDismissed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(null);

  if (!needsMigration || dismissed) return null;

  const noun = localLocationCount === 1 ? 'location' : 'locations';

  const handleImport = async () => {
    setImporting(true);
    const n = await importLocalLocations();
    setImporting(false);
    setImportedCount(n);
    setTimeout(() => setDismissed(true), 1800);
  };

  const handleNotNow = () => {
    markMigrated();
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-2xl p-6 shadow-2xl">
        {importedCount != null ? (
          <p className="text-sm text-emerald-400">
            ✓ Added {importedCount} {importedCount === 1 ? 'location' : 'locations'} to your
            account.
          </p>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-2">Save your locations to your account?</h2>
            <p className="text-sm text-slate-400 mb-4">
              We found {localLocationCount} saved {noun} on this device. Add{' '}
              {localLocationCount === 1 ? 'it' : 'them'} to your account so they&apos;re
              available on all your devices.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                {importing ? 'Adding…' : 'Add them'}
              </button>
              <button
                onClick={handleNotNow}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium cursor-pointer transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
