import React, { useState, useEffect } from 'react';
import { User, Room, CustomGame } from '../types';
import { 
  Gamepad2, Trophy, Flame, Play, Plus, Shield, Users, 
  Sparkles, RefreshCw, Lock, Coins, Check, AlertCircle, 
  Settings, Trash2, Eye, Award, Zap, HelpCircle, X, ChevronRight
} from 'lucide-react';
import { toast } from './Toast';
import { registerBackHandler } from '../lib/navigation';

interface GamesHubProps {
  currentUser: User;
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
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
  onUpdateCoins: (newBalance: number) => void;
}

const DEFAULT_GAMES: CustomGame[] = [
  {
    id: 'ludo',
    name: 'ZOYO Ludo World Cup',
    category: 'Board',
    icon: '🎲',
    minPlayers: 2,
    maxPlayers: 4,
    description: '4-Player competitive classic board match with live voice chat and coin stakes!',
    status: 'active',
    entryFee: 50,
    prizePool: 5000,
    addedBy: 'Official'
  },
  {
    id: 'dice',
    name: 'Dice Duel Showdown',
    category: 'Dice',
    icon: '🎯',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'High-speed 1-on-1 dice roll arena with real-time coin betting and double multipliers!',
    status: 'active',
    entryFee: 100,
    prizePool: 10000,
    addedBy: 'Official'
  },
  {
    id: 'wheel',
    name: 'Lucky Multiplier Wheel',
    category: 'Luck',
    icon: '🎡',
    minPlayers: 1,
    maxPlayers: 8,
    description: 'Spin the dynamic carnival wheel to win 10x coin multipliers, supercars, and crowns!',
    status: 'active',
    entryFee: 25,
    prizePool: 25000,
    addedBy: 'Official'
  }
];

