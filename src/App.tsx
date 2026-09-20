import React, { useState } from 'react';
import MobileFrame from './components/MobileFrame';
import RoomList from './components/RoomList';
import VoiceRoom from './components/VoiceRoom';
import DirectMessages from './components/DirectMessages';
import ProfileTab from './components/ProfileTab';
import LoginScreen from './components/LoginScreen';
import AdminConsole from './components/AdminConsole';
import { Room, User } from './types';
import { PRESET_AVATARS } from './data';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'me',
    name: '',
    avatar: PRESET_AVATARS[0],
    level: 1,
    coins: 0,
    frameId: 'none',
    bubbleId: 'none',
    badge: '🐣 Beginner',
  });
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Fetch rooms from backend when user logs in
  React.useEffect(() => {
    if (!isLoggedIn) return;

    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            console.log('✅ Loaded rooms:', data.rooms.length);
            setRooms(data.rooms);
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch rooms:', err);
      }
    };

    fetchRooms();

    // Poll for new rooms every 5 seconds
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // Unlocked style shop privileges
  const [unlockedFrames, setUnlockedFrames] = useState<string[]>(['none']);
  const [unlockedBubbles, setUnlockedBubbles] = useState<string[]>(['none']);
  const [equippedFrame, setEquippedFrame] = useState<string>('none');
  const [equippedBubble, setEquippedBubble] = useState<string>('none');
  const [isBanned, setIsBanned] = useState(false);

  // Poll for ban/block status dynamically (3.5 seconds interval)
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
            // Keep coins synced with DB if they get updated from admin console or transactions
            if (data.coins !== undefined && data.coins !== currentUser.coins) {
              setCurrentUser(prev => ({ ...prev, coins: data.coins }));
            }
            if (data.role && data.role !== currentUser.role) {
              setCurrentUser(prev => ({ ...prev, role: data.role }));
            }
          }
        }
      } catch (err) {
        console.warn("Could not check user status:", err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isLoggedIn, currentUser._id, currentUser.id, currentUser.coins, currentUser.role]);

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
    setCurrentUser((prev) => {
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
    setCurrentUser((prev) => {
      const updated = { ...prev, frameId };
      syncUserWithDb({ frameId });
      return updated;
    });
  };

  // Handle equip bubbles
  const handleEquipBubble = (bubbleId: string) => {
    setEquippedBubble(bubbleId);
    setCurrentUser((prev) => {
      const updated = { ...prev, bubbleId };
      syncUserWithDb({ bubbleId });
      return updated;
    });
  };

  // Handle custom room creation
  const handleCreateRoom = async (
    title: string,
    category: 'chat' | 'games' | 'singing' | 'match',
    theme: 'neon' | 'pink' | 'royal' | 'cosmic'
  ) => {
    const backgroundUrl =
      theme === 'neon'
        ? 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)'
        : theme === 'pink'
        ? 'linear-gradient(135deg, #471825 0%, #1c0911 100%)'
        : theme === 'royal'
        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
        : 'linear-gradient(135deg, #090d16 0%, #121c33 100%)';

    const roomData = {
      title,
      description: `Welcome to my customized ${category} voice channel! Let's talk & play games! 🎙️✨`,
      host: currentUser,
      theme,
      category,
      backgroundUrl,
    };

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log('✅ Room created:', data.room);
          // Add to local state immediately
          setRooms((prev) => [data.room, ...prev]);
          // Join newly created room instantly
          setActiveRoomId(data.room._id || data.room.id);
        }
      }
    } catch (err) {
      console.error('❌ Failed to create room:', err);
      // Fallback to local-only room if API fails
      const localRoom: Room = {
        id: `room_${Date.now()}`,
        title,
        description: roomData.description,
        host: currentUser,
        theme,
        category,
        onlineCount: 1,
        activeGame: 'none',
        backgroundUrl,
      };
      setRooms((prev) => [localRoom, ...prev]);
      setActiveRoomId(localRoom.id);
    }
  };

  // Handle joining a live voice room
  const handleJoinRoom = (roomId: string) => {
    setActiveRoomId(roomId);
  };

  // Handle leaving voice room
  const handleLeaveRoom = () => {
    setActiveRoomId(null);
  };

  // Profile customisation handlers
  const handleUpdateNickname = (newName: string) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, name: newName };
      syncUserWithDb({ name: newName });
      return updated;
    });
  };

  const handleUpdateAvatar = (newAvatar: string) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, avatar: newAvatar };
      syncUserWithDb({ avatar: newAvatar });
      return updated;
    });
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    // Equip settings from database if available
    if (user.frameId) setEquippedFrame(user.frameId);
    if (user.bubbleId) setEquippedBubble(user.bubbleId);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('home');
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

  const activeRoom = rooms.find((r) => {
    const roomId = (r as any)._id || r.id;
    return roomId === activeRoomId;
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
      onTabChange={setActiveTab}
      inRoom={activeRoomId !== null}
      onBackToHome={handleLeaveRoom}
      coins={currentUser.coins}
      userName={currentUser.name}
      userAvatar={currentUser.avatar}
      currentUserRole={currentUser.role}
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

      {/* Premium ZOYO Welcome Splash Screen Pop-up */}
      {showSplash && (
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 z-[99999] flex flex-col items-center justify-between p-8 text-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-2 mt-12 animate-in zoom-in-95 duration-500">
            <span className="text-[10px] bg-white/5 text-rose-300 px-3.5 py-1.5 rounded-full font-black uppercase tracking-widest border border-white/10 shadow-lg">
              ✨ Welcome to ZOYO ✨
            </span>
          </div>

          <div className="flex flex-col items-center gap-5 my-auto">
            {/* Splash Logo Graphic */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 rounded-[40px] blur-xl opacity-50 animate-pulse duration-[3s]"></div>
              <img 
                src="/logo.jpg" 
                alt="ZOYO Splash Logo" 
                referrerPolicy="no-referrer"
                className="w-44 h-44 rounded-[32px] object-cover shadow-2xl border-2 border-white/20 relative z-10 animate-in zoom-in-75 duration-700" 
              />
            </div>
            
            <div className="z-10 flex flex-col gap-1">
              <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-200 to-amber-300 drop-shadow-md">
                ZOYO
              </h1>
              <p className="text-[10px] text-rose-300 font-extrabold uppercase tracking-widest">
                Play • Connect • Have Fun!
              </p>
            </div>
          </div>

          <div className="w-full flex flex-col items-center gap-4 mb-8">
            <button
              onClick={() => setShowSplash(false)}
              className="w-full max-w-xs bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white text-[10px] font-black py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest cursor-pointer border border-white/10 animate-bounce"
            >
              Enter Experience ⚡
            </button>
            <p className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">
              Connected • Powered by MongoDB Database
            </p>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
