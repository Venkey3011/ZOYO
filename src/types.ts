export interface User {
  id: string;
  _id?: string;
  name: string;
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
  activeGame: 'none' | 'ludo' | 'dice' | 'wheel';
  backgroundUrl: string;
  seats?: Array<{ index: number; user: User | null; isMuted: boolean; isTalking: boolean }>;
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
  giftName?: string;
  giftIcon?: string;
  giftCount?: number;
}

export interface Gift {
  id: string;
  name: string;
  coins: number;
  icon: string;
  effect: 'rose' | 'car' | 'rocket' | 'crown';
  description: string;
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
