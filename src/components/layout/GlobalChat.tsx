import { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import { Profile } from '@/types/database';

export default function GlobalChat() {
  const { chatOpen, selectedChat, profile, closeChat, selectChat, closeSelectedChat } = useChatContext();
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSelectChat = (friend: Profile) => {
    selectChat(friend);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleClose = () => {
    closeSelectedChat();
    setIsMinimized(false);
  };

  if (!profile) return null;

  return (
    <>
      <ChatSidebar 
        isOpen={chatOpen}
        onClose={closeChat}
        currentUser={profile}
        onSelectChat={handleSelectChat}
        selectedChat={selectedChat}
      />

      {selectedChat && (
        <ChatWindow 
          friend={selectedChat}
          currentUser={profile}
          onClose={handleClose}
          onMinimize={handleMinimize}
          isMinimized={isMinimized}
        />
      )}
    </>
  );
}