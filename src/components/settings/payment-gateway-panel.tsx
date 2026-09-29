"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  QrCode,
  Lock,
  Save,
  RefreshCw,
  ExternalLink,
  Shield,
  MessageSquare,
  DollarSign,
  Layers,
  Building2,
  HelpCircle,
  Eye,
  EyeOff,
  Radio,
  Sliders,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DEFAULT_PAYMENT_CONFIG, PaymentConfig } from "@/lib/payments/gateway";
import { getRuntimeHospitalProfile, saveHospitalProfile } from "@/lib/hospital/treatments";

export function PaymentGatewayPanel() {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/payments/config");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to load payment config", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/payments/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.ok) {
        if (typeof window !== 'undefined') {
          try {
            const profile = getRuntimeHospitalProfile();
            const fee = Number(config.booking_fee ?? config.default_consultation_fee) || 500;
            saveHospitalProfile({ ...profile, consultationFee: fee });
          } catch {}
        }
        toast.success("Payment Gateway settings saved successfully!");
      } else {
        toast.error(data.error || "Failed to save payment settings");
      }
    } catch (e) {
      toast.error("Error saving payment settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Gateway & Automated WhatsApp Receipts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Configure Razorpay, Stripe, or UPI to generate instant payment links upon booking and send automatic Thank-You receipts on WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gateway Selection Cards */}
        <div className="space-y-3">
          <Label className="text-xs font-bold text-foreground">Active Payment Gateway Provider</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Razorpay */}
            <div
              onClick={() => setConfig((prev) => ({ ...prev, gateway_provider: "razorpay" }))}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 relative ${
                config.gateway_provider === "razorpay"
                  ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600 shadow-xs"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <span className="font-bold text-xs text-foreground">Razorpay (Recommended)</span>
                </div>
                {config.gateway_provider === "razorpay" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                All-in-one payment gateway for Indian & International patients (UPI, Cards, Netbanking).
              </p>
            </div>

            {/* UPI Direct */}
            <div
              onClick={() => setConfig((prev) => ({ ...prev, gateway_provider: "upi" }))}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 relative ${
                config.gateway_provider === "upi"
                  ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600 shadow-xs"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-purple-600" />
                  <span className="font-bold text-xs text-foreground">UPI Instant & QR</span>
                </div>
                {config.gateway_provider === "upi" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Direct bank-to-bank UPI transfers via Google Pay, PhonePe, and Paytm with zero gateway fees.
              </p>
            </div>

            {/* Stripe */}
            <div
              onClick={() => setConfig((prev) => ({ ...prev, gateway_provider: "stripe" }))}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 relative ${
                config.gateway_provider === "stripe"
                  ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600 shadow-xs"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <span className="font-bold text-xs text-foreground">Stripe Gateway</span>
                </div>
                {config.gateway_provider === "stripe" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Global credit/debit card processing and international medical tourism consultations.
              </p>
            </div>
          </div>
        </div>

        {/* Razorpay Configuration Details */}
        {config.gateway_provider === "razorpay" && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-foreground">Razorpay API Credentials</h3>
              </div>
              <span className="text-[10.5px] bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold px-2 py-0.5 rounded">
                Live & Test API Keys
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Key ID (API Key)</Label>
                <Input
                  placeholder="rzp_test_... or rzp_live_..."
                  value={config.razorpay_key_id || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, razorpay_key_id: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold">Key Secret</Label>
                  <button
                    type="button"
                    onClick={() => setShowRazorpaySecret((p) => !p)}
                    className="text-[10.5px] text-muted-foreground hover:text-foreground"
                  >
                    {showRazorpaySecret ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  type={showRazorpaySecret ? "text" : "password"}
                  placeholder="Enter Razorpay Key Secret"
                  value={config.razorpay_key_secret || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, razorpay_key_secret: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold">Webhook Secret (Optional for background capture)</Label>
                <Input
                  placeholder="e.g. whsec_..."
                  value={config.razorpay_webhook_secret || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, razorpay_webhook_secret: e.target.value }))}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Webhook URL to add in Razorpay Dashboard: <code className="text-primary font-mono font-bold">https://your-domain.com/api/payments/webhook</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UPI Direct Configuration */}
        {config.gateway_provider === "upi" && (
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-purple-600" />
              <h3 className="text-xs font-bold text-foreground">UPI Merchant Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">UPI VPA / ID</Label>
                <Input
                  placeholder="e.g. lafleur@okhdfcbank"
                  value={config.upi_vpa || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, upi_vpa: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Merchant Display Name</Label>
                <Input
                  placeholder="e.g. La Fleur Aesthetic Clinic"
                  value={config.merchant_name || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, merchant_name: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stripe Configuration */}
        {config.gateway_provider === "stripe" && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-foreground">Stripe API Keys</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Publishable Key</Label>
                <Input
                  placeholder="pk_test_... or pk_live_..."
                  value={config.stripe_publishable_key || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, stripe_publishable_key: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold">Secret Key</Label>
                  <button
                    type="button"
                    onClick={() => setShowStripeSecret((p) => !p)}
                    className="text-[10.5px] text-muted-foreground hover:text-foreground"
                  >
                    {showStripeSecret ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  type={showStripeSecret ? "text" : "password"}
                  placeholder="sk_test_... or sk_live_..."
                  value={config.stripe_secret_key || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, stripe_secret_key: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pricing & Booking Rules */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">Booking Fees & Payment Automation Rules</h3>
          </div>

          <div className="max-w-md space-y-1.5 text-xs">
            <Label className="text-[11px] font-semibold text-foreground">
              Booking Fee (₹)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xs">
                ₹
              </span>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="500"
                value={config.booking_fee ?? config.default_consultation_fee ?? 500}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setConfig((p) => ({
                    ...p,
                    booking_fee: val,
                    default_consultation_fee: val,
                    default_advance_token_fee: val,
                  }));
                }}
                className="pl-7 text-xs font-semibold"
              />
            </div>
            <p className="text-[10.5px] text-muted-foreground">
              Fixed single appointment booking fee charged via payment gateway (Razorpay / UPI / Card) to confirm the appointment.
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-border">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.require_payment_for_booking}
                onChange={(e) => setConfig((p) => ({ ...p, require_payment_for_booking: e.target.checked }))}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-foreground">Auto-generate and send Payment Link on slot booking</span>
                <p className="text-[10.5px] text-muted-foreground">
                  When patient specifies their appointment slot on WhatsApp, the AI automatically provides the payment link.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.auto_send_whatsapp_receipt}
                onChange={(e) => setConfig((p) => ({ ...p, auto_send_whatsapp_receipt: e.target.checked }))}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-foreground">Auto-send WhatsApp Thank-You & Booking Receipt Message</span>
                <p className="text-[10.5px] text-muted-foreground">
                  Dispatches immediate confirmation receipt and clinic location when payment succeeds.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* WhatsApp Thank-You Message Template Customizer */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-foreground">WhatsApp Thank-You & Confirmation Message Template</h3>
            </div>
            <span className="text-[10px] text-muted-foreground">Supports WhatsApp *bold* and {`{variables}`}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pb-1">
            {["{patient_name}", "{treatment}", "{amount}", "{currency}", "{date}", "{time}", "{doctor}", "{receipt_id}", "{payment_mode}"].map((v) => (
              <span
                key={v}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10.5px] font-mono text-foreground border border-border"
              >
                {v}
              </span>
            ))}
          </div>

          <textarea
            rows={7}
            value={config.thank_you_message_template}
            onChange={(e) => setConfig((p) => ({ ...p, thank_you_message_template: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-9 rounded-xl shadow-md shadow-emerald-600/20"
          >
            <Save className="h-4 w-4 mr-1.5" />
            <span>{isSaving ? "Saving Configuration..." : "Save Payment Gateway Settings"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
