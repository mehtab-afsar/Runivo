import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { Message } from '@features/lobby/components/Message'

interface MessageData {
  id: string
  userId: string
  userName: string
  userLevel: number
  avatar: string
  message: string
  timestamp: string
}

export const LobbyChat = () => {
  const navigate = useNavigate()
  const { id: _id } = useParams()
  const [messageInput, setMessageInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const lobbyData = {
    name: 'Global Runners',
    onlineCount: 0,
  }

  const currentUserId = 'current-user'

  const [messages, setMessages] = useState<MessageData[]>([])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      const newMessage: MessageData = {
        id: Date.now().toString(),
        userId: currentUserId,
        userName: 'You',
        userLevel: 22,
        avatar: '👤',
        message: messageInput.trim(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }
      setMessages([...messages, newMessage])
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 liquid-blur-header">
        <div className="flex items-center gap-3 px-6 py-4">
          <button
            onClick={() => navigate('/lobby')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-white" />
          </button>
          <div>
            <h1 className="text-lg font-light text-white">{lobbyData.name}</h1>
            <p className="text-xs text-white/60">{lobbyData.onlineCount} online</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-20 pb-32">
        <div className="space-y-1 py-4">
          {messages.map((msg) => (
            <Message
              key={msg.id}
              id={msg.id}
              userId={msg.userId}
              userName={msg.userName}
              userLevel={msg.userLevel}
              avatar={msg.avatar}
              message={msg.message}
              timestamp={msg.timestamp}
              isCurrentUser={msg.userId === currentUserId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 liquid-blur-header border-t border-white/10">
        <div className="px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 liquid-blur-card rounded-full px-4 py-2.5">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="w-full bg-transparent border-none outline-none text-white placeholder:text-white/40 text-sm"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="p-3 bg-primary rounded-full hover:bg-primary/90 transition-colors disabled:bg-white/10 disabled:cursor-not-allowed"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LobbyChat;
