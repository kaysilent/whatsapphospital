"use client";

import React, { useState, useEffect } from 'react';
import { 
  useDemoState, 
  LLMProvider, 
  LLMConfig, 
  defaultLLMConfig 
} from '@/hooks/use-demo-state';
import { 
  Key, 
  Cpu, 
  Sparkles, 
  Check, 
  RotateCcw, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Server,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProviderMeta {
  id: LLMProvider;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  defaultModel: string;
  models: { id: string; name: string; tag: string }[];
  keyPlaceholder: string;
  docsUrl: string;
  docsLabel: string;
  icon: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Official / Recommended',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    description: 'Ultra-fast multimodal reasoning with 1M+ token context window and high clinical accuracy.',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Fastest & Recommended' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'High Reasoning' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'High Speed' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', tag: 'Next-Gen' },
    ],
    keyPlaceholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    docsLabel: 'Get Free Gemini API Key at Google AI Studio',
    icon: '🌟'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    badge: 'Popular',
    badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
    description: 'Flagship GPT-4o models with natural conversational fluency and function calling.',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Affordable' },
      { id: 'gpt-4o', name: 'GPT-4o Flagship', tag: 'Highest Quality' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Complex Instructions' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tag: 'Legacy' },
    ],
    keyPlaceholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabel: 'Get API Key at OpenAI Platform',
    icon: '⚡'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Nuanced Reasoning',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
    description: 'Human-like clinical empathy, safe reasoning boundaries, and patient-first nuance.',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Top-Tier Intelligence' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tag: 'Sub-Second Speed' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Deep Analytical' },
    ],
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabel: 'Get API Key at Anthropic Console',
    icon: '🧠'
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Llama 3.3)',
    badge: 'Ultra Low Latency',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    description: 'Blazing fast inference on Groq LPUs running state-of-the-art open source models.',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Top Open Model' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: 'Sub-300ms' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'MoE 32k Context' },
    ],
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    docsLabel: 'Get Free Groq API Key',
    icon: '🚀'
  },
  {
    id: 'custom',
    name: 'Custom / Ollama / DeepSeek',
    badge: 'Self-Hosted / Compatible',
    badgeColor: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400',
    description: 'Connect any OpenAI-compatible LLM endpoint (Ollama, DeepSeek, LocalAI, vLLM, Azure).',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', tag: 'Cost Efficient' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoning)', tag: 'Chain of Thought' },
      { id: 'custom-model', name: 'Custom Local Model', tag: 'Ollama / vLLM' },
    ],
    keyPlaceholder: 'Bearer token or API Key...',
    docsUrl: 'https://ollama.ai',
    docsLabel: 'Ollama / Custom API Documentation',
    icon: '⚙️'
  }
];

