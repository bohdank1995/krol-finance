import { cn } from '@/lib/utils'

/** A form input with its small label above. `group` drops the <label> wrapper, for controls a label
    would click twice (popover buttons): the caption then names them through `aria-labelledby`. */
export function Field({ label, className, group, children }: { label: string; className?: string; group?: string; children: React.ReactNode }) {
  const Root = group ? 'div' : 'label'
  return (
    <Root className={cn('grid min-w-0 gap-1.5', className)}>
      <span id={group} className="text-xs text-muted-foreground">{label}</span>
      {children}
    </Root>
  )
}
