import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AdminEmptyChart from './AdminEmptyChart';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from './chartTheme';

const PIE_COLORS = [
  CHART_COLORS.emerald,
  CHART_COLORS.rose,
  CHART_COLORS.sky,
  CHART_COLORS.indigo,
  CHART_COLORS.amber,
  CHART_COLORS.slate,
];

export default function AdminSplitChart({
  segments,
  emptyMessage = 'No data in this period.',
  height = 220,
}) {
  const rows = (segments || []).filter((s) => s.value > 0);

  if (rows.length === 0) {
    return <AdminEmptyChart message={emptyMessage} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={72}
          paddingAngle={2}
        >
          {rows.map((_, index) => (
            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [Number(value).toLocaleString(), '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          formatter={(value, entry) =>
            `${value}: ${Number(entry.payload.value).toLocaleString()}`
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
