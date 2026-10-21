import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  X, TrendingUp, TrendingDown, Coins, ArrowUpRight, ArrowDownLeft, 
  Clock, Filter, Gift, Gamepad2, Sparkles, RefreshCw, Layers
} from 'lucide-react';

interface Transaction {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  type?: string; // 'transfer' | 'gift' | 'game_spend' | 'game_win' | 'recharge'
  details?: string;
  icon?: string;
  timestamp: string;
}

interface CoinLedgerProps {
  currentUser: User;
  onClose: () => void;
}

function MiniBarChart({ transactions, userId }: { transactions: Transaction[]; userId: string }) {
  if (transactions.length === 0) return null;

  // Build daily buckets (last 7 days)
  const buckets: { label: string; income: number; expense: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const dayStr = d.toISOString().slice(0, 10);
    const dayTxns = transactions.filter(t => (t.timestamp || '').slice(0, 10) === dayStr);
    const income = dayTxns.filter(t => t.receiverId === userId).reduce((s, t) => s + t.amount, 0);
    const expense = dayTxns.filter(t => t.senderId === userId).reduce((s, t) => s + t.amount, 0);
    buckets.push({ label, income, expense });
  }

  const maxVal = Math.max(...buckets.flatMap(b => [b.income, b.expense]), 1);

  return (
    <div className="flex items-end justify-between gap-1 h-20 px-1">
      {buckets.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="flex items-end gap-1 h-14 w-full justify-center">
            {/* Income bar (green) */}
            {b.income > 0 && (
              <div
                className="w-2.5 rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-700 shadow-xs"
                style={{ height: `${Math.max(4, (b.income / maxVal) * 56)}px` }}
                title={`+${b.income} earned`}
              />
            )}
            {/* Expense bar (rose) */}
            {b.expense > 0 && (
              <div
                className="w-2.5 rounded-t-lg bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-700 shadow-xs"
                style={{ height: `${Math.max(4, (b.expense / maxVal) * 56)}px` }}
                title={`-${b.expense} spent`}
              />
            )}
            {b.income === 0 && b.expense === 0 && (
              <div className="w-1.5 rounded-t-lg bg-zinc-200 h-1" />
            )}
          </div>
          <span className="text-[9px] text-zinc-400 font-bold">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function CoinLedger({ currentUser, onClose }: CoinLedgerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earned' | 'spent' | 'gifts' | 'games'>('all');

  const userId = currentUser._id || currentUser.id || '';

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/transactions?limit=100`);
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadTransactions();
  }, [userId]);

  const totalReceived = transactions.filter(t => t.receiverId === userId).reduce((s, t) => s + t.amount, 0);
  const totalSent = transactions.filter(t => t.senderId === userId).reduce((s, t) => s + t.amount, 0);

  const filtered = transactions.filter(t => {
    const isIncoming = t.receiverId === userId;
    const isOutgoing = t.senderId === userId;
    const isGift = t.type === 'gift' || (t.details && t.details.includes('Gift'));
    const isGame = t.type === 'game_win' || t.type === 'game_spend' || (t.details && (t.details.includes('Wheel') || t.details.includes('Dice') || t.details.includes('Ludo')));

    if (filter === 'earned') return isIncoming;
    if (filter === 'spent') return isOutgoing;
    if (filter === 'gifts') return isGift;
    if (filter === 'games') return isGame;
    return true;
  });

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function getTxnMeta(txn: Transaction, isIncoming: boolean) {
    const type = txn.type || '';
    const details = txn.details || '';

    if (type === 'gift' || details.includes('Gift')) {
      return {
        badge: 'Gift',
        color: 'bg-pink-50 text-pink-600 border-pink-200',
        icon: txn.icon || '🎁',
        title: isIncoming ? `Received Gift from ${txn.senderName}` : `Sent Gift to ${txn.receiverName}`,
        sub: details || 'Animated Gift Shower'
      };
    }
    if (type === 'game_win' || details.includes('Won in') || details.includes('Wheel') || details.includes('Dice') || details.includes('Ludo')) {
      return {
        badge: 'Game Win',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        icon: txn.icon || '🎮',
        title: `Game Winnings: ${txn.senderName}`,
        sub: details || 'Tournament & Arcade Reward'
      };
    }
    if (type === 'game_spend') {
      return {
        badge: 'Game Spend',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: '🎲',
        title: `Game Bet / Entry Fee`,
        sub: details || 'Lobby Entry'
      };
    }
    if (type === 'recharge') {
      return {
        badge: 'Recharge',
        color: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: '💎',
        title: `Store Coin Recharge`,
        sub: details || 'Direct Purchase'
      };
    }
    return {
      badge: isIncoming ? 'Transfer In' : 'Transfer Out',
      color: isIncoming ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200',
      icon: isIncoming ? '📥' : '📤',
      title: isIncoming ? `Received from ${txn.senderName}` : `Transferred to ${txn.receiverName}`,
      sub: details || (txn.senderRole && txn.senderRole !== 'user' ? `${txn.senderRole} operation` : 'Direct wallet transfer')
    };
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-stone-50 flex flex-col animate-in fade-in duration-200 overflow-hidden">
      
      {/* Top Fixed Header with Safe-Area Inset */}
      <div 
        className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0 bg-white border-b border-zinc-200/80 shadow-xs"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-amber-400/30">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-zinc-900 tracking-tight">Coin Ledger</h2>
              <span className="text-[8px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full uppercase">Full Ledger</span>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">All Games, Gifts & Transfers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTransactions}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center cursor-pointer transition-colors text-zinc-600"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center cursor-pointer transition-colors text-zinc-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3.5 max-w-lg mx-auto w-full overscroll-contain">
        
        {/* Balance Card Hero */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-5 shadow-xl shadow-amber-500/25 shrink-0 text-white relative overflow-hidden">
          {/* Decorative Background Circles */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute top-2 right-4 text-4xl opacity-20 pointer-events-none">🪙</div>

          <p className="text-[10px] text-amber-100 font-black uppercase tracking-widest flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Total Wallet Balance
          </p>
          <p className="text-3xl font-black text-white mt-1 font-mono tracking-tight flex items-baseline gap-2">
            <span>{currentUser.role === 'admin' ? '∞ Unlimited' : (currentUser.coins ?? 0).toLocaleString()}</span>
            <span className="text-base font-bold opacity-80">🪙 Gold Coins</span>
          </p>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-black/15 backdrop-blur-md rounded-2xl px-3.5 py-2.5 flex items-center gap-2 border border-white/10">
              <div className="w-7 h-7 rounded-xl bg-emerald-400/20 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] text-emerald-200 font-bold uppercase tracking-wider">Total Earned / In</p>
                <p className="text-xs text-white font-black font-mono truncate">+{totalReceived.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-black/15 backdrop-blur-md rounded-2xl px-3.5 py-2.5 flex items-center gap-2 border border-white/10">
              <div className="w-7 h-7 rounded-xl bg-rose-400/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 text-rose-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] text-rose-200 font-bold uppercase tracking-wider">Total Spent / Out</p>
                <p className="text-xs text-white font-black font-mono truncate">-{totalSent.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Graphical Activity Chart */}
        {transactions.length > 0 && (
          <div className="bg-white border border-zinc-200/90 rounded-3xl p-4 shrink-0 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-black text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 7-Day Coin Velocity
              </p>
              <div className="flex items-center gap-2.5 text-[9px] font-bold text-zinc-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Earned</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Spent</span>
              </div>
            </div>
            <MiniBarChart transactions={transactions} userId={userId} />
          </div>
        )}

        {/* Comprehensive Filter Tabs */}
        <div className="flex gap-1.5 shrink-0 overflow-x-auto pb-1 scrollbar-none">
          {([
            { id: 'all', label: 'All Activity', icon: Layers },
            { id: 'earned', label: '📥 Earned', icon: ArrowDownLeft },
            { id: 'spent', label: '📤 Spent', icon: ArrowUpRight },
            { id: 'gifts', label: '🎁 Gifts', icon: Gift },
            { id: 'games', label: '🎮 Games', icon: Gamepad2 }
          ] as const).map(tab => {
            const Icon = tab.icon;
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  active
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Transaction History Items List */}
        <div className="flex flex-col gap-2 pb-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-3xl border border-zinc-150">
              <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-xs text-zinc-400 font-bold">Fetching comprehensive ledger...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-3xl border border-zinc-150 text-center p-6">
              <div className="w-16 h-16 rounded-3xl bg-zinc-100 flex items-center justify-center text-4xl">🪙</div>
              <p className="text-sm font-black text-zinc-800">No Transactions Found</p>
              <p className="text-[11px] text-zinc-400 max-w-[240px]">
                {filter === 'all' 
                  ? 'Your transaction log is empty. Send a gift or play arcade games to see activity!' 
                  : `No records found in the "${filter}" category.`}
              </p>
            </div>
          ) : (
            filtered.map((txn, i) => {
              const isIncoming = txn.receiverId === userId;
              const meta = getTxnMeta(txn, isIncoming);

              return (
                <div
                  key={txn._id || i}
                  className="flex items-center gap-3 bg-white border border-zinc-200/80 rounded-2xl px-4 py-3.5 shadow-xs hover:border-zinc-300 transition-colors"
                >
                  {/* Category Emoji Badge */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs ${
                    isIncoming
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200'
                      : 'bg-gradient-to-br from-rose-50 to-pink-100 border border-rose-200'
                  }`}>
                    {meta.icon}
                  </div>

                  {/* Title and Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${meta.color}`}>
                        {meta.badge}
                      </span>
                      <p className="text-xs font-black text-zinc-900 truncate">
                        {meta.title}
                      </p>
                    </div>

                    <p className="text-[10px] text-zinc-500 font-medium truncate mt-0.5">
                      {meta.sub}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1 text-[9px] text-zinc-400 font-medium">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatTime(txn.timestamp)}</span>
                    </div>
                  </div>

                  {/* Amount Badge */}
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-black font-mono block ${
                      isIncoming ? 'text-emerald-600' : 'text-rose-500'
                    }`}>
                      {isIncoming ? '+' : '-'}{txn.amount.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase">🪙 Coins</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
