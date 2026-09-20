import React, { useState } from 'react';
import { User } from '../types';
import { Award, Camera, Coins, Sparkles, Check, Edit2, ShieldAlert, X, Globe, UserCheck, Calendar, MessageSquare, Fingerprint, Smile } from 'lucide-react';

interface ProfileTabProps {
  currentUser: User;
  onUpdateNickname: (name: string) => void;
  onUpdateAvatar: (avatar: string) => void;
  unlockedFrames: string[];
  unlockedBubbles: string[];
  equippedFrame: string;
  equippedBubble: string;
  onLogout: () => void;
}

export default function ProfileTab({
  currentUser,
  onUpdateNickname,
  onUpdateAvatar,
  unlockedFrames,
  unlockedBubbles,
  equippedFrame,
  equippedBubble,
  onLogout,
}: ProfileTabProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(currentUser.name);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const presetAvatars = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80', // default male
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80', // zara
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80', // aria
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', // kai
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80', // dexter
  ];

  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim()) return;
    onUpdateNickname(editedName.trim());
    setIsEditingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          onUpdateAvatar(base64);
          console.log('✅ Avatar uploaded:', base64.substring(0, 50) + '...');
        }
        setIsUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ Error uploading avatar:', err);
      setIsUploadingAvatar(false);
    }
  };

  const medals = [
    { title: "Ludo Maestro", desc: "Win 10 fast-Ludo matches in voice rooms.", emoji: "🏆" },
    { title: "Generous Supporter", desc: "Send 20+ animated gifts to host seats.", emoji: "💎" },
    { title: "Active Talker", desc: "Speak on guest mic seats for 30 minutes.", emoji: "🎤" },
    { title: "Mall Tycoon", desc: "Unlock premium frames and bubble styles.", emoji: "👑" },
  ];

  const displayCoins = currentUser.role === 'admin' ? 'Infinite' : currentUser.coins;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 bg-slate-50 scrollbar-none h-full text-xs text-zinc-800">
      
      {/* Profile Info Header Panel */}
      <div className="relative bg-white border border-zinc-200/80 rounded-3xl p-4 flex flex-col items-center shadow-sm shrink-0">
        
        {/* Profile Avatar Triggering Details Modal */}
        <div className="relative group cursor-pointer" onClick={() => setShowDetailsModal(true)}>
          {/* Active equipped frame visualization around avatar */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center p-0.5 hover:scale-105 active:scale-95 transition-all ${
            equippedFrame === 'frame_neon' ? 'border-2 border-cyan-400 animate-pulse' :
            equippedFrame === 'frame_pink' ? 'border-2 border-rose-400 shadow-sm' :
            equippedFrame === 'frame_royal' ? 'border-2 border-yellow-400' :
            equippedFrame === 'frame_cosmic' ? 'border-2 border-purple-500' :
            'border border-zinc-200 bg-stone-100 shadow-inner'
          }`}>
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          {/* Change Avatar Camera Button Overlay */}
          <div className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-1.5 border border-white shadow-md">
            <Camera className="w-3 h-3 text-white" />
          </div>

          {/* Details helper bubble */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[8px] font-black py-0.5 px-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap uppercase tracking-wider">
            Click to view ID & Details
          </div>
        </div>

        {/* Preset quick avatar tray shown directly under */}
        <div className="flex gap-2.5 mt-2.5 justify-center flex-wrap">
          {presetAvatars.map((av, idx) => (
            <img
              key={idx}
              src={av}
              alt=""
              onClick={() => onUpdateAvatar(av)}
              className={`w-6 h-6 rounded-full object-cover cursor-pointer hover:scale-115 transition-transform border ${
                currentUser.avatar === av ? 'border-rose-500 border-2' : 'border-zinc-200'
              }`}
            />
          ))}

          {/* Upload Custom Avatar Button */}
          <label className="relative w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 cursor-pointer hover:scale-115 transition-transform border border-white flex items-center justify-center shadow-sm">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
              className="hidden"
            />
            <span className="text-xs text-white font-black">+</span>
            {isUploadingAvatar && (
              <div className="absolute inset-0 bg-black/30 rounded-full animate-pulse"></div>
            )}
          </label>
        </div>
      

        {/* User Name & Edit */}
        {isEditingName ? (
          <form onSubmit={handleNameSave} className="flex items-center gap-1.5 mt-3.5 w-full max-w-[200px]">
            <input
              type="text"
              required
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="bg-stone-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs text-zinc-900 w-full text-center focus:outline-none focus:border-rose-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-emerald-500 text-white px-2 py-1 rounded font-black cursor-pointer shadow"
            >
              ✓
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 mt-3 cursor-pointer group" onClick={() => setIsEditingName(true)}>
            <h2 className="text-sm font-black text-zinc-900 flex items-center gap-1">
              {currentUser.name}
            </h2>
            <Edit2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-rose-500 transition-colors" />
          </div>
        )}

        {/* User Stats Level Info */}
        <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
          <span className="font-extrabold text-rose-500">{currentUser.badge}</span>
          <span>•</span>
          <span className="font-bold">Lvl {currentUser.level}</span>
        </div>

        {/* Level XP Progress Bar */}
        <div className="w-full max-w-[220px] bg-zinc-100 rounded-full h-1.5 mt-3 overflow-hidden border border-zinc-200/60">
          <div 
            className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(10, (currentUser.level * 12) % 100))}%` }}
          ></div>
        </div>
        <p className="text-[8px] text-zinc-400 mt-1 uppercase font-black">Level {currentUser.level} Progress: {((currentUser.level * 12) % 100)}%</p>

        {/* 4-Column Profile Metrics Bar */}
        <div className="grid grid-cols-4 gap-1 w-full border-t border-zinc-150 pt-3.5 mt-4">
          <div className="text-center border-r border-zinc-100">
            <p className="text-sm font-black text-zinc-800">{currentUser.followersCount ?? 0}</p>
            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider leading-tight">Followers</p>
          </div>
          <div className="text-center border-r border-zinc-100">
            <p className="text-sm font-black text-zinc-800">{currentUser.followingCount ?? 0}</p>
            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider leading-tight">Following</p>
          </div>
          <div className="text-center border-r border-zinc-100">
            <p className="text-sm font-black text-zinc-800">{currentUser.giftsCount ?? 0}</p>
            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider leading-tight">Gifts</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-zinc-800">{currentUser.visitorsCount ?? 0}</p>
            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider leading-tight">Visitors</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-3xl p-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Virtual Wallet Coins</p>
              <p className="text-xs font-black text-amber-600 flex items-center gap-1 mt-0.5">
                <span>🪙</span>
                <span className="text-sm font-mono font-black">
                  {displayCoins === 'Infinite' ? '∞ Infinite Coins' : `${displayCoins} Gold Coins`}
                </span>
              </p>
            </div>
          </div>
          <span className="text-[9px] bg-amber-50 text-amber-700 font-black border border-amber-200 px-2.5 py-1 rounded-full uppercase shadow-sm">
            {currentUser.role === 'admin' ? 'Staff MAX' : (currentUser.vipStatus && currentUser.vipStatus !== 'None' ? currentUser.vipStatus : 'Standard')}
          </span>
        </div>

      {/* Family Widget */}
      <div className="bg-white border border-zinc-200/80 rounded-3xl p-3.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-lg shadow-sm">
            🛡️
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Active Family</p>
            <p className="text-xs font-black text-zinc-800 mt-0.5">{currentUser.family || 'None'}</p>
          </div>
        </div>
        <span className="text-[9px] bg-stone-50 border border-zinc-200 text-zinc-500 px-2.5 py-1 rounded-full font-black uppercase">
          Member
        </span>
      </div>

      {/* VIP/SVIP Showcase Widget */}
      <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 border border-amber-200 rounded-3xl p-3.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white w-9 h-9 rounded-2xl flex items-center justify-center text-base shadow-md">
            👑
          </div>
          <div>
            <p className="text-[10px] text-amber-600 font-black uppercase tracking-wider">VIP Membership</p>
            <p className="text-xs font-black text-zinc-800 mt-0.5">
              {currentUser.role === 'admin' ? 'SVIP Staff Administrator' : 
               (currentUser.vipStatus && currentUser.vipStatus !== 'None' ? `${currentUser.vipStatus} Account` : 'Standard Account')}
            </p>
          </div>
        </div>
        <span className="text-[9px] bg-white border border-amber-300 text-amber-700 px-3 py-1 rounded-full font-black uppercase shadow-sm">
          {currentUser.vipStatus && currentUser.vipStatus !== 'None' ? currentUser.vipStatus : 'No VIP'}
        </span>
      </div>

      {/* Privileges Showcase Widget (Frames / Bubbles unlocked) */}
      <div className="bg-white border border-zinc-200/80 rounded-3xl p-3.5 shrink-0 flex flex-col gap-2 shadow-sm">
        <h3 className="font-black text-zinc-700 flex items-center gap-1.5 font-display text-[11px] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> Style Privileges (Unlocked)
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-stone-50 p-2.5 rounded-2xl flex items-center justify-between border border-zinc-150">
            <div>
              <p className="text-zinc-500 font-medium">Avatar Frames</p>
              <p className="text-zinc-800 font-extrabold mt-0.5">{unlockedFrames.length} Unlocked</p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>

          <div className="bg-stone-50 p-2.5 rounded-2xl flex items-center justify-between border border-zinc-150">
            <div>
              <p className="text-zinc-500 font-medium">Chat Bubbles</p>
              <p className="text-zinc-800 font-extrabold mt-0.5">{unlockedBubbles.length} Unlocked</p>
            </div>
            <MessageSquare className="w-4 h-4 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Virtual Badges & Medals Grid */}
      <div className="flex-1 flex flex-col gap-2 min-h-[160px] pb-12">
        <h3 className="font-black text-zinc-700 flex items-center gap-1 px-1 mt-1">
          <Award className="w-3.5 h-3.5 text-amber-500" /> Achievement Medal Wall
        </h3>

        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-0.5 scrollbar-none pb-4">
          {medals.map((medal, i) => (
            <div
              key={i}
              className="bg-white border border-zinc-200 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-sm"
            >
              <span className="text-2xl drop-shadow-sm animate-[pulse_3s_infinite]">{medal.emoji}</span>
              <h4 className="font-black text-zinc-800 mt-1 leading-tight">{medal.title}</h4>
              <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{medal.desc}</p>
            </div>
          ))}
        </div>

        {/* Log Out Action */}
        <button
          onClick={onLogout}
          className="w-full mt-2 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-zinc-500 hover:text-rose-600 font-black py-2.5 rounded-xl cursor-pointer transition-all uppercase tracking-wider text-[10px]"
        >
          🚪 Log Out Account
        </button>
      </div>

      {/* --- PROFILE DETAILS MODAL DIALOG --- */}
      {showDetailsModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 shadow-2xl relative">
            <button
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1.5 rounded-full text-xs cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center border-b border-zinc-150 pb-3 mt-2">
              {/* Profile details avatar */}
              <div className="relative inline-block">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center p-0.5 mx-auto ${
                  equippedFrame === 'frame_neon' ? 'border-2 border-cyan-400' :
                  equippedFrame === 'frame_pink' ? 'border-2 border-rose-400' :
                  equippedFrame === 'frame_royal' ? 'border-2 border-yellow-400' :
                  equippedFrame === 'frame_cosmic' ? 'border-2 border-purple-500' :
                  'border border-zinc-200 bg-stone-100 shadow-inner'
                }`}>
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              <h3 className="text-sm font-black text-zinc-900 mt-2">{currentUser.name}</h3>
              <p className="text-[10px] text-rose-500 font-black tracking-wider uppercase mt-0.5">
                ZOYO Premium Member Card
              </p>
            </div>

            {/* List of identity credentials retrieved during signup */}
            <div className="flex flex-col gap-2 text-xs">
              
              {/* ZOYO ID field */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl shadow-inner">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-rose-500 stroke-[2.5]" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">ZOYO ID Number</p>
                    <p className="text-xs font-mono font-black text-rose-600">{currentUser.yoyoId || 'None'}</p>
                  </div>
                </div>
                <span className="text-[8px] bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.2 rounded font-black uppercase">
                  Verified
                </span>
              </div>

              {/* Gender field */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl shadow-inner">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-zinc-500" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">User Gender</p>
                    <p className="text-xs font-black text-zinc-700">{currentUser.gender || 'Other'}</p>
                  </div>
                </div>
              </div>

              {/* DOB field */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl shadow-inner">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Date of Birth</p>
                    <p className="text-xs font-black text-zinc-700">{currentUser.dateOfBirth || '2005-01-01'}</p>
                  </div>
                </div>
              </div>

              {/* Country field */}
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl shadow-inner">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-500" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Country Location</p>
                    <p className="text-xs font-black text-zinc-700">{currentUser.country || 'Saudi Arabia'}</p>
                  </div>
                </div>
              </div>

            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full bg-rose-600 text-white font-black py-2.5 rounded-xl hover:bg-rose-700 cursor-pointer text-xs mt-1 uppercase"
            >
              Close details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