export function LlmConfigPanel() {
  const { llmConfig = defaultLLMConfig, setLLMConfig, resetLLMConfig } = useDemoState();

  const [provider, setProvider] = useState<LLMProvider>(llmConfig.provider || 'gemini');
  const [apiKey, setApiKey] = useState(llmConfig.apiKey || '');
  const [model, setModel] = useState(llmConfig.model || 'gemini-2.5-flash');
  const [customBaseUrl, setCustomBaseUrl] = useState(llmConfig.customBaseUrl || 'http://localhost:11434/v1');
  const [temperature, setTemperature] = useState(llmConfig.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(llmConfig.maxTokens ?? 1024);

  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; responseTime?: number } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync from props
  useEffect(() => {
    if (llmConfig) {
      setProvider(llmConfig.provider || 'gemini');
      setApiKey(llmConfig.apiKey || '');
      setModel(llmConfig.model || 'gemini-2.5-flash');
      setCustomBaseUrl(llmConfig.customBaseUrl || 'http://localhost:11434/v1');
      setTemperature(llmConfig.temperature ?? 0.7);
      setMaxTokens(llmConfig.maxTokens ?? 1024);
    }
  }, [llmConfig]);

  const activeMeta = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const meta = PROVIDERS.find(p => p.id === newProvider) || PROVIDERS[0];
    setModel(meta.defaultModel);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter an API Key first before testing the connection.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          model,
          customBaseUrl: provider === 'custom' ? customBaseUrl : undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || `Successfully connected to ${activeMeta.name}!`,
          responseTime: data.responseTimeMs
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed. Please check your API key and permissions.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while contacting AI endpoint.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const updated: Partial<LLMConfig> = {
      provider,
      apiKey: apiKey.trim(),
      model,
      customBaseUrl: provider === 'custom' ? customBaseUrl.trim() : undefined,
      temperature,
      maxTokens,
      isConfigured: !!apiKey.trim()
    };

    setLLMConfig(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    resetLLMConfig();
    setProvider('gemini');
    setApiKey('');
    setModel('gemini-2.5-flash');
    setCustomBaseUrl('http://localhost:11434/v1');
    setTemperature(0.7);
    setMaxTokens(1024);
    setTestResult(null);
  };

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h4 className="text-base font-semibold text-foreground">LLM Provider & API Key Manager</h4>
            {llmConfig.isConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Configured & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Using Built-in Presets
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Choose your AI engine and enter your LLM API Key (Google Gemini, OpenAI, Claude, Groq, or Custom Endpoint).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Defaults
          </Button>
        </div>
      </div>

      {/* 1. Provider Cards Grid */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Select LLM Provider</span>
          <span className="text-[11px] text-muted-foreground font-normal">Switch engines anytime without losing data</span>
        </Label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PROVIDERS.map((p) => {
            const isSelected = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1.5 ring-primary/30 shadow-xs'
                    : 'border-border bg-muted/15 hover:bg-muted/30 hover:border-border/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <span className="text-sm">{p.icon}</span>
                      {p.name}
                    </span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Default: <strong>{p.defaultModel}</strong></span>
                  {isSelected && <span className="font-bold text-primary flex items-center gap-0.5">● Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. API Key & Model Configuration */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 sm:p-5 space-y-4">
        {/* API Key Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="apiKey" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-primary" />
              {activeMeta.name} API Key
            </Label>
            <a
              href={activeMeta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <span>{activeMeta.docsLabel}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          <div className="relative flex items-center">
            <Input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={activeMeta.keyPlaceholder}
              className="pr-20 font-mono text-xs bg-background h-10 border-border"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Your key is safely stored locally in browser storage and only transmitted securely over HTTPS directly to the AI provider.
          </p>
        </div>

        {/* Custom Endpoint URL (if Custom provider) */}
        {provider === 'custom' && (
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <Label htmlFor="customBaseUrl" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-primary" />
              Custom Base URL / Endpoint
            </Label>
            <Input
              id="customBaseUrl"
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1 or https://api.deepseek.com/v1"
              className="font-mono text-xs bg-background h-10 border-border"
            />
            <p className="text-[11px] text-muted-foreground">
              Supports standard OpenAI-compatible endpoints (Ollama, vLLM, DeepSeek, LocalAI).
            </p>
          </div>
        )}

        {/* Model Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="space-y-1.5">
            <Label htmlFor="modelSelect" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              AI Model
            </Label>
            <select
              id="modelSelect"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-1.5 focus:ring-primary h-10"
            >
              {activeMeta.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.tag})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                Parameters
              </Label>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                {showAdvanced ? 'Hide Advanced' : 'Tune Temperature & Tokens'}
              </button>
            </div>
            <div className="h-10 px-3 flex items-center justify-between rounded-md border border-border bg-background/50 text-xs text-muted-foreground">
              <span>Temp: <strong>{temperature}</strong></span>
              <span>Max Output: <strong>{maxTokens} tokens</strong></span>
            </div>
          </div>
        </div>

        {/* Advanced Sliders (Collapsible) */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg border border-border/70 bg-background/70 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Temperature (Creativity)</span>
                <span className="font-mono text-primary">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground">0.1 = Strict/Deterministic • 0.7 = Natural Clinic Assistant</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Max Output Tokens</span>
                <span className="font-mono text-primary">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="256"
                max="4096"
                step="128"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-muted-foreground">Controls maximum length of generated WhatsApp replies</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Live Test Result Banner */}
      {testResult && (
        <div
          className={`rounded-xl border p-3.5 flex items-start gap-3 text-xs animate-in fade-in duration-200 ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">
              {testResult.success ? 'API Connection Verified' : 'API Connection Error'}
            </p>
            <p className="leading-relaxed opacity-90">{testResult.message}</p>
            {testResult.responseTime && (
              <p className="text-[11px] opacity-75 font-mono">
                Latency: {testResult.responseTime}ms
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Active LLM powers live responses in the WhatsApp AI Simulator and CRM inbox.</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey.trim()}
            className="h-9 px-4 text-xs font-semibold gap-1.5 flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/10"
          >
            {isTesting ? (
              <>
                <Activity className="h-3.5 w-3.5 animate-spin" />
                Testing Key...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Test API Key
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            className={`h-9 px-5 text-xs font-semibold shadow-xs transition-all gap-1.5 flex-1 sm:flex-none ${
              isSaved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                LLM Key Saved!
              </>
            ) : (
              <>
                <Key className="h-3.5 w-3.5" />
                Save LLM Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
