import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminTimeRange } from '@/shared/types/api';
import { useAdminTraffic } from '../../hooks/useAdmin';
import { ChartCard } from './ChartCard';
import { AdminTooltip } from './AdminTooltip';
import { getChartColors, CHART_MARGIN } from './chartTheme';

function formatDate(dateStr: string, timeRange: AdminTimeRange) {
  const d = new Date(dateStr);
  if (timeRange === '1d') {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface TrafficChartProps {
  timeRange: AdminTimeRange;
  compact?: boolean;
}

export function TrafficChart({ timeRange, compact = false }: TrafficChartProps) {
  const { data, isLoading, isError } = useAdminTraffic(timeRange);
  const colors = useMemo(() => getChartColors(), []);

  const points = data?.points ?? [];

  return (
    <ChartCard
      title="User access over time"
      subtitle="Active users and new signups"
      isLoading={isLoading}
      isError={isError}
      isEmpty={points.length === 0}
      compact={compact}
    >
      <div className={compact ? 'h-44' : 'h-72'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.chart1} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.chart1} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.chart2} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.chart2} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v: string) => formatDate(v, timeRange)}
            />
            <YAxis
              tick={{ fontSize: compact ? 10 : 11, fill: colors.mutedForeground }}
              tickLine={false}
              axisLine={false}
              width={compact ? 28 : 36}
            />
            <Tooltip
              content={(props) => (
                <AdminTooltip
                  {...props}
                  labelFormatter={(v: string) => formatDate(v, timeRange)}
                />
              )}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: compact ? 11 : 12, paddingTop: compact ? 4 : 8 }}
            />
            <Area
              type="monotone"
              dataKey="active_users"
              name="Active users"
              stroke={colors.chart1}
              strokeWidth={2}
              fill="url(#gradActive)"
            />
            <Area
              type="monotone"
              dataKey="new_users"
              name="New users"
              stroke={colors.chart2}
              strokeWidth={2}
              fill="url(#gradNew)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
