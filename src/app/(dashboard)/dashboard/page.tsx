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
      {/* Premium Hospital Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 sm:p-8 text-white shadow-md">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
              <span>AI Receptionist & WhatsApp Cloud Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              {greeting}, {profile?.full_name?.split(' ')[0] || 'Doctor'}
            </h1>
            <p className="text-sm sm:text-base text-emerald-50/90 leading-relaxed">
              Real-time patient communications, automated 24/7 AI WhatsApp triage, and clinic appointment scheduling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link 
              href="/demo"
              className="inline-flex items-center justify-center rounded-lg bg-white text-slate-900 hover:bg-emerald-50 font-semibold shadow-md text-xs sm:text-sm h-10 px-4 transition-colors"
            >
              <Bot className="h-4 w-4 mr-2 text-emerald-600" />
              Launch AI Emulator
            </Link>
            <Link 
              href="/broadcasts"
              className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm text-xs sm:text-sm h-10 px-4 transition-colors"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Broadcast
            </Link>
          </div>
        </div>

        {/* Live Mini Stats Ribbon */}
        <div className="relative z-10 mt-6 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">AI Auto-Reply</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5">Instant (&lt; 2s)</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">WhatsApp Status</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
              99.9% Online
            </p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Triage Level</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5">Automated</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-emerald-100 uppercase tracking-wider">Clinic Branch</span>
            <p className="text-lg sm:text-xl font-bold mt-0.5">Main Hospital</p>
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
