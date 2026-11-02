import { cn } from '@/lib/utils'

/** A form input with its small label above. */
export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('grid min-w-0 gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
