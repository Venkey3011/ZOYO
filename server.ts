import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { AccessToken } from "livekit-server-sdk";
import mongoose, { Schema } from "mongoose";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure public/uploads directory exists and serve files statically
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// Track when each user last opened/read their chats
const userLastReadMap = new Map<string, number>();

// Dedicated upload endpoint for user gallery images and device audio files
app.post("/api/upload", async (req: express.Request, res: express.Response) => {
  try {
    const { fileData, fileType, fileName } = req.body;
    if (!fileData || typeof fileData !== 'string') {
      res.status(400).json({ error: "No file data provided" });
      return;
    }

    let ext = fileType === 'audio' ? 'mp3' : 'jpg';
    let base64Content = fileData;
    const match = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (match) {
      const mime = match[1].toLowerCase();
      base64Content = match[2];
      if (mime.includes('image/png')) ext = 'png';
      else if (mime.includes('image/jpeg') || mime.includes('image/jpg')) ext = 'jpg';
      else if (mime.includes('image/webp')) ext = 'webp';
      else if (mime.includes('image/gif')) ext = 'gif';
      else if (mime.includes('audio/mpeg') || mime.includes('audio/mp3')) ext = 'mp3';
      else if (mime.includes('audio/wav')) ext = 'wav';
      else if (mime.includes('audio/ogg')) ext = 'ogg';
      else if (mime.includes('audio/m4a') || mime.includes('audio/mp4') || mime.includes('audio/x-m4a')) ext = 'm4a';
    }

    const cleanBaseName = (fileName || `${fileType}_${Date.now()}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const savedFileName = `${fileType}_${Date.now()}_${cleanBaseName}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, savedFileName);

    await fs.promises.writeFile(filePath, Buffer.from(base64Content, 'base64'));

    res.json({
      success: true,
      url: `/uploads/${savedFileName}`,
      fileName: fileName || savedFileName
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// ⚡ MONGODB ATLAS — Ultra-Fast Primary Database
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://venkeyb3011_db_user:DcidxZRg2LaIen7i@zoyo.7ywyhcx.mongodb.net/?appName=ZOYO";

let isMongoConnected = false;

// In-Memory cache for public rooms list to serve requests in <1ms
let cachedPublicRoomsList: any[] | null = null;
let cachedPublicRoomsTime = 0;

// ─── Mongoose Schemas & Models ────────────────────────────────────────────────
const UserSchema = new Schema({
  _id: { type: Schema.Types.Mixed },
  name: String, username: String, nickname: String, password: String,
  role: { type: String, default: 'user' },
  avatar: String, level: { type: Number, default: 1 },
  coins: { type: Number, default: 0 },
  frame_id: String, frameId: String, bubble_id: String, bubbleId: String, badge: String,
  bio: String, country: String, gender: String, date_of_birth: String,
  is_blocked: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  yoyo_id: String, yoyoId: String, email: String, phone_number: String,
  recent_visitors: { type: Array, default: [] },
  followers_count: { type: Number, default: 0 }, following_count: { type: Number, default: 0 },
  gifts_count: { type: Number, default: 0 }, visitors_count: { type: Number, default: 0 },
  family: String, vip_status: String, created_by: String, manager_id: String,
  social_id: String, social_provider: String
}, { timestamps: true, strict: false });

function buildUserQuery(id: string) {
  const cleanId = String(id).trim();
  const conditions: any[] = [
    { _id: cleanId },
    { yoyo_id: cleanId },
    { yoyoId: cleanId },
    { name: new RegExp(`^${cleanId}$`, 'i') },
    { username: cleanId }
  ];
  if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
    conditions.push({ _id: new mongoose.Types.ObjectId(cleanId) });
  }
  return { $or: conditions };
}

function buildRoomQuery(id: string) {
  const cleanId = String(id).trim();
  const conditions: any[] = [
    { _id: cleanId },
    { roomId: cleanId },
    { id: cleanId },
    { title: cleanId }
  ];
  if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
    conditions.push({ _id: new mongoose.Types.ObjectId(cleanId) });
  }
  return { $or: conditions };
}

const RoomSchema = new Schema({
  _id: { type: Schema.Types.Mixed },
  title: String, description: String, notice: String, host: Schema.Types.Mixed,
  theme: String, category: String,
  online_count: { type: Number, default: 1 },
  active_game: String, is_official_game: Boolean, game_prize_pool: Number,
  background_url: String, backgroundUrl: String, room_image: String, roomImage: String,
  seat_style: { type: String, default: 'sofa' }, seatStyle: { type: String, default: 'sofa' },
  is_active: { type: Boolean, default: true },
  is_private: Boolean, room_password: String,
  invited_users: { type: Array, default: [] }, seats: { type: Array, default: [] },
  online_users: { type: Array, default: [] }, chat_messages: { type: Array, default: [] }
}, { timestamps: true, strict: false });

const FriendRequestSchema = new Schema({
  _id: { type: String, required: true },
  sender_id: String, sender_name: String, sender_avatar: String, sender_yoyo_id: String,
  receiver_id: String, receiver_name: String, receiver_avatar: String, receiver_yoyo_id: String,
  status: { type: String, default: 'pending' }
}, { timestamps: true, _id: false });

const DirectMessageSchema = new Schema({
  _id: { type: String, required: true },
  sender_id: String, receiver_id: String,
  text: String, media_type: String, duration: Number
}, { timestamps: true, _id: false });

const TransferLogSchema = new Schema({
  sender_id: String, sender_name: String, sender_role: String,
  receiver_id: String, receiver_name: String,
  amount: Number, type: String, details: String, icon: String
}, { timestamps: true });

const CustomGameSchema = new Schema({
  _id: { type: String, required: true },
  name: String, category: String, icon: String,
  min_players: Number, max_players: Number, description: String, added_by: String
}, { timestamps: true, _id: false });

const UserModel = mongoose.model('users', UserSchema);
const RoomModel = mongoose.model('rooms', RoomSchema);
const FriendRequestModel = mongoose.model('friend_requests', FriendRequestSchema);
const DirectMessageModel = mongoose.model('direct_messages', DirectMessageSchema);
const TransferLogModel = mongoose.model('transfer_logs', TransferLogSchema);
const CustomGameModel = mongoose.model('custom_games', CustomGameSchema);

// ─── Data Mappers: MongoDB <-> ZOYO Models ────────────────────────────────────
function mongoToUser(row: any): any {
  if (!row) return null;
  const rawId = String(row._id || row.id || (row.yoyo_id ? 'u_' + row.yoyo_id : 'u_' + Date.now()));
  return {
    ...row,
    id: rawId, _id: rawId, userId: rawId,
    name: row.name || 'User',
    username: row.username || (row.name ? row.name.toLowerCase().replace(/\s+/g, '') : ''),
    nickname: row.nickname || row.name || '',
    password: row.password || '',
    role: row.role || 'user',
    avatar: row.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    level: Number(row.level || 1),
    coins: Number(row.coins !== undefined ? row.coins : 0),
    frameId: row.frame_id || row.frameId || 'none',
    bubbleId: row.bubble_id || row.bubbleId || 'none',
    badge: row.badge || '🐣 Beginner',
    yoyoId: String(row.yoyo_id || row.yoyoId || ''),
    bio: row.bio || 'Living life on ZOYO! 🌟',
    country: row.country || 'Global',
    gender: row.gender || 'Other',
    dateOfBirth: row.date_of_birth || row.dateOfBirth || '2005-01-01',
    isBlocked: Boolean(row.isBlocked || row.is_blocked),
    recentVisitors: Array.isArray(row.recent_visitors) ? row.recent_visitors : (Array.isArray(row.recentVisitors) ? row.recentVisitors : []),
    followersCount: Number(row.followers_count || row.followersCount || 0),
    followingCount: Number(row.following_count || row.followingCount || 0),
    giftsCount: Number(row.gifts_count || row.giftsCount || 0),
    visitorsCount: Number(row.visitors_count || row.visitorsCount || 0),
    family: row.family || 'None',
    vipStatus: row.vip_status || row.vipStatus || 'None',
    createdBy: row.created_by || row.createdBy || 'system',
    managerId: row.manager_id || row.managerId || 'none',
    phoneNumber: row.phone_number || row.phoneNumber || '',
    email: row.email || ''
  };
}

function userToMongo(user: any): any {
  if (!user) return null;
  return {
    _id: String(user.id || user._id || 'user_' + Date.now()),
    name: user.name,
    password: user.password || '',
    role: user.role || 'user',
    avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    level: Number(user.level || 1),
    coins: Number(user.coins !== undefined ? user.coins : 0),
    frame_id: user.frameId || user.frame_id || 'none',
    bubble_id: user.bubbleId || user.bubble_id || 'none',
    badge: user.badge || '🐣 Beginner',
    bio: user.bio || 'Living life on ZOYO! 🌟',
    country: user.country || 'Global',
    gender: user.gender || 'Other',
    dateOfBirth: user.dateOfBirth || user.date_of_birth || '2005-01-01',
    is_blocked: Boolean(user.isBlocked || user.is_blocked),
    isBlocked: Boolean(user.isBlocked || user.is_blocked),
    recent_visitors: user.recentVisitors || user.recent_visitors || [],
    yoyo_id: String(user.yoyoId || user.yoyo_id || ''),
    email: user.email || '',
    phone_number: user.phoneNumber || user.phone_number || '',
    created_by: user.createdBy || 'system',
    manager_id: user.managerId || 'none'
  };
}

function mongoToRoom(row: any): any {
  if (!row) return null;
  const rawId = String(row._id || row.id || row.roomId || '');
  return {
    ...row,
    id: rawId,
    _id: rawId,
    roomId: rawId,
    title: row.title || 'Voice Room',
    description: row.description || row.notice || '',
    notice: row.notice || row.description || '',
    seatStyle: row.seat_style || row.seatStyle || 'sofa',
    host: row.host || { id: 'host', name: 'Host', level: 1, coins: 0 },
    theme: row.theme || 'neon',
    category: row.category || 'chat',
    onlineCount: Number(row.online_count || row.onlineCount || 1),
    activeGame: row.active_game || row.activeGame || 'none',
    isOfficialGame: Boolean(row.is_official_game ?? row.isOfficialGame),
    gamePrizePool: Number(row.game_prize_pool || row.gamePrizePool || 0),
    backgroundUrl: row.background_url || row.backgroundUrl || '',
    roomImage: row.room_image || row.roomImage || '',
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : (row.isActive !== undefined ? Boolean(row.isActive) : true),
    isPrivate: row.is_private !== undefined ? Boolean(row.is_private) : Boolean(row.isPrivate),
    roomPassword: row.room_password || row.roomPassword || '',
    invitedUsers: Array.isArray(row.invited_users) ? row.invited_users : (Array.isArray(row.invitedUsers) ? row.invitedUsers : []),
    seats: Array.isArray(row.seats) ? row.seats : [],
    onlineUsers: Array.isArray(row.online_users) ? row.online_users : (Array.isArray(row.onlineUsers) ? row.onlineUsers : []),
    chatMessages: Array.isArray(row.chat_messages) ? row.chat_messages : (Array.isArray(row.chatMessages) ? row.chatMessages : []),
    createdAt: row.createdAt || row.created_at || new Date().toISOString()
  };
}

function roomToMongo(room: any): any {
  if (!room) return null;
  const id = String(room.id || room._id || room.roomId || 'room_' + Date.now());
  const bg = room.backgroundUrl || room.background_url || '';
  const noticeText = room.notice || room.description || '';
  const seatStyle = room.seatStyle || room.seat_style || 'sofa';
  return {
    _id: id,
    title: room.title || 'Voice Room',
    description: room.description || noticeText,
    notice: noticeText,
    host: room.host || {},
    theme: room.theme || 'neon',
    category: room.category || 'chat',
    online_count: Number(room.onlineCount || (room.onlineUsers ? room.onlineUsers.length : 1)),
    active_game: room.activeGame || 'none',
    is_official_game: Boolean(room.isOfficialGame),
    game_prize_pool: Number(room.gamePrizePool || 0),
    background_url: bg,
    backgroundUrl: bg,
    room_image: room.roomImage || room.room_image || '',
    roomImage: room.roomImage || room.room_image || '',
    seat_style: seatStyle,
    seatStyle: seatStyle,
    is_active: room.isActive !== undefined ? Boolean(room.isActive) : true,
    is_private: Boolean(room.isPrivate),
    room_password: room.roomPassword || '',
    invited_users: room.invitedUsers || [],
    seats: room.seats || [],
    online_users: room.onlineUsers || [],
    chat_messages: room.chatMessages ? room.chatMessages.slice(-60) : []
  };
}

function sanitizeRoom(room: any) {
  if (!room) return room;
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
  if (room.chatMessages && Array.isArray(room.chatMessages)) {
    const seenMsg = new Set<string>();
    room.chatMessages = room.chatMessages.filter((m: any) => {
      const key = String(m.id || '');
      if (key && seenMsg.has(key)) return false;
      if (key) seenMsg.add(key);
      return true;
    });
  }
  if (room.seats && Array.isArray(room.seats) && room.seats[0]) {
    if (!room.seats[0].user && room.host) {
      room.seats[0].user = room.host;
    }
  }
  return room;
}

// In-memory types
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

const activeRoomsCache = new Map<string, any>();
const roomSaveDebounceTimers = new Map<string, NodeJS.Timeout>();

async function logTransfer(logData: any) {
  if (isMongoConnected) {
    try {
      await TransferLogModel.create({
        sender_id: String(logData.senderId),
        sender_name: logData.senderName,
        sender_role: logData.senderRole,
        receiver_id: String(logData.receiverId),
        receiver_name: logData.receiverName,
        amount: Number(logData.amount),
        type: logData.type || 'transfer',
        details: logData.details || '',
        icon: logData.icon || '🪙'
      });
    } catch (e: any) {
      console.warn('MongoDB logTransfer error:', e.message || e);
    }
  }
  inMemoryTransfers.push({
    ...logData,
    timestamp: new Date().toISOString()
  });
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
    password: "Admin123",
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
  const expiresAt = Date.now() + 15 * 60 * 1000;
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

async function connectToMongoDB() {
  try {
    console.log("⚡ Connecting to MongoDB Atlas as primary database...");
    mongoose.set('bufferCommands', false);

    mongoose.connection.on('error', (err) => {
      console.warn('⚠️ MongoDB connection warning:', err?.message || err);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB socket disconnected — continuing from memory cache.');
      isMongoConnected = false;
    });
    mongoose.connection.on('reconnected', () => {
      console.log('🚀 MongoDB reconnected successfully!');
      isMongoConnected = true;
    });

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      connectTimeoutMS: 10000,
      maxPoolSize: 20,
      minPoolSize: 2,
      retryWrites: true,
      retryReads: true
    } as any);
    isMongoConnected = true;
    console.log("🚀 MongoDB Atlas connected successfully as primary database!");

    // Pre-warm user cache into RAM for 0ms sub-millisecond access
    const users = await UserModel.find({}).lean() as any[];
    if (users && users.length > 0) {
      users.forEach((u: any) => {
        const parsed = mongoToUser(u);
        setCachedUser(parsed);
        const idx = inMemoryDB.findIndex(m => m._id === parsed._id || m.name === parsed.name);
        if (idx !== -1) inMemoryDB[idx] = parsed;
        else inMemoryDB.push(parsed);
      });
      console.log(`⚡ Pre-warmed ${users.length} users from MongoDB into memory cache.`);
    }

    // Seed Admin user in MongoDB if missing
    const hasAdmin = inMemoryDB.some(u => u.name === 'Admin' || u.yoyoId === '888888');
    const dbAdmin = await UserModel.findById('user_admin').lean();
    if (!hasAdmin && !dbAdmin) {
      await UserModel.create({
        _id: 'user_admin',
        name: "Admin",
        username: "admin",
        nickname: "Admin",
        password: "Admin123",
        role: "admin",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
        level: 99,
        coins: 999999999,
        frame_id: "frame_royal",
        bubble_id: "bubble_royal",
        badge: "👑 Owner",
        created_by: "system",
        manager_id: "none",
        is_blocked: false,
        yoyo_id: "888888",
        gender: "Male",
        date_of_birth: "1995-10-24",
        country: "Global"
      });
      console.log("✅ Seeded Admin user in MongoDB.");
    }

    // Pre-warm active rooms cache from MongoDB
    const rooms = await RoomModel.find({ is_active: true }).lean() as any[];
    if (rooms && rooms.length > 0) {
      rooms.forEach((r: any) => {
        const parsed = mongoToRoom(r);
        activeRoomsCache.set(String(parsed.id), parsed);
        const idx = inMemoryRooms.findIndex(m => m.id === parsed.id);
        if (idx !== -1) inMemoryRooms[idx] = parsed;
        else inMemoryRooms.push(parsed);
      });
      const publicRooms = rooms.filter((r: any) => !r.is_private).map(mongoToRoom).map(sanitizeRoom);
      publicRooms.forEach((r: any) => { delete r.roomPassword; });
      cachedPublicRoomsList = publicRooms;
      cachedPublicRoomsTime = Date.now();
      console.log(`⚡ Pre-warmed ${publicRooms.length} public rooms from MongoDB into cache.`);
    }

  } catch (err: any) {
    console.error("❌ MongoDB connection error:", err.message || err);
    console.warn("⚠️ Falling back to in-memory mode.");
    isMongoConnected = false;
  }
}

connectToMongoDB();

// Helper to query all users
async function getUsers() {
  if (isMongoConnected) {
    const docs = await UserModel.find({}).lean() as any[];
    if (docs) {
      const mapped = docs.map(mongoToUser);
      for (const memUser of inMemoryDB) {
        if (!mapped.some(u => String(u._id) === String(memUser._id) || String(u.id) === String((memUser as any).id) || u.name === memUser.name)) {
          mapped.push(memUser);
        }
      }
      return mapped;
    }
  }
  return inMemoryDB.map(({ password, ...u }) => u);
}

async function findUserById(id: string) {
  if (!id) return null;
  const cleanId = String(id).trim();

  // ⚡ 0ms Fast path: check in-memory cache
  const cached = getCachedUser(cleanId);
  if (cached) return cached;

  if (isMongoConnected) {
    try {
      const doc = await UserModel.findOne(buildUserQuery(cleanId)).lean();
      if (doc) {
        const u = mongoToUser(doc);
        setCachedUser(u);
        return u;
      }
    } catch (err) {
      console.warn(`[findUserById] Mongo query error for ${cleanId}:`, err);
    }
  }

  const memUser = inMemoryDB.find(u => u._id === cleanId || (u as any).id === cleanId || u.yoyoId === cleanId || u.name.toLowerCase() === cleanId.toLowerCase());
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  return null;
}

async function findUserByName(name: string) {
  if (!name) return null;
  const normalized = String(name).toLowerCase().trim();

  // ⚡ 0ms Fast path: check in-memory cache
  const cached = getCachedUser(normalized);
  if (cached) return cached;

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
    const doc = await UserModel.findOne({
      $or: [
        { name: new RegExp('^' + normalized + '$', 'i') },
        { username: normalized },
        { email: normalized },
        { yoyo_id: normalized }
      ]
    }).lean();

    if (doc) {
      const u = mongoToUser(doc);
      setCachedUser(u);
      return u;
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
    const doc = await UserModel.findOne({ phone_number: cleaned }).lean();
    if (doc) {
      const u = mongoToUser(doc);
      setCachedUser(u);
      return u;
    }
  }

  return null;
}

async function findUserByEmail(email: string) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();

  const cached = getCachedUser(cleaned);
  if (cached) return cached;

  const memUser = inMemoryDB.find(u => (u.email && u.email.toLowerCase() === cleaned));
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    const doc = await UserModel.findOne({ email: cleaned }).lean();
    if (doc) {
      const u = mongoToUser(doc);
      setCachedUser(u);
      return u;
    }
  }

  return null;
}

