import {
  LineChart,
  Line,
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

export default function AdminDualLineChart({
  data,
  line1Key = 'newVisitors',
  line2Key = 'returningVisitors',
  line1Name = 'New visitors',
  line2Name = 'Returning visitors',
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
      <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
        <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
        <Line
          type="monotone"
          dataKey={line1Key}
          name={line1Name}
          stroke={CHART_COLORS.sky}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.sky }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey={line2Key}
          name={line2Name}
          stroke={CHART_COLORS.indigo}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.indigo }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
