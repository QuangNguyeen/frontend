// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AdminTooltip(props: any) {
  const { active, payload, label, labelFormatter } = props as {
    active?: boolean;
    payload?: Array<{
      name?: string | number;
      value?: number;
      color?: string;
    }>;
    label?: string | number;
    labelFormatter?: (v: string) => string;
  };

  if (!active || !payload?.length) return null;

  const formattedLabel = labelFormatter
    ? labelFormatter(String(label))
    : String(label);

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-muted-foreground">
        {formattedLabel}
      </p>
      {payload.map((entry, i) => (
        <div key={String(entry.name ?? i)} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{String(entry.name)}:</span>
          <span className="font-bold tabular-nums">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
