import React, { useState, useEffect, useRef } from 'react';
import { Room, User, Seat, ChatMessage, Gift, LudoState, DiceDuelState } from '../types';
import { GIFTS, AUDIO_TRACKS, PRESET_AVATARS } from '../data';
import { 
  ChevronLeft, Users, Mic, MicOff, Send, 
  Trophy, Sparkles, X, Gift as GiftIcon, Flame, Play, Pause,
  CornerDownRight, RefreshCw, Smile, Zap, MessageSquare, Award, UserPlus, Trash, VolumeX, MessageSquareDashed
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRoomProps {
  room: Room;
  onLeave: () => void;
  currentUser: User;
  onUpdateCoins: (newCoins: number) => void;
  onSendMessage: (message: ChatMessage) => void;
}

export default function VoiceRoom({ room, onLeave, currentUser, onUpdateCoins, onSendMessage }: VoiceRoomProps) {
  // Defensive checks to prevent crashes
  if (!room) {
    console.error('VoiceRoom received undefined room');
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-zinc-500 font-bold">Room data not available</p>
        </div>
      </div>
    );
  }

  if (!room.host) {
    console.error('VoiceRoom room missing host:', room);
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-zinc-500 font-bold">Invalid room data</p>
        </div>
      </div>
    );
  }

  // Initialize seats from room data if available, otherwise create default with host at index 0
  const getInitialSeats = (): Seat[] => {
    if (room.seats && Array.isArray(room.seats) && room.seats.length >= 9) {
      return room.seats.map(s => ({
        index: s.index,
        user: s.user ? { ...s.user, avatar: s.user.avatar || PRESET_AVATARS[0], name: s.user.name || 'Unknown', level: s.user.level || 1 } : null,
        isMuted: !!s.isMuted,
        isTalking: !!s.isTalking
      })) as Seat[];
    }
    // Fallback: host at seat 0, empty guest seats 1-8
    return [
      { index: 0, user: room.host ? { ...room.host, avatar: room.host.avatar || PRESET_AVATARS[0] } : null, isMuted: false, isTalking: false },
      { index: 1, user: null, isMuted: false, isTalking: false },
      { index: 2, user: null, isMuted: false, isTalking: false },
      { index: 3, user: null, isMuted: false, isTalking: false },
      { index: 4, user: null, isMuted: false, isTalking: false },
      { index: 5, user: null, isMuted: false, isTalking: false },
      { index: 6, user: null, isMuted: false, isTalking: false },
      { index: 7, user: null, isMuted: false, isTalking: false },
      { index: 8, user: null, isMuted: false, isTalking: false },
    ];
  };

  const [seats, setSeats] = useState<Seat[]>(getInitialSeats);

  const [mySeatIndex, setMySeatIndex] = useState<number | null>(null);

  // Cleanup and leave seat when component unmounts or user leaves room
  React.useEffect(() => {
    return () => {
      // Leave seat when unmounting
      if (mySeatIndex !== null && room) {
        const roomId = (room as any)._id || room.id;
        fetch(`/api/rooms/${roomId}/seat/${mySeatIndex}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'leave' })
        }).catch(err => console.warn('Failed to leave seat:', err));
      }
      disableMicrophone();
    };
  }, [mySeatIndex, room]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', userId: 'system', userName: 'System', userLevel: 99, message: `Welcome to ${room.host.name}'s voice room! Click empty mic seats to sit or add custom guests. You are in full control! 🎙️✨`, type: 'system' }
  ]);
  const [textInput, setTextInput] = useState('');
  const [activeGame, setActiveGame] = useState<'none' | 'ludo' | 'dice' | 'wheel'>('none');
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [selectedGiftRecipient, setSelectedGiftRecipient] = useState<number | 'all'>(0);
  const [activeGiftEffect, setActiveGiftEffect] = useState<Gift | null>(null);
  const [activeTrack, setActiveTrack] = useState<typeof AUDIO_TRACKS[0] | null>(null);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isMyMicMuted, setIsMyMicMuted] = useState(false);

  // Seat Configuration Action Drawer Dialog State
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [customGuestName, setCustomGuestName] = useState('');
  const [customGuestAvatar, setCustomGuestAvatar] = useState(PRESET_AVATARS[1]);
  const [customGuestLevel, setCustomGuestLevel] = useState(15);

  // Floating reactions list
  const [reactions, setReactions] = useState<{ id: string; emoji: string; seatIndex: number }[]>([]);

  // Sound Synthesizer (AudioContext)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Microphone state & visualizer
  const [myVoiceLevel, setMyVoiceLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafIdRef = useRef<number | null>(null);

  // Ludo State
  const [ludo, setLudo] = useState<LudoState>({
    players: [],
    activePlayerIndex: 0,
    diceValue: 1,
    isRolling: false,
    history: ['Add seated players to start Ludo match! 🎲']
  });

  // Dice Duel State
  const [diceDuel, setDiceDuel] = useState<DiceDuelState>({
    player1: { name: room.host.name, avatar: room.host.avatar, score: 0, isRolling: false },
    player2: { name: currentUser.name, avatar: currentUser.avatar, score: 0, isRolling: false },
    status: 'idle',
    winner: null,
    betAmount: 50
  });

  // Lucky Wheel State
  const [wheelDegree, setWheelDegree] = useState(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // SFX Synth
  const playSynthSound = (type: 'dice' | 'win' | 'gift' | 'tap') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'dice') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } else if (type === 'gift') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {
      console.warn("AudioContext block", e);
    }
  };

  // Microphone capture & wave animations
  const enableMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAmplitude = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMyVoiceLevel(Math.min(100, Math.floor(average * 1.5)));
        micRafIdRef.current = requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();

      if (mySeatIndex !== null) {
        setSeats(prev => prev.map(s => s.index === mySeatIndex ? { ...s, isTalking: true } : s));
      }
    } catch (err) {
      console.warn("Microphone access unavailable or denied.");
    }
  };

  const disableMicrophone = () => {
    if (micRafIdRef.current) cancelAnimationFrame(micRafIdRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    micStreamRef.current = null;
    micAnalyserRef.current = null;
    setMyVoiceLevel(0);
    if (mySeatIndex !== null) {
      setSeats(prev => prev.map(s => s.index === mySeatIndex ? { ...s, isTalking: false } : s));
    }
  };

  // Click handler for Seat triggers Action Menu
  const handleSeatClick = (index: number) => {
    playSynthSound('tap');
    setSelectedSeatIndex(index);
    setCustomGuestName(`Guest Seat ${index}`);
    setCustomGuestLevel(Math.floor(Math.random() * 20) + 5);
    setShowSeatModal(true);
  };

  // Fetch room seats from backend (for syncing with other users)
  React.useEffect(() => {
    if (!room) return;

    let isMounted = true;

    const fetchSeats = async () => {
      try {
        const roomId = (room as any)._id || room.id;
        if (!roomId) return;

        const res = await fetch(`/api/rooms/${roomId}/seats`);
        if (!res.ok) {
          console.error('❌ Failed to fetch seats:', res.status);
          return;
        }

        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.room && Array.isArray(data.room.seats)) {
          // Ensure seats have valid structure with all required fields
          const validatedSeats = data.room.seats.map((s: any, idx: number) => ({
            index: s.index ?? idx,
            user: s.user ? {
              id: s.user.id,
              name: s.user.name || 'Unknown',
              avatar: s.user.avatar || PRESET_AVATARS[0],
              level: s.user.level || 1,
              coins: s.user.coins || 0,
              frameId: s.user.frameId || 'none',
              bubbleId: s.user.bubbleId || 'none',
              badge: s.user.badge || '🎤 Talker'
            } : null,
            isMuted: !!s.isMuted,
            isTalking: !!s.isTalking
          }));
          setSeats(validatedSeats);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Failed to fetch seats:', err);
        }
      }
    };

    // Initial fetch
    fetchSeats();

    // Poll every 1 second for real-time sync
    const interval = setInterval(fetchSeats, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [room]);

  // Seat Action implementation handlers
  const handleSitSelf = async () => {
    try {
      if (selectedSeatIndex === null) return;
      const index = selectedSeatIndex;

      try {
        // First, leave previous seat if any
        if (mySeatIndex !== null) {
          const roomId = (room as any)._id || room.id;
          if (roomId) {
            console.log(`👋 Leaving previous seat ${mySeatIndex}`);
            await fetch(`/api/rooms/${roomId}/seat/${mySeatIndex}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'leave' })
            }).catch(e => console.warn('Couldnt leave previous seat:', e));
          }
        }

        // Now sit in new seat
        const roomId = (room as any)._id || room.id;
        if (!roomId) {
          console.error('❌ No room ID found! Room:', room);
          alert('Error: Unable to identify room. Please try again.');
          return;
        }

        console.log(`🪑 Attempting to sit in seat ${index} in room ${roomId}`);
        const res = await fetch(`/api/rooms/${roomId}/seat/${index}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: currentUser, action: 'sit' })
        });

        console.log(`📍 Server response status: ${res.status}`);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('❌ Server error:', res.status, errData);
          alert(`Failed: ${errData.error || 'Could not sit in seat'}`);
          setShowSeatModal(false);
          return;
        }

        const data = await res.json();
        console.log('📡 Full response:', data);

        if (data.success && data.room) {
          console.log('✅ Successfully sat in seat:', index);
          console.log('📊 New seats:', data.room.seats);

          if (data.room.seats && Array.isArray(data.room.seats)) {
            setSeats(data.room.seats);
          }
          setMySeatIndex(index);

          setChatMessages(prev => [...prev, {
            id: String(Date.now()),
            userId: 'system',
            userName: 'System',
            userLevel: 0,
            message: `${currentUser.name} sat on Mic Seat ${index}! 🎙️`,
            type: 'system'
          }]);

          if (!isMyMicMuted) {
            enableMicrophone();
          }
        } else {
          console.error('❌ Invalid response:', data);
          alert('Invalid server response');
        }
      } catch (err) {
        console.error('❌ Error sitting in seat:', err);
        alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      setShowSeatModal(false);
    } catch (outerErr) {
      console.error('❌ Critical error in handleSitSelf:', outerErr);
      alert('Critical error occurred');
      setShowSeatModal(false);
    }
  };

  const handleSpawnPresetGuest = () => {
    if (selectedSeatIndex === null) return;
    const index = selectedSeatIndex;

    const names = ["Olivia", "William", "Lucas", "Sophia", "Sophia", "Mia", "Amelia", "Jack", "Maya", "Daniel"];
    const nameSelected = names[Math.floor(Math.random() * names.length)] + " ⚡";
    const levelSelected = Math.floor(Math.random() * 40) + 10;
    const avatarSelected = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)];

    const newGuest: User = {
      id: `sim_${Date.now()}`,
      name: nameSelected,
      avatar: avatarSelected,
      level: levelSelected,
      coins: 1200,
      frameId: Math.random() > 0.5 ? 'frame_neon' : 'none',
      bubbleId: 'none',
      badge: '🎤 Talker'
    };

    setSeats(prev => prev.map(s => s.index === index ? { ...s, user: newGuest, isTalking: false, isMuted: false } : s));
    setShowSeatModal(false);

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${nameSelected} entered Mic Seat ${index}!`,
      type: 'system'
    }]);
  };

  const handleCreateCustomGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeatIndex === null || !customGuestName.trim()) return;

    const newGuest: User = {
      id: `custom_${Date.now()}`,
      name: customGuestName.trim(),
      avatar: customGuestAvatar,
      level: customGuestLevel,
      coins: 1000,
      frameId: 'none',
      bubbleId: 'none',
      badge: '🎖️ Member'
    };

    setSeats(prev => prev.map(s => s.index === selectedSeatIndex ? { ...s, user: newGuest, isTalking: false, isMuted: false } : s));
    setShowSeatModal(false);

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${newGuest.name} was seated on Mic Seat ${selectedSeatIndex} by you!`,
      type: 'system'
    }]);
  };

  const handleLeaveSeat = () => {
    if (selectedSeatIndex === null) return;
    const index = selectedSeatIndex;

    const leavingUser = seats[index].user;
    if (!leavingUser) return;

    setSeats(prev => prev.map(s => s.index === index ? { ...s, user: null, isTalking: false } : s));
    
    if (leavingUser.id === currentUser.id) {
      setMySeatIndex(null);
      disableMicrophone();
    }

    setShowSeatModal(false);

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${leavingUser.name} left Mic Seat ${index}.`,
      type: 'system'
    }]);
  };

  const handleToggleMuteSeat = () => {
    if (selectedSeatIndex === null) return;
    setSeats(prev => prev.map(s => s.index === selectedSeatIndex ? { ...s, isMuted: !s.isMuted } : s));
    setShowSeatModal(false);
  };

  const handleForceSpeakSeat = () => {
    if (selectedSeatIndex === null) return;
    setSeats(prev => prev.map(s => s.index === selectedSeatIndex ? { ...s, isTalking: !s.isTalking } : s));
    setShowSeatModal(false);
  };

  const handleForceBotMessage = (text: string) => {
    if (selectedSeatIndex === null) return;
    const speaker = seats[selectedSeatIndex].user;
    if (!speaker) return;

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: speaker.id,
      userName: speaker.name,
      userLevel: speaker.level,
      message: text,
      type: 'text'
    }]);
    setShowSeatModal(false);
  };

  const handleForceBotGift = (gift: Gift) => {
    if (selectedSeatIndex === null) return;
    const speaker = seats[selectedSeatIndex].user;
    if (!speaker) return;

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: speaker.id,
      userName: speaker.name,
      userLevel: speaker.level,
      message: `sent ${gift.icon} ${gift.name} to you! 🎁`,
      type: 'gift',
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCount: 1
    }]);

    setActiveGiftEffect(gift);
    playSynthSound('gift');
    setShowSeatModal(false);
    setTimeout(() => setActiveGiftEffect(null), 3500);
  };

  const toggleMyMic = () => {
    playSynthSound('tap');
    const newMuted = !isMyMicMuted;
    setIsMyMicMuted(newMuted);

    if (mySeatIndex !== null) {
      setSeats(prev => prev.map(s => s.index === mySeatIndex ? { ...s, isMuted: newMuted } : s));
    }

    if (newMuted) {
      disableMicrophone();
    } else {
      enableMicrophone();
    }
  };

  // Simulated reactions trigger helper
  const triggerFlyReaction = (emoji: string, seatIndex: number) => {
    const id = Math.random().toString();
    setReactions(prev => [...prev, { id, emoji, seatIndex }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      userId: currentUser.id,
      userName: currentUser.name,
      userLevel: currentUser.level,
      message: textInput.trim(),
      type: 'text'
    };

    setChatMessages(prev => [...prev, newMsg]);
    setTextInput('');
    playSynthSound('tap');
  };

  // Gift Sending Action Handler
  const handleSendGift = (gift: Gift) => {
    if (currentUser.coins < gift.coins) {
      alert("Insufficient Gold Coins! Please recharge in the Privilege Store. 🪙");
      return;
    }

    const newCoins = currentUser.coins - gift.coins;
    onUpdateCoins(newCoins);

    let recipientName = "the Host";
    if (selectedGiftRecipient !== 'all') {
      recipientName = seats[selectedGiftRecipient]?.user?.name || "the Host";
    }

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      userId: currentUser.id,
      userName: currentUser.name,
      userLevel: currentUser.level,
      message: `sent ${gift.icon} ${gift.name} to ${recipientName}! 🎉`,
      type: 'gift',
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCount: 1
    };

    setChatMessages(prev => [...prev, newMsg]);
    setShowGiftDrawer(false);
    playSynthSound('gift');

    setActiveGiftEffect(gift);
    setTimeout(() => setActiveGiftEffect(null), 4000);
  };

  const toggleBackingTrack = (track: typeof AUDIO_TRACKS[0]) => {
    playSynthSound('tap');
    if (activeTrack?.id === track.id) {
      setIsTrackPlaying(!isTrackPlaying);
    } else {
      setActiveTrack(track);
      setIsTrackPlaying(true);
    }
  };

  // --- LUDO GAME SYSTEM ---
  const handleSetupLudo = () => {
    playSynthSound('tap');
    // Gather all seated players
    const seatedUsers = seats.filter(s => s.user !== null).map((s, idx) => {
      const colors: ('red' | 'green' | 'yellow' | 'blue')[] = ['red', 'green', 'yellow', 'blue'];
      return {
        id: s.user!.id,
        name: s.user!.name,
        avatar: s.user!.avatar,
        color: colors[idx % 4],
        position: 0,
        isBot: s.user!.id !== currentUser.id
      };
    });

    if (seatedUsers.length === 0) {
      alert("At least one speaker must be seated on mic seats to play Ludo!");
      return;
    }

    setLudo({
      players: seatedUsers,
      activePlayerIndex: 0,
      diceValue: 1,
      isRolling: false,
      history: ['Ludo Started! Roll a 6 to speed up! 🎲']
    });
    setActiveGame('ludo');
  };

  const rollLudoDice = () => {
    if (ludo.isRolling || ludo.players.length === 0) return;
    playSynthSound('dice');

    setLudo(prev => ({ ...prev, isRolling: true }));

    setTimeout(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setLudo(prev => {
        const nextPlayers = [...prev.players];
        const activeIdx = prev.activePlayerIndex;
        const player = nextPlayers[activeIdx];

        const oldPos = player.position;
        let newPos = oldPos + value;
        if (newPos > 15) {
          newPos = 15;
        }

        player.position = newPos;
        let actionMsg = `${player.name} rolled a ${value} and advanced to slot ${newPos}!`;

        nextPlayers.forEach((p, idx) => {
          if (idx !== activeIdx && p.position === newPos && newPos !== 0) {
            p.position = 0;
            actionMsg += ` 🎯 Captured ${p.name}! Sent to base!`;
            playSynthSound('win');
          }
        });

        if (newPos === 15) {
          actionMsg += ` 🏆 ${player.name} wins Ludo Match!`;
          playSynthSound('win');
        }

        const nextActiveIdx = (activeIdx + 1) % prev.players.length;

        return {
          ...prev,
          players: nextPlayers,
          activePlayerIndex: nextActiveIdx,
          diceValue: value,
          isRolling: false,
          history: [actionMsg, ...prev.history.slice(0, 4)]
        };
      });
    }, 1000);
  };

  // Bot Auto Roll in Ludo
  useEffect(() => {
    if (activeGame !== 'ludo' || ludo.players.length === 0) return;
    const activePlayer = ludo.players[ludo.activePlayerIndex];
    if (activePlayer && activePlayer.isBot && !ludo.isRolling) {
      const timer = setTimeout(() => {
        rollLudoDice();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeGame, ludo.activePlayerIndex, ludo.isRolling, ludo.players]);

  // --- DICE DUEL GAME ---
  const challengeDiceDuel = () => {
    playSynthSound('tap');
    const occupiedSeats = seats.filter(s => s.user !== null && s.user.id !== currentUser.id);
    const opponent = occupiedSeats[0]?.user || { name: 'Simulated Challenger', avatar: PRESET_AVATARS[1] };

    setDiceDuel({
      player1: { name: opponent.name, avatar: opponent.avatar, score: 0, isRolling: false },
      player2: { name: currentUser.name, avatar: currentUser.avatar, score: 0, isRolling: false },
      status: 'betting',
      winner: null,
      betAmount: 50
    });
    setActiveGame('dice');
  };

  const rollDiceDuel = () => {
    if (diceDuel.status !== 'betting') return;
    playSynthSound('dice');

    setDiceDuel(prev => ({
      ...prev,
      status: 'rolling',
      player1: { ...prev.player1, isRolling: true },
      player2: { ...prev.player2, isRolling: true }
    }));

    setTimeout(() => {
      const score1 = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;
      const score2 = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;

      let winner = "";
      let coinsResult = currentUser.coins;

      if (score2 > score1) {
        winner = currentUser.name;
        coinsResult += diceDuel.betAmount;
        playSynthSound('win');
      } else if (score1 > score2) {
        winner = diceDuel.player1.name;
        coinsResult -= diceDuel.betAmount;
      } else {
        winner = "Draw";
      }

      onUpdateCoins(coinsResult);

      setDiceDuel(prev => ({
        ...prev,
        status: 'finished',
        winner,
        player1: { ...prev.player1, score: score1, isRolling: false },
        player2: { ...prev.player2, score: score2, isRolling: false }
      }));

      setChatMessages(prev => [...prev, {
        id: String(Date.now()),
        userId: 'system',
        userName: 'Game Duel',
        userLevel: 0,
        message: `🎲 Duel Finished! ${currentUser.name} (${score2}) vs ${diceDuel.player1.name} (${score1}). Winner: ${winner === "Draw" ? "Tie!" : winner}!`,
        type: 'roll'
      }]);

    }, 1500);
  };

  // --- LUCKY WHEEL SYSTEM ---
  const spinLuckyWheel = () => {
    if (isWheelSpinning) return;
    if (currentUser.coins < 20) {
      alert("Need at least 20 Gold Coins to spin! 🪙");
      return;
    }

    onUpdateCoins(currentUser.coins - 20);
    setIsWheelSpinning(true);
    playSynthSound('dice');

    const segments = [
      "10 Coins",
      "50 Coins Reward",
      "Red Rose Gift",
      "Royal Crown Gift",
      "Better Luck Next Time",
      "200 Coins Jackpot",
      "Sakura Frame Tryout",
      "Double Entry Reward"
    ];

    const spinDegrees = 1440 + Math.floor(Math.random() * 360);
    setWheelDegree(prev => prev + spinDegrees);

    setTimeout(() => {
      setIsWheelSpinning(false);
      const finalDeg = (wheelDegree + spinDegrees) % 360;
      const segmentIndex = Math.floor((360 - finalDeg) / 45) % 8;
      const result = segments[segmentIndex];
      setWheelResult(result);

      let coinsReward = 0;
      if (result.includes("10 Coins")) coinsReward = 10;
      else if (result.includes("50 Coins")) coinsReward = 50;
      else if (result.includes("200 Coins")) coinsReward = 200;

      if (coinsReward > 0) {
        onUpdateCoins(currentUser.coins - 20 + coinsReward);
        playSynthSound('win');
      }

      setChatMessages(prev => [...prev, {
        id: String(Date.now()),
        userId: 'system',
        userName: 'Lucky Spin',
        userLevel: 0,
        message: `🎡 ${currentUser.name} spun the Lucky Wheel and won: ${result}!`,
        type: 'roll'
      }]);

    }, 3000);
  };

  return (
    <div id="voiceRoom_container" className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden select-none">
      
      {/* Background Themed Atmosphere */}
      <div className={`absolute inset-0 z-0 opacity-20 transition-all pointer-events-none ${
        room.theme === 'neon' ? 'bg-gradient-to-tr from-violet-100 via-slate-50 to-indigo-100' :
        room.theme === 'pink' ? 'bg-gradient-to-tr from-pink-100 via-slate-50 to-rose-100' :
        room.theme === 'royal' ? 'bg-gradient-to-tr from-amber-100 via-slate-50 to-blue-100' :
        'bg-gradient-to-tr from-purple-100 via-slate-50 to-emerald-100'
      }`}></div>

      {/* Fullscreen Gift Animation Overlay */}
      <AnimatePresence>
        {activeGiftEffect && (
          <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
            {activeGiftEffect.effect === 'rose' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center"
              >
                <div className="text-8xl animate-[bounce_1s_infinite]">🌹</div>
                <h3 className="text-xl font-black text-rose-600 drop-shadow-[0_4px_10px_rgba(244,63,94,0.3)] mt-4">
                  ROSE SHOWER SPARKLE!
                </h3>
              </motion.div>
            )}

            {activeGiftEffect.effect === 'crown' && (
              <motion.div 
                initial={{ y: -100, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                transition={{ type: 'spring', damping: 10 }}
                className="flex flex-col items-center"
              >
                <div className="text-8xl drop-shadow-[0_8px_15px_rgba(234,179,8,0.4)]">👑</div>
                <h3 className="text-xl font-black text-amber-500 uppercase tracking-widest mt-4">
                  CROWN OF ROYAL MAJESTY
                </h3>
              </motion.div>
            )}

            {activeGiftEffect.effect === 'car' && (
              <motion.div 
                initial={{ x: -300, y: 100, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, y: 0, opacity: 1, scale: 1.1 }}
                exit={{ x: 300, y: -100, opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="flex flex-col items-center"
              >
                <div className="text-9xl filter hue-rotate-15">🏎️💨</div>
                <h3 className="text-lg font-black text-rose-600 drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)] mt-3">
                  GOLDEN HYPERCAR RACING BY!
                </h3>
              </motion.div>
            )}

            {activeGiftEffect.effect === 'rocket' && (
              <motion.div 
                initial={{ y: 400, opacity: 0, scale: 0.5 }}
                animate={{ y: -150, opacity: 1, scale: 1.2 }}
                exit={{ y: -600, opacity: 0 }}
                transition={{ duration: 2.2, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <div className="text-9xl">🚀</div>
                <h3 className="text-lg font-black text-indigo-600 drop-shadow-[0_4px_12px_rgba(6,182,212,0.3)] uppercase mt-3">
                  COSMIC ROCKET TAKEOFF!
                </h3>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Room Header */}
      <div id="voiceRoom_header" className="h-14 px-4 flex items-center justify-between border-b border-zinc-200 z-10 bg-white/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <button 
            id="voiceRoom_backBtn"
            onClick={onLeave}
            className="text-zinc-500 hover:text-zinc-900 p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-zinc-800 truncate w-[160px]">{room.title}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-rose-500 font-bold">Host: {room.host.name}</span>
              <span className="text-[9px] bg-stone-100 text-zinc-500 px-1.5 py-0.2 rounded font-black">Lvl {room.host.level}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] bg-rose-50 border border-rose-200 text-rose-700 font-black px-2.5 py-1 rounded-full shadow-sm">
            <Users className="w-3 h-3" />
            <span>{seats.filter(s => s.user !== null).length} mic seats</span>
          </div>
          <button 
            id="voiceRoom_exitBtn"
            onClick={onLeave}
            className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] px-3 py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Core Grid / Stage Area: Seats Panel */}
      <div id="voiceRoom_seatsArea" className="flex-1 overflow-y-auto px-4 py-2 scrollbar-none flex flex-col gap-4 z-10 min-h-0 pb-20">
        
        {/* The Host Seat (Featured Top) */}
        <div className="flex flex-col items-center shrink-0 mt-2">
          <div className="relative">
            {seats && seats[0] && seats[0].isTalking && (
              <div className="absolute inset-0 rounded-full bg-rose-400/30 animate-ping border border-rose-400/50 scale-125"></div>
            )}

            <div
              onClick={() => handleSeatClick(0)}
              className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 cursor-pointer flex items-center justify-center bg-white shadow-md hover:scale-105 transition-transform"
            >
              {seats && seats[0] && seats[0].user ? (
                <img src={seats[0].user?.avatar} alt="Host" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🎙️</span>
              )}
              {seats && seats[0] && seats[0].isMuted && (
                <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full p-0.5 border border-white">
                  <MicOff className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>

            {reactions.filter(r => r.seatIndex === 0).map(reaction => (
              <motion.div
                key={reaction.id}
                initial={{ y: 0, opacity: 1, scale: 0.5 }}
                animate={{ y: -70, opacity: 0, scale: 1.5 }}
                transition={{ duration: 1.5 }}
                className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none"
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </div>

          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] bg-gradient-to-r from-amber-500 to-rose-500 text-white font-black px-2 py-0.2 rounded-full uppercase scale-90">
              Host
            </span>
            <span className="text-[10px] font-extrabold text-zinc-700 truncate max-w-[80px]">
              {seats[0].user?.name || "Open Seat"}
            </span>
          </div>
        </div>

        {/* 8 Guests Seats Grid */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-2 bg-white border border-zinc-200/80 rounded-3xl p-3 shadow-sm shrink-0">
          {seats && Array.isArray(seats) && seats.slice(1).map((seat) => {
            const hasUser = seat.user !== null;
            const isMe = hasUser && seat.user?.id === currentUser.id;

            return (
              <div key={seat.index} className="flex flex-col items-center relative">
                <div className="relative">
                  {isMe && myVoiceLevel > 10 && (
                    <span 
                      className="absolute inset-0 rounded-full bg-rose-400/40 animate-pulse border border-rose-400"
                      style={{ transform: `scale(${1 + myVoiceLevel / 100})` }}
                    ></span>
                  )}

                  {!isMe && seat.isTalking && (
                    <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping border border-rose-500/40 scale-125"></span>
                  )}

                  <div 
                    onClick={() => handleSeatClick(seat.index)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                      hasUser 
                        ? (seat.user?.frameId === 'frame_neon' ? 'border-2 border-indigo-400 animate-pulse' :
                           seat.user?.frameId === 'frame_pink' ? 'border-2 border-pink-400' :
                           seat.user?.frameId === 'frame_royal' ? 'border-2 border-amber-400' : 
                           'border border-zinc-200 bg-white shadow-sm')
                        : 'border border-dashed border-zinc-300 bg-stone-50 hover:bg-stone-100 shadow-inner'
                    }`}
                  >
                    {hasUser ? (
                      <img 
                        src={seat.user?.avatar} 
                        alt="User" 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <span className="text-zinc-400 text-xs font-bold">{seat.index}</span>
                    )}

                    {hasUser && seat.isMuted && (
                      <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full p-0.5 border border-white">
                        <MicOff className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {reactions.filter(r => r.seatIndex === seat.index).map(reaction => (
                    <motion.div
                      key={reaction.id}
                      initial={{ y: 0, opacity: 1, scale: 0.5 }}
                      animate={{ y: -60, opacity: 0, scale: 1.4 }}
                      transition={{ duration: 1.5 }}
                      className="absolute inset-0 flex items-center justify-center text-xl pointer-events-none z-30"
                    >
                      {reaction.emoji}
                    </motion.div>
                  ))}
                </div>

                <div className="text-center mt-1 w-full px-1 min-w-0">
                  <p className={`text-[9px] font-semibold truncate ${isMe ? 'text-rose-600 font-black' : 'text-zinc-600'}`}>
                    {hasUser ? seat.user?.name : "Join"}
                  </p>
                  {hasUser && (
                    <span className="text-[7px] bg-stone-100 text-zinc-500 px-1 rounded font-bold">Lvl {seat.user?.level}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Backing Music Player Control (Mini Row) */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-2.5 flex items-center justify-between shrink-0 text-xs shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">🎵</span>
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-400 font-bold leading-tight">Backing Music</p>
              <p className="text-[11px] text-zinc-800 font-black truncate max-w-[150px]">
                {activeTrack ? activeTrack.name : "None Playing"}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {AUDIO_TRACKS.map((track) => (
              <button
                key={track.id}
                onClick={() => toggleBackingTrack(track)}
                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  activeTrack?.id === track.id && isTrackPlaying
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-stone-50 text-zinc-600 border border-zinc-200 hover:bg-stone-100'
                }`}
              >
                {activeTrack?.id === track.id && isTrackPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>

        {/* Game Mode Picker Tabs */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          <button
            onClick={handleSetupLudo}
            className={`py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm border cursor-pointer transition-all ${
              activeGame === 'ludo'
                ? 'bg-amber-500 border-amber-600 text-white'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-stone-50'
            }`}
          >
            <span>🎲 Ludo</span>
          </button>
          <button
            onClick={challengeDiceDuel}
            className={`py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm border cursor-pointer transition-all ${
              activeGame === 'dice'
                ? 'bg-rose-600 border-rose-700 text-white'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-stone-50'
            }`}
          >
            <span>🔥 Duel</span>
          </button>
          <button
            onClick={() => setActiveGame(activeGame === 'wheel' ? 'none' : 'wheel')}
            className={`py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 shadow-sm border cursor-pointer transition-all ${
              activeGame === 'wheel'
                ? 'bg-purple-600 border-purple-700 text-white'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-stone-50'
            }`}
          >
            <span>🎡 Spin</span>
          </button>
          <button
            onClick={() => {
              setSelectedGiftRecipient(0);
              setShowGiftDrawer(true);
            }}
            className="py-2 rounded-xl text-[11px] font-black bg-gradient-to-r from-pink-500 to-rose-600 text-white flex items-center justify-center gap-1 shadow-md border border-pink-500/10 cursor-pointer active:scale-95 transition-all"
          >
            <GiftIcon className="w-3 h-3 fill-white" />
            <span>Gift</span>
          </button>
        </div>

        {/* --- DYNAMIC GAME DRAWERS --- */}
        <AnimatePresence>
          {/* Ludo Game Container */}
          {activeGame === 'ludo' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border border-zinc-200 rounded-3xl p-3.5 flex flex-col gap-3 shrink-0 shadow-md"
            >
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-amber-500 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> ZOYO Fast Ludo Board
                </h4>
                <button 
                  onClick={() => setActiveGame('none')}
                  className="text-zinc-400 hover:text-zinc-700 text-[10px]"
                >
                  ✕ Close
                </button>
              </div>

              {/* Ludo Board */}
              <div className="relative h-20 bg-stone-50 border border-zinc-200 rounded-2xl flex items-center justify-between px-3 overflow-hidden shadow-inner">
                <div className="absolute inset-0 flex items-center justify-between px-4 z-0">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span 
                      key={i} 
                      className={`w-3.5 h-3.5 rounded-full border border-zinc-200 ${
                        i === 0 ? 'bg-red-500/25 border-red-500' :
                        i === 5 ? 'bg-green-500/25 border-green-500' :
                        i === 10 ? 'bg-yellow-500/25 border-yellow-500' :
                        i === 15 ? 'bg-blue-500 border-blue-400 flex items-center justify-center text-[8px] font-bold text-white' :
                        'bg-stone-100'
                      }`}
                    >
                      {i === 15 ? "🏆" : ""}
                    </span>
                  ))}
                </div>

                <div className="absolute inset-0 flex items-center px-4 z-10 pointer-events-none">
                  {ludo.players.map((p, idx) => {
                    const percent = (p.position / 15) * 100;
                    return (
                      <motion.div
                        key={p.id}
                        animate={{ left: `calc(${percent}% + ${idx * 2}px - 6px)` }}
                        className="absolute w-5 h-5 rounded-full shadow-lg flex items-center justify-center border border-white"
                        style={{
                          backgroundColor: p.color === 'red' ? '#ef4444' : p.color === 'green' ? '#22c55e' : p.color === 'blue' ? '#3b82f6' : '#eab308',
                          top: 'calc(50% - 10px)'
                        }}
                      >
                        <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Roll section */}
              {ludo.players.length > 0 ? (
                <div className="flex justify-between items-center bg-stone-50 border border-zinc-150 p-2.5 rounded-xl text-xs shadow-inner">
                  <div>
                    <p className="text-[10px] text-zinc-400">Current Turn:</p>
                    <p className="font-black text-zinc-800">
                      {ludo.players[ludo.activePlayerIndex]?.name} 
                      {ludo.players[ludo.activePlayerIndex]?.isBot ? " (Bot)" : " (You)"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={ludo.isRolling ? { rotate: [0, 90, 180, 270, 360] } : {}}
                      className="w-10 h-10 bg-white border border-zinc-200 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm text-amber-500"
                    >
                      {ludo.isRolling ? '🎲' : ludo.diceValue}
                    </motion.div>

                    <button
                      onClick={rollLudoDice}
                      disabled={ludo.isRolling || ludo.players[ludo.activePlayerIndex]?.isBot}
                      className={`px-4 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all ${
                        ludo.players[ludo.activePlayerIndex]?.isBot 
                          ? 'bg-stone-100 text-zinc-400 cursor-not-allowed'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {ludo.players[ludo.activePlayerIndex]?.isBot ? "Wait Turn" : "Roll"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-[10px] text-zinc-400 py-3">Seats must contain users to play Ludo!</p>
              )}

              <div className="bg-stone-50 border border-zinc-150 p-2 rounded-xl text-[10px] text-zinc-500 h-16 overflow-y-auto font-mono flex flex-col gap-1 shadow-inner">
                {ludo.history.map((h, i) => (
                  <p key={i} className="leading-tight">{h}</p>
                ))}
              </div>
            </motion.div>
          )}

          {/* Dice Duel Game Container */}
          {activeGame === 'dice' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border border-zinc-200 rounded-3xl p-3.5 flex flex-col gap-3 shrink-0 text-xs shadow-md"
            >
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-rose-500 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-500" /> High-Stakes Dice Duel
                </h4>
                <button 
                  onClick={() => setActiveGame('none')}
                  className="text-zinc-400 hover:text-zinc-700 text-[10px]"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 p-2.5 rounded-2xl border border-zinc-200 flex flex-col items-center shadow-inner">
                  <img src={diceDuel.player1.avatar} alt="host" className="w-10 h-10 rounded-full object-cover border border-amber-400" />
                  <p className="font-bold text-zinc-600 mt-1 truncate w-full text-center">{diceDuel.player1.name}</p>
                  <div className="text-xl font-black text-rose-500 mt-2">
                    {diceDuel.player1.isRolling ? "🎲..." : diceDuel.player1.score || "-"}
                  </div>
                </div>

                <div className="bg-stone-50 p-2.5 rounded-2xl border border-zinc-200 flex flex-col items-center shadow-inner">
                  <img src={diceDuel.player2.avatar} alt="me" className="w-10 h-10 rounded-full object-cover border border-rose-500" />
                  <p className="font-bold text-zinc-600 mt-1 truncate w-full text-center">{diceDuel.player2.name}</p>
                  <div className="text-xl font-black text-rose-600 mt-2">
                    {diceDuel.player2.isRolling ? "🎲..." : diceDuel.player2.score || "-"}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-stone-50 border border-zinc-150 p-2 rounded-xl mt-1 shadow-inner">
                <div>
                  <p className="text-[10px] text-zinc-400">Bet Amount:</p>
                  <div className="flex items-center gap-1 font-bold text-amber-600">
                    <span>🪙</span>
                    <span>{diceDuel.betAmount} Coins</span>
                  </div>
                </div>

                {diceDuel.status === 'finished' ? (
                  <div className="text-center font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 animate-pulse">
                    Winner: {diceDuel.winner}!
                  </div>
                ) : (
                  <button
                    onClick={rollDiceDuel}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2 rounded-xl cursor-pointer shadow-md"
                  >
                    Roll Duel Dice!
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Lucky Wheel */}
          {activeGame === 'wheel' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border border-zinc-200 rounded-3xl p-3.5 flex flex-col gap-3 shrink-0 text-xs items-center shadow-md"
            >
              <div className="flex justify-between items-center w-full">
                <h4 className="text-xs font-black text-purple-600 flex items-center gap-1">
                  🎡 Lucky Fortune Wheel
                </h4>
                <button 
                  onClick={() => setActiveGame('none')}
                  className="text-zinc-400 hover:text-zinc-700 text-[10px]"
                >
                  ✕ Close
                </button>
              </div>

              <div className="relative w-36 h-36 rounded-full border-4 border-purple-500 overflow-hidden flex items-center justify-center my-1 shadow-md">
                <div className="absolute top-0 w-4 h-4 bg-rose-500 transform rotate-45 z-20 shadow-sm"></div>

                <div 
                  className="w-full h-full bg-stone-100 rounded-full flex items-center justify-center relative transition-transform duration-[3000ms] ease-out"
                  style={{ transform: `rotate(${wheelDegree}deg)` }}
                >
                  <div className="absolute inset-0 border border-zinc-200 rounded-full">
                    <div className="absolute w-full h-[1px] bg-zinc-300 top-1/2"></div>
                    <div className="absolute w-[1px] h-full bg-zinc-300 left-1/2"></div>
                    <div className="absolute w-full h-[1px] bg-zinc-300 top-1/2 transform rotate-45"></div>
                    <div className="absolute w-full h-[1px] bg-zinc-300 top-1/2 transform -rotate-45"></div>
                  </div>
                  <span className="text-2xl z-10 animate-pulse">🎡</span>
                </div>
              </div>

              <div className="flex justify-between items-center w-full bg-stone-50 border border-zinc-150 p-2.5 rounded-xl shadow-inner">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold">Cost: 20 Coins</p>
                  {wheelResult && (
                    <p className="font-black text-purple-600 animate-bounce">{wheelResult}</p>
                  )}
                </div>

                <button
                  onClick={spinLuckyWheel}
                  disabled={isWheelSpinning}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black px-4 py-2 rounded-xl shadow-md cursor-pointer"
                >
                  {isWheelSpinning ? "Spinning..." : "SPIN!"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Chat Message Logs */}
        <div id="voiceRoom_chatMessages" className="flex-1 min-h-[140px] max-h-[220px] bg-white border border-zinc-200 rounded-3xl p-3.5 overflow-y-auto flex flex-col gap-2.5 scrollbar-none shadow-inner">
          {chatMessages.map((msg) => {
            const isGift = msg.type === 'gift';
            const isSystem = msg.type === 'system';
            const isRoll = msg.type === 'roll';

            return (
              <div key={msg.id} className="text-xs flex flex-col gap-0.5">
                {isSystem ? (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-[10px] leading-relaxed shadow-sm">
                    {msg.message}
                  </div>
                ) : isRoll ? (
                  <div className="bg-amber-50 border border-amber-100 text-amber-800 font-black px-3 py-1.5 rounded-xl text-[10px] leading-relaxed flex items-center gap-1 shadow-sm">
                    <span className="text-sm">🎲</span>
                    <span>{msg.message}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <span className="shrink-0 text-[8px] bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-black">
                      Lvl {msg.userLevel}
                    </span>

                    <div className="flex-1">
                      <span className="font-extrabold text-rose-600 mr-1.5">{msg.userName}:</span>
                      {isGift ? (
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shadow-sm">
                          {msg.message}
                        </span>
                      ) : (
                        <span className="text-zinc-700 leading-normal font-medium">{msg.message}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Mic Seat Control & Flying Reactions Bar */}
      <div className="absolute bottom-16 left-4 right-4 z-20 flex justify-between items-center bg-white/95 backdrop-blur-md border border-zinc-200 rounded-full p-1.5 shadow-md shrink-0">
        <button
          onClick={toggleMyMic}
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all ${
            isMyMicMuted 
              ? 'bg-rose-500 text-white' 
              : 'bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/25'
          }`}
        >
          {isMyMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <div className="flex gap-1.5">
          {['❤️', '😂', '🔥', '🎉', '👍'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                const targetIdx = mySeatIndex !== null ? mySeatIndex : 0;
                triggerFlyReaction(emoji, targetIdx);
                playSynthSound('tap');
              }}
              className="text-lg hover:scale-125 cursor-pointer active:scale-95 transition-all bg-stone-50 hover:bg-stone-100/85 w-8 h-8 rounded-full flex items-center justify-center border border-zinc-200 shadow-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Message Chat Input Bar */}
      <form 
        id="voiceRoom_chatInputForm"
        onSubmit={handleSendMessage}
        className="h-14 px-4 bg-white border-t border-zinc-200 flex items-center gap-2 shrink-0 z-20"
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Say something to room..."
          className="flex-1 bg-stone-50 border border-zinc-250 rounded-full px-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-pink-500 to-rose-600 text-white p-2.5 rounded-full cursor-pointer shadow-sm active:scale-95 transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Gift Selection Drawer */}
      {showGiftDrawer && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex flex-col justify-end">
          <div className="bg-white border-t border-zinc-200 rounded-t-[32px] p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 max-h-[85%] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-zinc-800">Send Animated Gift</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Your balance: <span className="text-amber-600 font-bold">🪙 {currentUser.coins}</span></p>
              </div>
              <button
                onClick={() => setShowGiftDrawer(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1 rounded-full text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-bold text-zinc-500">Select Recipient:</label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedGiftRecipient('all')}
                  className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-all cursor-pointer border ${
                    selectedGiftRecipient === 'all'
                      ? 'bg-rose-50 border-rose-300 text-rose-600'
                      : 'bg-stone-50 border-zinc-200 text-zinc-600'
                  }`}
                >
                  🌐 Send to All Seats
                </button>
                {seats.filter(s => s.user !== null).map((seat) => (
                  <button
                    key={seat.index}
                    onClick={() => setSelectedGiftRecipient(seat.index)}
                    className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-all cursor-pointer border flex items-center gap-1 ${
                      selectedGiftRecipient === seat.index
                        ? 'bg-rose-50 border-rose-300 text-rose-600'
                        : 'bg-stone-50 border-zinc-200 text-zinc-600'
                    }`}
                  >
                    <img src={seat.user?.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                    <span>{seat.user?.name} {seat.index === 0 ? "(Host)" : `(Seat ${seat.index})`}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pb-4">
              {GIFTS.map((gift) => (
                <div
                  key={gift.id}
                  onClick={() => handleSendGift(gift)}
                  className="bg-stone-50 border border-zinc-200 rounded-2xl p-3 flex items-center gap-3 hover:border-rose-500 cursor-pointer active:scale-95 transition-all shadow-sm"
                >
                  <span className="text-3xl">{gift.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-zinc-700">{gift.name}</p>
                    <div className="flex items-center gap-0.5 mt-0.5 text-[10px] text-amber-600 font-bold">
                      <span>🪙</span>
                      <span>{gift.coins}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SEAT ACTION CONTROL MODAL DIALOG --- */}
      {showSeatModal && selectedSeatIndex !== null && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
              <h3 className="text-xs font-black text-zinc-800 flex items-center gap-1">
                ⚙️ Seat {selectedSeatIndex} Operator Controls
              </h3>
              <button
                onClick={() => setShowSeatModal(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1.5 rounded-full text-xs"
              >
                ✕
              </button>
            </div>

            {/* SEAT STATE CONTENT */}
            {seats[selectedSeatIndex].user ? (
              // Occupied Seat Options
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex items-center gap-3 bg-stone-50 border border-zinc-150 p-2.5 rounded-2xl shadow-inner">
                  <img src={seats[selectedSeatIndex].user?.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className="font-black text-zinc-800">{seats[selectedSeatIndex].user?.name}</h4>
                    <p className="text-[10px] text-zinc-400">Badge: {seats[selectedSeatIndex].user?.badge} • Lvl {seats[selectedSeatIndex].user?.level}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleMuteSeat}
                    className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      seats[selectedSeatIndex].isMuted
                        ? 'bg-rose-50 border border-rose-300 text-rose-600 shadow-sm'
                        : 'bg-stone-50 border border-zinc-200 text-zinc-500 hover:bg-stone-100 shadow-sm'
                    }`}
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>{seats[selectedSeatIndex].isMuted ? "Unmute Guest" : "Mute Guest"}</span>
                  </button>

                  <button
                    onClick={handleForceSpeakSeat}
                    className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      seats[selectedSeatIndex].isTalking
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-600 shadow-sm'
                        : 'bg-stone-50 border border-zinc-200 text-zinc-500 hover:bg-stone-100 shadow-sm'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 animate-pulse" />
                    <span>{seats[selectedSeatIndex].isTalking ? "Force Silence" : "Force Speak"}</span>
                  </button>
                </div>

                {/* Simulated Bot Commands (if guest is not the current user) */}
                {seats[selectedSeatIndex].user?.id !== currentUser.id && (
                  <div className="flex flex-col gap-2.5 bg-stone-50 p-3 rounded-2xl border border-zinc-150 shadow-inner">
                    <p className="font-black text-zinc-400 text-[10px] uppercase tracking-wider">Guest Bot Operations</p>
                    
                    {/* Bot messaging trigger */}
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Make guest say something..."
                        id="botSpeakInput"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleForceBotMessage((e.target as HTMLInputElement).value);
                          }
                        }}
                        className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-800 flex-1 focus:outline-none focus:border-rose-500 shadow-sm"
                      />
                      <button
                        onClick={() => {
                          const val = (document.getElementById('botSpeakInput') as HTMLInputElement)?.value;
                          if (val) handleForceBotMessage(val);
                        }}
                        className="bg-rose-600 text-white p-1 rounded-lg cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bot gifting trigger */}
                    <div>
                      <p className="text-[9px] text-zinc-400 mb-1 font-bold">Force guest to send gift to you:</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {GIFTS.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => handleForceBotGift(g)}
                            className="bg-white border border-zinc-250 rounded-lg py-1 text-[10px] hover:border-rose-500 shadow-sm text-zinc-700"
                          >
                            {g.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleLeaveSeat}
                  className="w-full mt-1 bg-rose-50 border border-rose-200 text-rose-600 font-bold py-2.5 rounded-xl hover:bg-rose-100/50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Trash className="w-4 h-4" />
                  <span>{seats[selectedSeatIndex].user?.id === currentUser.id ? "Leave Seat" : "Remove Guest"}</span>
                </button>
              </div>
            ) : (
              // Empty Seat Options (Let them place guest or themselves)
              <div className="flex flex-col gap-3 text-xs">
                <button
                  onClick={handleSitSelf}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black py-2.5 rounded-xl hover:opacity-95 shadow-md shadow-pink-500/10 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Mic className="w-4 h-4" />
                  <span>Sit Here Myself (Join Mic Speakers)</span>
                </button>

                <div className="text-center text-[10px] text-zinc-400 my-1">— OR —</div>

                <button
                  onClick={handleSpawnPresetGuest}
                  className="w-full bg-stone-50 border border-zinc-200 text-zinc-600 hover:bg-stone-100 font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Spawn Random Simulated Guest</span>
                </button>

                {/* Add fully customized guest form */}
                <form onSubmit={handleCreateCustomGuest} className="flex flex-col gap-2.5 bg-stone-50 p-3 rounded-2xl border border-zinc-150 mt-1 shadow-inner">
                  <p className="font-black text-zinc-400 text-[9px] uppercase tracking-wider">Configure Custom Guest Seat</p>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-zinc-400 font-bold">Guest Nickname</label>
                    <input
                      type="text"
                      required
                      value={customGuestName}
                      onChange={(e) => setCustomGuestName(e.target.value)}
                      placeholder="e.g. Leo 🐺"
                      className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[11px] text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-zinc-400 font-bold font-sans">Choose Guest Avatar Preset</label>
                    <div className="flex gap-2.5 justify-center py-1">
                      {PRESET_AVATARS.map((av, idx) => (
                        <img
                          key={idx}
                          src={av}
                          alt=""
                          onClick={() => setCustomGuestAvatar(av)}
                          className={`w-6 h-6 rounded-full object-cover cursor-pointer border transition-all ${
                            customGuestAvatar === av ? 'border-rose-500 scale-110 shadow-sm' : 'border-zinc-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-1 bg-rose-600 text-white font-black py-2 rounded-lg cursor-pointer hover:bg-rose-700 shadow-sm"
                  >
                    + Place Customized Guest
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
