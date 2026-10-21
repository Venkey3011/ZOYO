import React, { useState, useRef, useEffect } from 'react';
import { DirectMessage, User } from '../types';
import { Search, ChevronLeft, Send, Play, Pause, MessageSquare, Plus, Trash2, X, MoreVertical, Users, Eye } from 'lucide-react';
import { toast } from './Toast';
import UserProfileModal from './UserProfileModal';

interface DirectMessagesProps {
  currentUser: User;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  receiverId?: string;
  text: string;
  voice?: boolean;
  duration?: number;
  timestamp: string;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  yoyoId?: string;
}

export default function DirectMessages({ currentUser }: DirectMessagesProps) {
  const myUserId = String((currentUser as any)._id || currentUser.id || 'me');

  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [chatLog, setChatLog] = useState<{ [dmId: string]: ChatMessage[] }>({});
  const [inputText, setInputText] = useState('');
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const [activeDm, setActiveDm] = useState<DirectMessage | null>(null);
  const [search, setSearch] = useState('');

  // Ref to always have the latest activeDm in WS handlers
  const activeDmRef = useRef<DirectMessage | null>(null);
  activeDmRef.current = activeDm;

  // Ref for messages bottom auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Friends & User picker modal
  const [showFriendsPicker, setShowFriendsPicker] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);

  // Search user globally by ZOYO ID when typing in the modal
  useEffect(() => {
    if (!showFriendsPicker) {
      setSearchedUser(null);
      setSearchingUser(false);
      return;
    }
    const query = friendSearch.trim();
    if (query.length < 4) {
      setSearchedUser(null);
      setSearchingUser(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingUser(true);
      try {
        const res = await fetch(`/api/users/search?yoyoId=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.user) {
          setSearchedUser(data.user);
        } else {
          setSearchedUser(null);
        }
      } catch {
        setSearchedUser(null);
      } finally {
        setSearchingUser(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [friendSearch, showFriendsPicker]);


  // Chat options menu
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // Message context menu (per-message delete)
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    if (activeDm) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLog, activeDm]);

  // Fetch initial conversations from server
  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/dm/conversations/${myUserId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        setDms(data.conversations);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [myUserId]);

  // Fetch messages for a specific conversation
  const fetchMessages = async (friendId: string) => {
    try {
      const res = await fetch(`/api/dm/messages/${myUserId}/${friendId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setChatLog(prev => ({ ...prev, [friendId]: data.messages }));
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  // WebSocket real-time connection for instant message delivery
  useEffect(() => {
    let isMounted = true;
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          socket?.send(JSON.stringify({
            type: 'register_user',
            userId: myUserId
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'dm_message') {
              const { message, conversationId, partner } = data;

              // Append message to chatLog
              setChatLog(prev => {
                const existing = prev[conversationId] || [];
                if (existing.some(m => m.id === message.id)) return prev;
                return {
                  ...prev,
                  [conversationId]: [...existing, message]
                };
              });

              // Update conversation list
              setDms(prev => {
                const existingIdx = prev.findIndex(d => d.id === conversationId);
                const isCurrentActive = activeDmRef.current?.id === conversationId;

                if (existingIdx !== -1) {
                  const updated = [...prev];
                  const conv = { ...updated[existingIdx] };
                  conv.message = message.voice ? `🎤 Voice note (${message.duration || 0}s)` : message.text;
                  conv.timestamp = message.timestamp || 'Just Now';
                  if (!isCurrentActive) {
                    conv.unread = true;
                  }
                  updated.splice(existingIdx, 1);
                  return [conv, ...updated];
                } else if (partner) {
                  const newConv: DirectMessage = {
                    id: partner.id,
                    senderId: partner.id,
                    senderName: partner.name,
                    senderAvatar: partner.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${partner.id}`,
                    message: message.voice ? `🎤 Voice note (${message.duration || 0}s)` : message.text,
                    timestamp: message.timestamp || 'Just Now',
                    unread: !isCurrentActive
                  };
                  return [newConv, ...prev];
                }
                return prev;
              });
            } else if (data.type === 'dm_message_deleted') {
              const { messageId, conversationId } = data;
              setChatLog(prev => ({
                ...prev,
                [conversationId]: (prev[conversationId] || []).filter(m => m.id !== messageId)
              }));
            } else if (data.type === 'dm_chat_cleared') {
              const { conversationId } = data;
              setChatLog(prev => ({
                ...prev,
                [conversationId]: []
              }));
            } else if (data.type === 'room_invite') {
              // Host invited us to their room — show a toast notification
              const { roomTitle, hostName, roomCode } = data;
              toast(`🎉 ${hostName} invited you to "${roomTitle}"! Room Code: ${roomCode || 'N/A'}`, 'success');
            }
          } catch (e) {
            console.error('WS parse error:', e);

          }
        };

        socket.onclose = () => {
          if (isMounted) {
            reconnectTimeout = setTimeout(connectWs, 3000);
          }
        };
      } catch (err) {
        console.error('WS connection error:', err);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [myUserId]);

  const fetchFriends = async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch(`/api/friends/${myUserId}`);
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends || []);
      } else {
        setFriends([]);
      }
    } catch {
      setFriends([]);
      toast('Could not load friends', 'error');
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleOpenFriendsPicker = () => {
    setShowFriendsPicker(true);
    setFriendSearch('');
    fetchFriends();
  };

  const handleSelectFriend = (friend: Friend) => {
    const existingDm = dms.find(d => d.senderId === friend.id || d.id === friend.id);
    if (existingDm) {
      setActiveDm(existingDm);
      activeDmRef.current = existingDm;
      setDms(prev => prev.map(d => d.id === existingDm.id ? { ...d, unread: false } : d));
      fetchMessages(friend.id);
      setShowFriendsPicker(false);
      return;
    }

    const dmId = friend.id;
    const newDm: DirectMessage = {
      id: dmId,
      senderId: friend.id,
      senderName: friend.name,
      senderAvatar: friend.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`,
      yoyoId: friend.yoyoId,
      message: 'Start a conversation!',
      timestamp: 'Just Now',
      isVoice: false,
      unread: false,
    };

    setDms(prev => [newDm, ...prev]);
    setChatLog(prev => ({ ...prev, [dmId]: [] }));
    setActiveDm(newDm);
    activeDmRef.current = newDm;
    fetchMessages(friend.id);
    setShowFriendsPicker(false);
  };

  const handleOpenDm = (dm: DirectMessage) => {
    setActiveDm(dm);
    activeDmRef.current = dm;
    setDms(prev => prev.map(d => d.id === dm.id ? { ...d, unread: false } : d));
    setShowChatMenu(false);
    setMsgMenuId(null);
    fetchMessages(dm.senderId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeDm) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const res = await fetch('/api/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: myUserId,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderYoyoId: currentUser.yoyoId || '',
          receiverId: activeDm.senderId,
          receiverName: activeDm.senderName,
          receiverAvatar: activeDm.senderAvatar,
          receiverYoyoId: activeDm.yoyoId || '',
          text: textToSend,
          voice: false,
        })
      });

      const data = await res.json();
      if (data.success && data.message) {
        setChatLog(prev => {
          const existing = prev[activeDm.id] || [];
          if (existing.some(m => m.id === data.message.id)) return prev;
          return { ...prev, [activeDm.id]: [...existing, data.message] };
        });
        setDms(prev => prev.map(d => d.id === activeDm.id ? { ...d, message: data.message.text, timestamp: 'Just Now' } : d));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast('Failed to send message', 'error');
    }
  };

  const handleDeleteMessage = async (dmId: string, msgId: string) => {
    setChatLog(prev => ({
      ...prev,
      [dmId]: (prev[dmId] || []).filter(m => m.id !== msgId),
    }));
    setMsgMenuId(null);

    try {
      await fetch(`/api/dm/message/${msgId}`, { method: 'DELETE' });
      toast('Message deleted');
    } catch (e) {
      console.error('Delete message error:', e);
      toast('Failed to delete on server', 'error');
    }
  };

  const handleClearChat = async () => {
    if (!activeDm) return;
    const dmId = activeDm.id;
    const friendId = activeDm.senderId;

    setChatLog(prev => ({ ...prev, [dmId]: [] }));
    setDms(prev => prev.map(d => d.id === dmId ? { ...d, message: 'Chat cleared', timestamp: 'Just Now' } : d));
    setShowChatMenu(false);

    try {
      await fetch(`/api/dm/conversation/${myUserId}/${friendId}`, { method: 'DELETE' });
      toast('Chat cleared');
    } catch (e) {
      console.error('Clear chat error:', e);
      toast('Failed to clear chat on server', 'error');
    }
  };

  const handleDeleteConversation = async () => {
    if (!activeDm) return;
    const dmId = activeDm.id;
    const friendId = activeDm.senderId;

    setDms(prev => prev.filter(d => d.id !== dmId));
    setChatLog(prev => {
      const updated = { ...prev };
      delete updated[dmId];
      return updated;
    });
    setActiveDm(null);
    activeDmRef.current = null;
    setShowChatMenu(false);

    try {
      await fetch(`/api/dm/conversation/${myUserId}/${friendId}`, { method: 'DELETE' });
      toast('Conversation deleted');
    } catch (e) {
      console.error('Delete conversation error:', e);
      toast('Failed to delete on server', 'error');
    }
  };

  const playVoiceNote = (text: string, id: string) => {
    if (isPlayingVoice === id) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*🎤\d()]/g, ''));
    utterance.onend = () => setIsPlayingVoice(null);
    utterance.onerror = () => setIsPlayingVoice(null);
    setIsPlayingVoice(id);
    window.speechSynthesis.speak(utterance);
  };

  const filteredDms = dms.filter(d =>
    !search.trim() ||
    Boolean(d.yoyoId && d.yoyoId.toLowerCase().includes(search.toLowerCase().trim()))
  );

  const filteredFriends = friends.filter(f =>
    !friendSearch.trim() ||
    Boolean(f.yoyoId && f.yoyoId.toLowerCase().includes(friendSearch.toLowerCase().trim()))
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-xs h-full relative">
      {!activeDm ? (
        // ── DM List View ──────────────────────────────────────────────
        <div className="flex-1 min-h-0 relative h-full flex flex-col overflow-hidden bg-slate-50">
          <div className="p-4 pb-2 flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-rose-500" /> Chats
              </h2>
            {dms.filter(d => d.unread).length > 0 && (
              <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2 py-0.5 rounded-full">
                {dms.filter(d => d.unread).length} New
              </span>
            )}
          </div>

          <div className="relative shrink-0 mt-1">
            <span className="absolute left-3 top-2.5 text-zinc-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chats by ZOYO ID..."
              className="w-full bg-white border border-zinc-200 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm font-mono"
            />
          </div>
          </div>

          {/* DM Contact Cards list */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto px-4 pb-24 scrollbar-none overscroll-contain">
            {filteredDms.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-zinc-400 gap-3">
                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center border border-zinc-200/50">
                  <MessageSquare className="w-6 h-6 text-zinc-400 stroke-[1.8]" />
                </div>
                <h4 className="font-display font-black text-zinc-800">No chats found</h4>
                <p className="text-[10px] max-w-[180px] text-zinc-400 font-medium leading-relaxed">
                  {search.trim() ? `No conversation matched ZOYO ID "${search}"` : 'Tap the + button to search a user by ZOYO ID and start chatting!'}
                </p>
              </div>
            ) : (
              filteredDms.map((dm) => (
                <div
                  key={dm.id}
                  onClick={() => handleOpenDm(dm)}
                  className={`flex gap-3 p-3 rounded-2xl border transition-all cursor-pointer items-center justify-between ${
                    dm.unread
                      ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-50'
                      : 'bg-white border-zinc-200 hover:bg-stone-50 shadow-sm'
                  }`}
                >
                  <div className="flex gap-3 items-center min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={dm.senderAvatar}
                        alt={dm.senderName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                      />
                      {dm.unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-extrabold text-zinc-900 truncate">{dm.senderName}</h3>
                        {dm.yoyoId && (
                          <span className="text-[9px] text-zinc-400 font-mono font-bold">ID: {dm.yoyoId}</span>
                        )}
                      </div>
                      <p className={`text-[10px] mt-0.5 truncate ${dm.unread ? 'text-rose-600 font-bold' : 'text-zinc-500'}`}>
                        {dm.message}
                      </p>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-400 font-bold shrink-0 text-right">
                    <p>{dm.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Chat FAB */}
          <button
            onClick={handleOpenFriendsPicker}
            className="absolute bottom-6 right-5 w-12 h-12 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 border border-white"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
      ) : (
        // ── Active DM Chat View ───────────────────────────────────────
        <div className="absolute inset-0 bg-slate-50 flex flex-col z-35">
          {/* Header */}
          <div className="h-14 px-3 flex items-center justify-between border-b border-zinc-200 shrink-0 bg-white shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setActiveDm(null); activeDmRef.current = null; setMsgMenuId(null); setShowChatMenu(false); }}
                className="text-zinc-500 hover:text-zinc-800 p-1 rounded-full bg-stone-100 hover:bg-stone-200 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div 
                onClick={() => setShowPartnerProfile(true)}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
                title="View partner profile"
              >
                <img
                  src={activeDm.senderAvatar}
                  alt={activeDm.senderName}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                />
                <div>
                  <h3 className="font-extrabold text-zinc-900 flex items-center gap-1">
                    <span>{activeDm.senderName}</span>
                    <Eye className="w-3 h-3 text-zinc-400" />
                  </h3>
                  <span className="text-[9px] text-emerald-600 flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Online
                  </span>
                </div>
              </div>
            </div>

            {/* ⋯ Chat options menu */}
            <div className="relative" ref={chatMenuRef}>
              <button
                onClick={() => setShowChatMenu(v => !v)}
                className="p-2 rounded-full hover:bg-stone-100 text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showChatMenu && (
                <div className="absolute right-0 top-9 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 w-44 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowChatMenu(false);
                      setShowPartnerProfile(true);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-zinc-700 hover:bg-stone-50 font-semibold cursor-pointer border-b border-zinc-100"
                  >
                    <Eye className="w-3.5 h-3.5 text-zinc-400" /> View Profile
                  </button>
                  <button
                    onClick={handleClearChat}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-zinc-700 hover:bg-stone-50 font-semibold cursor-pointer border-b border-zinc-100"
                  >
                    <X className="w-3.5 h-3.5 text-zinc-400" /> Clear Chat
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-rose-600 hover:bg-rose-50 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Conversation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scrollbar-none pb-16"
            onClick={() => setMsgMenuId(null)}
          >
            {(chatLog[activeDm.id] || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-zinc-300 stroke-[1.8]" />
                </div>
                <p className="text-[10px] font-semibold text-zinc-400">Say hi to {activeDm.senderName}! 👋</p>
              </div>
            )}

            {(chatLog[activeDm.id] || []).map((chat) => {
              const isMe = chat.senderId ? String(chat.senderId) === myUserId : chat.sender === currentUser.name;
              const isMenuOpen = msgMenuId === chat.id;

              return (
                <div
                  key={chat.id}
                  className={`flex flex-col max-w-[80%] relative ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <span className="text-[9px] text-zinc-400 mb-1 font-semibold">{chat.sender}</span>

                  <div className="relative group flex items-end gap-1">
                    {/* Delete button (for sender) */}
                    {isMe && (
                      <button
                        onClick={e => { e.stopPropagation(); setMsgMenuId(isMenuOpen ? null : chat.id); }}
                        className={`p-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          isMenuOpen ? 'opacity-100 bg-rose-50 text-rose-500' : 'opacity-0 group-hover:opacity-100 bg-stone-100 text-zinc-400 hover:text-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <div
                      onClick={e => { e.stopPropagation(); if (!isMe) setMsgMenuId(isMenuOpen ? null : chat.id); }}
                      className={`p-3 rounded-2xl leading-relaxed shadow-sm cursor-default ${
                        isMe
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-tr-none'
                          : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none'
                      }`}
                    >
                      {chat.voice ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => playVoiceNote(chat.text, `voice_${chat.id}`)}
                            className="bg-rose-50 text-rose-500 p-2 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all shadow"
                          >
                            {isPlayingVoice === `voice_${chat.id}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <p className="font-bold text-[10px]">Voice Note</p>
                            <p className="text-[9px] opacity-70 mt-0.5">Duration: {chat.duration}s</p>
                          </div>
                        </div>
                      ) : (
                        <p className="font-medium text-xs break-words">{chat.text}</p>
                      )}
                    </div>

                    {!isMe && (
                      <button
                        onClick={e => { e.stopPropagation(); setMsgMenuId(isMenuOpen ? null : chat.id); }}
                        className={`p-1 rounded-full transition-all cursor-pointer shrink-0 ${
                          isMenuOpen ? 'opacity-100 bg-rose-50 text-rose-500' : 'opacity-0 group-hover:opacity-100 bg-stone-100 text-zinc-400 hover:text-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Per-message delete confirm */}
                  {isMenuOpen && (
                    <div className={`mt-1 flex gap-1.5 ${isMe ? 'items-end justify-end' : 'items-start justify-start'}`}>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteMessage(activeDm.id, chat.id); }}
                        className="flex items-center gap-1 bg-rose-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer hover:bg-rose-600 active:scale-95 transition-all shadow"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Delete
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setMsgMenuId(null); }}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer bg-stone-100 text-zinc-600 hover:bg-stone-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <span className="text-[8px] text-zinc-400 mt-0.5 px-1">{chat.timestamp}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <form
            onSubmit={handleSendMessage}
            className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t border-zinc-200 px-4 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Message ${activeDm.senderName}...`}
              className="flex-1 bg-stone-50 border border-zinc-200 rounded-full px-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white p-2.5 rounded-full cursor-pointer shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ── Friends Picker Modal ───────────────────────────────────── */}
      {showFriendsPicker && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl flex flex-col max-h-[80%] shadow-2xl">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <h3 className="font-black text-zinc-900 flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-rose-500" /> Start a Chat
              </h3>
              <button
                onClick={() => setShowFriendsPicker(false)}
                className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-zinc-500 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Search user by ZOYO ID..."
                  autoFocus
                  className="w-full bg-stone-50 border border-zinc-200 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>
            </div>

            {/* Friends & Searched Users list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-2 scrollbar-none">
              {friendsLoading || searchingUser ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="h-3 bg-zinc-200 rounded-full w-24" />
                        <div className="h-2.5 bg-zinc-100 rounded-full w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredFriends.length === 0 && !searchedUser ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
                  <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-zinc-300" />
                  </div>
                  <p className="text-[10px] font-semibold text-center max-w-[180px]">
                    {friendSearch.trim()
                      ? `No user found with ZOYO ID "${friendSearch}".`
                      : 'Type a ZOYO ID to search and chat with any user!'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredFriends.map(friend => {
                    const hasExisting = dms.some(d => d.senderId === friend.id || d.id === friend.id);
                    return (
                      <button
                        key={friend.id}
                        onClick={() => handleSelectFriend(friend)}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 border border-zinc-100 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer text-left w-full active:scale-[0.98]"
                      >
                        <img
                          src={friend.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`}
                          alt={friend.name}
                          className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-zinc-900 truncate">{friend.name}</p>
                          {friend.yoyoId && (
                            <p className="text-[9px] text-zinc-400 font-mono font-semibold truncate">ID: {friend.yoyoId}</p>
                          )}
                        </div>
                        {hasExisting ? (
                          <span className="text-[9px] bg-rose-50 text-rose-500 border border-rose-200 font-bold px-2 py-0.5 rounded-full shrink-0">
                            Open
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold px-2 py-0.5 rounded-full shrink-0">
                            Chat
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* If user is found via global ZOYO ID search and not already in friends */}
                  {searchedUser && !filteredFriends.some(f => f.id === (searchedUser._id || searchedUser.id)) && (
                    <button
                      onClick={() => handleSelectFriend({
                        id: searchedUser._id || searchedUser.id,
                        name: searchedUser.name,
                        avatar: searchedUser.avatar,
                        yoyoId: searchedUser.yoyoId
                      })}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-rose-50/50 border border-rose-200 hover:bg-rose-100/50 transition-all cursor-pointer text-left w-full active:scale-[0.98]"
                    >
                      <img
                        src={searchedUser.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${searchedUser.id}`}
                        alt={searchedUser.name}
                        className="w-10 h-10 rounded-full object-cover border border-rose-300 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-zinc-900 truncate">{searchedUser.name}</p>
                          <span className="text-[8px] bg-rose-500 text-white font-extrabold px-1.5 py-0.2 rounded-full">
                            Found
                          </span>
                        </div>
                        <p className="text-[9px] text-rose-600 font-mono font-bold truncate">ZOYO ID: {searchedUser.yoyoId}</p>
                      </div>
                      <span className="text-[9px] bg-rose-500 text-white font-black px-2.5 py-1 rounded-full shadow-xs shrink-0">
                        Chat
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile / Visitor View Modal */}
      {showPartnerProfile && activeDm && (
        <UserProfileModal
          user={{
            id: activeDm.senderId || activeDm.id,
            _id: activeDm.senderId || activeDm.id,
            name: activeDm.senderName,
            avatar: activeDm.senderAvatar,
            yoyoId: activeDm.yoyoId,
            level: 1,
            coins: 0,
            frameId: 'none',
            bubbleId: 'none',
            badge: '🐣 Beginner'
          }}
          currentUser={currentUser}
          isOpen={showPartnerProfile}
          onClose={() => setShowPartnerProfile(false)}
        />
      )}
    </div>
  );
}
