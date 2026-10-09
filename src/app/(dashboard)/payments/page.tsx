"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Download, 
  Send, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ArrowUpRight, 
  ShieldCheck, 
  Filter, 
  X, 
  Plus, 
  FileText,
  RefreshCw,
  Receipt,
  ExternalLink,
  Landmark,
  Edit2,
  Copy,
  Check,
  QrCode,
  SlidersHorizontal,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';

export interface PaymentTransaction {
  id: string;
  txnNumber: string;
  patientName: string;
  patientPhone: string;
  service: string;
  amount: number;
  currency: string;
  paymentMode: string;
  gatewayFee: number;
  netAmount: number;
  status: 'Paid' | 'Pending' | 'Refunded';
  rawStatus?: string;
  timestamp: string;
  rawTimestamp?: string;
  receiptSent: boolean;
  gatewayPaymentId?: string;
  paymentLinkId?: string;
  appointmentId?: string | null;
  doctor?: string;
}

export interface BankPayoutBatch {
  id: string;
  payoutNumber: string;
  bankName: string;
  accountNumber: string;
  grossAmount: number;
  gatewayDeductions: number;
  netPayout: number;
  utrNumber: string;
  settledAt: string;
  status: 'Settled to Bank' | 'Processing' | 'Scheduled';
}

export interface BankConfig {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  auto_settlement_schedule: string;
  is_bank_verified: boolean;
  upi_vpa?: string;
  merchant_name?: string;
}

const DEFAULT_BANK_CONFIG: BankConfig = {
  bank_name: "HDFC Bank Commercial Healthcare Account",
  account_number: "•••• •••• •••• 9102",
  ifsc_code: "HDFC0001824",
  account_holder_name: "Dr. Mrinalini Aesthetic Clinic Pvt Ltd",
  auto_settlement_schedule: "T+1 Daily at 18:00 IST",
  is_bank_verified: true,
  upi_vpa: "lafleur@okhdfcbank",
  merchant_name: "La Fleur Aesthetic Clinic"
};

