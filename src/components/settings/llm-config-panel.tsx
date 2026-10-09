"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Layers,
  Cloud,
  Database,
  Edit3,
  List,
  RefreshCw,
  Search,
  CheckCheck,
  Pencil,
  Trash2,
  Lock,
  X,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ModelItem {
  id: string;
  name: string;
  tag: string;
  description?: string;
  contextWindow?: number;
}

interface ProviderMeta {
  id: LLMProvider;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  defaultModel: string;
  models: ModelItem[];
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
    defaultModel: 'gemini-3.5-flash',
    models: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tag: 'Recommended (Fast & Stable)' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', tag: 'Next-Gen Intelligence' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Ultra Low Latency' },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest', tag: 'Production Optimized' },
    ],
    keyPlaceholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    docsLabel: 'Get Free Gemini API Key at Google AI Studio',
    icon: '🌟'
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o / o3)',
    badge: 'Popular',
    badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
    description: 'Flagship GPT-4o and reasoning models with natural conversational fluency.',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Affordable (Recommended)' },
      { id: 'gpt-4o', name: 'GPT-4o Flagship', tag: 'Highest Quality & Vision' },
      { id: 'o3-mini', name: 'o3-mini', tag: 'High-Speed STEM & Logic' },
      { id: 'o1', name: 'o1 Reasoning', tag: 'Deep Scientific Reasoning' },
      { id: 'o1-mini', name: 'o1-mini', tag: 'Fast Reasoning' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Complex Multi-step Instructions' },
      { id: 'gpt-4', name: 'GPT-4', tag: 'Legacy Flagship' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', tag: 'Legacy Fast' },
      { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', tag: 'Dynamic Continuous Rollout' },
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
    defaultModel: 'claude-3-7-sonnet-20250219',
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybrid Reasoning & Speed (Newest)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (v2)', tag: 'Top-Tier Intelligence' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Sub-Second Speed' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Deep Analytical' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', tag: 'Fast & Lightweight' },
    ],
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabel: 'Get API Key at Anthropic Console',
    icon: '🧠'
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Llama 3.3 / DeepSeek)',
    badge: 'Ultra Low Latency',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    description: 'Blazing fast inference on Groq LPUs running state-of-the-art open source models.',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Top Open Model (Recommended)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: 'Sub-300ms Ultra Fast' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', tag: 'Open Reasoning' },
      { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B', tag: 'Fast Reasoning' },
      { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', tag: 'Code & Structured Output' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'MoE 32k Context' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', tag: 'Google Open Weights' },
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
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', tag: 'Cost Efficient & Powerful' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoning)', tag: 'Chain of Thought' },
      { id: 'qwen2.5:72b', name: 'Qwen 2.5 72B', tag: 'High Performance Multilingual' },
      { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B', tag: 'Precise Logic' },
      { id: 'llama3.3:latest', name: 'Llama 3.3 (Local)', tag: 'Ollama Local' },
      { id: 'mistral:latest', name: 'Mistral 7B (Local)', tag: 'Ollama Fast' },
      { id: 'phi3:latest', name: 'Phi-3 Mini (Local)', tag: 'Lightweight Local' },
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
  const [model, setModel] = useState(llmConfig.model || 'gemini-3.5-flash');
  const [customBaseUrl, setCustomBaseUrl] = useState(llmConfig.customBaseUrl || 'http://localhost:11434/v1');
  const [temperature, setTemperature] = useState(llmConfig.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(llmConfig.maxTokens ?? 1024);

  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; responseTime?: number } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(false);
  const [maskedServerKey, setMaskedServerKey] = useState<string | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);

  // Live models state
  const [liveModels, setLiveModels] = useState<Record<string, ModelItem[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Fetch online saved configuration from Supabase DB on mount
  useEffect(() => {
    fetch('/api/ai/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.isConfigured || data.hasApiKey)) {
          if (data.provider) setProvider(data.provider);
          if (data.model) {
            const isOldGemini = data.model.includes('2.5') || data.model.includes('2.0') || data.model.includes('1.5') || data.model.includes('preview');
            const safeModel = (data.provider === 'gemini' && isOldGemini) ? 'gemini-3.5-flash' : data.model;
            setModel(safeModel);
          }
          if (data.customBaseUrl) setCustomBaseUrl(data.customBaseUrl);
          if (typeof data.temperature === 'number') setTemperature(data.temperature);
          if (typeof data.maxTokens === 'number') setMaxTokens(data.maxTokens);
          if (data.maskedApiKey) {
            setMaskedServerKey(data.maskedApiKey);
            setIsEditingKey(false);
          }
          setCloudLoaded(true);
        } else {
          setIsEditingKey(true);
        }
      })
      .catch((err) => console.warn('[AI Config Fetch Error]:', err));
  }, []);

  // Sync from props if local changes occur
  useEffect(() => {
    if (llmConfig && !cloudLoaded) {
      setProvider(llmConfig.provider || 'gemini');
      if (llmConfig.apiKey) {
        setApiKey(llmConfig.apiKey);
        setIsEditingKey(false);
      }
      const isOldGemini = (llmConfig.model || '').includes('2.5') || (llmConfig.model || '').includes('2.0') || (llmConfig.model || '').includes('1.5') || (llmConfig.model || '').includes('preview');
      const safeModel = (llmConfig.provider === 'gemini' && isOldGemini) ? 'gemini-3.5-flash' : (llmConfig.model || 'gemini-3.5-flash');
      setModel(safeModel);
      setCustomBaseUrl(llmConfig.customBaseUrl || 'http://localhost:11434/v1');
      setTemperature(llmConfig.temperature ?? 0.7);
      setMaxTokens(llmConfig.maxTokens ?? 1024);
    }
  }, [llmConfig, cloudLoaded]);

  const activeMeta = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  const currentProviderLiveModels = liveModels[provider] || [];
  const currentModelsList = currentProviderLiveModels.length > 0 ? currentProviderLiveModels : activeMeta.models;

  const filteredModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return currentModelsList;
    const q = modelSearchQuery.toLowerCase().trim();
    return currentModelsList.filter(
      m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q)
    );
  }, [currentModelsList, modelSearchQuery]);

  const isModelInPresets = currentModelsList.some(m => m.id === model);

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const meta = PROVIDERS.find(p => p.id === newProvider) || PROVIDERS[0];
    const live = liveModels[newProvider];
    if (live && live.length > 0) {
      setModel(live[0].id);
    } else {
      setModel(meta.defaultModel);
    }
    setIsCustomModelInput(false);
    setTestResult(null);
    setFetchNotice(null);
  };

  // Fetch all live available models from provider API
  const handleFetchLiveModels = async () => {
    const keyToUse = apiKey.trim() || (maskedServerKey ? 'USE_SERVER_SAVED_KEY' : '');
    if (!keyToUse && provider !== 'custom') {
      setFetchNotice('⚠️ Please enter an API key first to fetch models.');
      setTimeout(() => setFetchNotice(null), 4000);
      return;
    }

    setIsFetchingModels(true);
    setFetchNotice(null);

    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          customBaseUrl: provider === 'custom' ? customBaseUrl : undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
        setLiveModels(prev => ({
          ...prev,
          [provider]: data.models
        }));
        setFetchNotice(`✓ Loaded ${data.models.length} active models from ${activeMeta.name}!`);
        if (!data.models.some((m: ModelItem) => m.id === model)) {
          setModel(data.models[0].id);
        }
      } else {
        setFetchNotice(data.error ? `Notice: ${data.error}` : 'Could not fetch live models. Using verified presets.');
      }
    } catch (err: any) {
      setFetchNotice(`Fetch error: ${err.message || 'Network issue'}`);
    } finally {
      setIsFetchingModels(false);
      setTimeout(() => setFetchNotice(null), 5000);
    }
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim() || (maskedServerKey ? 'USE_SERVER_SAVED_KEY' : '');
    if (!keyToTest && provider !== 'custom') {
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
        toast.success(`Connected to ${activeMeta.name}! (${data.responseTimeMs || 100}ms response)`);
        if (!liveModels[provider] || liveModels[provider].length === 0) {
          handleFetchLiveModels();
        }
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed. Please check your API key and permissions.'
        });
        toast.error(`AI Connection Notice: ${data.error || 'Check key and permissions'}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while contacting AI endpoint.'
      });
      toast.error('Network error testing AI endpoint');
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!window.confirm(`Are you sure you want to remove and disconnect the saved ${activeMeta.name} API key?`)) {
      return;
    }
    setApiKey('');
    setMaskedServerKey(null);
    setIsEditingKey(true);
    setTestResult(null);

    setLLMConfig({
      apiKey: '',
      isConfigured: false,
    });

    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: '',
          model,
          customBaseUrl,
          temperature,
          maxTokens
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${activeMeta.name} API Key removed successfully.`);
      }
    } catch {
      toast.error('Failed to remove API key from server');
    }
  };

  const handleSave = async () => {
    const isConfiguredNow = !!(apiKey.trim() || maskedServerKey);
    const updated: Partial<LLMConfig> = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || activeMeta.defaultModel,
      customBaseUrl: provider === 'custom' ? customBaseUrl.trim() : undefined,
      temperature,
      maxTokens,
      isConfigured: isConfiguredNow
    };

    setLLMConfig(updated);

    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (apiKey.trim()) {
          const keyStr = apiKey.trim();
          setMaskedServerKey(keyStr.length > 10 ? `${keyStr.slice(0, 6)}••••••••${keyStr.slice(-4)}` : '••••••••••••');
        }
        if (apiKey.trim() || maskedServerKey) {
          setIsEditingKey(false);
        }
        toast.success(`${activeMeta.name} configuration saved successfully!`);
      }
    } catch (e) {
      console.warn('[Server AI Config Sync Notice]:', e);
      toast.error('Failed to sync AI configuration with server');
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    resetLLMConfig();
    setProvider('gemini');
    setApiKey('');
    setMaskedServerKey(null);
    setIsEditingKey(true);
    setModel('gemini-3.5-flash');
    setIsCustomModelInput(false);
    setCustomBaseUrl('http://localhost:11434/v1');
    setTemperature(0.7);
    setMaxTokens(1024);
    setTestResult(null);
    setFetchNotice(null);
  };

  const hasSavedKey = !!(maskedServerKey || apiKey.trim());

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h4 className="text-base font-semibold text-foreground">LLM Provider & API Key Manager</h4>
            {hasSavedKey || llmConfig.isConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Cloud className="h-3 w-3" /> Cloud Synced & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Using Built-in Presets
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Choose your AI engine and enter your LLM API Key. Once saved, it is encrypted and persisted in your online database across all devices and team accounts.
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
        
        {/* SAVED & CONNECTED SUMMARY CARD */}
        {hasSavedKey && !isEditingKey ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-foreground">
                      {activeMeta.name} API Key
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      API Key Added & Active
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Your {activeMeta.name} credentials are encrypted and stored in your online database.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-xs"
                >
                  {isTesting ? (
                    <Activity className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>Test Connection</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingKey(true)}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Update Key</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveApiKey}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30 shadow-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Remove Key</span>
                </Button>
              </div>
            </div>

            {/* Masked Key Display Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-background/90 border border-emerald-500/20 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Configured API Key
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Encrypted
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-foreground truncate">
                  {maskedServerKey || (apiKey ? `${apiKey.slice(0, 6)}••••••••${apiKey.slice(-4)}` : '••••••••••••••••••••')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background/90 border border-emerald-500/20 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Selected Model
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                    {activeMeta.name}
                  </span>
                </div>
                <div className="font-semibold text-xs text-foreground truncate">
                  {model}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background/90 border border-emerald-500/20 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Status
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Live Active
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  Ready for AI WhatsApp Chatbot & CRM
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT / ENTER KEY VIEW */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-primary" />
                {activeMeta.name} API Key
              </Label>
              <div className="flex items-center gap-2">
                {hasSavedKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingKey(false)}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
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
                placeholder={maskedServerKey ? `Active Database Key: ${maskedServerKey} (Enter new key to change)` : activeMeta.keyPlaceholder}
                className="pr-20 font-mono text-xs bg-background h-10 border-border"
                autoFocus={isEditingKey}
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
              Your key will be encrypted and saved to your Supabase online database so all hospital devices use this key automatically.
            </p>
          </div>
        )}

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

        {/* Model Selection with Live Fetch */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="modelSelect" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                AI Model Selection
              </Label>
              {currentProviderLiveModels.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCheck className="h-3 w-3" /> {currentProviderLiveModels.length} Models on Key
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {activeMeta.models.length} Preset Models
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFetchLiveModels}
                disabled={isFetchingModels || (!apiKey.trim() && !maskedServerKey && provider !== 'custom')}
                className="h-7 px-2.5 text-[11px] font-medium gap-1 text-primary border-primary/30 hover:bg-primary/10"
                title="Fetch all available models directly from your API key"
              >
                <RefreshCw className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                {isFetchingModels ? 'Fetching Models...' : 'Fetch All Models from API Key'}
              </Button>

              <button
                type="button"
                onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium ml-1"
              >
                {isCustomModelInput ? (
                  <>
                    <List className="h-3 w-3" /> Presets
                  </>
                ) : (
                  <>
                    <Edit3 className="h-3 w-3" /> Custom ID
                  </>
                )}
              </button>
            </div>
          </div>

          {fetchNotice && (
            <div className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary flex items-center gap-1.5 animate-in fade-in duration-150">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>{fetchNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isCustomModelInput ? (
              <div className="space-y-1.5">
                <Input
                  id="customModelInput"
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={`e.g. ${activeMeta.defaultModel}`}
                  className="font-mono text-xs bg-background h-10 border-border"
                />
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground pt-1">
                  <span>Quick Presets:</span>
                  {activeMeta.models.slice(0, 5).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        model === m.id
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-muted/40 hover:bg-muted text-foreground'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <select
                  id="modelSelect"
                  value={isModelInPresets ? model : '__custom_other__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom_other__') {
                      setIsCustomModelInput(true);
                    } else {
                      setModel(e.target.value);
                      setTestResult(null);
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-1.5 focus:ring-primary h-10"
                >
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.tag ? `(${m.tag})` : ''}
                    </option>
                  ))}
                  {!isModelInPresets && (
                    <option value="__custom_other__">
                      Custom Model: {model}
                    </option>
                  )}
                  <option value="__custom_other__">
                    ✏️ Enter Custom Model ID...
                  </option>
                </select>

                {/* Popular model shortcut pills */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
                  <span className="font-semibold text-foreground">Suggestions:</span>
                  {currentModelsList.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModel(m.id);
                        setTestResult(null);
                      }}
                      className={`px-2 py-0.5 rounded-full border transition-all ${
                        model === m.id
                          ? 'border-primary bg-primary/15 text-primary font-bold shadow-xs'
                          : 'border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
            disabled={isTesting || (!apiKey.trim() && !maskedServerKey)}
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
