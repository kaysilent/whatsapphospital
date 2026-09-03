import { ArrowDown, ArrowUp, Minus, Activity } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string
  icon?: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text.
   */
  delta?: {
    sign: number
    label: string
  }
  subtitle?: string
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl lg:text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
        </div>
        
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {Icon ? <Icon className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
        </div>
      </div>
      
      {delta && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {delta.sign > 0 ? (
            <span className="flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowUp className="h-3.5 w-3.5" />
              {delta.label || `+${delta.sign}`}
            </span>
          ) : delta.sign < 0 ? (
            <span className="flex items-center gap-0.5 font-semibold text-rose-600 dark:text-rose-400">
              <ArrowDown className="h-3.5 w-3.5" />
              {delta.label || `${delta.sign}`}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 font-medium text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              Optimal
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">vs previous period</span>
        </div>
      )}

      {subtitle && !delta && (
        <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
