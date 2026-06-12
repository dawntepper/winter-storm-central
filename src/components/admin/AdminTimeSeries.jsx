import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import AdminEmptyChart from './AdminEmptyChart';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE } from './chartTheme';

function formatDayLabel(day) {
  if (!day) return '';
  try {
    const [y, m, d] = String(day).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return day;
  }
}

export default function AdminTimeSeries({
  data,
  emptyMessage = 'No visitor data in this period.',
}) {
  if (!data?.length) {
    return <AdminEmptyChart message={emptyMessage} />;
  }

  const rows = data.map((row) => ({
    ...row,
    label: formatDayLabel(row.day),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid {...CHART_GRID} vertical={false} />
        <XAxis
          dataKey="label"
          stroke={CHART_AXIS.stroke}
          tick={CHART_AXIS.tick}
          fontSize={CHART_AXIS.fontSize}
        />
        <YAxis
          stroke={CHART_AXIS.stroke}
          tick={CHART_AXIS.tick}
          fontSize={CHART_AXIS.fontSize}
          allowDecimals={false}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [Number(value).toLocaleString(), '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
        />
        <Area
          type="monotone"
          dataKey="newVisitors"
          name="New visitors"
          stackId="visitors"
          stroke={CHART_COLORS.sky}
          fill={CHART_COLORS.sky}
          fillOpacity={0.7}
        />
        <Area
          type="monotone"
          dataKey="returningVisitors"
          name="Returning visitors"
          stackId="visitors"
          stroke={CHART_COLORS.indigo}
          fill={CHART_COLORS.indigo}
          fillOpacity={0.7}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
