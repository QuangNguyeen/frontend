import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminTimeRange } from '@/shared/types/api';
import { useAdminStudyHours } from '../../hooks/useAdmin';
import { ChartCard } from './ChartCard';
import { AdminTooltip } from './AdminTooltip';
import { getChartColors, CHART_MARGIN } from './chartTheme';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function minutesToHours(m: number) {
  return Math.round((m / 60) * 10) / 10;
}

interface StudyHoursChartProps {
  timeRange: AdminTimeRange;
  compact?: boolean;
}

export function StudyHoursChart({ timeRange, compact = false }: StudyHoursChartProps) {
  const { data, isLoading, isError } = useAdminStudyHours(timeRange);
  const colors = useMemo(() => getChartColors(), []);

  const points = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        ...p,
        total_hours: minutesToHours(p.total_minutes),
      })),
    [data],
  );

  return (
    <ChartCard
      title="Study hours"
      subtitle="Total hours and avg minutes per active user"
      isLoading={isLoading}
      isError={isError}
      isEmpty={points.length === 0}
      compact={compact}
    >
      <div className={compact ? 'h-44' : 'h-72'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={CHART_MARGIN}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: compact ? 10 : 11, fill: colors.mutedForeground }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDate}
            />
            <YAxis
              yAxisId="hours"
              tick={{ fontSize: compact ? 10 : 11, fill: colors.mutedForeground }}
              tickLine={false}
              axisLine={false}
              width={compact ? 28 : 36}
            />
            <YAxis
              yAxisId="avg"
              orientation="right"
              tick={{ fontSize: compact ? 10 : 11, fill: colors.mutedForeground }}
              tickLine={false}
              axisLine={false}
              width={compact ? 28 : 36}
            />
            <Tooltip
              content={(props) => (
                <AdminTooltip {...props} labelFormatter={formatDate} />
              )}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: compact ? 11 : 12, paddingTop: compact ? 4 : 8 }}
            />
            <Bar
              yAxisId="hours"
              dataKey="total_hours"
              name="Total hours"
              fill={colors.chart1}
              radius={[4, 4, 0, 0]}
              barSize={compact ? 14 : 20}
              opacity={0.85}
            />
            <Line
              yAxisId="avg"
              type="monotone"
              dataKey="avg_minutes_per_user"
              name="Avg min/user"
              stroke={colors.chart3}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
