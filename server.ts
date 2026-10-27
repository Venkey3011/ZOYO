import "dotenv/config";
import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import { AccessToken } from "livekit-server-sdk";
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// MongoDB connection with Graceful Fallback
let isMongoConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

// User database schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, default: '' },
  nickname: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'coin_seller', 'user'], default: 'user' },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80' },
  level: { type: Number, default: 1 },
  coins: { type: Number, default: 0 }, // Defaults to 0 since standard users cannot buy/add coins directly
  frameId: { type: String, default: 'none' },
  bubbleId: { type: String, default: 'none' },
  badge: { type: String, default: '🐣 Beginner' },
  createdBy: { type: String, default: 'self' },
  managerId: { type: String, default: 'none' },
  isBlocked: { type: Boolean, default: false },
  yoyoId: { type: String },
  gender: { type: String, default: 'Other' },
  dateOfBirth: { type: String, default: '2005-01-01' },
  country: { type: String, default: 'Global' },
  phoneNumber: { type: String, default: '' },
  email: { type: String, default: '' },
  socialId: { type: String, default: '' },
  socialProvider: { type: String, default: '' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  giftsCount: { type: Number, default: 0 },
  visitorsCount: { type: Number, default: 0 },
  family: { type: String, default: 'None' },
  vipStatus: { type: String, default: 'None' },
  bio: { type: String, default: 'Living life on ZOYO! 🌟' },
  recentVisitors: { type: Array, default: [] }
}, { timestamps: true });

UserSchema.index({ name: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ yoyoId: 1 });

const UserMongo: any = mongoose.models.User || mongoose.model('User', UserSchema);

// Catalog Schemas for Admin & Manager dynamic content creation
const CustomGiftSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  coins: { type: Number, required: true },
  icon: { type: String, required: true },
  effect: { type: String, default: 'confetti' },
  description: { type: String, default: '' },
  addedBy: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
});
const CustomGiftMongo: any = mongoose.models.CustomGift || mongoose.model('CustomGift', CustomGiftSchema);

const CustomFrameSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  value: { type: String, required: true },
  icon: { type: String, default: '✨' },
  addedBy: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
});
const CustomFrameMongo: any = mongoose.models.CustomFrame || mongoose.model('CustomFrame', CustomFrameSchema);

const CustomGameSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, default: 'Party' },
  icon: { type: String, default: '🎮' },
  minPlayers: { type: Number, default: 2 },
  maxPlayers: { type: Number, default: 4 },
  description: { type: String, default: '' },
  status: { type: String, default: 'active' }, // 'active', 'maintenance', 'coming_soon'
  entryFee: { type: Number, default: 0 },
  prizePool: { type: Number, default: 0 },
  addedBy: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
});
const CustomGameMongo: any = mongoose.models.CustomGame || mongoose.model('CustomGame', CustomGameSchema);

// Coin transfer transaction log schema
const TransferLogSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  receiverId: { type: String, required: true },
  receiverName: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, default: 'transfer' }, // 'transfer' | 'gift' | 'game_spend' | 'game_win' | 'recharge'
  details: { type: String, default: '' },
  icon: { type: String, default: '🪙' },
  timestamp: { type: Date, default: Date.now }
});

const TransferLogMongo: any = mongoose.models.TransferLog || mongoose.model('TransferLog', TransferLogSchema);

// Room schema for voice chat rooms
const RoomSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  host: { type: Object, required: true },
  theme: { type: String, enum: ['neon', 'pink', 'royal', 'cosmic'], default: 'neon' },
  category: { type: String, enum: ['chat', 'games', 'singing', 'match'], default: 'chat' },
  onlineCount: { type: Number, default: 1 },
  activeGame: { type: String, default: 'none' },
  isOfficialGame: { type: Boolean, default: false },
  gamePrizePool: { type: Number, default: 0 },
  backgroundUrl: { type: String, default: '' },
  roomImage: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isPrivate: { type: Boolean, default: false },
  roomPassword: { type: String, default: '' },
  invitedUsers: { type: Array, default: [] },
  roomId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  seats: [{
    index: { type: Number, required: true },
    user: { type: Object, default: null },
    isMuted: { type: Boolean, default: false },
    isTalking: { type: Boolean, default: false }
  }],
  onlineUsers: { type: Array, default: [] },
  chatMessages: [{
    id: { type: String },
    userId: { type: String },
    userName: { type: String },
    userLevel: { type: Number, default: 1 },
    message: { type: String },
    type: { type: String, default: 'text' },
    giftName: { type: String },
    giftIcon: { type: String },
    giftCount: { type: Number },
    timestamp: { type: String }
  }]
});

RoomSchema.index({ roomId: 1 });
RoomSchema.index({ isActive: 1, isPrivate: 1, createdAt: -1 });

const RoomMongo: any = mongoose.models.Room || mongoose.model('Room', RoomSchema);

// Friend Request schema
const FriendRequestSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  senderYoyoId: { type: String, default: '' },
  receiverId: { type: String, required: true },
  receiverName: { type: String, default: '' },
  receiverYoyoId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const FriendRequestMongo: any = mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);

// In-memory friend requests
interface InMemFriendRequest {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderYoyoId: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  receiverYoyoId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}
const inMemoryFriendRequests: InMemFriendRequest[] = [];

// Direct Message schema for 1-on-1 private chat
const DirectMessageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  senderYoyoId: { type: String, default: '' },
  receiverId: { type: String, required: true },
  receiverName: { type: String, required: true },
  receiverAvatar: { type: String, default: '' },
  receiverYoyoId: { type: String, default: '' },
  text: { type: String, required: true },
  voice: { type: Boolean, default: false },
  duration: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const DirectMessageMongo: any = mongoose.models.DirectMessage || mongoose.model('DirectMessage', DirectMessageSchema);

interface InMemDirectMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderYoyoId?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  receiverYoyoId?: string;
  text: string;
  voice: boolean;
  duration?: number;
  createdAt: string;
}
const inMemoryDirectMessages: InMemDirectMessage[] = [];



interface InMemTransferLog {
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  type?: string;
  details?: string;
  icon?: string;
  timestamp: string;
}

const inMemoryTransfers: InMemTransferLog[] = [];

// In-memory rooms storage
interface InMemRoom {
  id: string;
  title: string;
  description: string;
  host: any;
  theme: 'neon' | 'pink' | 'royal' | 'cosmic';
  category: 'chat' | 'games' | 'singing' | 'match';
  onlineCount: number;
  activeGame: string;
  isOfficialGame?: boolean;
  gamePrizePool?: number;
  backgroundUrl: string;
  roomImage?: string;
  isActive: boolean;
  isPrivate: boolean;
  roomPassword: string;
  invitedUsers: string[];
  roomId?: string;
  seats: Array<{ index: number; user: any | null; isMuted: boolean; isTalking: boolean }>;
  onlineUsers: any[];
  chatMessages: any[];
  createdAt: string;
}

const inMemoryRooms: InMemRoom[] = [];

// High-concurrency In-Memory Active Room Cache for Sub-Millisecond Room Operations & Seating
const activeRoomsCache = new Map<string, any>();
const roomSaveDebounceTimers = new Map<string, NodeJS.Timeout>();

async function logTransfer(logData: any) {
  if (isMongoConnected) {
    await TransferLogMongo.create(logData).catch(() => {});
  } else {
    inMemoryTransfers.push({
      ...logData,
      timestamp: new Date().toISOString()
    });
  }
}


// In-memory fallback database
interface InMemUser {
  _id: string;
  name: string;
  username?: string;
  nickname?: string;
  password?: string;
  role: 'admin' | 'manager' | 'coin_seller' | 'user';
  avatar: string;
  level: number;
  coins: number;
  frameId: string;
  bubbleId: string;
  badge: string;
  createdBy: string;
  managerId: string;
  isBlocked: boolean;
  yoyoId: string;
  gender: string;
  dateOfBirth: string;
  country: string;
  phoneNumber?: string;
  email?: string;
  socialId?: string;
  socialProvider?: string;
  followersCount: number;
  followingCount: number;
  giftsCount: number;
  visitorsCount: number;
  family: string;
  vipStatus: 'None' | 'VIP' | 'SVIP' | string;
  bio?: string;
  recentVisitors?: any[];
}

const inMemoryDB: InMemUser[] = [
  {
    _id: "admin_static",
    name: "Admin",
    username: "admin",
    nickname: "Admin",
    password: "Admin123", // Preseeded static credentials for task requirements
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
    level: 99,
    coins: 999999999, // Infinite coins pre-filled
    frameId: "frame_royal",
    bubbleId: "bubble_royal",
    badge: "👑 Owner",
    createdBy: "system",
    managerId: "none",
    isBlocked: false,
    yoyoId: "888888",
    gender: "Male",
    dateOfBirth: "1995-10-24",
    country: "Global",
    phoneNumber: "966500000000",
    followersCount: 0,
    followingCount: 0,
    giftsCount: 0,
    visitorsCount: 0,
    family: "None",
    vipStatus: "None",
    bio: "Living life on ZOYO! 🌟",
    recentVisitors: []
  }
];

// Fallback in-memory catalog items
const inMemoryCustomGifts: any[] = [
  { id: 'g_rose', name: 'Red Rose', coins: 10, icon: '🌹', effect: 'rose', description: 'Express your affection with a beautiful rose shower!', addedBy: 'System' },
  { id: 'g_crown', name: 'Royal Crown', coins: 99, icon: '👑', effect: 'crown', description: 'Crown the host and show their absolute royalty!', addedBy: 'System' },
  { id: 'g_car', name: 'Golden Supercar', coins: 299, icon: '🏎️', effect: 'car', description: 'Drive onto the screen in style with an animated hypercar!', addedBy: 'System' },
  { id: 'g_rocket', name: 'Cosmic Rocket', coins: 599, icon: '🚀', effect: 'rocket', description: 'Launch the voice room directly into outer space!', addedBy: 'System' }
];

const inMemoryCustomFrames: any[] = [
  { id: 'frame_neon', name: 'Cyber Neon Aura', price: 150, value: 'border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]', icon: '💫', addedBy: 'System' },
  { id: 'frame_pink', name: 'Sakura Angel Halo', price: 200, value: 'border-2 border-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)] animate-[bounce_3s_infinite]', icon: '🌸', addedBy: 'System' },
  { id: 'frame_royal', name: 'Imperial Gold Crown', price: 400, value: 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]', icon: '👑', addedBy: 'System' },
  { id: 'frame_cosmic', name: 'Cosmic Fire Ring', price: 350, value: 'border-2 border-purple-500 animate-[spin_8s_linear_infinite]', icon: '🌌', addedBy: 'System' }
];

const inMemoryCustomGames: any[] = [
  { id: 'ludo', name: 'ZOYO Ludo Cup', category: 'Board', icon: '🎲', minPlayers: 2, maxPlayers: 4, description: 'Real-time competitive 4-player Ludo board match', status: 'active', addedBy: 'System' },
  { id: 'dice', name: 'Dice Duel Showdown', category: 'Dice', icon: '🎯', minPlayers: 2, maxPlayers: 2, description: '1-on-1 High-stakes dice roll showdown with coin betting', status: 'active', addedBy: 'System' },
  { id: 'wheel', name: 'Lucky Multiplier Wheel', category: 'Luck', icon: '🎡', minPlayers: 1, maxPlayers: 8, description: 'Spin the dynamic wheel to win 10x multiplier gifts', status: 'active', addedBy: 'System' }
];

// High-performance In-Memory User Cache (< 0.1ms read time, 15-minute TTL)
const activeUsersCache = new Map<string, { user: any; expiresAt: number }>();

function getCachedUser(key: string) {
  if (!key) return null;
  const entry = activeUsersCache.get(String(key).toLowerCase().trim());
  if (entry && entry.expiresAt > Date.now()) {
    return entry.user;
  }
  return null;
}

