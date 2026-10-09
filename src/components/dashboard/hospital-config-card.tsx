"use client"

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertCircle, 
  Palmtree, 
  Moon, 
  Sun, 
  Sparkles,
  Save,
  UserCheck,
  Coffee,
  CalendarDays,
  ExternalLink
} from 'lucide-react'
import { 
  useDoctorAvailability 
} from '@/hooks/use-doctor-availability'
import { 
  HospitalConfig, 
  HOLIDAY_REASON_PRESETS,
  formatDateRange 
} from '@/lib/doctor/availability'
import { useAuth } from '@/hooks/use-auth'

export function HospitalConfigCard() {
  const { hospitalConfig, updateHospitalConfig, setHospitalStatus, activeDoctor, updateActiveDoctor } = useDoctorAvailability()
  const { profile, accountRole, canEditClinicalConfig } = useAuth()
  
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<HospitalConfig>(hospitalConfig)
  const [savedToast, setSavedToast] = useState(false)

  useEffect(() => {
    setFormData(hospitalConfig)
  }, [hospitalConfig])

  const canEdit = canEditClinicalConfig || !accountRole

  const handleSave = () => {
    updateHospitalConfig(formData)
    if (formData.title && typeof window !== 'undefined') {
      localStorage.setItem('wacrm_profile_role', formData.title)
    }
    // Also update active doctor state to match
    if (formData.status === 'holiday') {
      updateActiveDoctor({
        status: 'holiday',
        startDate: formData.holidayStartDate,
        endDate: formData.holidayEndDate,
        reason: formData.holidayReason
      })
    } else if (formData.status === 'offline') {
      updateActiveDoctor({
        status: 'away',
        endTime: formData.offlineReturnTime,
        reason: formData.offlineReason
      })
    } else {
      updateActiveDoctor({
        status: 'available',
        startDate: '',
        endDate: '',
        reason: ''
      })
    }

    setIsEditing(false)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 3000)
  }

  const handleQuickStatusChange = (newStatus: 'online' | 'offline' | 'holiday') => {
    setHospitalStatus(newStatus)
    setFormData(prev => ({ ...prev, status: newStatus }))
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 3000)
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header Banner */}
      <div className="border-b border-border bg-muted/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground">Clinic Profile & Doctor Schedule</h2>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                {formData.doctorName || profile?.full_name || 'Dr. Mrinalini'} ({formData.title || profile?.role || 'Chief Dermatologist'})
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure hospital working hours, lunch breaks, and live doctor availability.
            </p>
          </div>
        </div>

        {/* Live Status Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border border-border/80 shadow-xs">
          <button
            type="button"
            onClick={() => handleQuickStatusChange('online')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              formData.status === 'online'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${formData.status === 'online' ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
            Online / Active
          </button>

          <button
            type="button"
            onClick={() => handleQuickStatusChange('offline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              formData.status === 'offline'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            Offline / Break
          </button>

          <button
            type="button"
            onClick={() => handleQuickStatusChange('holiday')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              formData.status === 'holiday'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Palmtree className="h-3.5 w-3.5" />
            Holiday / Vacation
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Status Notification Banner if Offline or Holiday */}
        {formData.status === 'offline' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Doctor is Currently Away ({formData.offlineReason || 'Clinical Procedure / Break'})
              </p>
              <p className="text-amber-700/90 dark:text-amber-300/80 leading-relaxed">
                WhatsApp AI will inform incoming patients that Dr. Mrinalini is on a brief break and will return at <strong className="font-bold">{formData.offlineReturnTime || '02:00 PM'}</strong>.
              </p>
            </div>
          </div>
        )}

        {formData.status === 'holiday' && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 flex items-start gap-3">
            <Palmtree className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-purple-800 dark:text-purple-300">
                Doctor Vacation Mode Active ({formatDateRange(formData.holidayStartDate, formData.holidayEndDate) || 'Current Dates'})
              </p>
              <p className="text-purple-700/90 dark:text-purple-300/80 leading-relaxed">
                Reason: <strong>{formData.holidayReason || 'Annual Vacation'}</strong>. WhatsApp AI will notify patients and offer booking after return date.
              </p>
            </div>
          </div>
        )}

        {/* View / Edit Mode Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Hospital Name & Doctor */}
          <div className="space-y-1.5 rounded-xl border border-border/80 bg-background/50 p-3.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              Hospital / Clinic
            </label>
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Clinic Name</label>
                  <input
                    type="text"
                    value={formData.hospitalName}
                    onChange={e => setFormData(prev => ({ ...prev, hospitalName: e.target.value }))}
                    className="w-full text-xs font-medium bg-background border border-input rounded-md px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Doctor Name</label>
                  <input
                    type="text"
                    value={formData.doctorName || ''}
                    onChange={e => setFormData(prev => ({ ...prev, doctorName: e.target.value }))}
                    placeholder="Doctor Name"
                    className="w-full text-xs font-medium bg-background border border-input rounded-md px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Role / Title</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Chief Dermatologist & Aesthetic Physician"
                    className="w-full text-xs font-medium bg-background border border-input rounded-md px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-foreground truncate">{formData.hospitalName}</p>
                <p className="text-[11px] text-muted-foreground">
                  Consulting: <span className="font-semibold text-foreground">{formData.doctorName || profile?.full_name || 'Dr. Mrinalini'}</span>
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Role: <span className="font-medium text-foreground">{formData.title || profile?.role || 'Chief Dermatologist & Aesthetic Physician'}</span>
                </p>
              </>
            )}
          </div>

          {/* OPD Operating Hours */}
          <div className="space-y-1.5 rounded-xl border border-border/80 bg-background/50 p-3.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              Working Hours (Mon-Sat)
            </label>
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={formData.openingTime}
                  onChange={e => setFormData(prev => ({ ...prev, openingTime: e.target.value }))}
                  className="w-1/2 text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground"
                  placeholder="10:00 AM"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="text"
                  value={formData.closingTime}
                  onChange={e => setFormData(prev => ({ ...prev, closingTime: e.target.value }))}
                  className="w-1/2 text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground"
                  placeholder="07:00 PM"
                />
              </div>
            ) : (
              <p className="text-xs font-bold text-foreground">{formData.openingTime} – {formData.closingTime}</p>
            )}
            <p className="text-[11px] text-muted-foreground">Appointments: 5 slots daily</p>
          </div>

          {/* Lunch / Break Timings */}
          <div className="space-y-1.5 rounded-xl border border-border/80 bg-background/50 p-3.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="h-3.5 w-3.5 text-amber-600" />
              Lunch & Break Hours
            </label>
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={formData.lunchStartTime}
                  onChange={e => setFormData(prev => ({ ...prev, lunchStartTime: e.target.value }))}
                  className="w-1/2 text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground"
                  placeholder="01:00 PM"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="text"
                  value={formData.lunchEndTime}
                  onChange={e => setFormData(prev => ({ ...prev, lunchEndTime: e.target.value }))}
                  className="w-1/2 text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground"
                  placeholder="02:00 PM"
                />
              </div>
            ) : (
              <p className="text-xs font-bold text-foreground">{formData.lunchStartTime} – {formData.lunchEndTime}</p>
            )}
            <p className="text-[11px] text-muted-foreground">AI holds bookings during break</p>
          </div>

          {/* Active Status Context */}
          <div className="space-y-1.5 rounded-xl border border-border/80 bg-background/50 p-3.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
              Doctor Holiday / Away Window
            </label>
            {formData.status === 'holiday' ? (
              <p className="text-xs font-bold text-purple-700 dark:text-purple-400 truncate">
                {formatDateRange(formData.holidayStartDate, formData.holidayEndDate) || 'Holiday Active'}
              </p>
            ) : formData.status === 'offline' ? (
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Back at {formData.offlineReturnTime || '02:00 PM'}
              </p>
            ) : (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Active & Accepting Bookings
              </p>
            )}
            <p className="text-[11px] text-muted-foreground truncate">
              {formData.status === 'holiday' ? formData.holidayReason : formData.status === 'offline' ? formData.offlineReason : 'All slots available today'}
            </p>
          </div>
        </div>

        {/* Offline / Holiday Configuration Form when in editing mode */}
        {isEditing && (
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Offline Return & Vacation Dates Setup
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Offline return time */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">If Offline, Expected Return Time</label>
                <input
                  type="text"
                  value={formData.offlineReturnTime || ''}
                  onChange={e => setFormData(prev => ({ ...prev, offlineReturnTime: e.target.value }))}
                  placeholder="e.g. 02:00 PM or Tomorrow 10:00 AM"
                  className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 text-foreground"
                />
              </div>

              {/* Offline Reason */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Offline Reason</label>
                <input
                  type="text"
                  value={formData.offlineReason || ''}
                  onChange={e => setFormData(prev => ({ ...prev, offlineReason: e.target.value }))}
                  placeholder="e.g. Lunch Break / Procedure"
                  className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 text-foreground"
                />
              </div>

              {/* Holiday Start Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Holiday From Date</label>
                <input
                  type="date"
                  value={formData.holidayStartDate || ''}
                  onChange={e => setFormData(prev => ({ ...prev, holidayStartDate: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 text-foreground"
                />
              </div>

              {/* Holiday End Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Holiday To Date</label>
                <input
                  type="date"
                  value={formData.holidayEndDate || ''}
                  onChange={e => setFormData(prev => ({ ...prev, holidayEndDate: e.target.value }))}
                  className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 text-foreground"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Holiday Reason Preset</label>
              <select
                value={formData.holidayReason || ''}
                onChange={e => setFormData(prev => ({ ...prev, holidayReason: e.target.value }))}
                className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 text-foreground"
              >
                {HOLIDAY_REASON_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>{preset}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {savedToast ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold animate-fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Clinic settings & Doctor status synchronized with AI!
              </span>
            ) : (
              <span>AI automatically applies working hours and doctor holiday dates in WhatsApp.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save & Apply
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors"
                  >
                    Edit Hospital Timings & Holidays
                  </button>
                )}
              </>
            )}

            <a
              href="/calendar"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Open Doctor Calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
