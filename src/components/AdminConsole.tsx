import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { PRESET_AVATARS } from '../data';
import { 
  Shield, Users, Coins, RefreshCw, 
  Search, Lock, Unlock, UserPlus, FileText, ArrowRightLeft 
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

type ManagementTab = 'user_control' | 'coin_transfer' | 'access_privilege' | 'audit_logs';

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

  // Sync activeTab with role-based accessibility on initial load
  useEffect(() => {
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
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
      const statusRes = await fetch('/api/db-status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setDbStatus(statusData);
      }

      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        console.log('🔍 Fetched users data:', usersData);
        if (usersData.success) {
          console.log('✅ Setting users:', usersData.users.length, 'users');
          setUsers(usersData.users);
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
    }
  }, [currentUser]);

  // Hierarchical User Filter - Different logic per tab
  const getManageableUsers = () => {
    console.log('🔍 Current user role:', currentUser.role);
    console.log('🔍 Current tab:', activeTab);
    console.log('🔍 Total users in state:', users.length);

    // Admin always sees all users in all tabs
    if (currentUser.role === 'admin') {
      console.log('✅ Admin sees all users:', users.length);
      return users;
    }

    // Manager logic depends on the active tab
    if (currentUser.role === 'manager') {
      // In Coin Transfer tab: Manager sees ALL users (to transfer coins to anyone)
      if (activeTab === 'coin_transfer') {
        console.log('✅ Manager (Coin Transfer tab) sees all users:', users.length);
        return users;
      }

      // In User Control tab: Manager only sees users under their management
      if (activeTab === 'user_control') {
        const managedUsers = users.filter(u =>
          u.createdBy === currentUser.name ||
          u.managerId === currentUser.name ||
          u.managerId === (currentUser._id || currentUser.id)
        );
        console.log('✅ Manager (User Control tab) sees managed users:', managedUsers.length);
        return managedUsers;
      }

      // For other tabs (access_privilege), show all users
      console.log('✅ Manager (other tabs) sees all users:', users.length);
      return users;
    }

    // Coin sellers see all users (they need to transfer coins to anyone)
    console.log('✅ Coin seller sees all users:', users.length);
    return users;
  };

  const filteredUsers = getManageableUsers().filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.role || 'user').toLowerCase().includes(searchQuery.toLowerCase())
  );

  console.log('🔍 Filtered users after search:', filteredUsers.length, 'query:', searchQuery);

  // Managers list for access assignment (Admin only)
  const managers = users.filter(u => u.role === 'manager');

  // Trigger Confirmation: Account Block / Unblock
  const handleToggleBlock = (userId: string, currentBlockedStatus: boolean) => {
    const targetUser = users.find(u => (u._id || u.id) === userId);
    if (!targetUser) return;

    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
      setErrorMsg('Access Denied. Only Admins and Managers can restrict accounts.');
      return;
    }

    if (targetUser.name === 'Admin') {
      setErrorMsg('Cannot restrict the super Admin account!');
      return;
    }

    const actionText = currentBlockedStatus ? 'UNBLOCK' : 'BLOCK';
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
    try {
      const res = await fetch(`/api/users/${userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: !currentBlockedStatus })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Account for ${data.user.name} was successfully ${!currentBlockedStatus ? 'BLOCKED' : 'UNBLOCKED'}!`);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to modify block status.');
      }
    } catch (err) {
      setErrorMsg('Connection error.');
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 text-xs text-zinc-800 p-4 overflow-y-auto scrollbar-none pb-12 relative">
      
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

      {/* DB Status Badge */}
      <div className={`mt-3 p-2.5 rounded-xl border flex items-center justify-between text-[10px] ${
        dbStatus.connected 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dbStatus.connected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
          <span className="font-bold uppercase tracking-wider">Database Mode:</span>
          <span className="font-black">{dbStatus.connected ? 'MongoDB Cloud Active' : dbStatus.mode}</span>
        </div>
        {dbStatus.connected && <span className="font-semibold text-emerald-700 font-mono text-[9px]">Atlas Connected</span>}
      </div>

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
        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
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
          </>
        )}
      </div>

      {/* Dynamic Sub-Page Content */}
      <div className="mt-4 flex flex-col flex-1 gap-3 min-h-0">
        
        {/* TAB 1: USER CONTROL (Admin & Manager Only) */}
        {activeTab === 'user_control' && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <div className="flex flex-col gap-3">
            
            {/* Hierarchy Info Eyebrow */}
            <div className="bg-white p-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-[10px] leading-relaxed flex flex-col gap-1 shadow-sm">
              <span className="font-extrabold text-zinc-800 flex items-center gap-1">
                👥 Hierarchical Directory Status
              </span>
              {currentUser.role === 'admin' ? (
                <span>As a <strong>Super Admin</strong>, you are at the root of the hierarchy and can view and control all registered accounts.</span>
              ) : (
                <span>As a <strong>Manager</strong>, you can view, block/unblock, and register users that are registered directly under you.</span>
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
                  {currentUser.role === 'manager' ? 'Add User Under Me' : 'Register New User'}
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
                placeholder="Search registered users..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
            </div>

            {/* List for user block / unblock */}
            <div className="flex flex-col gap-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No users under your jurisdiction matched.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const uId = user._id || user.id;
                  const isSelf = user.name === currentUser.name;
                  const isBlocked = !!user.isBlocked;

                  return (
                    <div 
                      key={uId}
                      className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={user.avatar} 
                            alt={user.name} 
                            className={`w-9 h-9 rounded-full object-cover border ${isBlocked ? 'border-rose-400 opacity-50' : 'border-zinc-200'}`}
                          />
                          {isBlocked && (
                            <div className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 text-[7px] font-black border border-white">
                              🚫
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-zinc-900 flex items-center gap-1 text-xs truncate">
                            {user.name}
                            {isSelf && <span className="text-[7px] bg-rose-50 text-rose-600 border border-rose-200 px-1 rounded uppercase font-extrabold">Me</span>}
                          </p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">
                            Role: <span className="text-rose-600 font-extrabold uppercase font-mono">{user.role || 'user'}</span>
                            {user.createdBy && user.createdBy !== 'self' && (
                              <span className="ml-1 border-l border-zinc-200 pl-1 text-[8px]">By: {user.createdBy}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isBlocked 
                            ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isBlocked ? 'Blocked' : 'Active'}
                        </span>
                        
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleBlock(uId, isBlocked)}
                            disabled={user.name === 'Admin'}
                            className={`p-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              isBlocked 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' 
                                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                            }`}
                            title={isBlocked ? 'Unblock User' : 'Block User'}
                          >
                            {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
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
                placeholder="Search recipient by username..."
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
            </div>

            {/* List for transferring coins */}
            <div className="flex flex-col gap-2">
              {filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 font-bold bg-white rounded-2xl border border-zinc-200 shadow-sm">
                  No recipient accounts matched.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const uId = user._id || user.id;
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
                            <p className="text-[9px] text-zinc-500 mt-0.5">
                              Coins Balance: <span className="text-amber-600 font-bold font-mono">🪙 {user.coins}</span>
                            </p>
                          </div>
                        </div>

                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                          user.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          user.role === 'manager' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          user.role === 'coin_seller' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {user.role || 'user'}
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
                  const uId = user._id || user.id;
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

      </div>

      {/* Polish Absolute Action Confirmation Modal Overlay */}
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
