"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, TrendingUp } from 'lucide-react'
import type { ConversationsSeriesPoint } from '@/lib/dashboard/types'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'

type RangeDays = 7 | 30 | 90

interface ConversationsChartProps {
  series: Record<RangeDays, ConversationsSeriesPoint[] | null>
  loading: boolean
  range: RangeDays
  onRangeChange: (r: RangeDays) => void
}

const VB_W = 760
const VB_H = 240
const PADDING = { top: 20, right: 20, bottom: 32, left: 45 }

export function ConversationsChart({ series, loading, range, onRangeChange }: ConversationsChartProps) {
  const data = series[range]

  const { maxY, niceTicks } = useMemo(() => {
    const arr = data ?? []
    const max = arr.reduce(
      (m, p) => Math.max(m, p.incoming, p.outgoing),
      0,
    )
    const ceil = niceCeil(max)
    const ticks = [0, ceil / 4, ceil / 2, (3 * ceil) / 4, ceil].map((v) =>
      Math.round(v),
    )
    return { maxY: ceil, niceTicks: Array.from(new Set(ticks)) }
  }, [data])

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card shadow-xs">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Patient Traffic & WhatsApp Volume
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Inbound patient queries vs automated & outbound replies.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/50">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r as RangeDays)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                range === r
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r} Days
            </button>
          ))}
        </div>
      </header>

      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-[240px] w-full" />
        ) : data.every((p) => p.incoming === 0 && p.outgoing === 0) ? (
          <EmptyState
            icon={MessageSquare}
            title="No WhatsApp traffic recorded"
            hint="Patient messages sent and received through your WhatsApp Cloud API will appear here."
          />
        ) : (
          <LineSvg data={data} maxY={maxY} ticks={niceTicks} />
        )}
      </div>

      <footer className="flex items-center gap-6 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <LegendDot color="#10b981" label="Inbound Patient Messages" />
        <LegendDot color="#0284c7" label="AI & Staff Outbound Messages" />
      </footer>
    </section>
  )
}

function LineSvg({
  data,
  maxY,
  ticks,
}: {
  data: ConversationsSeriesPoint[]
  maxY: number
  ticks: number[]
}) {
  const [hover, setHover] = useState<{ idx: number; tooltipLeftPx: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const chartW = VB_W - PADDING.left - PADDING.right
  const chartH = VB_H - PADDING.top - PADDING.bottom

  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0
  const yFor = (v: number) =>
    maxY === 0 ? PADDING.top + chartH : PADDING.top + chartH - (v / maxY) * chartH
  const xFor = (i: number) => PADDING.left + i * stepX

  const incomingPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.incoming)}`).join(' ')
  const outgoingPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.outgoing)}`).join(' ')

  useEffect(() => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return
    const onMove = (e: MouseEvent) => {
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const local = pt.matrixTransform(ctm.inverse())
      const xVb = local.x
      if (xVb < PADDING.left - 8 || xVb > VB_W - PADDING.right + 8) {
        setHover(null)
        return
      }
      const relative = xVb - PADDING.left
      const idx = Math.max(
        0,
        Math.min(data.length - 1, Math.round(stepX === 0 ? 0 : relative / stepX)),
      )
      const dataPointVbX = PADDING.left + idx * stepX
      const dataPointPt = svg.createSVGPoint()
      dataPointPt.x = dataPointVbX
      dataPointPt.y = 0
      const screen = dataPointPt.matrixTransform(ctm)
      const wrapRect = wrap.getBoundingClientRect()
      setHover({ idx, tooltipLeftPx: screen.x - wrapRect.left })
    }
    const onLeave = () => setHover(null)
    svg.addEventListener('mousemove', onMove)
    svg.addEventListener('mouseleave', onLeave)
    return () => {
      svg.removeEventListener('mousemove', onMove)
      svg.removeEventListener('mouseleave', onLeave)
    }
  }, [data, stepX])

  const hovered = hover !== null ? data[hover.idx] : null
  const hoverX = hover !== null ? xFor(hover.idx) : 0
  const labelStride = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-[240px] w-full"
        role="img"
        aria-label="Patient Inflow Chart"
      >
        {/* Y-axis gridlines + labels */}
        {ticks.map((t) => {
          const y = yFor(t)
          return (
            <g key={t}>
              <line
                x1={PADDING.left}
                x2={VB_W - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={PADDING.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {data.map((p, i) =>
          i % labelStride === 0 ? (
            <text
              key={p.day}
              x={xFor(i)}
              y={VB_H - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {shortDayLabel(p.day)}
            </text>
          ) : null,
        )}

        {/* Outgoing polyline (teal/cyan) */}
        <path
          d={outgoingPath}
          fill="none"
          stroke="#0284c7"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Incoming polyline (emerald green) */}
        <path
          d={incomingPath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover crosshair */}
        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={PADDING.top + chartH}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
            <circle cx={hoverX} cy={yFor(data[hover.idx].incoming)} r={4} fill="#10b981" />
            <circle cx={hoverX} cy={yFor(data[hover.idx].outgoing)} r={4} fill="#0284c7" />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl backdrop-blur-md"
          style={{ left: `${hover.tooltipLeftPx}px` }}
        >
          <div className="font-semibold text-foreground">{longDayLabel(hovered.day)}</div>
          <div className="mt-1 flex flex-col gap-1">
            <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Incoming: {hovered.incoming} messages
            </span>
            <span className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              Outgoing: {hovered.outgoing} messages
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="font-medium text-foreground">{label}</span>
    </span>
  )
}

function shortDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function longDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function niceCeil(max: number): number {
  if (max <= 0) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const normalised = max / pow
  let nice: number
  if (normalised <= 1) nice = 1
  else if (normalised <= 2) nice = 2
  else if (normalised <= 5) nice = 5
  else nice = 10
  return nice * pow
}
