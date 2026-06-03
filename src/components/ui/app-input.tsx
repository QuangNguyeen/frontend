import * as React from 'react';
import { cn } from '@/lib/utils';

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

const AppInput = React.forwardRef<HTMLInputElement, AppInputProps>(
  ({ icon, className, wrapperClassName, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-4">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-input bg-card text-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring/25',
          icon ? 'pl-10 pr-4' : 'px-4',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
AppInput.displayName = 'AppInput';

export { AppInput };
export type { AppInputProps };
