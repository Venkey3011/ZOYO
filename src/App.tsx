import React, { useState, useEffect } from 'react';
import MobileFrame from './components/MobileFrame';
import RoomList from './components/RoomList';
import VoiceRoom from './components/VoiceRoom';
import DirectMessages from './components/DirectMessages';
import ProfileTab from './components/ProfileTab';
import LoginScreen from './components/LoginScreen';
import AdminConsole from './components/AdminConsole';
import FriendSystem from './components/FriendSystem';
import GamesHub from './components/GamesHub';
import { ToastContainer, useToastSetup, toast } from './components/Toast';
import UpdateManager from './components/UpdateManager';
import { Room, User } from './types';
import { PRESET_AVATARS } from './data';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getStoredUser,
  saveStoredUser,
  clearStoredUser,
  getStoredActiveTab,
  saveStoredActiveTab,
  executeBackHandler,
} from './lib/navigation';

export default function App() {
  const { toasts, removeToast } = useToastSetup();

  // Restore session from localStorage across page refreshes
  const storedUser = React.useMemo(() => getStoredUser(), []);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(storedUser));
  const [activeTab, setActiveTab] = useState<string>(() => getStoredActiveTab());
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('zoyo_intro_seen');
    } catch {
      return true;
    }
  });
  const [currentUser, setCurrentUser] = useState<User>(() => {
    return (
      storedUser || {
        id: 'me',
        name: '',
        avatar: PRESET_AVATARS[0],
        level: 1,
        coins: 0,
        frameId: 'none',
        bubbleId: 'none',
        badge: '🐣 Beginner',
      }
    );
  });
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomOverride, setActiveRoomOverride] = useState<Room | null>(null);

  // Unlocked style shop privileges — initialized from stored user
  const [unlockedFrames, setUnlockedFrames] = useState<string[]>(['none']);
  const [unlockedBubbles, setUnlockedBubbles] = useState<string[]>(['none']);
  const [equippedFrame, setEquippedFrame] = useState<string>(() => storedUser?.frameId || 'none');
  const [equippedBubble, setEquippedBubble] = useState<string>(() => storedUser?.bubbleId || 'none');
  const [isBanned, setIsBanned] = useState(false);

  // Persistent update helper that guarantees localStorage always mirrors currentUser
  const updateCurrentUserAndPersist = React.useCallback((updater: User | ((prev: User) => User)) => {
    setCurrentUser((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      saveStoredUser(updated);
      return updated;
    });
  }, []);

  // Track navigation state in refs for back button handling without stale closures
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;
  const activeRoomIdRef = React.useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;
  const isLoggedInRef = React.useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;
  const lastBackPressRef = React.useRef<number>(0);

  // Auto-dismiss intro splash after 3 seconds with smooth exit
  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem('zoyo_intro_seen', 'true');
      } catch {}
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const handleDismissSplash = () => {
    try {
      sessionStorage.setItem('zoyo_intro_seen', 'true');
    } catch {}
    setShowSplash(false);
  };

  // Fetch rooms from backend when user logs in — paused when user is inside a room to save 100% CPU/bandwidth
  React.useEffect(() => {
    if (!isLoggedIn || activeRoomId !== null) return;

    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rooms)) {
            setRooms(data.rooms);
          }
        }
      } catch (err) {
        console.warn('Rooms fetch warning:', err);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 6000);
    return () => clearInterval(interval);
  }, [isLoggedIn, activeRoomId]);

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Friends & Notifications badge counts
  const [inboxCount, setInboxCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Poll for ban/block and sync status steadily (4.5s interval without tearing down on coin change)
  React.useEffect(() => {
    if (!isLoggedIn) return;
    const uId = currentUser._id || currentUser.id;
    if (!uId || uId === 'me') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/users/${uId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.isBlocked) {
            setIsBanned(true);
          } else if (data.success) {
            updateCurrentUserAndPersist(prev => {
              let changed = false;
              const next = { ...prev };
              if (data.coins !== undefined && data.coins !== prev.coins) {
                next.coins = data.coins;
                changed = true;
              }
              if (data.role && data.role !== prev.role) {
                next.role = data.role;
                changed = true;
              }
              return changed ? next : prev;
            });
          }
        }
      } catch (err) {
        console.warn("Could not check user status:", err);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isLoggedIn, currentUser._id, currentUser.id, updateCurrentUserAndPersist]);

  // Initial mount verification if user was restored from stored session
  useEffect(() => {
    if (!isLoggedIn) return;
    const uId = currentUser._id || currentUser.id;
    if (!uId || uId === 'me') return;

    fetch(`/api/users/${uId}/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.isBlocked) {
            setIsBanned(true);
          } else {
            updateCurrentUserAndPersist((prev) => ({
              ...prev,
              ...(data.coins !== undefined ? { coins: data.coins } : {}),
              ...(data.role ? { role: data.role } : {}),
            }));
          }
        } else if (data.error === 'User not found') {
          handleLogout();
        }
      })
      .catch(() => {});
  }, []);

  // Poll notification counts (pending friend requests & unread DMs) every 12 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    const uId = currentUser._id || currentUser.id;
    if (!uId || uId === 'me') return;

    const fetchNotifications = async () => {
      try {
        let lastRead = localStorage.getItem('zoyo_last_read_chat');
        if (!lastRead) {
          lastRead = String(Date.now());
          localStorage.setItem('zoyo_last_read_chat', lastRead);
        }
        const res = await fetch(`/api/notifications/counts/${uId}?since=${lastRead}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setInboxCount(data.friendRequests || 0);
            if (activeTabRef.current !== 'chat') {
              setUnreadMessagesCount(data.unreadDMs || 0);
            } else {
              setUnreadMessagesCount(0);
            }
          }
        }
      } catch { /* ignore */ }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, [isLoggedIn, currentUser._id, currentUser.id]);

  // Global WebSocket for instantaneous push notifications (friend requests, DMs, responses)
  useEffect(() => {
    if (!isLoggedIn) return;
    const uId = currentUser._id || currentUser.id;
    if (!uId || uId === 'me') return;

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let isMounted = true;

    const connectGlobalWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          ws?.send(JSON.stringify({
            type: 'register_user',
            userId: String(uId)
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'friend_request_received') {
              setInboxCount(prev => prev + 1);
              toast(`🤝 New friend request from ${data.friendRequest?.sender_name || 'a user'}!`, 'info');
            } else if (data.type === 'friend_request_responded') {
              if (data.action === 'accept') {
                toast(`🎉 ${data.friendRequest?.receiver_name || 'Friend'} accepted your friend request!`, 'success');
              }
            } else if (data.type === 'dm_message') {
              if (activeTabRef.current !== 'chat') {
                setUnreadMessagesCount(prev => prev + 1);
                const partnerName = data.partner?.name || data.message?.sender || 'Friend';
                const preview = data.message?.text || 'Sent you a message';
                toast(`💬 Message from ${partnerName}: ${preview.slice(0, 30)}`, 'info');
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connectGlobalWs, 5000);
          }
        };
      } catch {}
    };

    connectGlobalWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [isLoggedIn, currentUser._id, currentUser.id]);

  // Sync state modifications back to Express MongoDB server
  const syncUserWithDb = async (updatedFields: Partial<User>) => {
    const uId = currentUser._id || currentUser.id;
    if (!uId || uId === 'me') return;
    try {
      await fetch(`/api/users/${uId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
    } catch (err) {
      console.warn("Failed to synchronize state with DB server:", err);
    }
  };

  // Handle coins update
  const handleUpdateCoins = (newCoins: number) => {
    updateCurrentUserAndPersist((prev) => {
      const updated = { ...prev, coins: newCoins };
      syncUserWithDb({ coins: newCoins });
      return updated;
    });
  };

  // Handle unlock frames
  const handleUnlockFrame = (frameId: string) => {
    setUnlockedFrames((prev) => [...prev, frameId]);
  };

  // Handle unlock bubbles
  const handleUnlockBubble = (bubbleId: string) => {
    setUnlockedBubbles((prev) => [...prev, bubbleId]);
  };

  // Handle equip frames
  const handleEquipFrame = (frameId: string) => {
    setEquippedFrame(frameId);
    updateCurrentUserAndPersist((prev) => {
      const updated = { ...prev, frameId };
      syncUserWithDb({ frameId });
      return updated;
    });
  };

  // Handle equip bubbles
  const handleEquipBubble = (bubbleId: string) => {
    setEquippedBubble(bubbleId);
    updateCurrentUserAndPersist((prev) => {
      const updated = { ...prev, bubbleId };
      syncUserWithDb({ bubbleId });
      return updated;
    });
  };

  // Handle custom room creation
  const handleCreateRoom = async (
    title: string,
    category: 'chat' | 'games' | 'singing' | 'match',
    theme: 'neon' | 'pink' | 'royal' | 'cosmic',
    isPrivate?: boolean,
    roomPassword?: string,
    activeGame?: string,
    isOfficialGame?: boolean,
    gamePrizePool?: number,
    roomImage?: string
  ) => {
    const themeWallpaperMap: Record<string, string> = {
      neon: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
      pink: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
      royal: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80',
      cosmic: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80'
    };
    const backgroundUrl = themeWallpaperMap[theme] || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80';

    const roomData = {
      title,
      description: `Welcome to my customized ${category} voice channel! Let's talk & play games! 🎙️✨`,
      host: currentUser,
      theme,
      category,
      backgroundUrl,
      isPrivate: Boolean(isPrivate),
      roomPassword: isPrivate ? (roomPassword || '') : '',
      activeGame: activeGame || (category === 'games' ? 'ludo' : 'none'),
      isOfficialGame: Boolean(isOfficialGame),
      gamePrizePool: gamePrizePool || 0,
      roomImage: roomImage || '',
    };

    const tempId = `room_${Date.now()}`;
    const initialSeats = Array.from({ length: 9 }, (_, i) => ({
      index: i,
      user: i === 0 ? currentUser : null,
      isMuted: false,
      isTalking: false
    }));

    const optimisticRoom: Room = {
      id: tempId,
      _id: tempId,
      roomId: Math.floor(100000 + Math.random() * 900000).toString(),
      title,
      description: roomData.description,
      host: currentUser,
      theme,
      category,
      backgroundUrl,
      roomImage: roomImage || '',
      onlineCount: 1,
      activeGame: roomData.activeGame,
      isOfficialGame: roomData.isOfficialGame,
      gamePrizePool: roomData.gamePrizePool,
      isPrivate: roomData.isPrivate,
      roomPassword: roomData.roomPassword,
      seats: initialSeats,
      onlineUsers: [currentUser],
      chatMessages: [{
        id: `welcome_${Date.now()}`,
        userId: 'system',
        userName: 'System',
        userLevel: 99,
        message: `Welcome to ${currentUser.name}'s voice room! Grab a mic seat to talk live or chat with everyone! 🎙️✨`,
        type: 'system',
        timestamp: new Date().toISOString()
      }]
    };

    // ⚡ INSTANT 0ms OPTIMISTIC SWITCH — show room UI immediately:
    setActiveRoomOverride(optimisticRoom);
    setActiveRoomId(tempId);
    setRooms((prev) => [optimisticRoom, ...prev]);

    // Push history state so back button leaves room instead of exiting app
    try {
      window.history.pushState({ zoyo: true, root: false, tab: activeTabRef.current, roomId: tempId }, '');
    } catch {}

    // Asynchronously persist to backend — update room with real MongoDB _id when done
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.room) {
          const serverRoom = data.room;
          const realId = serverRoom._id || serverRoom.id;
          // ⚡ Swap to real ID — VoiceRoom's useEffect will reconnect WS with proper MongoDB ID
          setActiveRoomOverride(serverRoom);
          setActiveRoomId(realId);
          try {
            window.history.replaceState({ zoyo: true, root: false, tab: activeTabRef.current, roomId: realId }, '');
          } catch {}
          setRooms((prev) => prev.map(r => ((r as any)._id === tempId || r.id === tempId ? serverRoom : r)));
          if (serverRoom.isPrivate) {
            toast(`🔒 Private Room Created! Code: #${serverRoom.roomId || ''}`, 'success');
          } else if (serverRoom.roomId) {
            toast(`🎙️ Voice Room Created! Code: #${serverRoom.roomId}`, 'success');
          }
        }
      })
      .catch(err => {
        console.warn('Background room creation sync warning:', err);
      });
  };


  // Handle joining a live voice room — OPTIMISTIC: navigate instantly (<1ms), refresh in background
  const handleJoinRoom = (roomId: string, password?: string, roomObj?: Room) => {
    // ⚡ Instant 0ms navigation: immediately set the active room and ID
    if (roomObj) {
      setActiveRoomOverride(roomObj);
    } else {
      const local = rooms.find((r: any) => 
        String(r._id || r.id || '') === String(roomId) || 
        String(r.roomId || '') === String(roomId)
      );
      if (local) setActiveRoomOverride(local);
    }
    setActiveRoomId(roomId);

    // Push history state so back button leaves room cleanly
    try {
      window.history.pushState({ zoyo: true, root: false, tab: activeTabRef.current, roomId }, '');
    } catch {}

    // Refresh room details silently in background (non-blocking)
    (async () => {
      try {
        const singleRes = await fetch(`/api/rooms/${roomId}/seats`);
        if (singleRes.ok) {
          const singleData = await singleRes.json();
          if (singleData.success && singleData.room) {
            setActiveRoomOverride(singleData.room);
            setRooms(prev => {
              const idx = prev.findIndex((r: any) => 
                String(r._id || r.id || '') === String(roomId) || 
                String(r.roomId || '') === String(roomId)
              );
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = singleData.room;
                return next;
              }
              return [singleData.room, ...prev];
            });
          }
        }
      } catch (err) {
        console.warn('Background room refresh:', err);
      }
    })();
  };

  // Handle leaving voice room
  const handleLeaveRoom = () => {
    if (activeRoomIdRef.current !== null) {
      setActiveRoomId(null);
      setActiveRoomOverride(null);
      if (window.history.state && window.history.state.roomId) {
        try {
          window.history.back();
        } catch {}
      }
    }
  };

  // Handle tab navigation with history push so device back button navigates back
  const handleTabChange = (newTab: string) => {
    if (activeRoomIdRef.current !== null) {
      setActiveRoomId(null);
      setActiveRoomOverride(null);
    }
    if (newTab === 'chat') {
      setUnreadMessagesCount(0);
      localStorage.setItem('zoyo_last_read_chat', String(Date.now()));
      const uId = currentUser._id || currentUser.id;
      if (uId) {
        fetch(`/api/dm/read/${uId}`, { method: 'POST' }).catch(() => {});
      }
    }
    if (newTab !== activeTabRef.current) {
      setActiveTab(newTab);
      saveStoredActiveTab(newTab);
      try {
        window.history.pushState({ zoyo: true, root: false, tab: newTab, roomId: null }, '');
      } catch {}
    }
  };

  // Profile customisation handlers
  const handleUpdateNickname = (newName: string) => {
    updateCurrentUserAndPersist((prev) => {
      const updated = { ...prev, name: newName };
      syncUserWithDb({ name: newName });
      return updated;
    });
  };

  const handleUpdateAvatar = (newAvatar: string) => {
    updateCurrentUserAndPersist((prev) => {
      const updated = { ...prev, avatar: newAvatar };
      syncUserWithDb({ avatar: newAvatar });
      return updated;
    });
  };

  const handleLoginSuccess = (user: User) => {
    saveStoredUser(user);
    setCurrentUser(user);
    setIsLoggedIn(true);
    // Equip settings from database if available
    if (user.frameId) setEquippedFrame(user.frameId);
    if (user.bubbleId) setEquippedBubble(user.bubbleId);
    // ⚡ Immediately fetch rooms so they appear in <50ms instead of waiting for useEffect cycle
    fetch('/api/rooms').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.rooms)) setRooms(d.rooms);
    }).catch(() => {});
  };

  const handleLogout = () => {
    clearStoredUser();
    setIsLoggedIn(false);
    setActiveTab('home');
    setActiveRoomId(null);
    setActiveRoomOverride(null);
    setCurrentUser({
      id: 'me',
      name: '',
      avatar: PRESET_AVATARS[0],
      level: 1,
      coins: 0,
      frameId: 'none',
      bubbleId: 'none',
      badge: '🐣 Beginner',
    });
  };

  // Hardware / Gesture / Browser Back Button Management
  useEffect(() => {
    if (!isLoggedIn) return;

    // Seed history stack so first back tap on home screen doesn't exit instantly
    try {
      if (!window.history.state || !window.history.state.zoyo) {
        window.history.replaceState({ zoyo: true, root: true, tab: activeTabRef.current, roomId: null }, '');
        window.history.pushState({ zoyo: true, root: false, tab: activeTabRef.current, roomId: null }, '');
      }
    } catch {}

    const handlePopState = (event: PopStateEvent) => {
      // 1. Check if any active modal / drawer / sub-view consumes the back action
      if (executeBackHandler()) {
        try {
          window.history.pushState(
            { zoyo: true, root: false, tab: activeTabRef.current, roomId: activeRoomIdRef.current },
            ''
          );
        } catch {}
        return;
      }

      // 2. If user is inside a room, leave the room!
      if (activeRoomIdRef.current !== null) {
        setActiveRoomId(null);
        setActiveRoomOverride(null);
        return;
      }

      // 3. If user is on a sub-tab (not 'home'), navigate back to 'home' or previous tab!
      if (activeTabRef.current !== 'home') {
        const targetTab = event.state && event.state.tab && event.state.tab !== activeTabRef.current 
          ? event.state.tab 
          : 'home';
        setActiveTab(targetTab);
        saveStoredActiveTab(targetTab);
        return;
      }

      // 4. User is on 'home' tab with no room and no modal open.
      // Mobile standard double-back to exit mechanism:
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // User tapped back twice within 2 seconds: allow app to close/exit
        return;
      }

      // First tap: warn user with toast and retain trap state
      lastBackPressRef.current = now;
      toast('Press back again to exit ZOYO', 'info');
      try {
        window.history.pushState({ zoyo: true, root: false, tab: 'home', roomId: null }, '');
      } catch {}
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLoggedIn]);

  const activeRoom = activeRoomOverride || rooms.find((r) => {
    const rId = String((r as any)._id || r.id || '');
    const rCode = String((r as any).roomId || '');
    const target = String(activeRoomId || '');
    return (rId && rId === target) || (rCode && rCode === target) || (r as any)._id === activeRoomId || r.id === activeRoomId;
  });

  // Debug logging
  console.log('🔍 App state:', {
    activeRoomId,
    roomsCount: rooms.length,
    hasActiveRoom: !!activeRoom,
    activeRoomTitle: activeRoom?.title,
    activeRoomHost: activeRoom?.host?.name,
    activeRoomSeats: activeRoom?.seats?.length
  });

  // If user is not logged in, prompt standard authentication
  if (!isLoggedIn) {
    return (
      <MobileFrame
        activeTab="profile"
        onTabChange={() => {}}
        inRoom={false}
        coins={currentUser.coins}
        userName="Authenticate..."
        userAvatar={currentUser.avatar}
        isLoggedIn={false}
      >
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </MobileFrame>
    );
  }

  return (
    <MobileFrame
      activeTab={activeTab}
      onTabChange={handleTabChange}
      inRoom={activeRoomId !== null}
      onBackToHome={handleLeaveRoom}
      coins={currentUser.coins}
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      currentUserRole={currentUser.role}
      inboxCount={inboxCount}
      unreadMessagesCount={unreadMessagesCount}
    >
      {activeRoomId && activeRoom ? (
        <VoiceRoom
          room={activeRoom}
          onLeave={handleLeaveRoom}
          currentUser={currentUser}
          onUpdateCoins={handleUpdateCoins}
          onSendMessage={() => {}}
        />
      ) : activeTab === 'home' ? (
        <RoomList
          rooms={rooms}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          currentUser={currentUser}
        />
      ) : activeTab === 'friends' ? (
        <FriendSystem
          currentUser={currentUser}
          onOpenChat={() => setActiveTab('chat')}
        />
      ) : activeTab === 'games' ? (
        <GamesHub
          currentUser={currentUser}
          rooms={rooms}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          onUpdateCoins={handleUpdateCoins}
        />
      ) : activeTab === 'chat' ? (
        <DirectMessages currentUser={currentUser} />
      ) : activeTab === 'admin' ? (
        <AdminConsole 
          currentUser={currentUser} 
          onCoinsUpdated={handleUpdateCoins} 
        />
      ) : (
        <ProfileTab
          currentUser={currentUser}
          onUpdateNickname={handleUpdateNickname}
          onUpdateAvatar={handleUpdateAvatar}
          unlockedFrames={unlockedFrames}
          unlockedBubbles={unlockedBubbles}
          equippedFrame={equippedFrame}
          equippedBubble={equippedBubble}
          onLogout={handleLogout}
        />
      )}

      {/* Dynamic Banned Popup Dialog */}
      {isBanned && (
        <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md z-[9999] flex items-center justify-center p-6 text-xs text-zinc-800">
          <div className="bg-white border border-rose-200 shadow-2xl rounded-3xl p-6 max-w-xs w-full text-center flex flex-col gap-4 animate-in zoom-in-95 duration-250">
            <span className="text-5xl">🚫</span>
            <h3 className="text-sm font-black text-rose-600 uppercase tracking-widest">Account Blocked</h3>
            <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">
              Your account "{currentUser.name}" has been banned by the platform administrator or manager. 
              Active sessions and access privileges have been revoked.
            </p>
            <button
              onClick={() => {
                setIsBanned(false);
                handleLogout();
              }}
              className="mt-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold py-2.5 rounded-xl uppercase tracking-wider text-[10px] cursor-pointer shadow-md hover:scale-102 active:scale-98 transition-all"
            >
              OK, Log Out
            </button>
          </div>
        </div>
      )}

      {/* Cinematic App Video Intro Entry — Vanishes after 3 seconds */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="app-video-intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.08, filter: 'blur(12px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-[99999] overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black flex flex-col items-center justify-between p-6 select-none"
          >
            {/* Cinematic Background Light Beam & Ambient Glow */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.25, 1], opacity: [0.3, 0.75, 0.5] }}
              transition={{ duration: 2.8, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_45%,rgba(244,63,94,0.35)_0%,rgba(251,146,60,0.2)_35%,transparent_70%)]"
            />

            {/* Subtle Video Film Scanlines / Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)] z-10" />

            {/* Floating Energy Sparks */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              {['top-1/4 left-1/5', 'top-1/3 right-1/4', 'bottom-1/3 left-1/4', 'bottom-1/4 right-1/5', 'top-1/2 left-10', 'top-2/3 right-12'].map((pos, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15, scale: 0.5 }}
                  animate={{ opacity: [0, 0.9, 0], y: [-10, -50], scale: [0.5, 1.2, 0.8] }}
                  transition={{ duration: 2.2, delay: 0.2 + i * 0.25, ease: 'easeOut' }}
                  className={`absolute ${pos} text-amber-300 text-sm drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]`}
                >
                  ✨
                </motion.div>
              ))}
            </div>

            {/* Top Bar with Intro Tag & Skip Action */}
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="w-full flex items-center justify-between z-20 pt-4 px-2"
            >
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] text-rose-300 font-black tracking-widest uppercase shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>WELCOME TO ZOYO</span>
              </div>
              
              <button
                onClick={handleDismissSplash}
                className="text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
              >
                Skip ➔
              </button>
            </motion.div>

            {/* Center Visual Intro — 3D Video Zoom & Glow */}
            <div className="flex flex-col items-center gap-6 my-auto z-20">
              {/* Logo Emblem with Multi-ring Aura */}
              <motion.div 
                initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                {/* Rotating Outer Gradient Aura */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-5 rounded-[44px] bg-gradient-to-tr from-rose-500 via-amber-400 to-pink-500 opacity-60 blur-2xl"
                />

                {/* Pulsing Core Glow */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -inset-2 rounded-[38px] bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 blur-md opacity-80"
                />

                {/* Logo Image */}
                <motion.img 
                  src="/logo.jpg" 
                  alt="ZOYO Intro Emblem" 
                  referrerPolicy="no-referrer"
                  whileHover={{ scale: 1.03 }}
                  className="w-48 h-48 rounded-[36px] object-cover shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 border-white/30 relative z-10" 
                />

                {/* Lens Flare Accent */}
                <motion.div 
                  initial={{ x: -120, opacity: 0 }}
                  animate={{ x: 140, opacity: [0, 0.8, 0] }}
                  transition={{ duration: 1.6, delay: 0.4, ease: "easeInOut" }}
                  className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] pointer-events-none z-20"
                />
              </motion.div>
              
              {/* Title & Tagline with Reveal Animation */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <h1 className="text-3xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-amber-300 drop-shadow-[0_4px_16px_rgba(244,63,94,0.6)]">
                  ZOYO
                </h1>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-300/90 drop-shadow">
                  Play • Connect • Have Fun!
                </p>
              </motion.div>
            </div>

            {/* Bottom Section — Auto-Loading Video Progress Indicator */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="w-full max-w-xs flex flex-col items-center gap-3 z-20 pb-4"
            >
              {/* 3-Second Countdown Progress Bar */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden backdrop-blur-sm border border-white/10">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: 'linear' }}
                  className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 rounded-full shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                />
              </div>

              <div className="w-full flex items-center justify-between text-[9px] font-bold text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                  Loading Audio & Voice Rooms...
                </span>
                <span className="text-zinc-500 font-mono">3s Auto-Start</span>
              </div>

              <button
                onClick={handleDismissSplash}
                className="w-full bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white text-[11px] font-black py-3 rounded-2xl shadow-xl shadow-rose-500/25 active:scale-95 transition-all uppercase tracking-widest cursor-pointer border border-white/20 hover:brightness-110 flex items-center justify-center gap-1.5"
              >
                <span>Enter Experience</span>
                <span className="text-amber-200">⚡</span>
              </button>
              
              <p className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">
                🎙️ ZOYO Voice & Games Platform
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instant Mobile PWA Auto-Update & Install Controller */}
      <UpdateManager />

      {/* Modern Global Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Offline Frosted-Glass Popup ── */}
      {isOffline && (
        <div className="absolute inset-0 z-[99999] flex items-end justify-center pb-10 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="backdrop-blur-xl bg-zinc-950/75 border border-white/10 rounded-3xl p-5 shadow-2xl flex items-start gap-4 text-white">
              {/* Icon */}
              <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <span className="text-2xl">📶</span>
              </div>
              {/* Text */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p className="font-black text-sm text-white leading-tight">No Internet Connection</p>
                <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                  You're offline right now. ZOYO needs a connection to load rooms, send gifts & play games.
                </p>
                <p className="text-[10px] text-rose-400 font-bold mt-1 animate-pulse">
                  🔄 Reconnecting automatically...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
