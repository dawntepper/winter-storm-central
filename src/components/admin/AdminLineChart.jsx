import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
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

export default function AdminLineChart({
  data,
  dataKey,
  name = 'Value',
  emptyMessage = 'No data in this period.',
  valueSuffix = '',
  formatValue,
}) {
  if (!data?.length) {
    return <AdminEmptyChart message={emptyMessage} />;
  }

  const rows = data.map((row) => ({
    ...row,
    label: formatDayLabel(row.day),
  }));

  const formatter = formatValue
    ? (value) => [formatValue(value), name]
    : (value) => [`${value}${valueSuffix}`, name];

  return (
    <ResponsiveContainer width="100%" height={240}>
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
          domain={[0, 100]}
        />
        <Tooltip {...CHART_TOOLTIP_STYLE} formatter={formatter} />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={CHART_COLORS.emerald}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.emerald }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