export default function GamesHub({
  currentUser,
  rooms,
  onJoinRoom,
  onCreateRoom,
  onUpdateCoins
}: GamesHubProps) {
  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';
  const myUserId = String(currentUser._id || currentUser.id || '');

  // Games Catalog State
  const [games, setGames] = useState<CustomGame[]>(DEFAULT_GAMES);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Control Modals
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [selectedGameForHost, setSelectedGameForHost] = useState<CustomGame | null>(null);

  // Handle hardware / gesture back button to close any open modal
  useEffect(() => {
    if (showAddGameModal || showHostModal) {
      return registerBackHandler(() => {
        if (showAddGameModal) {
          setShowAddGameModal(false);
          return true;
        }
        if (showHostModal) {
          setShowHostModal(false);
          return true;
        }
        return false;
      });
    }
  }, [showAddGameModal, showHostModal]);

  // New Game Form (Admin/Manager)
  const [newGameName, setNewGameName] = useState('');
  const [newGameCategory, setNewGameCategory] = useState('Party');
  const [newGameIcon, setNewGameIcon] = useState('🎮');
  const [newGameMinPlayers, setNewGameMinPlayers] = useState('2');
  const [newGameMaxPlayers, setNewGameMaxPlayers] = useState('4');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [newGameEntryFee, setNewGameEntryFee] = useState('50');
  const [newGamePrizePool, setNewGamePrizePool] = useState('5000');
  const [submittingGame, setSubmittingGame] = useState(false);

  // Host Game Room Form (Admin/Manager)
  const [hostRoomTitle, setHostRoomTitle] = useState('');
  const [hostPrizePool, setHostPrizePool] = useState('10000');
  const [hostTheme, setHostTheme] = useState<'neon' | 'pink' | 'royal' | 'cosmic'>('royal');
  const [hostIsPrivate, setHostIsPrivate] = useState(false);
  const [hostPassword, setHostPassword] = useState('');

  // Interactive Mini-Games Modals
  const [activeMiniGame, setActiveMiniGame] = useState<'wheel' | 'dice' | 'ludo' | null>(null);

  // Mini-Game: Lucky Wheel State
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelAngle, setWheelAngle] = useState(0);

  // Mini-Game: Dice Duel State
  const [diceBet, setDiceBet] = useState(50);
  const [diceRolling, setDiceRolling] = useState(false);
  const [playerRoll, setPlayerRoll] = useState<number | null>(null);
  const [botRoll, setBotRoll] = useState<number | null>(null);
  const [diceWinner, setDiceWinner] = useState<'player' | 'bot' | 'tie' | null>(null);

  // Mini-Game: Rapid Ludo Roll State
  const [ludoScore, setLudoScore] = useState<number>(0);
  const [ludoRolling, setLudoRolling] = useState(false);
  const [ludoDiceVal, setLudoDiceVal] = useState<number | null>(null);

  // Sound generator helper using Web Audio API
  const playSound = (type: 'win' | 'tap' | 'spin' | 'lose') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tap') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'spin') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'lose') {
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio fallback silent
    }
  };

  // Fetch games catalog from server
  const fetchGames = async () => {
    setLoadingGames(true);
    try {
      const res = await fetch('/api/catalog/games');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.games)) {
          // Merge defaults with catalog
          const combined = [...data.games];
          DEFAULT_GAMES.forEach(def => {
            if (!combined.some(g => g.id === def.id)) {
              combined.push(def);
            }
          });
          setGames(combined);
        }
      }
    } catch (err) {
      console.warn('Could not fetch games catalog:', err);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // Filter Official Admin/Manager Hosted Game Rooms & Active Game Lounges
  const activeGameRooms = rooms.filter(r => 
    r.category === 'games' || 
    (r.activeGame && r.activeGame !== 'none') || 
    r.isOfficialGame ||
    (r.host?.role === 'admin' || r.host?.role === 'manager')
  );

  // Categories list
  const categories = ['All', 'Board', 'Dice', 'Luck', 'Party', 'Action'];

  const filteredGames = games.filter(g => {
    const matchesCat = selectedCategory === 'All' || g.category?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = !searchQuery.trim() || 
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Admin/Manager: Add New Game
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) {
      toast('Game name is required', 'error');
      return;
    }
    setSubmittingGame(true);
    try {
      const res = await fetch('/api/catalog/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGameName.trim(),
          category: newGameCategory,
          icon: newGameIcon,
          minPlayers: newGameMinPlayers,
          maxPlayers: newGameMaxPlayers,
          description: newGameDesc.trim() || 'Exciting interactive voice game hosted on ZOYO.',
          status: 'active',
          entryFee: Number(newGameEntryFee) || 0,
          prizePool: Number(newGamePrizePool) || 0,
          userRole: currentUser.role,
          addedBy: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Manager'})`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`🎮 "${newGameName}" added to game catalog!`, 'success');
        setShowAddGameModal(false);
        setNewGameName('');
        setNewGameDesc('');
        fetchGames();
      } else {
        toast(data.error || 'Failed to add game', 'error');
      }
    } catch (err) {
      toast('Network error creating game', 'error');
    } finally {
      setSubmittingGame(false);
    }
  };

  // Admin/Manager: Toggle Game Status (Active <-> Maintenance)
  const handleToggleGameStatus = async (game: CustomGame) => {
    if (!isAdminOrManager) return;
    const nextStatus = game.status === 'active' ? 'maintenance' : 'active';
    try {
      const res = await fetch(`/api/catalog/games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          userRole: currentUser.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGames(prev => prev.map(g => g.id === game.id ? { ...g, status: nextStatus } : g));
        toast(`Game "${game.name}" is now ${nextStatus === 'active' ? '🟢 Active' : '🛠️ Under Maintenance'}!`, 'info');
      } else {
        toast(data.error || 'Failed to update game status', 'error');
      }
    } catch {
      toast('Error updating game status', 'error');
    }
  };

  // Admin/Manager: Delete Custom Game
  const handleDeleteGame = async (gameId: string, gameName: string) => {
    if (!isAdminOrManager) return;
    if (gameId === 'ludo' || gameId === 'dice' || gameId === 'wheel') {
      toast('Default flagship games cannot be deleted.', 'info');
      return;
    }
    if (!window.confirm(`Delete "${gameName}" from games catalog?`)) return;

    try {
      const res = await fetch(`/api/catalog/games/${gameId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast(`"${gameName}" removed from catalog`, 'success');
        setGames(prev => prev.filter(g => g.id !== gameId));
      } else {
        toast(data.error || 'Failed to delete game', 'error');
      }
    } catch {
      toast('Network error deleting game', 'error');
    }
  };

  // Open Host Game Room Modal
  const openHostModalForGame = (game: CustomGame) => {
    setSelectedGameForHost(game);
    setHostRoomTitle(`👑 ${currentUser.name}'s ${game.name.toUpperCase()} ARENA`);
    setHostPrizePool(String(game.prizePool || 10000));
    setShowHostModal(true);
  };

  // Execute Host Game Room
  const executeHostGameRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostRoomTitle.trim()) {
      toast('Please enter a room title', 'error');
      return;
    }
    const gameId = selectedGameForHost ? selectedGameForHost.id : 'ludo';
    const prize = Number(hostPrizePool) || 10000;

    onCreateRoom(
      hostRoomTitle.trim(),
      'games',
      hostTheme,
      hostIsPrivate,
      hostIsPrivate ? hostPassword : '',
      gameId,
      true, // isOfficialGame
      prize // gamePrizePool
    );

    setShowHostModal(false);
    toast(`🏆 Official Game Room "${hostRoomTitle}" Hosted!`, 'success');
  };

  // --- INTERACTIVE LUCKY WHEEL EXECUTION ---
  const handleSpinWheel = async () => {
    if (wheelSpinning) return;
    if (currentUser.coins < 25 && currentUser.role !== 'admin') {
      toast('Insufficient coins to spin the wheel (25 Coins required)!', 'error');
      return;
    }

    setWheelSpinning(true);
    setWheelResult(null);
    playSound('spin');

    // Deduct entry fee
    if (currentUser.role !== 'admin') {
      onUpdateCoins(currentUser.coins - 25);
    }

    const segments = [
      { label: '🪙 500 Coins', type: 'coins', amount: 500 },
      { label: '🌹 Red Rose Gift', type: 'gift', amount: 0 },
      { label: '🪙 150 Coins', type: 'coins', amount: 150 },
      { label: '👑 Royal Crown', type: 'gift', amount: 0 },
      { label: '🪙 1,000 Coins JackPot!', type: 'coins', amount: 1000 },
      { label: '🪙 75 Coins', type: 'coins', amount: 75 },
      { label: '🏎️ Golden Supercar', type: 'gift', amount: 0 },
      { label: '🪙 50 Coins', type: 'coins', amount: 50 },
    ];

    const chosenIdx = Math.floor(Math.random() * segments.length);
    const chosen = segments[chosenIdx];
    const targetDegrees = 360 * 5 + (chosenIdx * 45) + 22.5;
    setWheelAngle(prev => prev + targetDegrees);

    setTimeout(async () => {
      setWheelSpinning(false);
      setWheelResult(chosen.label);
      playSound('win');

      if (chosen.type === 'coins' && chosen.amount > 0) {
        const nextBal = (currentUser.coins || 0) + chosen.amount;
        onUpdateCoins(nextBal);
        try {
          await fetch(`/api/users/${myUserId}/coins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: chosen.amount, senderId: 'wheel_carnival' })
          });
        } catch { /* ignore */ }
        toast(`🎉 Won ${chosen.label}! Balance updated!`, 'success');
      } else {
        toast(`🎁 Won ${chosen.label}! Added to your inventory!`, 'success');
      }
    }, 3200);
  };

  // --- INTERACTIVE DICE DUEL EXECUTION ---
  const handleRollDiceDuel = async () => {
    if (diceRolling) return;
    if (currentUser.coins < diceBet && currentUser.role !== 'admin') {
      toast(`Insufficient coins to bet ${diceBet} coins!`, 'error');
      return;
    }

    setDiceRolling(true);
    setPlayerRoll(null);
    setBotRoll(null);
    setDiceWinner(null);
    playSound('tap');

    // Deduct bet initially
    if (currentUser.role !== 'admin') {
      onUpdateCoins(currentUser.coins - diceBet);
    }

    setTimeout(async () => {
      const p1 = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
      const p2 = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

      setPlayerRoll(p1);
      setBotRoll(p2);
      setDiceRolling(false);

      if (p1 > p2) {
        setDiceWinner('player');
        playSound('win');
        const winnings = diceBet * 2;
        const newBal = (currentUser.coins || 0) + winnings;
        onUpdateCoins(newBal);
        try {
          await fetch(`/api/users/${myUserId}/coins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: winnings, senderId: 'dice_duel_win' })
          });
        } catch { /* ignore */ }
        toast(`🏆 You Won the Dice Duel! Earned 🪙 ${winnings} coins!`, 'success');
      } else if (p2 > p1) {
        setDiceWinner('bot');
        playSound('lose');
        toast(`Opponent rolled higher (${p2} vs ${p1}). Better luck next round!`, 'info');
      } else {
        setDiceWinner('tie');
        // Return bet
        onUpdateCoins((currentUser.coins || 0) + diceBet);
        toast(`Tie game! ${diceBet} coins refunded.`, 'info');
      }
    }, 1500);
  };

  // --- INTERACTIVE LUDO ROLL EXECUTION ---
  const handleRollLudo = () => {
    if (ludoRolling) return;
    setLudoRolling(true);
    playSound('tap');

    setTimeout(() => {
      const val = Math.floor(Math.random() * 6) + 1;
      setLudoDiceVal(val);
      const newScore = ludoScore + val;
      setLudoScore(newScore);
      setLudoRolling(false);
      playSound(val === 6 ? 'win' : 'tap');

      if (newScore >= 30) {
        toast(`🏆 Ludo Master Achievement unlocked! Finished race at ${newScore} points!`, 'success');
        setLudoScore(0);
        onUpdateCoins((currentUser.coins || 0) + 100);
      }
    }, 800);
  };

  return (
    <div className="flex-1 min-h-0 relative h-full flex flex-col overflow-hidden bg-slate-50">
      
      {/* Scrollable Game Arena View */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 scrollbar-none pb-28 overscroll-contain">
        
        {/* Header Branding Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-rose-600 p-5 text-white shadow-lg shrink-0">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute top-2 right-3 flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <Coins className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-black text-amber-300">
              {currentUser.role === 'admin' ? '∞' : currentUser.coins}
            </span>
          </div>

          <div className="flex flex-col gap-1 max-w-[240px]">
            <span className="text-[9px] bg-white/20 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider self-start flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Official Arena
            </span>
            <h1 className="text-lg font-black tracking-wide font-display mt-1">
              ZOYO Games Hub
            </h1>
            <p className="text-[10px] text-white/90 font-medium leading-tight">
              Live multiplayer tournaments, coin challenges &amp; voice lobbies hosted by Administrators &amp; Managers.
            </p>
          </div>
        </div>

        {/* ================= ADMIN & MANAGER CONTROL PANEL ================= */}
        {isAdminOrManager && (
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border-2 border-amber-400/50 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5 shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-amber-500 text-white shadow-xs">
                  <Shield className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">
                    Admin Game Controller
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-bold">
                    You have full authority to host tournament lobbies and add games to the catalog.
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                {currentUser.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <button
                onClick={() => {
                  setSelectedGameForHost(games[0] || null);
                  setHostRoomTitle(`👑 ${currentUser.name}'s Official Tournament Lobby`);
                  setHostPrizePool('10000');
                  setShowHostModal(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-rose-600 text-white py-2 rounded-xl text-[11px] font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Host Game Lobby</span>
              </button>

              <button
                onClick={() => setShowAddGameModal(true)}
                className="flex items-center justify-center gap-1.5 bg-white border border-zinc-250 text-zinc-800 hover:text-rose-600 py-2 rounded-xl text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-rose-500 stroke-[3]" />
                <span>Add New Game</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= OFFICIAL LIVE GAMES LOBBIES ================= */}
        <div className="flex flex-col gap-2.5 shrink-0">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> 
              <span>Live Game Lobbies ({activeGameRooms.length})</span>
            </h3>
            <span className="text-[10px] text-zinc-400 font-bold">Voice-Connected</span>
          </div>

          {activeGameRooms.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 text-center flex flex-col items-center gap-1.5 shadow-xs">
              <Gamepad2 className="w-6 h-6 text-zinc-300" />
              <p className="text-[11px] font-bold text-zinc-600">No active Game Lobbies open right now</p>
              <p className="text-[9px] text-zinc-400 max-w-xs">
                {isAdminOrManager 
                  ? 'Tap "Host Game Lobby" above to launch an official admin match!'
                  : 'Play a solo practice match below or start your own game lounge from the Rooms tab!'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {activeGameRooms.map(room => {
                const rId = room._id || room.id;
                const isHostAdmin = room.host?.role === 'admin' || room.host?.role === 'manager' || room.isOfficialGame;
                return (
                  <div
                    key={rId}
                    onClick={() => onJoinRoom(rId!)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between gap-2.5 ${
                      isHostAdmin
                        ? 'bg-gradient-to-r from-amber-500/5 via-white to-rose-500/5 border-amber-300 hover:border-amber-500'
                        : 'bg-white border-zinc-200 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <img
                            src={room.host?.avatar}
                            alt=""
                            className={`w-9 h-9 rounded-full object-cover border-2 ${
                              isHostAdmin ? 'border-amber-400' : 'border-rose-400'
                            }`}
                          />
                          {isHostAdmin && (
                            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[8px] font-black px-1 rounded-full">
                              👑
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-zinc-900 truncate max-w-[170px]">
                              {room.title}
                            </h4>
                            {room.isPrivate && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium">
                            Host: <span className="font-extrabold text-zinc-700">{room.host?.name}</span>
                            {isHostAdmin && (
                              <span className="text-[9px] text-amber-700 bg-amber-100 font-black px-1.5 py-0.2 rounded-md ml-1">
                                {room.host?.role === 'admin' ? '🛡️ Admin' : '⚡ Manager'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{room.onlineCount || 1} playing</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="bg-stone-100 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase font-mono text-[9px]">
                          🎮 {(room.activeGame && room.activeGame !== 'none' ? room.activeGame : 'Party').toUpperCase()}
                        </span>
                        {room.gamePrizePool && room.gamePrizePool > 0 && (
                          <span className="bg-amber-50 border border-amber-200 text-amber-800 font-black px-2 py-0.5 rounded flex items-center gap-1 text-[9px]">
                            🏆 {room.gamePrizePool.toLocaleString()} Coins
                          </span>
                        )}
                      </div>
                      <span className="text-rose-600 font-black flex items-center gap-0.5">
                        Join Lobby <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= GAMES CATALOG & SOLO PRACTICE ================= */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-indigo-600" />
                <span>All Games Catalog</span>
              </h3>
              <p className="text-[9px] text-zinc-400 font-bold">Admin-curated interactive collection</p>
            </div>
            <button
              onClick={fetchGames}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-zinc-500 cursor-pointer transition-colors"
              title="Refresh catalog"
            >
              <RefreshCw className={`w-3 h-3 ${loadingGames ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Games Grid */}
          <div className="grid grid-cols-1 gap-3">
            {filteredGames.map(game => {
              const isMaintenance = game.status === 'maintenance';
              return (
                <div
                  key={game.id}
                  className={`bg-white border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs transition-all ${
                    isMaintenance ? 'border-amber-200 bg-amber-50/20' : 'border-zinc-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-stone-100 to-zinc-100 flex items-center justify-center text-2xl shadow-inner border border-zinc-200/60 shrink-0">
                        {game.icon || '🎮'}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-zinc-900">{game.name}</h4>
                          {game.category && (
                            <span className="text-[8px] bg-stone-100 text-zinc-600 font-extrabold px-1.5 py-0.2 rounded uppercase">
                              {game.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed font-medium">
                          {game.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-400 font-bold">
                          <span>👥 {game.minPlayers}-{game.maxPlayers} Players</span>
                          {game.entryFee ? <span>• 🪙 {game.entryFee} Entry</span> : null}
                          {game.addedBy && <span className="text-indigo-600">• by {game.addedBy}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isMaintenance ? (
                        <span className="text-[8.5px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full uppercase">
                          🛠️ Maintenance
                        </span>
                      ) : (
                        <span className="text-[8.5px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 gap-2">
                    {/* Solo/Quick Play Button */}
                    <button
                      onClick={() => {
                        if (isMaintenance) {
                          toast('This game is temporarily under maintenance by administrators.', 'info');
                          return;
                        }
                        if (game.id === 'wheel') setActiveMiniGame('wheel');
                        else if (game.id === 'dice') setActiveMiniGame('dice');
                        else if (game.id === 'ludo') setActiveMiniGame('ludo');
                        else {
                          toast(`Practice Lobby for ${game.name} ready! Starting instant session...`, 'success');
                          onCreateRoom(
                            `${currentUser.name}'s ${game.name}`,
                            'games',
                            'neon',
                            false,
                            '',
                            game.id,
                            false,
                            1000
                          );
                        }
                      }}
                      disabled={isMaintenance && !isAdminOrManager}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-rose-600 text-white font-black text-[11px] py-2 rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>{isMaintenance ? 'Under Maintenance' : 'Play Practice Match'}</span>
                    </button>

                    {/* Admin / Manager Controls */}
                    {isAdminOrManager && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openHostModalForGame(game)}
                          className="text-[10px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-black px-2.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                          title="Host Official Game Lobby as Admin"
                        >
                          <Trophy className="w-3 h-3 text-amber-600" />
                          <span>Host</span>
                        </button>

                        <button
                          onClick={() => handleToggleGameStatus(game)}
                          className={`text-[10px] border px-2 py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                            isMaintenance 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                              : 'bg-stone-50 text-zinc-600 border-zinc-200 hover:bg-stone-100'
                          }`}
                          title="Toggle Active / Maintenance status"
                        >
                          <Settings className="w-3 h-3" />
                        </button>

                        {game.id !== 'ludo' && game.id !== 'dice' && game.id !== 'wheel' && (
                          <button
                            onClick={() => handleDeleteGame(game.id, game.name)}
                            className="text-[10px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded-xl font-bold cursor-pointer transition-colors"
                            title="Delete game from platform"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= MODAL: ADMIN HOST GAME ROOM ================= */}
      {showHostModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-zinc-900">Host Official Game Lobby</h3>
              </div>
              <button
                onClick={() => setShowHostModal(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-zinc-100 p-1 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={executeHostGameRoom} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-zinc-600 block mb-1">Room Title</label>
                <input
                  type="text"
                  value={hostRoomTitle}
                  onChange={e => setHostRoomTitle(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-zinc-600 block mb-1">Selected Game</label>
                <select
                  value={selectedGameForHost?.id || 'ludo'}
                  onChange={e => {
                    const found = games.find(g => g.id === e.target.value);
                    if (found) setSelectedGameForHost(found);
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none"
                >
                  {games.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.icon} {g.name} ({g.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Prize Pool (Coins)</label>
                  <input
                    type="number"
                    value={hostPrizePool}
                    onChange={e => setHostPrizePool(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-amber-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Lobby Atmosphere</label>
                  <select
                    value={hostTheme}
                    onChange={e => setHostTheme(e.target.value as any)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none"
                  >
                    <option value="royal">👑 Royal Gold</option>
                    <option value="neon">⚡ Cyber Neon</option>
                    <option value="cosmic">🌌 Cosmic Space</option>
                    <option value="pink">🌸 Sakura Pink</option>
                  </select>
                </div>
              </div>

              <div className="bg-stone-50 border border-zinc-200/80 rounded-xl p-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hostIsPrivate}
                    onChange={e => setHostIsPrivate(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded"
                  />
                  <span className="font-bold text-zinc-700">Make Password-Protected Private Room</span>
                </label>
                {hostIsPrivate && (
                  <input
                    type="password"
                    placeholder="Enter private entry password..."
                    value={hostPassword}
                    onChange={e => setHostPassword(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                    required={hostIsPrivate}
                  />
                )}
              </div>

              <button
                type="submit"
                className="w-full mt-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-95 transition-all uppercase tracking-wider text-xs"
              >
                👑 Launch Official Game Lobby
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN ADD NEW GAME ================= */}
      {showAddGameModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90%] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-rose-500 stroke-[3]" />
                <h3 className="text-sm font-black text-zinc-900">Add New Game to Catalog</h3>
              </div>
              <button
                onClick={() => setShowAddGameModal(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-zinc-100 p-1 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGame} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-zinc-600 block mb-1">Game Name</label>
                <input
                  type="text"
                  placeholder="e.g. Royal Poker, Speed Carrom, Trivia Arena"
                  value={newGameName}
                  onChange={e => setNewGameName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Category</label>
                  <select
                    value={newGameCategory}
                    onChange={e => setNewGameCategory(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none"
                  >
                    <option value="Board">Board</option>
                    <option value="Dice">Dice</option>
                    <option value="Luck">Luck</option>
                    <option value="Party">Party</option>
                    <option value="Action">Action</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Icon / Emoji</label>
                  <input
                    type="text"
                    value={newGameIcon}
                    onChange={e => setNewGameIcon(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-center text-lg focus:outline-none"
                    maxLength={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Min Players</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newGameMinPlayers}
                    onChange={e => setNewGameMinPlayers(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Max Players</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={newGameMaxPlayers}
                    onChange={e => setNewGameMaxPlayers(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-zinc-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Entry Fee (Coins)</label>
                  <input
                    type="number"
                    value={newGameEntryFee}
                    onChange={e => setNewGameEntryFee(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-amber-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-600 block mb-1">Prize Pool</label>
                  <input
                    type="number"
                    value={newGamePrizePool}
                    onChange={e => setNewGamePrizePool(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 font-bold text-amber-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-600 block mb-1">Game Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain gameplay, rules, or how players participate in voice chat..."
                  value={newGameDesc}
                  onChange={e => setNewGameDesc(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-medium text-zinc-800 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingGame}
                className="w-full mt-2 bg-gradient-to-r from-rose-500 to-indigo-600 text-white font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-95 transition-all uppercase tracking-wider text-xs disabled:opacity-60"
              >
                {submittingGame ? 'Adding to Catalog...' : 'Publish Game to Platform'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MINI-GAME MODAL: LUCKY WHEEL ================= */}
      {activeMiniGame === 'wheel' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col items-center gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-full flex justify-between items-center pb-2 border-b border-zinc-100">
              <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                🎡 Lucky Multiplier Wheel
              </span>
              <button
                onClick={() => { setActiveMiniGame(null); setWheelResult(null); }}
                className="text-zinc-400 hover:text-zinc-700 bg-zinc-100 p-1 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="relative w-48 h-48 flex items-center justify-center my-2">
              {/* Pointer */}
              <div className="absolute -top-2 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-rose-600 filter drop-shadow-md" />
              
              {/* Wheel Disc */}
              <div
                className="w-44 h-44 rounded-full border-4 border-amber-400 shadow-xl flex items-center justify-center relative overflow-hidden transition-transform duration-[3.2s] ease-[cubic-bezier(0.15,0.9,0.25,1)]"
                style={{
                  transform: `rotate(${wheelAngle}deg)`,
                  background: 'conic-gradient(#f43f5e 0deg 45deg, #fbbf24 45deg 90deg, #6366f1 90deg 135deg, #10b981 135deg 180deg, #ec4899 180deg 225deg, #eab308 225deg 270deg, #8b5cf6 270deg 315deg, #06b6d4 315deg 360deg)'
                }}
              >
                <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center font-black text-zinc-800 text-sm border-2 border-amber-300 z-10">
                  🎡
                </div>
              </div>
            </div>

            {wheelResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 w-full animate-in zoom-in-95 duration-200">
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-600">Wheel Prize Won!</span>
                <h4 className="text-sm font-black text-zinc-900 mt-0.5">{wheelResult}</h4>
              </div>
            )}

            <div className="w-full flex flex-col gap-2">
              <button
                onClick={handleSpinWheel}
                disabled={wheelSpinning}
                className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600 text-white font-black py-3 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
              >
                {wheelSpinning ? 'Spinning...' : 'Spin Wheel (🪙 25 Coins)'}
              </button>
              <span className="text-[9px] text-zinc-400 font-bold">
                Balance: 🪙 {currentUser.role === 'admin' ? '∞' : currentUser.coins}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= MINI-GAME MODAL: DICE DUEL ================= */}
      {activeMiniGame === 'dice' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col items-center gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-full flex justify-between items-center pb-2 border-b border-zinc-100">
              <span className="text-xs font-black text-indigo-600 flex items-center gap-1">
                🎯 Dice Duel Showdown (1-on-1)
              </span>
              <button
                onClick={() => { setActiveMiniGame(null); setPlayerRoll(null); setBotRoll(null); }}
                className="text-zinc-400 hover:text-zinc-700 bg-zinc-100 p-1 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Duel Arena Matchup */}
            <div className="w-full grid grid-cols-2 gap-3 my-2">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-col items-center gap-2">
                <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-rose-500 object-cover" />
                <span className="text-[11px] font-black text-zinc-900">{currentUser.name} (You)</span>
                <div className="w-12 h-12 bg-white rounded-xl shadow-inner border border-rose-200 flex items-center justify-center text-xl font-black text-rose-600">
                  {diceRolling ? '🎲' : playerRoll !== null ? playerRoll : '-'}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white font-black flex items-center justify-center text-sm">
                  🤖
                </div>
                <span className="text-[11px] font-black text-zinc-900">ZOYO Bot Rival</span>
                <div className="w-12 h-12 bg-white rounded-xl shadow-inner border border-indigo-200 flex items-center justify-center text-xl font-black text-indigo-600">
                  {diceRolling ? '🎲' : botRoll !== null ? botRoll : '-'}
                </div>
              </div>
            </div>

            {/* Bet Picker */}
            <div className="w-full flex items-center justify-center gap-2">
              <span className="text-[10px] text-zinc-500 font-bold">Select Bet:</span>
              {[50, 100, 250].map(amt => (
                <button
                  key={amt}
                  onClick={() => setDiceBet(amt)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all cursor-pointer border ${
                    diceBet === amt
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-stone-50 border-zinc-200 text-zinc-600 hover:bg-stone-100'
                  }`}
                >
                  🪙 {amt}
                </button>
              ))}
            </div>

            {diceWinner && (
              <div className={`p-2.5 rounded-2xl w-full text-xs font-black ${
                diceWinner === 'player' ? 'bg-emerald-100 text-emerald-800' :
                diceWinner === 'bot' ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-zinc-700'
              }`}>
                {diceWinner === 'player' ? `🎉 Victory! +${diceBet * 2} Coins Won!` :
                 diceWinner === 'bot' ? '💥 Bot won this roll! Try again.' : '🤝 Draw! Coins returned.'}
              </div>
            )}

            <button
              onClick={handleRollDiceDuel}
              disabled={diceRolling}
              className="w-full bg-gradient-to-r from-indigo-600 via-rose-500 to-pink-600 text-white font-black py-3 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
            >
              {diceRolling ? 'Rolling Dice...' : `Roll Dice (🪙 ${diceBet} Bet)`}
            </button>
          </div>
        </div>
      )}

      {/* ================= MINI-GAME MODAL: RAPID LUDO ================= */}
      {activeMiniGame === 'ludo' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col items-center gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-center">
            <div className="w-full flex justify-between items-center pb-2 border-b border-zinc-100">
              <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                🎲 ZOYO Ludo Solo Practice Sprint
              </span>
              <button
                onClick={() => { setActiveMiniGame(null); setLudoScore(0); }}
                className="text-zinc-400 hover:text-zinc-700 bg-zinc-100 p-1 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Track */}
            <div className="w-full bg-stone-50 border border-zinc-200 rounded-2xl p-4 flex flex-col items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Race Progress</span>
              <div className="w-full bg-zinc-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-400 to-rose-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (ludoScore / 30) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between w-full text-[10px] font-bold text-zinc-500">
                <span>Start</span>
                <span className="text-rose-600 font-black">{ludoScore} / 30 Pts</span>
                <span>Trophy Finish 🏆</span>
              </div>
            </div>

            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white shadow-xl flex items-center justify-center text-3xl font-black border-2 border-white/40">
              {ludoRolling ? '🎲' : ludoDiceVal !== null ? ludoDiceVal : '🎲'}
            </div>

            <button
              onClick={handleRollLudo}
              disabled={ludoRolling}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-3 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
            >
              {ludoRolling ? 'Rolling...' : 'Roll Ludo Dice! 🎲'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
