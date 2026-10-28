export interface User {
  id: string;
  _id?: string;
  name: string;
  username?: string;
  nickname?: string;
  avatar: string;
  level: number;
  coins: number;
  frameId: string;
  bubbleId: string;
  badge: string;
  role?: 'admin' | 'manager' | 'coin_seller' | 'user';
  createdBy?: string;
  managerId?: string;
  isBlocked?: boolean;
  yoyoId?: string;
  gender?: string;
  dateOfBirth?: string;
  country?: string;
  followersCount?: number;
  followingCount?: number;
  giftsCount?: number;
  visitorsCount?: number;
  family?: string;
  vipStatus?: 'None' | 'VIP' | 'SVIP';
  bio?: string;
  recentVisitors?: Array<{ id: string; name: string; avatar: string; yoyoId?: string; visitedAt?: string }>;
}

export interface Room {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  host: User;
  theme: 'neon' | 'pink' | 'royal' | 'cosmic';
  category: 'chat' | 'games' | 'singing' | 'match';
  onlineCount: number;
  activeGame: string;
  backgroundUrl: string;
  roomImage?: string;
  seats?: Array<{ index: number; user: User | null; isMuted: boolean; isTalking: boolean }>;
  onlineUsers?: User[];
  chatMessages?: ChatMessage[];
  isPrivate?: boolean;
  roomPassword?: string;
  invitedUsers?: string[];
  roomId?: string;
  isOfficialGame?: boolean;
  gamePrizePool?: number;
  notice?: string;
  seatStyle?: 'sofa' | 'classic';
  musicState?: {
    isPlaying: boolean;
    trackId?: string;
    trackName?: string;
    trackUrl?: string;
    currentTime?: number;
    volume?: number;
    senderName?: string;
  };
}

export interface CustomGame {
  _id?: string;
  id: string;
  name: string;
  category: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  status: 'active' | 'maintenance' | 'coming_soon' | string;
  entryFee?: number;
  prizePool?: number;
  addedBy?: string;
  createdAt?: string;
}

export interface Seat {
  index: number;
  user: User | null;
  isMuted: boolean;
  isTalking: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel: number;
  message: string;
  type: 'text' | 'system' | 'gift' | 'roll';
  timestamp?: string;
  giftName?: string;
  giftIcon?: string;
  giftCount?: number;
}

export interface Gift {
  id: string;
  name: string;
  coins: number;
  icon: string;
  effect: 'rose' | 'car' | 'rocket' | 'crown' | 'confetti' | 'fireworks' | 'hearts' | 'diamond' | string;
  description: string;
  addedBy?: string;
}

export interface GameItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  status: 'active' | 'coming_soon';
  addedBy?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  timestamp: string;
  isVoice?: boolean;
  voiceDuration?: number;
  unread?: boolean;
  yoyoId?: string;
}


export interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'coins' | 'frame' | 'bubble';
  value: any; // coins count or styles
  icon: string;
}

// Ludo Game State
export interface LudoPlayer {
  id: string;
  name: string;
  avatar: string;
  color: 'red' | 'green' | 'yellow' | 'blue';
  position: number; // 0 to 15 (simplified track)
  isBot: boolean;
}

export interface LudoState {
  players: LudoPlayer[];
  activePlayerIndex: number;
  diceValue: number;
  isRolling: boolean;
  history: string[];
}

// Dice Duel State
export interface DiceDuelState {
  player1: { name: string; avatar: string; score: number; isRolling: boolean };
  player2: { name: string; avatar: string; score: number; isRolling: boolean };
  status: 'idle' | 'betting' | 'rolling' | 'finished';
  winner: string | null;
  betAmount: number;
}

export interface FriendRequest {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderYoyoId: string;
  receiverId: string;
  receiverName: string;
  receiverYoyoId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}


