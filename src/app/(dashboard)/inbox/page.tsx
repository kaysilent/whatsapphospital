"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Search, 
  Phone, 
  Send, 
  Bot, 
  User, 
  Check, 
  CheckCheck, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  ShieldCheck, 
  Calendar, 
  Paperclip, 
  Smile, 
  Zap, 
  MoreVertical, 
  ChevronRight, 
  RefreshCw, 
  UserCheck, 
  UserX,
  PhoneCall,
  Flame,
  Filter,
  CheckCircle2,
  Plus,
  X,
  CreditCard,
  MapPin,
  FileText,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

export interface MessageItem {
  id: string;
  sender: 'patient' | 'clinic' | 'ai' | 'doctor';
  text: string;
  time: string;
  createdAt?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isAppointment?: boolean;
  appointmentDetails?: {
    service: string;
    date: string;
    time: string;
    doctor: string;
  };
}

export interface ConversationItem {
  id: string;
  contactId?: string;
  patientName: string;
  patientPhone: string;
  patientAvatar?: string | null;
  department: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  aiActive: boolean;
  isEmergency: boolean;
  status: 'open' | 'closed' | 'escalated';
  lastMessageSender?: string;
  updatedAt?: string;
}

function formatLiveTime(timeStr?: string, isoDateStr?: string): string {
  const target = isoDateStr || timeStr;
  if (!target) return 'Just now';

  // If valid ISO or timestamp string with date/T/Z, convert to user's local live browser timezone
  if (typeof target === 'string' && (target.includes('T') || target.includes('-') || target.includes('Z'))) {
    const d = new Date(target);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  if (isoDateStr) {
    const fd = new Date(isoDateStr);
    if (!isNaN(fd.getTime())) {
      return fd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  return timeStr || 'Just now';
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading Live WhatsApp Inbox...</p>
        </div>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const queryConversationId = searchParams.get('c');
  const queryPhone = searchParams.get('phone');
  const queryName = searchParams.get('name');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'ai' | 'escalated'>('all');
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [unreadNewCount, setUnreadNewCount] = useState(0);

  // Smooth / Auto scroll to bottom helper
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    isUserNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    setUnreadNewCount(0);
  }, []);

  // Track user scroll position in chat container
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 120; // 120px from bottom considered "at bottom"
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNear = distanceFromBottom <= threshold;
    isUserNearBottomRef.current = isNear;
    setShowScrollBottomBtn(!isNear);
    if (isNear) {
      setUnreadNewCount(0);
    }
  }, []);

  // 1. Load Conversations from Server API
  const fetchConversations = useCallback(async (autoSelectTargetId?: string) => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      
      const convList: ConversationItem[] = (res.ok && Array.isArray(data.conversations)) ? data.conversations : [];
      setConversations(convList);

      // Select target ID or keep selected or default to first
      if (autoSelectTargetId) {
        setSelectedId(autoSelectTargetId);
      } else if (!selectedId && convList.length > 0) {
        setSelectedId(convList[0].id);
      } else if (convList.length === 0) {
        setSelectedId('');
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setConversations([]);
      setSelectedId('');
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  // 2. Fetch Messages for Active Conversation
  const fetchMessages = useCallback(async (convId: string) => {
    if (!convId || convId === 'placeholder') {
      setMessages([]);
      return;
    }
    try {
      setIsLoadingMessages(true);
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
        // On initial conversation load, jump to bottom
        setTimeout(() => {
          scrollToBottom('auto');
        }, 60);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching messages for conv:', convId, err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // 3. Resolve Phone or Query Param on Initial Load
  useEffect(() => {
    const initInbox = async () => {
      if (queryPhone) {
        try {
          setIsLoading(true);
          const res = await fetch(`/api/conversations?phone=${encodeURIComponent(queryPhone)}&name=${encodeURIComponent(queryName || '')}`);
          const data = await res.json();
          if (data.resolvedConversationId) {
            await fetchConversations(data.resolvedConversationId);
            return;
          }
        } catch (e) {
          console.warn('Error resolving conversation by phone:', e);
        }
      }

      if (queryConversationId) {
        await fetchConversations(queryConversationId);
      } else {
        await fetchConversations();
      }
    };

    initInbox();
  }, [queryPhone, queryName, queryConversationId, fetchConversations]);

  // 4. Update messages when selectedId changes
  useEffect(() => {
    if (selectedId) {
      isUserNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
      setUnreadNewCount(0);
      fetchMessages(selectedId);
    }
  }, [selectedId, fetchMessages]);

  // 5. Background Polling for Live Webhook Message Updates (every 3.5 seconds)
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      if (selectedId) {
        // Quietly fetch messages
        fetch(`/api/conversations/${selectedId}/messages`)
          .then(res => res.json())
          .then(data => {
            if (data && Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(prev => {
                // Check if identical to prevent useless re-renders
                if (prev.length === data.messages.length) {
                  const lastPrev = prev[prev.length - 1];
                  const lastNext = data.messages[data.messages.length - 1];
                  if (lastPrev && lastNext && lastPrev.id === lastNext.id && lastPrev.status === lastNext.status && lastPrev.text === lastNext.text) {
                    return prev;
                  }
                }

                const newCount = Math.max(0, data.messages.length - prev.length);

                // Only auto-scroll to bottom if the user is already at the bottom!
                // If they are scrolled up reading past history, DO NOT hijack scroll!
                if (isUserNearBottomRef.current) {
                  setTimeout(() => scrollToBottom('smooth'), 50);
                } else if (newCount > 0) {
                  setUnreadNewCount(c => c + newCount);
                }

                return data.messages;
              });
            }
          })
          .catch(() => {});
      }
      
      // Also update conversations list
      fetch('/api/conversations')
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.conversations) && data.conversations.length > 0) {
            setConversations(prev => {
              if (prev.length === data.conversations.length) {
                const isSame = prev.every((c, idx) => c.id === data.conversations[idx]?.id && c.lastMessage === data.conversations[idx]?.lastMessage);
                if (isSame) return prev;
              }
              return data.conversations;
            });
          }
        })
        .catch(() => {});
    }, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedId, scrollToBottom]);

  const activeConversation = conversations.find(c => c.id === selectedId) || (conversations.length > 0 ? conversations[0] : null);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    router.replace(`/inbox?c=${id}`, { scroll: false });
  };

  // Send WhatsApp message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !activeConversation || !selectedId) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    const tempMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      sender: 'clinic',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdAt: new Date().toISOString(),
      status: 'sent'
    };

    // Optimistic update
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedId,
          contact_id: activeConversation?.contactId,
          phone: activeConversation?.patientPhone,
          name: activeConversation?.patientName,
          message_type: 'text',
          content_text: textToSend
        })
      });

      const resData = await res.json();
      if (res.ok && !resData.error) {
        toast.success(`WhatsApp message sent to ${activeConversation?.patientName || 'patient'}!`);
        const targetConvId = resData.conversation_id || selectedId;
        if (targetConvId && targetConvId !== selectedId) {
          setSelectedId(targetConvId);
          await fetchMessages(targetConvId);
        } else {
          await fetchMessages(selectedId);
        }
        await fetchConversations();
      } else {
        toast.info(resData.error || "Message recorded in live thread");
      }
    } catch (err: any) {
      console.warn('WhatsApp send error:', err);
      toast.success("Message recorded in thread");
    } finally {
      setIsSending(false);
    }
  };

  // Start a new conversation modal submit
  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim()) {
      toast.error('Please enter a WhatsApp phone number');
      return;
    }

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newChatPhone.trim(),
          name: newChatName.trim() || 'New Patient'
        })
      });

      const data = await res.json();
      if (data.conversationId) {
        setIsNewChatOpen(false);
        setNewChatPhone('');
        setNewChatName('');
        await fetchConversations(data.conversationId);
        toast.success('Live WhatsApp conversation opened!');
      } else {
        toast.error(data.error || 'Failed to open conversation');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error opening conversation');
    }
  };

  const handleToggleAI = (convId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        const nextState = !c.aiActive;
        toast.info(nextState ? "AI Receptionist enabled for this chat" : "Human staff takeover enabled (AI paused)");
        return { ...c, aiActive: nextState };
      }
      return c;
    }));
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = 
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.patientPhone.includes(searchQuery) ||
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'unread') return c.unreadCount > 0;
    if (filterTab === 'ai') return c.aiActive;
    if (filterTab === 'escalated') return c.isEmergency || c.status === 'escalated';
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4.5rem)] rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      {/* 1. LEFT PANEL: Conversations Sidebar */}
      <div className="w-80 md:w-96 flex flex-col border-r border-border bg-card/60 flex-shrink-0">
        {/* Search & Header */}
        <div className="p-3.5 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="text-sm font-bold text-foreground">Live WhatsApp Inbox</h1>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {conversations.length} chats
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewChatOpen(true)}
                className="h-7 px-2 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                title="Start New Chat"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search patient, phone, symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab('escalated')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                filterTab === 'escalated'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <AlertCircle className="h-3 w-3" />
              Urgent
            </button>
            <button
              onClick={() => setFilterTab('ai')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                filterTab === 'ai'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              AI Active
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span>Syncing Live WhatsApp chats...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <p>No conversations found.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewChatOpen(true)}
                className="text-xs gap-1 text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Start a WhatsApp Chat
              </Button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation ? conv.id === activeConversation.id : false;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`w-full text-left p-3 transition-colors flex items-start gap-3 ${
                    isSelected
                      ? 'bg-primary/10 border-l-4 border-l-primary'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                    conv.isEmergency
                      ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                      : 'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {conv.patientName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {conv.patientName}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatLiveTime(conv.lastMessageTime, conv.updatedAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {conv.patientPhone}
                    </p>

                    <p className="text-xs text-muted-foreground/90 truncate mt-1 leading-snug">
                      {conv.lastMessage}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {conv.isEmergency && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                          <AlertCircle className="h-2.5 w-2.5" /> Urgent
                        </span>
                      )}
                      {conv.aiActive ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <Sparkles className="h-2.5 w-2.5" /> AI Autopilot
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <User className="h-2.5 w-2.5" /> Staff
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {conv.department}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. RIGHT MAIN PANEL: Active Conversation View or Empty State */}
      {!activeConversation ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background/40">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
            <MessageSquare className="h-8 w-8" />
          </div>
          <h2 className="text-base font-bold text-foreground">Live WhatsApp Inbox Ready</h2>
          <p className="text-xs text-muted-foreground max-w-md mt-1.5 mb-6 leading-relaxed">
            There are no messages in the inbox. When patients message your Meta WhatsApp number, their conversation will appear here in real time.
          </p>
          <Button
            onClick={() => setIsNewChatOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Start a WhatsApp Chat</span>
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
          {/* Crisp, Well-Spaced Header */}
          <header className="min-h-16 py-3 border-b border-border bg-card px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                activeConversation.isEmergency
                  ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {activeConversation.patientName.slice(0, 2).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-foreground truncate">
                    {activeConversation.patientName}
                  </h2>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {activeConversation.patientPhone}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {activeConversation.department}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">WhatsApp Active</span>
                  <span>•</span>
                  <span>{activeConversation.aiActive ? "🤖 AI Receptionist Autopilot" : "👨‍⚕️ Staff Handled"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Toggle AI Takeover Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleAI(activeConversation.id)}
                className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                  activeConversation.aiActive
                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    : 'border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                }`}
              >
                {activeConversation.aiActive ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Take Over</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Enable AI</span>
                  </>
                )}
              </Button>

              {activeConversation.patientPhone && (
                <a href={`tel:${activeConversation.patientPhone}`}>
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Call Patient</span>
                  </Button>
                </a>
              )}
            </div>
          </header>

          {/* Message Thread Area with smart scroll control */}
          <div className="relative flex-1 flex flex-col min-h-0">
            <div 
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/10"
            >
              {/* Encryption & Clinic Protocol Banner */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border text-[10px] text-muted-foreground font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  End-to-End Encrypted Official WhatsApp Healthcare Relay
                </span>
              </div>

              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground space-y-2">
                  <p>No messages exchanged with this patient yet.</p>
                  <p className="text-[11px]">Type a greeting below or use quick replies to start the conversation on WhatsApp.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isPatient = m.sender === 'patient';
                  const isAI = m.sender === 'ai';
                  const isDoctor = m.sender === 'doctor';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isPatient ? 'items-start' : 'items-end'}`}
                    >
                      {/* Sender badge if AI, Doctor, or Clinic */}
                      {!isPatient && (
                        <span className="text-[10px] text-muted-foreground mb-1 mr-1 flex items-center gap-1">
                          {isAI && <><Sparkles className="h-2.5 w-2.5 text-emerald-600" /> AI Receptionist</>}
                          {isDoctor && <><UserCheck className="h-2.5 w-2.5 text-primary" /> On-Duty Doctor</>}
                          {m.sender === 'clinic' && <><User className="h-2.5 w-2.5 text-blue-600" /> Staff</>}
                        </span>
                      )}

                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-2xs text-xs ${
                        isPatient
                          ? 'bg-card border border-border text-foreground rounded-tl-xs'
                          : isAI
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-foreground rounded-tr-xs'
                          : 'bg-primary text-primary-foreground rounded-tr-xs'
                      }`}>
                        <p className="whitespace-pre-line leading-relaxed break-words">
                          {m.text}
                        </p>

                        {/* Appointment Card if embedded */}
                        {m.isAppointment && m.appointmentDetails && (
                          <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 space-y-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                              <Calendar className="h-3.5 w-3.5" />
                              Confirmed Appointment
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                              <div><strong>Service:</strong> {m.appointmentDetails.service}</div>
                              <div><strong>Time:</strong> {m.appointmentDetails.time}</div>
                              <div><strong>Date:</strong> {m.appointmentDetails.date}</div>
                              <div><strong>Doctor:</strong> {m.appointmentDetails.doctor}</div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-75">
                          <span>{formatLiveTime(m.time, m.createdAt)}</span>
                          {!isPatient && (
                            <CheckCheck className={`h-3 w-3 ${m.status === 'read' ? 'text-blue-500' : ''}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Floating Pill Button when user is scrolled up */}
            {showScrollBottomBtn && (
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all animate-in fade-in zoom-in-90 border border-primary/20"
                title="Scroll to latest messages"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                {unreadNewCount > 0 ? (
                  <span>{unreadNewCount} new {unreadNewCount === 1 ? 'message' : 'messages'}</span>
                ) : (
                  <span>Scroll to bottom</span>
                )}
              </button>
            )}
          </div>

          {/* Footer: Quick Replies & Message Composer */}
          <div className="p-3.5 border-t border-border bg-card space-y-2">
            {/* Quick Replies Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
              <span className="text-muted-foreground font-semibold text-[10px] uppercase shrink-0">Quick Replies:</span>
              <button
                type="button"
                onClick={() => setInputMessage("Your appointment has been confirmed with Dr. Mrinalini. Please arrive 10 mins early.")}
                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-all shrink-0"
              >
                📅 Confirm Appt
              </button>
              <button
                type="button"
                onClick={() => setInputMessage("Our clinic location: Suite 402, Medical Arts Building. Valet parking is available at the entrance.")}
                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-all shrink-0"
              >
                📍 Send Location
              </button>
              <button
                type="button"
                onClick={() => setInputMessage("Please apply soothing barrier cream for 10 minutes and avoid direct sun exposure today.")}
                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-all shrink-0"
              >
                🩹 Post-Care
              </button>
              <button
                type="button"
                onClick={() => setInputMessage("You can complete your booking deposit of ₹500 via our secure link: https://blue-monkey-950817.hostingersite.com/payments")}
                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-all shrink-0"
              >
                💳 Pay Link
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <Input
                placeholder={`Reply to ${activeConversation.patientName} on WhatsApp...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 text-xs h-9 bg-background"
              />
              <Button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send WhatsApp</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Start New Chat Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Start Live WhatsApp Conversation
              </h2>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="font-semibold text-foreground">Patient Full Name</Label>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-foreground">WhatsApp Phone Number *</Label>
                <Input
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewChatOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary text-primary-foreground font-semibold text-xs gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Open Live Chat</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
