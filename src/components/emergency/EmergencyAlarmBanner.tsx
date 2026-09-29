"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { emergencyAudio } from "@/lib/audio/emergency-audio";
import { AlertTriangle, Volume2, VolumeX, CheckCircle, ArrowRight, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmergencyAlarmBanner() {
  const router = useRouter();
  const [alarmState, setAlarmState] = useState(emergencyAudio.getState());

  useEffect(() => {
    const unsubscribe = emergencyAudio.subscribe((state) => {
      setAlarmState(state);
    });
    return unsubscribe;
  }, []);

  if (!alarmState.isRunning) {
    return null;
  }

  const handleAcknowledgeAndStop = () => {
    emergencyAudio.stopAlarm();
    router.push("/escalations");
  };

  const handleToggleMute = () => {
    emergencyAudio.toggleMute();
  };

  return (
    <div className="sticky top-0 z-50 w-full animate-in slide-in-from-top duration-300">
      <div className="bg-rose-600 text-white px-4 py-2.5 shadow-lg border-b-2 border-rose-700 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Blinking siren and details */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40"></span>
            <AlertTriangle className="h-4 w-4 relative z-10 animate-pulse text-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded text-white flex items-center gap-1">
                <BellRing className="h-3 w-3 animate-bounce" />
                CRITICAL EMERGENCY ALERT
              </span>
              {!alarmState.isMuted ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-rose-100 bg-black/20 px-2 py-0.5 rounded-full">
                  <Volume2 className="h-3 w-3 animate-pulse" />
                  Continuous Alert Sound Active
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-rose-200 bg-black/20 px-2 py-0.5 rounded-full">
                  <VolumeX className="h-3 w-3" />
                  Sound Muted
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-rose-50 truncate mt-0.5">
              {alarmState.alertText || "A patient has reported urgent post-procedure complications on WhatsApp. Doctor relay bridge is active."}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleMute}
            className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/30 gap-1.5"
          >
            {alarmState.isMuted ? (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                Unmute Sound
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Mute Sound
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleAcknowledgeAndStop}
            className="h-8 text-xs bg-white text-rose-700 hover:bg-rose-50 font-bold shadow-sm gap-1.5"
          >
            <CheckCircle className="h-3.5 w-3.5 text-rose-600" />
            Check & Acknowledge (Stop Alarm)
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