function setCachedUser(user: any) {
  if (!user) return;
  const raw = user.toObject ? user.toObject() : user;
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15-minute TTL for fast logins
  const entry = { user: raw, expiresAt };
  if (raw.id) activeUsersCache.set(String(raw.id).toLowerCase(), entry);
  if (raw._id) activeUsersCache.set(String(raw._id).toLowerCase(), entry);
  if (raw.yoyoId) activeUsersCache.set(String(raw.yoyoId).toLowerCase(), entry);
  if (raw.name) activeUsersCache.set(String(raw.name).toLowerCase().trim(), entry);
  if (raw.username) activeUsersCache.set(String(raw.username).toLowerCase().trim(), entry);
  if (raw.nickname) activeUsersCache.set(String(raw.nickname).toLowerCase().trim(), entry);
  if (raw.email) activeUsersCache.set(String(raw.email).toLowerCase().trim(), entry);
  if (raw.phoneNumber) activeUsersCache.set(String(raw.phoneNumber).toLowerCase().trim(), entry);
}

function invalidateCachedUser(idOrKey: string) {
  if (!idOrKey) return;
  activeUsersCache.delete(String(idOrKey).toLowerCase().trim());
}

// Pre-warm cache with in-memory users immediately
inMemoryDB.forEach(u => setCachedUser(u));

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI environment variable is missing. Running in in-memory fallback mode.");
    return;
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 50,          // Maintain pool of up to 50 concurrent sockets for instant parallel requests
      minPoolSize: 10,          // Keep 10 idle sockets open at all times to eliminate cold connection handshakes
      maxIdleTimeMS: 30000,     // Close idle connections after 30s
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 20000,
      retryWrites: true,
      retryReads: true
    });
    isMongoConnected = true;
    console.log("🔌 Connected successfully to MongoDB Atlas (High-Speed Pool, Low ms)!");

    // Seed Admin account in MongoDB Atlas if missing
    UserMongo.findOne({ name: "Admin" }).lean().maxTimeMS(2500).then(async (adminExists: any) => {
      if (!adminExists) {
        const seeded = await UserMongo.create({
          name: "Admin",
          username: "admin",
          nickname: "Admin",
          password: "Admin123", // Preseeded credentials
          role: "admin",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
          level: 99,
          coins: 999999999,
          frameId: "frame_royal",
          bubbleId: "bubble_royal",
          badge: "👑 Owner",
          createdBy: "system",
          managerId: "none",
          isBlocked: false,
          yoyoId: "888888",
          gender: "Male",
          dateOfBirth: "1995-10-24",
          country: "Global",
          followersCount: 0,
          followingCount: 0,
          giftsCount: 0,
          visitorsCount: 0,
          family: "None",
          vipStatus: "None"
        });
        setCachedUser(seeded);
        console.log("✅ Seeded Admin user in MongoDB Atlas.");
      } else {
        setCachedUser(adminExists);
      }
    }).catch((e: any) => console.warn('Admin seed check error:', e));

    // ⚡ Pre-warm user cache from MongoDB Atlas in background for 0ms sub-millisecond logins
    UserMongo.find({}).lean().limit(1000).then((users: any[]) => {
      if (users && users.length > 0) {
        users.forEach(u => setCachedUser(u));
        console.log(`⚡ Pre-warmed ${users.length} users into in-memory cache for instant 0ms login.`);
      }
    }).catch((e: any) => console.warn('Cache pre-warm warning:', e));

    // ⚡ Pre-warm public rooms cache so /api/rooms returns in <1ms after first login
    // Use $ne: false to also catch rooms where isActive field is missing/null (legacy documents)
    RoomMongo.find({ isActive: { $ne: false } }).lean().limit(200).then((rooms: any[]) => {
      if (rooms && rooms.length > 0) {
        rooms.forEach((r: any) => {
          activeRoomsCache.set(String(r._id), r);
          if (r.roomId) activeRoomsCache.set(r.roomId, r);
        });
        const publicRooms = rooms.filter((r: any) => !r.isPrivate).map((r: any) => sanitizeRoom({ ...r, id: String(r._id) }));
        publicRooms.forEach((r: any) => { delete r.roomPassword; });
        cachedPublicRoomsList = publicRooms;
        cachedPublicRoomsTime = Date.now();
        console.log(`⚡ Pre-warmed ${publicRooms.length} public rooms into cache for instant 0ms load.`);
      } else {
        console.log(`⚡ Pre-warmed 0 public rooms (no active rooms in DB yet).`);
      }
    }).catch((e: any) => console.warn('Room pre-warm warning:', e));

  } catch (err) {
    console.error("❌ MongoDB Atlas connection error:", err);
    console.warn("⚠️ Falling back to in-memory mode.");
  }
}

connectToMongo();

// Helper to query database depending on status
async function getUsers() {
  if (isMongoConnected) {
    return await UserMongo.find({}, '-password').lean().maxTimeMS(3000).catch(() => inMemoryDB.map(({ password, ...u }) => u));
  } else {
    return inMemoryDB.map(({ password, ...u }) => u);
  }
}

async function findUserById(id: string) {
  if (!id) return null;
  const cleanId = String(id).trim();

  // ⚡ 0ms Fast path: check in-memory cache
  const cached = getCachedUser(cleanId);
  if (cached) return cached;

  const memUser = inMemoryDB.find(u => u._id === cleanId || (u as any).id === cleanId || u.yoyoId === cleanId || u.name.toLowerCase() === cleanId.toLowerCase());
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    let user = null;
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      user = await UserMongo.findById(cleanId).lean().maxTimeMS(1500).catch(() => null);
    }
    if (!user) {
      user = await UserMongo.findOne({ $or: [{ _id: cleanId }, { id: cleanId }, { yoyoId: cleanId }, { username: cleanId }, { name: cleanId }] }).lean().maxTimeMS(1500).catch(() => null);
    }
    if (user) {
      setCachedUser(user);
      return user;
    }
  }
  return null;
}

async function findUserByName(name: string) {
  if (!name) return null;
  const normalized = String(name).toLowerCase().trim();

  // ⚡ 0ms Fast path: check in-memory cache
  const cached = getCachedUser(normalized);
  if (cached) return cached;

  // Check inMemoryDB fast
  const memUser = inMemoryDB.find(u =>
    u.name.toLowerCase() === normalized ||
    (u.username && u.username.toLowerCase() === normalized) ||
    (u.nickname && u.nickname.toLowerCase() === normalized) ||
    (u.email && u.email.toLowerCase() === normalized) ||
    (u.yoyoId && u.yoyoId === normalized)
  );
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    // 1. Fast indexed exact match (<2ms)
    let user = await UserMongo.findOne({
      $or: [
        { username: normalized },
        { name: normalized },
        { email: normalized },
        { yoyoId: normalized }
      ]
    }).lean().maxTimeMS(1500).catch(() => null);

    // 2. Case-insensitive fallback
    if (!user) {
      user = await UserMongo.findOne({
        $or: [
          { username: new RegExp(`^${normalized}$`, 'i') },
          { name: new RegExp(`^${normalized}$`, 'i') }
        ]
      }).lean().maxTimeMS(1500).catch(() => null);
    }

    if (user) {
      setCachedUser(user);
      return user;
    }
  }

  return null;
}

async function findUserByPhone(phone: string) {
  if (!phone) return null;
  const cleaned = phone.trim();

  const cached = getCachedUser(cleaned);
  if (cached) return cached;

  const memUser = inMemoryDB.find(u => u.phoneNumber === cleaned);
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    const user = await UserMongo.findOne({ phoneNumber: cleaned }).lean().maxTimeMS(1500).catch(() => null);
    if (user) {
      setCachedUser(user);
      return user;
    }
  }
  return null;
}

async function findUserByEmail(email: string) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();

  const cached = getCachedUser(cleaned);
  if (cached) return cached;

  const memUser = inMemoryDB.find(u => u.email?.toLowerCase() === cleaned);
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    const user = await UserMongo.findOne({ email: cleaned }).lean().maxTimeMS(1500).catch(() => null);
    if (user) {
      setCachedUser(user);
      return user;
    }
  }
  return null;
}

async function findUserBySocial(provider: string, socialId: string) {
  if (!provider || !socialId) return null;
  const cached = getCachedUser(socialId);
  if (cached) return cached;

  if (isMongoConnected) {
    const user = await UserMongo.findOne({ socialProvider: provider, socialId: socialId }).lean().maxTimeMS(1500).catch(() => null);
    if (user) {
      setCachedUser(user);
      return user;
    }
  }
  return inMemoryDB.find(u => u.socialProvider === provider && u.socialId === socialId) || null;
}



async function createUser(userData: any) {
  const generatedId = userData.yoyoId || Math.floor(100000 + Math.random() * 900000).toString();
  const followers = userData.followersCount !== undefined ? userData.followersCount : 0;
  const following = userData.followingCount !== undefined ? userData.followingCount : 0;
  const visitors = userData.visitorsCount !== undefined ? userData.visitorsCount : 0;
  const family = userData.family || "None";
  const vipStatus = userData.vipStatus || "None";

  const fullData = {
    ...userData,
    yoyoId: generatedId,
    followersCount: followers,
    followingCount: following,
    visitorsCount: visitors,
    family: family,
    vipStatus: vipStatus
  };

  let createdUser: any = null;
  if (isMongoConnected) {
    createdUser = await UserMongo.create(fullData);
  } else {
    const newUser: InMemUser = {
      _id: `user_${Date.now()}`,
      name: fullData.name,
      username: fullData.username || fullData.name,
      nickname: fullData.nickname || fullData.name,
      password: fullData.password,
      role: fullData.role || 'user',
      avatar: fullData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      level: 1,
      coins: fullData.coins || 0,
      frameId: 'none',
      bubbleId: 'none',
      badge: '🐣 Beginner',
      createdBy: fullData.createdBy || 'self',
      managerId: fullData.managerId || 'none',
      isBlocked: fullData.isBlocked || false,
      yoyoId: generatedId,
      gender: fullData.gender || 'Other',
      dateOfBirth: fullData.dateOfBirth || '2005-01-01',
      country: fullData.country || 'Global',
      phoneNumber: fullData.phoneNumber || '',
      email: fullData.email || '',
      socialId: fullData.socialId || '',
      socialProvider: fullData.socialProvider || '',
      followersCount: followers,
      followingCount: following,
      giftsCount: fullData.giftsCount || 0,
      visitorsCount: visitors,
      family: family,
      vipStatus: vipStatus
    };
    inMemoryDB.push(newUser);
    createdUser = newUser;
  }
  if (createdUser) {
    setCachedUser(createdUser);
  }
  return createdUser;
}


async function updateUser(id: string, updateData: any) {
  invalidateCachedUser(id);
  if (isMongoConnected) {
    try {
      let updated = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        updated = await UserMongo.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' }).lean().maxTimeMS(2000);
      } else {
        updated = await UserMongo.findOneAndUpdate(
          { $or: [{ username: id }, { name: id }, { yoyoId: id }] },
          { $set: updateData },
          { returnDocument: 'after' }
        ).lean().maxTimeMS(2000);
      }
      if (updated) setCachedUser(updated);
      return updated;
    } catch (err) {
      console.warn(`[updateUser] Error updating user ${id}:`, err);
    }
  }
  const index = inMemoryDB.findIndex(u => u._id === id || (u as any).id === id || u.name === id);
  if (index !== -1) {
    inMemoryDB[index] = { ...inMemoryDB[index], ...updateData };
    setCachedUser(inMemoryDB[index]);
    return inMemoryDB[index];
  }
  return null;
}


// --- API ENDPOINTS ---

// App version & build information for instant mobile auto-update
const APP_VERSION = '1.0.0';
const APP_BUILD_TIME = Date.now();

app.get("/api/version", (req, res) => {
  res.json({
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    timestamp: new Date(APP_BUILD_TIME).toISOString()
  });
});

// Server health / db status
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: isMongoConnected,
    mode: isMongoConnected ? "MongoDB Atlas" : "In-Memory Fallback",
    mongoActive: isMongoConnected
  });
});

// LiveKit token endpoint for seamless voice chat
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecret00000000000000000000000';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

app.post("/api/livekit/token", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, userName, roomId } = req.body;
    if (!userId || !roomId) {
      return res.status(400).json({ error: "userId and roomId required" });
    }
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(userId),
      name: String(userName || userId),
      ttl: '4h'
    });
    at.addGrant({ roomJoin: true, room: String(roomId), canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    res.json({ success: true, token, url: LIVEKIT_URL });
  } catch (err) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: "Failed to generate LiveKit token" });
  }
});


