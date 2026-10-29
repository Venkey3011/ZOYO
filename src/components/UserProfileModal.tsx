import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { PRESET_AVATARS } from '../data';
import { 
  X, Copy, MessageCircle, UserPlus, Gift, Sparkles, 
  Award, ShieldCheck, Heart, Eye, Check, Star, LogOut,
  UserX, ShieldAlert
} from 'lucide-react';
import { toast } from './Toast';

interface UserProfileModalProps {
  user: User | null;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (targetUser: User) => void;
  onSendGift?: (targetUser: User) => void;
  onLeaveSeat?: () => void;
  isHost?: boolean;
  userSeatIndex?: number | null;
  onKickFromSeat?: (seatIndex: number, user: User) => void;
  onKickFromRoom?: (user: User) => void;
}

export default function UserProfileModal({
  user,
  currentUser,
  isOpen,
  onClose,
  onOpenChat,
  onSendGift,
  onLeaveSeat,
  isHost = false,
  userSeatIndex = null,
  onKickFromSeat,
  onKickFromRoom,
}: UserProfileModalProps) {
  const [profileData, setProfileData] = useState<User | null>(user);
  const [friendReqSent, setFriendReqSent] = useState(false);
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false);
  const [isSendingReq, setIsSendingReq] = useState(false);
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setProfileData(user);
    setFriendReqSent(false);
    setIsAlreadyFriend(false);

    const targetId = user._id || user.id;
    const myId = currentUser._id || currentUser.id;

    // Record profile visit if viewing another user
    if (targetId && targetId !== myId && myId !== 'me') {
      fetch(`/api/users/${targetId}/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor: {
            id: myId,
            name: currentUser.name,
            avatar: currentUser.avatar,
            yoyoId: currentUser.yoyoId || ''
          }
        })
      })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.recentVisitors) {
          setRecentVisitors(d.recentVisitors);
        }
      })
      .catch(() => {});
    }

    // Fetch full profile info
    fetch(`/api/users/${targetId}/profile`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setProfileData(prev => ({ ...(prev || user), ...d.user }));
          if (d.user.recentVisitors) {
            setRecentVisitors(d.user.recentVisitors);
          }
        }
      })
      .catch(() => {});

    // Check friendship status
    if (targetId && myId && targetId !== myId) {
      fetch(`/api/friends/status?user1=${encodeURIComponent(String(myId))}&user2=${encodeURIComponent(String(targetId))}`)
        .then(r => r.json())
        .then(d => {
          if (d?.isFriend) {
            setIsAlreadyFriend(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, user, currentUser]);

  if (!isOpen || !profileData) return null;

  const isMe = (profileData._id || profileData.id) === (currentUser._id || currentUser.id) || profileData.name === currentUser.name;
  const targetId = profileData._id || profileData.id;
  const myId = currentUser._id || currentUser.id;

  const handleSendFriendRequest = async () => {
    if (isMe) return;
    setIsSendingReq(true);
    try {
      const res = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: myId,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderYoyoId: currentUser.yoyoId || '',
          receiverId: targetId,
          receiverName: profileData.name,
          receiverYoyoId: profileData.yoyoId || ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setFriendReqSent(true);
        toast(`Friend request sent to ${profileData.name}! 🤝`, 'success');
      } else {
        toast(data.error || 'Could not send request', 'error');
      }
    } catch {
      toast('Network error sending friend request', 'error');
    } finally {
      setIsSendingReq(false);
    }
  };

  const medals = [
    { title: "Ludo Maestro", desc: "Win 10 fast-Ludo matches in voice rooms.", emoji: "🏆" },
    { title: "Generous Supporter", desc: "Send 20+ animated gifts to host seats.", emoji: "💎" },
    { title: "Active Talker", desc: "Speak on guest mic seats for 30 minutes.", emoji: "🎤" },
    { title: "Mall Tycoon", desc: "Unlock premium frames and bubble styles.", emoji: "👑" },
  ];

  const frameClass =
    profileData.frameId === 'frame_neon' ? 'border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]' :
    profileData.frameId === 'frame_pink' ? 'border-2 border-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)]' :
    profileData.frameId === 'frame_royal' ? 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]' :
    profileData.frameId === 'frame_cosmic' ? 'border-2 border-purple-500 animate-[spin_8s_linear_infinite]' :
    'border-2 border-rose-400';

  return (
    <div className="fixed inset-0 z-[99999] bg-zinc-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-[32px] border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
        
        {/* Profile Card Header Banner */}
        <div className="relative h-28 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 p-4 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] bg-black/25 text-white backdrop-blur-sm px-2.5 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3" /> Visitor Profile
            </span>
            {isMe && (
              <span className="text-[9px] bg-white text-rose-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm">
                You
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Avatar & Details Body */}
        <div className="px-5 pb-5 -mt-12 flex-1 overflow-y-auto scrollbar-none flex flex-col items-center text-center">
          
          {/* Avatar with Equipped Frame */}
          <div className="relative">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center p-1 bg-white shadow-xl ${frameClass}`}>
              <img
                src={profileData.avatar || PRESET_AVATARS[0]}
                alt={profileData.name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {profileData.vipStatus && profileData.vipStatus !== 'None' && (
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-md border-2 border-white">
                👑 {profileData.vipStatus}
              </div>
            )}
          </div>

          {/* User Name & Badges */}
          <div className="mt-2.5">
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="font-display font-black text-base text-zinc-900 leading-tight">
                {profileData.name}
              </h3>
              {profileData.role === 'admin' && (
                <span className="text-[8px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Admin
                </span>
              )}
              {profileData.role === 'manager' && (
                <span className="text-[8px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Manager
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-1 text-[10px] text-zinc-500">
              <span className="text-rose-500 font-extrabold">{profileData.badge || '🐣 Beginner'}</span>
              <span>•</span>
              <span className="font-bold">Level {profileData.level || 1}</span>
              {profileData.country && (
                <>
                  <span>•</span>
                  <span>{profileData.country}</span>
                </>
              )}
            </div>
          </div>

          {/* ZOYO ID with 1-click Copy */}
          <div className="mt-2 flex items-center gap-1.5 bg-stone-100/80 border border-zinc-200/80 px-3 py-1 rounded-full text-[10px]">
            <span className="text-zinc-400 font-bold uppercase tracking-wider text-[9px]">ZOYO ID:</span>
            <span className="font-mono font-black text-rose-600 tracking-wide text-xs">
              {profileData.yoyoId || '888888'}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(profileData.yoyoId || '888888');
                toast('ZOYO ID copied to clipboard! 📋', 'success');
              }}
              className="p-1 text-zinc-400 hover:text-rose-600 cursor-pointer transition-colors"
              title="Copy ZOYO ID"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {/* User Bio / Motto */}
          <p className="mt-2 text-zinc-500 text-[11px] italic font-medium max-w-[280px]">
            "{profileData.bio || 'Living life and having fun on ZOYO! 🌟'}"
          </p>

          {/* 4 Metrics Strip */}
          <div className="grid grid-cols-4 gap-1 w-full bg-stone-50 border border-zinc-200/70 rounded-2xl p-2.5 mt-3 shadow-xs">
            <div className="text-center border-r border-zinc-200/60">
              <p className="text-xs font-black text-zinc-800">{profileData.followersCount ?? 0}</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center border-r border-zinc-200/60">
              <p className="text-xs font-black text-zinc-800">{profileData.followingCount ?? 0}</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Following</p>
            </div>
            <div className="text-center border-r border-zinc-200/60">
              <p className="text-xs font-black text-zinc-800">{profileData.giftsCount ?? 0}</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Gifts</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-black text-zinc-800">{profileData.visitorsCount ?? 0}</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Visitors</p>
            </div>
          </div>

          {/* Recent Profile Visitors Strip */}
          {recentVisitors.length > 0 && (
            <div className="w-full mt-3 text-left">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="w-3 h-3 text-rose-500" /> Recent Profile Visitors
                </span>
                <span className="text-[9px] text-zinc-400 font-bold">{recentVisitors.length} Recent</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
                {recentVisitors.map((v, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5 shrink-0" title={`${v.name} (ZOYO ID: ${v.yoyoId || 'N/A'})`}>
                    <img
                      src={v.avatar || PRESET_AVATARS[0]}
                      alt={v.name}
                      className="w-8 h-8 rounded-full object-cover border border-zinc-200 shadow-xs"
                    />
                    <span className="text-[8px] font-bold text-zinc-600 truncate max-w-[48px]">{v.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievement Badges Showcase */}
          <div className="w-full mt-3 text-left">
            <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-1.5 px-0.5">
              <Award className="w-3 h-3 text-amber-500" /> Medals & Achievements
            </span>
            <div className="grid grid-cols-2 gap-2">
              {medals.map((m, i) => (
                <div key={i} className="bg-stone-50 border border-zinc-200/60 rounded-xl p-2 flex items-center gap-2">
                  <span className="text-xl">{m.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-zinc-800 truncate">{m.title}</p>
                    <p className="text-[8px] text-zinc-400 truncate">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full mt-4 flex gap-2 pt-2 border-t border-zinc-100">
            {!isMe ? (
              <>
                {isAlreadyFriend ? (
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm select-none">
                    <span>🤝 Friends</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={friendReqSent || isSendingReq}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs cursor-pointer transition-all active:scale-95 shadow-sm ${
                      friendReqSent
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:opacity-95'
                    }`}
                  >
                    {friendReqSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Request Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isSendingReq ? 'Sending...' : 'Add Friend'}</span>
                      </>
                    )}
                  </button>
                )}

                {onOpenChat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat(profileData);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                )}

                {onSendGift && (
                  <button
                    onClick={() => {
                      onClose();
                      onSendGift(profileData);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer transition-all active:scale-95 shadow-sm"
                    title="Send Gift"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="w-full flex flex-col items-center gap-2 py-1">
                {onLeaveSeat && (
                  <button
                    onClick={() => {
                      onClose();
                      onLeaveSeat();
                    }}
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-[11px] cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Leave Mic Seat</span>
                  </button>
                )}
                <span className="text-[10px] text-zinc-400 font-bold flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> This is your public profile as seen by visitors
                </span>
              </div>
            )}
          </div>

          {/* Room Host Operator Actions */}
          {!isMe && isHost && (
            <div className="w-full flex flex-col gap-2 pt-2 border-t border-zinc-150 animate-in fade-in duration-200">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                👑 Host Room Controls
              </span>
              <div className="flex gap-2">
                {userSeatIndex !== null && userSeatIndex !== undefined && userSeatIndex > 0 && onKickFromSeat && (
                  <button
                    onClick={() => {
                      onClose();
                      onKickFromSeat(userSeatIndex, profileData);
                    }}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Kick from Seat {userSeatIndex}</span>
                  </button>
                )}

                {onKickFromRoom && (
                  <button
                    onClick={() => {
                      onClose();
                      onKickFromRoom(profileData);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Kick from Room</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
