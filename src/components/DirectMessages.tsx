import React, { useState } from 'react';
import { DirectMessage, User } from '../types';
import { PRESET_AVATARS } from '../data';
import { Search, ChevronLeft, Send, Play, Pause, MessageSquare, Plus, UserPlus } from 'lucide-react';

interface DirectMessagesProps {
  currentUser: User;
}

export default function DirectMessages({ currentUser }: DirectMessagesProps) {
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [chatLog, setChatLog] = useState<{ [dmId: string]: { sender: string; text: string; voice?: boolean; duration?: number }[] }>({});
  const [inputText, setInputText] = useState('');
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);

  // Modal to create custom contact
  const [showAddModal, setShowAddModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactAvatar, setContactAvatar] = useState(PRESET_AVATARS[0]);
  const [contactFirstMsg, setContactFirstMsg] = useState('Hey there! Let\'s chill on voice seats!');
  const [contactVoiceDuration, setContactVoiceDuration] = useState(0); // 0 = text, >0 = voice note

  const handleOpenDm = (dm: DirectMessage) => {
    setActiveDm(dm);
    setDms(prev => prev.map(d => d.id === dm.id ? { ...d, unread: false } : d));
  };

  const [activeDm, setActiveDm] = useState<DirectMessage | null>(null);

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    const dmId = `dm_${Date.now()}`;
    const isVoice = contactVoiceDuration > 0;

    const newDm: DirectMessage = {
      id: dmId,
      senderId: `bot_${Date.now()}`,
      senderName: contactName.trim(),
      senderAvatar: contactAvatar,
      message: isVoice ? `🎤 Voice note (${contactVoiceDuration}s)` : contactFirstMsg.trim(),
      timestamp: 'Just Now',
      isVoice,
      voiceDuration: isVoice ? contactVoiceDuration : undefined,
      unread: true
    };

    setDms(prev => [newDm, ...prev]);
    setChatLog(prev => ({
      ...prev,
      [dmId]: [
        {
          sender: contactName.trim(),
          text: contactFirstMsg.trim(),
          voice: isVoice,
          duration: isVoice ? contactVoiceDuration : undefined
        }
      ]
    }));

    setContactName('');
    setContactVoiceDuration(0);
    setShowAddModal(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeDm) return;

    const userMsg = { sender: currentUser.name, text: inputText.trim() };
    const currentLog = chatLog[activeDm.id] || [];
    const updatedLog = [...currentLog, userMsg];

    setChatLog(prev => ({ ...prev, [activeDm.id]: updatedLog }));
    setInputText('');

    setDms(prev => prev.map(d => d.id === activeDm.id ? { ...d, message: userMsg.text, timestamp: 'Just Now' } : d));

    const botId = activeDm.id;
    const botName = activeDm.senderName;
    setTimeout(() => {
      const replies = [
        "Aww you are so nice! Let's talk in the voice lobby! 🥰",
        "Absolutely! Let's sit together on mic seat later today! 🎙️",
        "Haha, that sounds awesome! Keep managing the rooms.",
        "Yes, challenge me in a Dice Duel anytime! 🔥",
        "GG! Make sure to send me a Golden Supercar next time 🏎️💨"
      ];
      const botText = replies[Math.floor(Math.random() * replies.length)];

      setChatLog(prev => ({
        ...prev,
        [botId]: [...(prev[botId] || []), { sender: botName, text: botText }]
      }));

      setDms(prev => prev.map(d => d.id === botId ? { ...d, message: botText, timestamp: 'Just Now', unread: true } : d));
    }, 1500);
  };

  const playVoiceNote = (text: string, id: string) => {
    if (isPlayingVoice === id) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*🎤\d()]/g, ''));
    
    utterance.onend = () => {
      setIsPlayingVoice(null);
    };
    utterance.onerror = () => {
      setIsPlayingVoice(null);
    };

    setIsPlayingVoice(id);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-xs h-full relative">
      {!activeDm ? (
        // DM List View
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-none h-full relative">
          <div className="flex justify-between items-center shrink-0">
            <h2 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-rose-500" /> Private Chat Contacts
            </h2>
            <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-extrabold px-2 py-0.5 rounded-full">
              {dms.filter(d => d.unread).length} New
            </span>
          </div>

          <div className="relative shrink-0 mt-1">
            <span className="absolute left-3 top-2.5 text-zinc-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search chat logs or contacts..."
              className="w-full bg-white border border-zinc-200 rounded-full pl-9 pr-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm"
            />
          </div>

          {/* DM Contact Cards list */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-0.5 scrollbar-none pb-12 mt-2">
            {dms.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-zinc-400 gap-3">
                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center border border-zinc-200/50">
                  <MessageSquare className="w-6 h-6 text-zinc-400 stroke-[1.8]" />
                </div>
                <h4 className="font-display font-black text-zinc-800">Your Inbox is Empty</h4>
                <p className="text-[10px] max-w-[180px] text-zinc-400 font-medium leading-relaxed">Tapping the "+" below lets you create and customize your own chat partner!</p>
              </div>
            ) : (
              dms.map((dm) => (
                <div
                  key={dm.id}
                  onClick={() => handleOpenDm(dm)}
                  className={`flex gap-3 p-3 rounded-2xl border transition-all cursor-pointer items-center justify-between ${
                    dm.unread
                      ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-50'
                      : 'bg-white border-zinc-200 hover:bg-stone-50 shadow-sm'
                  }`}
                >
                  <div className="flex gap-3 items-center min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={dm.senderAvatar}
                        alt={dm.senderName}
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                      />
                      {dm.unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-zinc-900 truncate">{dm.senderName}</h3>
                      <p className={`text-[10px] mt-0.5 truncate ${dm.unread ? 'text-rose-600 font-bold' : 'text-zinc-500'}`}>
                        {dm.message}
                      </p>
                    </div>
                  </div>

                  <div className="text-[9px] text-zinc-400 font-bold shrink-0 text-right">
                    <p>{dm.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create Contact Partner Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="absolute bottom-6 right-6 w-12 h-12 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 hover:scale-110 active:scale-95 transition-all cursor-pointer z-40 border border-white"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
      ) : (
        // Active DM view
        <div className="absolute inset-0 bg-slate-50 flex flex-col z-35">
          <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200 shrink-0 bg-white shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveDm(null)}
                className="text-zinc-500 hover:text-zinc-800 p-1 rounded-full bg-stone-100 hover:bg-stone-200 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <img
                src={activeDm.senderAvatar}
                alt={activeDm.senderName}
                className="w-8 h-8 rounded-full object-cover border border-zinc-200"
              />
              <div>
                <h3 className="font-extrabold text-zinc-900">{activeDm.senderName}</h3>
                <span className="text-[9px] text-emerald-600 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Active now
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scrollbar-none pb-16">
            {(chatLog[activeDm.id] || []).map((chat, idx) => {
              const isMe = chat.sender === currentUser.name;

              return (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[80%] ${
                    isMe ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <span className="text-[9px] text-zinc-400 mb-1 font-semibold">{chat.sender}</span>
                  <div
                    className={`p-3 rounded-2xl relative leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-tr-none'
                        : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none'
                    }`}
                  >
                    {chat.voice ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => playVoiceNote(chat.text, `voice_${idx}`)}
                          className="bg-rose-50 text-white p-2 rounded-full cursor-pointer hover:scale-105 active:scale-95 transition-all shadow"
                        >
                          {isPlayingVoice === `voice_${idx}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <div>
                          <p className="font-bold text-[10px] text-zinc-800">Play Voice Note</p>
                          <p className="text-[9px] text-zinc-400 mt-0.5">Duration: {chat.duration}s</p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium">{chat.text}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t border-zinc-200 px-4 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Send message to ${activeDm.senderName}...`}
              className="flex-1 bg-stone-50 border border-zinc-200 rounded-full px-4 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-rose-500"
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white p-2.5 rounded-full cursor-pointer shadow-md active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* --- ADD CUSTOM CONTACT OVERLAY MODAL --- */}
      {showAddModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-150 text-zinc-800">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
              <h3 className="text-xs font-black text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider">
                <UserPlus className="w-4 h-4 text-rose-500" /> Setup Custom Chat Partner
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-700 bg-stone-100 p-1.5 rounded-full text-xs border border-zinc-200 cursor-pointer animate-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContactSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="font-bold text-zinc-500">Friend Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Zara ✨"
                  className="bg-white border border-zinc-250 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-zinc-500">Choose Preset Photo</label>
                <div className="flex gap-2 justify-center py-1 bg-stone-50 border border-zinc-200 rounded-xl p-2 shadow-sm">
                  {PRESET_AVATARS.map((av, idx) => (
                    <img
                      key={idx}
                      src={av}
                      alt=""
                      onClick={() => setContactAvatar(av)}
                      className={`w-8 h-8 rounded-full object-cover cursor-pointer border transition-all ${
                        contactAvatar === av ? 'border-rose-500 scale-110 shadow-sm' : 'border-zinc-200 hover:border-zinc-350'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-zinc-500 font-bold">Partner starting message type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContactVoiceDuration(0);
                      setContactFirstMsg("Hey there! Let's talk in the voice lobby!");
                    }}
                    className={`py-1.5 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                      contactVoiceDuration === 0
                        ? 'bg-rose-50 border-rose-200 text-rose-600 font-extrabold shadow-sm'
                        : 'bg-stone-50 border-zinc-200 text-zinc-500 hover:bg-stone-100'
                    }`}
                  >
                    Text Bubble
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactVoiceDuration(12);
                      setContactFirstMsg("Hey listen to my unplugged acoustic cover draft! Tell me what you think 🎸");
                    }}
                    className={`py-1.5 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                      contactVoiceDuration > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-600 font-extrabold shadow-sm'
                        : 'bg-stone-50 border-zinc-200 text-zinc-500 hover:bg-stone-100'
                    }`}
                  >
                    Voice Note 🎤
                  </button>
                </div>
              </div>

              {contactVoiceDuration === 0 ? (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-zinc-500">Starting Message Text</label>
                  <input
                    type="text"
                    value={contactFirstMsg}
                    onChange={(e) => setContactFirstMsg(e.target.value)}
                    placeholder="Enter message..."
                    className="bg-white border border-zinc-250 rounded-xl px-3 py-2 text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-zinc-500 font-bold">Voice Duration (seconds)</label>
                  <input
                    type="number"
                    value={contactVoiceDuration}
                    onChange={(e) => setContactVoiceDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-white border border-zinc-250 rounded-xl px-3 py-1.5 text-zinc-800 focus:outline-none focus:border-rose-500 shadow-sm"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full mt-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-2.5 rounded-xl shadow cursor-pointer active:scale-[0.98] transition-transform"
              >
                + Create Chat Partner
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
