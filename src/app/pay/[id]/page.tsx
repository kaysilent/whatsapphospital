"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building2,
  Lock,
  MessageSquare,
  MapPin,
  Loader2,
  Phone,
  ArrowRight,
  ExternalLink,
  Zap,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Script from "next/script";

// Canonical Clinic WhatsApp Bot Number
const BOT_WHATSAPP_NUMBER = "918639295134";

export default function PatientPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const paymentId = resolvedParams.id;
  const searchParams = useSearchParams();

  const isDummyPhone = (p: string) => {
    if (!p) return true;
    const digits = p.replace(/\D/g, "");
    const dummyList = [
      "919876543210",
      "9876543210",
      "1234567890",
      "911234567890",
      "0000000000",
      "9999999999",
      "1111111111",
    ];
    return dummyList.includes(digits) || digits.length < 8;
  };

  const rawName = searchParams.get("name") || "";
  const patientName = (!rawName || rawName.trim().toLowerCase() === "patient") ? "Valued Patient" : rawName.trim();
  const rawPhone = searchParams.get("phone") || "";
  const phoneNumber = isDummyPhone(rawPhone) ? "" : rawPhone;
  const treatment = searchParams.get("treatment") || "Clinical Consultation";
  const initialAmount = Number(searchParams.get("amount")) || 10;
  const [advanceTokenFee, setAdvanceTokenFee] = useState<number>(initialAmount);
  const rawAmount = advanceTokenFee;
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const time = searchParams.get("time") || "11:30 AM";
  const doctor = searchParams.get("doctor") || "Dr. Mrinalini";
  const apptId = searchParams.get("apptId") || "";

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [consultationFee, setConsultationFee] = useState<number>(Number(searchParams.get("consultationFee")) || 500);
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>("rzp_live_Tkiy8JNohenPgb");
  const [merchantName, setMerchantName] = useState<string>("La Fleur Aesthetic Clinic");
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    // 0. Fetch live payment configuration from server
    fetch("/api/payments/config")
      .then(r => r.json())
      .then(d => {
        if (d?.config?.booking_fee || d?.config?.default_advance_token_fee) {
          const fee = Number(d.config.booking_fee || d.config.default_advance_token_fee);
          if (!isNaN(fee) && fee > 0) setAdvanceTokenFee(fee);
        }
        if (d?.config?.default_consultation_fee) {
          const cFee = Number(d.config.default_consultation_fee);
          if (!isNaN(cFee) && cFee > 0) setConsultationFee(cFee);
        }
        if (d?.config?.razorpay_key_id) {
          setRazorpayKeyId(d.config.razorpay_key_id);
        }
        if (d?.config?.merchant_name) {
          setMerchantName(d.config.merchant_name);
        }
      })
      .catch(() => {});

    // 1. Fetch hospital profile for consultation fee
    fetch("/api/hospital/profile")
      .then(r => r.json())
      .then(d => {
        const prof = d?.profile || d;
        if (prof?.consultationFee) {
          setConsultationFee(Number(prof.consultationFee));
        }
        if (prof?.advanceTokenFee) {
          setAdvanceTokenFee(Number(prof.advanceTokenFee));
        }
      })
      .catch(() => {});
  }, []);

  const submitVerification = async (
    gatewayPaymentId: string, 
    selectedMode: string = "Razorpay Gateway",
    gatewayOrderId?: string,
    gatewaySignature?: string
  ) => {
    setIsProcessing(true);
    setGatewayError(null);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          gatewayPaymentId,
          gatewayOrderId,
          gatewaySignature,
          patientName,
          phoneNumber,
          treatment,
          amount: rawAmount,
          date,
          time,
          doctor,
          paymentMode: selectedMode,
          appointmentId: apptId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setIsPaid(true);
        setReceiptData(data);
        toast.success("Payment confirmed! Official appointment receipt sent to WhatsApp.");
      } else {
        toast.error(data.error || "Payment verification failed. Please contact the clinic.");
      }
    } catch (e: any) {
      console.error("Payment verification error:", e);
      toast.error("Could not verify payment with server. Please contact clinic reception.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessRazorpay = useCallback(async (isAuto = false) => {
    setIsProcessing(true);
    setGatewayError(null);

    const activeKeyId = razorpayKeyId || "rzp_live_Tkiy8JNohenPgb";

    // Ensure Razorpay SDK is loaded
    if (typeof window === "undefined") {
      setIsProcessing(false);
      return;
    }

    if (!(window as any).Razorpay) {
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => {
            setIsSdkLoaded(true);
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          document.body.appendChild(script);
        });
      } catch {
        setIsProcessing(false);
        const errMsg = "Failed to load Razorpay Checkout SDK. Please refresh or retry.";
        setGatewayError(errMsg);
        if (!isAuto) toast.error(errMsg);
        return;
      }
    }

    if (!(window as any).Razorpay) {
      setIsProcessing(false);
      const errMsg = "Razorpay SDK not ready. Please click Pay with Razorpay.";
      setGatewayError(errMsg);
      if (!isAuto) toast.error(errMsg);
      return;
    }

    try {
      const cleanPhoneDigits = phoneNumber ? phoneNumber.replace(/\D/g, "").slice(-10) : "";
      const options: any = {
        key: activeKeyId,
        amount: Math.round(rawAmount * 100), // in paise: ₹10 = 1000 paise
        currency: "INR",
        name: merchantName || "La Fleur Aesthetic Clinic",
        description: `Advance Booking Fee - ${treatment}`,
        image: "https://blue-monkey-950817.hostingersite.com/icon",
        prefill: {
          name: patientName !== "Valued Patient" ? patientName : "",
          contact: cleanPhoneDigits || "",
          email: "",
        },
        notes: {
          payment_id: paymentId,
          patient_name: patientName,
          phone: phoneNumber,
          treatment: treatment,
          date: date,
          time: time,
          doctor: doctor,
        },
        theme: {
          color: "#059669",
        },
        handler: async function (response: any) {
          if (response?.razorpay_payment_id) {
            await submitVerification(
              response.razorpay_payment_id,
              "Razorpay Gateway",
              response.razorpay_order_id,
              response.razorpay_signature
            );
          } else {
            setIsProcessing(false);
            toast.error("No payment identifier returned by Razorpay.");
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setIsProcessing(false);
        const desc = response?.error?.description || "Payment failed or cancelled.";
        setGatewayError(desc);
        toast.error(`Razorpay Notice: ${desc}`);
      });
      rzp.open();
    } catch (err: any) {
      setIsProcessing(false);
      console.error("[Razorpay Launch Error]:", err);
      const errMsg = err?.message || "Could not launch Razorpay checkout modal.";
      setGatewayError(errMsg);
      if (!isAuto) toast.error(errMsg);
    }
  }, [razorpayKeyId, rawAmount, merchantName, treatment, patientName, phoneNumber, paymentId, date, time, doctor]);

  // Automatically trigger Razorpay checkout on mount once SDK is ready
  useEffect(() => {
    if (!hasAutoTriggered.current && !isPaid) {
      hasAutoTriggered.current = true;
      const timer = setTimeout(() => {
        handleProcessRazorpay(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [handleProcessRazorpay, isPaid]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto w-full space-y-6">
        
        {/* Direct Razorpay Brand & Merchant Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-1 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Official Razorpay Payment Gateway</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {merchantName}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="h-3 w-3 text-emerald-600" />
            256-Bit Bank Grade SSL Encrypted Checkout
          </p>
        </div>

        {!isPaid ? (
          /* Direct Razorpay Checkout Container */
          <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Amount Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 p-6 text-white text-center space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-3 py-0.5 rounded-full backdrop-blur-xs">
                Appointment Token Advance
              </span>
              <div className="pt-1">
                <span className="text-4xl font-extrabold tracking-tight">₹{rawAmount}</span>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">Payable Online via Razorpay</p>
              </div>
            </div>

            {/* Patient Details Prefill Card */}
            <div className="p-6 space-y-5">
              <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-border/80">
                  <span className="text-muted-foreground">Patient Name</span>
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {patientName}
                  </span>
                </div>

                {phoneNumber && (
                  <div className="flex justify-between items-center pb-2 border-b border-border/80">
                    <span className="text-muted-foreground">WhatsApp Contact</span>
                    <span className="font-mono font-semibold text-foreground flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      {phoneNumber}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pb-2 border-b border-border/80">
                  <span className="text-muted-foreground">Consultation / Service</span>
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {treatment}
                  </span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-border/80">
                  <span className="text-muted-foreground">Consulting Doctor</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" />
                    {doctor}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date & Slot</span>
                  <span className="font-semibold text-foreground">
                    {date} at {time}
                  </span>
                </div>
              </div>

              {/* Consultation Fee vs Advance Token Breakdown */}
              {consultationFee > rawAmount && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Consultation Fee:</span>
                    <span className="font-semibold text-foreground">₹{consultationFee}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Advance Token (Paying Now):</span>
                    <span>₹{rawAmount}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground pt-1.5 border-t border-emerald-500/20 text-[11px]">
                    <span>Balance at Clinic Counter:</span>
                    <span className="font-bold text-foreground">₹{Math.max(0, consultationFee - rawAmount)}</span>
                  </div>
                </div>
              )}

              {/* Notice if Razorpay was blocked or needs user click */}
              {gatewayError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Razorpay Checkout Ready</p>
                    <p className="text-[11px] text-muted-foreground">{gatewayError}</p>
                  </div>
                </div>
              )}

              {/* Single Primary Direct Razorpay Trigger Button */}
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={() => handleProcessRazorpay(false)}
                  disabled={isProcessing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-13 rounded-2xl gap-2 shadow-lg shadow-emerald-600/25 text-sm sm:text-base transition-all transform active:scale-98"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      <span>Pay ₹{rawAmount} with Razorpay</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                  <Zap className="h-3 w-3 text-emerald-600" />
                  Supports Google Pay, PhonePe, Paytm, UPI, Debit/Credit Cards & NetBanking
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Payment Success & Receipt View */
          <div className="bg-card rounded-3xl border border-emerald-500/30 shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 animate-bounce duration-1000">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">Payment Successful!</h2>
              <p className="text-xs text-muted-foreground">
                Your appointment slot with <strong>{doctor}</strong> is now confirmed.
              </p>
            </div>

            {/* Receipt Summary Box */}
            <div className="bg-muted/40 rounded-2xl border border-border p-4 text-xs text-left space-y-2.5 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="text-muted-foreground font-sans">Receipt No:</span>
                <span className="font-bold text-foreground">{receiptData?.receiptNumber || `REC-${Date.now().toString().slice(-6)}`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Patient:</span>
                <span className="font-semibold text-foreground">{patientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Treatment:</span>
                <span className="font-semibold text-foreground">{treatment}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Date & Slot:</span>
                <span className="font-semibold text-foreground">{date} at {time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Gateway:</span>
                <span className="font-semibold text-foreground">Razorpay Verified</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Amount Paid:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">₹{rawAmount}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-muted-foreground font-sans">Status:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  ✓ Slot Locked
                </span>
              </div>
            </div>

            {/* Automated WhatsApp Confirmation Alert */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 text-left flex items-start gap-2.5">
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-bold">WhatsApp Confirmation Dispatched!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  A digital confirmation receipt and clinic location link have been dispatched to <strong>{phoneNumber || 'your WhatsApp number'}</strong>.
                </p>
              </div>
            </div>

            {/* Action Links */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <a
                href={`https://wa.me/${BOT_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Dr. Mrinalini, I have completed the online advance booking fee for my ${treatment} appointment on ${date} at ${time}. Receipt ID: ${receiptData?.receiptNumber || 'REC-CONFIRMED'}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Return to WhatsApp Chat</span>
              </a>

              <a
                href="https://maps.google.com/?q=La+Fleur+Aesthetic+Clinic+Hyderabad"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-border bg-card hover:bg-muted font-semibold text-xs text-foreground transition-colors"
              >
                <MapPin className="h-4 w-4 text-rose-500" />
                <span>Clinic Location</span>
              </a>
            </div>
          </div>
        )}

        {/* Footer info */}
        <p className="text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} {merchantName} • Road No.11 B, Jubilee hills, Hyderabad.
        </p>
      </div>

      {/* Razorpay Standard Checkout Script */}
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js" 
        strategy="afterInteractive"
        onLoad={() => setIsSdkLoaded(true)}
      />
    </div>
  );
}
