import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAiChatEnabled } from '@/hooks/useAiChatEnabled';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const DataChatWidget: React.FC = () => {
  const { enabled, loading: loadingEnabled } = useAiChatEnabled();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (loadingEnabled || !enabled) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-data', {
        body: { messages: updatedMessages },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data?.response || 'No se pudo obtener una respuesta.',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
      console.error('Chat error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error al procesar tu consulta. Intenta de nuevo.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 z-50 w-12 h-12 rounded-full bg-tms-green text-black shadow-lg flex items-center justify-center hover:bg-tms-green/80 transition-all hover:scale-105"
          title="Chat con tus datos"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-tms-green" />
              <span className="font-medium text-sm text-black">Chat con tus Datos</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMessages([])}
                  title="Limpiar conversación"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4 text-gray-500" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8 space-y-3">
                <MessageSquare className="w-10 h-10 mx-auto text-gray-300" />
                <p className="font-medium text-gray-500">¿Qué quieres saber?</p>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p>"¿Cuánto gasté en combustible este mes?"</p>
                  <p>"¿Qué cliente tiene más facturas pendientes?"</p>
                  <p>"Top 5 grúas con más servicios"</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-400 text-sm ml-9">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Consultando datos...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                disabled={isLoading}
                className="flex-1 text-sm bg-white border-gray-300"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="bg-tms-green text-black hover:bg-tms-green/80 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
