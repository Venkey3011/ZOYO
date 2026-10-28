import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Room, User, Seat, ChatMessage, Gift, LudoState, DiceDuelState } from '../types';
import { GIFTS, AUDIO_TRACKS, PRESET_AVATARS, ROOM_WALLPAPERS } from '../data';
import { 
  ChevronLeft, Users, Mic, MicOff, Send, 
  Trophy, Sparkles, X, Gift as GiftIcon, Flame, Play, Pause,
  CornerDownRight, RefreshCw, Smile, Zap, MessageSquare, Award, UserPlus, Trash, VolumeX, MessageSquareDashed,
  Share2, Copy, Eye, UserX, ShieldAlert, Palette, Music, Volume2, Disc, SkipForward, SkipBack, Sliders, Check, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from './Toast';
import UserProfileModal from './UserProfileModal';
import { registerBackHandler } from '../lib/navigation';
import {
  Room as LiveKitRoom,
  RoomEvent,
  Track,
  Participant,
  LocalParticipant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  createLocalAudioTrack,
  ConnectionState
} from 'livekit-client';

interface VoiceRoomProps {
  room: Room;
  onLeave: () => void;
  currentUser: User;
  onUpdateCoins: (newCoins: number) => void;
  onSendMessage: (message: ChatMessage) => void;
}

export default function VoiceRoom({ room, onLeave, currentUser, onUpdateCoins, onSendMessage }: VoiceRoomProps) {
  // Debug logging
  console.log('🔍 VoiceRoom received:', {
    hasRoom: !!room,
    roomId: (room as any)?._id || room?.id,
    hasHost: !!room?.host,
    hostName: room?.host?.name,
    hasSeats: !!room?.seats,
    seatsLength: room?.seats?.length,
    roomTitle: room?.title,
    roomTheme: room?.theme,
    roomCategory: room?.category
  });

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

  // Ensure room has all required properties with defaults
  const safeRoom = {
    ...room,
    title: room.title || 'Unknown Room',
    theme: room.theme || 'neon',
    category: room.category || 'chat',
    host: room.host || { id: 'host', name: 'Host', avatar: PRESET_AVATARS[0], level: 1, coins: 0, frameId: 'none', bubbleId: 'none', badge: '🎙️ Host' }
  };

  if (!safeRoom.host) {
    console.error('VoiceRoom room missing host:', safeRoom);
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
    const seatsData = safeRoom.seats;
    if (seatsData && Array.isArray(seatsData) && seatsData.length >= 9) {
      return seatsData.map(s => {
        if (s.index === 0) {
          const hostUser = s.user || safeRoom.host;
          return {
            index: 0,
            user: hostUser ? { ...hostUser, avatar: hostUser.avatar || PRESET_AVATARS[0], name: hostUser.name || safeRoom.host?.name || 'Host', level: hostUser.level || 1, coins: hostUser.coins || 0, frameId: hostUser.frameId || 'none', bubbleId: hostUser.bubbleId || 'none', badge: hostUser.badge || '👑 Host' } : safeRoom.host,
            isMuted: !!s.isMuted,
            isTalking: !!s.isTalking
          };
        }
        return {
          index: s.index,
          user: s.user ? { ...s.user, avatar: s.user.avatar || PRESET_AVATARS[0], name: s.user.name || 'Unknown', level: s.user.level || 1, coins: s.user.coins || 0, frameId: s.user.frameId || 'none', bubbleId: s.user.bubbleId || 'none', badge: s.user.badge || '🎤 Talker' } : null,
          isMuted: !!s.isMuted,
          isTalking: !!s.isTalking
        };
      }) as Seat[];
    }
    // Fallback: host at seat 0, empty guest seats 1-8
    return [
      { index: 0, user: safeRoom.host ? { ...safeRoom.host, avatar: safeRoom.host.avatar || PRESET_AVATARS[0], coins: safeRoom.host.coins || 0, frameId: safeRoom.host.frameId || 'none', bubbleId: safeRoom.host.bubbleId || 'none', badge: safeRoom.host.badge || '🎙️ Host' } : null, isMuted: false, isTalking: false },
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

  const initialSeats = getInitialSeats();
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const currentUserId = String(currentUser._id || currentUser.id);

  // Determine initial seat index for current user (only if actually occupying a seat)
  const findInitialSeat = (): number | null => {
    const found = initialSeats.find(s => s.user && String(s.user._id || s.user.id || (s.user as any).userId) === currentUserId);
    if (found) return found.index;
    return null;
  };

  const [mySeatIndex, setMySeatIndex] = useState<number | null>(findInitialSeat);
  const mySeatIndexRef = useRef<number | null>(mySeatIndex);
  useEffect(() => {
    mySeatIndexRef.current = mySeatIndex;
  }, [mySeatIndex]);

  const roomId = String((safeRoom as any)._id || safeRoom.id);

  // Online Room Users (Audience + Speakers)
  const [onlineUsers, setOnlineUsers] = useState<User[]>([currentUser]);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<{ [peerId: string]: MediaStream }>({});
  const [isTypingInChat, setIsTypingInChat] = useState(false);

  // Strictly deduplicated participants list for clean UI
  const uniqueParticipants = Array.from(
    new Map(
      onlineUsers.map((u) => {
        const key = (u.name || String((u as any).userId || (u as any)._id || u.id || '')).toLowerCase().trim();
        return [key, u];
      })
    ).values()
  ) as User[];

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  // High-Speed WebRTC Mesh Peer Connections (<25ms audio)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // LiveKit Room ref (optional accelerator)
  const lkRoomRef = useRef<LiveKitRoom | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null); // kept for mic enable/disable
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map()); // audio output elements
  const isSpeakingRef = useRef<boolean>(false);
  const [lkConnected, setLkConnected] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', userId: 'system', userName: 'System', userLevel: 99, message: `Welcome to ${safeRoom.host.name}'s voice room! Grab a mic seat to talk live or chat with everyone! 🎙️✨`, type: 'system' }
  ]);
  const [textInput, setTextInput] = useState('');
  const [activeGame, setActiveGame] = useState<'none' | 'ludo' | 'dice' | 'wheel'>('none');
  const [showGiftDrawer, setShowGiftDrawer] = useState(false);
  const [selectedGiftRecipient, setSelectedGiftRecipient] = useState<number | 'all'>(0);
  const [activeGiftEffect, setActiveGiftEffect] = useState<Gift | null>(null);
  const [dynamicGifts, setDynamicGifts] = useState<Gift[]>(GIFTS);
  const [inspectedUser, setInspectedUser] = useState<User | null>(null);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [activeTrack, setActiveTrack] = useState<typeof AUDIO_TRACKS[0] | null>(null);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isMyMicMuted, setIsMyMicMuted] = useState(false);

  // Fetch dynamic catalog gifts published by Admin or Managers
  useEffect(() => {
    fetch('/api/catalog/gifts')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.gifts) && d.gifts.length > 0) {
          setDynamicGifts(d.gifts);
        }
      })
      .catch(() => {});
  }, []);

  // Host privileges (room creator or admin/manager)
  const isCurrentUserHost = 
    currentUserId === String((safeRoom.host as any)?._id || safeRoom.host?.id) || 
    currentUser.name === safeRoom.host?.name ||
    currentUser.role === 'admin' ||
    currentUser.role === 'manager';
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [invitedSet, setInvitedSet] = useState<Set<string>>(new Set());
  const [inviteLoading, setInviteLoading] = useState(false);


  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [customGuestName, setCustomGuestName] = useState('');
  const [customGuestAvatar, setCustomGuestAvatar] = useState(PRESET_AVATARS[1]);
  const [customGuestLevel, setCustomGuestLevel] = useState(15);

  // Floating reactions list
  const [reactions, setReactions] = useState<{ id: string; emoji: string; seatIndex: number }[]>([]);

  // Room Customization State
  const defaultWallpaper = (safeRoom as any).backgroundUrl || ROOM_WALLPAPERS[0].url;
  const [roomBackground, setRoomBackground] = useState<string>(defaultWallpaper);
  const [roomTitle, setRoomTitle] = useState<string>(safeRoom.title || 'Voice Room');
  const [roomNotice, setRoomNotice] = useState<string>((safeRoom as any).notice || safeRoom.description || 'Welcome to the room! Sit back, relax and enjoy the vibes ✨');
  const [seatStyle, setSeatStyle] = useState<'sofa' | 'classic'>((safeRoom as any).seatStyle || 'sofa');
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [customWallpaperInput, setCustomWallpaperInput] = useState('');
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  // Music Player State (Host & Audience Synchronized)
  const [showMusicDrawer, setShowMusicDrawer] = useState(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.7);
  const [musicProgress, setMusicProgress] = useState<number>(0);
  const [musicDuration, setMusicDuration] = useState<number>(0);
  const [customAudioUrl, setCustomAudioUrl] = useState<string>('');
  const [customAudioName, setCustomAudioName] = useState<string>('');
  const roomMusicAudioRef = useRef<HTMLAudioElement | null>(null);

  // Intercept hardware / gesture back button to close any open modal or drawer in VoiceRoom
  useEffect(() => {
    if (showGiftDrawer || showAudienceModal || showSeatModal || showUserProfileModal || showInvitePanel || showCustomizationModal || showMusicDrawer) {
      return registerBackHandler(() => {
        if (showCustomizationModal) {
          setShowCustomizationModal(false);
          return true;
        }
        if (showMusicDrawer) {
          setShowMusicDrawer(false);
          return true;
        }
        if (showGiftDrawer) {
          setShowGiftDrawer(false);
          return true;
        }
        if (showAudienceModal) {
          setShowAudienceModal(false);
          return true;
        }
        if (showSeatModal) {
          setShowSeatModal(false);
          return true;
        }
        if (showUserProfileModal) {
          setShowUserProfileModal(false);
          return true;
        }
        if (showInvitePanel) {
          setShowInvitePanel(false);
          return true;
        }
        return false;
      });
    }
  }, [showGiftDrawer, showAudienceModal, showSeatModal, showUserProfileModal, showInvitePanel, showCustomizationModal, showMusicDrawer]);

  // Sound Synthesizer (AudioContext)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Microphone state & visualizer (120 FPS high-refresh optimized)
  const [myVoiceLevel, setMyVoiceLevel] = useState(0);
  const lastVoiceUpdateRef = useRef<number>(0);
  const lastVoiceLevelValRef = useRef<number>(0);
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
    player1: { name: safeRoom.host.name, avatar: safeRoom.host.avatar, score: 0, isRolling: false },
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
        // Magical celestial chime fanfare (C6, E6, G6, C7 shimmer with harmonic sparkle)
        const notes = [1046.50, 1318.51, 1567.98, 2093.00];
        notes.forEach((freq, idx) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.type = 'sine';
          noteOsc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          noteGain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
          noteGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.03);
          noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.45);
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.start(ctx.currentTime + idx * 0.08);
          noteOsc.stop(ctx.currentTime + idx * 0.08 + 0.45);
        });
        return;
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

  // Helper to send messages over WebSocket
  const sendWs = (type: string, payload?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type,
          roomId,
          userId: currentUserId,
          userName: currentUser.name,
          payload
        }));
      } catch (err) {
        console.warn('Failed to send WS message:', err);
      }
    }
  };

  // --- LIVEKIT VOICE AUDIO SYSTEM (replaces raw WebRTC P2P) ---

  // --- HIGH-SPEED REAL-TIME WEBRTC MESH AUDIO SYSTEM (<25ms LATENCY) ---
  const createPeerConnection = useCallback((peerId: string, isInitiator: boolean) => {
    if (!peerId || peerId === currentUserId) return null;

    // Clean up existing connection if already present
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
      peerConnectionsRef.current.delete(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      iceCandidatePoolSize: 10
    });

    peerConnectionsRef.current.set(peerId, pc);

    // Attach local microphone audio track if we are currently seated
    const localStream = micStreamRef.current || localStreamRef.current;
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        try {
          pc.addTrack(track, localStream);
        } catch (e) {}
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWs('webrtc_signal', {
          targetUserId: peerId,
          signal: { candidate: event.candidate },
          seatIndex: mySeatIndexRef.current
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`🔊 [WebRTC] Audio stream received from speaker ${peerId}`);
      const stream = event.streams[0] || new MediaStream([event.track]);
      playRemoteAudio(peerId, stream);
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          sendWs('webrtc_signal', {
            targetUserId: peerId,
            signal: { sdp: pc.localDescription },
            seatIndex: mySeatIndexRef.current
          });
        })
        .catch(err => console.warn(`[WebRTC] Offer error for ${peerId}:`, err));
    }

    return pc;
  }, [currentUserId]);

  const playRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    let audio = remoteAudiosRef.current.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.volume = 1.0;
      remoteAudiosRef.current.set(peerId, audio);
      document.body.appendChild(audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.play().catch(e => {
      console.warn(`Autoplay gesture required for speaker ${peerId}:`, e);
      setAudioAutoplayBlocked(true);
    });
  }, []);

  const handleWebRTCSignal = useCallback(async (senderId: string, signal: any) => {
    try {
      if (!senderId || senderId === currentUserId) return;
      let pc = peerConnectionsRef.current.get(senderId);

      if (signal.sdp) {
        if (signal.sdp.type === 'offer') {
          pc = createPeerConnection(senderId, false);
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Ensure local mic tracks are added if we are currently seated as a speaker
          const localStream = micStreamRef.current || localStreamRef.current;
          if (localStream && pc.getSenders().length === 0) {
            localStream.getAudioTracks().forEach(track => {
              try { pc.addTrack(track, localStream); } catch (e) {}
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWs('webrtc_signal', {
            targetUserId: senderId,
            signal: { sdp: pc.localDescription },
            seatIndex: mySeatIndexRef.current
          });
        } else if (signal.sdp.type === 'answer') {
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        }
      } else if (signal.candidate) {
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err) {
      console.warn('WebRTC signal processing warning:', err);
    }
  }, [currentUserId, createPeerConnection]);

  // Optional LiveKit cloud accelerator (connects when configured with wss://)
  const connectLiveKit = useCallback(async () => {
    if (lkRoomRef.current && lkRoomRef.current.state === ConnectionState.Connected) return;
    if (!roomId || roomId.startsWith('room_')) return;
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, userName: currentUser.name, roomId })
      });
      const data = await res.json();
      if (!data.success || !data.token || !data.url?.startsWith('wss://')) return;

      const lkRoom = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      lkRoomRef.current = lkRoom;

      lkRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach() as HTMLAudioElement;
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
          remoteAudiosRef.current.set(participant.identity, audioEl);
          audioEl.play().catch(() => setAudioAutoplayBlocked(true));
        }
      });

      lkRoom.on(RoomEvent.Connected, () => setLkConnected(true));
      lkRoom.on(RoomEvent.Disconnected, () => setLkConnected(false));
      await lkRoom.connect(data.url, data.token);
    } catch (err) {
      // LiveKit is optional; WebRTC direct audio handles all voice transfer instantly
    }
  }, [roomId, currentUserId, currentUser.name]);

  const disconnectLiveKit = useCallback(() => {
    if (lkRoomRef.current) {
      try { lkRoomRef.current.disconnect(); } catch (e) {}
      lkRoomRef.current = null;
      setLkConnected(false);
    }
  }, []);

  // Microphone capture & real-time speaking detection (Ultra-low latency <20ms)
  const enableMicrophone = async () => {
    try {
      console.log('🎤 Requesting low-latency microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono saves 50% packet overhead for real-time speed
          sampleRate: 48000,
          latency: 0.01 // Request minimum buffer
        } as any,
        video: false
      });
      micStreamRef.current = stream;
      localStreamRef.current = stream;

      // Attach our audio track to all active peer connections immediately
      peerConnectionsRef.current.forEach((pc) => {
        stream.getAudioTracks().forEach(track => {
          try {
            const senders = pc.getSenders();
            const existing = senders.find(s => s.track?.kind === 'audio');
            if (existing) {
              existing.replaceTrack(track);
            } else {
              pc.addTrack(track, stream);
            }
          } catch (e) {}
        });
      });

      // Broadcast speaker_ready to room so all clients connect to receive audio
      sendWs('speaker_ready', { seatIndex: mySeatIndexRef.current });

      // Connect to all online users in the room
      onlineUsers.forEach((u: any) => {
        const uId = String(u._id || u.id || u.userId);
        if (uId && uId !== currentUserId && !peerConnectionsRef.current.has(uId)) {
          createPeerConnection(uId, true);
        }
      });

      // Also connect LiveKit in parallel if cloud URL configured
      connectLiveKit().catch(() => {});

      // Audio analyser for real-time visual speech ring
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
        const level = Math.min(100, Math.floor(average * 1.5));
        
        // ⚡ 120 FPS Optimization: Throttle React state re-renders to only significant audio changes
        const now = performance.now();
        const diff = Math.abs(level - lastVoiceLevelValRef.current);
        if ((now - lastVoiceUpdateRef.current > 50 && diff >= 4) || (level <= 5 && lastVoiceLevelValRef.current > 5) || (level > 12 && lastVoiceLevelValRef.current <= 12)) {
          lastVoiceUpdateRef.current = now;
          lastVoiceLevelValRef.current = level;
          setMyVoiceLevel(level);
        }

        const currentSeat = mySeatIndexRef.current;
        if (currentSeat !== null && !isMyMicMuted) {
          if (level > 12 && !isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setSeats(prev => prev.map(s => s.index === currentSeat ? { ...s, isTalking: true } : s));
            sendWs('seat_status', { seatIndex: currentSeat, isTalking: true, isMuted: false });
          } else if (level <= 12 && isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setSeats(prev => prev.map(s => s.index === currentSeat ? { ...s, isTalking: false } : s));
            sendWs('seat_status', { seatIndex: currentSeat, isTalking: false, isMuted: false });
          }
        }

        micRafIdRef.current = requestAnimationFrame(updateAmplitude);
      };
      updateAmplitude();
      console.log('✅ Low-latency real-time microphone active (<25ms)!');
    } catch (err) {
      console.warn("Microphone access unavailable or denied:", err);
      toast('Could not access microphone. Please grant mic permissions.', 'error');
    }
  };

  const disableMicrophone = () => {
    if (micRafIdRef.current) cancelAnimationFrame(micRafIdRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        track.enabled = false;
        track.stop();
      });
    }

    // Remove track from all peer connections
    peerConnectionsRef.current.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          try { pc.removeTrack(sender); } catch (e) {}
        }
      });
    });

    micStreamRef.current = null;
    localStreamRef.current = null;
    micAnalyserRef.current = null;
    isSpeakingRef.current = false;
    setMyVoiceLevel(0);

    const seatIdx = mySeatIndexRef.current;
    if (seatIdx !== null) {
      setSeats(prev => prev.map(s => s.index === seatIdx ? { ...s, isTalking: false, isMuted: true } : s));
      sendWs('seat_status', { seatIndex: seatIdx, isTalking: false, isMuted: true });
    }

    if (lkRoomRef.current && lkRoomRef.current.state === ConnectionState.Connected) {
      lkRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
  };

  // --- HOST KICK OPERATIONS ---
  const handleKickUserFromSeat = async (seatIndex: number, targetUser?: User) => {
    if (!isCurrentUserHost) {
      toast('Only the room host can kick people from seats 👑', 'error');
      return;
    }
    const seat = seats[seatIndex];
    const userToKick = targetUser || seat?.user;
    if (!userToKick) {
      setShowSeatModal(false);
      setShowUserProfileModal(false);
      return;
    }

    if (seatIndex === 0) {
      toast('Cannot kick the host from the host seat 👑', 'error');
      return;
    }

    setShowSeatModal(false);
    setShowUserProfileModal(false);

    // Optimistically vacate seat locally (<1ms)
    setSeats(prev => prev.map(s => s.index === seatIndex ? {
      ...s,
      user: null,
      isTalking: false,
      isMuted: false
    } : s));

    toast(`Kicked ${userToKick.name} from Mic Seat ${seatIndex} 🚫`, 'info');

    // Notify backend
    try {
      await fetch(`/api/rooms/${roomId}/seat/${seatIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kick',
          hostId: currentUserId,
          hostName: currentUser.name,
          targetUserId: userToKick._id || userToKick.id,
          targetUserName: userToKick.name
        })
      });
    } catch (err) {
      console.warn('Failed to kick user from seat on server:', err);
    }

    sendWs('seat_status', { seatIndex, isTalking: false, isMuted: false });
  };

  const handleKickUserFromRoom = async (targetUser: User) => {
    if (!isCurrentUserHost) {
      toast('Only the room host can kick users 👑', 'error');
      return;
    }
    const tId = String(targetUser._id || targetUser.id);
    if (tId === currentUserId) {
      toast('You cannot kick yourself 😅', 'error');
      return;
    }

    setShowUserProfileModal(false);
    setShowSeatModal(false);
    setShowAudienceModal(false);

    // Optimistically remove from online users and seats
    setOnlineUsers(prev => prev.filter(u => String(u._id || u.id) !== tId && u.name !== targetUser.name));
    setSeats(prev => prev.map(s => s.user && (String(s.user._id || s.user.id) === tId || s.user.name === targetUser.name) ? {
      ...s,
      user: s.index === 0 ? safeRoom.host : null,
      isTalking: false,
      isMuted: false
    } : s));

    toast(`Kicked ${targetUser.name} from the room 🚷`, 'info');

    try {
      await fetch(`/api/rooms/${roomId}/kick-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: currentUserId,
          hostName: currentUser.name,
          targetUserId: tId,
          targetUserName: targetUser.name
        })
      });
    } catch (err) {
      console.warn('Failed to kick user from room on server:', err);
    }
  };

  // --- REAL-TIME WEBSOCKET ROOM SYNC ---
  useEffect(() => {
    // ⚡ Skip temp optimistic IDs — wait for real MongoDB _id from server
    if (!roomId || roomId.startsWith('room_')) return;

    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`🔌 [WS] Connecting to ${wsUrl} for room ${roomId}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ [WS] Connected to room ${roomId}`);
        reconnectAttempts = 0; // reset on successful connect
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId,
          userId: currentUserId,
          userName: currentUser.name,
          payload: {
            avatar: currentUser.avatar,
            level: currentUser.level
          }
        }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          console.log(`📥 [WS Event]`, data.type);

          if (data.type === 'room_init') {
            if (data.seats && Array.isArray(data.seats)) {
              const sanitizedSeats = data.seats.map((s: any) => {
                if (s.index === 0 && !s.user) {
                  return { ...s, user: safeRoom.host };
                }
                return s;
              });
              setSeats(sanitizedSeats);
              const found = sanitizedSeats.find((s: any) => s.user && String(s.user._id || s.user.id) === currentUserId);
              if (found) setMySeatIndex(found.index);

              // Connect WebRTC peer connection to all currently occupied seats (<25ms voice)
              sanitizedSeats.forEach((s: any) => {
                if (s.user) {
                  const sUid = String(s.user._id || s.user.id);
                  if (sUid && sUid !== currentUserId && !peerConnectionsRef.current.has(sUid)) {
                    createPeerConnection(sUid, true);
                  }
                }
              });
            }
            if (data.onlineUsers && Array.isArray(data.onlineUsers)) {
              setOnlineUsers(data.onlineUsers);
            }
            if (data.chatMessages && Array.isArray(data.chatMessages)) {
              setChatMessages(data.chatMessages);
            }
            if (data.activeGame) {
              setActiveGame(data.activeGame);
            }
          } else if (data.type === 'user_joined') {
            if (data.onlineUsers) setOnlineUsers(data.onlineUsers);
            if (data.user) {
              const joinText = `${data.user.name} joined the room! 👋`;
              setChatMessages(prev => {
                const hasRecent = prev.slice(-3).some(m => m.type === 'system' && m.message === joinText);
                if (hasRecent) return prev;
                return [...prev, {
                  id: `join_${data.user._id || data.user.id || data.user.name}_${Date.now()}`,
                  userId: 'system',
                  userName: 'System',
                  userLevel: 0,
                  message: joinText,
                  type: 'system'
                }];
              });
            }
          } else if (data.type === 'user_left') {
            if (data.onlineUsers) setOnlineUsers(data.onlineUsers);
            if (data.seats) setSeats(data.seats);
            if (data.userId) {
              const uId = String(data.userId);
              const pc = peerConnectionsRef.current.get(uId);
              if (pc) {
                try { pc.close(); } catch (e) {}
                peerConnectionsRef.current.delete(uId);
              }
              const audio = remoteAudiosRef.current.get(uId);
              if (audio) {
                try { audio.pause(); audio.remove(); } catch (e) {}
                remoteAudiosRef.current.delete(uId);
              }
            }
          } else if (data.type === 'seats_updated') {
            if (data.seats && Array.isArray(data.seats)) {
              const rawSeats = data.seats;
              const sanitized = Array.from({ length: 9 }, (_, i) => {
                const s = rawSeats.find((item: any) => item && item.index === i) || rawSeats[i];
                return {
                  index: i,
                  user: (i === 0 && !s?.user) ? safeRoom.host : (s?.user || null),
                  isMuted: Boolean(s?.isMuted),
                  isTalking: Boolean(s?.isTalking)
                };
              });
              setSeats(sanitized);

              // Check if seated in guest seats 1-8 first, fallback to seat 0 for host
              const guestSeat = sanitized.slice(1).find((s: any) => s.user && (String(s.user._id || s.user.id) === currentUserId || s.user.name === currentUser.name));
              const found = guestSeat || (isCurrentUserHost ? sanitized[0] : null);

              if (!found && mySeatIndexRef.current !== null && mySeatIndexRef.current !== 0) {
                // We were kicked/displaced from seat
                disableMicrophone();
                setMySeatIndex(null);
                toast('You were removed from the mic seat', 'info');
              } else if (found) {
                setMySeatIndex(found.index);
              }
            }
          } else if (data.type === 'speaker_ready') {
            const speakerId = String(data.userId);
            if (speakerId && speakerId !== currentUserId) {
              console.log(`🎙️ Speaker ${data.userName} ready on seat ${data.seatIndex} -> Connecting WebRTC audio`);
              createPeerConnection(speakerId, true);
            }
          } else if (data.type === 'webrtc_signal') {
            if (data.signal && data.senderId && String(data.senderId) !== currentUserId) {
              handleWebRTCSignal(String(data.senderId), data.signal);
            }
          } else if (data.type === 'user_kicked_from_seat') {
            if (data.seats && Array.isArray(data.seats)) {
              setSeats(data.seats);
            }
            if (String(data.kickedUserId) === currentUserId) {
              disableMicrophone();
              setMySeatIndex(null);
              toast('You have been kicked from the seat by the host 👑🚫', 'error');
            } else {
              toast(`${data.kickedUserName || 'Guest'} was kicked from seat ${data.seatIndex} by ${data.kickedBy || 'Host'}`, 'info');
            }
          } else if (data.type === 'user_kicked_from_room') {
            if (data.onlineUsers) setOnlineUsers(data.onlineUsers);
            if (data.seats) setSeats(data.seats);
            if (String(data.kickedUserId) === currentUserId) {
              disableMicrophone();
              toast('You have been kicked from the room by the host 🚷', 'error');
              setTimeout(() => {
                onLeave();
              }, 400);
            } else {
              toast(`${data.kickedUserName || 'User'} was kicked from the room by ${data.kickedBy || 'Host'}`, 'info');
              const kId = String(data.kickedUserId);
              const pc = peerConnectionsRef.current.get(kId);
              if (pc) {
                try { pc.close(); } catch (e) {}
                peerConnectionsRef.current.delete(kId);
              }
              const audio = remoteAudiosRef.current.get(kId);
              if (audio) {
                try { audio.pause(); audio.remove(); } catch (e) {}
                remoteAudiosRef.current.delete(kId);
              }
            }
          } else if (data.type === 'seat_status_updated') {
            const { seatIndex, isTalking, isMuted } = data;
            setSeats(prev => prev.map(s => {
              if (s.index === seatIndex) {
                return {
                  ...s,
                  ...(isTalking !== undefined ? { isTalking } : {}),
                  ...(isMuted !== undefined ? { isMuted } : {})
                };
              }
              return s;
            }));
          } else if (data.type === 'chat_message') {
            if (data.message) {
              setChatMessages(prev => {
                if (prev.some(m => String(m.id) === String(data.message.id))) return prev;
                return [...prev, data.message];
              });
              if (data.message.userId !== currentUserId) {
                playSynthSound('tap');
              }
            }
          } else if (data.type === 'gift_event') {
            if (data.gift) {
              setActiveGiftEffect(data.gift);
              playSynthSound('gift');
              setTimeout(() => setActiveGiftEffect(null), 4000);
            }
            if (data.message) {
              setChatMessages(prev => {
                if (prev.some(m => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
            }
          } else if (data.type === 'game_event') {
            if (data.activeGame) setActiveGame(data.activeGame);
            if (data.gameData) {
              if (data.gameData.ludo) setLudo(data.gameData.ludo);
              if (data.gameData.diceDuel) setDiceDuel(data.gameData.diceDuel);
              if (data.gameData.wheel) {
                setWheelDegree(data.gameData.wheel.degree);
                setWheelResult(data.gameData.wheel.result);
              }
            }
          } else if (data.type === 'reaction') {
            if (data.emoji !== undefined && data.seatIndex !== undefined) {
              const id = Math.random().toString();
              setReactions(prev => [...prev, { id, emoji: data.emoji, seatIndex: data.seatIndex }]);
              setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== id));
              }, 2000);
            }
          } else if (data.type === 'room_updated') {
            if (data.room) {
              const updated = data.room;
              if (updated.backgroundUrl) setRoomBackground(updated.backgroundUrl);
              if (updated.title) setRoomTitle(updated.title);
              if (updated.notice || updated.description) setRoomNotice(updated.notice || updated.description);
              if (updated.seatStyle) setSeatStyle(updated.seatStyle);
              toast('Room settings updated ✨', 'info');
            }
          } else if (data.type === 'room_music') {
            const { musicState, senderName } = data;
            if (musicState && roomMusicAudioRef.current) {
              const audio = roomMusicAudioRef.current;
              const { action, track, currentTime, isPlaying } = musicState;

              if (track) {
                setActiveTrack(track);
                if (audio.src !== track.url) {
                  audio.src = track.url;
                }
              }

              if (currentTime !== undefined && Math.abs(audio.currentTime - currentTime) > 2) {
                audio.currentTime = currentTime;
              }

              if (action === 'play' || isPlaying) {
                setIsTrackPlaying(true);
                audio.play().catch(e => {
                  console.warn('Audience autoplay blocked for music:', e);
                  setAudioAutoplayBlocked(true);
                });
                if (senderName && senderName !== currentUser.name) {
                  toast(`🎵 ${senderName} playing: ${track?.name || 'Music'}`, 'info');
                }
              } else if (action === 'pause' || !isPlaying) {
                setIsTrackPlaying(false);
                audio.pause();
              }
            }
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        console.log(`🔌 [WS] Disconnected from room ${roomId}`);
        if (isMounted) {
          // Auto-reconnect with exponential backoff (max 8s)
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000);
          reconnectAttempts++;
          console.log(`🔄 [WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };
    };

    connect();

    // Polling fallback only if WebSocket is disconnected
    const pollInterval = setInterval(async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      try {
        const res = await fetch(`/api/rooms/${roomId}/seats`);
        if (res.ok) {
          const d = await res.json();
          if (d.success && d.room) {
            if (d.room.seats && Array.isArray(d.room.seats)) {
              const sanitizedSeats = d.room.seats.map((s: any) => {
                if (s.index === 0 && !s.user) {
                  return { ...s, user: safeRoom.host };
                }
                return s;
              });
              setSeats(sanitizedSeats);
            }
            if (d.room.onlineUsers) setOnlineUsers(d.room.onlineUsers);
          }
        }
      } catch (err) {}
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      // Notify WebSocket and close
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'leave_room',
            roomId,
            userId: currentUserId,
            userName: currentUser.name
          }));
        } catch (e) {}
        ws.close();
      }

      // Close all WebRTC peer connections and cleanup audio elements
      peerConnectionsRef.current.forEach(pc => {
        try { pc.close(); } catch (e) {}
      });
      peerConnectionsRef.current.clear();

      remoteAudiosRef.current.forEach(el => {
        try { el.pause(); el.remove(); } catch (e) {}
      });
      remoteAudiosRef.current.clear();

      // Disconnect LiveKit voice room
      disconnectLiveKit();
      disableMicrophone();

      // Backup HTTP leave call
      fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      }).catch(e => console.warn('HTTP leave fallback error:', e));
    };
  }, [roomId, currentUserId, createPeerConnection, handleWebRTCSignal, disableMicrophone, onLeave]);

  // Click handler for Seat triggers Action Menu
  const handleSeatClick = (index: number) => {
    playSynthSound('tap');

    // Seat 0 is host-only — non-hosts get a toast
    if (index === 0) {
      const isHost = String(currentUserId) === String((safeRoom.host as any)?._id || safeRoom.host?.id) || currentUser.name === safeRoom.host?.name;
      if (!isHost) {
        toast(`Host Seat belongs exclusively to ${safeRoom.host?.name || 'Host'} 👑`, 'info');
        return;
      }
    }

    const seatOccupied = Boolean(seats[index]?.user);

    // If user taps their OWN occupied seat: open modal to show Leave option
    if (seatOccupied && mySeatIndex === index) {
      setSelectedSeatIndex(index);
      setShowSeatModal(true);
      return;
    }

    // All other cases (empty seat, or occupied by someone else): open modal for confirmation/options
    setSelectedSeatIndex(index);
    setCustomGuestName(`Guest Seat ${index}`);
    setCustomGuestLevel(Math.floor(Math.random() * 20) + 5);
    setShowSeatModal(true);
  };

  // Core seat-sit logic — accepts explicit index so it can be called without modal
  const handleSitSelfAtIndex = async (index: number) => {
    // Save previous snapshot for rollback if needed
    const prevSeats = [...seats];
    const prevMySeat = mySeatIndex;

    // Optimistically sit immediately (0ms visual latency)
    const optimisticUser = {
      ...currentUser,
      id: String(currentUser.id || (currentUser as any)._id),
      _id: String(currentUser.id || (currentUser as any)._id)
    };

    setSeats(prev => prev.map(s => {
      if (s.index === index) {
        return { ...s, user: optimisticUser, isTalking: false, isMuted: false };
      }
      // Clear user's old seat
      if (prevMySeat !== null && s.index === prevMySeat) {
        return { ...s, user: s.index === 0 ? safeRoom.host : null, isTalking: false, isMuted: false };
      }
      return s;
    }));
    setMySeatIndex(index);
    setIsMyMicMuted(false);

    // Start microphone in parallel so audio doesn't block UI
    enableMicrophone().catch(err => console.warn('Mic enable warn:', err));

    // Send WebSocket notification immediately
    sendWs('seat_status', { seatIndex: index, isTalking: false, isMuted: false });

    try {
      const res = await fetch(`/api/rooms/${roomId}/seat/${index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: optimisticUser, action: 'sit' })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const errorMsg = data?.error || `Server error (${res.status})`;
        toast(`Could not sit in seat: ${errorMsg}`, 'error');
        setSeats(prevSeats);
        setMySeatIndex(prevMySeat);
        return;
      }

      if (data.room?.seats && Array.isArray(data.room.seats)) {
        const rawSeats = data.room.seats;
        const sanitized = Array.from({ length: 9 }, (_, i) => {
          const s = rawSeats.find((item: any) => item && item.index === i) || rawSeats[i];
          return {
            index: i,
            user: (i === 0 && !s?.user) ? safeRoom.host : (s?.user || null),
            isMuted: Boolean(s?.isMuted),
            isTalking: Boolean(s?.isTalking)
          };
        });
        setSeats(sanitized);
        setMySeatIndex(index);
        toast(`You are now seated on Mic Seat ${index}! 🎙️`, 'success');
      }
    } catch (err: any) {
      console.error('Error sitting in seat:', err);
      setSeats(prevSeats);
      setMySeatIndex(prevMySeat);
      toast(`Failed to sit in seat: ${err?.message || 'Network error'}`, 'error');
    }
  };

  // Seat Action implementation handlers - Instantaneous with Optimistic UI
  const handleSitSelf = async () => {
    if (selectedSeatIndex === null) return;
    const index = selectedSeatIndex;
    setShowSeatModal(false);
    await handleSitSelfAtIndex(index);
  };

  const handleSpawnPresetGuest = async () => {
    if (selectedSeatIndex === null) return;
    const index = selectedSeatIndex;

    const names = ["Olivia", "William", "Lucas", "Sophia", "Mia", "Amelia", "Jack", "Maya", "Daniel"];
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

    setShowSeatModal(false);
    setSeats(prev => prev.map(s => s.index === index ? { ...s, user: newGuest, isTalking: false, isMuted: false } : s));

    try {
      const res = await fetch(`/api/rooms/${roomId}/seat/${index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: newGuest, action: 'sit' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room?.seats) {
          setSeats(data.room.seats);
        }
      }
    } catch (err) {
      console.warn('Failed to persist simulated guest seat:', err);
    }

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${nameSelected} entered Mic Seat ${index}!`,
      type: 'system'
    }]);
  };

  const handleCreateCustomGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeatIndex === null || !customGuestName.trim()) return;
    const index = selectedSeatIndex;

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

    setShowSeatModal(false);
    setSeats(prev => prev.map(s => s.index === index ? { ...s, user: newGuest, isTalking: false, isMuted: false } : s));

    try {
      const res = await fetch(`/api/rooms/${roomId}/seat/${index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: newGuest, action: 'sit' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.room?.seats) {
          setSeats(data.room.seats);
        }
      }
    } catch (err) {
      console.warn('Failed to persist custom guest seat:', err);
    }

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${newGuest.name} was seated on Mic Seat ${index} by you!`,
      type: 'system'
    }]);
  };

  const handleLeaveSeat = async (explicitIndex?: number) => {
    // If explicitIndex is passed, use it; otherwise fallback to selectedSeatIndex or mySeatIndex
    const index = explicitIndex !== undefined && explicitIndex !== null 
      ? explicitIndex 
      : (selectedSeatIndex !== null ? selectedSeatIndex : mySeatIndex);

    if (index === null || index === undefined) return;

    // Host cannot leave seat 0
    if (index === 0) {
      toast('Host Seat belongs permanently to the room Host 👑', 'info');
      setShowSeatModal(false);
      setShowUserProfileModal(false);
      return;
    }

    const leavingUser = seats[index]?.user || currentUser;
    setShowSeatModal(false);
    setShowUserProfileModal(false);

    // Save previous snapshot for rollback if needed
    const prevSeats = [...seats];
    const prevMySeat = mySeatIndex;

    // Optimistically update local seats state immediately (<1ms)
    setSeats(prev => prev.map(s => s.index === index ? { 
      ...s, 
      user: null, 
      isTalking: false, 
      isMuted: false 
    } : s));
    
    setMySeatIndex(null);
    disableMicrophone();
    setIsMyMicMuted(true);

    // Call server to persist the vacancy and broadcast seats_updated to all clients
    try {
      const res = await fetch(`/api/rooms/${roomId}/seat/${index}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', user: leavingUser })
      });
      const data = await res.json().catch(() => null);

      if (data?.success && data.room?.seats && Array.isArray(data.room.seats)) {
        const rawSeats = data.room.seats;
        const sanitized = Array.from({ length: 9 }, (_, i) => {
          const s = rawSeats.find((item: any) => item && item.index === i) || rawSeats[i];
          return {
            index: i,
            user: (i === 0 && !s?.user) ? safeRoom.host : (s?.user || null),
            isMuted: Boolean(s?.isMuted),
            isTalking: Boolean(s?.isTalking)
          };
        });
        setSeats(sanitized);
      }
    } catch (err) {
      console.warn('Failed to persist leaving seat to server:', err);
    }

    // Broadcast seat status update via WebSocket
    sendWs('seat_status', { seatIndex: index, isTalking: false, isMuted: false });

    toast(`${leavingUser.name || 'You'} left Mic Seat ${index}`, 'info');

    setChatMessages(prev => [...prev, {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 0,
      message: `${leavingUser.name || 'User'} left Mic Seat ${index}.`,
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

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }

    if (mySeatIndex !== null) {
      setSeats(prev => prev.map(s => s.index === mySeatIndex ? { ...s, isMuted: newMuted, isTalking: false } : s));
      sendWs('seat_status', { seatIndex: mySeatIndex, isMuted: newMuted, isTalking: false });
    }

    if (newMuted) {
      isSpeakingRef.current = false;
    }
  };

  // Reactions trigger & broadcast
  const triggerFlyReaction = (emoji: string, seatIndex: number) => {
    const id = Math.random().toString();
    setReactions(prev => [...prev, { id, emoji, seatIndex }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);

    sendWs('reaction', { emoji, seatIndex });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const content = textInput.trim();
    setTextInput('');
    playSynthSound('tap');

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      userId: currentUserId,
      userName: currentUser.name,
      userLevel: currentUser.level,
      message: content,
      type: 'text'
    };

    setChatMessages(prev => [...prev, newMsg]);

    // Broadcast instantly to all devices via WebSocket
    sendWs('chat_message', newMsg);

    // Save to server
    try {
      await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMsg })
      });
    } catch (err) {
      console.warn('Failed to persist chat message:', err);
    }
  };

  // Gift Sending Action Handler (Synchronized across all devices)
  const handleSendGift = async (gift: Gift) => {
    if (currentUser.role !== 'admin' && currentUser.coins < gift.coins) {
      toast("Insufficient Gold Coins! Please recharge in the Privilege Store. 🪙", "warning");
      return;
    }

    setShowGiftDrawer(false);
    playSynthSound('gift');
    setActiveGiftEffect(gift);
    setTimeout(() => setActiveGiftEffect(null), 4000);

    if (currentUser.role !== 'admin') {
      onUpdateCoins(currentUser.coins - gift.coins);
    }

    let recipientName = "the Host";
    if (selectedGiftRecipient !== 'all' && typeof selectedGiftRecipient === 'number') {
      recipientName = seats[selectedGiftRecipient]?.user?.name || "the Host";
    } else if (selectedGiftRecipient === 'all') {
      recipientName = "Everyone in room";
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          recipientSeat: selectedGiftRecipient,
          gift
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newCoins !== undefined && currentUser.role !== 'admin') {
          onUpdateCoins(data.newCoins);
        }
      }
    } catch (err) {
      console.error('Failed to send gift to server:', err);
    }
  };

  // Music Player audio setup
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = musicVolume;
    roomMusicAudioRef.current = audio;

    const handleTimeUpdate = () => {
      setMusicProgress(audio.currentTime);
      setMusicDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsTrackPlaying(false);
      const curIdx = AUDIO_TRACKS.findIndex(t => t.id === activeTrack?.id);
      if (curIdx !== -1 && curIdx < AUDIO_TRACKS.length - 1) {
        const nextTrack = AUDIO_TRACKS[curIdx + 1];
        if (isCurrentUserHost) {
          handlePlayTrack(nextTrack);
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (roomMusicAudioRef.current) {
      roomMusicAudioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  const handlePlayTrack = (track: typeof AUDIO_TRACKS[0] | any) => {
    playSynthSound('tap');
    if (!roomMusicAudioRef.current) return;
    const audio = roomMusicAudioRef.current;
    if (activeTrack?.url !== track.url) {
      audio.src = track.url;
      audio.currentTime = 0;
    }
    setActiveTrack(track);
    setIsTrackPlaying(true);
    audio.play().catch(e => {
      console.warn('Audio play error:', e);
      setAudioAutoplayBlocked(true);
    });

    if (isCurrentUserHost) {
      sendWs('room_music', {
        action: 'play',
        track,
        currentTime: 0,
        isPlaying: true
      });
    }
  };

  const handleTogglePlayPause = () => {
    playSynthSound('tap');
    if (!roomMusicAudioRef.current) return;
    const audio = roomMusicAudioRef.current;
    if (!activeTrack) {
      handlePlayTrack(AUDIO_TRACKS[0]);
      return;
    }
    if (isTrackPlaying) {
      audio.pause();
      setIsTrackPlaying(false);
      if (isCurrentUserHost) {
        sendWs('room_music', {
          action: 'pause',
          track: activeTrack,
          currentTime: audio.currentTime,
          isPlaying: false
        });
      }
    } else {
      audio.play().catch(e => console.warn('Audio play error:', e));
      setIsTrackPlaying(true);
      if (isCurrentUserHost) {
        sendWs('room_music', {
          action: 'play',
          track: activeTrack,
          currentTime: audio.currentTime,
          isPlaying: true
        });
      }
    }
  };

  const handleSeekMusic = (newTime: number) => {
    if (!roomMusicAudioRef.current) return;
    roomMusicAudioRef.current.currentTime = newTime;
    setMusicProgress(newTime);
    if (isCurrentUserHost && activeTrack) {
      sendWs('room_music', {
        action: 'seek',
        track: activeTrack,
        currentTime: newTime,
        isPlaying: isTrackPlaying
      });
    }
  };

  const handleNextTrack = () => {
    const curIdx = AUDIO_TRACKS.findIndex(t => t.id === activeTrack?.id);
    const nextIdx = (curIdx + 1) % AUDIO_TRACKS.length;
    handlePlayTrack(AUDIO_TRACKS[nextIdx]);
  };

  const handlePrevTrack = () => {
    const curIdx = AUDIO_TRACKS.findIndex(t => t.id === activeTrack?.id);
    const prevIdx = (curIdx - 1 + AUDIO_TRACKS.length) % AUDIO_TRACKS.length;
    handlePlayTrack(AUDIO_TRACKS[prevIdx]);
  };

  const handlePlayCustomAudio = () => {
    if (!customAudioUrl.trim()) {
      toast('Please enter a valid audio URL', 'error');
      return;
    }
    const customTrack = {
      id: `custom_${Date.now()}`,
      name: customAudioName.trim() || 'Custom Stream',
      url: customAudioUrl.trim(),
      duration: 'Live',
      artist: currentUser.name
    };
    handlePlayTrack(customTrack);
    setCustomAudioUrl('');
    setCustomAudioName('');
    toast(`Playing custom track: ${customTrack.name} 🎶`, 'success');
  };

  const toggleBackingTrack = (track: typeof AUDIO_TRACKS[0]) => {
    if (activeTrack?.id === track.id) {
      handleTogglePlayPause();
    } else {
      handlePlayTrack(track);
    }
  };

  const handleSaveRoomCustomization = async (newBg?: string, newTitle?: string, newNotice?: string, newStyle?: 'sofa' | 'classic') => {
    setIsSavingCustomization(true);
    const bgToSave = newBg !== undefined ? newBg : roomBackground;
    const titleToSave = newTitle !== undefined ? newTitle : roomTitle;
    const noticeToSave = newNotice !== undefined ? newNotice : roomNotice;
    const styleToSave = newStyle !== undefined ? newStyle : seatStyle;

    setRoomBackground(bgToSave);
    setRoomTitle(titleToSave);
    setRoomNotice(noticeToSave);
    setSeatStyle(styleToSave);

    try {
      const res = await fetch(`/api/rooms/${roomId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundUrl: bgToSave,
          title: titleToSave,
          description: noticeToSave,
          notice: noticeToSave,
          seatStyle: styleToSave
        })
      });
      if (res.ok) {
        toast('Room customization saved! 🎨✨', 'success');
        setShowCustomizationModal(false);
      } else {
        toast('Failed to save customization to server', 'error');
      }
    } catch (err) {
      console.error('Save customization error:', err);
      toast('Network error saving room', 'error');
    } finally {
      setIsSavingCustomization(false);
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
      toast("At least one speaker must be seated on mic seats to play Ludo!", "info");
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
      toast("Need at least 20 Gold Coins to spin! 🪙", "warning");
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
    <div id="voiceRoom_container" className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden select-none">
      
      {/* Dynamic Fullscreen Wallpaper */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700 pointer-events-none"
        style={{ backgroundImage: `url(${roomBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/85 backdrop-blur-[1px]" />
      </div>

      {/* ===== FULLSCREEN GIFT ANIMATION OVERLAY ===== */}
      <AnimatePresence>
        {activeGiftEffect && (
          <motion.div
            key={activeGiftEffect.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 pointer-events-none overflow-hidden"
          >
            {/* Radial glow background */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className={`absolute inset-0 ${
                activeGiftEffect.effect === 'rose' ? 'bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.35)_0%,transparent_70%)]' :
                activeGiftEffect.effect === 'crown' ? 'bg-[radial-gradient(ellipse_at_center,rgba(234,179,8,0.4)_0%,transparent_70%)]' :
                activeGiftEffect.effect === 'rocket' ? 'bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.4)_0%,transparent_70%)]' :
                activeGiftEffect.effect === 'car' ? 'bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.35)_0%,transparent_70%)]' :
                'bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.3)_0%,transparent_70%)]'
              }`}
            />

            {/* Floating particle emojis (background layer) */}
            {Array.from({ length: 12 }).map((_, i) => {
              const icons = activeGiftEffect.effect === 'rose' ? ['🌹','✨','💕','🌸','💝'] :
                            activeGiftEffect.effect === 'crown' ? ['👑','⭐','✨','💫','🌟'] :
                            activeGiftEffect.effect === 'rocket' ? ['🚀','⭐','💫','🌠','✨'] :
                            activeGiftEffect.effect === 'car' ? ['🏎️','💨','⚡','🔥','✨'] :
                            [activeGiftEffect.icon || '🎁', '✨','💫','⭐','🎊'];
              const icon = icons[i % icons.length];
              return (
                <motion.div
                  key={i}
                  initial={{
                    opacity: 0,
                    x: `${Math.random() * 100}vw`,
                    y: '110vh',
                    scale: 0.4 + Math.random() * 0.8,
                    rotate: Math.random() * 360
                  }}
                  animate={{
                    opacity: [0, 0.9, 0.9, 0],
                    y: `-${20 + Math.random() * 40}vh`,
                    rotate: Math.random() * 720 - 360,
                  }}
                  transition={{
                    duration: 2.5 + Math.random() * 1.5,
                    delay: Math.random() * 0.8,
                    ease: 'easeOut'
                  }}
                  style={{ position: 'absolute', fontSize: `${1.2 + Math.random() * 1.4}rem` }}
                >
                  {icon}
                </motion.div>
              );
            })}

            {/* Center showcase */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">

              {/* Rose special */}
              {activeGiftEffect.effect === 'rose' && (
                <motion.div
                  initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                  animate={{ scale: [0.3, 1.3, 1.0], opacity: 1, rotate: [-20, 10, 0] }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.8, ease: 'backOut' }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-2xl scale-150 opacity-60 text-8xl text-center">🌹</div>
                    <div className="text-8xl drop-shadow-2xl animate-[bounce_1s_ease-in-out_infinite]">🌹</div>
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-2 rounded-full shadow-2xl shadow-rose-500/40"
                  >
                    <h3 className="text-base font-black text-white uppercase tracking-widest drop-shadow">🌹 Rose Shower!</h3>
                  </motion.div>
                </motion.div>
              )}

              {/* Crown special */}
              {activeGiftEffect.effect === 'crown' && (
                <motion.div
                  initial={{ y: -200, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: [0.6, 1.25, 1.0] }}
                  exit={{ scale: 1.3, opacity: 0 }}
                  transition={{ type: 'spring', damping: 8, stiffness: 120, delay: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-3xl scale-200 opacity-70 text-8xl text-center">👑</div>
                    <div className="text-9xl drop-shadow-[0_10px_30px_rgba(234,179,8,0.7)] animate-[spin_4s_linear_infinite]">👑</div>
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 px-6 py-2 rounded-full shadow-2xl shadow-amber-500/50"
                  >
                    <h3 className="text-base font-black text-white uppercase tracking-widest">👑 Royal Majesty!</h3>
                  </motion.div>
                </motion.div>
              )}

              {/* Car special */}
              {activeGiftEffect.effect === 'car' && (
                <motion.div
                  initial={{ x: '-100vw', opacity: 0, scale: 0.8 }}
                  animate={{ x: 0, opacity: 1, scale: [0.8, 1.1, 1.0] }}
                  exit={{ x: '100vw', opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-2xl scale-150 opacity-50 text-9xl text-center">🏎️</div>
                    <div className="text-9xl drop-shadow-[0_8px_20px_rgba(239,68,68,0.5)]">🏎️💨</div>
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-2 rounded-full shadow-2xl shadow-red-500/50"
                  >
                    <h3 className="text-base font-black text-white uppercase tracking-widest">⚡ Hypercar Flex!</h3>
                  </motion.div>
                </motion.div>
              )}

              {/* Rocket special */}
              {activeGiftEffect.effect === 'rocket' && (
                <motion.div
                  initial={{ y: '100vh', opacity: 0, scale: 0.4 }}
                  animate={{ y: 0, opacity: 1, scale: [0.4, 1.3, 1.0] }}
                  exit={{ y: '-100vh', opacity: 0, scale: 1.2 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-3xl scale-150 opacity-60 text-9xl text-center">🚀</div>
                    <div className="text-9xl drop-shadow-[0_12px_30px_rgba(99,102,241,0.6)] animate-[bounce_0.8s_ease-in-out_infinite]">🚀</div>
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2 rounded-full shadow-2xl shadow-indigo-500/50"
                  >
                    <h3 className="text-base font-black text-white uppercase tracking-widest">🚀 Cosmic Launch!</h3>
                  </motion.div>
                </motion.div>
              )}

              {/* Fallback — any custom gift */}
              {activeGiftEffect.effect !== 'rose' && activeGiftEffect.effect !== 'crown' && activeGiftEffect.effect !== 'car' && activeGiftEffect.effect !== 'rocket' && (
                <motion.div
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: [0.2, 1.3, 1.0], opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'backOut' }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <div className="absolute inset-0 blur-2xl scale-150 opacity-50 text-center" style={{ fontSize: '5rem' }}>
                      {activeGiftEffect.icon || '🎁'}
                    </div>
                    <div
                      className="drop-shadow-[0_12px_30px_rgba(244,63,94,0.5)] animate-[bounce_0.9s_ease-in-out_infinite]"
                      style={{ fontSize: '5.5rem', lineHeight: 1 }}
                    >
                      {activeGiftEffect.icon || '🎁'}
                    </div>
                  </div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-2 rounded-full shadow-2xl shadow-rose-500/40"
                  >
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">
                      {activeGiftEffect.name} Shower! ✨
                    </h3>
                  </motion.div>
                  {activeGiftEffect.description && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="text-[11px] font-bold text-white/80 bg-black/30 px-4 py-1.5 rounded-full backdrop-blur-sm text-center max-w-[220px]"
                    >
                      {activeGiftEffect.description}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </div>

            {/* Sparkle corner bursts */}
            {['top-4 left-4', 'top-4 right-4', 'bottom-28 left-4', 'bottom-28 right-4'].map((pos, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                transition={{ duration: 1.2, delay: 0.2 + i * 0.15, repeat: 2, repeatDelay: 0.4 }}
                className={`absolute ${pos} text-2xl`}
              >
                ✨
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frosted Glass Room Header */}
      <div 
        id="voiceRoom_header" 
        className="h-14 px-3 flex items-center justify-between border-b border-white/10 z-10 bg-black/40 backdrop-blur-md shrink-0 text-white"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button 
            id="voiceRoom_backBtn"
            onClick={onLeave}
            className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs font-black text-white truncate max-w-[130px] sm:max-w-[180px] flex items-center gap-1">
              {(safeRoom as any).isPrivate && <span title="Private Room">🔒</span>}
              <span className="truncate">{roomTitle}</span>
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-amber-300 font-bold truncate max-w-[80px]">Host: {safeRoom.host.name}</span>
              <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.2 rounded font-black backdrop-blur-sm">Lvl {safeRoom.host.level}</span>
              {(safeRoom as any).roomId && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(String((safeRoom as any).roomId));
                    toast(`Room code #${(safeRoom as any).roomId} copied! 📋`, 'success');
                  }}
                  className="text-[8px] bg-amber-400/20 border border-amber-400/40 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold cursor-pointer hover:bg-amber-400/30"
                  title="Click to copy Room Code"
                >
                  #{(safeRoom as any).roomId}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Host Customization Button */}
          {isCurrentUserHost && (
            <button
              onClick={() => setShowCustomizationModal(true)}
              className="flex items-center gap-1 text-[10px] bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 font-black px-2 py-1 rounded-full shadow-sm cursor-pointer transition-all active:scale-95"
              title="Customize Room Background, Title & Layout"
            >
              <Palette className="w-3 h-3" />
              <span>Theme</span>
            </button>
          )}

          {/* Room Music Button */}
          <button
            onClick={() => setShowMusicDrawer(true)}
            className={`flex items-center gap-1 text-[10px] border px-2 py-1 rounded-full shadow-sm cursor-pointer transition-all active:scale-95 ${
              isTrackPlaying
                ? 'bg-rose-500/30 border-rose-400/60 text-rose-300 font-black animate-pulse'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold'
            }`}
            title="Room Music Player"
          >
            <Music className="w-3 h-3" />
            <span>Music</span>
          </button>

          {/* Online Audience Count */}
          <button
            onClick={() => setShowAudienceModal(true)}
            className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black px-2 py-1 rounded-full shadow-sm cursor-pointer transition-colors"
            title="View participants"
          >
            <Users className="w-3 h-3" />
            <span>{uniqueParticipants.length}</span>
          </button>

          {/* Exit Room Button */}
          <button 
            id="voiceRoom_exitBtn"
            onClick={onLeave}
            className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Room Announcement / Notice Banner */}
      <div className="z-10 px-4 py-1.5 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 text-white text-[10px] shrink-0">
        <div className="flex items-center gap-1.5 truncate flex-1 mr-2">
          <span className="text-amber-400 text-xs">📢</span>
          <span className="truncate font-semibold text-white/90">{roomNotice}</span>
        </div>
        {isCurrentUserHost && (
          <button
            onClick={() => setShowCustomizationModal(true)}
            className="text-[9px] text-amber-300 hover:text-amber-200 underline font-black shrink-0 cursor-pointer"
          >
            Edit
          </button>
        )}
      </div>

      {/* Floating Vinyl Music Disc Widget */}
      {isTrackPlaying && activeTrack && (
        <div className="absolute top-28 right-4 z-20">
          <motion.button
            onClick={() => setShowMusicDrawer(true)}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="relative w-11 h-11 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 border-2 border-amber-400/90 shadow-[0_0_15px_rgba(251,191,36,0.4)] flex items-center justify-center cursor-pointer group hover:scale-105 active:scale-95"
            title={`Now Playing: ${activeTrack.name}`}
          >
            <div className="absolute inset-1 rounded-full border border-zinc-700/60 pointer-events-none" />
            <div className="absolute inset-2.5 rounded-full border border-zinc-700/40 pointer-events-none" />
            <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[9px] font-black text-black">
              🎵
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </motion.button>
        </div>
      )}

      {/* Audio Autoplay Unblock Notification Banner */}
      {audioAutoplayBlocked && (
        <div 
          onClick={() => {
            setAudioAutoplayBlocked(false);
            remoteAudiosRef.current.forEach(audio => audio.play().catch(() => {}));
            if (roomMusicAudioRef.current && isTrackPlaying) {
              roomMusicAudioRef.current.play().catch(() => {});
            }
          }}
          className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-[10px] font-black flex items-center justify-between cursor-pointer z-30 shadow-md animate-pulse"
        >
          <span>🔊 Live audio requires browser permission. Tap here to hear sound!</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-[9px] uppercase">Enable Sound</span>
        </div>
      )}

      {/* Core Grid / Stage Area: Seats Panel */}
      <div id="voiceRoom_seatsArea" className="flex-1 overflow-y-auto px-4 py-2 scrollbar-none flex flex-col gap-3.5 z-10 min-h-0 pb-20">
        
        {/* The Host Seat (Featured Top - Golden Throne) */}
        {(() => {
          const hostAvatar = (seats && seats[0] && seats[0].user?.avatar) || safeRoom.host?.avatar || PRESET_AVATARS[0];
          const hostName = (seats && seats[0] && seats[0].user?.name) || safeRoom.host?.name || "Host";

          return (
            <div className="flex flex-col items-center shrink-0 mt-1">
              <div className="relative">
                {seats && seats[0] && seats[0].user && seats[0].isTalking && (
                  <div className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping border-2 border-amber-400/60 scale-125 pointer-events-none"></div>
                )}

                {/* Golden Crown badge above host */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-bounce">
                  👑
                </div>

                <div
                  onClick={() => {
                    setSelectedSeatIndex(0);
                    const hostUser = seats?.[0]?.user || safeRoom.host;
                    if (isCurrentUserHost) {
                      setInspectedUser(currentUser);
                      setShowUserProfileModal(true);
                    } else if (hostUser) {
                      setInspectedUser(hostUser);
                      setShowUserProfileModal(true);
                    }
                  }}
                  className="relative z-20 w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 cursor-pointer flex items-center justify-center bg-zinc-900 shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:scale-105 transition-transform"
                  title={`Host: ${hostName}`}
                >
                  <img
                    src={hostAvatar}
                    alt={hostName}
                    className="w-full h-full object-cover"
                  />
                  {seats && seats[0] && seats[0].isMuted && (
                    <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full p-0.5 border border-white shadow">
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
                    className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none z-30"
                  >
                    {reaction.emoji}
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[9px] bg-gradient-to-r from-amber-500 to-yellow-400 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                  👑 Host
                </span>
                <span className="text-[11px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate max-w-[100px]">
                  {hostName}
                </span>
              </div>
            </div>
          );
        })()}

        {/* 8 Guests Seats Grid (Sofa Lounge or Classic Mic) */}
        <div className="grid grid-cols-4 gap-x-2.5 gap-y-3.5 px-3 py-3.5 bg-black/40 backdrop-blur-md border border-white/15 rounded-3xl shadow-2xl shrink-0">
          {seats && Array.isArray(seats) && seats.slice(1).map((seat) => {
            const hasUser = Boolean(seat.user && (seat.user.id || (seat.user as any)._id || seat.user.name));
            const seatUid = seat.user ? String(seat.user.id || (seat.user as any)._id || '') : '';
            const curUid = String(currentUser.id || (currentUser as any)._id || '');
            const isMe = hasUser && ((seatUid && curUid && seatUid === curUid) || seat.user?.name === currentUser.name);

            return (
              <div key={seat.index} className="flex flex-col items-center relative">
                <div className="relative">
                  {hasUser && isMe && myVoiceLevel > 10 && (
                    <span 
                      className="absolute inset-0 rounded-full bg-emerald-400/50 animate-pulse border-2 border-emerald-400 pointer-events-none"
                      style={{ transform: `scale(${1 + myVoiceLevel / 100})` }}
                    ></span>
                  )}

                  {hasUser && !isMe && seat.isTalking && (
                    <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping border-2 border-emerald-400 scale-125 pointer-events-none"></span>
                  )}

                  <div 
                    onClick={() => {
                      setSelectedSeatIndex(seat.index);
                      if (hasUser && isMe) {
                        setShowSeatModal(true);
                      } else if (hasUser && seat.user) {
                        setInspectedUser(seat.user);
                        setShowUserProfileModal(true);
                      } else {
                        handleSeatClick(seat.index);
                      }
                    }}
                    className={`relative z-20 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                      hasUser
                        ? `w-12 h-12 rounded-full overflow-hidden flex items-center justify-center ${
                            seat.user?.frameId === 'frame_neon' ? 'border-2 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.6)] animate-pulse' :
                            seat.user?.frameId === 'frame_pink' ? 'border-2 border-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.6)]' :
                            seat.user?.frameId === 'frame_royal' ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 
                            'border-2 border-white/60 bg-zinc-900 shadow-md'
                          }`
                        : seatStyle === 'sofa'
                          ? 'w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-amber-400/60 shadow-lg flex flex-col items-center justify-center group'
                          : 'w-11 h-11 rounded-full border border-dashed border-white/30 bg-white/10 hover:bg-white/20 flex items-center justify-center'
                    }`}
                  >
                    {hasUser ? (
                      <img 
                        src={seat.user?.avatar} 
                        alt="User" 
                        className="w-full h-full object-cover" 
                      />
                    ) : seatStyle === 'sofa' ? (
                      <div className="flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base group-hover:scale-110 transition-transform">🛋️</span>
                        <span className="text-[8px] font-black text-amber-300/90 tracking-tighter leading-none mt-0.5">
                          No.{seat.index}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white/60 text-xs font-bold">{seat.index}</span>
                    )}

                    {hasUser && seat.isMuted && (
                      <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full p-0.5 border border-white shadow">
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
                  <p className={`text-[9px] truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
                    isMe ? 'text-amber-400 font-black' : hasUser ? 'text-white font-bold' : 'text-white/60 font-medium'
                  }`}>
                    {hasUser ? seat.user?.name : "Empty"}
                  </p>
                  {hasUser && (
                    <span className="text-[7px] bg-white/20 text-white/90 px-1 py-0.2 rounded font-bold backdrop-blur-sm">
                      Lvl {seat.user?.level}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Backing Music Player Mini Bar */}
        <div className="bg-black/40 backdrop-blur-md border border-white/15 rounded-2xl p-2.5 flex items-center justify-between shrink-0 text-xs shadow-lg text-white">
          <div 
            onClick={() => setShowMusicDrawer(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90 transition-opacity flex-1"
          >
            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-sm shadow ${isTrackPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }}>
              🎵
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] text-amber-300 font-black uppercase tracking-wider">Room Music</p>
                {isTrackPlaying && (
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white font-black truncate max-w-[140px]">
                {activeTrack ? activeTrack.name : "Tap to Play Music"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTogglePlayPause}
              className={`p-2 rounded-xl text-[10px] font-black cursor-pointer transition-all shadow ${
                isTrackPlaying
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
              }`}
              title={isTrackPlaying ? "Pause" : "Play"}
            >
              {isTrackPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            </button>
            <button
              onClick={() => setShowMusicDrawer(true)}
              className="p-2 rounded-xl text-[10px] bg-white/15 hover:bg-white/25 text-white border border-white/20 font-black cursor-pointer shadow transition-all"
              title="Open Music Player Library"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
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
      <div 
        className="shrink-0 z-20 bg-white border-t border-zinc-200"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
      >
        {isTypingInChat && (
          <div className="flex items-center gap-1.5 px-4 pt-1.5 animate-in fade-in duration-200">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce"></span>
            </div>
            <span className="text-[9px] text-zinc-400 font-bold">You are typing...</span>
          </div>
        )}
        <form 
          id="voiceRoom_chatInputForm"
          onSubmit={handleSendMessage}
          className="h-14 px-4 flex items-center gap-2"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onFocus={() => setIsTypingInChat(true)}
            onBlur={() => setIsTypingInChat(false)}
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
      </div>

      {/* Gift Selection Drawer */}
      {showGiftDrawer && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) setShowGiftDrawer(false); }}>
          <div className="bg-white border-t border-zinc-200 rounded-t-[32px] flex flex-col animate-in slide-in-from-bottom duration-250 max-h-[82%] shadow-2xl">
            {/* Drawer handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 shrink-0">
              <div>
                <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                  🎁 Send Animated Gift
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Balance: <span className="text-amber-600 font-black">🪙 {currentUser.role === 'admin' ? '∞' : currentUser.coins.toLocaleString()}</span>
                </p>
              </div>
              <button
                onClick={() => setShowGiftDrawer(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="text-zinc-500 text-sm font-bold">✕</span>
              </button>
            </div>

            {/* Recipient selector */}
            <div className="px-5 pb-3 shrink-0">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Send To</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedGiftRecipient('all')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-bold text-[10px] shrink-0 transition-all cursor-pointer border ${
                    selectedGiftRecipient === 'all'
                      ? 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/30'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-rose-300'
                  }`}
                >
                  🌐 <span>All Seats</span>
                </button>
                {seats.filter(s => s.user !== null).map((seat) => (
                  <button
                    key={seat.index}
                    onClick={() => setSelectedGiftRecipient(seat.index)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl font-bold text-[10px] shrink-0 transition-all cursor-pointer border ${
                      selectedGiftRecipient === seat.index
                        ? 'bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/30'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-rose-300'
                    }`}
                  >
                    <img src={seat.user?.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                    <span className="truncate max-w-[70px]">{seat.user?.name} {seat.index === 0 ? '(Host)' : ''}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gift grid */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6 overscroll-contain">
              <div className="grid grid-cols-3 gap-2.5">
                {dynamicGifts.map((gift) => {
                  const canAfford = currentUser.role === 'admin' || currentUser.coins >= gift.coins;
                  return (
                    <button
                      key={gift.id}
                      onClick={() => handleSendGift(gift)}
                      disabled={!canAfford}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 shadow-sm ${
                        canAfford
                          ? 'bg-white border-zinc-200 hover:border-rose-400 hover:shadow-rose-100 hover:shadow-md'
                          : 'bg-zinc-50 border-zinc-100 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="relative">
                        <span className="text-4xl drop-shadow-sm">{gift.icon}</span>
                        {!canAfford && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] bg-zinc-800/70 text-white rounded px-1 font-bold">🔒</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-zinc-700 text-center leading-tight truncate w-full">{gift.name}</p>
                      <div className="flex items-center gap-0.5 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        🪙 {gift.coins}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                🎙️ Mic Seat {selectedSeatIndex}
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
                <div className="flex items-center justify-between bg-stone-50 border border-zinc-150 p-2.5 rounded-2xl shadow-inner">
                  <div className="flex items-center gap-3">
                    <img src={seats[selectedSeatIndex].user?.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <h4 className="font-black text-zinc-800">{seats[selectedSeatIndex].user?.name}</h4>
                      <p className="text-[10px] text-zinc-400">Badge: {seats[selectedSeatIndex].user?.badge} • Lvl {seats[selectedSeatIndex].user?.level}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (seats[selectedSeatIndex].user) {
                        setInspectedUser(seats[selectedSeatIndex].user);
                        setShowUserProfileModal(true);
                        setShowSeatModal(false);
                      }
                    }}
                    className="p-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    title="View Profile"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Profile</span>
                  </button>
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
                {(() => {
                  const seatUser = seats[selectedSeatIndex].user;
                  const seatUserId = String(seatUser?._id || seatUser?.id || (seatUser as any)?.userId || '');
                  const isMe = seatUserId === currentUserId || seatUser?.name === currentUser.name;
                  return !isMe;
                })() && (
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

                {/* Current user sitting on this seat -> Leave Seat */}
                {(() => {
                  const seatUser = seats[selectedSeatIndex].user;
                  const seatUserId = String(seatUser?._id || seatUser?.id || (seatUser as any)?.userId || '');
                  const isMe = seatUserId === currentUserId || seatUser?.name === currentUser.name;
                  return isMe;
                })() && (
                  <button
                    onClick={handleLeaveSeat}
                    className="w-full mt-1 bg-rose-50 border border-rose-200 text-rose-600 font-bold py-2.5 rounded-xl hover:bg-rose-100/50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                  >
                    <Trash className="w-4 h-4" />
                    <span>Leave Seat</span>
                  </button>
                )}

                {/* Host controls for kicking someone else from seat or room */}
                {isCurrentUserHost && selectedSeatIndex > 0 && seats[selectedSeatIndex].user && (() => {
                  const seatUser = seats[selectedSeatIndex].user;
                  const seatUserId = String(seatUser?._id || seatUser?.id || (seatUser as any)?.userId || '');
                  return seatUserId !== currentUserId && seatUser?.name !== currentUser.name;
                })() && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-150">
                    <button
                      onClick={() => handleKickUserFromSeat(selectedSeatIndex, seats[selectedSeatIndex].user!)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-98 transition-all"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Kick from Mic Seat {selectedSeatIndex}</span>
                    </button>
                    <button
                      onClick={() => handleKickUserFromRoom(seats[selectedSeatIndex].user!)}
                      className="w-full bg-zinc-900 hover:bg-black text-rose-400 font-bold py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 text-xs active:scale-98 transition-all"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>Kick from Room 🚷</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Empty Seat — clean confirmation UI
              <div className="flex flex-col gap-4 text-xs">

                {/* Seat info card */}
                <div className="flex items-center gap-3 bg-gradient-to-br from-pink-50 to-rose-50 border border-rose-100 rounded-2xl p-3.5">
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-dashed border-rose-300 flex items-center justify-center shrink-0">
                    <Mic className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="font-black text-zinc-800 text-sm">Mic Seat {selectedSeatIndex}</p>
                    <p className="text-zinc-500 text-[11px] mt-0.5">This seat is open — tap below to grab the mic and speak live 🎙️</p>
                  </div>
                </div>

                {/* Move banner if user is already in a seat */}
                {mySeatIndex !== null && mySeatIndex !== selectedSeatIndex && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center text-amber-700 font-bold text-[11px] flex items-center justify-center gap-1.5">
                    ↔️ Moving from Seat {mySeatIndex} → Seat {selectedSeatIndex}
                  </div>
                )}

                {/* Confirm button */}
                <button
                  onClick={handleSitSelf}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black py-3.5 rounded-2xl hover:opacity-95 shadow-lg shadow-pink-500/20 cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                >
                  <Mic className="w-5 h-5" />
                  <span>{mySeatIndex !== null ? `Move to Seat ${selectedSeatIndex}` : 'Sit Here & Join Mic'}</span>
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setShowSeatModal(false)}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-zinc-500 font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ROOM AUDIENCE & PARTICIPANTS MODAL DIALOG --- */}
      {showAudienceModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-3 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[80%] overflow-hidden">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2.5 shrink-0">
              <div>
                <h3 className="text-xs font-black text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Users className="w-4 h-4 text-rose-500" /> Room Participants ({uniqueParticipants.length})
                </h3>
                <p className="text-[9px] text-zinc-400 font-bold mt-0.5">Live audience & seated mic speakers</p>
              </div>
              <button
                onClick={() => setShowAudienceModal(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1.5 rounded-full text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-none my-1">
              {uniqueParticipants.length === 0 ? (
                <p className="text-center text-zinc-400 text-xs py-6 font-bold">No active users in room</p>
              ) : (
                uniqueParticipants.map((u) => {
                  const uId = String(u._id || u.id);
                  const isHost = uId === String((safeRoom.host as any)?._id || safeRoom.host?.id) || (u.name === safeRoom.host?.name);
                  const isMe = uId === currentUserId || (u.name === currentUser.name);
                  const seated = seats.find(s => s.user && (String(s.user._id || s.user.id) === uId || s.user.name === u.name));

                  return (
                    <div 
                      key={u.name || uId}
                      className="flex items-center justify-between p-2.5 bg-stone-50 border border-zinc-200/80 rounded-2xl"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img 
                          src={u.avatar || PRESET_AVATARS[0]} 
                          alt="" 
                          className="w-9 h-9 rounded-full object-cover border border-zinc-200 shrink-0" 
                        />
                        <div className="min-w-0">
                          <p className="font-black text-xs text-zinc-900 truncate flex items-center gap-1">
                            <span>{u.name}</span>
                            {isMe && <span className="text-[8px] bg-rose-50 text-rose-600 font-black px-1.5 py-0.2 rounded border border-rose-200 uppercase">You</span>}
                            {isHost && <span className="text-[8px] bg-amber-50 text-amber-700 font-black px-1.5 py-0.2 rounded border border-amber-200 uppercase">Host</span>}
                          </p>
                          <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">
                            Level {u.level || 1} • {seated ? `Mic Seat ${seated.index}` : 'Audience Listener'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {seated ? (
                          <span className="text-[8px] bg-rose-50 text-rose-600 font-black border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Mic className="w-2.5 h-2.5" />
                            <span>Seat {seated.index}</span>
                          </span>
                        ) : (
                          <span className="text-[8px] bg-zinc-100 text-zinc-500 font-bold px-2 py-0.5 rounded-full">
                            Audience
                          </span>
                        )}
                        {/* View Profile button */}
                        <button
                          title={`View ${u.name}'s profile`}
                          onClick={() => {
                            setInspectedUser(u);
                            setShowUserProfileModal(true);
                            setShowAudienceModal(false);
                          }}
                          className="p-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Profile</span>
                        </button>
                        {/* Add Friend button for other users */}
                        {!isMe && (
                          <button
                            title={`Add ${u.name} as friend`}
                            onClick={async () => {
                              try {
                                const res = await fetch('/api/friend-requests', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    senderId: currentUserId,
                                    senderName: currentUser.name,
                                    senderAvatar: currentUser.avatar,
                                    senderYoyoId: (currentUser as any).yoyoId || '',
                                    receiverId: uId,
                                    receiverName: u.name,
                                    receiverYoyoId: (u as any).yoyoId || ''
                                  })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  toast(`Friend request sent to ${u.name}! 🎉`, 'success');
                                } else {
                                  toast(data.error || 'Could not send request', 'error');
                                }
                              } catch {
                                toast('Network error. Try again.', 'error');
                              }
                            }}
                            className="text-[8px] bg-pink-50 text-pink-600 font-black border border-pink-200 px-2 py-0.5 rounded-full hover:bg-pink-100 transition-colors"
                          >
                            + Friend
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowAudienceModal(false)}
              className="w-full mt-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-[10px] cursor-pointer shadow-md"
            >
              Back to Room
            </button>
          </div>
        </div>
      )}

      {/* ===== Invite Friends Panel (Host Only) ===== */}
      {showInvitePanel && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full rounded-t-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[75%]">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-500" /> Invite Friends
              </h3>
              <button
                onClick={() => setShowInvitePanel(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer bg-zinc-100 p-1.5 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* Room Code display */}
            {(safeRoom as any).roomId && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Room Code</p>
                  <p className="text-lg font-black text-indigo-700 tracking-[0.3em]">{(safeRoom as any).roomId}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(String((safeRoom as any).roomId));
                    toast('Room code copied!', 'success');
                  }}
                  className="flex items-center gap-1 text-[10px] bg-indigo-100 border border-indigo-300 text-indigo-700 font-black px-3 py-1.5 rounded-full cursor-pointer hover:bg-indigo-200 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            )}

            <p className="text-[11px] text-zinc-500 font-medium -mt-2">
              Select friends to invite directly. They'll get a notification and can join without a password.
            </p>

            <div className="overflow-y-auto flex flex-col gap-2 scrollbar-none">
              {friendsList.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  <p className="text-2xl mb-2">👥</p>
                  <p className="text-xs font-bold">No friends yet</p>
                  <p className="text-[10px]">Add friends to invite them to your room</p>
                </div>
              ) : (
                friendsList.map((friend) => {
                  const friendId = String((friend as any)._id || friend.id);
                  const isAlreadyInvited = invitedSet.has(friendId);
                  return (
                    <div key={friendId} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img src={friend.avatar || ''} alt={friend.name} className="w-9 h-9 rounded-full object-cover border border-zinc-200" />
                        <div>
                          <p className="text-xs font-black text-zinc-800">{friend.name}</p>
                          <p className="text-[9px] text-zinc-400 font-mono">ID: {(friend as any).yoyoId || 'N/A'}</p>
                        </div>
                      </div>
                      <button
                        disabled={isAlreadyInvited || inviteLoading}
                        onClick={async () => {
                          setInviteLoading(true);
                          try {
                            const hostId = currentUser._id || currentUser.id;
                            const res = await fetch(`/api/rooms/${roomId}/invite`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ hostId, inviteeId: friendId })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setInvitedSet(prev => new Set([...prev, friendId]));
                              toast(`Invitation sent to ${friend.name}! 🎉`, 'success');
                            } else {
                              toast(data.error || 'Failed to invite', 'error');
                            }
                          } catch {
                            toast('Network error. Try again.', 'error');
                          } finally {
                            setInviteLoading(false);
                          }
                        }}
                        className={`text-[10px] font-black px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          isAlreadyInvited
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        {isAlreadyInvited ? '✓ Invited' : 'Invite'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden WebRTC Audio Elements for all active remote speaker streams */}

      <div className="hidden pointer-events-none">
        {Object.entries(remoteStreams).map(([peerId, stream]) => (
          <audio
            key={peerId}
            autoPlay
            playsInline
            ref={(el) => {
              if (el && el.srcObject !== stream) {
                el.srcObject = stream;
                el.play().catch(e => {
                  console.warn(`Audio playback waiting for gesture from peer ${peerId}:`, e);
                  setAudioAutoplayBlocked(true);
                });
              }
            }}
          />
        ))}
      </div>

      {/* User Profile / Visitor View Modal */}
      {showUserProfileModal && inspectedUser && (
        <UserProfileModal
          user={inspectedUser}
          currentUser={currentUser}
          isOpen={showUserProfileModal}
          onClose={() => {
            setShowUserProfileModal(false);
            setInspectedUser(null);
          }}
          onSendGift={(u) => {
            setShowUserProfileModal(false);
            setShowGiftDrawer(true);
          }}
          onLeaveSeat={mySeatIndex !== null ? handleLeaveSeat : undefined}
          isHost={isCurrentUserHost}
          userSeatIndex={
            (() => {
              const idx = seats.findIndex(s => s.user && (String(s.user._id || s.user.id) === String(inspectedUser._id || inspectedUser.id) || s.user.name === inspectedUser.name));
              return idx >= 0 ? idx : null;
            })()
          }
          onKickFromSeat={handleKickUserFromSeat}
          onKickFromRoom={handleKickUserFromRoom}
        />
      )}

      {/* ===== Room Customization Modal (Host Only) ===== */}
      {showCustomizationModal && isCurrentUserHost && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200 p-0 sm:p-4">
          <div className="bg-zinc-950 border border-white/15 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 text-white shadow-2xl max-h-[85%] overflow-y-auto scrollbar-none">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Palette className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">Room Customization</h3>
                  <p className="text-[10px] text-zinc-400">Personalize wallpaper, announcements & seats</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustomizationModal(false)}
                className="text-zinc-400 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Wallpaper Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🖼️ Scenic Wallpapers</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ROOM_WALLPAPERS.map((wp) => {
                  const isSelected = roomBackground === wp.url;
                  return (
                    <div
                      key={wp.id}
                      onClick={() => setRoomBackground(wp.url)}
                      className={`relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer border-2 transition-all group ${
                        isSelected ? 'border-amber-400 scale-[1.02] shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={wp.thumbnail || wp.url} alt={wp.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex items-end p-1.5">
                        <span className="text-[9px] font-black text-white truncate drop-shadow">{wp.name}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5 text-black shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom Wallpaper URL */}
              <div className="mt-1 flex gap-1.5">
                <input
                  type="text"
                  placeholder="Or paste custom image URL (https://...)"
                  value={customWallpaperInput}
                  onChange={(e) => setCustomWallpaperInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => {
                    if (customWallpaperInput.trim()) {
                      setRoomBackground(customWallpaperInput.trim());
                      toast('Custom wallpaper applied! Preview active ✨', 'info');
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer active:scale-95"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Room Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                🏷️ Room Title
              </label>
              <input
                type="text"
                maxLength={35}
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                className="bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Room Notice / Announcement */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                📢 Room Announcement / Notice
              </label>
              <textarea
                rows={2}
                maxLength={100}
                value={roomNotice}
                onChange={(e) => setRoomNotice(e.target.value)}
                placeholder="Welcome to the room! Sit back, relax and enjoy the vibes ✨"
                className="bg-zinc-900 border border-white/15 rounded-xl p-3 text-xs text-white resize-none focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Seating Layout Style */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                🛋️ Seating Layout Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSeatStyle('sofa')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                    seatStyle === 'sofa'
                      ? 'bg-amber-500/20 border-amber-400 text-white font-bold shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-xl">🛋️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-amber-300">Royal Lounge</p>
                    <p className="text-[9px] text-zinc-400">Sofa seats (No.1–No.8)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSeatStyle('classic')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                    seatStyle === 'classic'
                      ? 'bg-amber-500/20 border-amber-400 text-white font-bold shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-xl">🎙️</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-indigo-300">Classic Stage</p>
                    <p className="text-[9px] text-zinc-400">Microphone circles</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Save & Apply Button */}
            <button
              disabled={isSavingCustomization}
              onClick={() => handleSaveRoomCustomization()}
              className="w-full mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingCustomization ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save & Broadcast Room</span>
                </>
              )}
            </button>

          </div>
        </div>
      )}

      {/* ===== Room Music Player Drawer ===== */}
      {showMusicDrawer && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200 p-0 sm:p-4">
          <div className="bg-zinc-950 border border-white/15 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 text-white shadow-2xl max-h-[85%] overflow-y-auto scrollbar-none">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Music className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">Room Music Player</h3>
                  <p className="text-[10px] text-zinc-400">Synchronized live playback for everyone in the room</p>
                </div>
              </div>
              <button
                onClick={() => setShowMusicDrawer(false)}
                className="text-zinc-400 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Now Playing Visualizer Card */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 relative overflow-hidden shadow-xl">
              
              {/* Spinning Vinyl Record Art */}
              <div className="relative my-2">
                <motion.div
                  animate={{ rotate: isTrackPlaying ? 360 : 0 }}
                  transition={{ repeat: isTrackPlaying ? Infinity : 0, duration: 5, ease: 'linear' }}
                  className="w-24 h-24 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 border-4 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)] flex items-center justify-center"
                >
                  <div className="w-20 h-20 rounded-full border border-zinc-700/60 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full border border-zinc-700/40 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-xs font-black text-white shadow">
                        🎵
                      </div>
                    </div>
                  </div>
                </motion.div>
                {isTrackPlaying && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              {/* Title & Artist */}
              <div className="text-center min-w-0 max-w-full">
                <h4 className="text-sm font-black text-white truncate">
                  {activeTrack ? activeTrack.name : "Select a Track"}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  {activeTrack ? ((activeTrack as any).artist || safeRoom.host.name) : "Ready to play backing music"}
                </p>
              </div>

              {/* Seek / Progress Bar */}
              <div className="w-full flex flex-col gap-1 mt-1">
                <input
                  type="range"
                  min={0}
                  max={musicDuration || 100}
                  value={musicProgress}
                  onChange={(e) => handleSeekMusic(Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                  <span>
                    {(() => {
                      const m = Math.floor(musicProgress / 60);
                      const s = Math.floor(musicProgress % 60);
                      return `${m}:${s < 10 ? '0' : ''}${s}`;
                    })()}
                  </span>
                  <span>
                    {(() => {
                      if (!musicDuration) return activeTrack?.duration || '0:00';
                      const m = Math.floor(musicDuration / 60);
                      const s = Math.floor(musicDuration % 60);
                      return `${m}:${s < 10 ? '0' : ''}${s}`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Playback Control Buttons */}
              <div className="flex items-center gap-4 mt-1">
                <button
                  onClick={handlePrevTrack}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all active:scale-95"
                  title="Previous Track"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlayPause}
                  className="p-4 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] cursor-pointer transition-all active:scale-90"
                  title={isTrackPlaying ? "Pause" : "Play"}
                >
                  {isTrackPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all active:scale-95"
                  title="Next Track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="w-full flex items-center gap-2 pt-2 border-t border-white/10 text-xs">
                <span className="text-zinc-400">
                  {musicVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="flex-1 accent-rose-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Presets Track Library */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                🎶 Music Library
              </label>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto scrollbar-none pr-1">
                {AUDIO_TRACKS.map((track) => {
                  const isCurrent = activeTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-rose-500/20 border-rose-400/60 text-white font-bold'
                          : 'bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base">{isCurrent && isTrackPlaying ? '▶️' : '🎵'}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{track.name}</p>
                          <p className="text-[9px] text-zinc-400 font-medium">{(track as any).artist || 'Studio Audio'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-mono text-zinc-400">{track.duration}</span>
                        {isCurrent && isTrackPlaying && (
                          <span className="text-[8px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                            Playing
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Audio Stream Input (Host Only) */}
            {isCurrentUserHost && (
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔗 Stream Custom Audio (Direct MP3 URL)</span>
                </label>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    placeholder="Track Name (e.g. My Favorite Melody)"
                    value={customAudioName}
                    onChange={(e) => setCustomAudioName(e.target.value)}
                    className="bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="https://.../music.mp3"
                      value={customAudioUrl}
                      onChange={(e) => setCustomAudioUrl(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handlePlayCustomAudio}
                      className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 px-3.5 py-2 rounded-xl text-xs font-black text-white cursor-pointer active:scale-95 shadow"
                    >
                      Stream
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowMusicDrawer(false)}
              className="w-full mt-1 bg-zinc-900 hover:bg-zinc-800 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