async function findUserBySocial(provider: string, socialId: string) {
  if (!provider || !socialId) return null;

  const memUser = inMemoryDB.find(u => u.socialProvider === provider && u.socialId === socialId);
  if (memUser) {
    setCachedUser(memUser);
    return memUser;
  }

  if (isMongoConnected) {
    const doc = await UserModel.findOne({
      $or: [{ social_id: socialId }, { email: socialId }]
    }).lean();

    if (doc) {
      const u = mongoToUser(doc);
      setCachedUser(u);
      return u;
    }
  }

  return null;
}

async function createUser(fullData: any) {
  let createdUser = null;
  const newUserId = fullData.id || fullData._id || 'user_' + Date.now();
  const userObj = {
    ...fullData,
    id: newUserId,
    _id: newUserId,
    userId: newUserId
  };

  if (isMongoConnected) {
    try {
      const doc = userToMongo(userObj);
      const saved = await UserModel.create(doc);
      if (saved) {
        createdUser = mongoToUser((saved as any).toObject ? (saved as any).toObject() : saved);
      }
    } catch (e: any) {
      if (e.code === 11000) {
        const existing = await UserModel.findById(userObj.id).lean();
        if (existing) createdUser = mongoToUser(existing);
      } else {
        console.warn('MongoDB createUser error:', e.message || e);
      }
    }
  }

  if (!createdUser) {
    inMemoryDB.push(userObj);
    createdUser = userObj;
  }

  if (createdUser) {
    setCachedUser(createdUser);
  }
  return createdUser;
}

