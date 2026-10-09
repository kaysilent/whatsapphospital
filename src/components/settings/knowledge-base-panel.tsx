"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  useDemoState, 
  KnowledgeItem, 
  KnowledgeItemType 
} from '@/hooks/use-demo-state';
import { 
  BookOpen, 
  Plus, 
  FileText, 
  Globe, 
  Trash2, 
  Search, 
  UploadCloud, 
  ExternalLink, 
  Check, 
  Sparkles, 
  Layers, 
  Eye, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  FileCode,
  Tag,
  Loader2,
  ArrowRight,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function KnowledgeBasePanel() {
  const { 
    knowledgeItems, 
    addKnowledgeItem, 
    updateKnowledgeItem, 
    deleteKnowledgeItem, 
    toggleKnowledgeItem, 
    resetKnowledgeItems 
  } = useDemoState();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'file' | 'url' | 'text'>('all');
  
  // Modal / Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'file' | 'url' | 'text'>('file');
  
  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState('');
  
  // URL Fetch state
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  const [urlFetchSuccess, setUrlFetchSuccess] = useState<string | null>(null);

  // File Upload state
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<KnowledgeItem | null>(null);

  const resetForm = () => {
    setFormTitle('');
    setFormUrl('');
    setFormContent('');
    setFormTags('');
    setFormFileName('');
    setFormFileSize('');
    setUrlFetchError(null);
    setUrlFetchSuccess(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = (mode: 'file' | 'url' | 'text') => {
    resetForm();
    setAddMode(mode);
    setIsAddModalOpen(true);
  };

  // Handle URL Crawl / Fetch
  const handleFetchUrl = async () => {
    if (!formUrl.trim()) return;
    setIsFetchingUrl(true);
    setUrlFetchError(null);
    setUrlFetchSuccess(null);

    try {
      const res = await fetch('/api/knowledge/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to crawl website URL');
      }

      setFormTitle(prev => prev.trim() ? prev : data.title);
      setFormContent(data.content);
      setUrlFetchSuccess(`Successfully extracted ${data.wordCount.toLocaleString()} words (${data.characterCount.toLocaleString()} chars)`);
      
      // Auto tag from hostname
      try {
        const u = new URL(data.url);
        setFormTags(prev => prev ? prev : `website, ${u.hostname.replace('www.', '')}`);
      } catch {}
    } catch (err: any) {
      setUrlFetchError(err.message || 'Failed to connect to website. Please verify the URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Handle File Selection & Text Extraction
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setIsReadingFile(true);
    setFormFileName(file.name);
    
    // Format size
    const sizeKb = Math.round(file.size / 1024);
    setFormFileSize(sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);
    
    if (!formTitle) {
      setFormTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text || text.trim().length === 0) {
        setFileError('File appears empty or could not be read as plain text.');
      } else {
        setFormContent(text);
        if (!formTags) {
          setFormTags(`document, ${file.name.split('.').pop() || 'file'}`);
        }
      }
      setIsReadingFile(false);
    };

    reader.onerror = () => {
      setFileError('Failed to read file.');
      setIsReadingFile(false);
    };

    // For text-based formats
    reader.readAsText(file);
  };

  // Save Knowledge Item
  const handleSaveItem = () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    const tagsArray = formTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    addKnowledgeItem({
      title: formTitle.trim(),
      type: addMode,
      sourceUrl: addMode === 'url' ? formUrl.trim() : undefined,
      fileName: addMode === 'file' ? formFileName || 'document.txt' : undefined,
      fileSize: addMode === 'file' ? formFileSize || '12 KB' : undefined,
      content: formContent.trim(),
      tags: tagsArray.length > 0 ? tagsArray : ['general'],
      isEnabled: true,
      characterCount: formContent.trim().length,
    });

    setIsAddModalOpen(false);
    resetForm();
  };

  // Filtered Knowledge Items
  const filteredItems = knowledgeItems.filter(item => {
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.sourceUrl && item.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.fileName && item.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const totalCharacters = knowledgeItems.reduce((sum, item) => sum + (item.isEnabled ? item.characterCount : 0), 0);
  const activeSourcesCount = knowledgeItems.filter(item => item.isEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            AI Knowledge Base & Document Grounding
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Upload hospital documents or website URLs. The AI assistant references these sources in real-time to answer patient inquiries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetKnowledgeItems}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            title="Reset to default clinic documents"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Samples
          </Button>

          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Open Live Inbox</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Knowledge Sources</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {activeSourcesCount} <span className="text-xs font-normal text-muted-foreground">/ {knowledgeItems.length} active</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Live RAG Retrieval Ready
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Indexed Knowledge Density</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {(totalCharacters / 1000).toFixed(1)}k <span className="text-xs font-normal text-muted-foreground">characters</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Across treatments, doctors, and SOPs
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">AI Retrieval Speed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            &lt; 50ms <span className="text-xs font-normal text-muted-foreground">latency</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Real-time keyword & token matching
          </p>
        </div>
      </div>

      {/* Action Toolbar: Add buttons + Filter + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        {/* Left: Quick Add Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => openAddModal('file')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8.5 gap-1.5 shadow-xs font-semibold"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload File / Document
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => openAddModal('url')}
            className="text-xs h-8.5 gap-1.5 border-border hover:bg-muted text-foreground font-medium"
          >
            <Globe className="h-3.5 w-3.5 text-sky-500" />
            Add Website URL
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => openAddModal('text')}
            className="text-xs h-8.5 gap-1.5 border-border hover:bg-muted text-foreground font-medium"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-500" />
            Add Custom Text / FAQ
          </Button>
        </div>

        {/* Right: Tab filter & Search */}
        <div className="flex items-center gap-2">
          {/* Tab Filter */}
          <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs font-medium text-muted-foreground">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'all' ? 'bg-background text-foreground shadow-xs' : 'hover:text-foreground'}`}
            >
              All ({knowledgeItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'file' ? 'bg-background text-foreground shadow-xs' : 'hover:text-foreground'}`}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'url' ? 'bg-background text-foreground shadow-xs' : 'hover:text-foreground'}`}
            >
              URLs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'text' ? 'bg-background text-foreground shadow-xs' : 'hover:text-foreground'}`}
            >
              Text
            </button>
          </div>

          {/* Search */}
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge..."
              className="h-8 pl-8 text-xs bg-muted/20 border-border"
            />
          </div>
        </div>
      </div>

      {/* Knowledge Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-12 text-center text-muted-foreground space-y-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No Knowledge Items Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchQuery 
                ? 'Try a different keyword or clear your search query.' 
                : 'Upload your hospital brochure, pricing sheets, doctor profiles, or website URLs.'}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => openAddModal('file')}
            className="text-xs mt-2 bg-primary text-primary-foreground"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all shadow-xs space-y-3.5 ${
                item.isEnabled 
                  ? 'border-border bg-card hover:border-primary/40 hover:shadow-md' 
                  : 'border-border/60 bg-muted/20 opacity-60'
              }`}
            >
              {/* Card Top */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === 'file' 
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                        : item.type === 'url' 
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' 
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {item.type === 'file' ? <FileText className="h-4 w-4" /> : item.type === 'url' ? <Globe className="h-4 w-4" /> : <FileCode className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate" title={item.title}>
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {item.type === 'file' ? item.fileName : item.type === 'url' ? item.sourceUrl : 'Custom Note'}
                      </p>
                    </div>
                  </div>

                  {/* Enable / Disable Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleKnowledgeItem(item.id)}
                    title={item.isEnabled ? 'AI actively uses this source (Click to disable)' : 'Source disabled (Click to enable)'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      item.isEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        item.isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Content Snippet */}
                <p className="text-[11.5px] text-muted-foreground line-clamp-3 leading-relaxed bg-muted/20 p-2 rounded-md border border-border/40 font-mono">
                  {item.content}
                </p>

                {/* Tags & Meta */}
                <div className="flex flex-wrap items-center gap-1">
                  {item.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.2 text-[9.5px] font-medium text-muted-foreground"
                    >
                      <Tag className="h-2.5 w-2.5 opacity-60" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Bottom Bar */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
                <span>{item.characterCount.toLocaleString()} chars {item.fileSize ? `• ${item.fileSize}` : ''}</span>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewItem(item)}
                    className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteKnowledgeItem(item.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                    title="Delete source"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD KNOWLEDGE SOURCE */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {addMode === 'file' ? <UploadCloud className="h-4 w-4" /> : addMode === 'url' ? <Globe className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {addMode === 'file' ? 'Upload Hospital Document' : addMode === 'url' ? 'Add Website Knowledge URL' : 'Add Custom FAQ / Text'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddMode('file')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${addMode === 'file' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <UploadCloud className="h-3.5 w-3.5" /> File / Document
              </button>
              <button
                type="button"
                onClick={() => setAddMode('url')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${addMode === 'url' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Globe className="h-3.5 w-3.5" /> Website URL
              </button>
              <button
                type="button"
                onClick={() => setAddMode('text')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors ${addMode === 'text' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <FileCode className="h-3.5 w-3.5" /> Custom FAQ
              </button>
            </div>

            {/* Form Fields according to Mode */}
            <div className="space-y-3.5 text-xs">
              {/* FILE UPLOAD INPUT */}
              {addMode === 'file' && (
                <div className="space-y-2">
                  <label className="font-semibold text-foreground">Select File (.pdf, .txt, .docx, .csv, .md, .json)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 p-6 text-center cursor-pointer transition-colors space-y-2"
                  >
                    <UploadCloud className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {formFileName ? formFileName : 'Click to browse or drag file here'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formFileSize ? `Size: ${formFileSize}` : 'Supports hospital brochures, pricing sheets, doctor profiles'}
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.docx,.csv,.md,.json,.text"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {fileError && (
                    <p className="text-rose-500 font-medium text-[11px]">{fileError}</p>
                  )}
                </div>
              )}

              {/* WEBSITE URL INPUT */}
              {addMode === 'url' && (
                <div className="space-y-2">
                  <label className="font-semibold text-foreground">Website / Page URL</label>
                  <div className="flex gap-2">
                    <Input
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://lafleurclinic.com/treatments or pricing"
                      className="text-xs bg-muted/20 border-border h-9"
                    />
                    <Button
                      type="button"
                      onClick={handleFetchUrl}
                      disabled={isFetchingUrl || !formUrl.trim()}
                      className="h-9 px-3.5 bg-primary text-primary-foreground shrink-0 text-xs font-semibold gap-1.5"
                    >
                      {isFetchingUrl ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Crawling...
                        </>
                      ) : (
                        <>
                          <Globe className="h-3.5 w-3.5" />
                          Fetch Page
                        </>
                      )}
                    </Button>
                  </div>

                  {urlFetchSuccess && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{urlFetchSuccess}</span>
                    </div>
                  )}
                  {urlFetchError && (
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{urlFetchError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Title Field */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Document Title</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Laser Hair Removal Pricing & SOPs 2026"
                  className="text-xs bg-muted/20 border-border h-9"
                />
              </div>

              {/* Extracted / Manual Text Content */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Knowledge Content (Text to Index)</label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formContent.length.toLocaleString()} characters
                  </span>
                </div>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={8}
                  placeholder="Paste or edit the text content that the AI will use to answer patient questions..."
                  className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-mono shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary leading-relaxed"
                />
              </div>

              {/* Tags Field */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Keywords / Tags (Comma-separated)</label>
                <Input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="pricing, laser, doctors, timings, location"
                  className="text-xs bg-muted/20 border-border h-9"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveItem}
                disabled={!formTitle.trim() || !formContent.trim()}
                className="text-xs bg-primary text-primary-foreground font-semibold px-4"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Add to Knowledge Base
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: VIEW KNOWLEDGE CONTENT */}
      {/* ============================================================ */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {previewItem.type === 'file' ? <FileText className="h-4 w-4" /> : previewItem.type === 'url' ? <Globe className="h-4 w-4" /> : <FileCode className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{previewItem.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {previewItem.sourceUrl || previewItem.fileName || 'Custom Note'} • {previewItem.characterCount.toLocaleString()} chars
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setPreviewItem(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/20 p-4 rounded-xl border border-border/60">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground">
                {previewItem.content}
              </pre>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-1">
                {previewItem.tags.map(t => (
                  <span key={t} className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setPreviewItem(null)}
                className="text-xs bg-primary text-primary-foreground"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
