import { Gift, ShopItem } from './types';

export const GIFTS: Gift[] = [
  {
    id: 'g_rose',
    name: 'Red Rose',
    coins: 10,
    icon: '🌹',
    effect: 'rose',
    description: 'Express your affection with a beautiful rose shower!'
  },
  {
    id: 'g_crown',
    name: 'Royal Crown',
    coins: 99,
    icon: '👑',
    effect: 'crown',
    description: 'Crown the host and show their absolute royalty!'
  },
  {
    id: 'g_car',
    name: 'Golden Supercar',
    coins: 299,
    icon: '🏎️',
    effect: 'car',
    description: 'Drive onto the screen in style with an animated hypercar!'
  },
  {
    id: 'g_rocket',
    name: 'Cosmic Rocket',
    coins: 599,
    icon: '🚀',
    effect: 'rocket',
    description: 'Launch the voice room directly into outer space!'
  }
];

export const SHOP_ITEMS: ShopItem[] = [
  // Coins
  { id: 'coin_p1', name: '100 Coins Package', price: 0.99, type: 'coins', value: 100, icon: '🪙' },
  { id: 'coin_p2', name: '550 Coins + Bonus', price: 4.99, type: 'coins', value: 550, icon: '🪙' },
  { id: 'coin_p3', name: '1,200 Coins Master', price: 9.99, type: 'coins', value: 1200, icon: '🪙' },
  { id: 'coin_p4', name: '3,000 Coins Tycoon', price: 24.99, type: 'coins', value: 3000, icon: '🪙' },
  // Avatar Frames
  { id: 'frame_neon', name: 'Cyber Neon Aura', price: 150, type: 'frame', value: 'border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]', icon: '💫' },
  { id: 'frame_pink', name: 'Sakura Angel Halo', price: 200, type: 'frame', value: 'border-2 border-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)] animate-[bounce_3s_infinite]', icon: '🌸' },
  { id: 'frame_royal', name: 'Imperial Gold Crown', price: 400, type: 'frame', value: 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]', icon: '👑' },
  { id: 'frame_cosmic', name: 'Cosmic Fire Ring', price: 350, type: 'frame', value: 'border-2 border-purple-500 animate-[spin_8s_linear_infinite]', icon: '🌌' },
  // Chat Bubble Styles
  { id: 'bubble_neon', name: 'Cyber Neon Bubble', price: 100, type: 'bubble', value: 'bg-cyan-950/40 border border-cyan-400 text-cyan-100', icon: '💬' },
  { id: 'bubble_pink', name: 'Princess Sakura', price: 120, type: 'bubble', value: 'bg-pink-950/40 border border-pink-400 text-pink-100', icon: '🌸' },
  { id: 'bubble_royal', name: 'Imperial Majesty', price: 250, type: 'bubble', value: 'bg-amber-950/40 border border-amber-400 text-amber-100', icon: '👑' }
];

export const AUDIO_TRACKS = [
  { id: 'bg_1', name: 'Chill Lofi Beats', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: '6:12', artist: 'Lofi Dream' },
  { id: 'bg_2', name: 'Upbeat Synth Party', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: '7:05', artist: 'Neon Wave' },
  { id: 'bg_3', name: 'Soothing Acoustic Guitar', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', duration: '5:44', artist: 'Golden Sun' },
  { id: 'bg_4', name: 'Midnight Jazz Cafe', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', duration: '5:02', artist: 'Smooth Groove' },
  { id: 'bg_5', name: 'Deep Ambient Chill', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', duration: '4:30', artist: 'Echo Flow' }
];

export const ROOM_WALLPAPERS = [
  {
    id: 'wp_mountain',
    name: 'Alpine Highway & Peak',
    category: 'Scenic',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'wp_neon',
    name: 'Cyber Neon Metropolis',
    category: 'Cyber',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'wp_galaxy',
    name: 'Cosmic Starlight Realm',
    category: 'Space',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'wp_sunset',
    name: 'Golden Sunset Coast',
    category: 'Nature',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&auto=format&fit=crop&q=80'
  },
  {
    id: 'wp_luxury',
    name: 'Imperial Golden Palace',
    category: 'Royal',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=200&auto=format&fit=crop&q=80'
  }
];

export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80'
];
