import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-tms-green/20' : 'bg-muted'
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className={cn(
        'rounded-lg px-3 py-2 max-w-[88%] text-sm overflow-hidden',
        isUser 
          ? 'bg-tms-green/10' 
          : 'bg-muted/50 border border-border'
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="chat-markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2 rounded border border-border">
                    <table className="w-full text-xs border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-muted/80">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="text-left px-2 py-1.5 font-semibold text-xs border-b border-border whitespace-nowrap">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-2 py-1 text-xs border-b border-border/50">{children}</td>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-muted/30">{children}</tr>
                ),
                p: ({ children }) => (
                  <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-tms-green">{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-xs leading-relaxed">{children}</li>
                ),
                h1: ({ children }) => (
                  <h3 className="font-bold text-sm mb-1">{children}</h3>
                ),
                h2: ({ children }) => (
                  <h3 className="font-bold text-sm mb-1">{children}</h3>
                ),
                h3: ({ children }) => (
                  <h4 className="font-semibold text-xs mb-1">{children}</h4>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                  ) : (
                    <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto my-1.5">
                      <code>{children}</code>
                    </pre>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
