import { Link } from 'react-router-dom';
import AdminGate from '../components/AdminGate';

const SECTIONS = [
  {
    href: '/admin/storms',
    title: 'Storms',
    icon: '🌀',
    description: 'Manage storm event pages. Generates JSON committed to src/content/storms/.'
  },
  {
    href: '/admin/blog',
    title: 'Blog',
    icon: '📰',
    description: 'Write and edit blog posts. Generates markdown committed to src/content/blog/.'
  }
];

function AdminHomeInner() {
  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-400 hover:text-white">← Site</Link>
            <h1 className="text-lg font-bold text-white">Admin</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">What do you want to manage?</h2>
          <p className="text-slate-400">Pick a section. All admin surfaces use the same login.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {SECTIONS.map(section => (
            <Link
              key={section.href}
              to={section.href}
              className="block p-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-sky-500/50 hover:bg-slate-800/80 transition-colors group"
            >
              <div className="text-4xl mb-3">{section.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">
                {section.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{section.description}</p>
              <div className="mt-4 text-sm text-sky-400 font-medium">
                Manage {section.title.toLowerCase()} →
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function AdminHome() {
  return (
    <AdminGate>
      <AdminHomeInner />
    </AdminGate>
  );
}
