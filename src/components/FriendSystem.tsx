import React, { useState, useEffect, useCallback } from 'react';
import { User, FriendRequest } from '../types';
import { PRESET_AVATARS } from '../data';
import { Search, Inbox, Users, Copy, X, UserPlus, Check, Sparkles, UserCheck, Eye } from 'lucide-react';
import { toast } from './Toast';
import UserProfileModal from './UserProfileModal';

interface FriendSystemProps {
  currentUser: User;
  onClose?: () => void;
  onOpenChat?: (friend: Friend) => void;
}

type Tab = 'search' | 'inbox' | 'friends';

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  yoyoId?: string;
}

export default function FriendSystem({ currentUser, onClose, onOpenChat }: FriendSystemProps) {
  const [tab, setTab] = useState<Tab>('search');
  const [inspectedFriend, setInspectedFriend] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Search
  const [searchYoyoId, setSearchYoyoId] = useState('');
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [requestMsg, setRequestMsg] = useState('');

  // Inbox
  const [inbox, setInbox] = useState<FriendRequest[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendListFilter, setFriendListFilter] = useState('');

  const userId = currentUser._id || currentUser.id;

  const fetchInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const res = await fetch(`/api/friend-requests/${userId}/inbox`);
      const data = await res.json();
      if (data.success) setInbox(data.requests);
    } catch { /* ignore */ }
    setInboxLoading(false);
  }, [userId]);

  const fetchFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const res = await fetch(`/api/friends/${userId}`);
      const data = await res.json();
      if (data.success) setFriends(data.friends);
    } catch { /* ignore */ }
    setFriendsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (tab === 'inbox') fetchInbox();
    if (tab === 'friends') fetchFriends();
  }, [tab, fetchInbox, fetchFriends]);

  async function handleSearch() {
    if (!searchYoyoId.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError('');
    setRequestStatus('idle');
    setRequestMsg('');
    try {
      const res = await fetch(`/api/users/search?yoyoId=${encodeURIComponent(searchYoyoId.trim())}`);
      const data = await res.json();
      if (data.success && data.user) {
        setSearchResult(data.user);
      } else {
        setSearchError(data.error || 'No user found with that ZOYO ID');
      }
    } catch {
      setSearchError('Network error, please try again');
    }
    setSearchLoading(false);
  }

  async function handleSendRequest() {
    if (!searchResult) return;
    setRequestSending(true);
    const receiverId = searchResult._id || searchResult.id;
    try {
      const res = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderYoyoId: currentUser.yoyoId || '',
          receiverId,
          receiverName: searchResult.name,
          receiverYoyoId: searchResult.yoyoId || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setRequestStatus('sent');
        setRequestMsg('Friend request sent! 🎉');
        toast(`Friend request sent to ${searchResult.name}! 🎉`, 'success');
      } else {
        setRequestStatus('error');
        setRequestMsg(data.error || 'Failed to send request');
        toast(data.error || 'Failed to send request', 'error');
      }
    } catch {
      setRequestStatus('error');
      setRequestMsg('Network error');
      toast('Network error sending request', 'error');
    }
    setRequestSending(false);
  }

  async function handleRespond(requestId: string, action: 'accept' | 'reject') {
    const target = inbox.find(r => r._id === requestId);
    // ⚡ Optimistic: immediately remove from inbox (<1ms)
    setInbox(prev => prev.filter(r => r._id !== requestId));
    if (action === 'accept') {
      toast('Friend request accepted! 🤝', 'success');
    } else {
      toast('Friend request declined', 'info');
    }

    try {
      const res = await fetch(`/api/friend-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success && action === 'accept') {
        fetchFriends();
      } else if (!data.success) {
        if (target) setInbox(prev => [target, ...prev]);
        toast(data.error || 'Failed to process request', 'error');
      }
    } catch {
      if (target) setInbox(prev => [target, ...prev]);
      toast('Failed to process request', 'error');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50 h-full scrollbar-none pb-28 overscroll-contain">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 bg-white sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-sm shadow-rose-500/20">
            <Users className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-zinc-900 font-display font-black text-xs uppercase tracking-wide">
              Friends & Community
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-zinc-400 text-[10px] font-bold">Your ZOYO ID:</span>
              <span className="text-rose-600 font-mono font-black text-[11px]">{currentUser.yoyoId || '888888'}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentUser.yoyoId || '888888');
                  toast('ZOYO ID copied to clipboard! 📋', 'success');
                }}
                className="p-1 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Copy your ZOYO ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab Switcher Pills */}
      <div className="flex bg-white p-1 mx-4 mt-3 rounded-2xl border border-zinc-200/80 gap-1 shrink-0 shadow-xs">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'search'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold shadow-sm shadow-rose-500/25'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={() => setTab('inbox')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
              tab === 'inbox'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold shadow-sm shadow-rose-500/25'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
            {inbox.length > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                tab === 'inbox' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
              }`}>
                {inbox.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('friends')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'friends'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold shadow-sm shadow-rose-500/25'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-4 flex-1 overflow-y-auto scrollbar-none min-h-[300px] bg-slate-50">

          {/* 1. SEARCH TAB */}
          {tab === 'search' && (
            <div className="flex flex-col gap-3">
              <p className="text-zinc-500 text-xs font-medium">
                Enter another user's numeric ZOYO ID to connect:
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter ZOYO ID (e.g. 123456)"
                    value={searchYoyoId}
                    onChange={e => setSearchYoyoId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 font-mono font-bold focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 shadow-xs transition-all"
                    maxLength={12}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchYoyoId.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchError && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 text-rose-600 text-xs text-center font-bold">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={searchResult.avatar || PRESET_AVATARS[0]}
                      alt={searchResult.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-rose-500 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0">
                      <p className="text-zinc-900 font-black text-xs truncate">{searchResult.name}</p>
                      <p className="text-zinc-400 text-[10px] font-bold mt-0.5">
                        ZOYO ID: <span className="text-rose-600 font-mono font-black">{searchResult.yoyoId || 'N/A'}</span>
                      </p>
                      <span className="text-[9px] bg-rose-50 text-rose-600 font-black border border-rose-200 rounded-full px-2 py-0.2 mt-1 inline-block">
                        Lvl {searchResult.level || 1} • {searchResult.badge || '🐣 Beginner'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectedFriend(searchResult);
                        setShowProfileModal(true);
                      }}
                      className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="View user profile"
                    >
                      <Eye className="w-3.5 h-3.5 text-rose-500" />
                      <span>Profile</span>
                    </button>
                    {String(searchResult._id || searchResult.id) === String(userId) ? (
                      <span className="text-zinc-400 text-[10px] font-bold px-3 py-1 bg-stone-100 rounded-full">
                        You
                      </span>
                    ) : requestStatus === 'sent' ? (
                      <span className="text-emerald-600 text-[10px] font-black px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    ) : (
                      <button
                        onClick={handleSendRequest}
                        disabled={requestSending}
                        className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{requestSending ? 'Sending...' : 'Add Friend'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. INBOX TAB */}
          {tab === 'inbox' && (
            <div className="flex flex-col gap-2.5">
              {inboxLoading ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-bold animate-pulse">
                  Checking friend requests...
                </div>
              ) : inbox.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-zinc-400 border border-zinc-200/60">
                    <Inbox className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <h4 className="font-display font-black text-xs text-zinc-800 mt-1">Inbox Empty</h4>
                  <p className="text-zinc-400 text-[11px] font-medium max-w-[200px]">
                    No pending friend requests. Search someone by ZOYO ID to send invites!
                  </p>
                </div>
              ) : (
                inbox.map(req => (
                  <div key={req._id} className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={req.senderAvatar || PRESET_AVATARS[0]}
                        alt={req.senderName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-rose-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-900 font-black text-xs truncate">{req.senderName}</p>
                        <p className="text-zinc-400 text-[10px] font-bold">
                          ZOYO ID: <span className="text-rose-600 font-mono font-black">{req.senderYoyoId || '—'}</span>
                        </p>
                        <p className="text-zinc-400 text-[9px] font-semibold mt-0.5">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(req._id, 'accept')}
                        disabled={respondingId === req._id}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        {respondingId === req._id ? '...' : '✓ Accept'}
                      </button>
                      <button
                        onClick={() => handleRespond(req._id, 'reject')}
                        disabled={respondingId === req._id}
                        className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 active:scale-95 text-zinc-600 text-xs font-bold rounded-xl transition-all border border-zinc-200/60 cursor-pointer"
                      >
                        {respondingId === req._id ? '...' : '✕ Decline'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 3. FRIENDS TAB */}
          {tab === 'friends' && (
            <div className="flex flex-col gap-2">
              {friends.length > 0 && (
                <div className="relative mb-1">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search friends by ZOYO ID..."
                    value={friendListFilter}
                    onChange={e => setFriendListFilter(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 font-mono font-bold focus:outline-none focus:border-rose-500 shadow-2xs"
                  />
                </div>
              )}

              {friendsLoading ? (
                <div className="text-center py-10 text-zinc-400 text-xs font-bold animate-pulse">
                  Loading your friends...
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-zinc-400 border border-zinc-200/60">
                    <Users className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <h4 className="font-display font-black text-xs text-zinc-800 mt-1">No Friends Yet</h4>
                  <p className="text-zinc-400 text-[11px] font-medium max-w-[210px]">
                    Search any user by their ZOYO ID or invite listeners from voice rooms to become friends!
                  </p>
                  <button
                    onClick={() => setTab('search')}
                    className="mt-2 text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    + Find Friends
                  </button>
                </div>
              ) : (
                friends
                  .filter(f => !friendListFilter.trim() || (f.yoyoId || '').toLowerCase().includes(friendListFilter.toLowerCase().trim()))
                  .map((friend, i) => (
                    <div key={friend.id || i} className="flex items-center justify-between bg-white border border-zinc-200/90 rounded-2xl p-3 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={friend.avatar || PRESET_AVATARS[0]}
                            alt={friend.name}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                          />
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-zinc-900 font-black text-xs truncate">{friend.name}</p>
                          {friend.yoyoId && (
                            <p className="text-zinc-400 text-[10px] font-bold">
                              ZOYO ID: <span className="text-rose-600 font-mono font-black">{friend.yoyoId}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedFriend(friend as any);
                            setShowProfileModal(true);
                          }}
                          className="text-[10px] bg-stone-100 hover:bg-stone-200 text-zinc-700 font-bold px-2.5 py-1 rounded-full border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
                          title="View Profile"
                        >
                          <Eye className="w-3 h-3 text-rose-500" />
                          <span>Profile</span>
                        </button>
                        {onOpenChat && (
                          <button
                            onClick={() => onOpenChat(friend)}
                            className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold px-3 py-1 rounded-full border border-rose-200 transition-colors cursor-pointer active:scale-95"
                          >
                            Chat
                          </button>
                        )}
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full border border-emerald-200">
                          Friend
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

        </div>

      {/* Profile / Visitor View Modal */}
      {showProfileModal && inspectedFriend && (
        <UserProfileModal
          user={inspectedFriend}
          currentUser={currentUser}
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false);
            setInspectedFriend(null);
          }}
          onOpenChat={(f) => {
            setShowProfileModal(false);
            if (onOpenChat) onOpenChat(f as any);
          }}
        />
      )}
    </div>
  );
}
