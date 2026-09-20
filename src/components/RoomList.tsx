import React, { useState } from 'react';
import { Room, User } from '../types';
import { Search, Plus, Sparkles, Trophy, Users, Flame, Globe, Dices, MessageSquare, Music, Mic } from 'lucide-react';

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (title: string, category: 'chat' | 'games' | 'singing' | 'match', theme: 'neon' | 'pink' | 'royal' | 'cosmic') => void;
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
                          room.host?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTitle.trim()) return;
    onCreateRoom(roomTitle, roomCategory, roomTheme);
    setRoomTitle('');
    setShowCreateModal(false);
  };

  const banners = [
    {
      title: 'ZOYO Ludo Cup Season 5',
      desc: 'Win up to 50,000 Gold Coins & Crown Badges!',
      tag: 'Tournament',
      color: 'from-amber-500 to-rose-600',
    },
    {
      title: 'Lucky Wheel Carnival',
      desc: '10x Gifts Multiplier Active Today!',
      tag: 'Bonus Event',
      color: 'from-purple-600 to-indigo-800',
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 bg-slate-50 scrollbar-none h-full">
      {/* Search Header */}
      <div className="relative flex items-center shrink-0">
        <span className="absolute left-3 text-zinc-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Search voice rooms, host ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-zinc-200 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all shadow-sm font-medium"
        />
      </div>

      {/* Featured Banners Slider - Only displayed when actual live events or game rooms exist */}
      {rooms.some(room => room.category === 'games' || (room.activeGame && room.activeGame !== 'none')) && (
        <div className="relative shrink-0 overflow-hidden rounded-[24px] h-24 bg-gradient-to-r from-rose-500 to-pink-600 p-4 shadow-md flex flex-col justify-between group">
          <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-white/10 rounded-full blur-md"></div>
          <div className="flex justify-between items-start">
            <span className="text-[9px] bg-black/20 text-white font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
              🔥 Live Event
            </span>
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full"></span>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-display font-black text-white leading-tight uppercase tracking-wide">ZOYO LUDO WORLD CUP</h3>
            <p className="text-[10px] text-rose-50 mt-0.5 font-medium leading-none">Join Games rooms to win 20,000 Coins & level badges!</p>
          </div>
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
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Voice Rooms ({filteredRooms.length})</span>
          <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> HOT LOUNGES
          </span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-zinc-400 gap-3">
            <div className="w-14 h-14 bg-zinc-100/80 rounded-2xl flex items-center justify-center border border-zinc-200/50">
              <Mic className="w-6 h-6 text-zinc-400 stroke-[2] animate-pulse" />
            </div>
            <h4 className="font-display font-black text-zinc-800">No Active Voice Rooms</h4>
            <p className="text-[10px] max-w-[200px] mt-0.5 leading-relaxed text-zinc-400 font-medium">
              Create and host your own voice lobby using the <span className="text-rose-500 font-extrabold font-mono">+</span> button below! Choose custom categories and ambient themes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-0.5 scrollbar-none pb-4">
            {filteredRooms.map((room) => {
              const roomId = (room as any)._id || room.id;
              return (
                <div
                  key={roomId}
                  onClick={() => onJoinRoom(roomId)}
                  className="group relative bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-col justify-between h-28 hover:border-rose-500/60 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  {/* Active game corner marker */}
                  {room.activeGame !== 'none' && (
                    <span className="absolute top-3 right-3 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                      <span>{(room.activeGame || 'none').toUpperCase()} PLAYING</span>
                    </span>
                )}

                <div className="flex gap-3">
                  {/* Host Avatar Frame */}
                  <div className="relative shrink-0">
                    <img
                      src={(room.host?.avatar) || PRESET_AVATARS[0]}
                      alt={(room.host?.name) || 'Unknown Host'}
                      className="w-12 h-12 rounded-full object-cover border-2 border-rose-500"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
                      H
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="text-xs font-display font-black text-zinc-900 truncate group-hover:text-rose-600 transition-colors">
                      {room.title || 'Untitled Room'}
                    </h3>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                      Host: <span className="text-zinc-700 font-extrabold">{room.host?.name || 'Unknown Host'}</span> • Lvl {room.host?.level || 1}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[9px] bg-stone-100 text-zinc-600 px-2 py-0.5 rounded-md font-extrabold border border-zinc-200 uppercase tracking-wide">
                        {room.category || 'chat'}
                      </span>
                      {(room.category || 'chat') === 'games' && (
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
                    "{room.description}"
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                    <Users className="w-3 h-3" />
                    <span>{room.onlineCount} online</span>
                  </div>
                </div>
              </div>
            )}
            )}
          </div>
        )}
      </div>

      {/* Create Room Button Floating - Premium Smooth Interaction */}
      <button
        onClick={() => {
          setRoomTitle(`${currentUser.name}'s ${roomCategory.toUpperCase()} Lobby`);
          setShowCreateModal(true);
        }}
        className="absolute bottom-24 right-6 w-12 h-12 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/20 hover:scale-110 active:scale-95 transition-all cursor-pointer z-50 border border-white/25"
      >
        <Plus className="w-6 h-6 stroke-[3]" />
      </button>

      {/* Create Room Dialog Overlay */}
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
                        // Update placeholder title when switching category
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

              <button
                type="submit"
                className="w-full mt-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-[0.98] transition-all uppercase tracking-wider"
              >
                🚀 Launch Voice Room
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
