import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import AdminEmptyChart from './AdminEmptyChart';
import { CHART_AXIS, CHART_COLORS, CHART_GRID, CHART_TOOLTIP_STYLE } from './chartTheme';

const BAR_PALETTE = [
  CHART_COLORS.sky,
  CHART_COLORS.indigo,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
];

export default function AdminBarChart({
  data,
  dataKey,
  nameKey,
  emptyMessage = 'No data in this period.',
  maxItems = 15,
  formatLabel,
  formatValue,
}) {
  const rows = (data || []).slice(0, maxItems).map((row) => ({
    ...row,
    displayName: formatLabel ? formatLabel(row) : row[nameKey],
  }));

  if (rows.length === 0) {
    return <AdminEmptyChart message={emptyMessage} />;
  }

  const height = Math.max(140, rows.length * 30 + 48);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          stroke={CHART_AXIS.stroke}
          tick={CHART_AXIS.tick}
          fontSize={CHART_AXIS.fontSize}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="displayName"
          width={120}
          stroke={CHART_AXIS.stroke}
          tick={CHART_AXIS.tick}
          fontSize={CHART_AXIS.fontSize}
        />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          formatter={(value) => [
            formatValue ? formatValue(value) : Number(value).toLocaleString(),
            '',
          ]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={24}>
          {rows.map((_, index) => (
            <Cell key={index} fill={BAR_PALETTE[index % BAR_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
