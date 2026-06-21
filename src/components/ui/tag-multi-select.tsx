import { useCallback, useMemo, useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Check, ChevronDown, ListChecks, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagOption {
  id: string;
  name: string;
}

interface TagMultiSelectProps {
  options: TagOption[];
  /** Selected option IDs. */
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
  /** Max chips rendered on the trigger before collapsing into a "+N" badge. */
  maxVisibleChips?: number;
  /** Show a "Select all (filtered)" action in the footer. Useful for filters. */
  allowSelectAll?: boolean;
  /** Compact trigger height (e.g. inside dense filter toolbars). */
  size?: 'default' | 'sm';
}

/**
 * Searchable multi-select for fixed topic tags. Displays tag names but reports
 * tag IDs through `onChange`. Users can only pick from the supplied (active)
 * options — there is no free-text create path. The popover stays open while
 * toggling so several tags can be chosen in one go.
 */
export function TagMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select topic tags',
  emptyText = 'No tags available',
  disabled,
  loading,
  className,
  id,
  maxVisibleChips = 4,
  allowSelectAll = false,
  size = 'default',
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wheelCleanup = useRef<(() => void) | null>(null);

  // The dropdown is portaled out of the DOM tree; inside a scroll-locked dialog
  // the lock swallows wheel events, and React's onWheel is passive so it can't
  // preventDefault. A callback ref attaches a native non-passive wheel listener
  // the moment the list mounts (Radix mounts the popover content lazily).
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    wheelCleanup.current?.();
    wheelCleanup.current = null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollHeight <= el.clientHeight) return;
      el.scrollTop += e.deltaY;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    wheelCleanup.current = () => el.removeEventListener('wheel', onWheel);
  }, []);

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.id)),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (tagId: string) => {
    if (value.includes(tagId)) onChange(value.filter((v) => v !== tagId));
    else onChange([...value, tagId]);
  };

  const clearAll = () => onChange([]);

  const selectAllFiltered = () => {
    const next = new Set(value);
    filtered.forEach((o) => next.add(o.id));
    onChange([...next]);
  };

  const visibleChips = selected.slice(0, maxVisibleChips);
  const overflow = selected.length - visibleChips.length;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled || loading}
          aria-label={placeholder}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-1 text-left font-semibold transition-colors',
            // Match AppSelect: default h-11 / text-[13px], sm h-[34px] / text-xs.
            size === 'sm' ? 'min-h-[34px] text-xs' : 'min-h-11 text-[13px]',
            'hover:border-primary/30 hover:bg-primary-soft focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50',
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">
                {loading ? 'Loading tags…' : placeholder}
              </span>
            ) : (
              <>
                {visibleChips.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-hover"
                  >
                    {tag.name}
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove ${tag.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(tag.id);
                      }}
                      className="rounded-full p-0.5 hover:bg-primary/15"
                    >
                      <X className="size-3" />
                    </span>
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    +{overflow}
                  </span>
                )}
              </>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear all tags"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden rounded-xl border border-border bg-card shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tags…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={setListRef} className="max-h-60 overflow-y-auto overscroll-contain p-1.5 scrollbar-stable">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {options.length === 0 ? emptyText : 'No matching tags'}
              </p>
            ) : (
              filtered.map((tag) => {
                const isSelected = value.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(tag.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors',
                      'hover:bg-primary-soft',
                      isSelected && 'bg-primary-soft/60 text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border',
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{tag.name}</span>
                  </button>
                );
              })
            )}
          </div>

          {(selected.length > 0 || (allowSelectAll && filtered.length > 0)) && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {selected.length} selected
              </span>
              <div className="flex items-center gap-1">
                {allowSelectAll && filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"
                  >
                    <ListChecks className="size-3.5" />
                    Select all
                  </button>
                )}
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