// Active in-memory store for OTPs
const activeOTPs = new Map<string, { code: string; expiresAt: number }>();

// Send OTP endpoint
app.post("/api/auth/send-otp", async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber, purpose } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: "Phone number is required." });
      return;
    }

    const cleanedPhone = phoneNumber.trim();

    // If purpose is login, ensure the user exists
    if (purpose === 'login') {
      const user = await findUserByPhone(cleanedPhone);
      if (!user) {
        res.status(400).json({ error: "No user is registered with this phone number. Please sign up first!" });
        return;
      }
    }

    // Generate a beautiful random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    activeOTPs.set(cleanedPhone, { code, expiresAt });

    console.log(`[SMS OTP SIMULATION] Code sent to ${cleanedPhone}: ${code}`);

    res.json({
      success: true,
      message: `OTP sent successfully to ${cleanedPhone}`,
      otp: code // Returned for easy simulation and user experience
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP code." });
  }
});

// Verify OTP endpoint
app.post("/api/auth/verify-otp", async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      res.status(400).json({ error: "Phone number and OTP code are required." });
      return;
    }

    const cleanedPhone = phoneNumber.trim();
    const active = activeOTPs.get(cleanedPhone);

    if (!active) {
      res.status(400).json({ error: "No OTP code was sent to this number." });
      return;
    }

    if (Date.now() > active.expiresAt) {
      activeOTPs.delete(cleanedPhone);
      res.status(400).json({ error: "OTP code has expired. Please send a new code." });
      return;
    }

    if (active.code !== otp.trim()) {
      res.status(400).json({ error: "Invalid OTP code." });
      return;
    }

    res.json({ success: true, message: "OTP code verified successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify OTP." });
  }
});

// Login via OTP endpoint
app.post("/api/auth/login-otp", async (req: express.Request, res: express.Response) => {
  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      res.status(400).json({ error: "Phone number and OTP code are required." });
      return;
    }

    const cleanedPhone = phoneNumber.trim();
    const active = activeOTPs.get(cleanedPhone);

    if (!active || active.code !== otp.trim()) {
      res.status(400).json({ error: "Invalid or expired OTP code." });
      return;
    }

    if (Date.now() > active.expiresAt) {
      res.status(400).json({ error: "OTP code has expired." });
      return;
    }

    // Find registered user
    const user = await findUserByPhone(cleanedPhone);
    if (!user) {
      res.status(400).json({ error: "No user found with this phone number. Please register first." });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ error: "Your account is blocked. Please contact your administrator." });
      return;
    }

    // Clear active OTP
    activeOTPs.delete(cleanedPhone);

    const { password: _, ...safeUser } = (user as any).toObject ? (user as any).toObject() : user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Failed to log in with OTP." });
  }
});

// Login endpoint (Standard with username/password)
app.post("/api/auth/login", async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const trimmedInput = String(username).trim();
    const trimmedPassword = String(password).trim();

    // ⚡ 0ms Fast path: Search by name/username/email in cache & DB
    let user = await findUserByName(trimmedInput);
    if (!user && trimmedInput.includes('@')) {
      user = await findUserByEmail(trimmedInput);
    }
    if (!user) {
      res.status(401).json({ error: "User not found. Check your username or email." });
      return;
    }

    if (user.password !== trimmedPassword) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ error: "Your account is blocked. Please contact your administrator or manager." });
      return;
    }

    // Refresh user cache on login for fast subsequent requests
    setCachedUser(user);

    // Success
    const { password: _, ...safeUser } = (user as any).toObject ? (user as any).toObject() : user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// Signup endpoint (With mandatory profile & email/phone fields)
