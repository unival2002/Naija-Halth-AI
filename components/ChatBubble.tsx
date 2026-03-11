import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Sender } from '../types';
import { UserIcon } from './icons/UserIcon';
import { AIIcon } from './icons/AIIcon';

const ChatBubble: React.FC<{ 
  message: Message; 
  onListen?: () => void;
  isListening?: boolean;
}> = ({ message, onListen, isListening }) => {
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;

  if (isSystem) {
    return (
      <div className="text-center text-sm text-gray-500 py-2 italic">
        {message.text}
      </div>
    );
  }

  // Remove JSON code blocks from the displayed text, including partial ones during streaming
  const displayText = message.text
    .replace(/```json[\s\S]*?(?:```|$)/g, '')
    .trim();

  const bubbleClasses = isUser
    ? 'bg-teal-600 text-white rounded-l-2xl rounded-tr-2xl'
    : 'bg-gray-200 text-gray-800 rounded-r-2xl rounded-tl-2xl';

  const Icon = isUser ? UserIcon : AIIcon;
  const iconContainerClasses = isUser 
    ? "bg-gray-300" 
    : "bg-teal-100";

  return (
    <div className={`flex items-start gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconContainerClasses}`}>
        <Icon />
      </div>
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={`px-5 py-3 ${bubbleClasses} shadow-md prose prose-sm max-w-none`}
        >
          <div className={isUser ? 'text-white' : 'text-gray-800'}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayText}
            </ReactMarkdown>
          </div>
          
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20 flex flex-wrap gap-2">
              {message.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-black/10 px-2 py-1 rounded text-[10px] truncate max-w-[150px]">
                  <span className="truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {onListen && (
          <button 
            onClick={onListen}
            disabled={isListening}
            className={`text-xs font-bold mt-2 flex items-center gap-1 hover:text-teal-600 transition ${isListening ? 'text-teal-600 animate-pulse' : 'text-gray-500'}`}
          >
            {isListening ? 'Generating Audio...' : '🔊 Click to listen'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
