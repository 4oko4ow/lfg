import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getOrCreateAnonIdentity } from '../utils/anonIdentity';
import { analytics } from '../utils/analytics';
import { XMarkIcon } from '@heroicons/react/24/solid';

const Chat = ({
  isMobile = false,
  onClose,
}: {
  isMobile?: boolean;
  onClose?: () => void;
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const { id, name } = getOrCreateAnonIdentity();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        payload => {
          const newMsg = payload.new;

          setMessages(prev => {
            const alreadyExists = prev.some(m => m.id === newMsg.id);
            if (alreadyExists) return prev;

            const filtered = prev.filter(
              m =>
                !(
                  m.optimistic &&
                  m.message === newMsg.message &&
                  m.anon_id === newMsg.anon_id
                )
            );

            return [...filtered, newMsg];
          });
        }
      )
      .subscribe();

    if (isMobile) {
      analytics.chatMobile();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Ошибка при загрузке сообщений:', error);
      return;
    }

    setMessages(prev => {
      const withoutOptimistic = prev.filter(m => !m.optimistic);
      return [...withoutOptimistic, ...(data || [])];
    });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const optimisticMessage = {
      id: `temp-${Date.now()}-${Math.random()}`, // ✅ уникальный ID
      anon_id: id,
      anon_name: name,
      message: trimmed,
      created_at: new Date().toISOString(),
      optimistic: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInput('');
    scrollToBottom();

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        anon_id: id,
        anon_name: name,
        message: trimmed,
      });

    if (error) {
      console.error('Ошибка отправки в Supabase:', error);
    } else {
      analytics.chatMessageSent();
      analytics.chatMessageTyped(trimmed.length);
    }
  };

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 z-50 flex flex-col bg-zinc-950 overflow-hidden'
          : 'fixed bottom-18 right-4 w-80 h-96 bg-zinc-900 border border-zinc-700 rounded-xl flex flex-col shadow-lg overflow-hidden z-50'
      }
    >
      <div className="bg-zinc-800 p-3 text-sm font-bold border-b border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          Live-чат
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>
        {isMobile && (
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-sm">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`text-sm text-white pb-2 mb-1 border-b border-zinc-800 last:border-b-0 ${msg.optimistic ? 'opacity-70 italic' : ''
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-medium">{msg.anon_name}</span>
              <span className="text-zinc-500 text-[11px] whitespace-nowrap">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="pl-1 text-zinc-200 break-words">{msg.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 border-t border-zinc-700 bg-zinc-950 pb-[calc(env(safe-area-inset-bottom,0px)+4px)]">
        <input
          className="w-full max-w-full text-sm p-2 bg-zinc-800 text-white rounded-md outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Напиши что-нибудь…"
          autoFocus={isMobile}
          onFocus={scrollToBottom}
          inputMode="text"
          autoComplete="off"
        />
      </div>
    </div>
  );
};

export default Chat;