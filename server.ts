import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// MongoDB connection with Graceful Fallback
let isMongoConnected = false;
const MONGODB_URI = process.env.MONGODB_URI;

// User database schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
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
  vipStatus: { type: String, default: 'None' }
}, { timestamps: true });

const UserMongo: any = mongoose.models.User || mongoose.model('User', UserSchema);

// Coin transfer transaction log schema
const TransferLogSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  receiverId: { type: String, required: true },
  receiverName: { type: String, required: true },
  amount: { type: Number, required: true },
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
  activeGame: { type: String, enum: ['none', 'ludo', 'dice', 'wheel'], default: 'none' },
  backgroundUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  seats: [{
    index: { type: Number, required: true },
    user: { type: Object, default: null },
    isMuted: { type: Boolean, default: false },
    isTalking: { type: Boolean, default: false }
  }]
});

const RoomMongo: any = mongoose.models.Room || mongoose.model('Room', RoomSchema);

// In-memory transfer log
interface InMemTransferLog {
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  amount: number;
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
  activeGame: 'none' | 'ludo' | 'dice' | 'wheel';
  backgroundUrl: string;
  isActive: boolean;
  seats: Array<{ index: number; user: any | null; isMuted: boolean; isTalking: boolean }>;
  createdAt: string;
}

const inMemoryRooms: InMemRoom[] = [];

async function logTransfer(logData: any) {
  if (isMongoConnected) {
    await TransferLogMongo.create(logData);
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
}

const inMemoryDB: InMemUser[] = [
  {
    _id: "admin_static",
    name: "Admin",
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
    vipStatus: "None"
  }
];

async function connectToMongo() {
  if (!MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI environment variable is missing. Running in in-memory fallback mode.");
    return;
  }
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI);
    isMongoConnected = true;
    console.log("🔌 Connected successfully to MongoDB Atlas!");

    // Seed Admin account in MongoDB Atlas if missing
    const adminExists = await UserMongo.findOne({ name: "Admin" });
    if (!adminExists) {
      await UserMongo.create({
        name: "Admin",
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
      console.log("✅ Seeded Admin user in MongoDB Atlas.");
    }
  } catch (err) {
    console.error("❌ MongoDB Atlas connection error:", err);
    console.warn("⚠️ Falling back to in-memory mode.");
  }
}

connectToMongo();

// Helper to query database depending on status
async function getUsers() {
  if (isMongoConnected) {
    return await UserMongo.find({}, '-password');
  } else {
    return inMemoryDB.map(({ password, ...u }) => u);
  }
}

async function findUserByName(name: string) {
  const normalized = name.toLowerCase().trim();
  if (isMongoConnected) {
    return await UserMongo.findOne({
      $or: [
        { name: new RegExp(`^${normalized}$`, 'i') },
        { email: normalized }
      ]
    });
  } else {
    return inMemoryDB.find(u => u.name.toLowerCase() === normalized || u.email?.toLowerCase() === normalized);
  }
}

async function findUserByPhone(phone: string) {
  if (!phone) return null;
  const cleaned = phone.trim();
  if (isMongoConnected) {
    return await UserMongo.findOne({ phoneNumber: cleaned });
  } else {
    return inMemoryDB.find(u => u.phoneNumber === cleaned);
  }
}

async function findUserByEmail(email: string) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  if (isMongoConnected) {
    return await UserMongo.findOne({ email: cleaned });
  } else {
    return inMemoryDB.find(u => u.email?.toLowerCase() === cleaned);
  }
}