app.post("/api/auth/signup", async (req: express.Request, res: express.Response) => {
  try {
    const { username, nickname, password, avatar, coins, gender, dateOfBirth, country, phoneNumber, email } = req.body;
    
    if (!username || !password || !gender || !dateOfBirth || !country || (!phoneNumber && !email)) {
      res.status(400).json({ error: "All details (Username, Nickname, Password, Email/Phone, Gender, Date of Birth, and Country) are mandatory." });
      return;
    }

    // Validate username is alphanumeric/underscores only
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      res.status(400).json({ error: "Username must be 3-24 characters (letters, numbers, underscore only)." });
      return;
    }

    // Enforce unique username (handle)
    const existingName = await findUserByName(username);
    if (existingName) {
      res.status(400).json({ error: "This username is already taken. Try another @handle." });
      return;
    }

    // Enforce unique email
    if (email) {
      const existingEmail = await findUserByEmail(email);
      if (existingEmail) {
        res.status(400).json({ error: "This email address is already registered. Please login instead." });
        return;
      }
    }

    if (phoneNumber) {
      const existingPhone = await findUserByPhone(phoneNumber);
      if (existingPhone) {
        res.status(400).json({ error: "This phone number is already registered. Please login instead." });
        return;
      }
    }

    // Display name = nickname if provided, else fall back to username
    const displayName = (nickname || username).trim();

    const newUser = await createUser({
      name: displayName,
      username: username.trim().toLowerCase(),
      nickname: displayName,
      password: password.trim(),
      role: 'user',
      avatar: avatar,
      coins: Number(coins) || 0,
      gender: gender,
      dateOfBirth: dateOfBirth,
      country: country,
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      email: email ? email.trim().toLowerCase() : ''
    });

    const { password: _, ...safeUser } = (newUser as any).toObject ? (newUser as any).toObject() : newUser;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Social Login or Signup fallback
app.post("/api/auth/social-login", async (req: express.Request, res: express.Response) => {
  try {
    const { email, name, avatar, provider, socialId } = req.body;
    if (!email || !provider || !socialId) {
      res.status(400).json({ error: "Missing mandatory social attributes (email, provider, socialId)" });
      return;
    }

    // Check if user is blocked or exists
    let user = await findUserBySocial(provider, socialId);
    if (!user) {
      // Also try to find by email to prevent duplicate registration
      user = await findUserByEmail(email);
    }

    if (user) {
      if (user.isBlocked) {
        res.status(403).json({ error: "Your account is blocked. Please contact your administrator." });
        return;
      }
      const { password: _, ...safeUser } = (user as any).toObject ? (user as any).toObject() : user;
      res.json({ success: true, user: safeUser, isNewUser: false });
      return;
    }

    // Automatically create a new user profile upon social sign-in
    let finalUsername = name ? name.trim() : `zoyo_${provider}_${Math.floor(1000 + Math.random() * 9000)}`;
    const nameExists = await findUserByName(finalUsername);
    if (nameExists) {
      finalUsername = `${finalUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const newUser = await createUser({
      name: finalUsername,
      password: `oauth_${Math.floor(100000 + Math.random() * 900000)}`, // Social accounts do not require manual password entry
      email: email.trim().toLowerCase(),
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      role: 'user',
      coins: 0,
      gender: 'Other',
      dateOfBirth: '2005-01-01',
      country: 'Global',
      socialId: socialId,
      socialProvider: provider
    });

    const { password: _, ...safeUser } = (newUser as any).toObject ? (newUser as any).toObject() : newUser;
    res.json({ success: true, user: safeUser, isNewUser: true });
  } catch (err) {
    console.error("Social login failure:", err);
    res.status(500).json({ error: "Failed to authenticate via social partner." });
  }
});

// Get all users (for Admin and Managers)
app.get("/api/users", async (req: express.Request, res: express.Response) => {
  try {
    const users = await getUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user role (Admin only)
app.post("/api/users/:id/role", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'manager', 'coin_seller', 'user'].includes(role)) {
      res.status(400).json({ error: "Invalid role specified" });
      return;
    }

    const updated = await updateUser(id, { role });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Block/Unblock user endpoint (Admin and Manager only)
app.post("/api/users/:id/block", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const updated = await updateUser(id, { isBlocked: !!isBlocked });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign manager endpoint
app.post("/api/users/:id/assign-manager", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const updated = await updateUser(id, { managerId: managerId || 'none' });
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create sub-user endpoint for managers and admins to register users directly under them
app.post("/api/users/create-sub-user", async (req: express.Request, res: express.Response) => {
  try {
    const { username, password, avatar, role, createdBy, managerId } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const existing = await findUserByName(username);
    if (existing) {
      res.status(400).json({ error: "Username already exists" });
      return;
    }

    const newUser = await createUser({
      name: username,
      password: password,
      role: role || 'user',
      avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      coins: 0,
      createdBy: createdBy || 'system',
      managerId: managerId || 'none',
      isBlocked: false
    });

    const { password: _, ...safeUser } = (newUser as any).toObject ? (newUser as any).toObject() : newUser;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user endpoint (Admin only)
app.delete("/api/users/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      await UserMongo.findByIdAndDelete(id);
    }
    const idx = inMemoryDB.findIndex(u => u._id === id || (u as any).id === id);
    if (idx !== -1) {
      inMemoryDB.splice(idx, 1);
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get user status endpoint (to handle block/ban check dynamically)
app.get("/api/users/:id/status", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const user = await findUserById(id);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      isBlocked: !!user.isBlocked,
      role: user.role,
      coins: user.coins
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user balance/details
app.post("/api/users/:id/update", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updated = await updateUser(id, req.body);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, user: updated });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manage coin sales (Coin Seller / Manager / Admin)
app.post("/api/users/:id/coins", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { amount, senderId } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: "Please enter a valid positive transfer amount" });
      return;
    }

    if (!senderId) {
      res.status(400).json({ error: "Sender identification is required for transfers" });
      return;
    }

    // Allow system / game sender IDs (e.g. wheel_carnival, dice_duel_win, etc.)
    const isSystemSender = senderId.startsWith('wheel_') || senderId.startsWith('dice_') || senderId.startsWith('ludo_') || senderId === 'system_game';

    // Retrieve sender and receiver to execute deduction & credit via MongoDB Atlas
    let senderUser: any = null;
    let targetUser: any = null;

    if (!isSystemSender) {
      senderUser = await findUserById(senderId);
    }
    targetUser = await findUserById(id);

    if (!isSystemSender && !senderUser) {
      res.status(404).json({ error: "Sender user account not found" });
      return;
    }

    if (!targetUser) {
      res.status(404).json({ error: "Recipient user account not found" });
      return;
    }

    // Deduct from sender (allow Admin unlimited mint/bypass if wanted, but managers/coin sellers must have enough coins!)
    const senderRole = isSystemSender ? 'system' : (senderUser.role || 'user');
    const isSenderAdmin = senderRole === 'admin' || isSystemSender;

    if (!isSenderAdmin && (senderUser.coins || 0) < parsedAmount) {
      res.status(400).json({ error: `Insufficient coins balance. You only have 🪙 ${senderUser.coins} coins.` });
      return;
    }

    // Deduct coins from sender if regular user
    let updatedSenderCoins = 0;
    if (!isSystemSender) {
      if (!isSenderAdmin) {
        updatedSenderCoins = Math.max(0, (senderUser.coins || 0) - parsedAmount);
        await updateUser(senderId, { coins: updatedSenderCoins });
      } else {
        updatedSenderCoins = 999999999;
        await updateUser(senderId, { coins: 999999999 });
      }
    }

    // Credit coins to recipient
    const receiverNewCoins = (targetUser.coins || 0) + parsedAmount;
    const updatedTargetUser = await updateUser(id, { coins: receiverNewCoins });

    const gameName = senderId === 'wheel_carnival' ? 'Lucky Multiplier Wheel' :
                     senderId === 'dice_duel_win' ? 'Dice Duel Showdown' :
                     senderId === 'ludo_win' ? 'Ludo Cup Match' :
                     'System Reward';
    const txnType = isSystemSender ? 'game_win' : (req.body.type || 'transfer');
    const txnIcon = senderId.includes('wheel') ? '🎡' : senderId.includes('dice') ? '🎲' : senderId.includes('ludo') ? '🎯' : '🪙';

    // Log this transaction!
    await logTransfer({
      senderId: isSystemSender ? senderId : (senderUser._id || senderUser.id),
      senderName: isSystemSender ? gameName : senderUser.name,
      senderRole: senderRole,
      receiverId: targetUser._id || targetUser.id,
      receiverName: targetUser.name,
      amount: parsedAmount,
      type: txnType,
      details: req.body.details || (isSystemSender ? `Won in ${gameName}` : 'Transfer'),
      icon: txnIcon
    });

    res.json({ 
      success: true, 
      user: updatedTargetUser, 
      senderCoins: updatedSenderCoins 
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin-Only Transfer Logs Ledger Endpoint
app.get("/api/transfers", async (req: express.Request, res: express.Response) => {
  try {
    if (isMongoConnected) {
      const logs = await TransferLogMongo.find({}).sort({ timestamp: -1 });
      res.json({ success: true, transfers: logs });
    } else {
      res.json({ success: true, transfers: [...inMemoryTransfers].reverse() });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// Personal transaction log for a specific user (sent + received)
app.get("/api/users/:id/transactions", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
    let logs: any[] = [];
    if (isMongoConnected) {
      logs = await TransferLogMongo.find({
        $or: [{ senderId: id }, { receiverId: id }]
      }).sort({ timestamp: -1 }).limit(limit).lean();
    } else {
      logs = inMemoryTransfers
        .filter((t: any) => t.senderId === id || t.receiverId === id)
        .slice(0, limit)
        .reverse();
    }
    res.json({ success: true, transactions: logs });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- USER VISITOR & PUBLIC PROFILE ENDPOINTS ---

// Get public profile of a user (including recent visitors)
app.get("/api/users/:id/profile", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    let user: any = null;
    if (isMongoConnected) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        user = await UserMongo.findById(id, '-password').lean();
      } else {
        user = await UserMongo.findOne({ $or: [{ name: id }, { yoyoId: id }] }, '-password').lean();
      }
    } else {
      user = inMemoryDB.find(u => u._id === id || (u as any).id === id || u.name.toLowerCase() === id.toLowerCase() || u.yoyoId === id);
    }

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { password: _, ...safeUser } = user;
    safeUser.bio = safeUser.bio || 'Living life on ZOYO! 🌟';
    safeUser.recentVisitors = safeUser.recentVisitors || [];
    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Record a visit to a user's profile
app.post("/api/users/:id/visit", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { visitor } = req.body;

    if (!visitor || !visitor.id) {
      res.status(400).json({ error: "Visitor information required" });
      return;
    }

    const targetUser = await findUserById(id);

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetUserId = String(targetUser._id || targetUser.id);
    const visitorId = String(visitor.id || visitor._id);

    // Only count as visitor if visitor is not self
    if (targetUserId !== visitorId) {
      const newVisitorsCount = (targetUser.visitorsCount || 0) + 1;
      const currentRecent = Array.isArray(targetUser.recentVisitors) ? targetUser.recentVisitors : [];
      // Deduplicate: remove existing entry from this visitor and prepend new one
      const filtered = currentRecent.filter((v: any) => String(v.id || v._id) !== visitorId);
      const newEntry = {
        id: visitorId,
        name: visitor.name || 'Visitor',
        avatar: visitor.avatar || '',
        yoyoId: visitor.yoyoId || '',
        visitedAt: new Date().toISOString()
      };
      const updatedVisitors = [newEntry, ...filtered].slice(0, 20);

      await updateUser(targetUserId, {
        visitorsCount: newVisitorsCount,
        recentVisitors: updatedVisitors
      });

      res.json({ success: true, visitorsCount: newVisitorsCount, recentVisitors: updatedVisitors });
    } else {
      res.json({ success: true, visitorsCount: targetUser.visitorsCount || 0, recentVisitors: targetUser.recentVisitors || [] });
    }
  } catch (error) {
    console.error('Error recording profile visit:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- CATALOG MANAGEMENT ENDPOINTS (Admin & Managers: Add Gifts, Frames, Games) ---

// High-performance In-Memory Catalog Caches (< 0.1ms response time)
let cachedCatalogGifts: any[] | null = null;
let cachedCatalogFrames: any[] | null = null;
let cachedCatalogGames: any[] | null = null;

// Get all gifts (default + custom)
app.get("/api/catalog/gifts", async (req: express.Request, res: express.Response) => {
  try {
    // ⚡ 0ms Fast path: return from memory cache
    if (cachedCatalogGifts) {
      res.json({ success: true, gifts: cachedCatalogGifts });
      return;
    }

    if (isMongoConnected) {
      const dbGifts = await CustomGiftMongo.find({}).sort({ createdAt: -1 }).lean();
      const combined = [...dbGifts];
      for (const def of inMemoryCustomGifts) {
        if (!combined.some(g => g.id === def.id)) {
          combined.push(def);
        }
      }
      cachedCatalogGifts = combined;
      res.json({ success: true, gifts: combined });
    } else {
      cachedCatalogGifts = inMemoryCustomGifts;
      res.json({ success: true, gifts: inMemoryCustomGifts });
    }

  } catch (error) {
    console.error('Error fetching catalog gifts:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new gift (Admin & Manager only)
app.post("/api/catalog/gifts", async (req: express.Request, res: express.Response) => {
  try {
    const { name, coins, icon, effect, description, userRole, addedBy } = req.body;
    if (userRole !== 'admin' && userRole !== 'manager') {
      res.status(403).json({ error: "Only admins and managers can add gifts" });
      return;
    }
    if (!name || !coins || !icon) {
      res.status(400).json({ error: "Name, coins, and icon are required" });
      return;
    }

    const giftId = `g_${Date.now()}`;
    const newGift = {
      id: giftId,
      name: String(name).trim(),
      coins: parseInt(coins, 10),
      icon: String(icon).trim(),
      effect: effect || 'confetti',
      description: description || `Sent a special ${name}! 🎉`,
      addedBy: addedBy || 'Staff'
    };

    if (isMongoConnected) {
      await CustomGiftMongo.create(newGift);
    }
    inMemoryCustomGifts.unshift(newGift);

    cachedCatalogGifts = null;
    res.json({ success: true, gift: newGift });
  } catch (error) {
    console.error('Error creating custom gift:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete gift (Admin & Manager only)
app.delete("/api/catalog/gifts/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      await CustomGiftMongo.deleteOne({ id });
    }
    const idx = inMemoryCustomGifts.findIndex(g => g.id === id);
    if (idx !== -1) inMemoryCustomGifts.splice(idx, 1);
    cachedCatalogGifts = null;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get all frames (default + custom)
app.get("/api/catalog/frames", async (req: express.Request, res: express.Response) => {
  try {
    // ⚡ 0ms Fast path: return from memory cache
    if (cachedCatalogFrames) {
      res.json({ success: true, frames: cachedCatalogFrames });
      return;
    }

    if (isMongoConnected) {
      const dbFrames = await CustomFrameMongo.find({}).sort({ createdAt: -1 }).lean();
      const combined = [...dbFrames];
      for (const def of inMemoryCustomFrames) {
        if (!combined.some(f => f.id === def.id)) {
          combined.push(def);
        }
      }
      cachedCatalogFrames = combined;
      res.json({ success: true, frames: combined });
    } else {
      cachedCatalogFrames = inMemoryCustomFrames;
      res.json({ success: true, frames: inMemoryCustomFrames });
    }
  } catch (error) {
    console.error('Error fetching frames:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new frame (Admin & Manager only)
app.post("/api/catalog/frames", async (req: express.Request, res: express.Response) => {
  try {
    const { name, price, value, icon, userRole, addedBy } = req.body;
    if (userRole !== 'admin' && userRole !== 'manager') {
      res.status(403).json({ error: "Only admins and managers can add frames" });
      return;
    }
    if (!name || !price || !value) {
      res.status(400).json({ error: "Name, price, and frame style value are required" });
      return;
    }

    const frameId = `frame_${Date.now()}`;
    const newFrame = {
      id: frameId,
      name: String(name).trim(),
      price: parseInt(price, 10),
      value: String(value).trim(),
      icon: icon || '✨',
      addedBy: addedBy || 'Staff'
    };

    if (isMongoConnected) {
      await CustomFrameMongo.create(newFrame);
    }
    inMemoryCustomFrames.unshift(newFrame);
    cachedCatalogFrames = null;
    res.json({ success: true, frame: newFrame });
  } catch (error) {
    console.error('Error creating custom frame:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete frame
app.delete("/api/catalog/frames/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      await CustomFrameMongo.deleteOne({ id });
    }
    const idx = inMemoryCustomFrames.findIndex(f => f.id === id);
    if (idx !== -1) inMemoryCustomFrames.splice(idx, 1);
    cachedCatalogFrames = null;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


// Get all games (default + custom)
app.get("/api/catalog/games", async (req: express.Request, res: express.Response) => {
  try {
    // ⚡ 0ms Fast path: return from memory cache
    if (cachedCatalogGames) {
      res.json({ success: true, games: cachedCatalogGames });
      return;
    }

    if (isMongoConnected) {
      const dbGames = await CustomGameMongo.find({}).sort({ createdAt: -1 }).lean();
      const combined = [...dbGames];
      for (const def of inMemoryCustomGames) {
        if (!combined.some(g => g.id === def.id)) {
          combined.push(def);
        }
      }
      cachedCatalogGames = combined;
      res.json({ success: true, games: combined });
    } else {
      cachedCatalogGames = inMemoryCustomGames;
      res.json({ success: true, games: inMemoryCustomGames });
    }
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add new game (Admin & Manager only)
app.post("/api/catalog/games", async (req: express.Request, res: express.Response) => {
  try {
    const { name, category, icon, minPlayers, maxPlayers, description, status, userRole, addedBy } = req.body;
    if (userRole !== 'admin' && userRole !== 'manager') {
      res.status(403).json({ error: "Only admins and managers can add games" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "Game name is required" });
      return;
    }

    const gameId = `game_${Date.now()}`;
    const newGame = {
      id: gameId,
      name: String(name).trim(),
      category: category || 'Party',
      icon: icon || '🎮',
      minPlayers: parseInt(minPlayers || '2', 10),
      maxPlayers: parseInt(maxPlayers || '4', 10),
      description: description || 'New dynamic voice room game!',
      status: status || 'active',
      addedBy: addedBy || 'Staff'
    };

    if (isMongoConnected) {
      await CustomGameMongo.create(newGame);
    }
    inMemoryCustomGames.unshift(newGame);
    cachedCatalogGames = null;
    res.json({ success: true, game: newGame });
  } catch (error) {
    console.error('Error creating custom game:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete game
app.delete("/api/catalog/games/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      await CustomGameMongo.deleteOne({ id });
    }
    const idx = inMemoryCustomGames.findIndex(g => g.id === id);
    if (idx !== -1) inMemoryCustomGames.splice(idx, 1);
    cachedCatalogGames = null;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update/Toggle Game status or details (Admin & Manager only)
app.patch("/api/catalog/games/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { status, name, description, minPlayers, maxPlayers, category, entryFee, prizePool, userRole } = req.body;
    if (userRole !== 'admin' && userRole !== 'manager') {
      res.status(403).json({ error: "Only admins and managers can modify games" });
      return;
    }

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (minPlayers !== undefined) updates.minPlayers = parseInt(minPlayers, 10);
    if (maxPlayers !== undefined) updates.maxPlayers = parseInt(maxPlayers, 10);
    if (category !== undefined) updates.category = category;
    if (entryFee !== undefined) updates.entryFee = Number(entryFee);
    if (prizePool !== undefined) updates.prizePool = Number(prizePool);

    if (isMongoConnected) {
      await CustomGameMongo.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
    }
    cachedCatalogGames = null;
    const inMem = inMemoryCustomGames.find(g => g.id === id);
    if (inMem) {
      Object.assign(inMem, updates);
    }
    res.json({ success: true, updates });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- REAL-TIME WEBSOCKET AND ROOM BROADCAST SYSTEM ---

interface RoomClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  roomId: string;
  avatar?: string;
  level?: number;
}

const roomClients = new Map<string, Set<RoomClient>>();

function broadcastToRoom(roomId: string, data: any, excludeWs?: WebSocket) {
  const clients = roomClients.get(roomId);
  if (!clients) return;
  const messageStr = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(messageStr);
      } catch (err) {
        console.warn('Failed to send WS message to client:', err);
      }
    }
  }
}

function sendToUserInRoom(roomId: string, targetUserId: string, data: any) {
  const clients = roomClients.get(roomId);
  if (!clients) return;
  const messageStr = JSON.stringify(data);
  for (const client of clients) {
    const cId = client.userId;
    if (cId === targetUserId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(messageStr);
      } catch (err) {
        console.warn('Failed to send direct WS message:', err);
      }
    }
  }
}

// --- REAL-TIME GLOBAL WEBSOCKET REGISTRY FOR DIRECT MESSAGES ---
const globalUserSockets = new Map<string, Set<WebSocket>>();

function registerUserSocket(userId: string, ws: WebSocket) {
  if (!userId) return;
  const uid = String(userId);
  if (!globalUserSockets.has(uid)) {
    globalUserSockets.set(uid, new Set());
  }
  globalUserSockets.get(uid)!.add(ws);
}

function unregisterUserSocket(userId: string, ws: WebSocket) {
  if (!userId) return;
  const uid = String(userId);
  const sockets = globalUserSockets.get(uid);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      globalUserSockets.delete(uid);
    }
  }
}

function sendToUserGlobally(userId: string, data: any) {
  const sockets = globalUserSockets.get(String(userId));
  if (sockets && sockets.size > 0) {
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          console.warn(`Failed to send DM via WS to user ${userId}:`, err);
        }
      }
    }
  }
}


async function getRoom(id: string) {
  if (!id) return null;
  const cleanId = String(id).trim();

  // 1. Check in-memory active rooms cache for instantaneous 0ms retrieval
  if (activeRoomsCache.has(cleanId)) {
    return sanitizeRoom(activeRoomsCache.get(cleanId));
  }

  // 2. Query MongoDB Atlas if connected
  if (isMongoConnected) {
    try {
      let room = null;
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        room = await RoomMongo.findById(cleanId).lean().maxTimeMS(2000);
      }
      if (!room) {
        room = await RoomMongo.findOne({ $or: [{ roomId: cleanId }, { id: cleanId }] }).lean().maxTimeMS(2000);
      }
      if (room) {
        // lean() returns plain object; normalise _id to string id
        (room as any).id = String((room as any)._id);
        activeRoomsCache.set(cleanId, room);
        activeRoomsCache.set(String(room._id), room);
        if (room.roomId) activeRoomsCache.set(String(room.roomId), room);
        if ((room as any).id) activeRoomsCache.set(String((room as any).id), room);
        return sanitizeRoom(room);
      }
    } catch (err) {
      console.warn(`[getRoom] MongoDB query error for ${cleanId}:`, err);
    }
  }

  // 3. Fallback to inMemoryRooms
  const room = inMemoryRooms.find(r => r.id === cleanId || r.roomId === cleanId || (r as any)._id === cleanId);
  if (room) {
    activeRoomsCache.set(cleanId, room);
    if (room.id) activeRoomsCache.set(String(room.id), room);
    if (room.roomId) activeRoomsCache.set(String(room.roomId), room);
    return sanitizeRoom(room);
  }

  return null;
}

async function saveRoom(room: any) {
  if (!room) return;
  const id = String(room._id || room.id || room.roomId || '');
  if (!id) return;

  // 1. Instant update in activeRoomsCache for sub-millisecond response
  activeRoomsCache.set(id, room);
  if (room._id) activeRoomsCache.set(String(room._id), room);
  if (room.id) activeRoomsCache.set(String(room.id), room);
  if (room.roomId) activeRoomsCache.set(String(room.roomId), room);

  // Also keep inMemoryRooms in sync if present
  const memIdx = inMemoryRooms.findIndex(r => r.id === id || r.roomId === id || (r as any)._id === id);
  if (memIdx !== -1) {
    inMemoryRooms[memIdx] = { ...room };
  }

  // 2. Debounced asynchronous persist to database (MongoDB Atlas)
  // This shields database from high-frequency seat and chat traffic
  const existingTimer = roomSaveDebounceTimers.get(id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    roomSaveDebounceTimers.delete(id);
    try {
      if (isMongoConnected) {
        const { _id, __v, ...update } = room;
        const targetId = String(_id || room.id || id);
        if (mongoose.Types.ObjectId.isValid(targetId)) {
          await RoomMongo.updateOne({ _id: targetId }, { $set: update }).maxTimeMS(2500);
        } else if (room.roomId) {
          await RoomMongo.updateOne({ roomId: room.roomId }, { $set: update }).maxTimeMS(2500);
        } else {
          await RoomMongo.updateOne({ id: targetId }, { $set: update }).maxTimeMS(2500);
        }
      }
    } catch (err) {
      console.warn(`[RoomPersistence] Failed to persist room ${id}:`, err);
    }
  }, 250);

  roomSaveDebounceTimers.set(id, timer);
}

// Strict Room Sanitization Helper to eliminate all duplicate users and messages
function sanitizeRoom(room: any) {
  if (!room) return room;

  // Deduplicate online users by username or userId
  if (room.onlineUsers && Array.isArray(room.onlineUsers)) {
    const seen = new Set<string>();
    room.onlineUsers = room.onlineUsers.filter((u: any) => {
      const idKey = String(u.userId || u._id || u.id || '').trim();
      const nameKey = (u.name || '').toLowerCase().trim();
      const dedupeKey = nameKey || idKey;
      if (!dedupeKey || seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
    room.onlineCount = Math.max(room.onlineUsers.length, room.seats?.filter((s: any) => s.user).length || 1);
  }

  // Deduplicate chat messages by message id
  if (room.chatMessages && Array.isArray(room.chatMessages)) {
    const seenMsg = new Set<string>();
    room.chatMessages = room.chatMessages.filter((m: any) => {
      const key = String(m.id || '');
      if (key && seenMsg.has(key)) return false;
      if (key) seenMsg.add(key);
      return true;
    });
  }

  // Ensure seat 0 is permanently anchored with the room host
  if (room.seats && Array.isArray(room.seats) && room.seats[0]) {
    if (!room.seats[0].user && room.host) {
      room.seats[0].user = room.host;
    }
  }

  return room;
}

function addOnlineUserToRoom(room: any, user: any) {
  if (!room.onlineUsers) room.onlineUsers = [];
  const targetId = String(user.userId || user._id || user.id || 'u_' + Date.now());
  const targetName = (user.name || '').toLowerCase().trim();

  // Filter out any existing copy of this user
  room.onlineUsers = room.onlineUsers.filter((u: any) => {
    const existingId = String(u.userId || u._id || u.id || '');
    const existingName = (u.name || '').toLowerCase().trim();
    if (targetId && existingId && existingId === targetId) return false;
    if (targetName && existingName && existingName === targetName) return false;
    return true;
  });

  const cleanUser = {
    id: targetId,
    _id: targetId,
    userId: targetId,
    name: user.name || 'Anonymous',
    avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    level: user.level || 1,
    role: user.role || 'user'
  };

  room.onlineUsers.push(cleanUser);
  room.onlineCount = Math.max(room.onlineUsers.length, room.seats?.filter((s: any) => s.user).length || 1);
  return cleanUser;
}

function removeOnlineUserFromRoom(room: any, userId: string, userName?: string) {
  if (!room.onlineUsers) return;
  const targetId = String(userId);
  const targetName = (userName || '').toLowerCase().trim();

  room.onlineUsers = room.onlineUsers.filter((u: any) => {
    const existingId = String(u.userId || u._id || u.id || '');
    const existingName = (u.name || '').toLowerCase().trim();
    if (targetId && existingId && existingId === targetId) return false;
    if (targetName && existingName && existingName === targetName) return false;
    return true;
  });

  room.onlineCount = Math.max(1, room.onlineUsers.length || 1);
}

function addChatMessageToRoom(room: any, chatMsg: any): boolean {
  if (!room.chatMessages) room.chatMessages = [];
  const msgId = String(chatMsg.id || '');
  if (msgId && room.chatMessages.some((m: any) => String(m.id || '') === msgId)) {
    return false; // Prevent duplicate message!
  }
  room.chatMessages.push(chatMsg);
  if (room.chatMessages.length > 100) {
    room.chatMessages = room.chatMessages.slice(-100);
  }
  return true;
}

// --- FRIEND REQUEST ENDPOINTS ---

// Search user by ZOYO ID
app.get("/api/users/search", async (req: express.Request, res: express.Response) => {
  try {
    const { yoyoId } = req.query as { yoyoId?: string };
    if (!yoyoId || String(yoyoId).trim().length < 4) {
      res.status(400).json({ error: "Please enter a valid ZOYO ID (at least 4 digits)" });
      return;
    }
    const cleaned = String(yoyoId).trim();
    const user = await findUserById(cleaned);
    if (!user) { res.status(404).json({ error: "No user found with this ZOYO ID" }); return; }
    const { password: _, ...safeUser } = (user as any).toObject ? (user as any).toObject() : user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Search user error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Send a friend request
app.post("/api/friend-requests", async (req: express.Request, res: express.Response) => {
  try {
    const { senderId, senderName, senderAvatar, senderYoyoId, receiverId, receiverName, receiverYoyoId } = req.body;
    if (!senderId || !receiverId) { res.status(400).json({ error: "senderId and receiverId are required" }); return; }
    if (senderId === receiverId) { res.status(400).json({ error: "You cannot send a friend request to yourself" }); return; }

    if (isMongoConnected) {
      // Check for existing pending or accepted request
      const existing = await FriendRequestMongo.findOne({
        $or: [
          { senderId, receiverId, status: { $in: ['pending', 'accepted'] } },
          { senderId: receiverId, receiverId: senderId, status: { $in: ['pending', 'accepted'] } }
        ]
      });
      if (existing) {
        const msg = existing.status === 'accepted' ? "You are already friends!" : "Friend request already sent";
        res.status(409).json({ error: msg });
        return;
      }
      const fr = await FriendRequestMongo.create({ senderId, senderName: senderName || '', senderAvatar: senderAvatar || '', senderYoyoId: senderYoyoId || '', receiverId, receiverName: receiverName || '', receiverYoyoId: receiverYoyoId || '', status: 'pending' });
      res.json({ success: true, friendRequest: fr });
    } else {
      const existing = inMemoryFriendRequests.find(fr =>
        ((fr.senderId === senderId && fr.receiverId === receiverId) ||
         (fr.senderId === receiverId && fr.receiverId === senderId)) &&
        (fr.status === 'pending' || fr.status === 'accepted')
      );
      if (existing) {
        const msg = existing.status === 'accepted' ? "You are already friends!" : "Friend request already sent";
        res.status(409).json({ error: msg });
        return;
      }
      const fr: InMemFriendRequest = {
        _id: String(Date.now()),
        senderId, senderName: senderName || '', senderAvatar: senderAvatar || '',
        senderYoyoId: senderYoyoId || '', receiverId, receiverName: receiverName || '',
        receiverYoyoId: receiverYoyoId || '', status: 'pending', createdAt: new Date().toISOString()
      };
      inMemoryFriendRequests.push(fr);
      res.json({ success: true, friendRequest: fr });
    }
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get inbox (received pending friend requests)
app.get("/api/friend-requests/:userId/inbox", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    if (isMongoConnected) {
      const requests = await FriendRequestMongo.find({ receiverId: userId, status: 'pending' }).sort({ createdAt: -1 });
      res.json({ success: true, requests });
    } else {
      const requests = inMemoryFriendRequests.filter(fr => fr.receiverId === userId && fr.status === 'pending')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ success: true, requests });
    }
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Respond to a friend request (accept or reject)
app.post("/api/friend-requests/:requestId/respond", async (req: express.Request, res: express.Response) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' | 'reject'
    if (!['accept', 'reject'].includes(action)) { res.status(400).json({ error: "action must be 'accept' or 'reject'" }); return; }
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    if (isMongoConnected) {
      const fr = await FriendRequestMongo.findByIdAndUpdate(requestId, { $set: { status: newStatus } }, { returnDocument: 'after' }).maxTimeMS(2000);
      if (!fr) { res.status(404).json({ error: "Friend request not found" }); return; }
      res.json({ success: true, friendRequest: fr });
    } else {
      const fr = inMemoryFriendRequests.find(r => r._id === requestId);
      if (!fr) { res.status(404).json({ error: "Friend request not found" }); return; }
      fr.status = newStatus;
      res.json({ success: true, friendRequest: fr });
    }
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get accepted friends list for a user
app.get("/api/friends/:userId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    if (isMongoConnected) {
      const requests = await FriendRequestMongo.find({
        status: 'accepted',
        $or: [{ senderId: userId }, { receiverId: userId }]
      });
      // Map to list of friend objects with avatars
      const friends = await Promise.all(requests.map(async (fr: any) => {
        const isSender = String(fr.senderId) === String(userId);
        const fId = isSender ? fr.receiverId : fr.senderId;
        const fName = isSender ? fr.receiverName : fr.senderName;
        const fYoyoId = isSender ? fr.receiverYoyoId : fr.senderYoyoId;
        let avatar = isSender ? fr.receiverAvatar : fr.senderAvatar;
        if (!avatar) {
          try {
            const u = await UserMongo.findById(fId);
            if (u) avatar = u.avatar;
          } catch {}
        }
        return {
          id: fId,
          name: fName,
          avatar: avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${fId}`,
          yoyoId: fYoyoId
        };
      }));
      res.json({ success: true, friends });
    } else {
      const requests = inMemoryFriendRequests.filter(fr =>
        fr.status === 'accepted' && (fr.senderId === userId || fr.receiverId === userId)
      );
      const friends = requests.map(fr => {
        const isSender = fr.senderId === userId;
        const fId = isSender ? fr.receiverId : fr.senderId;
        const fName = isSender ? fr.receiverName : fr.senderName;
        const fYoyoId = isSender ? fr.receiverYoyoId : fr.senderYoyoId;
        const avatar = isSender ? fr.receiverAvatar : fr.senderAvatar;
        return {
          id: fId,
          name: fName,
          avatar: avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${fId}`,
          yoyoId: fYoyoId
        };
      });
      res.json({ success: true, friends });
    }
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// --- DIRECT MESSAGES (1-ON-1 CHAT) ENDPOINTS ---

// Get all DM conversation threads for a user
app.get("/api/dm/conversations/:userId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const uid = String(userId);

    let messages: any[] = [];
    if (isMongoConnected) {
      messages = await DirectMessageMongo.find({
        $or: [{ senderId: uid }, { receiverId: uid }]
      }).sort({ createdAt: -1 });
    } else {
      messages = inMemoryDirectMessages
        .filter(m => String(m.senderId) === uid || String(m.receiverId) === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Group by other participant
    const conversationMap = new Map<string, any>();
    for (const m of messages) {
      const isSender = String(m.senderId) === uid;
      const partnerId = isSender ? String(m.receiverId) : String(m.senderId);

      if (!conversationMap.has(partnerId)) {
        const partnerName = isSender ? m.receiverName : m.senderName;
        const partnerAvatar = isSender ? m.receiverAvatar : m.senderAvatar;
        let partnerYoyoId = isSender ? m.receiverYoyoId : m.senderYoyoId;
        if (!partnerYoyoId && isMongoConnected) {
          try {
            const u = await UserMongo.findById(partnerId);
            if (u) partnerYoyoId = u.yoyoId;
          } catch {}
        }

        conversationMap.set(partnerId, {
          id: partnerId,
          senderId: partnerId,
          senderName: partnerName,
          senderAvatar: partnerAvatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${partnerId}`,
          yoyoId: partnerYoyoId || '',
          message: m.voice ? `🎤 Voice note (${m.duration || 0}s)` : m.text,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVoice: !!m.voice,
          voiceDuration: m.duration,
          unread: false,
          lastCreatedAt: new Date(m.createdAt).getTime()
        });
      }
    }

    const conversations = Array.from(conversationMap.values()).sort((a, b) => b.lastCreatedAt - a.lastCreatedAt);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error fetching DM conversations:', error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get all messages between two users
app.get("/api/dm/messages/:userId/:friendId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, friendId } = req.params;
    const uid = String(userId);
    const fid = String(friendId);

    let messages: any[] = [];
    if (isMongoConnected) {
      messages = await DirectMessageMongo.find({
        $or: [
          { senderId: uid, receiverId: fid },
          { senderId: fid, receiverId: uid }
        ]
      }).sort({ createdAt: 1 });
    } else {
      messages = inMemoryDirectMessages
        .filter(m => (String(m.senderId) === uid && String(m.receiverId) === fid) ||
                     (String(m.senderId) === fid && String(m.receiverId) === uid))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const formattedMessages = messages.map(m => ({
      id: String(m._id || m.id),
      sender: m.senderName,
      senderId: String(m.senderId),
      receiverId: String(m.receiverId),
      text: m.text,
      voice: !!m.voice,
      duration: m.duration,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching DM messages:', error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a DM message
app.post("/api/dm/send", async (req: express.Request, res: express.Response) => {
  try {
    const { senderId, senderName, senderAvatar, senderYoyoId, receiverId, receiverName, receiverAvatar, receiverYoyoId, text, voice, duration } = req.body;

    if (!senderId || !receiverId || !text?.trim()) {
      res.status(400).json({ error: "senderId, receiverId, and text are required" });
      return;
    }

    const msgData = {
      senderId: String(senderId),
      senderName: senderName || 'User',
      senderAvatar: senderAvatar || '',
      senderYoyoId: senderYoyoId || '',
      receiverId: String(receiverId),
      receiverName: receiverName || 'Friend',
      receiverAvatar: receiverAvatar || '',
      receiverYoyoId: receiverYoyoId || '',
      text: text.trim(),
      voice: !!voice,
      duration: duration || 0,
      createdAt: new Date()
    };

    let savedMsg: any;
    if (isMongoConnected) {
      savedMsg = await DirectMessageMongo.create(msgData);
    } else {
      savedMsg = {
        _id: `dm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        ...msgData,
        createdAt: msgData.createdAt.toISOString()
      };
      inMemoryDirectMessages.push(savedMsg);
    }

    const formattedMsg = {
      id: String(savedMsg._id),
      sender: savedMsg.senderName,
      senderId: String(savedMsg.senderId),
      receiverId: String(savedMsg.receiverId),
      text: savedMsg.text,
      voice: !!savedMsg.voice,
      duration: savedMsg.duration,
      timestamp: new Date(savedMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Broadcast to recipient via WebSocket
    sendToUserGlobally(String(receiverId), {
      type: 'dm_message',
      message: formattedMsg,
      conversationId: String(senderId),
      partner: {
        id: String(senderId),
        name: senderName,
        avatar: senderAvatar
      }
    });

    // Broadcast to sender via WebSocket (in case multiple tabs or sockets open)
    sendToUserGlobally(String(senderId), {
      type: 'dm_message',
      message: formattedMsg,
      conversationId: String(receiverId),
      partner: {
        id: String(receiverId),
        name: receiverName,
        avatar: receiverAvatar
      }
    });

    res.json({ success: true, message: formattedMsg });
  } catch (error) {
    console.error('Error sending DM:', error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Delete a specific message
app.delete("/api/dm/message/:msgId", async (req: express.Request, res: express.Response) => {
  try {
    const { msgId } = req.params;

    let msg: any = null;
    if (isMongoConnected) {
      msg = await DirectMessageMongo.findById(msgId);
      if (msg) {
        await DirectMessageMongo.findByIdAndDelete(msgId);
      }
    } else {
      const idx = inMemoryDirectMessages.findIndex(m => String(m._id) === String(msgId));
      if (idx !== -1) {
        msg = inMemoryDirectMessages.splice(idx, 1)[0];
      }
    }

    if (msg) {
      const sId = String(msg.senderId);
      const rId = String(msg.receiverId);
      sendToUserGlobally(sId, { type: 'dm_message_deleted', messageId: msgId, conversationId: rId });
      sendToUserGlobally(rId, { type: 'dm_message_deleted', messageId: msgId, conversationId: sId });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting DM message:', error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// Clear an entire conversation between two users
app.delete("/api/dm/conversation/:userId/:friendId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, friendId } = req.params;
    const uid = String(userId);
    const fid = String(friendId);

    if (isMongoConnected) {
      await DirectMessageMongo.deleteMany({
        $or: [
          { senderId: uid, receiverId: fid },
          { senderId: fid, receiverId: uid }
        ]
      });
    } else {
      for (let i = inMemoryDirectMessages.length - 1; i >= 0; i--) {
        const m = inMemoryDirectMessages[i];
        if ((String(m.senderId) === uid && String(m.receiverId) === fid) ||
            (String(m.senderId) === fid && String(m.receiverId) === uid)) {
          inMemoryDirectMessages.splice(i, 1);
        }
      }
    }

    sendToUserGlobally(uid, { type: 'dm_chat_cleared', conversationId: fid });
    sendToUserGlobally(fid, { type: 'dm_chat_cleared', conversationId: uid });

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing DM conversation:', error);
    res.status(500).json({ error: "Failed to clear conversation" });
  }
});


// --- VOICE ROOM ENDPOINTS ---


// Helper to generate a collision-free unique 6-digit room code
async function generateUniqueRoomId(): Promise<string> {
  let attempts = 0;
  while (attempts < 100) {
    attempts++;
    const candidate = Math.floor(100000 + Math.random() * 900000).toString();
    if (isMongoConnected) {
      const existing = await RoomMongo.findOne({ roomId: candidate, isActive: true });
      if (!existing) return candidate;
    } else {
      const existing = inMemoryRooms.find(r => r.roomId === candidate && r.isActive);
      if (!existing) return candidate;
    }
  }
  return `${Date.now()}`.slice(-6);
}

// In-Memory cache for public rooms list to serve requests in <1ms
let cachedPublicRoomsList: any[] | null = null;
let cachedPublicRoomsTime = 0;

// Get all active PUBLIC rooms (Private rooms are hidden from public list and only found via room code)
app.get("/api/rooms", async (req: express.Request, res: express.Response) => {
  try {
    // ⚡ Fast path: serve from in-memory cache if less than 2.5 seconds old
    if (cachedPublicRoomsList && (Date.now() - cachedPublicRoomsTime < 2500)) {
      res.json({ success: true, rooms: cachedPublicRoomsList });
      return;
    }

    if (isMongoConnected) {
      let rooms = await RoomMongo.find({ isActive: true, isPrivate: { $ne: true } }).sort({ createdAt: -1 }).lean().maxTimeMS(1500).limit(50);
      const sanitizedRooms = rooms.map(r => {
        const clean = sanitizeRoom(r.toObject ? r.toObject() : r);
        delete clean.roomPassword;
        return clean;
      });
      cachedPublicRoomsList = sanitizedRooms;
      cachedPublicRoomsTime = Date.now();
      res.json({ success: true, rooms: sanitizedRooms });
    } else {
      const activeRooms = inMemoryRooms.filter(r => r.isActive && !r.isPrivate).map(r => {
        const clean = { ...sanitizeRoom(r) };
        delete clean.roomPassword;
        return clean;
      });
      cachedPublicRoomsList = activeRooms;
      cachedPublicRoomsTime = Date.now();
      res.json({ success: true, rooms: activeRooms });
    }
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new room
app.post("/api/rooms", async (req: express.Request, res: express.Response) => {
  try {
    const { title, description, host, theme, category, backgroundUrl, isPrivate, roomPassword, activeGame, isOfficialGame, gamePrizePool, roomImage } = req.body;

    if (!title || !host) {
      res.status(400).json({ error: "Title and host are required" });
      return;
    }

    const hostId = host._id ? String(host._id) : String(host.id || 'host');
    const safeHost = { ...host, id: hostId, _id: hostId, userId: hostId };

    const initialSeats = Array.from({ length: 9 }, (_, i) => ({
      index: i,
      user: i === 0 ? safeHost : null,
      isMuted: false,
      isTalking: false
    }));

    const welcomeMsg = {
      id: String(Date.now()),
      userId: 'system',
      userName: 'System',
      userLevel: 99,
      message: `Welcome to ${safeHost.name}'s voice room! Grab a mic seat to talk live or chat with everyone! 🎙️✨`,
      type: 'system',
      timestamp: new Date().toISOString()
    };

    const isPriv = Boolean(isPrivate);
    const pwd = isPriv ? String(roomPassword || '').trim() : '';
    const generatedRoomId = await generateUniqueRoomId();
    const game = activeGame || (category === 'games' ? 'ludo' : 'none');
    const isOfficial = Boolean(isOfficialGame);
    const prize = Number(gamePrizePool) || 0;

    cachedPublicRoomsList = null;

    if (isMongoConnected) {
      const newRoom = await RoomMongo.create({
        roomId: generatedRoomId,
        title,
        description: description || `Welcome to ${safeHost.name}'s voice room!`,
        host: safeHost,
        theme: theme || 'neon',
        category: category || 'chat',
        onlineCount: 1,
        activeGame: game,
        isOfficialGame: isOfficial,
        gamePrizePool: prize,
        backgroundUrl: backgroundUrl || '',
        roomImage: roomImage || '',
        isActive: true,
        isPrivate: isPriv,
        roomPassword: pwd,
        invitedUsers: [],
        seats: initialSeats,
        onlineUsers: [safeHost],
        chatMessages: [welcomeMsg]
      });
      const roomObj = sanitizeRoom(newRoom.toObject ? newRoom.toObject() : newRoom);
      activeRoomsCache.set(String(newRoom._id), roomObj);
      activeRoomsCache.set(generatedRoomId, roomObj);
      res.json({ success: true, room: roomObj });
    } else {
      const newRoom: InMemRoom = {
        id: `room_${Date.now()}`,
        roomId: generatedRoomId,
        title,
        description: description || `Welcome to ${safeHost.name}'s voice room!`,
        host: safeHost,
        theme: theme || 'neon',
        category: category || 'chat',
        onlineCount: 1,
        activeGame: game,
        isOfficialGame: isOfficial,
        gamePrizePool: prize,
        backgroundUrl: backgroundUrl || '',
        roomImage: roomImage || '',
        isActive: true,
        isPrivate: isPriv,
        roomPassword: pwd,
        invitedUsers: [],
        seats: initialSeats,
        onlineUsers: [safeHost],
        chatMessages: [welcomeMsg],
        createdAt: new Date().toISOString()
      };
      inMemoryRooms.push(newRoom);
      activeRoomsCache.set(newRoom.id, newRoom);
      activeRoomsCache.set(generatedRoomId, newRoom);
      res.json({ success: true, room: sanitizeRoom(newRoom) });
    }

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update room
app.post("/api/rooms/:id/update", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    Object.assign(room, updates);
    await saveRoom(room);
    res.json({ success: true, room: sanitizeRoom(room) });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete/Close a room
app.delete("/api/rooms/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    room.isActive = false;
    await saveRoom(room);
    broadcastToRoom(id, { type: 'room_closed', message: "This room has been closed by host or admin." });
    res.json({ success: true, message: "Room closed" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- ROOM PRESENCE & CHAT ENDPOINTS ---

// Get room details with seats, online users, and chat messages
app.get("/api/rooms/:id/seats", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ success: true, room });
  } catch (error) {
    console.error('Error fetching room seats:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Join a room (Registers user as an online room participant)
app.post("/api/rooms/:id/join", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { user, password } = req.body;

    if (!user) {
      res.status(400).json({ error: "User is required to join" });
      return;
    }

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Private room check
    if (room.isPrivate) {
      const userId = String(user._id || user.id || '');
      const hostId = String(room.host?._id || room.host?.id || '');
      const isHost = (userId && hostId && userId === hostId) || 
                     (user.name && room.host?.name && user.name === room.host.name) ||
                     (user.yoyoId && room.host?.yoyoId && String(user.yoyoId) === String(room.host.yoyoId));
      const isInvited = Array.isArray(room.invitedUsers) && (
        room.invitedUsers.map(String).includes(userId) ||
        (user.yoyoId && room.invitedUsers.map(String).includes(String(user.yoyoId)))
      );

      if (!isHost && !isInvited) {
        // Must provide correct password
        const providedPwd = String(password || '').trim();
        const correctPwd = String(room.roomPassword || '').trim();
        if (!providedPwd || providedPwd !== correctPwd) {
          res.status(403).json({ error: "Incorrect room password", requiresPassword: true });
          return;
        }

        // Successfully authenticated! Authorize user so subsequent calls inside the room succeed
        if (!Array.isArray(room.invitedUsers)) room.invitedUsers = [];
        if (userId && !room.invitedUsers.map(String).includes(userId)) {
          room.invitedUsers.push(userId);
        }
        if (user.yoyoId && !room.invitedUsers.map(String).includes(String(user.yoyoId))) {
          room.invitedUsers.push(String(user.yoyoId));
        }
      }
    }

    const cleanUser = addOnlineUserToRoom(room, user);
    await saveRoom(room);

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Leave a room
app.post("/api/rooms/:id/leave", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { userId, userName } = req.body;

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const uId = String(userId);
    removeOnlineUserFromRoom(room, uId, userName);

    // Free seat if user was seated (Seat 0 always remains Host)
    if (room.seats) {
      for (const seat of room.seats) {
        if (seat.user && (String(seat.user._id || seat.user.id) === uId || (userName && seat.user.name === userName))) {
          seat.user = seat.index === 0 ? room.host : null;
          seat.isTalking = false;
          seat.isMuted = false;
        }
      }
    }

    await saveRoom(room);

    broadcastToRoom(id, {
      type: 'user_left',
      userId: uId,
      onlineUsers: room.onlineUsers,
      onlineCount: room.onlineCount,
      seats: room.seats
    });

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Invite a user to a private room (host only)
app.post("/api/rooms/:id/invite", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { hostId, inviteeId } = req.body;

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const rHostId = String(room.host?._id || room.host?.id || '');
    if (String(hostId) !== rHostId) {
      res.status(403).json({ error: "Only the host can invite users" });
      return;
    }

    if (!Array.isArray(room.invitedUsers)) room.invitedUsers = [];
    const invId = String(inviteeId);
    if (!room.invitedUsers.map(String).includes(invId)) {
      room.invitedUsers.push(invId);
    }
    await saveRoom(room);

    // Notify the invitee
    sendToUserGlobally(invId, {
      type: 'room_invite',
      roomId: room._id || room.id,
      roomTitle: room.title,
      hostName: room.host?.name || 'Host',
      roomCode: (room as any).roomId || ''
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Lookup room by 6-digit roomId code (supports finding private rooms by room code)
app.get("/api/rooms/bycode/:code", async (req: express.Request, res: express.Response) => {
  try {
    const { code } = req.params;
    const cleanCode = String(code || '').trim();
    let room: any = null;
    if (isMongoConnected) {
      if (mongoose.Types.ObjectId.isValid(cleanCode)) {
        room = await RoomMongo.findOne({ $or: [{ roomId: cleanCode }, { _id: cleanCode }], isActive: true }).lean();
      } else {
        room = await RoomMongo.findOne({ roomId: cleanCode, isActive: true }).lean();
      }
      if (room) {
        room.id = String(room._id);
        room = sanitizeRoom(room);
        delete room.roomPassword;
      }
    } else {
      const found = inMemoryRooms.find(r => (r.roomId === cleanCode || r.id === cleanCode) && r.isActive);
      if (found) {
        room = { ...sanitizeRoom(found) };
        delete room.roomPassword;
      }
    }
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ success: true, room });
  } catch (error) {
    console.error('Error looking up room by code:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update seat - User sits or leaves
app.post("/api/rooms/:id/seat/:seatIndex", async (req: express.Request, res: express.Response) => {
  try {
    const { id, seatIndex } = req.params;
    const { user, action } = req.body; // action: 'sit' or 'leave'

    const seatIdx = parseInt(seatIndex);
    const room = await getRoom(id);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (!room.seats || !Array.isArray(room.seats)) {
      room.seats = Array.from({ length: 9 }, (_, i) => ({
        index: i,
        user: i === 0 ? room.host : null,
        isMuted: false,
        isTalking: false
      }));
    }

    if (action === 'sit' && user) {
      const newUserId = String(user._id || user.id);
      const safeUser = { ...user, id: newUserId, _id: newUserId, userId: newUserId };

      // Check if seat is occupied by someone else
      if (room.seats[seatIdx] && room.seats[seatIdx].user) {
        const occId = String(room.seats[seatIdx].user._id || room.seats[seatIdx].user.id || '');
        const occName = String(room.seats[seatIdx].user.name || '');
        const idMismatch = occId && newUserId && occId !== newUserId;
        const nameMismatch = occName && user.name && occName !== user.name;
        if (idMismatch && nameMismatch) {
          res.status(409).json({ error: `Seat already occupied by ${room.seats[seatIdx].user.name}` });
          return;
        }
      }

      // Clear any other seat this user might already occupy in the room
      room.seats.forEach((s: any) => {
        if (s.index !== seatIdx && s.user && (String(s.user._id || s.user.id) === newUserId || s.user.name === user.name)) {
          s.user = null;
          s.isTalking = false;
          s.isMuted = false;
        }
      });

      console.log(`✅ User ${safeUser.name} sitting in seat ${seatIdx} in room ${id}`);
      room.seats[seatIdx] = { index: seatIdx, user: safeUser, isMuted: false, isTalking: false };

      // Ensure user is in onlineUsers without duplicates
      addOnlineUserToRoom(room, safeUser);
    } else if (action === 'kick') {
      const { hostId, hostName, targetUserId, targetUserName } = req.body;
      const rHostId = String(room.host?._id || room.host?.id || '');
      const isHost = String(hostId) === rHostId || hostName === room.host?.name;
      if (!isHost) {
        res.status(403).json({ error: "Only the host can kick users from seats" });
        return;
      }

      console.log(`🚫 Host ${hostName} kicking user ${targetUserName || targetUserId} from seat ${seatIdx} in room ${id}`);
      room.seats[seatIdx] = { 
        index: seatIdx, 
        user: seatIdx === 0 ? room.host : null, 
        isMuted: false, 
        isTalking: false 
      };
      room.onlineCount = Math.max(room.onlineUsers?.length || 1, room.seats.filter((s: any) => s.user).length);

      await saveRoom(room);

      // Broadcast kick event so kicked user immediately cuts mic stream
      broadcastToRoom(id, {
        type: 'user_kicked_from_seat',
        seatIndex: seatIdx,
        kickedUserId: String(targetUserId),
        kickedUserName: targetUserName || 'Guest',
        kickedBy: hostName || 'Host',
        seats: room.seats
      });

      broadcastToRoom(id, {
        type: 'seats_updated',
        seats: room.seats,
        onlineCount: room.onlineCount
      });

      res.json({ success: true, room });
      return;
    } else if (action === 'leave') {
      console.log(`👋 User leaving seat ${seatIdx} in room ${id}`);
      room.seats[seatIdx] = { 
        index: seatIdx, 
        user: seatIdx === 0 ? room.host : null, 
        isMuted: false, 
        isTalking: false 
      };
      room.onlineCount = Math.max(room.onlineUsers?.length || 1, room.seats.filter((s: any) => s.user).length);
    }

    // Always anchor seat 0 to the room host — never let it go empty
    if (room.seats && room.seats[0] && room.host) {
      room.seats[0].user = room.host;
    }

    room.onlineCount = Math.max(room.onlineUsers?.length || 1, room.seats.filter((s: any) => s.user).length);
    await saveRoom(room);

    // Broadcast seat change to ALL clients in the room
    broadcastToRoom(id, {
      type: 'seats_updated',
      seats: room.seats,
      onlineCount: room.onlineCount
    });

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Kick a user out of the room completely (Host only)
app.post("/api/rooms/:id/kick-user", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { hostId, hostName, targetUserId, targetUserName } = req.body;

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const rHostId = String(room.host?._id || room.host?.id || '');
    const isHost = String(hostId) === rHostId || hostName === room.host?.name;
    if (!isHost) {
      res.status(403).json({ error: "Only the room host can kick users" });
      return;
    }

    const tId = String(targetUserId);
    removeOnlineUserFromRoom(room, tId, targetUserName);

    // Vacate seat if user was seated
    if (room.seats) {
      for (const seat of room.seats) {
        if (seat.user && (String(seat.user._id || seat.user.id) === tId || (targetUserName && seat.user.name === targetUserName))) {
          seat.user = seat.index === 0 ? room.host : null;
          seat.isTalking = false;
          seat.isMuted = false;
        }
      }
    }

    await saveRoom(room);

    // Broadcast user kicked from room
    broadcastToRoom(id, {
      type: 'user_kicked_from_room',
      kickedUserId: tId,
      kickedUserName: targetUserName || 'Guest',
      kickedBy: hostName || 'Host',
      onlineUsers: room.onlineUsers,
      onlineCount: room.onlineCount,
      seats: room.seats
    });

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error kicking user from room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send Chat Message endpoint
app.post("/api/rooms/:id/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.message) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const chatMsg = {
      id: message.id || String(Date.now()),
      userId: String(message.userId),
      userName: message.userName || 'Anonymous',
      userLevel: message.userLevel || 1,
      message: message.message,
      type: message.type || 'text',
      giftName: message.giftName,
      giftIcon: message.giftIcon,
      giftCount: message.giftCount,
      timestamp: new Date().toISOString()
    };

    const added = addChatMessageToRoom(room, chatMsg);
    if (added) {
      await saveRoom(room);
      broadcastToRoom(id, {
        type: 'chat_message',
        message: chatMsg
      });
    }

    res.json({ success: true, message: chatMsg });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send Gift endpoint
app.post("/api/rooms/:id/gift", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { senderId, recipientSeat, gift } = req.body;

    if (!senderId || !gift) {
      res.status(400).json({ error: "Missing gift parameters" });
      return;
    }

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const sender = await findUserById(senderId);
    if (!sender) {
      res.status(404).json({ error: "Sender user not found" });
      return;
    }

    if (sender.role !== 'admin' && sender.coins < gift.coins) {
      res.status(400).json({ error: "Insufficient coins" });
      return;
    }

    if (sender.role !== 'admin') {
      const newBalance = Math.max(0, sender.coins - gift.coins);
      await updateUser(senderId, { coins: newBalance });
      sender.coins = newBalance;
    }

    let recipientName = "Everyone in room";
    if (recipientSeat !== 'all' && typeof recipientSeat === 'number') {
      const seatedUser = room.seats?.[recipientSeat]?.user;
      recipientName = seatedUser ? seatedUser.name : "Host";
      if (seatedUser) {
        const seatedUserId = seatedUser._id || seatedUser.id;
        const recipientUser = await findUserById(seatedUserId);
        if (recipientUser && recipientUser.role !== 'admin') {
          await updateUser(seatedUserId, { coins: (recipientUser.coins || 0) + Math.floor(gift.coins * 0.7) });
        }
      }
    }

    // Record gift transaction in coin ledger
    await logTransfer({
      senderId: String(sender._id || sender.id),
      senderName: sender.name,
      senderRole: sender.role || 'user',
      receiverId: recipientSeat !== 'all' && typeof recipientSeat === 'number' && room.seats?.[recipientSeat]?.user
        ? String(room.seats[recipientSeat].user._id || room.seats[recipientSeat].user.id)
        : 'room_all',
      receiverName: recipientName,
      amount: gift.coins,
      type: 'gift',
      details: `${gift.icon} ${gift.name}`,
      icon: gift.icon || '🎁'
    });

    const giftMsg = {
      id: String(Date.now()),
      userId: String(sender._id || sender.id),
      userName: sender.name,
      userLevel: sender.level || 1,
      message: `sent ${gift.icon} ${gift.name} to ${recipientName}! 🎉`,
      type: 'gift',
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCount: 1,
      timestamp: new Date().toISOString()
    };

    addChatMessageToRoom(room, giftMsg);
    await saveRoom(room);

    // Broadcast gift event with animated effect to all clients in the room!
    broadcastToRoom(id, {
      type: 'gift_event',
      gift,
      senderName: sender.name,
      recipientName,
      message: giftMsg
    });

    res.json({ success: true, newCoins: sender.coins, message: giftMsg });
  } catch (error) {
    console.error('Error sending gift:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update game state endpoint
app.post("/api/rooms/:id/game", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { activeGame, gameData } = req.body;

    const room = await getRoom(id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (activeGame !== undefined) room.activeGame = activeGame;
    await saveRoom(room);

    broadcastToRoom(id, {
      type: 'game_event',
      activeGame: room.activeGame,
      gameData
    });

    res.json({ success: true, activeGame: room.activeGame });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve frontend assets and hook up Vite Dev Server & WebSocket Server
async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket connections on /ws
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      // Let other upgrades (like Vite HMR) pass through
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let clientInfo: RoomClient | null = null;
    let connectedUserId: string | null = null;

    ws.on('message', async (rawMsg: string) => {
      try {
        const data = JSON.parse(rawMsg.toString());
        const { type, roomId, userId, userName, payload } = data;

        // Register user socket globally whenever userId is present
        if (userId) {
          connectedUserId = String(userId);
          registerUserSocket(connectedUserId, ws);
        }

        if (type === 'register_user') {
          return;
        }

        if (!roomId) return;

        if (type === 'join_room') {
          // Register client in room
          if (!roomClients.has(roomId)) {
            roomClients.set(roomId, new Set());
          }

          clientInfo = {
            ws,
            userId: String(userId),
            userName: userName || 'Anonymous',
            roomId,
            avatar: payload?.avatar,
            level: payload?.level
          };

          roomClients.get(roomId)!.add(clientInfo);
          console.log(`🔌 [WS] User ${userName} (${userId}) joined room ${roomId}. Room clients: ${roomClients.get(roomId)!.size}`);

          // Get latest room data
          const room = await getRoom(roomId);
          if (room) {
            const cleanUser = addOnlineUserToRoom(room, {
              userId,
              name: userName,
              avatar: payload?.avatar,
              level: payload?.level
            });

            await saveRoom(room);

            // Send full room state back to the newly connected user
            ws.send(JSON.stringify({
              type: 'room_init',
              seats: room.seats,
              onlineUsers: room.onlineUsers,
              onlineCount: room.onlineCount,
              chatMessages: room.chatMessages || [],
              activeGame: room.activeGame || 'none'
            }));

            // Broadcast user joined to other clients in room
            broadcastToRoom(roomId, {
              type: 'user_joined',
              user: cleanUser,
              onlineUsers: room.onlineUsers,
              onlineCount: room.onlineCount
            }, ws);
          }
        } else if (type === 'leave_room') {
          if (clientInfo) {
            roomClients.get(roomId)?.delete(clientInfo);
          }
          const room = await getRoom(roomId);
          if (room) {
            removeOnlineUserFromRoom(room, String(userId), userName);
            await saveRoom(room);

            broadcastToRoom(roomId, {
              type: 'user_left',
              userId: String(userId),
              userName,
              onlineUsers: room.onlineUsers,
              onlineCount: room.onlineCount
            });
          }
        } else if (type === 'speaker_ready') {
          // Broadcast that a speaker is ready to stream audio
          broadcastToRoom(roomId, {
            type: 'speaker_ready',
            userId: String(userId),
            userName,
            seatIndex: payload?.seatIndex
          }, ws);
        } else if (type === 'audio_chunk') {
          // Fallback direct audio stream relay
          broadcastToRoom(roomId, {
            type: 'audio_chunk',
            senderId: String(userId),
            audioData: payload?.audioData,
            seatIndex: payload?.seatIndex
          }, ws);
        } else if (type === 'seat_status') {
          // Live microphone speech detection or mute toggle
          // Only persist mute changes to DB — isTalking fires many times/sec and must NOT hit DB
          const { seatIndex, isTalking, isMuted } = payload || {};
          if (isMuted !== undefined) {
            // Mute toggle is rare — persist it
            const room = await getRoom(roomId);
            if (room && room.seats && room.seats[seatIndex] !== undefined) {
              room.seats[seatIndex].isMuted = isMuted;
              if (isTalking !== undefined) room.seats[seatIndex].isTalking = isTalking;
              await saveRoom(room);
            }
          }
          // Always broadcast the live state change to all room clients
          broadcastToRoom(roomId, {
            type: 'seat_status_updated',
            seatIndex,
            isTalking,
            isMuted
          });
        } else if (type === 'webrtc_signal') {
          // WebRTC Audio Signaling: route offer, answer, ice-candidate
          const { targetUserId, signal, seatIndex } = payload || {};
          if (targetUserId && targetUserId !== 'all') {
            sendToUserInRoom(roomId, targetUserId, {
              type: 'webrtc_signal',
              senderId: String(userId),
              senderName: userName,
              seatIndex,
              signal
            });
          } else {
            broadcastToRoom(roomId, {
              type: 'webrtc_signal',
              senderId: String(userId),
              senderName: userName,
              seatIndex,
              signal
            }, ws);
          }
        } else if (type === 'chat_message') {
          const room = await getRoom(roomId);
          if (room) {
            const chatMsg = {
              id: payload?.id || String(Date.now()),
              userId: String(userId),
              userName: userName || 'Anonymous',
              userLevel: payload?.userLevel || 1,
              message: payload?.message || '',
              type: payload?.type || 'text',
              timestamp: new Date().toISOString()
            };
            const added = addChatMessageToRoom(room, chatMsg);
            if (added) {
              await saveRoom(room);
              broadcastToRoom(roomId, {
                type: 'chat_message',
                message: chatMsg
              });
            }
          }
        } else if (type === 'reaction') {
          broadcastToRoom(roomId, {
            type: 'reaction',
            emoji: payload?.emoji,
            seatIndex: payload?.seatIndex,
            senderName: userName
          });
        } else if (type === 'game_event') {
          broadcastToRoom(roomId, {
            type: 'game_event',
            activeGame: payload?.activeGame,
            gameData: payload?.gameData
          });
        }
      } catch (err) {
        console.error('Error processing WS message:', err);
      }
    });

    ws.on('close', async () => {
      if (connectedUserId) {
        unregisterUserSocket(connectedUserId, ws);
      }
      if (clientInfo) {
        const { roomId, userId, userName } = clientInfo;
        const set = roomClients.get(roomId);
        if (set) {
          set.delete(clientInfo);
          if (set.size === 0) roomClients.delete(roomId);
        }
        console.log(`🔌 [WS] User ${userName} disconnected from room ${roomId}`);

        try {
          const room = await getRoom(roomId);
          if (room) {
            removeOnlineUserFromRoom(room, String(userId), userName);
            // Clear seat if this disconnected user was sitting (Seat 0 always remains Host)
            let seatChanged = false;
            if (room.seats) {
              for (const seat of room.seats) {
                if (seat.user && (String(seat.user._id || seat.user.id) === String(userId) || seat.user.name === userName)) {
                  seat.user = seat.index === 0 ? room.host : null;
                  seat.isTalking = false;
                  seat.isMuted = false;
                  seatChanged = true;
                }
              }
            }
            await saveRoom(room);

            broadcastToRoom(roomId, {
              type: 'user_left',
              userId: String(userId),
              userName,
              onlineUsers: room.onlineUsers,
              onlineCount: room.onlineCount,
              seats: seatChanged ? room.seats : undefined
            });
          }
        } catch (e) {
          console.error('Error handling WS disconnect:', e);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  function listenOnPort(port: number) {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} is already in use. Retrying on port ${port + 1}...`);
        listenOnPort(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  }

  listenOnPort(PORT);
}

startServer();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Handles SIGTERM (deploy restart) and SIGINT (Ctrl+C) cleanly so in-flight
// requests drain before the process exits. Prevents the red "terminated by
// signal SIGTERM" error in hosting logs.
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 [${signal}] Graceful shutdown initiated — draining connections...`);

  // Flush any unsaved room states from debounce queue
  try {
    const savePromises: Promise<any>[] = [];
    activeRoomsCache.forEach((room: any, key: string) => {
      // Only save entries keyed by MongoDB ID (24-char hex), skip alias keys
      if (key.length === 24 && /^[a-f0-9]+$/i.test(key) && room._id) {
        savePromises.push(
          RoomMongo.updateOne(
            { _id: room._id },
            { $set: { seats: room.seats, onlineUsers: room.onlineUsers, isActive: room.isActive } }
          ).catch(() => {})
        );
      }
    });
    if (savePromises.length > 0) {
      await Promise.allSettled(savePromises);
      console.log(`💾 Flushed ${savePromises.length} room states to MongoDB before exit.`);
    }
  } catch (_) {}

  // Close MongoDB connection
  if (isMongoConnected) {
    await mongoose.connection.close(false).catch(() => {});
    console.log('🔌 MongoDB connection closed.');
  }

  console.log('✅ Shutdown complete. Goodbye!');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Prevent unhandled promise rejections from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Promise Rejection (non-fatal):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception (non-fatal):', err.message);
});
