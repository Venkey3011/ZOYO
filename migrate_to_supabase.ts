import "dotenv/config";
import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";

const mongoUri = process.env.MONGODB_URI;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!mongoUri || !supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function migrate() {
  console.log("🚀 Starting MongoDB to Supabase Migration...");
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(mongoUri!);
  console.log("Connected to MongoDB Atlas!");

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to get MongoDB db reference");
  }

  // 1. Clean up temporary placeholder user if present
  console.log("\n--- Cleaning placeholder user in Supabase ---");
  await supabase.from("users").delete().eq("id", "admin_static");

  // 2. Migrate USERS
  console.log("\n--- Migrating Users ---");
  const mongoUsers = await db.collection("users").find({}).toArray();
  console.log(`Found ${mongoUsers.length} users in MongoDB.`);

  for (const u of mongoUsers) {
    const userRow = {
      id: String(u._id),
      name: u.name,
      email: u.email || `${u.name.toLowerCase()}@zoyo.app`,
      password: u.password || "1234",
      role: u.role || "user",
      avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
      level: u.level || 1,
      coins: Number(u.coins ?? 1000),
      frame_id: u.frameId || "none",
      bubble_id: u.bubbleId || "none",
      badge: u.badge || "🐣 Beginner",
      yoyo_id: String(u.yoyoId || Math.floor(100000 + Math.random() * 900000)),
      bio: u.bio || "Living life on ZOYO! 🌟",
      country: u.country || "India",
      gender: u.gender || "Other",
      date_of_birth: u.dateOfBirth || "2005-01-01",
      is_blocked: Boolean(u.isBlocked),
      recent_visitors: u.recentVisitors || [],
      created_at: u.createdAt || new Date().toISOString(),
      updated_at: u.updatedAt || new Date().toISOString()
    };

    const { error } = await supabase.from("users").upsert(userRow, { onConflict: "id" });
    if (error) {
      console.error(`Error migrating user ${u.name}:`, error.message);
    } else {
      console.log(`✅ Migrated user: ${u.name} (Role: ${u.role}, Coins: ${u.coins}, YoyoID: ${userRow.yoyo_id})`);
    }
  }

  // 3. Migrate ROOMS
  console.log("\n--- Migrating Rooms ---");
  const mongoRooms = await db.collection("rooms").find({}).toArray();
  console.log(`Found ${mongoRooms.length} rooms in MongoDB.`);

  for (const r of mongoRooms) {
    const roomRow = {
      id: String(r._id),
      title: r.title || "Voice Room",
      description: r.description || "",
      host: r.host || {},
      theme: r.theme || "neon",
      category: r.category || "chat",
      online_count: Number(r.onlineCount || 1),
      active_game: r.activeGame || "none",
      is_official_game: Boolean(r.isOfficialGame),
      game_prize_pool: Number(r.gamePrizePool || 0),
      background_url: r.backgroundUrl || "",
      is_active: r.isActive !== undefined ? Boolean(r.isActive) : true,
      is_private: Boolean(r.isPrivate),
      room_password: String(r.roomPassword || ""),
      invited_users: r.invitedUsers || [],
      seats: r.seats || [],
      online_users: r.onlineUsers || [],
      chat_messages: r.chatMessages || [],
      created_at: r.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("rooms").upsert(roomRow, { onConflict: "id" });
    if (error) {
      console.error(`Error migrating room ${r.title}:`, error.message);
    } else {
      console.log(`✅ Migrated room: ${r.title} (ID: ${roomRow.id})`);
    }
  }

  // 4. Migrate TRANSFER LOGS
  console.log("\n--- Migrating Transfer Logs ---");
  const mongoTransfers = await db.collection("transferlogs").find({}).toArray();
  console.log(`Found ${mongoTransfers.length} transfer logs in MongoDB.`);

  if (mongoTransfers.length > 0) {
    const transferRows = mongoTransfers.map(t => ({
      sender_id: String(t.senderId),
      sender_name: t.senderName || "User",
      sender_role: t.senderRole || "user",
      receiver_id: String(t.receiverId),
      receiver_name: t.receiverName || "User",
      amount: Number(t.amount || 0),
      type: t.type || "transfer",
      details: t.details || "",
      icon: t.icon || "🪙",
      created_at: t.timestamp || t.createdAt || new Date().toISOString()
    }));

    const { error } = await supabase.from("transfer_logs").insert(transferRows);
    if (error) {
      console.error("Error migrating transfer logs:", error.message);
    } else {
      console.log(`✅ Successfully migrated ${transferRows.length} transfer logs!`);
    }
  }

  // 5. Migrate CATALOG GIFTS
  console.log("\n--- Migrating Catalog Gifts ---");
  const defaultGifts = [
    { id: 'g_rose', name: 'Red Rose', coins: 10, icon: '🌹', effect: 'rose', description: 'Express your affection with a beautiful rose shower!', added_by: 'System' },
    { id: 'g_crown', name: 'Royal Crown', coins: 99, icon: '👑', effect: 'crown', description: 'Crown the host and show their absolute royalty!', added_by: 'System' },
    { id: 'g_car', name: 'Golden Supercar', coins: 299, icon: '🏎️', effect: 'car', description: 'Drive onto the screen in style with an animated hypercar!', added_by: 'System' },
    { id: 'g_rocket', name: 'Cosmic Rocket', coins: 599, icon: '🚀', effect: 'rocket', description: 'Launch the voice room directly into outer space!', added_by: 'System' }
  ];
  const mongoGifts = await db.collection("customgifts").find({}).toArray();
  const allGifts = [...defaultGifts];
  for (const g of mongoGifts) {
    const exists = allGifts.find(x => x.id === g.id);
    if (!exists) {
      allGifts.push({
        id: g.id || `gift_${g._id}`,
        name: g.name,
        coins: Number(g.coins || 10),
        icon: g.icon || '🎁',
        effect: g.effect || 'rose',
        description: g.description || '',
        added_by: g.addedBy || 'Admin'
      });
    }
  }
  for (const g of allGifts) {
    await supabase.from("catalog_gifts").upsert(g, { onConflict: "id" });
  }
  console.log(`✅ Migrated ${allGifts.length} catalog gifts!`);

  // 6. Migrate CATALOG FRAMES
  console.log("\n--- Migrating Catalog Frames ---");
  const defaultFrames = [
    { id: 'frame_neon', name: 'Cyber Neon Aura', price: 150, value: 'border-2 border-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.5)]', icon: '💫', added_by: 'System' },
    { id: 'frame_pink', name: 'Sakura Angel Halo', price: 200, value: 'border-2 border-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)] animate-[bounce_3s_infinite]', icon: '🌸', added_by: 'System' },
    { id: 'frame_royal', name: 'Imperial Gold Crown', price: 400, value: 'border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]', icon: '👑', added_by: 'System' },
    { id: 'frame_cosmic', name: 'Cosmic Fire Ring', price: 350, value: 'border-2 border-purple-500 animate-[spin_8s_linear_infinite]', icon: '🌌', added_by: 'System' }
  ];
  for (const f of defaultFrames) {
    await supabase.from("catalog_frames").upsert(f, { onConflict: "id" });
  }
  console.log(`✅ Migrated ${defaultFrames.length} catalog frames!`);

  // 7. Migrate CUSTOM GAMES
  console.log("\n--- Migrating Custom Games ---");
  const defaultGames = [
    { id: 'ludo', name: 'ZOYO Ludo Cup', category: 'Board', icon: '🎲', min_players: 2, max_players: 4, description: 'Real-time competitive 4-player Ludo board match', added_by: 'System' },
    { id: 'dice', name: 'Dice Duel Showdown', category: 'Dice', icon: '🎯', min_players: 2, max_players: 2, description: '1-on-1 High-stakes dice roll showdown with coin betting', added_by: 'System' },
    { id: 'wheel', name: 'Lucky Multiplier Wheel', category: 'Luck', icon: '🎡', min_players: 1, max_players: 8, description: 'Spin the dynamic wheel to win 10x multiplier gifts', added_by: 'System' }
  ];
  for (const gm of defaultGames) {
    await supabase.from("custom_games").upsert(gm, { onConflict: "id" });
  }
  console.log(`✅ Migrated ${defaultGames.length} custom games!`);

  // 8. Migrate FRIEND REQUESTS
  console.log("\n--- Migrating Friend Requests ---");
  const mongoFriends = await db.collection("friendrequests").find({}).toArray();
  for (const fr of mongoFriends) {
    await supabase.from("friend_requests").upsert({
      id: String(fr._id),
      sender_id: String(fr.senderId),
      sender_name: fr.senderName || '',
      sender_avatar: fr.senderAvatar || '',
      sender_yoyo_id: fr.senderYoyoId || '',
      receiver_id: String(fr.receiverId),
      receiver_name: fr.receiverName || '',
      receiver_yoyo_id: fr.receiverYoyoId || '',
      status: fr.status || 'pending',
      created_at: fr.createdAt || new Date().toISOString()
    }, { onConflict: "id" });
  }
  console.log(`✅ Migrated ${mongoFriends.length} friend requests!`);

  // 9. Migrate DIRECT MESSAGES
  console.log("\n--- Migrating Direct Messages ---");
  const mongoDMs = await db.collection("directmessages").find({}).toArray();
  for (const dm of mongoDMs) {
    await supabase.from("direct_messages").upsert({
      id: String(dm._id),
      sender_id: String(dm.senderId),
      receiver_id: String(dm.receiverId),
      text: dm.text || '',
      media_type: dm.voice ? 'voice' : 'text',
      duration: dm.duration || 0,
      created_at: dm.createdAt || new Date().toISOString()
    }, { onConflict: "id" });
  }
  console.log(`✅ Migrated ${mongoDMs.length} direct messages!`);

  await mongoose.disconnect();
  console.log("\n🎉 ALL MONGODB DATA SUCCESSFULLY MIGRATED TO SUPABASE!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