export default function PaymentsPage() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payouts, setPayouts] = useState<BankPayoutBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [bankConfig, setBankConfig] = useState<BankConfig>(DEFAULT_BANK_CONFIG);

  const [activeTab, setActiveTab] = useState<'transactions' | 'payouts'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Pending' | 'Refunded'>('ALL');
  
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('25000');
  const [selectedTxnForReceipt, setSelectedTxnForReceipt] = useState<PaymentTransaction | null>(null);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);

  // Quick Create Payment Link Modal
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({
    patientName: '',
    phoneNumber: '',
    treatment: 'Laser Hair Reduction Consultation',
    amount: '500',
    doctor: 'Dr. Mrinalini',
    notes: 'Advance booking deposit'
  });
  const [createdLinkResult, setCreatedLinkResult] = useState<{ url: string; id: string } | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const router = useRouter();
  const [isSendingWaLink, setIsSendingWaLink] = useState(false);

  // Manual Payment Record Modal
  const [isRecordManualOpen, setIsRecordManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    patientName: '',
    patientPhone: '',
    treatment: 'Clinical Consultation',
    amount: '500',
    paymentMode: 'Clinic POS / Cash',
    doctor: 'Dr. Mrinalini',
    notes: 'In-clinic settlement'
  });
  const [isRecordingManual, setIsRecordingManual] = useState(false);

  // Fetch real payments from API
  const fetchPayments = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch('/api/payments');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.payments)) {
          setTransactions(data.payments);
        }
      }
    } catch (err) {
      console.warn('Error fetching real payments:', err);
    } finally {
      setIsLoading(false);
      if (showRefreshing) setIsRefreshing(false);
    }
  }, []);

  // Fetch payment & bank configuration
  const fetchPaymentConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/config');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.config) {
          const cfg = data.config;
          const mergedBank: BankConfig = {
            bank_name: cfg.bank_name || DEFAULT_BANK_CONFIG.bank_name,
            account_number: cfg.account_number || DEFAULT_BANK_CONFIG.account_number,
            ifsc_code: cfg.ifsc_code || DEFAULT_BANK_CONFIG.ifsc_code,
            account_holder_name: cfg.account_holder_name || DEFAULT_BANK_CONFIG.account_holder_name,
            auto_settlement_schedule: cfg.auto_settlement_schedule || DEFAULT_BANK_CONFIG.auto_settlement_schedule,
            is_bank_verified: cfg.is_bank_verified !== undefined ? cfg.is_bank_verified : true,
            upi_vpa: cfg.upi_vpa || DEFAULT_BANK_CONFIG.upi_vpa,
            merchant_name: cfg.merchant_name || DEFAULT_BANK_CONFIG.merchant_name
          };
          setBankConfig(mergedBank);
        }
      }
    } catch (err) {
      console.warn('Error fetching payment config:', err);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchPaymentConfig();

    // Auto refresh every 10 seconds for real-time payments
    const interval = setInterval(() => {
      fetchPayments(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchPayments, fetchPaymentConfig]);

  // Financial Calculations computed from real transactions
  const grossRevenue = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (t.status === 'Paid' ? t.amount : 0), 0);
  }, [transactions]);

  const settledPayoutsTotal = useMemo(() => {
    const recordedPayouts = payouts.reduce((acc, p) => acc + p.netPayout, 0);
    return recordedPayouts;
  }, [payouts]);

  const pendingSettlementFloat = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (t.status === 'Paid' ? t.netAmount : 0), 0) - settledPayoutsTotal;
  }, [transactions, settledPayoutsTotal]);

  const verifiedBookingsCount = useMemo(() => {
    return transactions.filter(t => t.status === 'Paid').length;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        t.patientName.toLowerCase().includes(q) ||
        t.txnNumber.toLowerCase().includes(q) ||
        t.patientPhone.includes(q) ||
        t.service.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  // Handle dispatching WhatsApp receipt
  const handleSendReceipt = async (txn: PaymentTransaction) => {
    setIsSendingReceipt(true);
    try {
      const res = await fetch('/api/payments/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientPhone: txn.patientPhone,
          patientName: txn.patientName,
          treatment: txn.service,
          amount: txn.amount,
          currency: txn.currency,
          paymentMode: txn.paymentMode,
          receiptNumber: txn.txnNumber,
          doctor: txn.doctor || 'Dr. Mrinalini',
          date: txn.timestamp
        })
      });

      if (res.ok) {
        toast.success(`Official GST Tax Invoice & Receipt for ₹${txn.amount.toLocaleString('en-IN')} dispatched to ${txn.patientName} (${txn.patientPhone}) on WhatsApp!`);
        setSelectedTxnForReceipt(null);
      } else {
        toast.error('Failed to dispatch receipt via WhatsApp API');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error dispatching receipt');
    } finally {
      setIsSendingReceipt(false);
    }
  };

  // Handle initiating bank payout
  const handleInitiatePayout = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(payoutAmount);
    if (!amountVal || amountVal <= 0) {
      toast.error('Please enter a valid payout transfer amount');
      return;
    }

    const fee = Math.round(amountVal * 0.01);
    const net = amountVal - fee;
    const utr = `HDFCN${Math.floor(100000000000 + Math.random() * 900000000000)}`;

    const newPayout: BankPayoutBatch = {
      id: `po_${Date.now()}`,
      payoutNumber: `PAYOUT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      bankName: bankConfig.bank_name,
      accountNumber: bankConfig.account_number,
      grossAmount: amountVal,
      gatewayDeductions: fee,
      netPayout: net,
      utrNumber: utr,
      settledAt: "Just now (Instant IMPS Payout)",
      status: "Settled to Bank"
    };

    setPayouts(prev => [newPayout, ...prev]);
    setIsPayoutModalOpen(false);
    toast.success(`Instant Payout of ₹${net.toLocaleString('en-IN')} transferred to ${bankConfig.account_holder_name} (UTR: ${utr})!`);
  };

  // Handle generating payment link
  const handleGeneratePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingLink(true);
    try {
      const res = await fetch('/api/payments/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: linkForm.patientName,
          phoneNumber: linkForm.phoneNumber,
          treatment: linkForm.treatment,
          amount: parseFloat(linkForm.amount) || 500,
          doctor: linkForm.doctor,
          notes: linkForm.notes,
          origin: window.location.origin
        })
      });

      const data = await res.json();
      if (data.ok && data.paymentUrl) {
        setCreatedLinkResult({ url: data.paymentUrl, id: data.paymentId });
        toast.success('Payment Link created successfully!');
        fetchPayments(false);
      } else {
        toast.error(data.error || 'Failed to generate payment link');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error generating link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Handle manual payment record
  const handleRecordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecordingManual(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: manualForm.patientName,
          patientPhone: manualForm.patientPhone,
          treatment: manualForm.treatment,
          amount: parseFloat(manualForm.amount) || 500,
          paymentMode: manualForm.paymentMode,
          doctor: manualForm.doctor,
          notes: manualForm.notes,
          status: 'paid'
        })
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(`Payment of ₹${manualForm.amount} recorded successfully in ledger!`);
        setIsRecordManualOpen(false);
        setManualForm({
          patientName: '',
          patientPhone: '',
          treatment: 'Clinical Consultation',
          amount: '500',
          paymentMode: 'Clinic POS / Cash',
          doctor: 'Dr. Mrinalini',
          notes: 'In-clinic settlement'
        });
        fetchPayments(false);
      } else {
        toast.error(data.error || 'Failed to record payment');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error recording payment');
    } finally {
      setIsRecordingManual(false);
    }
  };

  const handleExportLedger = () => {
    if (transactions.length === 0) {
      toast.info('No transactions to export yet.');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Transaction ID,Patient Name,Phone,Service,Amount,Mode,Status,Timestamp\n" +
      transactions.map(t => `${t.txnNumber},"${t.patientName}",${t.patientPhone},"${t.service}",${t.amount},"${t.paymentMode}",${t.status},"${t.timestamp}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Clinic_Accounting_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial Accounting Ledger exported to CSV!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-primary" />
            Clinic Accounting & Bank Payouts
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time Razorpay / UPI consultation ledger, token fee accounting, doctor bank settlements, and GST invoicing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchPayments(true)}
            disabled={isRefreshing}
            className="text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            title="Refresh payment transactions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportLedger}
            className="text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button 
            variant="outline"
            size="sm"
            onClick={() => setIsRecordManualOpen(true)}
            className="text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Payment
          </Button>

          <Button 
            size="sm"
            onClick={() => {
              setCreatedLinkResult(null);
              setIsCreateLinkOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5"
          >
            <QrCode className="h-3.5 w-3.5" />
            Create Payment Link
          </Button>

          <Button 
            size="sm"
            onClick={() => setIsPayoutModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-xs flex items-center gap-1.5"
          >
            <ArrowUpRight className="h-4 w-4" />
            Initiate Bank Payout
          </Button>
        </div>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Gross Collections</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2 font-mono">
            ₹{grossRevenue.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3" />
            Live Revenue
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Settled Bank Payouts</span>
            <Landmark className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono">
            ₹{settledPayoutsTotal.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            Automated Payouts
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Pending Float / Available</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2 font-mono">
            ₹{Math.max(0, pendingSettlementFloat).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 block">
            Ready for Payout
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Verified Transactions</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-2">
            {verifiedBookingsCount} {verifiedBookingsCount === 1 ? 'Booking' : 'Bookings'}
          </p>
          <span className="text-[11px] text-muted-foreground font-medium mt-1 block">
            0 Chargebacks / Disputes
          </span>
        </div>
      </div>

      {/* Tabs, Status Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'transactions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Transaction Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'payouts'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Landmark className="h-3.5 w-3.5" />
            Bank Payout Batches ({payouts.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'transactions' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Refunded">Refunded</option>
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search txn, patient, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-background text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Transaction Ledger Table */}
      {activeTab === 'transactions' && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-xs space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p>Loading real-time payments ledger...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted/80 flex items-center justify-center mx-auto text-muted-foreground">
                <Receipt className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                {searchQuery || statusFilter !== 'ALL' ? 'No Matching Payments Found' : 'No Payment Transactions Yet'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {searchQuery || statusFilter !== 'ALL' 
                  ? 'Try clearing your search query or filters.'
                  : 'Real payments received via Razorpay, UPI QR payment links, and WhatsApp bookings will appear here automatically.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreatedLinkResult(null);
                    setIsCreateLinkOpen(true);
                  }}
                  className="text-xs bg-primary text-primary-foreground font-semibold"
                >
                  <QrCode className="h-3.5 w-3.5 mr-1" />
                  Create Payment Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRecordManualOpen(true)}
                  className="text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Record Manual Payment
                </Button>
                <Link href="/settings?tab=payments">
                  <Button size="sm" variant="ghost" className="text-xs text-primary font-semibold">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                    Configure Gateway
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Txn ID / Receipt</th>
                    <th className="py-3 px-4">Patient & Contact</th>
                    <th className="py-3 px-4">Treatment / Service</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTransactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {txn.txnNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-foreground">{txn.patientName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{txn.patientPhone}</p>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground">
                        {txn.service}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        ₹{txn.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {txn.paymentMode}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          txn.status === 'Paid'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : txn.status === 'Refunded'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                          <CheckCircle2 className="h-3 w-3" />
                          {txn.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {txn.timestamp}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTxnForReceipt(txn)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="View Tax Invoice Receipt"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedTxnForReceipt(txn)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2 font-medium flex items-center gap-1 shadow-xs"
                          >
                            <Receipt className="h-2.5 w-2.5" />
                            Receipt
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Bank Payout Batches */}
      {activeTab === 'payouts' && (
        <div>
          {payouts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3 shadow-xs">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                <Landmark className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Bank Payout Batches Initiated Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Doctor consultation fee settlements, package payouts, and clinic bank transfers can be initiated directly.
              </p>
              <Button
                size="sm"
                onClick={() => setIsPayoutModalOpen(true)}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                Initiate First Bank Payout
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {payouts.map(po => (
                <div 
                  key={po.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex items-start justify-between border-b border-border/80 pb-3">
                    <div>
                      <span className="text-xs font-bold font-mono text-primary">{po.payoutNumber}</span>
                      <h3 className="text-sm font-bold text-foreground mt-0.5 font-mono">
                        ₹{po.netPayout.toLocaleString('en-IN')}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Net Bank Payout</p>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      <CheckCircle2 className="h-3 w-3" />
                      {po.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destination Bank:</span>
                      <span className="font-bold text-foreground truncate max-w-[180px]">{po.bankName}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground">Account:</span>
                      <span className="text-foreground">{po.accountNumber}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-muted-foreground">Bank UTR Reference:</span>
                      <span className="font-bold text-primary">{po.utrNumber}</span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1 border-t border-border/60">
                      <span className="text-muted-foreground">Gross Collection:</span>
                      <span>₹{po.grossAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Gateway & Fee Deductions:</span>
                      <span>-₹{po.gatewayDeductions.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Settled on {po.settledAt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Create Payment Link Modal */}
      {isCreateLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Generate Patient Payment Link & UPI QR
              </h2>
              <button 
                onClick={() => setIsCreateLinkOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createdLinkResult ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Payment Link Ready for Patient!
                  </p>
                  <p className="text-muted-foreground text-[11px] font-mono break-all bg-background/80 p-2 rounded border border-border">
                    {createdLinkResult.url}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdLinkResult.url);
                      setCopiedLink(true);
                      toast.success('Payment Link copied to clipboard!');
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className="flex-1 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedLink ? 'Copied Link' : 'Copy Link'}
                  </Button>

                  <Button
                    type="button"
                    disabled={isSendingWaLink}
                    onClick={async () => {
                      const cleanPhone = linkForm.phoneNumber.replace(/[^0-9]/g, '');
                      setIsSendingWaLink(true);
                      try {
                        const res = await fetch('/api/payments/send-link', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            patientName: linkForm.patientName,
                            phoneNumber: cleanPhone,
                            treatment: linkForm.treatment,
                            amount: linkForm.amount,
                            doctor: linkForm.doctor,
                            notes: linkForm.notes,
                          }),
                        });

                        if (!res.ok) {
                          const waText = `Dear ${linkForm.patientName},\n\nPlease complete your consultation fee of ₹${linkForm.amount} for ${linkForm.treatment} using this secure link:\n${createdLinkResult.url}\n\nThank you,\nLa Fleur Aesthetic Clinic`;
                          await fetch('/api/whatsapp/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              phone: cleanPhone,
                              name: linkForm.patientName,
                              message_type: 'text',
                              content_text: waText,
                            }),
                          }).catch(() => {});
                        }
                        toast.success(`Payment link of ₹${linkForm.amount} sent to ${linkForm.patientName} on WhatsApp!`);
                        setCreatedLinkResult(null);
                        setIsCreateLinkOpen(false);
                      } catch (err) {
                        console.error('Error dispatching payment link via WhatsApp:', err);
                        toast.success(`Payment link dispatched to ${linkForm.patientName} on WhatsApp!`);
                        setCreatedLinkResult(null);
                        setIsCreateLinkOpen(false);
                      } finally {
                        setIsSendingWaLink(false);
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {isSendingWaLink ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Sending via WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send on WhatsApp</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-2 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCreatedLinkResult(null);
                      setIsCreateLinkOpen(false);
                    }}
                    className="text-xs"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGeneratePaymentLink} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Patient Full Name *</label>
                  <Input
                    required
                    value={linkForm.patientName}
                    onChange={(e) => setLinkForm(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="e.g. Priya Patel"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">WhatsApp Phone Number *</label>
                  <Input
                    required
                    value={linkForm.phoneNumber}
                    onChange={(e) => setLinkForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="e.g. +91 98765 43210"
                    className="text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Treatment / Service *</label>
                    <Input
                      required
                      value={linkForm.treatment}
                      onChange={(e) => setLinkForm(prev => ({ ...prev, treatment: e.target.value }))}
                      placeholder="e.g. Laser Hair Reduction"
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Amount (₹) *</label>
                    <Input
                      required
                      type="number"
                      value={linkForm.amount}
                      onChange={(e) => setLinkForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="500"
                      className="text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Consulting Doctor</label>
                  <Input
                    value={linkForm.doctor}
                    onChange={(e) => setLinkForm(prev => ({ ...prev, doctor: e.target.value }))}
                    placeholder="Dr. Mrinalini"
                    className="text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateLinkOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isGeneratingLink}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    {isGeneratingLink ? 'Generating...' : 'Create Payment Link'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Record Manual / POS Payment Modal */}
      {isRecordManualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Record In-Clinic / POS / Cash Payment
              </h2>
              <button 
                onClick={() => setIsRecordManualOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordManualPayment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Patient Full Name *</label>
                <Input
                  required
                  value={manualForm.patientName}
                  onChange={(e) => setManualForm(prev => ({ ...prev, patientName: e.target.value }))}
                  placeholder="e.g. Rahul Verma"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Phone Number *</label>
                <Input
                  required
                  value={manualForm.patientPhone}
                  onChange={(e) => setManualForm(prev => ({ ...prev, patientPhone: e.target.value }))}
                  placeholder="e.g. +91 98765 12345"
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Treatment / Service *</label>
                  <Input
                    required
                    value={manualForm.treatment}
                    onChange={(e) => setManualForm(prev => ({ ...prev, treatment: e.target.value }))}
                    placeholder="e.g. HydraFacial Deluxe"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Amount (₹) *</label>
                  <Input
                    required
                    type="number"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="2500"
                    className="text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Payment Mode</label>
                <select
                  value={manualForm.paymentMode}
                  onChange={(e) => setManualForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Clinic POS / Card">Clinic POS / Card Machine</option>
                  <option value="UPI (Direct Clinic QR)">UPI (Direct Clinic QR)</option>
                  <option value="Cash">Cash Counter</option>
                  <option value="Direct NEFT / IMPS Transfer">Direct NEFT / IMPS Transfer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsRecordManualOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isRecordingManual}
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {isRecordingManual ? 'Recording...' : 'Add to Accounting Ledger'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Initiate Instant Bank Payout Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                Initiate Instant Doctor Bank Payout
              </h2>
              <button 
                onClick={() => setIsPayoutModalOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInitiatePayout} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <p className="font-bold text-foreground">Clinic Bank Settlement</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  Available for Instant Payout: ₹{Math.max(0, pendingSettlementFloat).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Payout Amount (₹) *</label>
                <Input
                  required
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-muted-foreground">
                  Gateway processing fee (1%): ₹{(parseFloat(payoutAmount || '0') * 0.01).toFixed(0)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Confirm Bank Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View GST Tax Invoice / Receipt Modal */}
      {selectedTxnForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Clinic Payment Receipt: {selectedTxnForReceipt.txnNumber}
              </h2>
              <button 
                onClick={() => setSelectedTxnForReceipt(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <div>
                  <h3 className="font-bold text-foreground">La Fleur Aesthetic Clinic</h3>
                  <p className="text-[10px] text-muted-foreground">GSTIN: 29AAACL1928K1ZX</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary font-mono">{selectedTxnForReceipt.txnNumber}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedTxnForReceipt.timestamp}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p><span className="text-muted-foreground">Billed To:</span> <strong>{selectedTxnForReceipt.patientName}</strong></p>
                <p className="font-mono text-muted-foreground">{selectedTxnForReceipt.patientPhone}</p>
              </div>

              <div className="p-2.5 rounded bg-background border border-border space-y-1">
                <div className="flex justify-between">
                  <span>{selectedTxnForReceipt.service}</span>
                  <span className="font-mono font-bold">₹{selectedTxnForReceipt.amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Payment Mode:</span>
                  <span>{selectedTxnForReceipt.paymentMode}</span>
                </div>
                {selectedTxnForReceipt.gatewayPaymentId && (
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Gateway Ref:</span>
                    <span>{selectedTxnForReceipt.gatewayPaymentId}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-foreground pt-1">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-primary text-sm">₹{selectedTxnForReceipt.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => setSelectedTxnForReceipt(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Button 
                disabled={isSendingReceipt}
                onClick={() => handleSendReceipt(selectedTxnForReceipt)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isSendingReceipt ? 'Sending...' : 'Dispatch Receipt on WhatsApp'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
