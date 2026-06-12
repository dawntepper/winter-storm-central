export default function AdminEmptyChart({ message = 'No data in this period.' }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-500 border border-dashed border-slate-700 rounded-lg bg-slate-900/40">
      {message}
    </div>
  );
}
