'use client';

import { useEffect, useState, useMemo } from 'react';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, ArrowRight, RefreshCw, ExternalLink, Sparkles, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
};

const STORAGE_KEY = 'wacrm_meta_templates';

function formatToMessageTemplate(row: any): MessageTemplate {
  const rawCat = (row.category || 'Utility').toUpperCase();
  const category: 'Marketing' | 'Utility' | 'Authentication' = 
    rawCat.includes('MARKET') ? 'Marketing' :
    rawCat.includes('AUTH') ? 'Authentication' : 'Utility';

  const bodyText = row.body_text || row.body || '';

  return {
    id: row.id || `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: row.user_id || '',
    name: row.name,
    category,
    language: row.language || 'en',
    header_type: row.header_type || row.headerType || undefined,
    header_content: row.header_content || row.headerContent || undefined,
    header_handle: row.header_handle || undefined,
    header_media_url: row.header_media_url || undefined,
    body_text: bodyText,
    footer_text: row.footer_text || row.footer || undefined,
    buttons: row.buttons || undefined,
    sample_values: row.sample_values || undefined,
    status: (row.status || 'APPROVED').toUpperCase() as any,
    meta_template_id: row.meta_template_id || row.metaTemplateId || undefined,
    quality_score: row.quality_score || undefined,
    created_at: row.created_at || new Date().toISOString(),
  };
}

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step1ChooseTemplate({ selectedTemplate, onSelect, onNext, onBack }: Step1Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Marketing' | 'Utility' | 'Authentication'>('ALL');

  async function fetchTemplates(autoSyncIfEmpty = true) {
    try {
      // 1. Fetch official templates from API
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();

      let list: MessageTemplate[] = [];
      if (res.ok && Array.isArray(data.templates) && data.templates.length > 0) {
        list = data.templates
          .filter((t: any) => !t.status || t.status.toUpperCase() === 'APPROVED')
          .map(formatToMessageTemplate);
      }

      // 2. If API was empty, check localStorage cache from Templates page
      if (list.length === 0 && typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              list = parsed
                .filter((t: any) => !t.status || t.status.toUpperCase() === 'APPROVED')
                .map(formatToMessageTemplate);
            }
          }
        } catch {}
      }

      if (list.length > 0) {
        setTemplates(list);
        setError(null);
      } else if (autoSyncIfEmpty) {
        // Auto-sync from Meta directly if catalog is empty
        await handleSyncMeta(false);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chooseTemplate.errorLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Fast initial load from local cache if present
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const initialList = parsed
              .filter((t: any) => !t.status || t.status.toUpperCase() === 'APPROVED')
              .map(formatToMessageTemplate);
            setTemplates(initialList);
            setLoading(false);
          }
        }
      } catch {}
    }
    fetchTemplates(true);
  }, []);

  async function handleSyncMeta(showToast = true) {
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync templates from Meta');
      }

      if (data.templates && Array.isArray(data.templates)) {
        const synced = data.templates
          .filter((t: any) => !t.status || t.status.toUpperCase() === 'APPROVED')
          .map(formatToMessageTemplate);
        setTemplates(synced);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
          } catch {}
        }
      } else {
        await fetchTemplates(false);
      }

      if (showToast) {
        toast.success(`Synced ${data.total || data.templates?.length || 0} approved templates from Meta!`);
      }
      setError(null);
    } catch (err) {
      if (showToast) {
        toast.error(err instanceof Error ? err.message : 'Failed to sync templates');
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((tmpl) => {
      const matchesSearch = 
        tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.body_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tmpl.header_content || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'ALL' || tmpl.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [templates, searchQuery, categoryFilter]);

  if (loading && templates.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading approved Meta templates...</p>
      </div>
    );
  }

  if (error && templates.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchTemplates(true)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('chooseTemplate.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('chooseTemplate.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSyncMeta(true)}
            disabled={syncing}
            className="border-border text-foreground hover:bg-muted font-medium text-xs shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing with Meta…' : 'Sync from Meta'}
          </Button>
          <Link href="/templates" target="_blank">
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/90">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Meta Templates
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      {templates.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by name or content..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['ALL', 'Marketing', 'Utility'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat === 'ALL' ? 'All Templates' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('chooseTemplate.noTemplates')}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {t('chooseTemplate.createFirst')}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleSyncMeta(true)}
              disabled={syncing}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Approved Templates
            </Button>
            <Link href="/templates" target="_blank">
              <Button size="sm" variant="outline" className="border-border">
                Create in Templates Manager
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-xs text-muted-foreground">No templates match &quot;{searchQuery}&quot;</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
            className="mt-2 text-xs text-primary"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[480px] overflow-y-auto pr-1">
          {filteredTemplates.map((tmpl) => {
            const isSelected = selectedTemplate?.id === tmpl.id || selectedTemplate?.name === tmpl.name;
            const catColor = categoryColors[tmpl.category] ?? categoryColors.Utility;

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => onSelect(tmpl)}
                className={`flex flex-col gap-2.5 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-600 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-border bg-card/60 hover:border-primary/50 hover:bg-card shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-foreground truncate">{tmpl.name}</h3>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                  >
                    {tmpl.category}
                  </span>
                </div>
                {tmpl.header_content && (
                  <p className="text-[11px] font-semibold text-foreground/80 line-clamp-1">
                    {tmpl.header_content}
                  </p>
                )}
                <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {tmpl.body_text}
                </p>
                <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Language: {tmpl.language ?? 'en'}</span>
                  {isSelected ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Selected</span>
                  ) : (
                    <span className="text-muted-foreground/70">Click to Select</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack} className="border-border text-muted-foreground">
          {t('back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
        >
          {t('next')}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
