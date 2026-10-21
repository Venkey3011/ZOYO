import React, { useState, useRef } from 'react';
import { User } from '../types';
import { PRESET_AVATARS } from '../data';
import { 
  Award, Camera, Coins, Sparkles, Check, Edit2, ShieldAlert, 
  X, Globe, UserCheck, Calendar, MessageSquare, Fingerprint, 
  Smile, Copy, Upload, Image, Eye, LogOut, Users, Heart, ChevronRight
} from 'lucide-react';
import { toast } from './Toast';
import UserProfileModal from './UserProfileModal';
import CoinLedger from './CoinLedger';

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
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(currentUser.bio || 'Living life on ZOYO! 🌟');
  
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showVisitorsModal, setShowVisitorsModal] = useState(false);
  const [showPublicPreview, setShowPublicPreview] = useState(false);
  const [showCoinLedger, setShowCoinLedger] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const presetAvatars = PRESET_AVATARS;

  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim()) return;
    onUpdateNickname(editedName.trim());
    setIsEditingName(false);
    toast('Nickname updated! ✨', 'success');
  };

  const handleBioSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBio = editedBio.trim() || 'Living life on ZOYO! 🌟';
    try {
      const uId = currentUser._id || currentUser.id;
      await fetch(`/api/users/${uId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: newBio })
      });
      currentUser.bio = newBio;
      setIsEditingBio(false);
      toast('Profile bio updated! 📝', 'success');
    } catch {
      toast('Failed to update bio', 'error');
    }
  };

  // Compress & optimize uploaded image using canvas to ensure fast load & easy DB sync
  const processAndUploadImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please upload an image file (JPG, PNG, WebP)', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400; // 400x400 max for crisp DP
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
          onUpdateAvatar(compressedBase64);
          setShowAvatarModal(false);
          toast('Profile photo updated successfully! 📸✨', 'success');
        }
        setIsUploadingAvatar(false);
      };
      img.onerror = () => {
        setIsUploadingAvatar(false);
        toast('Failed to process image file', 'error');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploadingAvatar(false);
      toast('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    onUpdateAvatar(customUrlInput.trim());
    setCustomUrlInput('');
    setShowAvatarModal(false);
    toast('Profile photo updated from link! 🌐✨', 'success');
  };

  const medals = [
    { title: "Ludo Maestro", desc: "Win 10 fast-Ludo matches in voice rooms.", emoji: "🏆" },
    { title: "Generous Supporter", desc: "Send 20+ animated gifts to host seats.", emoji: "💎" },
    { title: "Active Talker", desc: "Speak on guest mic seats for 30 minutes.", emoji: "🎤" },
    { title: "Mall Tycoon", desc: "Unlock premium frames and bubble styles.", emoji: "👑" },
  ];

  const displayCoins = currentUser.role === 'admin' ? 'Infinite' : currentUser.coins;

  const frameClass =
    equippedFrame === 'frame_neon' ? 'border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]' :
    equippedFrame === 'frame_pink' ? 'border-2 border-rose-400 shadow-[0_0_10px_rgba(244,114,182,0.5)]' :
    equippedFrame === 'frame_royal' ? 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]' :
    equippedFrame === 'frame_cosmic' ? 'border-2 border-purple-500 animate-[spin_8s_linear_infinite]' :
    'border-2 border-zinc-200 bg-stone-100 shadow-inner';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 bg-slate-50 scrollbar-none h-full text-xs text-zinc-800 pb-32">
      
      {/* Profile Info Header Panel */}
      <div className="relative bg-white border border-zinc-200/80 rounded-3xl p-4 flex flex-col items-center shadow-sm shrink-0">
        
        {/* Top actions: Preview as Visitor */}
        <div className="w-full flex justify-between items-center mb-1">
          <button
            onClick={() => setShowDetailsModal(true)}
            className="text-[9px] bg-stone-100 hover:bg-stone-200 text-zinc-600 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Fingerprint className="w-3 h-3 text-rose-500" />
            <span>ID Card</span>
          </button>

          <button
            onClick={() => setShowPublicPreview(true)}
            className="text-[9px] bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 border border-rose-200/80 text-rose-600 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            title="See how visitors view your profile"
          >
            <Eye className="w-3 h-3" />
            <span>Visitor View</span>
          </button>
        </div>

        {/* Profile Avatar with DP Change Button */}
        <div className="relative mt-1 group">
          {/* Active equipped frame visualization around avatar */}
          <div 
            onClick={() => setShowAvatarModal(true)}
            className={`w-20 h-20 rounded-full flex items-center justify-center p-0.5 cursor-pointer hover:scale-105 active:scale-95 transition-all ${frameClass}`}
            title="Click to change profile picture"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          {/* Change Avatar Camera Button Overlay */}
          <button
            onClick={() => setShowAvatarModal(true)}
            className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full p-2 border-2 border-white shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Set profile picture"
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Change DP Quick Action Button */}
        <button
          onClick={() => setShowAvatarModal(true)}
          className="mt-2.5 flex items-center gap-1 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-black px-3 py-1 rounded-full border border-rose-200 transition-colors cursor-pointer shadow-xs"
        >
          <Camera className="w-3 h-3" />
          <span>Change Profile Picture</span>
        </button>

        {/* User Name & Edit */}
        {isEditingName ? (
          <form onSubmit={handleNameSave} className="flex items-center gap-1.5 mt-2.5 w-full max-w-[200px]">
            <input
              type="text"
              required
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="bg-stone-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs text-zinc-900 w-full text-center focus:outline-none focus:border-rose-500 font-bold"
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
          <div className="flex items-center gap-1.5 mt-2.5 cursor-pointer group" onClick={() => setIsEditingName(true)}>
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

        {/* ZOYO ID with 1-click Copy */}
        <div className="flex items-center gap-1.5 mt-2 bg-stone-50 border border-zinc-200/80 px-2.5 py-1 rounded-full text-[10px] shadow-xs">
          <span className="text-zinc-400 font-bold uppercase tracking-wider text-[8.5px]">ZOYO ID:</span>
          <span className="font-mono font-black text-rose-600 tracking-wide">{currentUser.yoyoId || '888888'}</span>
          <button
            onClick={() => {
              const idToCopy = currentUser.yoyoId || '888888';
              navigator.clipboard.writeText(idToCopy);
              toast('ZOYO ID copied to clipboard! 📋', 'success');
            }}
            className="flex items-center gap-0.5 text-[8.5px] bg-white border border-zinc-200 text-zinc-600 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded-full hover:bg-rose-50 transition-colors cursor-pointer shadow-xs ml-0.5"
            title="Copy ZOYO ID"
          >
            <Copy className="w-2.5 h-2.5" />
            <span>Copy</span>
          </button>
        </div>

        {/* Bio Motto Quote */}
        {isEditingBio ? (
          <form onSubmit={handleBioSave} className="flex items-center gap-1.5 mt-2 w-full max-w-[260px]">
            <input
              type="text"
              value={editedBio}
              onChange={(e) => setEditedBio(e.target.value)}
              placeholder="Write your profile status/motto..."
              className="bg-stone-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-[11px] text-zinc-800 w-full text-center focus:outline-none focus:border-rose-500"
              maxLength={80}
              autoFocus
            />
            <button
              type="submit"
              className="bg-rose-500 text-white px-2 py-1 rounded font-black cursor-pointer shadow text-[10px]"
            >
              Save
            </button>
          </form>
        ) : (
          <div 
            onClick={() => setIsEditingBio(true)}
            className="mt-2 flex items-center justify-center gap-1 text-[11px] text-zinc-500 italic cursor-pointer hover:text-zinc-800 transition-colors px-4 text-center max-w-[280px]"
            title="Click to edit bio"
          >
            <span>"{currentUser.bio || 'Living life on ZOYO! 🌟'}"</span>
            <Edit2 className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
          </div>
        )}

        {/* Level XP Progress Bar */}
        <div className="w-full max-w-[220px] bg-zinc-100 rounded-full h-1.5 mt-3 overflow-hidden border border-zinc-200/60">
          <div 
            className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(10, (currentUser.level * 12) % 100))}%` }}
          ></div>
        </div>
        <p className="text-[8px] text-zinc-400 mt-1 uppercase font-black">Level {currentUser.level} Progress: {((currentUser.level * 12) % 100)}%</p>

        {/* 4-Column Profile Metrics Bar */}
        <div className="grid grid-cols-4 gap-1 w-full border-t border-zinc-150 pt-3.5 mt-3">
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
          <div 
            onClick={() => setShowVisitorsModal(true)}
            className="text-center cursor-pointer hover:bg-rose-50/50 rounded-lg transition-colors p-0.5"
            title="Click to view who visited your profile"
          >
            <p className="text-sm font-black text-rose-600 flex items-center justify-center gap-0.5">
              <span>{currentUser.visitorsCount ?? 0}</span>
              <Eye className="w-2.5 h-2.5 text-rose-500" />
            </p>
            <p className="text-[8px] text-rose-500 font-bold uppercase tracking-wider leading-tight underline decoration-rose-300">Visitors</p>
          </div>
        </div>
      </div>

      {/* Virtual Wallet Coins Card — tap to view ledger */}
      <button
        onClick={() => setShowCoinLedger(true)}
        className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl p-3.5 flex items-center justify-between shrink-0 shadow-sm w-full cursor-pointer hover:border-amber-300 active:scale-[0.98] transition-all text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-400/30">
            <Coins className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] text-amber-600/80 font-bold uppercase tracking-wider">Virtual Wallet Coins</p>
            <p className="text-sm font-black text-amber-600 flex items-center gap-1 mt-0.5">
              <span>🪙</span>
              <span className="font-mono">
                {displayCoins === 'Infinite' ? '∞ Infinite Coins' : `${Number(displayCoins).toLocaleString()} Gold Coins`}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] bg-amber-100 text-amber-700 font-black border border-amber-200 px-2 py-1 rounded-full uppercase shadow-sm">
            {currentUser.role === 'admin' ? 'Staff MAX' : (currentUser.vipStatus && currentUser.vipStatus !== 'None' ? currentUser.vipStatus : 'Standard')}
          </span>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </div>
      </button>

      {/* Active Family Widget */}
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

      {/* Virtual Badges & Medals Grid — Clean flow, no nested overflow cutting off cards! */}
      <div className="bg-white border border-zinc-200/80 rounded-3xl p-4 shrink-0 flex flex-col gap-3 shadow-sm">
        <h3 className="font-black text-zinc-700 flex items-center gap-1.5 text-xs">
          <Award className="w-4 h-4 text-amber-500" /> Achievement Medal Wall
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {medals.map((medal, i) => (
            <div
              key={i}
              className="bg-stone-50/80 border border-zinc-200/70 rounded-2xl p-3 flex flex-col items-center text-center shadow-2xs hover:bg-stone-50 transition-colors"
            >
              <span className="text-2xl drop-shadow-sm mb-1">{medal.emoji}</span>
              <h4 className="font-black text-zinc-800 text-[11px] leading-tight">{medal.title}</h4>
              <p className="text-[9px] text-zinc-400 mt-1 leading-normal">{medal.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Log Out Action */}
      <div className="shrink-0 pt-1">
        <button
          onClick={onLogout}
          className="w-full bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 text-zinc-600 hover:text-rose-600 font-black py-3 rounded-2xl cursor-pointer transition-all uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 shadow-sm active:scale-98"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Log Out Account</span>
        </button>
      </div>

      {/* ================= MODAL 1: CHANGE PROFILE PICTURE / DP ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-[32px] p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-rose-500" /> Set Profile Picture (DP)
              </h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-zinc-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current avatar preview */}
            <div className="flex flex-col items-center gap-2 py-1">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center p-0.5 ${frameClass}`}>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Current Avatar</span>
            </div>

            {/* Option A: Upload from Device */}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processAndUploadImage(file);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-xs shadow-md shadow-rose-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>{isUploadingAvatar ? 'Processing Photo...' : 'Upload Photo from Device'}</span>
              </button>
              <p className="text-[9px] text-zinc-400 text-center font-medium">
                Supports JPG, PNG, WebP photos. Automatically optimized for fast loading.
              </p>
            </div>

            {/* Option B: Choose Preset Avatar */}
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Or choose a preset avatar</span>
              <div className="grid grid-cols-5 gap-2">
                {presetAvatars.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onUpdateAvatar(av);
                      setShowAvatarModal(false);
                      toast('Preset avatar applied! ✨', 'success');
                    }}
                    className={`rounded-full p-0.5 border-2 transition-transform hover:scale-110 cursor-pointer ${
                      currentUser.avatar === av ? 'border-rose-500 ring-2 ring-rose-200' : 'border-zinc-200'
                    }`}
                  >
                    <img src={av} alt="" className="w-10 h-10 rounded-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Option C: Image URL Input */}
            <form onSubmit={handleCustomUrlSubmit} className="flex flex-col gap-1.5 border-t border-zinc-100 pt-3">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Or paste an image web link</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 bg-stone-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!customUrlInput.trim()}
                  className="bg-zinc-800 hover:bg-zinc-900 disabled:opacity-40 text-white px-3 py-2 rounded-xl font-black text-xs cursor-pointer transition-colors"
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: RECENT VISITORS LIST ================= */}
      {showVisitorsModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-[32px] p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[80vh]">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-150">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-rose-500" /> Profile Visitors ({currentUser.visitorsCount ?? 0})
              </h3>
              <button
                onClick={() => setShowVisitorsModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-zinc-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-medium">
              People who visited and checked out your profile recently:
            </p>

            <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-2 min-h-[160px]">
              {Array.isArray(currentUser.recentVisitors) && currentUser.recentVisitors.length > 0 ? (
                currentUser.recentVisitors.map((visitor, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-200/70 rounded-2xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={visitor.avatar || PRESET_AVATARS[0]}
                        alt={visitor.name}
                        className="w-9 h-9 rounded-full object-cover border border-zinc-200 shadow-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-black text-xs text-zinc-900 truncate">{visitor.name}</p>
                        <p className="text-[9px] text-zinc-400 font-mono font-bold">
                          ZOYO ID: <span className="text-rose-600">{visitor.yoyoId || 'N/A'}</span>
                        </p>
                      </div>
                    </div>
                    {visitor.visitedAt && (
                      <span className="text-[8.5px] text-zinc-400 font-bold shrink-0">
                        {new Date(visitor.visitedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <Eye className="w-8 h-8 text-zinc-300" />
                  <p className="font-black text-xs text-zinc-700">No Visitors Recorded Yet</p>
                  <p className="text-[10px] text-zinc-400 max-w-[200px]">
                    Join active voice rooms and chat with friends to get profile visits!
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowVisitorsModal(false)}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 font-black rounded-xl text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: IDENTITY DETAILS CARD ================= */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-[32px] p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 shadow-2xl relative">
            <button
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1.5 rounded-full text-xs cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center border-b border-zinc-150 pb-3 mt-2">
              <div className="relative inline-block">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center p-0.5 mx-auto ${frameClass}`}>
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              <h3 className="text-sm font-black text-zinc-900 mt-2">{currentUser.name}</h3>
              <p className="text-[10px] text-rose-500 font-black tracking-wider uppercase mt-0.5">
                ZOYO Official Member Card
              </p>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl">
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

              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Account Role</p>
                    <p className="text-xs font-extrabold text-zinc-800 capitalize">{currentUser.role || 'user'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-150 rounded-xl">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  <div>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Country Region</p>
                    <p className="text-xs font-bold text-zinc-800">{currentUser.country || 'Global'}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDetailsModal(false)}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-[10px] cursor-pointer shadow-md mt-1"
            >
              Close Card
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: PUBLIC VISITOR VIEW PREVIEW ================= */}
      {showPublicPreview && (
        <UserProfileModal
          user={currentUser}
          currentUser={currentUser}
          isOpen={showPublicPreview}
          onClose={() => setShowPublicPreview(false)}
        />
      )}

      {/* ================= MODAL 5: COIN LEDGER / TRANSACTION HISTORY ================= */}
      {showCoinLedger && (
        <CoinLedger
          currentUser={currentUser}
          onClose={() => setShowCoinLedger(false)}
        />
      )}
    </div>
  );
}
