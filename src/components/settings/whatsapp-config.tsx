'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  Phone,
  ShieldCheck,
  LogOut,
  Edit3,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const supabase = createClient();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [phoneInfo, setPhoneInfo] = useState<{
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function handleCopyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  }
  // Guards against re-hydrating the form when the load effect below
  // re-runs for reasons unrelated to actually switching accounts —
  // e.g. Supabase's onAuthStateChange fires a token refresh (new
  // `user` object, profileLoading flips true/false) when the browser
  // tab regains focus. Without this, that churn calls fetchConfig()
  // again and overwrites whatever the user typed but hadn't saved yet.
  const loadedAccountIdRef = useRef<string | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // True once /register has succeeded on Meta's side (timestamp set
  // in the row). When false, the saved config is metadata-only and
  // Meta will silently drop every inbound event — that's the
  // multi-number bug that prompted this work.
  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (_acctId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'GET', cache: 'no-store' });
      const payload = await res.json();

      if (payload.config) {
        setConfig(payload.config);
        setPhoneNumberId(payload.config.phone_number_id || '');
        setWabaId(payload.config.waba_id || '');
        setAccessToken(payload.config.has_access_token ? MASKED_TOKEN : '');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
      }
      setRegistrationProbe(null);

      if (payload.phone_info) {
        setPhoneInfo(payload.phone_info);
      } else {
        setPhoneInfo(null);
      }

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
      } else {
        setConnectionStatus('disconnected');
        setResetReason(
          payload.needs_reset
            ? 'token_corrupted'
            : payload.reason === 'meta_api_error'
            ? 'meta_api_error'
            : null
        );
        setStatusMessage(payload.message || '');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfig]);

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited || accessToken === MASKED_TOKEN)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        pin: pin.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      if (data.config) {
        setConfig(data.config);
        setPhoneNumberId(data.config.phone_number_id || phoneNumberId);
        setWabaId(data.config.waba_id || wabaId);
        setAccessToken(MASKED_TOKEN);
        setTokenEdited(false);
        setConnectionStatus(data.connected !== false ? 'connected' : 'disconnected');
        setStatusMessage('');
        if (data.phone_info) {
          setPhoneInfo(data.phone_info);
        }
        setIsEditing(false);
      }

      if (data.registered === false && data.registration_error) {
        toast.error(
          `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          { duration: 12000 },
        );
      } else if (data.registration_skipped) {
        toast.success(
          'WhatsApp credentials saved and connected successfully!',
          { duration: 8000 },
        );
        setPin('');
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? `Live — ${data.phone_info.verified_name} is connected.`
            : 'WhatsApp connected successfully.',
        );
        setPin('');
      }

      if (accountId) {
        setTimeout(() => {
          fetchConfig(accountId);
        }, 300);
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);

      const hasTypedCredentials = Boolean(phoneNumberId.trim()) && Boolean(accessToken.trim()) && accessToken !== MASKED_TOKEN;
      
      // If user entered credentials in the form, test them directly against Meta before saving
      if (hasTypedCredentials) {
        const res = await fetch('/api/whatsapp/config/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number_id: phoneNumberId.trim(),
            access_token: accessToken.trim(),
          }),
        });
        const data = await res.json();
        if (data.success && data.connected) {
          setConnectionStatus('connected');
          setResetReason(null);
          if (data.phone_info) setPhoneInfo(data.phone_info);
          setStatusMessage(data.message || `Meta credentials verified! Connected to ${data.phone_info?.verified_name || data.phone_info?.display_phone_number || 'WhatsApp Business'}`);
          toast.success(data.message || `Meta credentials verified! Connected to ${data.phone_info?.verified_name || 'WhatsApp Business'}`);
        } else {
          setConnectionStatus('disconnected');
          setStatusMessage(data.error || 'Connection failed');
          toast.error(data.error || 'Meta API rejected credentials');
        }
        return;
      }

      if (!config) {
        toast.error('Please enter your Phone Number ID and Permanent Access Token to test connection');
        return;
      }

      // Otherwise test existing saved DB credentials
      const res = await fetch('/api/whatsapp/config', { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        if (payload.phone_info) setPhoneInfo(payload.phone_info);
        setStatusMessage('');
        toast.success(
          payload.phone_info?.verified_name
            ? `Connected to ${payload.phone_info.verified_name}`
            : 'API connection successful'
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        toast.error(payload.message || 'API connection failed');
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error('Connection test failed. Check network and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Number is fully wired — Meta is delivering events.');
      } else {
        toast.error(
          'Number is not fully registered. See the checks below for which step failed.',
          { duration: 8000 },
        );
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Could not reach the verification endpoint.');
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to log out and remove this WhatsApp account? Incoming and outgoing WhatsApp messages will be disabled until you reconnect.')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to remove WhatsApp configuration');
        return;
      }

      toast.success('WhatsApp Meta account removed and disconnected.');
      setConfig(null);
      setPhoneInfo(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setPin('');
      setTokenEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      setIsEditing(false);
      if (accountId) {
        fetchConfig(accountId);
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect WhatsApp account');
    } finally {
      setResetting(false);
    }
  }

  const handleReset = handleDisconnect;

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title={t("title")}
          description={t("description")}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Main config form */}
      <div className="space-y-6">
        {/* Corrupted-token reset banner */}
        {showResetBanner && (
          <Alert className="bg-amber-950/40 border-amber-600/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-amber-200 mb-1">
                  Stored token can&apos;t be decrypted
                </AlertTitle>
                <AlertDescription className="text-amber-100/80 text-sm">
                  {statusMessage}
                </AlertDescription>
                <Button
                  onClick={handleReset}
                  disabled={resetting}
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('resetting')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      {t('resetConfig')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Main Connected View vs Configuration Form */}
        {(() => {
          const isConnected = connectionStatus === 'connected' && Boolean(config?.phone_number_id);

          const getQualityBadge = (rating?: string) => {
            switch (rating?.toUpperCase()) {
              case 'GREEN':
                return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">High Quality (Green)</Badge>;
              case 'YELLOW':
                return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">Medium Quality (Yellow)</Badge>;
              case 'RED':
                return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-medium">Low Quality (Red)</Badge>;
              default:
                return rating ? <Badge variant="outline">{rating}</Badge> : null;
            }
          };

          if (isConnected && !isEditing) {
            return (
              <div className="space-y-6">
                {/* Connected WhatsApp Account Card */}
                <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.04] to-card overflow-hidden shadow-sm">
                  <div className="h-1.5 w-full bg-emerald-500" />
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <Phone className="size-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                              {phoneInfo?.verified_name || 'WhatsApp Business Account'}
                            </CardTitle>
                            <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                          </div>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                              WhatsApp Account is Connected & Verified with Meta
                            </span>
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleVerifyRegistration}
                          disabled={verifyingRegistration}
                          className="border-border bg-card/60 hover:bg-muted text-xs h-8"
                        >
                          {verifyingRegistration ? (
                            <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Zap className="size-3.5 mr-1.5 text-amber-500" />
                          )}
                          {t('verifyWithMeta')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="border-border bg-card/60 hover:bg-muted text-xs h-8"
                        >
                          <Edit3 className="size-3.5 mr-1.5" />
                          Edit Details
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 pt-2">
                    {/* Meta Registration Banner */}
                    {isRegistered ? (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold">
                            Registered — Meta will deliver events to this hospital CRM
                          </p>
                          <p className="text-emerald-600/90 dark:text-emerald-400/90 leading-relaxed">
                            Subscribed since{' '}
                            {config?.registered_at
                              ? new Date(config.registered_at).toLocaleString()
                              : 'now'}
                            . Inbound messages, delivery statuses, and webhooks are active.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-3">
                        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold">
                            Pending Meta Registration
                          </p>
                          <p className="text-amber-600/90 dark:text-amber-400/90 leading-relaxed">
                            Click &quot;Verify with Meta&quot; or click &quot;Edit Details&quot; to enter your 2-step verification PIN if Meta webhook messages are not arriving.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Registration Probe Diagnostics if triggered */}
                    {registrationProbe && (
                      <div className="rounded-xl border border-border bg-card/60 px-3 py-2.5 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between font-medium text-foreground">
                          <span>Diagnostic Probe:</span>
                          <span className={registrationProbe.live ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                            {registrationProbe.live ? 'LIVE & RECEIVING' : 'DIAGNOSTIC FAILED'}
                          </span>
                        </div>
                        <ul className="space-y-0.5 text-muted-foreground">
                          {Object.entries(registrationProbe.checks).map(([k, v]) => (
                            <li key={k} className="flex items-center gap-1.5">
                              {v === true ? (
                                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle className="size-3 text-red-400 shrink-0" />
                              )}
                              <code>{k}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Account Details Grid */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <Phone className="size-3.5 text-muted-foreground" />
                          Display Phone Number
                        </span>
                        <div className="text-lg font-bold tracking-tight text-foreground">
                          {phoneInfo?.display_phone_number || config?.phone_number_id}
                        </div>
                        {phoneInfo?.quality_rating && (
                          <div className="pt-1">
                            {getQualityBadge(phoneInfo.quality_rating)}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <ShieldCheck className="size-3.5 text-muted-foreground" />
                          Meta Connection Status
                        </span>
                        <div className="text-base font-semibold text-foreground flex items-center gap-1.5 pt-0.5">
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Official Meta API Connected
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Permanent Access Token verified
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                          <span>Phone Number ID</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(config?.phone_number_id || '', 'Phone Number ID')}
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]"
                          >
                            {copiedKey === 'Phone Number ID' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            {copiedKey === 'Phone Number ID' ? 'Copied' : 'Copy'}
                          </button>
                        </span>
                        <div className="font-mono text-sm font-semibold text-foreground">
                          {config?.phone_number_id}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1.5">
                        <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                          <span>WhatsApp Business Account ID</span>
                          {config?.waba_id && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(config.waba_id || '', 'WABA ID')}
                              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]"
                            >
                              {copiedKey === 'WABA ID' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                              {copiedKey === 'WABA ID' ? 'Copied' : 'Copy'}
                            </button>
                          )}
                        </span>
                        <div className="font-mono text-sm font-semibold text-foreground">
                          {config?.waba_id || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Webhook Configuration Box */}
                    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Webhook Callback URL</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyWebhookUrl}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-3.5 mr-1" />
                          Copy URL
                        </Button>
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground select-all break-all">
                        {webhookUrl}
                      </div>
                    </div>

                    {/* Bottom Disconnect / Remove Account Action */}
                    <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="text-xs text-muted-foreground">
                        Need to switch numbers or reconnect a different Meta account?
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleDisconnect}
                        disabled={resetting}
                        className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 shrink-0"
                      >
                        {resetting ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <LogOut className="size-4 mr-2" />
                            Log out / Remove Meta Account
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {/* When editing existing config */}
              {isEditing && (
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <span className="text-foreground font-medium flex items-center gap-2">
                    <Edit3 className="size-4 text-primary" />
                    Editing credentials for connected WhatsApp account
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="h-8 text-xs hover:bg-muted"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Connection Status when not editing */}
              {!isEditing && (
                <Alert className="bg-card border-border">
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'connected' ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <XCircle className="size-4 text-red-500" />
                    )}
                    <AlertTitle className="text-foreground mb-0">
                      {connectionStatus === 'connected' ? t('credentialsValid') : t('notConnected')}
                    </AlertTitle>
                  </div>
                  <AlertDescription className="text-muted-foreground">
                    {connectionStatus === 'connected'
                      ? t('connectedDesc')
                      : statusMessage ||
                        t('notConnectedDesc')}
                  </AlertDescription>
                </Alert>
              )}

              {/* API Credentials */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('apiCredentialsTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('apiCredentialsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('phoneNumberId')}</Label>
                    <Input
                      placeholder="e.g. 100234567890123"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('wabaId')}</Label>
                    <Input
                      placeholder="e.g. 100234567890456"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('accessToken')}</Label>
                    <div className="relative">
                      <Input
                        type={showToken ? 'text' : 'password'}
                        name="meta_permanent_system_token"
                        id="meta_permanent_system_token"
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder={t('accessTokenPlaceholder')}
                        value={accessToken}
                        onChange={(e) => {
                          setAccessToken(e.target.value);
                          setTokenEdited(true);
                        }}
                        onFocus={() => {
                          if (accessToken === MASKED_TOKEN) {
                            setAccessToken('');
                            setTokenEdited(true);
                          }
                        }}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {config && !tokenEdited && (
                      <p className="text-xs text-muted-foreground">
                        {t('tokenHidden')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('webhookVerifyToken')}</Label>
                    <Input
                      name="meta_webhook_verify_token"
                      id="meta_webhook_verify_token"
                      autoComplete="off"
                      placeholder={t('webhookVerifyTokenPlaceholder')}
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('webhookVerifyTokenHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">
                      {t('twoStepPin')}
                      <span className="ml-1 text-muted-foreground">{t('optional')}</span>
                    </Label>
                    <Input
                      type="text"
                      name="meta_twostep_pin"
                      id="meta_twostep_pin"
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t('pinPlaceholder')}
                      value={pin}
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span dangerouslySetInnerHTML={{ __html: t('pinHint') }} />
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Webhook URL */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">{t('webhookTitle')}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {t('webhookDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t('webhookUrl')}</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="bg-muted border-border text-muted-foreground font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyWebhookUrl}
                        className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      {t('saving')}
                    </>
                  ) : (
                    t('saveConfig')
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || (!config && (!phoneNumberId.trim() || !accessToken.trim() || accessToken === MASKED_TOKEN))}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  {testing ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      {t('testing')}
                    </>
                  ) : (
                    <>
                      <Zap className="size-4 mr-1.5" />
                      {t('testConnection')}
                    </>
                  )}
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="border-border hover:bg-muted"
                  >
                    Cancel
                  </Button>
                )}
                {config && (
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={resetting}
                    className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 ml-auto"
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <LogOut className="size-4 mr-1.5" />
                        Log out / Remove Meta Account
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Setup Instructions Sidebar */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base">{t('setupInstructions')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t('setupInstructionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                    {t('step1')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li dangerouslySetInnerHTML={{ __html: t('step1_1') }} />
                    <li>{t('step1_2')}</li>
                    <li>{t('step1_3')}</li>
                    <li>{t('step1_4')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                    {t('step2')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step2_1')}</li>
                    <li>{t('step2_2')}</li>
                    <li>{t('step2_3')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                    {t('step3')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step3_1')}</li>
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_2') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_3') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step3_4') }} />
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem className="border-border">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">4</span>
                    {t('step4')}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('step4_1')}</li>
                    <li>{t('step4_2')}</li>
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step4_3') }} />
                    <li dangerouslySetInnerHTML={{ __html: t.raw('step4_4') }} />
                    <li>{t('step4_5')}</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-4 pt-4 border-t border-border">
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                {t('metaDocs')}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </section>
  );
}
