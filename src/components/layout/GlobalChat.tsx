import { useChatContext } from '@/contexts/ChatContext';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import { Profile } from '@/types/database';

export default function GlobalChat() {
  const { chatOpen, selectedChat, profile, closeChat, selectChat, closeSelectedChat } = useChatContext();

  const handleSelectChat = (friend: Profile) => {
    selectChat(friend);
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
          onClose={closeSelectedChat}
        />
      )}
    </>
  );
}
