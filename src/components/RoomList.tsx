import React, { useState, useRef, useEffect } from 'react';
import { Room, User } from '../types';
import { PRESET_AVATARS } from '../data';
import { Search, Plus, Sparkles, Trophy, Users, Flame, Globe, Dices, MessageSquare, Music, Mic, Lock, Eye, EyeOff, Hash, ImagePlus, X, ExternalLink } from 'lucide-react';

import { registerBackHandler } from '../lib/navigation';
import { compressImageToDataUrl } from '../lib/imageCompressor';

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string, password?: string, room?: Room) => void;
  onCreateRoom: (
    title: string,
    category: 'chat' | 'games' | 'singing' | 'match',
    theme: 'neon' | 'pink' | 'royal' | 'cosmic',
    isPrivate?: boolean,
    roomPassword?: string,
    activeGame?: string,
    isOfficialGame?: boolean,
    gamePrizePool?: number,
    roomImage?: string
  ) => void;
  currentUser: User;
}

export default function RoomList({ rooms, onJoinRoom, onCreateRoom, currentUser }: RoomListProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Form states
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [roomCategory, setRoomCategory] = useState<'chat' | 'games' | 'singing' | 'match'>('chat');
  const [roomTheme, setRoomTheme] = useState<'neon' | 'pink' | 'royal' | 'cosmic'>('neon');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [roomImage, setRoomImage] = useState<string>('');
  const roomImageRef = useRef<HTMLInputElement>(null);

  // Password prompt modal for private rooms
  const [passwordModal, setPasswordModal] = useState<{ roomId: string; roomTitle: string } | null>(null);
  const [enteredPassword, setEnteredPassword] = useState<string>('');
  const [showEnteredPwd, setShowEnteredPwd] = useState<boolean>(false);
  const [pwdError, setPwdError] = useState<string>('');
  const [joiningRoom, setJoiningRoom] = useState<boolean>(false);

  // Room code lookup modal
  const [showCodeLookup, setShowCodeLookup] = useState<boolean>(false);
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupError, setLookupError] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);

  const [searchedPrivateRoom, setSearchedPrivateRoom] = useState<Room | null>(null);

  // Admin-managed ad banners
  const [adBanners, setAdBanners] = useState<any[]>([]);
  const [adBannerIndex, setAdBannerIndex] = useState(0);
  useEffect(() => {
    fetch('/api/ads').then(r => r.json()).then(d => { if (d.success && d.ads?.length) setAdBanners(d.ads); }).catch(() => {});
  }, []);
  // Auto-scroll banners
  useEffect(() => {
    if (adBanners.length <= 1) return;
    const t = setInterval(() => setAdBannerIndex(i => (i + 1) % adBanners.length), 4000);
    return () => clearInterval(t);
  }, [adBanners.length]);

  // Handle hardware / gesture back button to close any open modal
  useEffect(() => {
    if (showCreateModal || passwordModal || showCodeLookup) {
      return registerBackHandler(() => {
        if (showCreateModal) {
          setShowCreateModal(false);
          return true;
        }
        if (passwordModal) {
          setPasswordModal(null);
          return true;
        }
        if (showCodeLookup) {
          setShowCodeLookup(false);
          return true;
        }
        return false;
      });
    }
  }, [showCreateModal, passwordModal, showCodeLookup]);

  // Debounced search for private rooms by 6-digit room code
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 5) {
      setSearchedPrivateRoom(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/rooms/bycode/${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            setSearchedPrivateRoom(data.room);
          } else {
            setSearchedPrivateRoom(null);
          }
        } else {
          setSearchedPrivateRoom(null);
        }
      } catch {
        setSearchedPrivateRoom(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const categories = [
    { id: 'all', label: 'All Rooms', icon: Globe },
    { id: 'games', label: 'Games', icon: Dices },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'singing', label: 'Singing', icon: Music },
    { id: 'match', label: 'Match', icon: Sparkles },
  ];

  const filteredRooms = rooms.filter((room) => {
    const matchesCategory = activeCategory === 'all' || room.category === activeCategory;
    const matchesSearch = room.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          Boolean(room.host?.yoyoId && String(room.host.yoyoId).toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
                          Boolean(room.roomId && String(room.roomId).toLowerCase().includes(searchQuery.toLowerCase().trim()));
    return matchesCategory && matchesSearch;
  });

  const displayRooms = [...filteredRooms];
  if (searchedPrivateRoom) {
    const privId = (searchedPrivateRoom as any)._id || searchedPrivateRoom.id;
    if (!displayRooms.some(r => ((r as any)._id || r.id) === privId)) {
      displayRooms.unshift(searchedPrivateRoom);
    }
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTitle.trim()) return;
    if (isPrivate && !roomPassword.trim()) {
      alert('Please set a room password for private rooms.');
      return;
    }
    onCreateRoom(roomTitle, roomCategory, roomTheme, isPrivate, roomPassword, undefined, undefined, undefined, roomImage || undefined);
    setRoomTitle('');
    setRoomPassword('');
    setIsPrivate(false);
    setRoomImage('');
    setShowCreateModal(false);
  };

  const handleRoomClick = (room: Room) => {
    const roomId = (room as any)._id || room.id;
    const uid = String(currentUser._id || currentUser.id || '');
    const hostId = String((room.host as any)?._id || room.host?.id || '');
    const isHost = (uid && hostId && uid === hostId) || (currentUser.name && room.host?.name && currentUser.name === room.host.name);
    const isInvited = Array.isArray(room.invitedUsers) && (
      room.invitedUsers.map(String).includes(uid) ||
      (currentUser.yoyoId && room.invitedUsers.map(String).includes(String(currentUser.yoyoId)))
    );

    if (room.isPrivate && !isHost && !isInvited) {
      setPasswordModal({ roomId, roomTitle: room.title });
      setEnteredPassword('');
      setPwdError('');
      setShowEnteredPwd(false);
    } else {
      onJoinRoom(roomId, undefined, room);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordModal) return;
    if (!enteredPassword.trim()) {
      setPwdError('Please enter the room password.');
      return;
    }
    setJoiningRoom(true);
    try {
      const res = await fetch(`/api/rooms/${passwordModal.roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUser, password: enteredPassword.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordModal(null);
        onJoinRoom(passwordModal.roomId, enteredPassword.trim());
      } else {
        setPwdError(data.error || 'Incorrect password. Try again.');
      }
    } catch {
      setPwdError('Connection error. Please try again.');
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleCodeLookup = async () => {
    if (!lookupCode.trim() || lookupCode.length !== 6) {
      setLookupError('Please enter a valid 6-digit room code.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const res = await fetch(`/api/rooms/bycode/${lookupCode.trim()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const room: Room = data.room;
        const roomId = (room as any)._id || room.id;
        setShowCodeLookup(false);
        setLookupCode('');

        const uid = String(currentUser._id || currentUser.id || '');
        const hostId = String((room.host as any)?._id || room.host?.id || '');
        const isHost = (uid && hostId && uid === hostId) || (currentUser.name && room.host?.name && currentUser.name === room.host.name);
        const isInvited = Array.isArray(room.invitedUsers) && (
          room.invitedUsers.map(String).includes(uid) ||
          (currentUser.yoyoId && room.invitedUsers.map(String).includes(String(currentUser.yoyoId)))
        );

        if (room.isPrivate && !isHost && !isInvited) {
          setPasswordModal({ roomId, roomTitle: room.title });
          setEnteredPassword('');
          setPwdError('');
        } else {
          onJoinRoom(roomId, undefined, room);
        }
      } else {
        setLookupError(data.error || 'Room not found. Check the code and try again.');
      }
    } catch {
      setLookupError('Connection error. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 relative h-full flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 scrollbar-none pb-28 overscroll-contain">
      {/* Search Header */}
      <div className="relative flex items-center shrink-0 gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search voice rooms, host ZOYO ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all shadow-sm font-medium"
          />
        </div>
        {/* Room Code Join Button */}
        <button
          onClick={() => { setShowCodeLookup(true); setLookupCode(''); setLookupError(''); }}
          title="Join by Room Code"
          className="flex items-center gap-1.5 bg-white border border-zinc-200 hover:border-rose-400 text-zinc-600 hover:text-rose-600 font-bold text-[10px] px-3 py-2 rounded-full shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Code</span>
        </button>
      </div>

      {/* Featured Banners Slider — Admin-managed */}
      {adBanners.length > 0 && (
        <div className="relative shrink-0 overflow-hidden rounded-[24px] h-24 shadow-md flex flex-col justify-between group"
          style={{ background: `linear-gradient(to right, var(--tw-gradient-from, #f43f5e), var(--tw-gradient-to, #db2777))` }}
        >
          {adBanners.map((ad, idx) => {
            const hasLink = Boolean(ad.link_url && ad.link_url.trim());
            const hasImage = Boolean(ad.image_url && ad.image_url.trim());
            const isVisible = idx === adBannerIndex;

            const handleBannerClick = () => {
              if (!hasLink) return;
              let url = ad.link_url.trim();
              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
              }
              window.open(url, '_blank', 'noopener,noreferrer');
            };

            return (
              <div
                key={ad._id}
                onClick={handleBannerClick}
                className={`absolute inset-0 p-4 flex flex-col justify-between transition-opacity duration-700 ${isVisible ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${hasLink ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${!hasImage ? `bg-gradient-to-r from-${ad.gradient_from || 'rose-500'} to-${ad.gradient_to || 'pink-600'}` : 'bg-black'}`}
              >
                {/* Custom uploaded banner image from storage */}
                {hasImage ? (
                  <>
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/30" />
                  </>
                ) : (
                  <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-white/10 rounded-full blur-md" />
                )}

                <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] bg-black/40 backdrop-blur-xs text-white font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase shadow-xs">
                      {ad.badge || '🔥 Live Event'}
                    </span>
                    {hasLink && (
                      <span className="text-[8px] bg-white/20 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow-xs">
                        <ExternalLink className="w-2.5 h-2.5" /> Visit
                      </span>
                    )}
                  </div>
                  {adBanners.length > 1 && (
                    <div className="flex gap-1.5 bg-black/20 backdrop-blur-xs px-2 py-1 rounded-full" onClick={(e) => e.stopPropagation()}>
                      {adBanners.map((_, i) => (
                        <button key={i} onClick={() => setAdBannerIndex(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${i === adBannerIndex ? 'bg-white scale-125' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10">
                  <h3 className="text-xs font-display font-black text-white leading-tight uppercase tracking-wide drop-shadow-md flex items-center gap-1">
                    <span>{ad.title}</span>
                    {hasLink && <ExternalLink className="w-3 h-3 text-white/80 shrink-0 inline-block" />}
                  </h3>
                  {ad.subtitle && <p className="text-[10px] text-white/90 mt-0.5 font-medium leading-none drop-shadow-md">{ad.subtitle}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Categories Tabs */}
      <div className="flex gap-2 overflow-x-auto shrink-0 pb-1 scrollbar-none">
        {categories.map((cat) => {
          const IconComponent = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                activeCategory === cat.id
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white border-transparent shadow-sm shadow-rose-500/15'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Rooms List Section */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 pb-12">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Voice Rooms ({displayRooms.length})</span>
          <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> HOT LOUNGES
          </span>
        </div>

        {displayRooms.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center gap-3 bg-white/70 border border-zinc-200/80 rounded-3xl shadow-xs my-2">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-tr from-rose-50 to-pink-50 rounded-2xl flex items-center justify-center border border-rose-200/60 shadow-xs">
                <Mic className="w-7 h-7 text-rose-500 stroke-[2] animate-bounce" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>

            <div className="flex flex-col gap-1 max-w-[240px]">
              <h4 className="font-display font-black text-sm text-zinc-900">
                {searchQuery ? `No rooms matching "${searchQuery}"` : "No Active Voice Rooms"}
              </h4>
              <p className="text-[11px] leading-relaxed text-zinc-400 font-medium">
                {searchQuery
                  ? "Try searching for a different room title, host ZOYO ID, or 6-digit Room Code."
                  : "Be the first to open a live party or hangout room! Tap below to start your room."}
              </p>
            </div>

            {!searchQuery && (
              <button
                onClick={() => {
                  setRoomTitle(`${currentUser.name}'s ${roomCategory.toUpperCase()} Lounge`);
                  setShowCreateModal(true);
                }}
                className="mt-1 flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-md shadow-rose-500/20 active:scale-95 hover:opacity-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Voice Room</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pr-0.5 pb-2">
            {displayRooms.map((room) => {
              const roomId = (room as any)._id || room.id;
              return (
                <div
                  key={roomId}
                  onClick={() => handleRoomClick(room)}
                  className={`group relative bg-white border rounded-2xl p-3.5 flex flex-col justify-between h-28 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                    room.isPrivate
                      ? 'border-amber-200 hover:border-amber-400'
                      : 'border-zinc-200 hover:border-rose-500/60'
                  }`}
                >
                  {/* Private badge */}
                  {room.isPrivate && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                      <Lock className="w-2.5 h-2.5" /> PRIVATE
                    </span>
                  )}

                  {/* Active game corner marker */}
                  {!room.isPrivate && room.activeGame !== 'none' && (
                    <span className="absolute top-3 right-3 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                      <span>{(room.activeGame || 'none').toUpperCase()} PLAYING</span>
                    </span>
                  )}

                  <div className="flex gap-3">
                    {/* Room Cover or Host Avatar */}
                    <div className="relative shrink-0">
                      {(room as any).roomImage ? (
                        <img
                          src={(room as any).roomImage}
                          alt="Room cover"
                          className={`w-12 h-12 rounded-xl object-cover border-2 ${room.isPrivate ? 'border-amber-400' : 'border-rose-500'}`}
                        />
                      ) : (
                        <img
                          src={(room.host?.avatar) || PRESET_AVATARS[0]}
                          alt={(room.host?.name) || 'Unknown Host'}
                          className={`w-12 h-12 rounded-full object-cover border-2 ${room.isPrivate ? 'border-amber-400' : 'border-rose-500'}`}
                        />
                      )}
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
                        H
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <h3 className={`text-xs font-display font-black text-zinc-900 truncate transition-colors ${room.isPrivate ? 'group-hover:text-amber-600' : 'group-hover:text-rose-600'}`}>
                        {room.isPrivate && <Lock className="inline w-3 h-3 mr-1 text-amber-500" />}
                        {room.title || 'Untitled Room'}
                      </h3>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                        Host: <span className="text-zinc-700 font-extrabold">{room.host?.name || 'Unknown Host'}</span>
                        {room.host?.yoyoId && (
                          <span className="text-[9px] text-rose-500/80 font-mono font-bold ml-1.5">ID: {room.host.yoyoId}</span>
                        )}
                        <span className="text-[9px] text-zinc-400 ml-1">• Lvl {room.host?.level || 1}</span>
                        {room.roomId && (
                          <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono font-bold ml-1.5" title="Room Code">
                            #{room.roomId}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[9px] bg-stone-100 text-zinc-600 px-2 py-0.5 rounded-md font-extrabold border border-zinc-200 uppercase tracking-wide">
                          {room.category || 'chat'}
                        </span>
                        {room.isPrivate && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                            🔒 Password Protected
                          </span>
                        )}
                        {!room.isPrivate && (room.category || 'chat') === 'games' && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                            🎲 2-4 Players
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom line */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-100">
                    <span className="text-[10px] text-zinc-400 truncate max-w-[200px] font-medium italic">
                      {room.isPrivate ? '🔐 Private Room — Enter password to join' : `"${room.description}"`}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <Users className="w-3 h-3 text-emerald-600" />
                      <span>{room.onlineCount || 1} online</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Create Room Button Floating */}
      <button
        onClick={() => {
          setRoomTitle(`${currentUser.name}'s ${roomCategory.toUpperCase()} Lobby`);
          setIsPrivate(false);
          setRoomPassword('');
          setShowCreateModal(true);
        }}
        className="absolute bottom-6 right-5 w-12 h-12 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/25 hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 border border-white/25"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* ===== Create Room Modal ===== */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Setup Your Voice Lobby
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-zinc-100 p-1.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Lobby Title</label>
                <input
                  type="text"
                  required
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="e.g. Chill Chat & Karaoke!"
                  className="bg-stone-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Lobby Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['chat', 'games', 'singing', 'match'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setRoomCategory(cat);
                        setRoomTitle(`${currentUser.name}'s ${cat.toUpperCase()} Lobby`);
                      }}
                      className={`py-2 rounded-xl border text-center font-bold capitalize transition-all cursor-pointer text-[10px] ${
                        roomCategory === cat
                          ? 'bg-rose-50 border-rose-300 text-rose-600'
                          : 'bg-stone-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-zinc-500 uppercase tracking-wider text-[10px]">Background Atmosphere</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['neon', 'pink', 'royal', 'cosmic'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setRoomTheme(theme)}
                      className={`py-2 rounded-xl border text-center font-bold capitalize transition-all cursor-pointer text-[10px] ${
                        roomTheme === theme
                          ? 'bg-rose-50 border-rose-300 text-rose-600'
                          : 'bg-stone-50 border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Private Room Toggle */}
              <div className="flex flex-col gap-2">
                <div
                  onClick={() => { setIsPrivate(!isPrivate); if (isPrivate) setRoomPassword(''); }}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isPrivate ? 'bg-amber-50 border-amber-300' : 'bg-stone-50 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock className={`w-4 h-4 ${isPrivate ? 'text-amber-600' : 'text-zinc-400'}`} />
                    <div>
                      <p className={`text-[11px] font-black ${isPrivate ? 'text-amber-700' : 'text-zinc-600'}`}>Private Room</p>
                      <p className="text-[9px] text-zinc-400 font-medium">Only invited users or password holders can join</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-all relative ${isPrivate ? 'bg-amber-500' : 'bg-zinc-300'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${isPrivate ? 'left-4' : 'left-0.5'}`}></div>
                  </div>
                </div>

                {isPrivate && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Set room password..."
                      required={isPrivate}
                      className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 pr-9 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-amber-400 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Room Cover Photo Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold text-zinc-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <ImagePlus className="w-3.5 h-3.5 text-rose-500" /> Room Cover Photo
                  <span className="ml-auto text-[9px] text-zinc-400 normal-case font-medium">Optional</span>
                </label>

                {roomImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-200 h-24">
                    <img src={roomImage} alt="Room cover" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setRoomImage('')}
                      className="absolute top-1.5 right-1.5 bg-zinc-900/70 text-white rounded-full p-1 cursor-pointer hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 px-2">
                      <p className="text-[9px] text-white font-bold">Cover photo selected ✓</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => roomImageRef.current?.click()}
                    className="flex items-center justify-center gap-2 h-14 bg-stone-50 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 hover:border-rose-400 hover:text-rose-500 transition-all cursor-pointer text-xs font-bold"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>Upload from Gallery</span>
                  </button>
                )}

                <input
                  ref={roomImageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const compressed = await compressImageToDataUrl(file, 800, 800, 0.85);
                      setRoomImage(compressed);
                    } catch {
                      const reader = new FileReader();
                      reader.onload = (ev) => setRoomImage(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition-all uppercase tracking-wider"
              >
                {isPrivate ? '🔒 Launch Private Room' : '🚀 Launch Voice Room'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Password Prompt Modal ===== */}
      {passwordModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-xs rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-500" /> Private Room
              </h3>
              <button
                onClick={() => setPasswordModal(null)}
                className="text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-zinc-100 p-1.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-14 h-14 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center">
                <Lock className="w-7 h-7 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-zinc-800">{passwordModal.roomTitle}</p>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">This is a private room. Enter the room password to join.</p>
              </div>
            </div>

            <div className="relative">
              <input
                type={showEnteredPwd ? 'text' : 'password'}
                value={enteredPassword}
                onChange={(e) => { setEnteredPassword(e.target.value); setPwdError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Enter room password..."
                autoFocus
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 pr-9 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-amber-400 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowEnteredPwd(!showEnteredPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 cursor-pointer"
              >
                {showEnteredPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {pwdError && (
              <p className="text-[10px] text-rose-500 font-bold text-center -mt-2">{pwdError}</p>
            )}

            <button
              onClick={handlePasswordSubmit}
              disabled={joiningRoom}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition-all uppercase tracking-wider text-xs disabled:opacity-60"
            >
              {joiningRoom ? '🔓 Verifying...' : '🔓 Join Private Room'}
            </button>
          </div>
        </div>
      )}

      {/* ===== Room Code Lookup Modal ===== */}
      {showCodeLookup && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-xs rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-rose-500" /> Join by Room Code
              </h3>
              <button
                onClick={() => setShowCodeLookup(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-zinc-100 p-1.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-medium text-center">
              Enter the 6-digit room code shared by the host to find and join a private or public room.
            </p>

            <input
              type="text"
              value={lookupCode}
              onChange={(e) => { setLookupCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setLookupError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCodeLookup()}
              placeholder="e.g. 843920"
              maxLength={6}
              autoFocus
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-3 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500 text-sm font-black text-center tracking-[0.4em]"
            />

            {lookupError && (
              <p className="text-[10px] text-rose-500 font-bold text-center -mt-2">{lookupError}</p>
            )}

            <button
              onClick={handleCodeLookup}
              disabled={lookupLoading || lookupCode.length !== 6}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition-all uppercase tracking-wider text-xs disabled:opacity-60"
            >
              {lookupLoading ? 'Searching...' : '🔍 Find Room'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
