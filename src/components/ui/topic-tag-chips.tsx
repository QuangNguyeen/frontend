import { Hash, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicTag } from '@/shared/types/api';

interface TopicTagChipsProps {
  /** Public, admin-approved catalog tags. */
  publicTags?: TopicTag[];
  /** The current user's personal My Practice tags. */
  personalTags?: TopicTag[];
  /** Show small "Public"/"Personal" group labels when both kinds are present. */
  showGroupLabels?: boolean;
  /** When provided, chips become clickable (e.g. to add the tag to a filter). */
  onTagClick?: (tag: TopicTag) => void;
  className?: string;
}

function Chip({
  tag,
  variant,
  onClick,
}: {
  tag: TopicTag;
  variant: 'public' | 'personal';
  onClick?: (tag: TopicTag) => void;
}) {
  const className = cn(
    'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold',
    variant === 'public'
      ? 'border-primary/25 bg-primary-soft text-primary-hover'
      : 'border-accent-yellow/35 bg-accent-yellow/10 text-accent-yellow',
    !tag.is_active && 'opacity-60 line-through',
    onClick && 'cursor-pointer transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
  );
  const content = (
    <>
      {variant === 'public' ? <Hash className="size-3" /> : <Tag className="size-3" />}
      {tag.name}
    </>
  );
  const title = tag.is_active ? tag.name : `${tag.name} (inactive)`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(tag);
        }}
        className={className}
        title={`Filter by ${title}`}
        aria-label={`Filter by ${tag.name}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={className} title={title}>
      {content}
    </span>
  );
}

/**
 * Renders public catalog tags and personal My Practice tags with a clear visual
 * distinction. Public tags use the primary tint with a hash icon; personal tags
 * use the amber tint with a tag icon.
 */
export function TopicTagChips({
  publicTags = [],
  personalTags = [],
  showGroupLabels = false,
  onTagClick,
  className,
}: TopicTagChipsProps) {
  if (publicTags.length === 0 && personalTags.length === 0) return null;
  const bothPresent = publicTags.length > 0 && personalTags.length > 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {publicTags.length > 0 && (
        <>
          {showGroupLabels && bothPresent && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Public
            </span>
          )}
          {publicTags.map((tag) => (
            <Chip key={`public-${tag.id}`} tag={tag} variant="public" onClick={onTagClick} />
          ))}
        </>
      )}
      {personalTags.length > 0 && (
        <>
          {showGroupLabels && bothPresent && (
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Personal
            </span>
          )}
          {personalTags.map((tag) => (
            <Chip key={`personal-${tag.id}`} tag={tag} variant="personal" onClick={onTagClick} />
          ))}
        </>
      )}
    </div>
  );
}
