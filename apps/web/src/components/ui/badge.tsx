import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  color,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> & {
  color?: string | null;
}) {
  // When a hex color is provided (e.g. trade status), render a soft tinted chip.
  const style = color
    ? {
        backgroundColor: `${color}1a`,
        color,
        borderColor: `${color}40`,
      }
    : undefined;
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        !color && 'border-border bg-secondary text-secondary-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