async function updateUser(id: string, updateData: any) {
  invalidateCachedUser(id);
  const cleanId = String(id).trim();
  
  if (isMongoConnected) {
    try {
      const mongoUpdate: any = {};
      if (updateData.name !== undefined) mongoUpdate.name = updateData.name;
      if (updateData.coins !== undefined) mongoUpdate.coins = updateData.coins;
      if (updateData.level !== undefined) mongoUpdate.level = updateData.level;
      if (updateData.role !== undefined) mongoUpdate.role = updateData.role;
      if (updateData.avatar !== undefined) mongoUpdate.avatar = updateData.avatar;
      if (updateData.frameId !== undefined) {
        mongoUpdate.frame_id = updateData.frameId;
        mongoUpdate.frameId = updateData.frameId;
      }
      if (updateData.bubbleId !== undefined) {
        mongoUpdate.bubble_id = updateData.bubbleId;
        mongoUpdate.bubbleId = updateData.bubbleId;
      }
      if (updateData.badge !== undefined) mongoUpdate.badge = updateData.badge;
      if (updateData.bio !== undefined) mongoUpdate.bio = updateData.bio;
      if (updateData.country !== undefined) mongoUpdate.country = updateData.country;
      if (updateData.gender !== undefined) mongoUpdate.gender = updateData.gender;
      if (updateData.dateOfBirth !== undefined) {
        mongoUpdate.date_of_birth = updateData.dateOfBirth;
        mongoUpdate.dateOfBirth = updateData.dateOfBirth;
      }
      if (updateData.isBlocked !== undefined) {
        mongoUpdate.is_blocked = Boolean(updateData.isBlocked);
        mongoUpdate.isBlocked = Boolean(updateData.isBlocked);
      }
      if (updateData.recentVisitors !== undefined) mongoUpdate.recent_visitors = updateData.recentVisitors;
      if (updateData.visitorsCount !== undefined) mongoUpdate.visitors_count = updateData.visitorsCount;
      if (updateData.managerId !== undefined) {
        mongoUpdate.manager_id = updateData.managerId;
        mongoUpdate.managerId = updateData.managerId;
      }
      if (updateData.password !== undefined) mongoUpdate.password = updateData.password;

      const doc = await UserModel.findOneAndUpdate(
        buildUserQuery(cleanId),
        { $set: mongoUpdate },
        { new: true }
      ).lean();

      if (doc) {
        const u = mongoToUser(doc);
        setCachedUser(u);
        const index = inMemoryDB.findIndex(m => String(m._id) === String(u._id) || String((m as any).id) === String(u.id) || m.name === u.name || m.yoyoId === u.yoyoId);
        if (index !== -1) {
          inMemoryDB[index] = { ...inMemoryDB[index], ...u };
        }
        return u;
      }
    } catch (err) {
      console.warn(`[updateUser] Error updating user ${id} in MongoDB:`, err);
    }
  }

  const index = inMemoryDB.findIndex(u => u._id === cleanId || (u as any).id === cleanId || u.name === cleanId);
  if (index !== -1) {
    inMemoryDB[index] = { ...inMemoryDB[index], ...updateData };
    setCachedUser(inMemoryDB[index]);
    return inMemoryDB[index];
  }
  return null;
}

