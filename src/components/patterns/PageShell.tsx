import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export function PageShell({ children, className, wide }: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto px-[var(--page-px)] py-[var(--page-py)]',
        wide ? 'max-w-6xl' : 'max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
