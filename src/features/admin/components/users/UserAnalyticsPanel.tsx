import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Flame, Target, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { UserStatsBlock } from '@/shared/types/api';

interface UserAnalyticsPanelProps {
  stats: UserStatsBlock;
  totalSessions: number;
}

/** Reads the theme tokens the charts need, so colors follow light/dark mode. */
function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    success: get('--badge-success') || get('--chart-2'),
    warning: get('--badge-warning') || get('--chart-4'),
    danger: get('--badge-danger') || get('--chart-5'),
    primary: get('--primary') || get('--chart-1'),
    muted: get('--muted') || get('--border'),
    mutedForeground: get('--muted-foreground'),
  };
}

function accuracyColor(score: number, c: ReturnType<typeof readThemeColors>) {
  if (score >= 80) return c.success;
  if (score >= 50) return c.warning;
  return c.danger;
}

export function UserAnalyticsPanel({ stats, totalSessions }: UserAnalyticsPanelProps) {
  const colors = useMemo(() => readThemeColors(), []);

  const accuracy = Math.max(0, Math.min(100, Math.round(stats.average_score)));
  const accuracyFill = accuracyColor(accuracy, colors);
  const accuracyData = [{ name: 'accuracy', value: accuracy, fill: accuracyFill }];

  const streakData = [
    { name: 'Current', value: stats.current_streak, fill: colors.primary },
    { name: 'Best', value: stats.longest_streak, fill: colors.success },
  ];
  // Keep a small headroom so the longest-streak bar never touches the edge.
  const streakMax = Math.max(stats.longest_streak, stats.current_streak, 1);

  const attemptsPerSession =
    totalSessions > 0 ? Math.round((stats.total_attempts / totalSessions) * 10) / 10 : 0;

  const insights = [
    {
      icon: Target,
      label: 'Attempts / session',
      value: attemptsPerSession,
      tone: 'text-accent-blue',
    },
    {
      icon: Trophy,
      label: 'Vocabulary saved',
      value: stats.total_vocabulary,
      tone: 'text-primary',
    },
    {
      icon: Flame,
      label: 'Streak best',
      value: `${stats.current_streak}/${stats.longest_streak}`,
      tone: 'text-accent-orange',
    },
  ];

  return (
    <Card className="p-4">
      <h3 className="text-base font-bold">Learning analytics</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        A snapshot built from this user&apos;s lifetime practice stats.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Accuracy gauge */}
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Average accuracy
          </p>
          <div className="relative mt-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={accuracyData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: colors.muted }}
                  dataKey="value"
                  cornerRadius={12}
                  angleAxisId={0}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-extrabold tabular-nums tracking-tight"
                style={{ color: accuracyFill }}
              >
                {accuracy}%
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {stats.total_attempts.toLocaleString()} attempts
              </span>
            </div>
          </div>
        </div>

        {/* Streak comparison */}
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Streak — current vs best
          </p>
          <div className="mt-1 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={streakData}
                margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                barCategoryGap="30%"
              >
                <XAxis type="number" domain={[0, streakMax]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 12, fill: colors.mutedForeground }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                  {streakData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Derived insights */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-border p-3">
              <Icon className={`size-4 shrink-0 ${item.tone}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-lg font-extrabold tabular-nums tracking-tight">
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}