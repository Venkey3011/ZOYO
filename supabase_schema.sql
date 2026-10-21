-- ==============================================================================
-- ZOYO SUPABASE DATABASE SCHEMA (OPTIMIZED FOR 10,000+ CONCURRENT USERS)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  password TEXT,
  role TEXT DEFAULT 'user', -- 'admin' | 'manager' | 'coin_seller' | 'user'
  avatar TEXT,
  level INTEGER DEFAULT 1,
  coins BIGINT DEFAULT 1000,
  frame_id TEXT DEFAULT 'none',
  bubble_id TEXT DEFAULT 'none',
  badge TEXT DEFAULT '🐣 Beginner',
  yoyo_id TEXT UNIQUE,
  bio TEXT DEFAULT 'Living life on ZOYO! 🌟',
  country TEXT DEFAULT 'India',
  gender TEXT DEFAULT 'Male',
  date_of_birth TEXT DEFAULT '2005-01-01',
  is_blocked BOOLEAN DEFAULT FALSE,
  recent_visitors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_yoyo_id ON public.users(yoyo_id);
CREATE INDEX IF NOT EXISTS idx_users_name ON public.users(name);

-- 2. VOICE & GAME ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  host JSONB NOT NULL,
  theme TEXT DEFAULT 'neon',
  category TEXT DEFAULT 'chat',
  online_count INTEGER DEFAULT 1,
  active_game TEXT DEFAULT 'none',
  is_official_game BOOLEAN DEFAULT FALSE,
  game_prize_pool INTEGER DEFAULT 0,
  background_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  is_private BOOLEAN DEFAULT FALSE,
  room_password TEXT DEFAULT '',
  invited_users JSONB DEFAULT '[]'::jsonb,
  seats JSONB DEFAULT '[]'::jsonb,
  online_users JSONB DEFAULT '[]'::jsonb,
  chat_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup indexes for rooms
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_category ON public.rooms(category);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms(created_at DESC);

-- 3. COIN TRANSFER & TRANSACTION LEDGER
CREATE TABLE IF NOT EXISTS public.transfer_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT DEFAULT 'user',
  receiver_id TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  amount BIGINT NOT NULL,
  type TEXT DEFAULT 'transfer', -- 'transfer' | 'gift' | 'game_spend' | 'game_win' | 'recharge'
  details TEXT DEFAULT '',
  icon TEXT DEFAULT '🪙',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- High-performance ledger indexes
CREATE INDEX IF NOT EXISTS idx_transfer_sender ON public.transfer_logs(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_receiver ON public.transfer_logs(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_type ON public.transfer_logs(type);

-- 4. DYNAMIC CATALOG: GIFTS
CREATE TABLE IF NOT EXISTS public.catalog_gifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coins INTEGER NOT NULL,
  icon TEXT NOT NULL,
  effect TEXT DEFAULT 'rose',
  description TEXT DEFAULT '',
  added_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DYNAMIC CATALOG: FRAMES
CREATE TABLE IF NOT EXISTS public.catalog_frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  value TEXT NOT NULL,
  icon TEXT NOT NULL,
  added_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DYNAMIC CATALOG: CUSTOM GAMES
CREATE TABLE IF NOT EXISTS public.custom_games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Arcade',
  icon TEXT DEFAULT '🎮',
  min_players INTEGER DEFAULT 1,
  max_players INTEGER DEFAULT 4,
  description TEXT DEFAULT '',
  added_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DIRECT MESSAGES
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  text TEXT DEFAULT '',
  media_type TEXT DEFAULT 'text',
  media_url TEXT,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_pair ON public.direct_messages(sender_id, receiver_id, created_at);

-- 8. FRIEND REQUESTS
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  sender_yoyo_id TEXT,
  receiver_id TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_yoyo_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fr_receiver ON public.friend_requests(receiver_id, status);

-- Turn on Row Level Security (RLS) and permit public operations for backend API key
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all tables via Supabase Anon / Service Key
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "Allow public all users" ON public.users FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all transfer_logs" ON public.transfer_logs FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all catalog_gifts" ON public.catalog_gifts FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all catalog_frames" ON public.catalog_frames FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all custom_games" ON public.custom_games FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all direct_messages" ON public.direct_messages FOR ALL USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Allow public all friend_requests" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 9. SEED DEFAULT ADMIN ACCOUNT
INSERT INTO public.users (id, name, email, password, role, avatar, level, coins, frame_id, bubble_id, badge, yoyo_id, bio, country, gender)
VALUES (
  'admin_static',
  'Admin',
  'admin@zoyo.app',
  'Admin123',
  'admin',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  99,
  999999999,
  'frame_royal',
  'bubble_royal',
  '👑 Owner',
  '888888',
  'Living life on ZOYO! 🌟',
  'Global',
  'Male'
)
ON CONFLICT (id) DO NOTHING;

