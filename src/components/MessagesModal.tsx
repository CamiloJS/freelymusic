import React, { useState, useEffect, useRef } from 'react';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import Send from 'lucide-react/dist/esm/icons/send.mjs';
import SquarePen from 'lucide-react/dist/esm/icons/square-pen.mjs';
import Music from 'lucide-react/dist/esm/icons/music.mjs';
import Play from 'lucide-react/dist/esm/icons/play.mjs';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useAudio } from '../context/AudioContext';
import { ChatThread, DirectMessage, Song, UserProfile } from '../types';
import {
  getStoredChatThreads,
  getStoredDirectMessages,
  saveStoredDirectMessage,
  saveStoredChatThreads,
} from '../services/storage';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialThreadId?: string;
}

export const MessagesModal: React.FC<MessagesModalProps> = ({
  isOpen,
  onClose,
  initialThreadId,
}) => {
  const { currentUser, allUsers } = useAuth();
  const { catalog } = useMusic();
  const { playSong } = useAudio();

  const [threads, setThreads] = useState<ChatThread[]>(() => getStoredChatThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId || null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPickingRecipient, setIsPickingRecipient] = useState(false);
  const [isAttachingSong, setIsAttachingSong] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialThreadId) {
      setActiveThreadId(initialThreadId);
    }
  }, [initialThreadId]);

  useEffect(() => {
    if (activeThreadId) {
      setMessages(getStoredDirectMessages(activeThreadId));
    }
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const activeThread = threads.find((t) => t.id === activeThreadId);

  const handleSendMessage = (songAttachment?: Song) => {
    if ((!inputText.trim() && !songAttachment) || !activeThreadId) return;

    const newMsg: DirectMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      receiverId: activeThread?.participantIds[0] || '',
      text: songAttachment ? `Compartió una canción: ${songAttachment.title}` : inputText.trim(),
      timestamp: `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      songAttachment: songAttachment
        ? {
            id: songAttachment.id,
            title: songAttachment.title,
            artist: songAttachment.artist,
            coverUrl: songAttachment.coverUrl,
          }
        : undefined,
    };

    saveStoredDirectMessage(activeThreadId, newMsg);
    setMessages((prev) => [...prev, newMsg]);
    setThreads(getStoredChatThreads());
    setInputText('');
    setIsAttachingSong(false);
  };

  const handleStartChatWithUser = (user: UserProfile) => {
    let thread = threads.find((t) => t.participantIds.includes(user.id));
    if (!thread) {
      thread = {
        id: `thread-${user.id}-${Date.now()}`,
        participantIds: [user.id],
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        subtitle: 'Nuevo chat',
        lastMessageTime: 'Ahora',
      };
      const updated = [thread, ...threads];
      saveStoredChatThreads(updated);
      setThreads(updated);
    }
    setActiveThreadId(thread.id);
    setIsPickingRecipient(false);
  };

  const filteredSongs = catalog.filter((s) =>
    songSearch
      ? s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
        s.artist.toLowerCase().includes(songSearch.toLowerCase())
      : true
  ).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg h-full sm:h-[85vh] bg-[#121212] border border-[#282828] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-[#242424] flex items-center justify-between bg-[#121212] flex-shrink-0">
          <div className="flex items-center gap-3">
            {activeThreadId ? (
              <button
                type="button"
                onClick={() => setActiveThreadId(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors"
                title="Volver a chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}

            {activeThreadId && activeThread ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[#242424] flex items-center justify-center text-white font-bold text-xs shadow">
                  {activeThread.avatarUrl ? (
                    <img src={activeThread.avatarUrl} alt={activeThread.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{activeThread.displayName.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-[190px]">
                    {activeThread.displayName}
                  </h3>
                  <p className="text-[11px] text-emerald-400 font-medium">
                    En línea
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  Mensajes directos
                </h2>
                <p className="text-xs text-[#b3b3b3] mt-0.5">
                  Comparte música y chatea con tus amigos
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!activeThreadId && (
              <button
                type="button"
                onClick={() => setIsPickingRecipient(true)}
                className="p-2 rounded-full text-neutral-400 hover:text-white transition-colors"
                title="Nuevo mensaje"
              >
                <SquarePen className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View 1: Pick recipient modal view */}
        {isPickingRecipient ? (
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#242424]">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Selecciona a quién escribir
              </span>
              <button
                type="button"
                onClick={() => setIsPickingRecipient(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-1">
              {allUsers
                .filter((u) => u.id !== currentUser.id)
                .map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartChatWithUser(user)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
                  >
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-white/10 shadow"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {user.displayName}
                      </h4>
                      <p className="text-xs text-[#b3b3b3] truncate">
                        @{user.username}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : activeThreadId && activeThread ? (
          /* View 2: Active Chat Conversation */
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none">
              {messages.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-[#242424] flex items-center justify-center mx-auto text-neutral-400">
                    <Music className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Comienza la conversación</h4>
                  <p className="text-xs text-[#b3b3b3] max-w-xs mx-auto">
                    Envía un saludo o comparte una canción de tu biblioteca.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          isMine
                            ? 'bg-emerald-500 text-black font-medium rounded-tr-none shadow-md'
                            : 'bg-[#242424] text-white rounded-tl-none border border-white/5'
                        }`}
                      >
                        {msg.songAttachment ? (
                          <div
                            onClick={() => {
                              const found = catalog.find((s) => s.id === msg.songAttachment?.id);
                              if (found) playSong(found, [found]);
                            }}
                            className="flex items-center gap-2.5 p-1.5 rounded-xl bg-black/20 hover:bg-black/30 cursor-pointer transition-colors"
                          >
                            <img
                              src={msg.songAttachment.coverUrl}
                              alt={msg.songAttachment.title}
                              className="w-10 h-10 rounded-lg object-cover shadow"
                            />
                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold truncate text-xs">
                                {msg.songAttachment.title}
                              </h5>
                              <p className="text-[11px] opacity-80 truncate">
                                {msg.songAttachment.artist}
                              </p>
                            </div>
                            <Play className="w-4 h-4 fill-current flex-shrink-0 mr-1" />
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                        <span
                          className={`block text-[9px] mt-1 text-right ${
                            isMine ? 'text-black/60' : 'text-neutral-400'
                          }`}
                        >
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Song attachment picker drawer */}
            {isAttachingSong && (
              <div className="p-3 border-t border-[#242424] bg-[#181818] space-y-2 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Compartir canción
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAttachingSong(false)}
                    className="p-1 text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  placeholder="Buscar canción en el catálogo..."
                  className="w-full bg-[#242424] border border-[#333] rounded-full px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none"
                />
                <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-none">
                  {filteredSongs.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSendMessage(s)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                    >
                      <img src={s.coverUrl} alt={s.title} className="w-7 h-7 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white truncate block">{s.title}</span>
                        <span className="text-[10px] text-[#b3b3b3] truncate block">{s.artist}</span>
                      </div>
                      <span className="text-emerald-400 font-bold text-[10px]">Enviar</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-[#242424] bg-[#121212] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setIsAttachingSong((prev) => !prev)}
                className={`p-2 rounded-full transition-colors ${
                  isAttachingSong ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:text-white bg-white/5'
                }`}
                title="Compartir canción"
              >
                <Music className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-[#242424] border border-[#333] rounded-full px-4 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 rounded-full bg-emerald-500 text-black disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform"
                title="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* View 3: Chat Threads List */
          <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-none">
            {threads.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <SquarePen className="w-10 h-10 text-neutral-500 mx-auto" />
                <h4 className="text-sm font-bold text-white">No tienes mensajes todavía</h4>
                <p className="text-xs text-[#b3b3b3] max-w-xs mx-auto">
                  Presiona el botón de escribir para enviar un mensaje a tus amigos.
                </p>
              </div>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242424] flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow">
                    {thread.avatarUrl ? (
                      <img src={thread.avatarUrl} alt={thread.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white">
                        {thread.displayName.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white truncate max-w-[210px]">
                        {thread.displayName}
                      </h4>
                      <span className="text-[10px] text-[#727272]">
                        {thread.lastMessageTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#b3b3b3] truncate max-w-[220px]">
                        {thread.subtitle}
                      </p>
                      {thread.unread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesModal;
