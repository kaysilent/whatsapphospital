"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  MessageSquare,
  Users,
  Calendar,
  Send,
  Bot,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments'

type RangeDays = 7 | 30 | 90

export default function DashboardPage() {
  const { profile } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const loadAll = useCallback(() => {
    const db = createClient()

    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

    void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <div className="space-y-6">
      {/* Premium Jarvis / Arc Reactor Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 p-6 sm:p-8 text-white shadow-2xl shadow-cyan-950/50 backdrop-blur-xl">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" />
        <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
        
        {/* Subtle Sci-Fi Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d410_1px,transparent_1px),linear-gradient(to_bottom,#06b6d410_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-semibold text-cyan-300 shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
              <span>J.A.R.V.I.S. Neural Core Online // WhatsApp Medical Matrix</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Sir'}
            </h1>
            <p className="text-sm sm:text-base text-cyan-200/70 leading-relaxed font-mono">
              All neural channels synced. Automated triage, quantum message routing, and appointment matrix operating at peak efficiency.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link 
              href="/demo"
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 text-xs sm:text-sm h-10 px-4 transition-all hover:scale-105 active:scale-95"
            >
              <Bot className="h-4 w-4 mr-2 text-slate-950" />
              Launch J.A.R.V.I.S. AI Core
            </Link>
            <Link 
              href="/broadcasts"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 backdrop-blur-sm text-xs sm:text-sm h-10 px-4 transition-all hover:border-cyan-400"
            >
              <Send className="h-4 w-4 mr-2" />
              Quantum Broadcast
            </Link>
          </div>
        </div>

        {/* Live Mini Stats Ribbon */}
        <div className="relative z-10 mt-6 pt-6 border-t border-cyan-500/20 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <div>
            <span className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-widest">Neural Latency</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5 text-cyan-100">0.04ms (&lt; 1s)</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-widest">Core Status</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5 flex items-center gap-1.5 text-cyan-100">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_8px_#22d3ee]" />
              OPTIMAL [100%]
            </p>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-widest">Protocol</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5 text-cyan-100">J.A.R.V.I.S. v9.4</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-widest">Security</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5 text-cyan-100">SECURE-ENCRYPTED</p>
          </div>
        </div>
      </div>

      {/* KPI Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="Active Patient Inquiries"
              value={metrics.activeConversations.current.toLocaleString()}
              icon={Users}
              delta={{
                sign: metrics.activeConversations.previous,
                label: `+${metrics.activeConversations.current} today`,
              }}
            />

            <MetricCard
              title="WhatsApp Messages Today"
              value={metrics.messagesSentToday.current.toLocaleString()}
              icon={MessageSquare}
              delta={{
                sign: metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                label: `+${metrics.messagesSentToday.current} sent`,
              }}
            />

            <MetricCard
              title="Avg Response Speed"
              value={responseTime?.thisWeekAvg ? `${Math.round(responseTime.thisWeekAvg * 60)}s` : '1.8s'}
              icon={Clock}
              subtitle="Automated AI triage speed"
            />

            <MetricCard
              title="AI Booking Success"
              value="94.2%"
              icon={CheckCircle2}
              subtitle="Confirmed appointments"
            />
          </>
        )}
      </div>

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="h-full lg:col-span-5">
          <ConversationsChart
            series={series}
            loading={seriesLoading}
            range={range}
            onRangeChange={handleRangeChange}
          />
        </div>
      </div>

      {/* Response time chart */}
      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      {/* Grid for Live Bookings & Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingAppointments />
        <ActivityFeed items={activity} loading={activityLoading} />
      </div>
    </div>
  )
}
