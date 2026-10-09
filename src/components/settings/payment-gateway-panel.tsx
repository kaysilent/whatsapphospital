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
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Zap,
  Pencil,
  Trash2,
  ShieldCheck,
  X
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
  const [isEditingRazorpay, setIsEditingRazorpay] = useState(false);
  const [isEditingStripe, setIsEditingStripe] = useState(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isTestingRazorpay, setIsTestingRazorpay] = useState(false);
  const [razorpayTestResult, setRazorpayTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);

  const handleTestRazorpay = async () => {
    setIsTestingRazorpay(true);
    setRazorpayTestResult(null);
    try {
      const res = await fetch("/api/payments/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "razorpay",
          keyId: config.razorpay_key_id,
          keySecret: config.razorpay_key_secret,
        }),
      });
      const data = await res.json();
      setRazorpayTestResult(data);
      if (data.success) {
        toast.success(`Razorpay Connected! (${data.latencyMs}ms response)`);
      } else {
        toast.error(`Razorpay Notice: ${data.message}`);
      }
    } catch {
      toast.error("Failed to connect to Razorpay API");
    } finally {
      setIsTestingRazorpay(false);
    }
  };

  const handleRemoveRazorpay = async () => {
    if (!window.confirm("Are you sure you want to remove and disconnect the saved Razorpay credentials?")) {
      return;
    }
    const updatedConfig = {
      ...config,
      razorpay_key_id: "",
      razorpay_key_secret: "",
      razorpay_webhook_secret: "",
    };
    setConfig(updatedConfig);
    setIsEditingRazorpay(true);
    setRazorpayTestResult(null);

    try {
      await fetch("/api/payments/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });
      toast.success("Razorpay credentials removed successfully.");
    } catch {
      toast.error("Failed to remove credentials from server.");
    }
  };

  const handleRemoveStripe = async () => {
    if (!window.confirm("Are you sure you want to remove and disconnect the saved Stripe credentials?")) {
      return;
    }
    const updatedConfig = {
      ...config,
      stripe_publishable_key: "",
      stripe_secret_key: "",
      stripe_webhook_secret: "",
    };
    setConfig(updatedConfig);
    setIsEditingStripe(true);

    try {
      await fetch("/api/payments/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });
      toast.success("Stripe credentials removed successfully.");
    } catch {
      toast.error("Failed to remove credentials from server.");
    }
  };

  const [origin, setOrigin] = useState("https://blue-monkey-950817.hostingersite.com");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = `${origin}/api/payments/webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    toast.success("Payment Webhook URL copied to clipboard!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

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
        setIsEditingRazorpay(!data.config.razorpay_key_id);
        setIsEditingStripe(!data.config.stripe_publishable_key);
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
        if (config.razorpay_key_id) {
          setIsEditingRazorpay(false);
        }
        if (config.stripe_publishable_key) {
          setIsEditingStripe(false);
        }

        if (typeof window !== 'undefined') {
          try {
            const profile = getRuntimeHospitalProfile();
            const consFee = Number(config.default_consultation_fee) || 500;
            const advFee = Number(config.booking_fee ?? config.default_advance_token_fee) || 100;
            saveHospitalProfile({ 
              ...profile, 
              consultationFee: consFee,
              advanceTokenFee: advFee,
              clinicBalanceFee: Math.max(0, consFee - advFee),
            });
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
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-blue-500/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-foreground">Razorpay API Credentials</h3>
                    {config.razorpay_key_id && !isEditingRazorpay && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active & Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {config.razorpay_key_id && !isEditingRazorpay
                      ? "Your Razorpay live credentials are saved and active for payments."
                      : "Enter your Razorpay Key ID and Secret from your Razorpay Dashboard."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestRazorpay}
                  disabled={isTestingRazorpay || (!config.razorpay_key_id && isEditingRazorpay)}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 shadow-xs"
                >
                  {isTestingRazorpay ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>Test Connection</span>
                </Button>

                {config.razorpay_key_id && !isEditingRazorpay ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingRazorpay(true)}
                      className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 shadow-xs"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Update Key</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveRazorpay}
                      className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 shadow-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </Button>
                  </>
                ) : (
                  config.razorpay_key_id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingRazorpay(false)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  )
                )}
              </div>
            </div>

            {razorpayTestResult && (
              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                razorpayTestResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {razorpayTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                    <span>Razorpay API: {razorpayTestResult.success ? 'HEALTHY & CONNECTED' : 'CONNECTION NOTICE'}</span>
                  </span>
                  <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-background/80 border">
                    {razorpayTestResult.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px]">{razorpayTestResult.message}</p>
              </div>
            )}

            {/* SAVED VIEW (Read-Only Connected Summary) */}
            {config.razorpay_key_id && !isEditingRazorpay ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Key ID Card */}
                  <div className="p-3 rounded-xl bg-background/90 border border-blue-500/20 space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Configured Key ID
                      </span>
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
                        {config.razorpay_key_id.startsWith("rzp_live_") ? "Live API" : "Test API"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-foreground truncate">
                        {config.razorpay_key_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(config.razorpay_key_id || "")}
                        className="text-muted-foreground hover:text-foreground p-1 shrink-0 transition-colors"
                        title="Copy Key ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Key Secret Card */}
                  <div className="p-3 rounded-xl bg-background/90 border border-blue-500/20 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Key Secret
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        ••••••••••••••••••••
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Saved & Encrypted
                      </span>
                    </div>
                  </div>

                  {/* Webhook Secret Card */}
                  <div className="p-3 rounded-xl bg-background/90 border border-blue-500/20 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Webhook Verification
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-medium text-foreground truncate">
                        {config.razorpay_webhook_secret ? "Configured (whsec_...)" : "Optional / Default"}
                      </span>
                      {config.razorpay_webhook_secret && (
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Webhook URL bar */}
                <div className="p-2.5 rounded-xl bg-background/90 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold text-foreground">Razorpay Webhook URL:</p>
                    <code className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold break-all">
                      {webhookUrl}
                    </code>
                    <p className="text-[10px] text-muted-foreground">
                      Events to subscribe: <code>payment_link.paid</code>, <code>payment.captured</code>, <code>order.paid</code>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="shrink-0 text-xs h-7 gap-1"
                  >
                    {copiedWebhook ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedWebhook ? "Copied" : "Copy URL"}</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* EDIT / SETUP FORM VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Key ID (API Key)</Label>
                  <Input
                    placeholder="rzp_test_... or rzp_live_..."
                    value={config.razorpay_key_id || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, razorpay_key_id: e.target.value.trim() }))}
                    className="font-mono text-xs bg-background"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">Found under Razorpay Dashboard → Settings → API Keys</p>
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
                    placeholder={config.razorpay_key_secret?.startsWith('••') ? "Leave blank or enter new Key Secret" : "Enter Razorpay Key Secret"}
                    value={config.razorpay_key_secret || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, razorpay_key_secret: e.target.value.trim() }))}
                    className="font-mono text-xs bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground">Generated once when API Key is created</p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[11px] font-semibold">Webhook Secret (Optional for signature verification)</Label>
                  <Input
                    placeholder="e.g. whsec_..."
                    value={config.razorpay_webhook_secret || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, razorpay_webhook_secret: e.target.value.trim() }))}
                    className="font-mono text-xs bg-background"
                  />
                  <div className="mt-2 p-2.5 rounded-lg bg-background/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold text-foreground">Razorpay Webhook URL:</p>
                      <code className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold break-all">
                        {webhookUrl}
                      </code>
                      <p className="text-[10px] text-muted-foreground">
                        Events to subscribe: <code>payment_link.paid</code>, <code>payment.captured</code>, <code>order.paid</code>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl)}
                      className="shrink-0 text-xs h-7 gap-1"
                    >
                      {copiedWebhook ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedWebhook ? "Copied" : "Copy URL"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-indigo-500/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-foreground">Stripe API Keys</h3>
                    {config.stripe_publishable_key && !isEditingStripe && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active & Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {config.stripe_publishable_key && !isEditingStripe
                      ? "Your Stripe API credentials are saved and active."
                      : "Enter your Stripe Publishable and Secret Keys."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {config.stripe_publishable_key && !isEditingStripe ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingStripe(true)}
                      className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 shadow-xs"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Update Key</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveStripe}
                      className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 shadow-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </Button>
                  </>
                ) : (
                  config.stripe_publishable_key && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStripe(false)}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* SAVED VIEW (Read-Only Connected Summary) */}
            {config.stripe_publishable_key && !isEditingStripe ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Publishable Key */}
                  <div className="p-3 rounded-xl bg-background/90 border border-indigo-500/20 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Publishable Key
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-foreground truncate">
                        {config.stripe_publishable_key}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(config.stripe_publishable_key || "")}
                        className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                        title="Copy Publishable Key"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Secret Key */}
                  <div className="p-3 rounded-xl bg-background/90 border border-indigo-500/20 space-y-1 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Secret Key
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        ••••••••••••••••••••
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Saved & Encrypted
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-background/90 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold text-foreground">Stripe Webhook URL:</p>
                    <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold break-all">
                      {webhookUrl}
                    </code>
                    <p className="text-[10px] text-muted-foreground">
                      Events to subscribe: <code>checkout.session.completed</code>, <code>payment_intent.succeeded</code>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(webhookUrl)}
                    className="shrink-0 text-xs h-7 gap-1"
                  >
                    {copiedWebhook ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedWebhook ? "Copied" : "Copy URL"}</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* EDIT STRIPE FORM */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Publishable Key</Label>
                  <Input
                    placeholder="pk_test_... or pk_live_..."
                    value={config.stripe_publishable_key || ""}
                    onChange={(e) => setConfig((p) => ({ ...p, stripe_publishable_key: e.target.value.trim() }))}
                    className="font-mono text-xs bg-background"
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
                    onChange={(e) => setConfig((p) => ({ ...p, stripe_secret_key: e.target.value.trim() }))}
                    className="font-mono text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="mt-2 p-2.5 rounded-lg bg-background/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold text-foreground">Stripe Webhook URL:</p>
                      <code className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold break-all">
                        {webhookUrl}
                      </code>
                      <p className="text-[10px] text-muted-foreground">
                        Events to subscribe: <code>checkout.session.completed</code>, <code>payment_intent.succeeded</code>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl)}
                      className="shrink-0 text-xs h-7 gap-1"
                    >
                      {copiedWebhook ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedWebhook ? "Copied" : "Copy URL"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pricing & Booking Rules */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground">Appointment Consultation & Booking Fees</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Consultation Fee */}
            <div className="space-y-1.5 text-xs">
              <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span>1. Doctor Consultation Fee (₹)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Quoted by AI</span>
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
                  value={config.default_consultation_fee ?? 500}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig((p) => ({
                      ...p,
                      default_consultation_fee: val,
                    }));
                  }}
                  className="pl-7 text-xs font-semibold"
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                The full doctor consultation fee quoted when a patient asks about consultation charges on WhatsApp (e.g. ₹500).
              </p>
            </div>

            {/* Advance Booking Fee */}
            <div className="space-y-1.5 text-xs">
              <Label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                <span>2. Advance Booking Fee (₹)</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Razorpay Link Amount</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-xs">
                  ₹
                </span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="100"
                  value={config.booking_fee ?? config.default_advance_token_fee ?? 100}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig((p) => ({
                      ...p,
                      booking_fee: val,
                      default_advance_token_fee: val,
                    }));
                  }}
                  className="pl-7 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                The exact token amount charged via Razorpay payment links to confirm and lock the appointment slot (e.g. ₹100).
              </p>
            </div>
          </div>

          {/* Balance breakdown callout */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Clinic Balance Payable on Arrival:
            </span>
            <span className="font-bold text-foreground">
              ₹{Math.max(0, (config.default_consultation_fee ?? 500) - (config.booking_fee ?? config.default_advance_token_fee ?? 100))}
            </span>
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
