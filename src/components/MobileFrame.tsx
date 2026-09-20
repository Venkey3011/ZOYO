import React from 'react';
import YoYoLogo from './YoYoLogo';
import { 
  Mic, MessageCircle, Shield, User, Coins, Trophy, 
  Flame, Bell, Sparkles, LogIn, ChevronLeft, Calendar, HelpCircle
} from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  inRoom: boolean;
  onBackToHome?: () => void;
  coins: number;
  userName: string;
  userAvatar: string;
  currentUserRole?: string;
  isLoggedIn?: boolean;
}

export default function MobileFrame({
  children,
  activeTab,
  onTabChange,
  inRoom,
  onBackToHome,
  coins,
  userName,
  userAvatar,
  currentUserRole,
  isLoggedIn,
}: MobileFrameProps) {

  // Clean navigation tabs with premium Lucide components instead of raw emojis
  const tabs = [
    { id: 'home', label: 'Rooms', icon: Mic },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    ...(currentUserRole && currentUserRole !== 'user' ? [{ id: 'admin', label: 'Console', icon: Shield }] : []),
    { id: 'profile', label: 'Me', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-800 font-sans antialiased select-none flex justify-center items-center md:py-6 md:px-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
      
      {/* ================= DESKTOP LEFT SIDEBAR ================= */}
      {!inRoom && isLoggedIn !== false && (
        <div className="hidden md:flex flex-col w-64 h-[800px] bg-white border border-zinc-200/80 rounded-[32px] p-6 mr-6 justify-between shadow-xl animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex flex-col gap-6">
            {/* Custom Brand Logo */}
            <div className="px-1">
              <YoYoLogo />
            </div>

            {/* Desktop User Card */}
            <div className="bg-gradient-to-br from-stone-50 to-zinc-100/50 border border-zinc-200/60 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={userAvatar || PRESET_AVATARS[0]}
                    alt={userName || 'User'}
                    className="w-10 h-10 rounded-full border-2 border-rose-500 object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-zinc-900 truncate">{userName || 'Authenticated User'}</span>
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                    {currentUserRole === 'admin' ? '🛡️ Administrator' : currentUserRole === 'manager' ? '⚡ Manager' : '🐣 Active Member'}
                  </span>
                </div>
              </div>

              {/* Coin Display */}
              <div className="flex items-center justify-between bg-white border border-zinc-200/80 px-3 py-2 rounded-xl text-[11px] font-bold text-zinc-700 shadow-sm">
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Coins className="w-3.5 h-3.5 fill-amber-500/10 text-amber-500 stroke-[2.5]" />
                  <span>Gold Balance</span>
                </span>
                <span className="font-extrabold text-amber-700">{currentUserRole === 'admin' ? '∞' : coins}</span>
              </div>
            </div>

            {/* Desktop Sidebar Navigation List */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest px-2.5 mb-1">Navigation</span>
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-rose-500/10 to-pink-500/10 text-rose-600 border border-rose-200/50 shadow-sm font-extrabold'
                        : 'text-zinc-500 hover:bg-zinc-50 border border-transparent hover:text-zinc-800'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Help Tip */}
          <div className="p-3.5 bg-stone-50 border border-zinc-200/60 rounded-2xl flex flex-col gap-1 text-[9px] text-zinc-500 leading-relaxed">
            <span className="font-extrabold text-zinc-700 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> Platform Guidelines:
            </span>
            <p>
              Respect voice room speakers. Be friendly. Report coin sellers attempting offline transfers outside of the Admin console.
            </p>
          </div>
        </div>
      )}

      {/* ================= CENTRAL APPLICATION SHELL ================= */}
      <div className="w-full h-screen flex flex-col bg-white md:w-[400px] md:h-[800px] md:rounded-[36px] md:border-[10px] md:border-zinc-900 md:shadow-2xl relative overflow-hidden transition-all duration-300">
        
        {/* Dynamic Mobile Header */}
        {!inRoom && isLoggedIn !== false && (
          <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-zinc-200/60 shrink-0 z-30 sticky top-0">
            <div className="flex items-center gap-2.5 md:hidden">
              <div className="relative">
                <img
                  src={userAvatar || PRESET_AVATARS[0]}
                  alt={userName || 'User'}
                  className="w-8 h-8 rounded-full border border-rose-500 object-cover"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-zinc-900 truncate max-w-[120px]">{userName}</span>
                {currentUserRole && currentUserRole !== 'user' && (
                  <span className="text-[8px] text-rose-600 font-bold uppercase tracking-wider leading-none mt-0.5">{currentUserRole}</span>
                )}
              </div>
            </div>

            {/* In-app Brand Logo (Centered/Visible on mobile header only) */}
            <div className="hidden md:block">
              <YoYoLogo className="scale-90" iconOnly />
            </div>
            <div className="md:hidden">
              <span className="font-display font-black text-sm tracking-wide bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                ZOYO
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Virtual Coin Counter for Mobile view */}
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-amber-700 font-black text-[10px] shadow-sm">
                <Coins className="w-3.5 h-3.5 fill-amber-500/10 text-amber-500 stroke-[2.5]" />
                <span>{currentUserRole === 'admin' ? '∞' : coins}</span>
              </div>
            </div>
          </div>
        )}

        {/* Screen Content Window */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-50">
          {children}
        </div>

        {/* Bottom Navigation (Only if not inRoom, logged in & always sticky to shell bottom) */}
        {!inRoom && isLoggedIn !== false && (
          <div className="bg-white/95 backdrop-blur-md border-t border-zinc-200/60 pb-6 pt-2.5 px-3 shrink-0 z-40 sticky bottom-0">
            <div 
              className="grid text-center max-w-md mx-auto"
              style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
            >
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'text-rose-600 scale-105 font-black'
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <div className="relative text-xl flex items-center justify-center">
                      <IconComponent className={`w-5 h-5 ${isSelected ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wide mt-1">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= DESKTOP RIGHT PANEL ================= */}
      {!inRoom && isLoggedIn !== false && (
        <div className="hidden lg:flex flex-col w-64 h-[800px] bg-white border border-zinc-200/80 rounded-[32px] p-6 ml-6 justify-between shadow-xl animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex flex-col gap-5">
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest px-1">Upcoming Tournaments</span>
            
            {/* Tournament Event Cards */}
            <div className="flex flex-col gap-3">
               <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 p-4 text-white shadow-md flex flex-col justify-between h-28">
                <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-white/10 rounded-full blur-md"></div>
                <span className="text-[8px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide self-start">
                  🏆 ZOYO LUDO CUP
                </span>
                <div>
                  <h4 className="text-[11px] font-black leading-tight">ZOYO LUDO WORLD CUP 5</h4>
                  <p className="text-[9px] text-white/90 mt-0.5 leading-tight font-medium">Join Games rooms to win 20,000 Coins & custom badges!</p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-800 p-4 text-white shadow-md flex flex-col justify-between h-28">
                <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-white/10 rounded-full blur-md"></div>
                <span className="text-[8px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide self-start">
                  🎡 LUCKY SPIN
                </span>
                <div>
                  <h4 className="text-[11px] font-black leading-tight">LUCKY WHEEL CARNIVAL</h4>
                  <p className="text-[9px] text-white/90 mt-0.5 leading-tight font-medium">Spin and receive dynamic gifts multiplied by 10x today!</p>
                </div>
              </div>
            </div>

            {/* Achievement / Active Levels Leaderboard preview */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest px-1">Active Leaderboard</span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] bg-stone-50 border border-zinc-200/50 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-amber-500">1st</span>
                    <span className="font-bold text-zinc-800">EliteHost</span>
                  </div>
                  <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black uppercase">Level 42</span>
                </div>
                <div className="flex items-center justify-between text-[11px] bg-stone-50 border border-zinc-200/50 p-2.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-zinc-400">2nd</span>
                    <span className="font-bold text-zinc-800">ZoyoGamer</span>
                  </div>
                  <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black uppercase">Level 35</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-400 border-t border-zinc-150 pt-3">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span>ZOYO Live Social © 2026</span>
          </div>
        </div>
      )}
    </div>
  );
}
