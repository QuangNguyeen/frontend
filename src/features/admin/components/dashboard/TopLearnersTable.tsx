import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BarChart3, ExternalLink, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { AdminTimeRange, AdminTopLearner } from '@/shared/types/api';
import { useAdminTopLearners } from '../../hooks/useAdmin';

type SortKey = 'study_minutes' | 'sessions' | 'avg_accuracy' | 'streak';

function formatStudyTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

interface TopLearnersTableProps {
  timeRange: AdminTimeRange;
  compact?: boolean;
  limit?: number;
  viewAllHref?: string;
}

export function TopLearnersTable({
  timeRange,
  compact = false,
  limit,
  viewAllHref,
}: TopLearnersTableProps) {
  const { data, isLoading, isError } = useAdminTopLearners(timeRange);
  const [sortKey, setSortKey] = useState<SortKey>('study_minutes');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...(data?.learners ?? [])].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });
  const visibleRows = limit ? sorted.slice(0, limit) : sorted;

  if (isError) {
    return (
      <Card className={compact ? 'p-4' : 'p-5'}>
        <h3 className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>Top learners by study time</h3>
        <div className={`${compact ? 'h-40' : 'mt-4 h-60'} flex flex-col items-center justify-center gap-2 text-center text-muted-foreground`}>
          <BarChart3 className="size-8 opacity-40" />
          <p className="text-sm font-medium">Unable to load learner analytics</p>
          <p className="max-w-xs text-xs">
            Check the admin analytics API or try refreshing this time range.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className={`flex items-center justify-between border-b border-border ${compact ? 'px-4 py-2.5' : 'px-5 py-3'}`}>
        <h3 className={compact ? 'text-sm font-bold' : 'text-base font-bold'}>Top learners by study time</h3>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link to={viewAllHref} className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          )}
          {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {isLoading ? (
        <div className={`flex ${compact ? 'h-40' : 'h-60'} items-center justify-center text-muted-foreground`}>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : visibleRows.length === 0 ? (
        <div className={`flex ${compact ? 'h-40' : 'h-60'} items-center justify-center text-sm text-muted-foreground`}>
          No learner data for this period.
        </div>
      ) : (
        <div className={`${compact ? 'max-h-[292px]' : ''} overflow-auto`}>
          <table className={`${compact ? 'min-w-[620px]' : 'min-w-[680px]'} w-full text-left text-sm`}>
            <thead className="border-b border-border bg-muted/45 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className={compact ? 'px-4 py-2 font-bold' : 'px-5 py-2.5 font-bold'}>#</th>
                <th className={compact ? 'px-3 py-2 font-bold' : 'px-3 py-2.5 font-bold'}>Learner</th>
                <SortableHeader label="Study time" sortKey="study_minutes" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Sessions" sortKey="sessions" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Accuracy" sortKey="avg_accuracy" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortableHeader label="Streak" sortKey="streak" currentKey={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="px-3 py-2.5 font-bold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((learner: AdminTopLearner, i: number) => (
                <tr key={learner.user_id} className="align-middle">
                  <td className={compact ? 'px-4 py-2 font-semibold text-muted-foreground' : 'px-5 py-2.5 font-semibold text-muted-foreground'}>{i + 1}</td>
                  <td className={compact ? 'px-3 py-2' : 'px-3 py-2.5'}>
                    <div className="flex items-center gap-2.5">
                      <span className={`${compact ? 'size-7' : 'size-8'} inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary`}>
                        {learner.display_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{learner.display_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{learner.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={compact ? 'px-3 py-2 font-semibold tabular-nums' : 'px-3 py-2.5 font-semibold tabular-nums'}>
                    {formatStudyTime(learner.study_minutes)}
                  </td>
                  <td className={compact ? 'px-3 py-2 font-semibold tabular-nums' : 'px-3 py-2.5 font-semibold tabular-nums'}>{learner.sessions}</td>
                  <td className={compact ? 'px-3 py-2 font-semibold tabular-nums' : 'px-3 py-2.5 font-semibold tabular-nums'}>{learner.avg_accuracy}%</td>
                  <td className={compact ? 'px-3 py-2 font-semibold tabular-nums' : 'px-3 py-2.5 font-semibold tabular-nums'}>{learner.streak}</td>
                  <td className={compact ? 'px-3 py-2' : 'px-3 py-2.5'}>
                    <Link
                      to={`/admin/users/${learner.user_id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      View <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentKey,
  asc,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th className="px-3 py-2.5 font-bold">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={`size-3 ${isActive ? 'text-primary' : 'opacity-40'}`}
          style={isActive && asc ? { transform: 'scaleY(-1)' } : undefined}
        />
      </button>
    </th>
  );
}
