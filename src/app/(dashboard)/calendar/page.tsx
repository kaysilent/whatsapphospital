"use client"

import { useState, useEffect } from 'react'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Coffee, 
  Palmtree, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays,
  ShieldCheck,
  User,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  Zap,
  Activity,
  Key,
  Check,
  Loader2,
  Copy
} from 'lucide-react'
import { 
  useDoctorAvailability 
} from '@/hooks/use-doctor-availability'
import { 
  HOLIDAY_REASON_PRESETS, 
  formatDateRange, 
  formatReadableDate 
} from '@/lib/doctor/availability'
import { 
  getGoogleCalendarConfig, 
  saveGoogleCalendarConfig, 
  testGoogleCalendarConnection,
  GoogleCalendarConfig,
  GoogleCalendarTestResult 
} from '@/lib/calendar/google-calendar'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DoctorCalendarPage() {
  const { hospitalConfig, updateHospitalConfig, setHospitalStatus, activeDoctor, updateActiveDoctor } = useDoctorAvailability()
  const { accountRole, canEditClinicalConfig } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'schedule' | 'vacation' | 'google_sync'>('schedule')
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Local state for calendar settings
  const [formData, setFormData] = useState(hospitalConfig)

  useEffect(() => {
    setFormData(hospitalConfig)
  }, [hospitalConfig])

  useEffect(() => {
    fetch('/api/doctor/availability')
      .then(res => res.json())
      .then(data => {
        if (data && data.hospitalConfig) {
          updateHospitalConfig(data.hospitalConfig)
          setFormData(data.hospitalConfig)
        }
      })
      .catch(() => {})
  }, [updateHospitalConfig])

  // Google Calendar Integration State
  const [gcalConfig, setGcalConfig] = useState<GoogleCalendarConfig>(getGoogleCalendarConfig())
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<GoogleCalendarTestResult | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [copiedFeed, setCopiedFeed] = useState(false)

  useEffect(() => {
    fetch('/api/calendar/google')
      .then(res => res.json())
      .then(data => {
        if (data && data.config) {
          setGcalConfig(prev => ({
            ...prev,
            ...data.config,
            apiKey: data.config.apiKey || prev.apiKey || ''
          }))
        }
      })
      .catch(() => {
        setGcalConfig(getGoogleCalendarConfig())
      })
  }, [])

  const canEdit = canEditClinicalConfig || !accountRole

  const handleTestGoogleConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)
    try {
      const result = await testGoogleCalendarConnection(gcalConfig)
      setTestResult(result)
      if (result.success) {
        toast.success(`Google Calendar Connected! (${result.latencyMs}ms response)`)
      } else {
        toast.error(`Connection Error: ${result.message}`)
      }
    } catch (err: any) {
      toast.error('Failed to ping Google Calendar API')
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSaveGoogleConfig = async () => {
    const updated = saveGoogleCalendarConfig(gcalConfig)
    setGcalConfig(updated)
    try {
      const res = await fetch('/api/calendar/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gcalConfig)
      })
      if (res.ok) {
        toast.success('Google Calendar configuration saved permanently across all devices!')
      } else {
        toast.success('Google Calendar configuration saved successfully!')
      }
    } catch {
      toast.success('Google Calendar configuration saved successfully!')
    }
  }

  const handleSyncAllAppointments = async () => {
    setIsSyncingAll(true)
    try {
      const res = await fetch('/api/calendar/google/events')
      const data = await res.json()
      if (res.ok) {
        const count = data.events?.length || data.totalEvents || data.count || 0
        toast.success(`Verified ${count} live appointments ready in feed! Make sure you subscribe to the Live Auto-Sync Feed below.`)
      } else {
        toast.error(data.error || 'Failed to sync with Google Calendar')
      }
    } catch (err: any) {
      toast.error('Sync request failed: ' + (err?.message || 'Network error'))
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleSave = async () => {
    updateHospitalConfig(formData)
    let doctorUpdates: any = {}
    if (formData.status === 'holiday') {
      doctorUpdates = {
        status: 'holiday',
        startDate: formData.holidayStartDate,
        endDate: formData.holidayEndDate,
        reason: formData.holidayReason
      }
      updateActiveDoctor(doctorUpdates)
    } else if (formData.status === 'offline') {
      doctorUpdates = {
        status: 'away',
        endTime: formData.offlineReturnTime,
        reason: formData.offlineReason
      }
      updateActiveDoctor(doctorUpdates)
    } else {
      doctorUpdates = {
        status: 'available',
        startDate: '',
        endDate: '',
        reason: ''
      }
      updateActiveDoctor(doctorUpdates)
    }

    try {
      await fetch('/api/doctor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalConfig: formData,
          doctorId: activeDoctor?.doctorId || 'doc-mrinalini',
          ...doctorUpdates
        })
      })
    } catch (e) {
      console.warn('[Save Schedule Sync Warning]:', e)
    }

    setSavedSuccess(true)
    toast.success('Doctor schedule & availability successfully updated and linked to AI Receptionist!')
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  const handleStatusToggle = async (newStatus: 'online' | 'offline' | 'holiday') => {
    setHospitalStatus(newStatus)
    const updated = { ...formData, status: newStatus }
    setFormData(updated)

    let doctorUpdates: any = {}
    if (newStatus === 'holiday') {
      doctorUpdates = {
        status: 'holiday',
        startDate: updated.holidayStartDate,
        endDate: updated.holidayEndDate,
        reason: updated.holidayReason
      }
      updateActiveDoctor(doctorUpdates)
    } else if (newStatus === 'offline') {
      doctorUpdates = {
        status: 'away',
        endTime: updated.offlineReturnTime,
        reason: updated.offlineReason
      }
      updateActiveDoctor(doctorUpdates)
    } else {
      doctorUpdates = {
        status: 'available',
        startDate: '',
        endDate: '',
        reason: ''
      }
      updateActiveDoctor(doctorUpdates)
    }

    try {
      await fetch('/api/doctor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalConfig: updated,
          doctorId: activeDoctor?.doctorId || 'doc-mrinalini',
          ...doctorUpdates
        })
      })
    } catch (e) {
      console.warn('[Toggle Status Sync Warning]:', e)
    }

    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  Doctor Calendar & Working Hours
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <User className="h-3 w-3" />
                  Dr. Mrinalini (MD)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage office hours, lunch breaks, vacation dates, and Google Calendar synchronization.
              </p>
            </div>
          </div>
        </div>

        {/* Live Status Badge & Google Calendar Action */}
        <div className="flex items-center gap-2.5">
          <a
            href={formData.googleCalendarUrl || "https://calendar.google.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-xs transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            Open Google Calendar
          </a>

          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save Schedule
            </button>
          )}
        </div>
      </div>

      {/* Success Toast Banner */}
      {savedSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Doctor schedule & availability successfully updated and linked to AI Receptionist!</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'schedule'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          Weekly Office Hours & Lunch Break
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('vacation')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'vacation'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palmtree className="h-4 w-4" />
          Out of Office & Vacation / Holidays
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('google_sync')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'google_sync'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          Google Calendar Integration
        </button>
      </div>

      {/* TAB 1: Weekly Office Hours & Lunch Break */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timings Quick Setup Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-foreground">Clinic Working Hours</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Set Dr. Mrinalini's standard operating hours for OPD consultations.
              </p>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Opening Time</label>
                    <input
                      type="text"
                      value={formData.openingTime}
                      disabled={!canEdit}
                      onChange={e => setFormData(prev => ({ ...prev, openingTime: e.target.value }))}
                      className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Closing Time</label>
                    <input
                      type="text"
                      value={formData.closingTime}
                      disabled={!canEdit}
                      onChange={e => setFormData(prev => ({ ...prev, closingTime: e.target.value }))}
                      className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 text-amber-600" />
                    <h4 className="text-xs font-bold text-foreground">Lunch & Case Review Hours</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Lunch Start</label>
                      <input
                        type="text"
                        value={formData.lunchStartTime}
                        disabled={!canEdit}
                        onChange={e => setFormData(prev => ({ ...prev, lunchStartTime: e.target.value }))}
                        className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Lunch End</label>
                      <input
                        type="text"
                        value={formData.lunchEndTime}
                        disabled={!canEdit}
                        onChange={e => setFormData(prev => ({ ...prev, lunchEndTime: e.target.value }))}
                        className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    During lunch hours, the AI Receptionist automatically directs bookings to morning or afternoon slots.
                  </p>
                </div>
              </div>
            </div>

            {/* Standard Consultation Slots */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Consultation Slot Blocks</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Slots offered to patients during WhatsApp booking conversations.
              </p>

              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  {formData.standardSlots.map((slot, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg border border-border/80 bg-background text-xs font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-emerald-600" />
                        {slot}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                        45 min
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Doctor OPD Protocol:</p>
                  <p>• Morning OPD: 10:30 AM & 11:30 AM</p>
                  <p>• Afternoon Laser & Procedures: 02:30 PM & 04:00 PM</p>
                  <p>• Evening Follow-Ups: 05:30 PM</p>
                </div>
              </div>
            </div>

            {/* Weekly Operating Days Table */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-foreground">Clinic Working Days</h3>
              <div className="space-y-1.5">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs hover:bg-muted/40 transition-colors">
                    <span className="font-medium text-foreground">{day}</span>
                    {day === 'Sunday' ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 font-semibold">
                        Weekly Off (Emergency On Call)
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                        10:00 AM – 07:00 PM
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Weekly Visual Schedule Grid */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">Dr. Mrinalini's Weekly Schedule Visualizer</h3>
                <p className="text-xs text-muted-foreground">Visual view of OPD consultation windows and clinical procedure blocks.</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Consultations
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Lunch Break
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  Laser & PRP
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="rounded-xl border border-border bg-background p-3 space-y-2">
                  <div className="text-xs font-bold text-foreground text-center border-b border-border/60 pb-1.5">
                    {d}
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                      10:00 - 01:00 PM
                      <div className="text-[10px] text-emerald-600/80">OPD Consultations</div>
                    </div>
                    <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
                      01:00 - 02:00 PM
                      <div className="text-[10px] text-amber-600/80">Lunch Break</div>
                    </div>
                    <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium">
                      02:00 - 05:00 PM
                      <div className="text-[10px] text-primary/80">Laser & Aesthetics</div>
                    </div>
                    <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                      05:00 - 07:00 PM
                      <div className="text-[10px] text-emerald-600/80">Follow-Ups & Review</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Out of Office & Vacation / Holidays */}
      {activeTab === 'vacation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Out of Office / Break Mode */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-foreground">Short Out of Office / Break</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(formData.status === 'offline' ? 'online' : 'offline')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    formData.status === 'offline'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {formData.status === 'offline' ? 'Active' : 'Turn On'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Set when Dr. Mrinalini is stepping away for lunch or a procedure and specify the exact return time.
              </p>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Expected Return Time</label>
                  <input
                    type="text"
                    value={formData.offlineReturnTime || ''}
                    disabled={!canEdit}
                    onChange={e => setFormData(prev => ({ ...prev, offlineReturnTime: e.target.value }))}
                    placeholder="e.g. 02:00 PM or 04:30 PM"
                    className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Reason / Note</label>
                  <input
                    type="text"
                    value={formData.offlineReason || ''}
                    disabled={!canEdit}
                    onChange={e => setFormData(prev => ({ ...prev, offlineReason: e.target.value }))}
                    placeholder="e.g. Minor OT Procedure / Lunch Break"
                    className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                  />
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">AI Automated WhatsApp Response:</p>
                  <p className="italic">
                    "Dr. Mrinalini is currently in a clinical procedure / break and will be back at {formData.offlineReturnTime || '02:00 PM'}. Would you like to book a slot for after their return?"
                  </p>
                </div>
              </div>
            </div>

            {/* Vacation / Holiday Date Range ("when to when") */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-foreground">Doctor Holiday & Vacation Window</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(formData.status === 'holiday' ? 'online' : 'holiday')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    formData.status === 'holiday'
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {formData.status === 'holiday' ? 'Active' : 'Turn On'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define the "when to when" date range for doctor leave, conference, or annual vacation.
              </p>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">From Date</label>
                    <input
                      type="date"
                      value={formData.holidayStartDate || ''}
                      disabled={!canEdit}
                      onChange={e => setFormData(prev => ({ ...prev, holidayStartDate: e.target.value }))}
                      className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">To Date</label>
                    <input
                      type="date"
                      value={formData.holidayEndDate || ''}
                      disabled={!canEdit}
                      onChange={e => setFormData(prev => ({ ...prev, holidayEndDate: e.target.value }))}
                      className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Holiday Reason</label>
                  <select
                    value={formData.holidayReason || ''}
                    disabled={!canEdit}
                    onChange={e => setFormData(prev => ({ ...prev, holidayReason: e.target.value }))}
                    className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground disabled:opacity-70"
                  >
                    {HOLIDAY_REASON_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-[11px] text-purple-800 dark:text-purple-300 space-y-1">
                  <p className="font-semibold">AI Automated WhatsApp Response:</p>
                  <p className="italic">
                    "Dr. Mrinalini is away on holiday from {formatDateRange(formData.holidayStartDate, formData.holidayEndDate) || 'the selected dates'} ({formData.holidayReason || 'Vacation'}). Consultations will resume on {formatReadableDate(formData.holidayEndDate) || 'their return date'}."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Google Calendar Integration */}
      {activeTab === 'google_sync' && (
        <div className="max-w-4xl space-y-6">
          {/* Connection Status Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CalendarIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-foreground">Google Calendar Real-Time Sync</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      gcalConfig.isConnected 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${gcalConfig.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      {gcalConfig.isConnected ? 'Connected & Active' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sync Dr. Mrinalini's consultation schedule with Google Calendar for instant 2-way access.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestGoogleConnection}
                  disabled={isTestingConnection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold border border-border transition-all shadow-2xs disabled:opacity-50"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Testing API Ping...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>

                <a
                  href={gcalConfig.googleCalendarUrl || "https://calendar.google.com/calendar/u/0/r"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Calendar</span>
                </a>
              </div>
            </div>

            {/* Test Connection Diagnostic Output */}
            {testResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 animate-fade-in ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Google Calendar API Diagnostic: {testResult.status.toUpperCase()}</span>
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-background/80 border">
                    Latency: {testResult.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px]">{testResult.message}</p>
                {testResult.calendarDetails && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Calendar:</span>
                      <strong>{testResult.calendarDetails.summary}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Account Email:</span>
                      <strong>{testResult.calendarDetails.accountEmail}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Timezone:</span>
                      <strong>{testResult.calendarDetails.timeZone}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Access Role:</span>
                      <strong className="capitalize">{testResult.calendarDetails.accessRole}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Config Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>Doctor Google Account / Calendar ID</span>
                </label>
                <input
                  type="email"
                  value={gcalConfig.accountEmail || ''}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, accountEmail: e.target.value, calendarId: e.target.value }))}
                  placeholder="dr.mrinalini@lafleurwellness.com"
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Primary Google Calendar ID where appointments and surgery blocks are stored.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Calendar Display Name</span>
                </label>
                <input
                  type="text"
                  value={gcalConfig.calendarName || ''}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, calendarName: e.target.value }))}
                  placeholder="Dr. Mrinalini's Clinical Consultations"
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Identifier shown on event invite titles and patient booking confirmations.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-primary" />
                  <span>Google Calendar API Key (Optional)</span>
                </label>
                <input
                  type="password"
                  value={gcalConfig.apiKey || ''}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="AIzaSy..."
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground font-mono disabled:opacity-70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Google Cloud Console API key for server-to-server appointment sync.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>Calendar Timezone</span>
                </label>
                <select
                  value={gcalConfig.syncTimezone || 'Asia/Kolkata'}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, syncTimezone: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-xl px-3 py-2 text-foreground disabled:opacity-70"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Timezone applied when computing start and end slots for patients.
                </p>
              </div>
            </div>

            {/* Sync Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={gcalConfig.autoSyncOnBooking}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, autoSyncOnBooking: e.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Auto-Sync on WhatsApp Booking</p>
                  <p className="text-[11px] text-muted-foreground">Automatically write confirmed patient appointments to Google Calendar.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={gcalConfig.syncReminders}
                  disabled={!canEdit}
                  onChange={e => setGcalConfig(prev => ({ ...prev, syncReminders: e.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary/20"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Calendar Reminders & Alerts</p>
                  <p className="text-[11px] text-muted-foreground">Set 15-minute and 1-day Google Calendar notifications for Dr. Mrinalini.</p>
                </div>
              </label>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleSyncAllAppointments}
                disabled={isSyncingAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold border border-border shadow-2xs transition-all disabled:opacity-50"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Syncing All Appointments...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                    <span>Sync All CRM Appointments Now</span>
                  </>
                )}
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleSaveGoogleConfig}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Calendar Settings</span>
                </button>
              )}
            </div>
          </div>

          {/* Live RFC 5545 iCalendar Subscription Card */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <span>Live Google Calendar Auto-Sync Feed</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">iCal / RFC 5545</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Subscribe once in your Google Calendar app. Any appointment created, rescheduled, or cancelled automatically reflects in your Google Calendar.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const feedUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/google/feed`
                    navigator.clipboard.writeText(feedUrl)
                    setCopiedFeed(true)
                    setTimeout(() => setCopiedFeed(false), 2500)
                    toast.success('Feed URL copied! In Google Calendar, click "+" next to "Other calendars" and choose "From URL".')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-2xs"
                >
                  {copiedFeed ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-blue-600" />}
                  <span>{copiedFeed ? 'Feed URL Copied!' : 'Copy Feed Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const feedUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/google/feed`
                    navigator.clipboard.writeText(feedUrl)
                    toast.success('Feed link copied to clipboard! Opening Google Calendar Add URL page...')
                    window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl', '_blank')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>1-Click Add in Google Calendar</span>
                </button>
              </div>
            </div>

            {/* Step-by-step subscription instructions */}
            <div className="p-3.5 rounded-xl bg-background/80 border border-blue-500/20 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground text-[12px]">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>How to show all clinic appointments in your Google Calendar in 30 seconds:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <li>Click <strong className="text-foreground">Copy Feed Link</strong> above (or click <strong className="text-foreground">1-Click Add in Google Calendar</strong>).</li>
                <li>In Google Calendar (<span className="font-mono text-[10px]">calendar.google.com</span>), on the left sidebar look for <strong className="text-foreground">"Other calendars"</strong> and click the <strong className="text-foreground">+</strong> icon ➔ choose <strong className="text-foreground">"From URL"</strong>.</li>
                <li>Paste the copied URL (<span className="font-mono text-[10px] text-blue-600">/api/calendar/google/feed</span>) and click <strong className="text-foreground">"Add calendar"</strong>.</li>
              </ol>
              <p className="text-[10px] text-muted-foreground italic border-t border-border/50 pt-1.5">
                * Note: Google protects personal Gmail calendars from direct third-party write access without subscription. Once subscribed above, all past, present, and new WhatsApp appointments will automatically display in your Google Calendar app.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-background/90 border border-border/80 font-mono text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 overflow-hidden">
              <span className="truncate">{typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/google/feed` : '/api/calendar/google/feed'}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans font-semibold shrink-0">
                15-Min Doctor Reminders Included
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