async function findUserBySocial(provider: string, socialId: string) {
  if (!provider || !socialId) return null;
  if (isMongoConnected) {
    return await UserMongo.findOne({ socialProvider: provider, socialId: socialId });
  } else {
    return inMemoryDB.find(u => u.socialProvider === provider && u.socialId === socialId);
  }
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

  if (isMongoConnected) {
    return await UserMongo.create(fullData);
  } else {
    const newUser: InMemUser = {
      _id: `user_${Date.now()}`,
      name: fullData.name,
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
    return newUser;
  }
}

async function updateUser(id: string, updateData: any) {
  if (isMongoConnected) {
    return await UserMongo.findByIdAndUpdate(id, { $set: updateData }, { new: true });
  } else {
    const index = inMemoryDB.findIndex(u => u._id === id);
    if (index !== -1) {
      inMemoryDB[index] = { ...inMemoryDB[index], ...updateData };
      return inMemoryDB[index];
    }
    return null;
  }
}

// --- API ENDPOINTS ---

// Server health / db status
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: isMongoConnected,
    mode: isMongoConnected ? "MongoDB Atlas" : "In-Memory Fallback"
  });
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

    const user = await findUserByName(username);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    if (user.password !== password) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({ error: "Your account is blocked. Please contact your administrator or manager." });
      return;
    }

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
    const { username, password, avatar, coins, gender, dateOfBirth, country, phoneNumber, email } = req.body;
    if (!username || !password || !gender || !dateOfBirth || !country || (!phoneNumber && !email)) {
      res.status(400).json({ error: "All details (Username, Password, Email/Phone, Gender, Date of Birth, and Country) are mandatory." });
      return;
    }

    const existingName = await findUserByName(username);
    if (existingName) {
      res.status(400).json({ error: "Username already exists." });
      return;
    }

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

    const newUser = await createUser({
      name: username.trim(),
      password: password.trim(),
      role: 'user',
      avatar: avatar,
      coins: Number(coins) || 0, // Users start with 0 coins
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

// Get user status endpoint (to handle block/ban check dynamically)
app.get("/api/users/:id/status", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    let user: any = null;
    if (isMongoConnected) {
      user = await UserMongo.findById(id);
    } else {
      user = inMemoryDB.find(u => u._id === id);
    }

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

    // Retrieve sender and receiver to execute deduction & credit
    let senderUser: any = null;
    let targetUser: any = null;

    if (isMongoConnected) {
      senderUser = await UserMongo.findById(senderId);
      targetUser = await UserMongo.findById(id);
    } else {
      senderUser = inMemoryDB.find(u => u._id === senderId);
      targetUser = inMemoryDB.find(u => u._id === id);
    }

    if (!senderUser) {
      res.status(404).json({ error: "Sender user account not found" });
      return;
    }

    if (!targetUser) {
      res.status(404).json({ error: "Recipient user account not found" });
      return;
    }

    // Deduct from sender (allow Admin unlimited mint/bypass if wanted, but managers/coin sellers must have enough coins!)
    const senderRole = senderUser.role || 'user';
    const isSenderAdmin = senderRole === 'admin';

    if (!isSenderAdmin && (senderUser.coins || 0) < parsedAmount) {
      res.status(400).json({ error: `Insufficient coins balance. You only have 🪙 ${senderUser.coins} coins.` });
      return;
    }

    // Deduct coins from sender
    let updatedSenderCoins = senderUser.coins || 0;
    if (!isSenderAdmin) {
      updatedSenderCoins = Math.max(0, (senderUser.coins || 0) - parsedAmount);
      await updateUser(senderId, { coins: updatedSenderCoins });
    } else {
      // Admin has infinite coins, keep it at 999999999!
      updatedSenderCoins = 999999999;
      await updateUser(senderId, { coins: 999999999 });
    }

    // Credit coins to recipient
    const receiverNewCoins = (targetUser.coins || 0) + parsedAmount;
    const updatedTargetUser = await updateUser(id, { coins: receiverNewCoins });

    // Log this transaction!
    await logTransfer({
      senderId: senderUser._id || senderUser.id,
      senderName: senderUser.name,
      senderRole: senderRole,
      receiverId: targetUser._id || targetUser.id,
      receiverName: targetUser.name,
      amount: parsedAmount
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

// --- VOICE ROOM ENDPOINTS ---

// Get all active rooms
app.get("/api/rooms", async (req: express.Request, res: express.Response) => {
  try {
    if (isMongoConnected) {
      const rooms = await RoomMongo.find({ isActive: true }).sort({ createdAt: -1 });
      res.json({ success: true, rooms });
    } else {
      const activeRooms = inMemoryRooms.filter(r => r.isActive);
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
    const { title, description, host, theme, category, backgroundUrl } = req.body;

    if (!title || !host) {
      res.status(400).json({ error: "Title and host are required" });
      return;
    }

    if (isMongoConnected) {
      const seatsArray = Array.from({ length: 9 }, (_, i) => ({
        index: i,
        user: i === 0 ? host : null,
        isMuted: false,
        isTalking: false
      }));

      const newRoom = await RoomMongo.create({
        title,
        description: description || `Welcome to ${host.name}'s voice room!`,
        host,
        theme: theme || 'neon',
        category: category || 'chat',
        onlineCount: 1,
        activeGame: 'none',
        backgroundUrl: backgroundUrl || '',
        isActive: true,
        seats: seatsArray
      });
      res.json({ success: true, room: newRoom });
    } else {
      const newRoom: InMemRoom = {
        id: `room_${Date.now()}`,
        title,
        description: description || `Welcome to ${host.name}'s voice room!`,
        host,
        theme: theme || 'neon',
        category: category || 'chat',
        onlineCount: 1,
        activeGame: 'none',
        backgroundUrl: backgroundUrl || '',
        isActive: true,
        seats: Array.from({ length: 9 }, (_, i) => ({
          index: i,
          user: i === 0 ? host : null,
          isMuted: false,
          isTalking: false
        })),
        createdAt: new Date().toISOString()
      };
      inMemoryRooms.push(newRoom);
      res.json({ success: true, room: newRoom });
    }
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update room (online count, active game, etc.)
app.post("/api/rooms/:id/update", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (isMongoConnected) {
      const updated = await RoomMongo.findByIdAndUpdate(id, { $set: updates }, { new: true });
      if (!updated) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      res.json({ success: true, room: updated });
    } else {
      const index = inMemoryRooms.findIndex(r => r.id === id);
      if (index === -1) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      inMemoryRooms[index] = { ...inMemoryRooms[index], ...updates };
      res.json({ success: true, room: inMemoryRooms[index] });
    }
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete/Close a room
app.delete("/api/rooms/:id", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    if (isMongoConnected) {
      const deleted = await RoomMongo.findByIdAndUpdate(id, { isActive: false }, { new: true });
      if (!deleted) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      res.json({ success: true, message: "Room closed" });
    } else {
      const index = inMemoryRooms.findIndex(r => r.id === id);
      if (index === -1) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      inMemoryRooms[index].isActive = false;
      res.json({ success: true, message: "Room closed" });
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- SEAT SYNCHRONIZATION ENDPOINTS ---

// Get room with current seats
app.get("/api/rooms/:id/seats", async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    if (isMongoConnected) {
      const room = await RoomMongo.findById(id);
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      res.json({ success: true, room });
    } else {
      const room = inMemoryRooms.find(r => r.id === id);
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      res.json({ success: true, room });
    }
  } catch (error) {
    console.error('Error fetching room seats:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update seat - User sits or leaves (WITH VALIDATION)
app.post("/api/rooms/:id/seat/:seatIndex", async (req: express.Request, res: express.Response) => {
  try {
    const { id, seatIndex } = req.params;
    const { user, action } = req.body; // action: 'sit' or 'leave'

    const seatIdx = parseInt(seatIndex);

    if (isMongoConnected) {
      const room = await RoomMongo.findById(id);
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      if (!room.seats) {
        room.seats = Array.from({ length: 9 }, (_, i) => ({
          index: i,
          user: i === 0 ? room.host : null,
          isMuted: false,
          isTalking: false
        }));
      }

      if (action === 'sit' && user) {
        // VALIDATION: Check if seat is already occupied
        if (room.seats[seatIdx] && room.seats[seatIdx].user) {
          const occupiedBy = room.seats[seatIdx].user;
          if (occupiedBy.id !== user.id) {
            res.status(409).json({ error: "Seat already occupied by " + occupiedBy.name });
            return;
          }
        }
        console.log(`✅ User ${user.name} sitting in seat ${seatIdx}`);
        room.seats[seatIdx] = { index: seatIdx, user: { ...user }, isMuted: false, isTalking: false };
        room.onlineCount = room.seats.filter(s => s.user).length;
      } else if (action === 'leave') {
        console.log(`👋 User leaving seat ${seatIdx}`);
        room.seats[seatIdx] = { index: seatIdx, user: null, isMuted: false, isTalking: false };
        room.onlineCount = room.seats.filter(s => s.user).length;
      }

      await room.save();
      console.log(`📡 Saved room ${id} with ${room.onlineCount} users`);
      res.json({ success: true, room });
    } else {
      const roomIdx = inMemoryRooms.findIndex(r => r.id === id);
      if (roomIdx === -1) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      const room = inMemoryRooms[roomIdx];
      if (!room.seats) {
        room.seats = Array.from({ length: 9 }, (_, i) => ({
          index: i,
          user: i === 0 ? room.host : null,
          isMuted: false,
          isTalking: false
        }));
      }

      if (action === 'sit' && user) {
        // VALIDATION: Check if seat is already occupied
        if (room.seats[seatIdx] && room.seats[seatIdx].user) {
          const occupiedBy = room.seats[seatIdx].user;
          if (occupiedBy.id !== user.id) {
            res.status(409).json({ error: "Seat already occupied by " + occupiedBy.name });
            return;
          }
        }
        console.log(`✅ User ${user.name} sitting in seat ${seatIdx}`);
        room.seats[seatIdx] = { index: seatIdx, user: { ...user }, isMuted: false, isTalking: false };
        room.onlineCount = room.seats.filter(s => s.user).length;
      } else if (action === 'leave') {
        console.log(`👋 User leaving seat ${seatIdx}`);
        room.seats[seatIdx] = { index: seatIdx, user: null, isMuted: false, isTalking: false };
        room.onlineCount = room.seats.filter(s => s.user).length;
      }

      console.log(`📡 Updated in-memory room ${id} with ${room.onlineCount} users`);
      res.json({ success: true, room });
    }
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve frontend assets and hook up Vite Dev Server middleware
async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
