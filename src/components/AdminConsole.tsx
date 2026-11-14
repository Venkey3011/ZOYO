import React, { useState, useEffect } from 'react';
import { User, Room } from '../types';
import { PRESET_AVATARS } from '../data';
import { 
  Shield, Users, Coins, RefreshCw, 
  Search, Lock, Unlock, Ban, UserPlus, FileText, ArrowRightLeft,
  Sparkles, Gift, Gamepad2, Palette, Trash2, Plus,
  Image as ImageIcon, ExternalLink, Upload
} from 'lucide-react';


interface AdminConsoleProps {
  currentUser: User;
  onCoinsUpdated: (newBalance: number) => void;
}

interface DbStatus {
  connected: boolean;
  mode: string;
}

interface TransferRecord {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  timestamp: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

type ManagementTab = 'user_control' | 'coin_transfer' | 'access_privilege' | 'audit_logs' | 'room_management' | 'catalog_hub' | 'media_hub';


export default function AdminConsole({ currentUser, onCoinsUpdated }: AdminConsoleProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>({ connected: false, mode: 'Checking...' });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab control based on role privileges
  const [activeTab, setActiveTab] = useState<ManagementTab>('coin_transfer');

  // Input states
  const [transferAmount, setTransferAmount] = useState<{ [userId: string]: string }>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Confirmation Modal overlay state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Create Sub-User state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'coin_seller'>('user');
  const [newAvatar, setNewAvatar] = useState(PRESET_AVATARS[0]);

  // Audit Logs state (strictly Admin only)
  const [transferLogs, setTransferLogs] = useState<TransferRecord[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomLoading, setRoomLoading] = useState(false);

  // Catalog Hub state (Admin & Manager can add Gifts, Frames, Games)
  const [catalogSubTab, setCatalogSubTab] = useState<'gifts' | 'frames' | 'games'>('gifts');
  const [catalogGifts, setCatalogGifts] = useState<any[]>([]);
  const [catalogFrames, setCatalogFrames] = useState<any[]>([]);
  const [catalogGames, setCatalogGames] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // New Gift form
  const [newGiftName, setNewGiftName] = useState('');
  const [newGiftCoins, setNewGiftCoins] = useState('50');
  const [newGiftIcon, setNewGiftIcon] = useState('💍');
  const [newGiftEffect, setNewGiftEffect] = useState('confetti');
  const [newGiftDesc, setNewGiftDesc] = useState('');

  // New Frame form
  const [newFrameName, setNewFrameName] = useState('');
  const [newFramePrice, setNewFramePrice] = useState('200');
  const [newFramePreset, setNewFramePreset] = useState('border-2 border-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]');
  const [newFrameIcon, setNewFrameIcon] = useState('✨');

  // New Game form
  const [newGameName, setNewGameName] = useState('');
  const [newGameCategory, setNewGameCategory] = useState('Party');
  const [newGameIcon, setNewGameIcon] = useState('🎯');
  const [newGameMin, setNewGameMin] = useState('2');
  const [newGameMax, setNewGameMax] = useState('4');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [newGameStatus, setNewGameStatus] = useState<'active' | 'coming_soon'>('active');

  // Media Hub state (Admin only)
  const [mediaSubTab, setMediaSubTab] = useState<'ads' | 'entry_video'>('ads');
  const [adsList, setAdsList] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [newAdTitle, setNewAdTitle] = useState('');
  const [newAdSubtitle, setNewAdSubtitle] = useState('');
  const [newAdBadge, setNewAdBadge] = useState('🔥 Live Event');
  const [newAdGradientFrom, setNewAdGradientFrom] = useState('rose-500');
  const [newAdGradientTo, setNewAdGradientTo] = useState('pink-600');
  const [newAdBannerType, setNewAdBannerType] = useState<'gradient' | 'image'>('gradient');
  const [newAdImageUrl, setNewAdImageUrl] = useState('');
  const [newAdImageUploading, setNewAdImageUploading] = useState(false);
  const [newAdLinkUrl, setNewAdLinkUrl] = useState('');
  const [newAdActive, setNewAdActive] = useState(true);

  const [entryVideoUrl, setEntryVideoUrl] = useState('');
  const [entryVideoEnabled, setEntryVideoEnabled] = useState(false);
  const [entryVideoUploading, setEntryVideoUploading] = useState(false);
  const [entryVideoSaved, setEntryVideoSaved] = useState(false);

  const fetchCatalogData = async () => {
    setCatalogLoading(true);
    try {
      const [gRes, fRes, mRes] = await Promise.all([
        fetch('/api/catalog/gifts'),
        fetch('/api/catalog/frames'),
        fetch('/api/catalog/games')
      ]);
      const [gData, fData, mData] = await Promise.all([
        gRes.json(),
        fRes.json(),
        mRes.json()
      ]);
      if (gData.success) setCatalogGifts(gData.gifts);
      if (fData.success) setCatalogFrames(fData.frames);
      if (mData.success) setCatalogGames(mData.games);
    } catch (err) {
      console.error('Error fetching catalog data:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  const fetchMediaHubData = async () => {
    setAdsLoading(true);
    try {
      const [adsRes, videoRes] = await Promise.all([
        fetch('/api/ads/all'),
        fetch('/api/settings/entry-video')
      ]);
      const [adsData, videoData] = await Promise.all([adsRes.json(), videoRes.json()]);
      if (adsData.success) setAdsList(adsData.ads || []);
      if (videoData.success) {
        setEntryVideoUrl(videoData.videoUrl || '');
        setEntryVideoEnabled(videoData.enabled !== false && !!videoData.videoUrl);
      }
    } catch (err) {
      console.error('Error fetching media hub data:', err);
    } finally {
      setAdsLoading(false);
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewAdImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, fileType: 'banner', fileName: file.name })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          setNewAdImageUrl(uploadData.url);
          setNewAdBannerType('image');
        } else {
          setErrorMsg('Banner image upload failed');
        }
        setNewAdImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setErrorMsg('Banner image upload error');
      setNewAdImageUploading(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdTitle.trim()) return;
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAdTitle.trim(), subtitle: newAdSubtitle.trim(),
          badge: newAdBadge, gradient_from: newAdGradientFrom,
          gradient_to: newAdGradientTo,
          image_url: newAdImageUrl,
          banner_type: newAdBannerType,
          link_url: newAdLinkUrl.trim(),
          is_active: newAdActive, userRole: currentUser.role,
          created_by: currentUser.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Ad banner created!');
        setNewAdTitle(''); setNewAdSubtitle(''); setNewAdLinkUrl('');
        setNewAdImageUrl(''); setNewAdBannerType('gradient');
        fetchMediaHubData();
      } else {
        setErrorMsg(data.error || 'Failed to create ad');
      }
    } catch { setErrorMsg('Network error'); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 3000);
  };


  const handleToggleAd = async (adId: string, currentState: boolean) => {
    try {
      await fetch(`/api/ads/${adId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentState, userRole: currentUser.role })
      });
      setAdsList(prev => prev.map(a => a._id === adId ? { ...a, is_active: !currentState } : a));
    } catch { setErrorMsg('Failed to update ad'); setTimeout(() => setErrorMsg(''), 3000); }
  };

  const handleDeleteAd = async (adId: string) => {
    try {
      await fetch(`/api/ads/${adId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole: currentUser.role })
      });
      setAdsList(prev => prev.filter(a => a._id !== adId));
      setSuccessMsg('Ad deleted');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch { setErrorMsg('Failed to delete ad'); setTimeout(() => setErrorMsg(''), 3000); }
  };

  const handleEntryVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEntryVideoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, fileType: 'video', fileName: file.name })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          setEntryVideoUrl(uploadData.url);
          setEntryVideoEnabled(true);
        } else {
          setErrorMsg('Video upload failed');
        }
        setEntryVideoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setErrorMsg('Upload failed'); setEntryVideoUploading(false); }
  };

  const handleSaveEntryVideo = async () => {
    try {
      const res = await fetch('/api/settings/entry-video', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: entryVideoUrl, enabled: entryVideoEnabled, userRole: currentUser.role, userId: currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        setEntryVideoSaved(true);
        setSuccessMsg('Entry video settings saved!');
        setTimeout(() => { setEntryVideoSaved(false); setSuccessMsg(''); }, 3000);
      } else {
        setErrorMsg(data.error || 'Failed to save');
        setTimeout(() => setErrorMsg(''), 3000);
      }
    } catch { setErrorMsg('Network error'); setTimeout(() => setErrorMsg(''), 3000); }
  };

  const handleAddGift = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!newGiftName.trim() || !newGiftCoins) return;
    try {
      const res = await fetch('/api/catalog/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGiftName.trim(),
          coins: parseInt(newGiftCoins, 10),
          icon: newGiftIcon.trim(),
          effect: newGiftEffect,
          description: newGiftDesc.trim(),
          userRole: currentUser.role,
          addedBy: currentUser.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Added new animated gift "${data.gift.name}"!`);
        setNewGiftName('');
        setNewGiftDesc('');
        fetchCatalogData();
      } else {
        setErrorMsg(data.error || 'Failed to add gift');
      }
    } catch {
      setErrorMsg('Connection error adding gift');
    }
  };

  const handleDeleteGift = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/catalog/gifts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Removed gift "${name}"`);
        fetchCatalogData();
      }
    } catch {
      setErrorMsg('Failed to delete gift');
    }
  };

  const handleAddFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrameName.trim() || !newFramePrice) return;
    try {
      const res = await fetch('/api/catalog/frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFrameName.trim(),
          price: parseInt(newFramePrice, 10),
          value: newFramePreset,
          icon: newFrameIcon.trim(),
          userRole: currentUser.role,
          addedBy: currentUser.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Added new avatar frame "${data.frame.name}"!`);
        setNewFrameName('');
        fetchCatalogData();
      } else {
        setErrorMsg(data.error || 'Failed to add frame');
      }
    } catch {
      setErrorMsg('Connection error adding frame');
    }
  };

  const handleDeleteFrame = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/catalog/frames/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Removed frame "${name}"`);
        fetchCatalogData();
      }
    } catch {
      setErrorMsg('Failed to delete frame');
    }
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    try {
      const res = await fetch('/api/catalog/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGameName.trim(),
          category: newGameCategory,
          icon: newGameIcon.trim(),
          minPlayers: newGameMin,
          maxPlayers: newGameMax,
          description: newGameDesc.trim(),
          status: newGameStatus,
          userRole: currentUser.role,
          addedBy: currentUser.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Added new game "${data.game.name}"!`);
        setNewGameName('');
        setNewGameDesc('');
        fetchCatalogData();
      } else {
        setErrorMsg(data.error || 'Failed to add game');
      }
    } catch {
      setErrorMsg('Connection error adding game');
    }
  };

  const handleDeleteGame = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/catalog/games/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Removed game "${name}"`);
        fetchCatalogData();
      }
    } catch {
      setErrorMsg('Failed to delete game');
    }
  };

  // Fetch rooms for management
  const fetchRooms = async () => {
    setRoomLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRooms(data.rooms);
        }
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setRoomLoading(false);
    }
  };

  // Delete room
  const handleDeleteRoom = (roomId: string, roomTitle: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Room Deletion',
      message: `Are you sure you want to permanently delete the room "${roomTitle}"? This action cannot be undone.`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeDeleteRoom(roomId);
      }
    });
  };

  const executeDeleteRoom = async (roomId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Room deleted successfully!');
        fetchRooms();
      } else {
        setErrorMsg(data.error || 'Failed to delete room.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    }
  };

  // Sync activeTab with role-based accessibility on initial load
  useEffect(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coin_seller') {
      setActiveTab('user_control');
    } else {
      setActiveTab('coin_transfer');
    }
  }, [currentUser]);

  // Fetch directory
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      try {
        const statusRes = await fetch('/api/db-status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setDbStatus(statusData);
        } else {
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) {
            const healthData = await healthRes.json();
            setDbStatus({ connected: healthData.connected, mode: healthData.mode });
          }
        }
      } catch (e) {
        console.warn('Status check warning:', e);
      }

      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData && usersData.success && Array.isArray(usersData.users)) {
          setUsers(usersData.users);
        } else if (Array.isArray(usersData)) {
          setUsers(usersData);
        } else {
          console.error('❌ API returned success=false');
        }
      } else {
        console.error('❌ Failed to fetch users, status:', usersRes.status);
      }
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setErrorMsg('Failed to sync backend records.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch transfer logs (strictly Admin only)
  const fetchTransferLogs = async () => {
    if (currentUser.role !== 'admin') return;
    try {
      const res = await fetch('/api/transfers');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTransferLogs(data.transfers);
        }
      }
    } catch (err) {
      console.error('Error fetching coin logs:', err);
    }
  };

  useEffect(() => {
    fetchData();
    if (currentUser.role === 'admin') {
      fetchTransferLogs();
      fetchRooms();
    }
  }, [currentUser]);

  // Hierarchical User Filter - Different logic per tab
  // User Directory Filter - Managers, Coin Sellers, and Admins can view ALL users across the platform
  const getManageableUsers = () => {
    return users;
  };

  const filteredUsers = getManageableUsers().filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.yoyoId || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  console.log('🔍 Filtered users after search:', filteredUsers.length, 'query:', searchQuery);

  // Managers list for access assignment (Admin only)
  const managers = users.filter(u => u.role === 'manager');

  // Trigger Confirmation: Account Block / Unblock
  const handleToggleBlock = (userId: string, currentBlockedStatus: boolean) => {
    const targetUser = users.find(u => (u._id || u.id) === userId || String(u._id) === String(userId) || String(u.id) === String(userId));
    if (!targetUser) return;

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'coin_seller') {
      setErrorMsg('Access Denied. Only Admins, Managers, and Coin Sellers can restrict accounts.');
      return;
    }

    if (targetUser.name === 'Admin') {
      setErrorMsg('Cannot restrict the super Admin account!');
      return;
    }

    const actionText = currentBlockedStatus ? 'UNLOCK' : 'LOCK';
    setConfirmModal({
      isOpen: true,
      title: `Confirm Account ${actionText}`,
      message: `Are you sure you want to ${actionText.toLowerCase()} the account for user "${targetUser.name}"?`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeToggleBlock(userId, currentBlockedStatus);
      }
    });
  };

  // Execution API Call: Block / Unblock User
  const executeToggleBlock = async (userId: string, currentBlockedStatus: boolean) => {
    setErrorMsg('');
    setSuccessMsg('');
    const newStatus = !currentBlockedStatus;

    // Optimistically update local users state for immediate UI responsiveness (<1ms)
    setUsers(prev => prev.map(u => 
      ((u._id || u.id) === userId || String(u._id) === String(userId) || String(u.id) === String(userId))
        ? { ...u, isBlocked: newStatus }
        : u
    ));

    try {
      const res = await fetch(`/api/users/${userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Account for ${data.user.name} was successfully ${newStatus ? 'LOCKED' : 'UNLOCKED'}!`);
        fetchData();
      } else {
        // Rollback optimistic update on server error
        setUsers(prev => prev.map(u => 
          ((u._id || u.id) === userId || String(u._id) === String(userId) || String(u.id) === String(userId))
            ? { ...u, isBlocked: currentBlockedStatus }
            : u
        ));
        setErrorMsg(data.error || 'Failed to modify lock status.');
      }
    } catch (err) {
      // Rollback on network failure
      setUsers(prev => prev.map(u => 
        ((u._id || u.id) === userId || String(u._id) === String(userId) || String(u.id) === String(userId))
          ? { ...u, isBlocked: currentBlockedStatus }
          : u
      ));
      setErrorMsg('Connection error modifying lock status.');
    }
  };

  // Trigger Confirmation: Change User Role
  const handleRoleChange = (userId: string, role: string) => {
    const targetUser = users.find(u => (u._id || u.id) === userId);
    if (!targetUser) return;

    if (currentUser.role !== 'admin') {
      setErrorMsg('Only the Super Admin can change access privileges!');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Access Level Change',
      message: `Are you sure you want to change "${targetUser.name}"'s access role from ${targetUser.role || 'user'} to ${role.toUpperCase()}?`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeRoleChange(userId, role);
      }
    });
  };

  // Execution API Call: Change User Role
  const executeRoleChange = async (userId: string, role: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Access level for ${data.user.name} set to ${role.toUpperCase()}!`);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to change role.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    }
  };

  // Trigger Confirmation: Assign Manager
  const handleAssignManager = (userId: string, managerId: string) => {
    const targetUser = users.find(u => (u._id || u.id) === userId);
    if (!targetUser) return;

    if (currentUser.role !== 'admin') {
      setErrorMsg('Only the Super Admin can reassign managers!');
      return;
    }

    const mText = managerId === 'none' ? 'Independent (None)' : `Manager: ${managerId}`;
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Manager Assignment',
      message: `Are you sure you want to bind "${targetUser.name}"'s account under ${mText}?`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeAssignManager(userId, managerId);
      }
    });
  };

  // Execution API Call: Assign Manager
  const executeAssignManager = async (userId: string, managerId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/users/${userId}/assign-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Manager assigned successfully!`);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to assign manager.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    }
  };

  // Trigger Confirmation: Coin Transfer
  const handleTransferCoins = (userId: string) => {
    const targetUser = users.find(u => (u._id || u.id) === userId);
    if (!targetUser) return;

    const amountStr = transferAmount[userId];
    const amount = Number(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
      setErrorMsg('Please specify a valid positive coin amount to transfer.');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager' && currentUser.role !== 'coin_seller') {
      setErrorMsg('Privileges Denied. You cannot transfer coins.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Coin Transfer',
      message: `Are you sure you want to transfer 🪙 ${amount} coins to ${targetUser.name}? This will instantly deduct from your balance.`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        executeTransferCoins(userId, amount);
      }
    });
  };

  // Execution API Call: Coin Transfer with Balance Deduction
  const executeTransferCoins = async (userId: string, amount: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/users/${userId}/coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          senderId: currentUser._id || currentUser.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Transferred 🪙 ${amount} coins successfully to ${data.user.name}!`);
        setTransferAmount(prev => ({ ...prev, [userId]: '' }));

        // Deduct from our balance locally instantly!
        if (data.senderCoins !== undefined) {
          onCoinsUpdated(data.senderCoins);
        }

        fetchData();
        if (currentUser.role === 'admin') {
          fetchTransferLogs();
        }
      } else {
        setErrorMsg(data.error || 'Failed to execute transfer.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    }
  };

  // API Call: Create Sub-User (Hierarchical)
  const handleCreateSubUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setErrorMsg('Please provide username and password.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/create-sub-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          avatar: newAvatar,
          role: newRole,
          createdBy: currentUser.name,
          managerId: currentUser.role === 'manager' ? currentUser.name : 'none'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Successfully registered new sub-user: ${data.user.name}!`);
        setNewUsername('');
        setNewPassword('');
        setShowCreateForm(false);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to register sub-user.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-xs text-zinc-800 p-4 overflow-y-auto scrollbar-none pb-32 overscroll-contain relative">
      
      {/* Header section */}
      <div className="flex justify-between items-center shrink-0 border-b border-zinc-200 pb-3">
        <h2 className="text-sm font-black flex items-center gap-1.5 text-zinc-900 uppercase tracking-wider">
          <Shield className="w-4 h-4 text-rose-500 animate-[pulse_3s_infinite]" /> Management Console
        </h2>
        <button 
          onClick={() => {
            fetchData();
            if (currentUser.role === 'admin') {
              fetchTransferLogs();
            }
          }}
          className="p-1.5 bg-white border border-zinc-200 rounded-full text-zinc-500 hover:text-zinc-800 shadow-sm transition-colors cursor-pointer"
          title="Refresh Directory"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* DB Status Badge — ADMIN ONLY */}
      {currentUser.role === 'admin' && (
        <div className={`mt-3 p-2.5 rounded-xl border flex items-center justify-between text-[10px] ${
          dbStatus.connected 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
            <span className="font-bold uppercase tracking-wider">Database Mode:</span>
            <span className="font-black">{dbStatus.connected ? (dbStatus.mode || 'MongoDB Atlas Cloud (Active)') : (dbStatus.mode || 'Offline / Fallback')}</span>
          </div>
          {dbStatus.connected && <span className="font-semibold text-emerald-700 font-mono text-[9px]">MongoDB Atlas Connected ✓</span>}

        </div>
      )}

      {/* Notification Banner */}
      {successMsg && (
        <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-center animate-pulse">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 font-bold rounded-lg text-center">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mt-4 flex gap-1 bg-zinc-150 p-1 rounded-xl border border-zinc-200/60 overflow-x-auto scrollbar-none shrink-0">
        {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coin_seller') && (
          <button
            onClick={() => setActiveTab('user_control')}
            className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
              activeTab === 'user_control' 
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            User Control
          </button>
        )}
        
        <button
          onClick={() => setActiveTab('coin_transfer')}
          className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
            activeTab === 'coin_transfer' 
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Coin Transfer
        </button>

        {currentUser.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('access_privilege')}
              className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
                activeTab === 'access_privilege'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Privileges
            </button>
            <button
              onClick={() => setActiveTab('audit_logs')}
              className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
                activeTab === 'audit_logs'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('room_management')}
              className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
                activeTab === 'room_management'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Rooms
            </button>
          </>
        )}

        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <button
            onClick={() => {
              setActiveTab('catalog_hub');
              fetchCatalogData();
            }}
            className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
              activeTab === 'catalog_hub'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Catalog Hub
          </button>
        )}

        {currentUser.role === 'admin' && (
          <button
            onClick={() => {
              setActiveTab('media_hub');
              fetchMediaHubData();
            }}
            className={`flex-1 min-w-[75px] py-2 text-center font-bold rounded-lg transition-all text-[10px] cursor-pointer whitespace-nowrap px-1.5 ${
              activeTab === 'media_hub'
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            📺 Media Hub
          </button>
        )}
      </div>


      {/* Dynamic Sub-Page Content */}
      <div className="mt-4 flex flex-col flex-1 gap-3 min-h-0">
        
        {/* TAB 1: USER CONTROL (Admin, Manager & Coin Seller) */}
        {activeTab === 'user_control' && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coin_seller') && (
          <div className="flex flex-col gap-3">
            
            {/* Hierarchy Info Eyebrow */}
            <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-[10px] leading-relaxed flex flex-col gap-1 shadow-sm">
              <span className="font-extrabold text-zinc-800 flex items-center gap-1">
                👥 Platform User Directory Status
              </span>
              {currentUser.role === 'admin' ? (
                <span>As a <strong>Super Admin</strong>, you are at the root of the hierarchy and can view and control all registered accounts ({users.length} total).</span>
              ) : currentUser.role === 'manager' ? (
                <span>As a <strong>Manager</strong>, you can view all registered users across the platform ({users.length} total), manage account status, and register new users.</span>
              ) : (
                <span>As a <strong>Coin Seller</strong>, you can view all registered users across the platform ({users.length} total) and manage coin transfers.</span>
              )}
            </div>

            {/* Create Sub-user Form for hierarchical structure */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="w-full px-4 py-2.5 bg-white hover:bg-stone-50 flex items-center justify-between font-bold text-zinc-800 cursor-pointer border-b border-zinc-150"
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <UserPlus className="w-3.5 h-3.5 text-rose-500" /> 
                  {currentUser.role === 'manager' ? 'Register User (Manager)' : currentUser.role === 'coin_seller' ? 'Register User (Coin Seller)' : 'Register New User'}
                </span>
                <span className="text-rose-600 text-[10px] uppercase font-black">
                  {showCreateForm ? 'Collapse ➖' : 'Expand ➕'}
                </span>
              </button>

              {showCreateForm && (
                <form onSubmit={handleCreateSubUser} className="p-4 flex flex-col gap-3 bg-stone-50/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Username</label>
                    <input 
                      type="text" 
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Enter username..."
                      className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-zinc-800 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Password</label>
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-zinc-800 focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  {currentUser.role === 'admin' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Initial Role Assignment</label>
                      <select 
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as any)}
                        className="w-full bg-white border border-zinc-250 rounded-xl px-2.5 py-2 text-zinc-800 font-bold cursor-pointer text-xs focus:border-rose-500 focus:outline-none"
                      >
                        <option value="user">Standard User</option>
                        <option value="coin_seller">Coin Seller</option>
                      </select>
                    </div>
                  )}

                  {/* Preset Avatar Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Select Avatar</label>
                    <div className="flex gap-2 justify-center py-2 bg-white rounded-xl border border-zinc-200 p-2 overflow-x-auto scrollbar-none shadow-sm">
                      {PRESET_AVATARS.map((av, idx) => (
                        <img
                          key={idx}
                          src={av}
                          alt=""
                          onClick={() => setNewAvatar(av)}
                          className={`w-9 h-9 rounded-full object-cover cursor-pointer border-2 transition-all ${
                            newAvatar === av ? 'border-rose-500 scale-110 shadow-md' : 'border-zinc-200 hover:border-zinc-350'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black rounded-xl uppercase tracking-wider text-[10px] cursor-pointer mt-1 shadow-sm active:scale-[0.98] transition-transform"
                  >
                    Confirm Registration
                  </button>
                </form>
              )}
            </div>

            {/* Users Directory Search bar */}
            <div className="relative shrink-0">
              <span className="absolute left-3 top-2.5 text-zinc-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by Name, ZOYO ID, or Role..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
            </div>

            {/* List for user block / unblock */}
            <div className="flex flex-col gap-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No users matched your search.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const uId = String(user._id || user.id || user.name || '');
                  const isSelf = user.name === currentUser.name;
                  const isBlocked = !!user.isBlocked;

                  return (
                    <div 
                      key={uId}
                      className={`border rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm transition-all ${
                        isBlocked ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className={`w-9 h-9 rounded-full object-cover border ${isBlocked ? 'border-rose-400 opacity-60 grayscale-[25%]' : 'border-zinc-200'}`}
                          />
                          {isBlocked && (
                            <div className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-1 text-[8px] font-black border-2 border-white shadow flex items-center justify-center">
                              <Lock className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-zinc-900 flex items-center gap-1 text-xs truncate">
                            {user.name}
                            {isSelf && <span className="text-[7px] bg-rose-50 text-rose-600 border border-rose-200 px-1 rounded uppercase font-extrabold">Me</span>}
                          </p>
                          <p className="text-[9px] text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>ZOYO ID: <strong className="text-rose-600 font-mono font-bold">{user.yoyoId || '—'}</strong></span>
                            <span>Role: <span className="text-rose-600 font-extrabold uppercase font-mono">{user.role || 'user'}</span></span>
                            {user.createdBy && user.createdBy !== 'self' && (
                              <span className="border-l border-zinc-200 pl-1 text-[8px]">By: {user.createdBy}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isBlocked 
                            ? 'bg-rose-100 text-rose-700 border border-rose-300' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isBlocked ? (
                            <>
                              <Lock className="w-2.5 h-2.5 text-rose-600" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Active</span>
                            </>
                          )}
                        </span>
                        
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleBlock(uId, isBlocked)}
                            disabled={user.name === 'Admin'}
                            className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-sm ${
                              isBlocked 
                                ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                                : 'bg-white border-rose-300 text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isBlocked ? 'Unlock User Account' : 'Lock User Account'}
                          >
                            {isBlocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Unlock</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Lock</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 2: COIN TRANSFERS */}
        {activeTab === 'coin_transfer' && (
          <div className="flex flex-col gap-3">
            
            {/* Coins Balance Indicator */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Your Mint & Transfer Authority</p>
                <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 mt-1">
                  <Coins className="w-4 h-4 text-amber-500 animate-bounce" /> Current Balance: <span className="text-amber-600 font-mono font-black">{currentUser.coins}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black uppercase px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                  {currentUser.role?.toUpperCase()} Privilege
                </span>
              </div>
            </div>

            {/* Transfer Permissions Info */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-2.5 rounded-xl border border-blue-200 text-blue-800 text-[10px] leading-relaxed flex flex-col gap-1">
              <span className="font-extrabold flex items-center gap-1">
                💰 Coin Transfer Directory
              </span>
              {currentUser.role === 'admin' ? (
                <span>As <strong>Super Admin</strong>, you have unlimited coins and can transfer to any registered user.</span>
              ) : currentUser.role === 'manager' ? (
                <span>As <strong>Manager</strong>, you can view and transfer coins to <strong>ALL registered users</strong> (deducted from your balance).</span>
              ) : (
                <span>As <strong>Coin Seller</strong>, you can transfer coins to any user (deducted from your balance).</span>
              )}
            </div>

            {/* Transfer Directory Search */}
            <div className="relative shrink-0">
              <span className="absolute left-3 top-2.5 text-zinc-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient by ZOYO ID..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm font-mono"
              />
            </div>

            {/* List for transferring coins */}
            <div className="flex flex-col gap-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No recipient accounts with that ZOYO ID matched.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const uId = String(user._id || user.id || user.name || '');
                  const isBlocked = !!user.isBlocked;
                  const isSelf = user.name === currentUser.name;

                  // Prohibit transfer to self
                  if (isSelf) return null;

                  return (
                    <div 
                      key={uId}
                      className={`bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm ${isBlocked ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                          />
                          <div>
                            <p className="font-black text-zinc-900 text-xs">
                              {user.name}
                            </p>
                            <p className="text-[9px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                              <span>ZOYO ID: <strong className="text-rose-600 font-mono font-bold">{user.yoyoId || '—'}</strong></span>
                              <span>Coins: <span className="text-amber-600 font-bold font-mono">🪙 {user.coins}</span></span>
                            </p>
                          </div>
                        </div>

                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isBlocked ? 'bg-rose-100 text-rose-700 border border-rose-300 font-black' :
                          user.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          user.role === 'manager' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          user.role === 'coin_seller' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {isBlocked ? '🔒 Locked' : (user.role || 'user')}
                        </span>
                      </div>

                      {/* Action Row */}
                      <div className="flex gap-1.5 mt-2 pt-2 border-t border-zinc-100 items-center">
                        <input
                          type="number"
                          placeholder="Amount (e.g. 100)"
                          disabled={isBlocked}
                          value={transferAmount[uId] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransferAmount(prev => ({ ...prev, [uId]: val }));
                          }}
                          className="flex-1 bg-stone-50 border border-zinc-200 text-[10px] text-zinc-850 px-2 py-1.5 rounded-xl focus:outline-none placeholder-zinc-400 disabled:opacity-50 font-bold"
                        />
                        <button
                          onClick={() => handleTransferCoins(uId)}
                          disabled={isBlocked}
                          className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black text-[9px] px-3.5 py-1.5 rounded-xl shadow cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                        >
                          Transfer Coins
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 3: ACCESS PRIVILEGES (Admins Only) */}
        {activeTab === 'access_privilege' && currentUser.role === 'admin' && (
          <div className="flex flex-col gap-3">
            
            <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-[10px] leading-relaxed shadow-sm">
              👑 <strong className="text-zinc-800">Super Admin Workspace</strong>: Use this page to reassign user access privilege roles and establish or update hierarchical manager bindings.
            </div>

            {/* search */}
            <div className="relative shrink-0">
              <span className="absolute left-3 top-2.5 text-zinc-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search registered accounts..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
            </div>

            {/* List for privileges */}
            <div className="flex flex-col gap-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No accounts matched.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const uId = String(user._id || user.id || user.name || '');
                  const isSelf = user.name === currentUser.name;

                  return (
                    <div 
                      key={uId}
                      className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                          />
                          <div>
                            <p className="font-black text-zinc-900 text-xs">
                              {user.name}
                            </p>
                            <p className="text-[9px] text-zinc-500">
                              Role: <span className="text-rose-600 font-extrabold uppercase">{user.role || 'user'}</span>
                            </p>
                          </div>
                        </div>

                        <span className="text-[8px] bg-stone-100 text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded-full font-mono">
                          ID: {uId.substring(0, 8)}
                        </span>
                      </div>

                      {/* Dual Role Selector and Manager Assigner */}
                      <div className="grid grid-cols-2 gap-2 mt-1.5 pt-2 border-t border-zinc-100">
                        
                        {/* Change Role */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider">Access Level</label>
                          <select
                            value={user.role || 'user'}
                            disabled={isSelf || user.name === 'Admin'}
                            onChange={(e) => handleRoleChange(uId, e.target.value)}
                            className="bg-stone-50 border border-zinc-200 text-[10px] text-zinc-800 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                          >
                            <option value="user">User</option>
                            <option value="coin_seller">Coin Seller</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Super Admin</option>
                          </select>
                        </div>

                        {/* Hierarchical Bind: Change Parent Manager */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider">Bind Manager</label>
                          <select
                            value={user.managerId || 'none'}
                            disabled={isSelf || user.name === 'Admin' || user.role === 'admin'}
                            onChange={(e) => handleAssignManager(uId, e.target.value)}
                            className="bg-stone-50 border border-zinc-200 text-[10px] text-zinc-800 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer disabled:opacity-50"
                          >
                            <option value="none">None (Independent)</option>
                            {managers.map(mgr => (
                              <option key={mgr._id || mgr.id} value={mgr.name}>
                                {mgr.name}
                              </option>
                            ))}
                          </select>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 4: AUDIT LOGS LEDGER (Admin Only) */}
        {activeTab === 'audit_logs' && currentUser.role === 'admin' && (
          <div className="flex flex-col gap-3">

            <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-[10px] leading-relaxed flex items-center gap-2 shadow-sm">
              <FileText className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                👑 <strong className="text-zinc-800">Coin Transfer Data Ledger</strong>: You are the sole authorized account permitted to audit and analyze global transaction records.
              </span>
            </div>

            {/* Audit Logs list */}
            <div className="flex flex-col gap-2">
              {transferLogs.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No transaction data logged yet.
                </div>
              ) : (
                transferLogs.map((log) => {
                  const logId = log._id || Math.random().toString();
                  const formattedDate = new Date(log.timestamp).toLocaleString();

                  return (
                    <div
                      key={logId}
                      className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 border-b border-zinc-100 pb-1.5">
                        <span className="font-bold text-zinc-400 font-mono text-[8px]">ID: {logId.substring(0, 8)}</span>
                        <span>{formattedDate}</span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        {/* Sender */}
                        <div className="min-w-0">
                          <p className="font-extrabold text-zinc-800 text-[10px] truncate">{log.senderName}</p>
                          <span className="text-[7px] text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.2 rounded uppercase font-black tracking-wider">
                            {log.senderRole}
                          </span>
                        </div>

                        {/* Arrow transfer icon */}
                        <div className="flex flex-col items-center justify-center text-amber-600 shrink-0 bg-stone-50 p-1.5 rounded-full border border-zinc-200">
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black text-amber-600 mt-0.5">🪙 {log.amount}</span>
                        </div>

                        {/* Receiver */}
                        <div className="min-w-0 text-right">
                          <p className="font-extrabold text-zinc-800 text-[10px] truncate">{log.receiverName}</p>
                          <span className="text-[7px] text-zinc-400 bg-zinc-100 px-1.5 py-0.2 rounded uppercase font-bold">
                            recipient
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 5: ROOM MANAGEMENT (Admin Only) */}
        {activeTab === 'room_management' && currentUser.role === 'admin' && (
          <div className="flex flex-col gap-3">

            <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-[10px] leading-relaxed flex items-center gap-2 shadow-sm">
              <Shield className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                🏠 <strong className="text-zinc-800">Voice Room Management</strong>: View and manage all voice chat rooms. Delete rooms that violate guidelines.
              </span>
            </div>

            {/* Rooms list */}
            <div className="flex flex-col gap-2">
              {roomLoading ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  Loading rooms...
                </div>
              ) : rooms.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No voice rooms found.
                </div>
              ) : (
                rooms.map((room) => {
                  const roomId = (room as any)._id || room.id;
                  const isActive = room.isActive !== false;

                  return (
                    <div
                      key={roomId}
                      className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={(room.host?.avatar) || PRESET_AVATARS[0]}
                            alt={room.host?.name || 'Host'}
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                          />
                          <div className="min-w-0">
                            <p className="font-black text-zinc-900 text-xs truncate">{room.title}</p>
                            <p className="text-[9px] text-zinc-500 mt-0.5">
                              Host: <span className="text-rose-600 font-extrabold">{room.host?.name || 'Unknown'}</span> •
                              Category: <span className="text-rose-600 font-extrabold uppercase">{room.category}</span>
                            </p>
                          </div>
                        </div>

                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isActive ? 'Active' : 'Closed'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1.5 pt-2 border-t border-zinc-100 text-[9px]">
                        <span className="text-zinc-400">Seats: <strong className="font-bold text-zinc-600">{room.seats?.filter((s: any) => s.user).length || 0}</strong></span>
                        <span className="text-zinc-400">Online: <strong className="font-bold text-zinc-600">{room.onlineCount || 0}</strong></span>
                        <span className="text-zinc-400">Created: <strong className="font-bold text-zinc-600">{room.createdAt ? new Date(room.createdAt).toLocaleDateString() : 'Unknown'}</strong></span>
                      </div>

                      {/* Action Row */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleDeleteRoom(roomId, room.title)}
                          disabled={!isActive}
                          className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-bold py-2 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                        >
                          🗑️ Delete Room
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* TAB 6: CATALOG HUB (Admin & Manager: Add Gifts, Frames, Games) */}
        {activeTab === 'catalog_hub' && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <div className="flex flex-col gap-3">
            
            {/* Header / Intro Eyebrow */}
            <div className="bg-white p-3 rounded-2xl border border-zinc-200 text-zinc-500 text-[10px] flex items-center justify-between shadow-xs">
              <div>
                <span className="font-extrabold text-zinc-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-500" /> Platform Catalog & Game Hub
                </span>
                <p className="text-zinc-400 text-[10px] mt-0.5">
                  Admins and Managers can dynamically publish new gifts, avatar frames, and voice room games!
                </p>
              </div>
              <button
                type="button"
                onClick={fetchCatalogData}
                className="p-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-zinc-600 cursor-pointer transition-colors"
                title="Refresh Catalog"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Sub-tab pills */}
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCatalogSubTab('gifts')}
                className={`py-2 rounded-lg font-black text-center text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  catalogSubTab === 'gifts'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Gifts ({catalogGifts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogSubTab('frames')}
                className={`py-2 rounded-lg font-black text-center text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  catalogSubTab === 'frames'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Frames ({catalogFrames.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogSubTab('games')}
                className={`py-2 rounded-lg font-black text-center text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  catalogSubTab === 'games'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Games ({catalogGames.length})</span>
              </button>
            </div>

            {/* 1. SUB-TAB: GIFTS MANAGEMENT */}
            {catalogSubTab === 'gifts' && (
              <div className="flex flex-col gap-3">
                
                {/* Add Gift Form */}
                <form onSubmit={handleAddGift} className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                  <h4 className="font-black text-zinc-800 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-rose-500" /> Add New Animated Gift
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Gift Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Diamond Ring"
                        value={newGiftName}
                        onChange={e => setNewGiftName(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Coin Cost</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 99"
                        value={newGiftCoins}
                        onChange={e => setNewGiftCoins(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Icon / Emoji</label>
                      <input
                        type="text"
                        required
                        placeholder="💍 or image URL"
                        value={newGiftIcon}
                        onChange={e => setNewGiftIcon(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Animation Effect</label>
                      <select
                        value={newGiftEffect}
                        onChange={e => setNewGiftEffect(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      >
                        <option value="confetti">🎉 Confetti Blast</option>
                        <option value="fireworks">🎆 Fireworks Show</option>
                        <option value="hearts">💖 Floating Hearts</option>
                        <option value="diamond">💎 Diamond Sparkle</option>
                        <option value="car">🏎️ Golden Supercar</option>
                        <option value="rocket">🚀 Cosmic Rocket</option>
                        <option value="rose">🌹 Rose Shower</option>
                        <option value="crown">👑 Royal Crown</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Shower the screen with pure diamonds!"
                      value={newGiftDesc}
                      onChange={e => setNewGiftDesc(e.target.value)}
                      className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-medium mt-0.5 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer transition-all active:scale-98"
                  >
                    + Publish Gift to App
                  </button>
                </form>

                {/* List Current Gifts */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-1">
                    Live Gifts in App ({catalogGifts.length})
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {catalogGifts.map((gift) => (
                      <div key={gift.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
                        <div className="flex items-start justify-between">
                          <span className="text-3xl">{gift.icon}</span>
                          <span className="text-[9px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                            🪙 {gift.coins}
                          </span>
                        </div>
                        <div className="mt-2 min-w-0">
                          <h5 className="font-black text-xs text-zinc-900 truncate">{gift.name}</h5>
                          <p className="text-[9px] text-zinc-400 truncate mt-0.5">{gift.description || gift.effect}</p>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between">
                          <span className="text-[8px] bg-stone-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">
                            {gift.effect}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteGift(gift.id, gift.name)}
                            className="text-zinc-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                            title="Delete Gift"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 2. SUB-TAB: FRAMES MANAGEMENT */}
            {catalogSubTab === 'frames' && (
              <div className="flex flex-col gap-3">
                
                {/* Add Frame Form */}
                <form onSubmit={handleAddFrame} className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                  <h4 className="font-black text-zinc-800 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-rose-500" /> Add New Avatar Frame
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Frame Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dragon Flame"
                        value={newFrameName}
                        onChange={e => setNewFrameName(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Price (Coins)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 250"
                        value={newFramePrice}
                        onChange={e => setNewFramePrice(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Icon Emoji</label>
                      <input
                        type="text"
                        required
                        placeholder="🐉"
                        value={newFrameIcon}
                        onChange={e => setNewFrameIcon(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Glow / Border Style</label>
                      <select
                        value={newFramePreset}
                        onChange={e => setNewFramePreset(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2 py-1.5 text-[10px] text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      >
                        <option value="border-2 border-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                          Emerald Neon Aura
                        </option>
                        <option value="border-2 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-[bounce_3s_infinite]">
                          Fiery Orange Flare
                        </option>
                        <option value="border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                          Imperial Gold Crown
                        </option>
                        <option value="border-2 border-purple-500 animate-[spin_8s_linear_infinite]">
                          Cosmic Fire Ring
                        </option>
                        <option value="border-2 border-rose-600 shadow-[0_0_10px_rgba(225,29,72,0.6)] animate-pulse">
                          Crimson Phoenix Halo
                        </option>
                        <option value="border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                          Arctic Ice Pulse
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Frame */}
                  <div className="flex items-center gap-3 bg-stone-50 p-2.5 rounded-xl border border-zinc-200/60">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center p-0.5 bg-white ${newFramePreset}`}>
                      <img src={currentUser.avatar} alt="Preview" className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-zinc-400 uppercase">Live Frame Preview</span>
                      <p className="text-xs font-black text-zinc-800">{newFrameName || 'Frame Preview'}</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer transition-all active:scale-98"
                  >
                    + Publish Frame to Store
                  </button>
                </form>

                {/* List Current Frames */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-1">
                    Live Avatar Frames ({catalogFrames.length})
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {catalogFrames.map((frame) => (
                      <div key={frame.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col items-center text-center shadow-xs">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center p-0.5 bg-white my-1 ${frame.value}`}>
                          <img src={currentUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        </div>
                        <h5 className="font-black text-xs text-zinc-900 mt-1 truncate max-w-full">{frame.name}</h5>
                        <span className="text-[9px] text-amber-600 font-extrabold mt-0.5">🪙 {frame.price} Coins</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteFrame(frame.id, frame.name)}
                          className="mt-2 text-zinc-400 hover:text-rose-600 text-[10px] flex items-center gap-1 font-bold transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 3. SUB-TAB: GAMES MANAGEMENT */}
            {catalogSubTab === 'games' && (
              <div className="flex flex-col gap-3">
                
                {/* Add Game Form */}
                <form onSubmit={handleAddGame} className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm">
                  <h4 className="font-black text-zinc-800 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-rose-500" /> Add New Voice Room Game
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Game Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Teen Patti Champion"
                        value={newGameName}
                        onChange={e => setNewGameName(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Category</label>
                      <select
                        value={newGameCategory}
                        onChange={e => setNewGameCategory(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      >
                        <option value="Board">🎲 Board Game</option>
                        <option value="Cards">🃏 Cards</option>
                        <option value="Dice">🎯 Dice</option>
                        <option value="Party">🎉 Party & Social</option>
                        <option value="Trivia">🧠 Trivia & Quiz</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Icon Emoji</label>
                      <input
                        type="text"
                        required
                        placeholder="🃏"
                        value={newGameIcon}
                        onChange={e => setNewGameIcon(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Min Players</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={newGameMin}
                        onChange={e => setNewGameMin(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Max Players</label>
                      <input
                        type="number"
                        min="2"
                        max="16"
                        value={newGameMax}
                        onChange={e => setNewGameMax(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Status</label>
                      <select
                        value={newGameStatus}
                        onChange={e => setNewGameStatus(e.target.value as any)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-bold mt-0.5 focus:outline-none focus:border-rose-500"
                      >
                        <option value="active">🟢 Active / Playable</option>
                        <option value="coming_soon">🟡 Coming Soon</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase">Description</label>
                      <input
                        type="text"
                        placeholder="Short summary of rules"
                        value={newGameDesc}
                        onChange={e => setNewGameDesc(e.target.value)}
                        className="w-full bg-stone-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 font-medium mt-0.5 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-95 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer transition-all active:scale-98"
                  >
                    + Publish Game to Platform
                  </button>
                </form>

                {/* List Current Games */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-1">
                    Platform Games ({catalogGames.length})
                  </span>

                  <div className="flex flex-col gap-2">
                    {catalogGames.map((game) => (
                      <div key={game.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-3xl shrink-0">{game.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h5 className="font-black text-xs text-zinc-900 truncate">{game.name}</h5>
                              <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                                game.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}>
                                {game.status === 'active' ? 'Active' : 'Soon'}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-400 truncate mt-0.5">{game.description}</p>
                            <span className="text-[8px] text-zinc-500 font-bold mt-1 inline-block">
                              👥 {game.minPlayers}-{game.maxPlayers} Players • {game.category}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteGame(game.id, game.name)}
                          className="text-zinc-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                          title="Delete Game"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* TAB 7: MEDIA HUB (Admin only) */}
      {activeTab === 'media_hub' && currentUser.role === 'admin' && (
        <div className="flex flex-col gap-3 overflow-y-auto pb-4">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-3 rounded-2xl text-white shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-lg">📺</span>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Media Hub</h3>
                <p className="text-[10px] text-violet-100 font-medium">Manage ads, banners & entry experience</p>
              </div>
            </div>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setMediaSubTab('ads')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                mediaSubTab === 'ads' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              📢 Ads & Banners
            </button>
            <button
              onClick={() => setMediaSubTab('entry_video')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                mediaSubTab === 'entry_video' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              🎬 Entry Video
            </button>
          </div>

          {/* ── ADS & BANNERS ── */}
          {mediaSubTab === 'ads' && (
            <div className="flex flex-col gap-3">

              {/* Create new ad form */}
              <form onSubmit={handleCreateAd} className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 border-b border-zinc-100 pb-2 mb-1">
                  <span className="text-sm">📢</span>
                  <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider">New Ad Banner</span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Title *</label>
                  <input
                    value={newAdTitle} onChange={e => setNewAdTitle(e.target.value)}
                    placeholder="e.g. ZOYO LUDO WORLD CUP" required maxLength={60}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-800 focus:outline-none focus:border-violet-400 bg-zinc-50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Subtitle</label>
                  <input
                    value={newAdSubtitle} onChange={e => setNewAdSubtitle(e.target.value)}
                    placeholder="Short description shown below title" maxLength={100}
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-800 focus:outline-none focus:border-violet-400 bg-zinc-50"
                  />
                </div>

                {/* Banner Style Selector: Gradient vs Image */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Banner Background Style</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => setNewAdBannerType('gradient')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        newAdBannerType === 'gradient'
                          ? 'bg-white text-violet-700 shadow-xs border border-violet-200'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <Palette className="w-3 h-3" />
                      <span>Gradient Preset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAdBannerType('image')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        newAdBannerType === 'image'
                          ? 'bg-white text-violet-700 shadow-xs border border-violet-200'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span>Upload Banner Image</span>
                    </button>
                  </div>
                </div>

                {/* IMAGE UPLOAD MODE */}
                {newAdBannerType === 'image' ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Upload Custom Banner Image from Storage</label>
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-all ${
                      newAdImageUploading ? 'border-violet-400 bg-violet-50' : 'border-zinc-300 bg-zinc-50 hover:border-violet-400 hover:bg-violet-50/40'
                    }`}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleBannerImageUpload}
                        disabled={newAdImageUploading}
                      />
                      {newAdImageUploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-violet-600 font-black">Uploading Image...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-zinc-400" />
                          <div className="text-center">
                            <p className="text-[10px] font-black text-zinc-700">Click to upload banner image</p>
                            <p className="text-[9px] text-zinc-400">PNG, JPG, WebP · Recommended size 600x200 (3:1)</p>
                          </div>
                        </>
                      )}
                    </label>
                    {newAdImageUrl && (
                      <div className="flex items-center gap-2 mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <img src={newAdImageUrl} alt="Uploaded Banner" className="w-16 h-8 object-cover rounded-lg border border-emerald-200 shadow-xs shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-emerald-800">Custom Image Uploaded ✅</p>
                          <p className="text-[8px] text-emerald-600 truncate">{newAdImageUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setNewAdImageUrl(''); setNewAdBannerType('gradient'); }}
                          className="text-[9px] text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* GRADIENT PRESET MODE */
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Gradient From</label>
                      <select value={newAdGradientFrom} onChange={e => setNewAdGradientFrom(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-2 py-1.5 text-[10px] font-bold text-zinc-700 bg-zinc-50 focus:outline-none focus:border-violet-400">
                        {['rose-500','pink-500','orange-500','amber-500','violet-600','blue-600','emerald-500','cyan-500'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Gradient To</label>
                      <select value={newAdGradientTo} onChange={e => setNewAdGradientTo(e.target.value)}
                        className="w-full border border-zinc-200 rounded-xl px-2 py-1.5 text-[10px] font-bold text-zinc-700 bg-zinc-50 focus:outline-none focus:border-violet-400">
                        {['pink-600','rose-600','amber-600','yellow-500','purple-700','indigo-700','teal-600','sky-600'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Badge Label</label>
                    <input
                      value={newAdBadge} onChange={e => setNewAdBadge(e.target.value)}
                      placeholder="🔥 Live Event" maxLength={30}
                      className="w-full border border-zinc-200 rounded-xl px-2 py-1.5 text-[10px] font-bold text-zinc-800 focus:outline-none focus:border-violet-400 bg-zinc-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5 text-violet-600" />
                      <span>Redirect Link URL</span>
                    </label>
                    <input
                      value={newAdLinkUrl} onChange={e => setNewAdLinkUrl(e.target.value)}
                      placeholder="https://example.com" type="text"
                      className="w-full border border-zinc-200 rounded-xl px-2 py-1.5 text-[10px] font-bold text-zinc-800 focus:outline-none focus:border-violet-400 bg-zinc-50"
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Live Preview (What Users See)</span>
                    {newAdLinkUrl && (
                      <span className="text-[8px] font-bold text-violet-600 flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" /> Redirects to site
                      </span>
                    )}
                  </div>
                  <div className="relative rounded-[20px] h-20 p-3.5 flex flex-col justify-between overflow-hidden shadow-sm border border-zinc-200/50">
                    {newAdBannerType === 'image' && newAdImageUrl ? (
                      <>
                        <img src={newAdImageUrl} alt="Banner Preview" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
                      </>
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-r from-${newAdGradientFrom} to-${newAdGradientTo}`}>
                        <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-white/10 rounded-full blur-md" />
                      </div>
                    )}
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-[8px] bg-black/30 backdrop-blur-xs text-white font-extrabold tracking-wider px-2 py-0.5 rounded-full uppercase">
                        {newAdBadge || '🔥 Live Event'}
                      </span>
                      {newAdLinkUrl && (
                        <span className="text-[8px] bg-white/20 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <ExternalLink className="w-2 h-2" />
                        </span>
                      )}
                    </div>
                    <div className="relative z-10">
                      <p className="text-[11px] font-black text-white leading-tight uppercase drop-shadow-xs">{newAdTitle || 'BANNER TITLE'}</p>
                      {newAdSubtitle && <p className="text-[9px] text-white/90 mt-0.5 drop-shadow-xs">{newAdSubtitle}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setNewAdActive(!newAdActive)}
                      className={`w-9 h-5 rounded-full transition-colors ${newAdActive ? 'bg-emerald-500' : 'bg-zinc-300'} flex items-center`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${newAdActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase">Active</span>
                  </label>
                  <button type="submit"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow cursor-pointer uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Publish Ad</span>
                  </button>
                </div>
              </form>


              {/* Ads List */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-1">
                  <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider">📋 Published Ads ({adsList.length})</span>
                  <button onClick={fetchMediaHubData} className="text-[9px] text-violet-600 font-bold cursor-pointer hover:underline">↻ Refresh</button>
                </div>
                {adsLoading ? (
                  <div className="text-center py-4 text-zinc-400 text-[10px]">Loading...</div>
                ) : adsList.length === 0 ? (
                  <div className="text-center py-4 text-zinc-400 text-[10px]">No ads created yet. Use the form above to publish your first banner.</div>
                ) : (
                  adsList.map(ad => (
                    <div key={ad._id} className={`border rounded-xl p-2.5 flex gap-2.5 items-center ${ad.is_active ? 'border-emerald-200 bg-emerald-50/50' : 'border-zinc-200 bg-zinc-50 opacity-60'}`}>
                      {ad.image_url ? (
                        <img src={ad.image_url} alt={ad.title} className="w-12 h-10 object-cover rounded-lg border border-zinc-200 shrink-0" />
                      ) : (
                        <div className={`w-12 h-10 rounded-lg bg-gradient-to-r from-${ad.gradient_from || 'rose-500'} to-${ad.gradient_to || 'pink-600'} flex items-center justify-center shrink-0 text-white font-black text-[9px]`}>
                          AD
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black text-zinc-800 truncate">{ad.title}</span>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase ${ad.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500'}`}>
                            {ad.is_active ? 'Live' : 'Paused'}
                          </span>
                        </div>
                        {ad.subtitle && <p className="text-[9px] text-zinc-500 truncate">{ad.subtitle}</p>}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] text-zinc-400 font-bold">{ad.badge}</span>
                          {ad.link_url && (
                            <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-violet-600 font-bold hover:underline flex items-center gap-0.5 truncate max-w-[120px]">
                              <ExternalLink className="w-2 h-2 shrink-0" /> {ad.link_url}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleAd(ad._id, ad.is_active)}
                          className={`text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all ${ad.is_active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                        >{ad.is_active ? 'Pause' : 'Activate'}</button>

                        <button
                          onClick={() => setConfirmModal({ isOpen: true, title: 'Delete Ad', message: `Delete "${ad.title}"?`, onConfirm: () => { handleDeleteAd(ad._id); setConfirmModal(p => ({ ...p, isOpen: false })); } })}
                          className="text-zinc-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                        ><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── ENTRY VIDEO ── */}
          {mediaSubTab === 'entry_video' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                  <span className="text-sm">🎬</span>
                  <div>
                    <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider">Entry Video</span>
                    <p className="text-[9px] text-zinc-400 mt-0.5">Upload a custom video shown to users when they open the app. Recommended: 9:16 vertical, MP4, max 50MB.</p>
                  </div>
                </div>

                {/* Enable toggle */}
                <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div>
                    <p className="text-[10px] font-black text-zinc-700">Entry Video Enabled</p>
                    <p className="text-[9px] text-zinc-400">When enabled, this video plays on app launch instead of the default animated splash.</p>
                  </div>
                  <div
                    onClick={() => setEntryVideoEnabled(!entryVideoEnabled)}
                    className={`w-10 h-5.5 rounded-full cursor-pointer transition-colors flex items-center px-0.5 ${entryVideoEnabled ? 'bg-violet-600' : 'bg-zinc-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${entryVideoEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>

                {/* Video URL input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Video URL (or upload below)</label>
                  <input
                    value={entryVideoUrl} onChange={e => setEntryVideoUrl(e.target.value)}
                    placeholder="https://... or /uploads/video_xxx.mp4"
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-700 focus:outline-none focus:border-violet-400 bg-zinc-50"
                  />
                </div>

                {/* Upload area */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Upload Video File</label>
                  <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-5 cursor-pointer transition-all ${entryVideoUploading ? 'border-violet-400 bg-violet-50' : 'border-zinc-300 bg-zinc-50 hover:border-violet-400 hover:bg-violet-50/40'}`}>
                    <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" className="hidden" onChange={handleEntryVideoUpload} disabled={entryVideoUploading} />
                    {entryVideoUploading ? (
                      <>
                        <div className="w-7 h-7 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-violet-600 font-black">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">📁</span>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-zinc-700">Click to select video</p>
                          <p className="text-[9px] text-zinc-400">MP4 · 9:16 vertical · Max 50MB</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {/* Preview */}
                {entryVideoUrl && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Preview</label>
                    <video
                      src={entryVideoUrl} controls muted playsInline
                      className="w-full max-h-48 rounded-xl object-contain bg-black border border-zinc-200"
                    />
                  </div>
                )}

                <button
                  onClick={handleSaveEntryVideo}
                  disabled={entryVideoUploading}
                  className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow ${entryVideoSaved ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:brightness-110'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {entryVideoSaved ? '✅ Saved!' : '💾 Save Entry Video Settings'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-xs bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-[ping_1.5s_infinite]"></span>
              <h3 className="font-black text-zinc-900 text-[11px] uppercase tracking-wider">{confirmModal.title}</h3>
            </div>
            
            <p className="text-zinc-600 text-[10px] leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="py-2 bg-white hover:bg-stone-50 text-zinc-500 font-bold rounded-xl text-[10px] border border-zinc-200 cursor-pointer text-center uppercase"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-black rounded-xl text-[10px] shadow cursor-pointer text-center uppercase tracking-wider"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
