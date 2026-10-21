import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure .env variables are loaded even when imported before server body
dotenv.config();

// Environment credentials for Supabase
const supabaseUrl = (typeof process !== 'undefined' ? (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) : '') || '';
const supabaseKey = (typeof process !== 'undefined' ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY) : '') || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  !supabaseKey.includes('YOUR_SUPABASE')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

if (isSupabaseConfigured) {
  console.log('⚡ [Supabase] Connected successfully to project:', supabaseUrl.split('//')[1]?.split('.')[0] || 'active');
} else {
  console.log('ℹ️ [Supabase] Not configured yet in .env (add SUPABASE_URL and SUPABASE_KEY to enable Supabase)');
}

// ============================================================================
// HIGH-PERFORMANCE SUPABASE DATABASE ADAPTER
// ============================================================================

export const supabaseDb = {
  // --- USERS ---
  async getUserById(id: string) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return formatUser(data);
    } catch {
      return null;
    }
  },

  async getUserByEmail(email: string) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email.trim().toLowerCase())
        .maybeSingle();
      if (error || !data) return null;
      return formatUser(data);
    } catch {
      return null;
    }
  },

  async getUserByNameOrId(identifier: string) {
    if (!supabase) return null;
    try {
      const clean = identifier.trim();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.${clean},yoyo_id.eq.${clean},name.ilike.${clean}`)
        .maybeSingle();
      if (error || !data) return null;
      return formatUser(data);
    } catch {
      return null;
    }
  },

  async createUser(userData: any) {
    if (!supabase) return null;
    try {
      const row = {
        id: String(userData.id || userData._id),
        name: userData.name,
        email: userData.email?.toLowerCase(),
        password: userData.password,
        role: userData.role || 'user',
        avatar: userData.avatar,
        level: userData.level || 1,
        coins: Number(userData.coins ?? 1000),
        frame_id: userData.frameId || 'none',
        bubble_id: userData.bubbleId || 'none',
        badge: userData.badge || '🐣 Beginner',
        yoyo_id: String(userData.yoyoId || Math.floor(100000 + Math.random() * 900000)),
        bio: userData.bio || 'Living life on ZOYO! 🌟',
        country: userData.country || 'India',
        gender: userData.gender || 'Male',
        date_of_birth: userData.dateOfBirth || '2005-01-01',
        is_blocked: Boolean(userData.isBlocked),
        recent_visitors: userData.recentVisitors || []
      };
      const { data, error } = await supabase
        .from('users')
        .insert(row)
        .select('*')
        .single();
      if (error) {
        console.error('Supabase createUser error:', error);
        return null;
      }
      return formatUser(data);
    } catch (e) {
      console.error('Supabase createUser exception:', e);
      return null;
    }
  },

  async updateUser(id: string, updates: any) {
    if (!supabase) return null;
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.email !== undefined) payload.email = updates.email;
      if (updates.avatar !== undefined) payload.avatar = updates.avatar;
      if (updates.coins !== undefined) payload.coins = Number(updates.coins);
      if (updates.level !== undefined) payload.level = Number(updates.level);
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.frameId !== undefined) payload.frame_id = updates.frameId;
      if (updates.bubbleId !== undefined) payload.bubble_id = updates.bubbleId;
      if (updates.badge !== undefined) payload.badge = updates.badge;
      if (updates.bio !== undefined) payload.bio = updates.bio;
      if (updates.country !== undefined) payload.country = updates.country;
      if (updates.gender !== undefined) payload.gender = updates.gender;
      if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
      if (updates.isBlocked !== undefined) payload.is_blocked = Boolean(updates.isBlocked);
      if (updates.recentVisitors !== undefined) payload.recent_visitors = updates.recentVisitors;

      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) return null;
      return formatUser(data);
    } catch {
      return null;
    }
  },

  async getAllUsers() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map(formatUser);
    } catch {
      return [];
    }
  },

  async deleteUser(id: string) {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // --- ROOMS ---
  async getRoom(id: string) {
    if (!supabase) return null;
    try {
      const clean = id.trim();
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', clean)
        .maybeSingle();
      if (error || !data) return null;
      return formatRoom(data);
    } catch {
      return null;
    }
  },

  async getAllRooms() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map(formatRoom);
    } catch {
      return [];
    }
  },

  async createRoom(room: any) {
    if (!supabase) return null;
    try {
      const row = {
        id: String(room.id || room._id),
        title: room.title,
        description: room.description || '',
        host: room.host,
        theme: room.theme || 'neon',
        category: room.category || 'chat',
        online_count: Number(room.onlineCount || 1),
        active_game: room.activeGame || 'none',
        is_official_game: Boolean(room.isOfficialGame),
        game_prize_pool: Number(room.gamePrizePool || 0),
        background_url: room.backgroundUrl || '',
        room_image: room.roomImage || '',
        is_active: true,
        is_private: Boolean(room.isPrivate),
        room_password: String(room.roomPassword || ''),
        invited_users: room.invitedUsers || [],
        seats: room.seats || [],
        online_users: room.onlineUsers || [],
        chat_messages: room.chatMessages || []
      };
      const { data, error } = await supabase
        .from('rooms')
        .upsert(row)
        .select('*')
        .single();
      if (error) {
        console.error('Supabase createRoom error:', error);
        return null;
      }
      return formatRoom(data);
    } catch (e) {
      console.error('Supabase createRoom exception:', e);
      return null;
    }
  },

  async saveRoom(room: any) {
    if (!supabase) return null;
    try {
      const id = String(room.id || room._id);
      const row = {
        title: room.title,
        description: room.description || '',
        host: room.host,
        theme: room.theme,
        category: room.category,
        online_count: Number(room.onlineCount || 1),
        active_game: room.activeGame || 'none',
        is_official_game: Boolean(room.isOfficialGame),
        game_prize_pool: Number(room.gamePrizePool || 0),
        background_url: room.backgroundUrl || '',
        is_active: room.isActive !== undefined ? Boolean(room.isActive) : true,
        is_private: Boolean(room.isPrivate),
        room_password: String(room.roomPassword || ''),
        invited_users: room.invitedUsers || [],
        seats: room.seats || [],
        online_users: room.onlineUsers || [],
        chat_messages: room.chatMessages || [],
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('rooms')
        .update(row)
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  // --- COIN TRANSFERS / LEDGER ---
  async logTransfer(logData: any) {
    if (!supabase) return null;
    try {
      const row = {
        sender_id: String(logData.senderId),
        sender_name: logData.senderName,
        sender_role: logData.senderRole || 'user',
        receiver_id: String(logData.receiverId),
        receiver_name: logData.receiverName,
        amount: Number(logData.amount),
        type: logData.type || 'transfer',
        details: logData.details || '',
        icon: logData.icon || '🪙'
      };
      const { data, error } = await supabase
        .from('transfer_logs')
        .insert(row)
        .select('*')
        .single();
      if (error) return null;
      return formatTransfer(data);
    } catch {
      return null;
    }
  },

  async getTransfers(limit = 50, userId?: string) {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('transfer_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (userId) {
        query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map(formatTransfer);
    } catch {
      return [];
    }
  },

  // --- CATALOG ---
  async getGifts() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('catalog_gifts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  async createGift(gift: any) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('catalog_gifts')
        .upsert(gift)
        .select('*')
        .single();
      return error ? null : data;
    } catch {
      return null;
    }
  },

  async getFrames() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('catalog_frames')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  async createFrame(frame: any) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('catalog_frames')
        .upsert(frame)
        .select('*')
        .single();
      return error ? null : data;
    } catch {
      return null;
    }
  },

  async getGames() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('custom_games')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  async createGame(game: any) {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('custom_games')
        .upsert(game)
        .select('*')
        .single();
      return error ? null : data;
    } catch {
      return null;
    }
  },

  async deleteGift(id: string) {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('catalog_gifts').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  async deleteFrame(id: string) {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('catalog_frames').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  async deleteGame(id: string) {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('custom_games').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }
};

// ============================================================================
// HELPER NORMALIZERS (DB Snake_Case -> App CamelCase)
// ============================================================================

function formatUser(row: any) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    avatar: row.avatar,
    level: row.level,
    coins: Number(row.coins),
    frameId: row.frame_id,
    bubbleId: row.bubble_id,
    badge: row.badge,
    yoyoId: row.yoyo_id,
    bio: row.bio,
    country: row.country,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    isBlocked: Boolean(row.is_blocked),
    recentVisitors: row.recent_visitors || [],
    createdAt: row.created_at
  };
}

function formatRoom(row: any) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    roomId: row.id,
    title: row.title,
    description: row.description || '',
    host: row.host,
    theme: row.theme,
    category: row.category,
    onlineCount: Number(row.online_count || 1),
    activeGame: row.active_game || 'none',
    isOfficialGame: Boolean(row.is_official_game),
    gamePrizePool: Number(row.game_prize_pool || 0),
    backgroundUrl: row.background_url || '',
    roomImage: row.room_image || '',
    isActive: row.is_active,
    isPrivate: Boolean(row.is_private),
    roomPassword: row.room_password || '',
    invitedUsers: row.invited_users || [],
    seats: row.seats || [],
    onlineUsers: row.online_users || [],
    chatMessages: row.chat_messages || [],
    createdAt: row.created_at
  };
}

function formatTransfer(row: any) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    receiverId: row.receiver_id,
    receiverName: row.receiver_name,
    amount: Number(row.amount),
    type: row.type,
    details: row.details,
    icon: row.icon,
    timestamp: row.created_at
  };
}
