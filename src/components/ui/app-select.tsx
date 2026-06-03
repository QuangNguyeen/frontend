import { Select as SelectPrimitive } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppSelectOption {
  value: string;
  label: string;
}

const EMPTY_OPTION_VALUE = '__app_select_empty__';

interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  triggerClassName?: string;
}

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = 'default',
  className,
  triggerClassName,
}: AppSelectProps) {
  const selectValue = value === '' ? EMPTY_OPTION_VALUE : value;
  const handleValueChange = (nextValue: string) => {
    onValueChange(nextValue === EMPTY_OPTION_VALUE ? '' : nextValue);
  };

  return (
    <SelectPrimitive.Root value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold text-foreground whitespace-nowrap transition-colors select-none',
          'hover:bg-primary-soft hover:border-primary/30',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-placeholder:text-muted-foreground',
          'dark:bg-input/30 dark:hover:bg-input/50',
          size === 'default' ? 'h-11' : 'h-[34px] text-xs',
          triggerClassName,
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'relative z-50 min-w-[var(--radix-select-trigger-width)] max-h-[280px] origin-[var(--radix-select-content-transform-origin)]',
            'overflow-hidden rounded-xl border border-border bg-card shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-150 ease-out',
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
            <ChevronDownIcon className="size-3.5 rotate-180 text-muted-foreground" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1.5">
            {options.map((option, index) => (
              <SelectPrimitive.Item
                key={`${option.value || EMPTY_OPTION_VALUE}-${index}`}
                value={option.value === '' ? EMPTY_OPTION_VALUE : option.value}
                className={cn(
                  'relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 pr-8 text-[13px] font-medium text-foreground outline-none select-none transition-colors',
                  size === 'default' ? 'h-[36px]' : 'h-[32px] text-xs',
                  'focus:bg-primary-soft focus:text-foreground',
                  'data-[state=checked]:font-semibold',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <span className="pointer-events-none absolute right-2.5 flex size-4 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-3.5 text-primary" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
