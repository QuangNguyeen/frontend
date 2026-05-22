import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-6 text-center', className)}>
      <div className="rounded-full bg-muted p-2.5 mb-2.5">
        {icon ?? <Inbox className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium text-foreground mb-0.5">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs mb-3">{description}</p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick} className="gap-1.5">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