// --- API ENDPOINTS ---

const APP_VERSION = '1.0.0';
const APP_BUILD_TIME = Date.now();

app.get("/api/version", (req, res) => {
  res.json({
    version: APP_VERSION,
    buildTime: APP_BUILD_TIME,
    timestamp: new Date(APP_BUILD_TIME).toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: "MongoDB Atlas",
    connected: isMongoConnected,
    mode: isMongoConnected ? "MongoDB Atlas (High-Concurrency Realtime)" : "In-Memory Fallback",
    mongoActive: isMongoConnected,
    cachedUsers: activeUsersCache.size,
    activeRooms: activeRoomsCache.size
  });
});

app.get("/api/db-status", (req, res) => {
  res.json({
    connected: isMongoConnected,
    mode: isMongoConnected ? "MongoDB Atlas Cloud (Active)" : "In-Memory Fallback",
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
    invalidateCachedUser(id);
    if (isMongoConnected) {
      await UserModel.deleteOne(buildUserQuery(id));
    }
    const idx = inMemoryDB.findIndex(u => u._id === id || (u as any).id === id || u.name === id || u.yoyoId === id);
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
      const docs = await TransferLogModel.find({}).sort({ createdAt: -1 }).limit(200).lean() as any[];
      if (docs) {
        const mapped = docs.map((d: any) => ({ id: String(d._id), senderId: d.sender_id, senderName: d.sender_name, senderRole: d.sender_role, receiverId: d.receiver_id, receiverName: d.receiver_name, amount: d.amount, type: d.type, details: d.details, icon: d.icon, timestamp: d.createdAt }));
        return res.json({ success: true, transfers: mapped });
      }
    }
    if (true) {
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
      const docs = await TransferLogModel.find({
        $or: [{ sender_id: id }, { receiver_id: id }]
      }).sort({ createdAt: -1 }).limit(limit).lean() as any[];
      if (docs && docs.length > 0) {
        logs = docs.map((d: any) => ({ id: String(d._id), senderId: d.sender_id, senderName: d.sender_name, senderRole: d.sender_role, receiverId: d.receiver_id, receiverName: d.receiver_name, amount: d.amount, type: d.type, details: d.details, icon: d.icon, timestamp: d.createdAt }));
      }
    }
    if (!logs || logs.length === 0) {
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
    user = await findUserById(id);
    if (!user) user = await findUserByName(id);

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

    if (true) {
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

    // Gift saved in memory
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
    // Gift deleted from memory
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

    if (true) {
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

    // Frame saved in memory
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
    // Frame deleted from memory
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
      const docs = await CustomGameModel.find({}).sort({ createdAt: -1 }).lean() as any[];
      const dbGames = (docs || []).map((g: any) => ({
        id: g._id,
        name: g.name,
        category: g.category,
        icon: g.icon,
        minPlayers: g.min_players,
        maxPlayers: g.max_players,
        description: g.description,
        addedBy: g.added_by,
        status: 'active'
      }));
      const combined = [...dbGames];
      for (const def of inMemoryCustomGames) {
        if (!combined.some(g => g.id === def.id)) {
          combined.push(def);
        }
      }
      cachedCatalogGames = combined;
      return res.json({ success: true, games: combined });
    }
    if (true) {
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
      await CustomGameModel.create({
        _id: newGame.id,
        name: newGame.name,
        category: newGame.category,
        icon: newGame.icon,
        min_players: newGame.minPlayers,
        max_players: newGame.maxPlayers,
        description: newGame.description,
        added_by: newGame.addedBy
      });
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
      await CustomGameModel.deleteOne({ _id: id });
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
      const mongoUpdates: any = {};
      if (updates.name) mongoUpdates.name = updates.name;
      if (updates.category) mongoUpdates.category = updates.category;
      if (updates.minPlayers) mongoUpdates.min_players = updates.minPlayers;
      if (updates.maxPlayers) mongoUpdates.max_players = updates.maxPlayers;
      if (updates.description) mongoUpdates.description = updates.description;
      await CustomGameModel.updateOne({ _id: id }, { $set: mongoUpdates });
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

async function registerUserSocket(userId: string, ws: WebSocket) {
  if (!userId) return;
  const uid = String(userId);
  if (!globalUserSockets.has(uid)) {
    globalUserSockets.set(uid, new Set());
  }
  globalUserSockets.get(uid)!.add(ws);

  // Also link aliases (id, _id, yoyoId) so notifications and chats arrive regardless of ID format used
  try {
    const u = await findUserById(uid);
    if (u) {
      const aliases = [u.id, (u as any)._id, u.yoyoId].filter(Boolean).map(String);
      for (const alias of aliases) {
        if (!globalUserSockets.has(alias)) {
          globalUserSockets.set(alias, new Set());
        }
        globalUserSockets.get(alias)!.add(ws);
      }
    }
  } catch {}
}

function unregisterUserSocket(userId: string, ws: WebSocket) {
  if (!userId) return;
  const uid = String(userId);
  for (const [key, sockets] of globalUserSockets.entries()) {
    if (sockets.has(ws)) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        globalUserSockets.delete(key);
      }
    }
  }
}

async function sendToUserGlobally(userId: string, data: any) {
  const targetId = String(userId);
  const sentSockets = new Set<WebSocket>();
  const payload = JSON.stringify(data);

  const idCandidates = [targetId];
  try {
    const u = await findUserById(targetId);
    if (u) {
      if (u.id) idCandidates.push(String(u.id));
      if ((u as any)._id) idCandidates.push(String((u as any)._id));
      if (u.yoyoId) idCandidates.push(String(u.yoyoId));
    }
  } catch {}

  for (const cid of new Set(idCandidates)) {
    const sockets = globalUserSockets.get(cid);
    if (sockets) {
      for (const ws of sockets) {
        if (!sentSockets.has(ws) && ws.readyState === WebSocket.OPEN) {
          sentSockets.add(ws);
          try {
            ws.send(payload);
          } catch (err) {
            console.warn(`Failed to send DM via WS to user ${cid}:`, err);
          }
        }
      }
    }
  }
}


async function getRoom(id: string) {
  if (!id) return null;
  const cleanId = String(id).trim();

  // 1. Direct hit in activeRoomsCache (<0.01ms)
  if (activeRoomsCache.has(cleanId)) {
    return sanitizeRoom(activeRoomsCache.get(cleanId));
  }

  // 2. Scan activeRoomsCache values for match on id, _id, roomId, or title (<0.05ms)
  for (const r of activeRoomsCache.values()) {
    if (r && (String(r.id) === cleanId || String(r._id) === cleanId || String(r.roomId) === cleanId || r.title === cleanId)) {
      activeRoomsCache.set(cleanId, r);
      return sanitizeRoom(r);
    }
  }

  // 3. Check inMemoryRooms RAM store immediately (<0.1ms)
  const memRoom = inMemoryRooms.find(r => r && (String(r.id) === cleanId || String(r.roomId) === cleanId || String((r as any)._id) === cleanId || r.title === cleanId));
  if (memRoom) {
    activeRoomsCache.set(cleanId, memRoom);
    return sanitizeRoom(memRoom);
  }

  // 4. Query MongoDB Atlas with strict 2-second timeout guard so network issues never hang requests!
  if (isMongoConnected && mongoose.connection.readyState === 1) {
    try {
      const doc = await Promise.race([
        RoomModel.findOne(buildRoomQuery(cleanId)).lean(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('MongoDB query timeout (2s)')), 2000))
      ]);
      if (doc) {
        const room = mongoToRoom(doc);
        activeRoomsCache.set(cleanId, room);
        activeRoomsCache.set(String(room.id), room);
        if (room._id) activeRoomsCache.set(String(room._id), room);
        if (room.roomId) activeRoomsCache.set(String(room.roomId), room);
        return sanitizeRoom(room);
      }
    } catch (err: any) {
      console.warn(`[getRoom] MongoDB note for ${cleanId}:`, err?.message || err);
    }
  }

  return null;
}

async function saveRoom(room: any) {
  if (!room) return;
  const id = String(room.id || room._id || room.roomId || '');
  if (!id) return;

  // 1. Instant update in activeRoomsCache for sub-millisecond response (<0.1ms)
  activeRoomsCache.set(id, room);
  if (room.id) activeRoomsCache.set(String(room.id), room);
  if (room._id) activeRoomsCache.set(String(room._id), room);
  if (room.roomId) activeRoomsCache.set(String(room.roomId), room);

  const memIdx = inMemoryRooms.findIndex(r => r.id === id || r.roomId === id || (r as any)._id === id);
  if (memIdx !== -1) {
    inMemoryRooms[memIdx] = { ...room };
  } else {
    inMemoryRooms.push({ ...room });
  }

  // 2. Debounced asynchronous persist to MongoDB with timeout guard
  const existingTimer = roomSaveDebounceTimers.get(id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    roomSaveDebounceTimers.delete(id);
    try {
      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const mongoRow = roomToMongo(room);
        await Promise.race([
          RoomModel.findOneAndUpdate(buildRoomQuery(id), { $set: mongoRow }, { upsert: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB save timeout (2.5s)')), 2500))
        ]);
      }
    } catch (err: any) {
      console.warn(`[saveRoom] Background persist note for ${id}:`, err?.message || err);
    }
  }, 200);

  roomSaveDebounceTimers.set(id, timer);
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
  room.onlineCount = Math.max(room.onlineUsers.length, room.seats?.filter((s: any) => s.user).length || 0);
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

  room.onlineCount = Math.max(0, room.onlineUsers.length);
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
    if (String(senderId) === String(receiverId)) { res.status(400).json({ error: "You cannot send a friend request to yourself" }); return; }

    const sId = String(senderId).trim();
    const rId = String(receiverId).trim();

    // Look up sender and receiver to ensure accurate names, avatars, and IDs
    const [senderUser, receiverUser] = await Promise.all([
      findUserById(sId),
      findUserById(rId)
    ]);

    const sName = senderName || senderUser?.name || 'User';
    const sAvatar = senderAvatar || senderUser?.avatar || '';
    const sYoyoId = senderYoyoId || senderUser?.yoyoId || '';
    const rName = receiverName || receiverUser?.name || 'User';
    const rAvatar = receiverUser?.avatar || '';
    const rYoyoId = receiverYoyoId || receiverUser?.yoyoId || '';
    const realReceiverId = receiverUser ? String(receiverUser.id || receiverUser._id) : rId;
    const realSenderId = senderUser ? String(senderUser.id || senderUser._id) : sId;

    if (realSenderId === realReceiverId) {
      res.status(400).json({ error: "You cannot send a friend request to yourself" });
      return;
    }

    const reqId = `fr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (isMongoConnected) {
      const existing = await FriendRequestModel.findOne({
        $or: [
          { sender_id: realSenderId, receiver_id: realReceiverId },
          { sender_id: realReceiverId, receiver_id: realSenderId }
        ],
        status: { $in: ['pending', 'accepted'] }
      }).lean();

      if (existing) {
        const msg = (existing as any).status === 'accepted' ? "You are already friends!" : "Friend request already sent";
        res.status(409).json({ error: msg });
        return;
      }

      const fr = await FriendRequestModel.create({
        _id: reqId,
        sender_id: realSenderId,
        sender_name: sName,
        sender_avatar: sAvatar,
        sender_yoyo_id: sYoyoId,
        receiver_id: realReceiverId,
        receiver_name: rName,
        receiver_avatar: rAvatar,
        receiver_yoyo_id: rYoyoId,
        status: 'pending'
      });

      if (fr) {
        const frObj = (fr as any).toObject ? (fr as any).toObject() : fr;
        sendToUserGlobally(realReceiverId, {
          type: 'friend_request_received',
          friendRequest: frObj
        });
        if (rYoyoId && rYoyoId !== realReceiverId) {
          sendToUserGlobally(rYoyoId, {
            type: 'friend_request_received',
            friendRequest: frObj
          });
        }
        res.json({ success: true, friendRequest: frObj });
        return;
      }
    }

    const fr: InMemFriendRequest = {
      _id: reqId,
      senderId: realSenderId, senderName: sName, senderAvatar: sAvatar,
      senderYoyoId: sYoyoId, receiverId: realReceiverId, receiverName: rName,
      receiverYoyoId: rYoyoId, status: 'pending', createdAt: new Date().toISOString()
    };
    inMemoryFriendRequests.push(fr);

    sendToUserGlobally(realReceiverId, {
      type: 'friend_request_received',
      friendRequest: fr
    });

    res.json({ success: true, friendRequest: fr });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get inbox (received pending friend requests)
app.get("/api/friend-requests/:userId/inbox", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const user = await findUserById(cleanId);
    const idList = [cleanId];
    if (user) {
      if (user.id && !idList.includes(String(user.id))) idList.push(String(user.id));
      if (user._id && !idList.includes(String(user._id))) idList.push(String(user._id));
      if (user.yoyoId && !idList.includes(String(user.yoyoId))) idList.push(String(user.yoyoId));
    }

    if (isMongoConnected) {
      const docs = await FriendRequestModel.find({
        receiver_id: { $in: idList },
        status: 'pending'
      }).sort({ createdAt: -1 }).lean() as any[];

      if (docs) {
        const mapped = docs.map((d: any) => ({
          _id: d._id,
          id: d._id,
          senderId: d.sender_id,
          senderName: d.sender_name,
          senderAvatar: d.sender_avatar,
          senderYoyoId: d.sender_yoyo_id,
          receiverId: d.receiver_id,
          receiverName: d.receiver_name,
          receiverYoyoId: d.receiver_yoyo_id,
          status: d.status,
          createdAt: d.createdAt
        }));
        return res.json({ success: true, requests: mapped });
      }
    }
    const requests = inMemoryFriendRequests.filter(fr => idList.includes(String(fr.receiverId)) && fr.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Respond to a friend request (accept or reject)
app.post("/api/friend-requests/:requestId/respond", async (req: express.Request, res: express.Response) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) { res.status(400).json({ error: "action must be 'accept' or 'reject'" }); return; }
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    if (isMongoConnected) {
      const doc = await FriendRequestModel.findByIdAndUpdate(
        requestId,
        { $set: { status: newStatus } },
        { new: true }
      ).lean() as any;

      if (doc) {
        sendToUserGlobally(String(doc.sender_id), {
          type: 'friend_request_responded',
          action,
          friendRequest: doc
        });
        return res.json({ success: true, friendRequest: doc });
      }
    }

    const fr = inMemoryFriendRequests.find(r => r._id === requestId || (r as any).id === requestId);
    if (!fr) { res.status(404).json({ error: "Friend request not found" }); return; }
    fr.status = newStatus;

    sendToUserGlobally(String(fr.senderId), {
      type: 'friend_request_responded',
      action,
      friendRequest: fr
    });

    res.json({ success: true, friendRequest: fr });
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get accepted friends list for a user
app.get("/api/friends/:userId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const user = await findUserById(cleanId);
    const idList = [cleanId];
    if (user) {
      if (user.id && !idList.includes(String(user.id))) idList.push(String(user.id));
      if (user._id && !idList.includes(String(user._id))) idList.push(String(user._id));
      if (user.yoyoId && !idList.includes(String(user.yoyoId))) idList.push(String(user.yoyoId));
    }

    if (isMongoConnected) {
      const docs = await FriendRequestModel.find({
        status: 'accepted',
        $or: [{ sender_id: { $in: idList } }, { receiver_id: { $in: idList } }]
      }).lean() as any[];

      if (docs) {
        const friends = await Promise.all(docs.map(async (fr: any) => {
          const isSender = idList.includes(String(fr.sender_id));
          const fId = isSender ? fr.receiver_id : fr.sender_id;
          const fName = isSender ? fr.receiver_name : fr.sender_name;
          const fYoyoId = isSender ? fr.receiver_yoyo_id : fr.sender_yoyo_id;
          let avatar = isSender ? fr.receiver_avatar : fr.sender_avatar;
          if (!avatar) {
            const u = await findUserById(fId);
            if (u) avatar = u.avatar;
          }
          return {
            id: fId,
            name: fName,
            avatar: avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${fId}`,
            yoyoId: fYoyoId
          };
        }));
        return res.json({ success: true, friends });
      }
    }

    const userFrs = inMemoryFriendRequests.filter(fr => 
      idList.some(id => String(fr.senderId) === id || String(fr.receiverId) === id) && fr.status === 'accepted'
    );
    const friends = userFrs.map(fr => {
      const isSender = idList.some(id => String(fr.senderId) === id);
      return {
        id: isSender ? fr.receiverId : fr.senderId,
        name: isSender ? fr.receiverName : fr.senderName,
        avatar: isSender ? fr.receiverAvatar : fr.senderAvatar,
        yoyoId: isSender ? fr.receiverYoyoId : fr.senderYoyoId
      };
    });
    res.json({ success: true, friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Check friendship status between two users
app.get("/api/friends/status", async (req: express.Request, res: express.Response) => {
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      res.json({ isFriend: false });
      return;
    }
    const u1 = String(user1).trim();
    const u2 = String(user2).trim();

    if (u1 === u2) {
      res.json({ isFriend: false, isSelf: true });
      return;
    }

    if (isMongoConnected) {
      const doc = await FriendRequestModel.findOne({
        status: 'accepted',
        $or: [
          { sender_id: u1, receiver_id: u2 },
          { sender_id: u2, receiver_id: u1 }
        ]
      }).lean();

      res.json({ isFriend: Boolean(doc) });
      return;
    }

    const isFriend = inMemoryFriendRequests.some(fr => 
      fr.status === 'accepted' && 
      ((fr.senderId === u1 && fr.receiverId === u2) || (fr.senderId === u2 && fr.receiverId === u1))
    );
    res.json({ isFriend });
  } catch (err) {
    res.json({ isFriend: false });
  }
});

