import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
        isUser ? 'bg-tms-green/20' : 'bg-gray-100'
      )}>
        {isUser ? <User className="w-4 h-4 text-black" /> : <Bot className="w-4 h-4 text-gray-600" />}
      </div>
      <div className={cn(
        'rounded-lg px-3 py-2 max-w-[85%] text-sm',
        isUser 
          ? 'bg-tms-green/10 text-black' 
          : 'bg-gray-50 text-black border border-gray-200'
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:text-black prose-p:text-black prose-strong:text-black prose-td:text-black prose-th:text-black">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