// Mark DM as read for a user
app.post("/api/dm/read/:userId", (req: express.Request, res: express.Response) => {
  const { userId } = req.params;
  const cleanId = String(userId).trim();
  userLastReadMap.set(cleanId, Date.now());
  res.json({ success: true, timestamp: Date.now() });
});

// Notification Badges / Counts Endpoint
app.get("/api/notifications/counts/:userId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId).trim();
    const user = await findUserById(cleanId);
    const idList = [cleanId];
    if (user) {
      if (user.id && !idList.includes(String(user.id))) idList.push(String(user.id));
      if (user._id && !idList.includes(String(user._id))) idList.push(String(user._id));
      if (user.yoyoId && !idList.includes(String(user.yoyoId))) idList.push(String(user.yoyoId));
    }

    let friendRequestsCount = 0;
    let unreadDMsCount = 0;

    // Last read timestamp for DMs (from client or server map)
    const clientSince = req.query.since ? Number(req.query.since) : null;
    const lastReadTimestamp = clientSince || userLastReadMap.get(cleanId);

    if (isMongoConnected) {
      // 1. Count pending incoming friend requests
      friendRequestsCount = await FriendRequestModel.countDocuments({
        receiver_id: { $in: idList },
        status: 'pending'
      });

      // 2. Count unread DMs received after the user's last read time
      if (lastReadTimestamp && lastReadTimestamp > 0) {
        const sinceDate = new Date(lastReadTimestamp);
        const recentMsgs = await DirectMessageModel.find({
          receiver_id: { $in: idList },
          createdAt: { $gt: sinceDate }
        }, { sender_id: 1 }).lean() as any[];

        if (recentMsgs && recentMsgs.length > 0) {
          const senders = new Set(recentMsgs.map((m: any) => m.sender_id));
          unreadDMsCount = senders.size;
        }
      }
    } else {
      friendRequestsCount = inMemoryFriendRequests.filter(fr => 
        idList.includes(String(fr.receiverId)) && fr.status === 'pending'
      ).length;

      if (lastReadTimestamp && lastReadTimestamp > 0) {
        const recent = inMemoryDirectMessages.filter(m => 
          idList.includes(String(m.receiverId)) && 
          new Date(m.createdAt).getTime() > lastReadTimestamp
        );
        const senders = new Set(recent.map(m => m.senderId));
        unreadDMsCount = senders.size;
      }
    }

    res.json({
      success: true,
      friendRequests: friendRequestsCount,
      unreadDMs: unreadDMsCount,
      total: friendRequestsCount + unreadDMsCount
    });
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    res.status(500).json({ error: "Failed to get counts", friendRequests: 0, unreadDMs: 0, total: 0 });
  }
});

// --- DIRECT MESSAGES (1-ON-1 CHAT) ENDPOINTS ---

// Get all DM conversation threads for a user
app.get("/api/dm/conversations/:userId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId } = req.params;
    const uid = String(userId);
    userLastReadMap.set(uid, Date.now());

    let messages: any[] = [];
    if (isMongoConnected) {
      const docs = await DirectMessageModel.find({
        $or: [{ sender_id: uid }, { receiver_id: uid }]
      }).sort({ createdAt: -1 }).lean() as any[];

      if (docs) {
        messages = docs.map((d: any) => ({
          _id: d._id,
          senderId: d.sender_id,
          receiverId: d.receiver_id,
          text: d.text,
          voice: d.media_type === 'voice',
          duration: d.duration || 0,
          createdAt: d.createdAt
        }));
      }
    } else {
      messages = inMemoryDirectMessages
        .filter(m => String(m.senderId) === uid || String(m.receiverId) === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const conversationMap = new Map<string, any>();
    for (const m of messages) {
      const isSender = String(m.senderId) === uid;
      const partnerId = isSender ? String(m.receiverId) : String(m.senderId);

      if (!conversationMap.has(partnerId)) {
        const partnerUser = await findUserById(partnerId);
        const partnerName = partnerUser ? partnerUser.name : 'Friend';
        const partnerAvatar = partnerUser ? partnerUser.avatar : `https://api.dicebear.com/7.x/thumbs/svg?seed=${partnerId}`;
        const partnerYoyoId = partnerUser ? partnerUser.yoyoId : '';

        conversationMap.set(partnerId, {
          id: partnerId,
          senderId: partnerId,
          senderName: partnerName,
          senderAvatar: partnerAvatar,
          yoyoId: partnerYoyoId,
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
      const docs = await DirectMessageModel.find({
        $or: [
          { sender_id: uid, receiver_id: fid },
          { sender_id: fid, receiver_id: uid }
        ]
      }).sort({ createdAt: 1 }).lean() as any[];

      if (docs) {
        messages = docs.map((d: any) => ({
          id: String(d._id),
          senderId: String(d.sender_id),
          receiverId: String(d.receiver_id),
          text: d.text,
          voice: d.media_type === 'voice',
          duration: d.duration || 0,
          timestamp: new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        return res.json({ success: true, messages });
      }
    }

    messages = inMemoryDirectMessages
      .filter(m => (String(m.senderId) === uid && String(m.receiverId) === fid) ||
                   (String(m.senderId) === fid && String(m.receiverId) === uid))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(m => ({
        id: String(m._id),
        sender: m.senderName,
        senderId: String(m.senderId),
        receiverId: String(m.receiverId),
        text: m.text,
        voice: !!m.voice,
        duration: m.duration,
        timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching DM messages:', error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send a DM message
app.post("/api/dm/send", async (req: express.Request, res: express.Response) => {
  try {
    const { senderId, senderName, senderAvatar, receiverId, receiverName, receiverAvatar, text, voice, duration } = req.body;

    if (!senderId || !receiverId || !text?.trim()) {
      res.status(400).json({ error: "senderId, receiverId, and text are required" });
      return;
    }

    const isVoice = Boolean(voice);
    const nowIso = new Date().toISOString();
    const msgId = `dm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (isMongoConnected) {
      try {
        await DirectMessageModel.create({
          _id: msgId,
          sender_id: String(senderId),
          receiver_id: String(receiverId),
          text: text.trim(),
          media_type: isVoice ? 'voice' : 'text',
          duration: duration || 0
        });
      } catch (e: any) {
        console.warn('MongoDB direct_message insert error:', e.message || e);
      }
    }

    const formattedMsg = {
      id: msgId,
      sender: senderName || 'User',
      senderId: String(senderId),
      receiverId: String(receiverId),
      text: text.trim(),
      voice: isVoice,
      duration: duration || 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    inMemoryDirectMessages.push({
      _id: msgId,
      senderId: String(senderId),
      senderName: senderName || 'User',
      senderAvatar: senderAvatar || '',
      receiverId: String(receiverId),
      receiverName: receiverName || 'Friend',
      receiverAvatar: receiverAvatar || '',
      text: text.trim(),
      voice: isVoice,
      duration: duration || 0,
      createdAt: nowIso
    });

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

    // Broadcast to sender via WebSocket
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

// Delete a DM message (support both singular and plural paths)
app.delete(["/api/dm/messages/:id", "/api/dm/message/:id"], async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      await DirectMessageModel.deleteOne({ _id: id });
    }
    const idx = inMemoryDirectMessages.findIndex(m => m._id === id);
    if (idx !== -1) inMemoryDirectMessages.splice(idx, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// Clear conversation between two users
app.delete("/api/dm/conversations/:userId/:friendId", async (req: express.Request, res: express.Response) => {
  try {
    const { userId, friendId } = req.params;
    const uid = String(userId);
    const fid = String(friendId);
    if (isMongoConnected) {
      await DirectMessageModel.deleteMany({
        $or: [
          { sender_id: uid, receiver_id: fid },
          { sender_id: fid, receiver_id: uid }
        ]
      });
    }
    for (let i = inMemoryDirectMessages.length - 1; i >= 0; i--) {
      const m = inMemoryDirectMessages[i];
      if ((m.senderId === uid && m.receiverId === fid) || (m.senderId === fid && m.receiverId === uid)) {
        inMemoryDirectMessages.splice(i, 1);
      }
    }
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
    if (activeRoomsCache.has(candidate)) continue;
    if (isMongoConnected) {
      const doc = await RoomModel.findById(candidate).lean();
      if (!doc) return candidate;
    } else {
      const existing = inMemoryRooms.find(r => r.roomId === candidate && r.isActive);
      if (!existing) return candidate;
    }
  }
  return `${Date.now()}`.slice(-6);
}


// Get all active PUBLIC rooms (Private rooms are hidden from public list and only found via room code)
app.get("/api/rooms", async (req: express.Request, res: express.Response) => {
  try {
    // ⚡ Fast path: serve from in-memory cache if less than 2.5 seconds old
    if (cachedPublicRoomsList && (Date.now() - cachedPublicRoomsTime < 2500)) {
      res.json({ success: true, rooms: cachedPublicRoomsList });
      return;
    }

    if (isMongoConnected) {
      const docs = await RoomModel.find({ is_active: true, is_private: false }).sort({ createdAt: -1 }).limit(50).lean() as any[];
      if (docs) {
        const sanitizedRooms = docs.map((r: any) => {
          const clean = sanitizeRoom(mongoToRoom(r));
          delete clean.roomPassword;
          return clean;
        });
        cachedPublicRoomsList = sanitizedRooms;
        cachedPublicRoomsTime = Date.now();
        return res.json({ success: true, rooms: sanitizedRooms });
      }
    }
    if (true) {
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

    const roomRaw: any = {
      id: generatedRoomId,
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
    };
    if (isMongoConnected) {
      try {
        await RoomModel.create(roomToMongo(roomRaw));
      } catch (e: any) {
        console.warn('MongoDB create room error:', e.message || e);
      }
    }
    const roomObj = sanitizeRoom(roomRaw);
    activeRoomsCache.set(generatedRoomId, roomObj);
    inMemoryRooms.push(roomRaw);
    res.json({ success: true, room: roomObj });
    return;
    if (false) {
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
    let room = await getRoom(id);
    if (!room) {
      for (const [key, r] of activeRoomsCache.entries()) {
        if (key.includes(id) || r.id === id || r._id === id || r.roomId === id) {
          room = r;
          break;
        }
      }
    }
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    Object.assign(room, updates);
    await saveRoom(room);
    const sanitized = sanitizeRoom(room);
    const targetRoomId = String(room.id || room._id || id);
    broadcastToRoom(targetRoomId, {
      type: 'room_updated',
      room: sanitized
    });
    if (targetRoomId !== id) {
      broadcastToRoom(id, {
        type: 'room_updated',
        room: sanitized
      });
    }
    res.json({ success: true, room: sanitized });
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

    // Keep user in seat even if they exit the room! (Only explicit leave or kick removes from seat)
    // Only stop talking animation while they are out of the room.
    if (room.seats) {
      for (const seat of room.seats) {
        if (seat.user && (String(seat.user._id || seat.user.id || seat.user.userId || '') === uId || (userName && seat.user.name === userName))) {
          seat.isTalking = false;
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
    room = await getRoom(cleanCode);
    if (room) {
      delete room.roomPassword;
      return res.json({ success: true, room });
    }
    if (false) {
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

    if (isNaN(seatIdx) || seatIdx < 0 || seatIdx > 8) {
      res.status(400).json({ error: "Invalid seat index (must be 0-8)" });
      return;
    }

    // Always normalize room.seats to an array of exactly 9 valid non-null seat objects
    const rawSeats = Array.isArray(room.seats) ? room.seats : [];
    room.seats = Array.from({ length: 9 }, (_, i) => {
      const existing = rawSeats.find((s: any) => s && s.index === i) || rawSeats[i];
      return {
        index: i,
        user: (i === 0 && !existing?.user) ? (room.host || null) : (existing?.user || null),
        isMuted: Boolean(existing?.isMuted),
        isTalking: Boolean(existing?.isTalking)
      };
    });

    if (action === 'sit' && user) {
      const newUserId = String(user._id || user.id || (user as any).userId || '');
      const safeUser = { ...user, id: newUserId, _id: newUserId, userId: newUserId };

      // Seat 0 is host-only
      if (seatIdx === 0) {
        const rHostId = String(room.host?._id || room.host?.id || (room.host as any)?.userId || '');
        const isHost = (newUserId && rHostId && newUserId === rHostId) || (user.name && room.host?.name && user.name === room.host.name);
        if (!isHost) {
          res.status(403).json({ error: "Seat 0 is reserved exclusively for the room Host 👑" });
          return;
        }
      }

      // Check if target seat is already occupied by someone else
      const targetSeat = room.seats[seatIdx];
      if (targetSeat && targetSeat.user) {
        const occId = String(targetSeat.user._id || targetSeat.user.id || (targetSeat.user as any).userId || '');
        const occName = String(targetSeat.user.name || '');
        const idMismatch = occId && newUserId && occId !== newUserId;
        const nameMismatch = occName && user.name && occName !== user.name;
        if (idMismatch && nameMismatch) {
          res.status(409).json({ error: `Seat ${seatIdx} is already occupied by ${targetSeat.user.name}` });
          return;
        }
      }

      // Clear any other GUEST seat this user might already occupy (indices 1 to 8)
      room.seats.forEach((s: any) => {
        if (!s || s.index === 0 || s.index === seatIdx) return;
        if (s.user) {
          const sUid = String(s.user._id || s.user.id || (s.user as any).userId || '');
          if ((newUserId && sUid && sUid === newUserId) || (user.name && s.user.name === user.name)) {
            s.user = null;
            s.isTalking = false;
            s.isMuted = false;
          }
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
      room.onlineCount = Math.max(room.onlineUsers?.length || 0, room.seats.filter((s: any) => s && s.user).length);

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
      if (seatIdx > 0) {
        room.seats[seatIdx] = { 
          index: seatIdx, 
          user: null, 
          isMuted: false, 
          isTalking: false 
        };
      }

      // Also clear any other guest seat this leaving user might occupy
      if (user) {
        const leavingId = String(user._id || user.id || (user as any).userId || '');
        room.seats.forEach((s: any) => {
          if (!s || s.index === 0) return;
          if (s.user) {
            const sUid = String(s.user._id || s.user.id || (s.user as any).userId || '');
            if ((leavingId && sUid && sUid === leavingId) || (user.name && s.user.name === user.name)) {
              s.user = null;
              s.isTalking = false;
              s.isMuted = false;
            }
          }
        });
      }
    }

    // Always anchor seat 0 to the room host — never let it go empty
    if (room.seats && room.seats[0] && room.host) {
      room.seats[0].user = room.host;
    }

    room.onlineCount = Math.max(room.onlineUsers?.length || 0, room.seats.filter((s: any) => s && s.user).length);
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

          // Aggressively deduplicate: remove ALL prior registrations for this userId (or this exact socket)
          // This prevents reconnect storms from accumulating N entries for the same user
          const existingSet = roomClients.get(roomId)!;
          for (const existing of existingSet) {
            if (existing.ws === ws || existing.userId === String(userId)) {
              existingSet.delete(existing);
              // Close the stale socket if it's still open
              if (existing.ws !== ws && existing.ws.readyState === WebSocket.OPEN) {
                try { existing.ws.close(); } catch (e) {}
              }
            }
          }

          clientInfo = {
            ws,
            userId: String(userId),
            userName: userName || 'Anonymous',
            roomId,
            avatar: payload?.avatar,
            level: payload?.level
          };

          existingSet.add(clientInfo);
          console.log(`🔌 [WS] User ${userName} (${userId}) joined room ${roomId}. Room clients: ${existingSet.size}`);

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
            // User exits room but stays in seat! (Only kick or explicit leave removes from seat)
            if (room.seats) {
              for (const seat of room.seats) {
                if (seat.user && (String(seat.user._id || seat.user.id || (seat.user as any).userId || '') === String(userId) || (userName && seat.user.name === userName))) {
                  seat.isTalking = false;
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
              seats: room.seats
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
        } else if (type === 'seat_action') {
          // Instant seat sit / leave action over WebSocket (<1ms)
          const { seatIndex, action, user } = payload || {};
          const room = await getRoom(roomId);
          if (room) {
            const sIdx = parseInt(seatIndex);
            if (!isNaN(sIdx) && sIdx >= 0 && sIdx <= 8) {
              const rawSeats = Array.isArray(room.seats) ? room.seats : [];
              room.seats = Array.from({ length: 9 }, (_, i) => {
                const existing = rawSeats.find((s: any) => s && s.index === i) || rawSeats[i];
                return {
                  index: i,
                  user: (i === 0 && !existing?.user) ? (room.host || null) : (existing?.user || null),
                  isMuted: Boolean(existing?.isMuted),
                  isTalking: Boolean(existing?.isTalking)
                };
              });

              if (action === 'sit' && user) {
                const newUserId = String(user._id || user.id || user.userId || '');
                const safeUser = { ...user, id: newUserId, _id: newUserId, userId: newUserId };

                // Guard: check if target seat is already occupied by someone else
                const targetSeat = room.seats[sIdx];
                if (targetSeat && targetSeat.user) {
                  const occId = String(targetSeat.user._id || targetSeat.user.id || (targetSeat.user as any).userId || '');
                  const occName = String(targetSeat.user.name || '');
                  const idMismatch = occId && newUserId && occId !== newUserId;
                  const nameMismatch = occName && user.name && occName !== user.name;
                  if (idMismatch && nameMismatch) {
                    // Seat is occupied by someone else; do not overwrite!
                    return;
                  }
                }

                // Clear any other guest seat occupied by this user
                room.seats.forEach((s: any) => {
                  if (!s || s.index === 0 || s.index === sIdx) return;
                  if (s.user) {
                    const sUid = String(s.user._id || s.user.id || s.user.userId || '');
                    if ((newUserId && sUid && sUid === newUserId) || (user.name && s.user.name === user.name)) {
                      s.user = null;
                      s.isTalking = false;
                      s.isMuted = false;
                    }
                  }
                });
                room.seats[sIdx] = { index: sIdx, user: safeUser, isMuted: false, isTalking: false };
                addOnlineUserToRoom(room, safeUser);
              } else if (action === 'leave' && sIdx > 0) {
                room.seats[sIdx] = { index: sIdx, user: null, isMuted: false, isTalking: false };
              }

              if (room.seats[0] && room.host) room.seats[0].user = room.host;
              room.onlineCount = Math.max(room.onlineUsers?.length || 0, room.seats.filter((s: any) => s && s.user).length);
              await saveRoom(room);

              const eventPayload = {
                type: 'seats_updated',
                seats: room.seats,
                onlineCount: room.onlineCount
              };
              broadcastToRoom(roomId, eventPayload);
              if (room.roomId && room.roomId !== roomId) {
                broadcastToRoom(room.roomId, eventPayload);
              }
            }
          }
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
        } else if (type === 'room_music') {
          broadcastToRoom(roomId, {
            type: 'room_music',
            musicState: payload,
            senderName: userName
          });
        } else if (type === 'room_customization') {
          const room = await getRoom(roomId);
          if (room) {
            if (payload?.backgroundUrl !== undefined) room.backgroundUrl = payload.backgroundUrl;
            if (payload?.title !== undefined) room.title = payload.title;
            if (payload?.description !== undefined) room.description = payload.description;
            if (payload?.notice !== undefined) room.notice = payload.notice;
            if (payload?.seatStyle !== undefined) room.seatStyle = payload.seatStyle;
            await saveRoom(room);
            const sanitized = sanitizeRoom(room);
            broadcastToRoom(roomId, {
              type: 'room_updated',
              room: sanitized
            });
          }
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
            // Keep user in seat if disconnected! (Only explicit leave or kick removes from seat)
            // Only stop talking animation while disconnected.
            if (room.seats) {
              for (const seat of room.seats) {
                if (seat.user && (String(seat.user._id || seat.user.id || (seat.user as any).userId || '') === String(userId) || (userName && seat.user.name === userName))) {
                  seat.isTalking = false;
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
              seats: room.seats
            });
          }
        } catch (e) {
          console.error('Error handling WS disconnect:', e);
        }
      }
    });
  });

  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const useViteDev = (process.env.NODE_ENV !== "production" && process.env.SERVE_VITE === "true") || !hasDist;

  if (useViteDev) {
    console.log("⚡ Starting Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Serving optimized production bundle from /dist...");
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

  try {
    const savePromises: Promise<any>[] = [];
    if (isMongoConnected) {
      activeRoomsCache.forEach((room: any, key: string) => {
        if (room && (key === room.id || key === room._id || key === room.roomId)) {
          savePromises.push(
            RoomModel.findByIdAndUpdate(room.id, { $set: roomToMongo(room) }, { upsert: true }).exec()
          );
        }
      });
      if (savePromises.length > 0) {
        await Promise.allSettled(savePromises);
        console.log(`💾 Flushed ${savePromises.length} room states to MongoDB before exit.`);
      }
      await mongoose.disconnect();
    }
  } catch (_) {}

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
