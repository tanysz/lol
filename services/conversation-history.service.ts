// Conversation History Service untuk menyimpan riwayat percakapan per user

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface Conversation {
  userId: string;
  messages: Message[];
  lastUpdated: number;
}

class ConversationHistoryService {
  private conversations: Map<string, Conversation> = new Map();

  // Konfigurasi
  private readonly MAX_MESSAGES_PER_USER = 10; // Simpan max 10 pesan terakhir
  private readonly CONVERSATION_TIMEOUT = 1800000; // 30 menit (ms)
  private readonly CLEANUP_INTERVAL = 600000; // 10 menit

  constructor() {
    // Auto cleanup setiap 10 menit
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Tambah pesan user ke history
   */
  addUserMessage(userId: string, content: string): void {
    const now = Date.now();
    let conversation = this.conversations.get(userId);

    if (!conversation) {
      conversation = {
        userId,
        messages: [],
        lastUpdated: now,
      };
      this.conversations.set(userId, conversation);
    }

    // Tambah pesan user
    conversation.messages.push({
      role: "user",
      content,
      timestamp: now,
    });

    // Batasi jumlah pesan
    if (conversation.messages.length > this.MAX_MESSAGES_PER_USER * 2) {
      // Hapus pesan paling lama, tapi keep system message if exists
      conversation.messages = conversation.messages.slice(-this.MAX_MESSAGES_PER_USER * 2);
    }

    conversation.lastUpdated = now;
  }

  /**
   * Tambah pesan assistant (bot) ke history
   */
  addAssistantMessage(userId: string, content: string): void {
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      console.error(`No conversation found for user ${userId}`);
      return;
    }

    conversation.messages.push({
      role: "assistant",
      content,
      timestamp: Date.now(),
    });

    conversation.lastUpdated = Date.now();
  }

  /**
   * Get conversation history untuk user tertentu
   * Returns array of messages in format for RAG API
   */
  getHistory(userId: string): Array<{ role: string; content: string }> {
    const conversation = this.conversations.get(userId);
    
    if (!conversation) {
      return [];
    }

    // Check if conversation expired
    const now = Date.now();
    if (now - conversation.lastUpdated > this.CONVERSATION_TIMEOUT) {
      // Conversation expired, reset
      this.conversations.delete(userId);
      return [];
    }

    // Return messages in API format (without timestamp)
    return conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Get full conversation history with timestamps
   */
  getFullHistory(userId: string): Message[] {
    const conversation = this.conversations.get(userId);
    return conversation ? [...conversation.messages] : [];
  }

  /**
   * Clear history untuk user tertentu
   */
  clearHistory(userId: string): boolean {
    return this.conversations.delete(userId);
  }

  /**
   * Clear semua history (admin function)
   */
  clearAllHistory(): void {
    this.conversations.clear();
    console.log("All conversation histories cleared");
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalConversations: number;
    activeConversations: number;
    totalMessages: number;
  } {
    const now = Date.now();
    let activeCount = 0;
    let totalMessages = 0;

    this.conversations.forEach((conv) => {
      totalMessages += conv.messages.length;
      if (now - conv.lastUpdated < this.CONVERSATION_TIMEOUT) {
        activeCount++;
      }
    });

    return {
      totalConversations: this.conversations.size,
      activeConversations: activeCount,
      totalMessages,
    };
  }

  /**
   * Cleanup expired conversations
   */
  cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    this.conversations.forEach((conv, userId) => {
      if (now - conv.lastUpdated > this.CONVERSATION_TIMEOUT) {
        entriesToDelete.push(userId);
      }
    });

    entriesToDelete.forEach((userId) => {
      this.conversations.delete(userId);
    });

    if (entriesToDelete.length > 0) {
      console.log(
        `Cleaned up ${entriesToDelete.length} expired conversations`
      );
    }
  }

  /**
   * Check if user has active conversation
   */
  hasActiveConversation(userId: string): boolean {
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      return false;
    }

    const now = Date.now();
    return now - conversation.lastUpdated < this.CONVERSATION_TIMEOUT;
  }

  /**
   * Get last message from user
   */
  getLastMessage(userId: string): Message | null {
    const conversation = this.conversations.get(userId);
    if (!conversation || conversation.messages.length === 0) {
      return null;
    }

    return conversation.messages[conversation.messages.length - 1] || null;
  }

  /**
   * Get conversation summary (for debugging/monitoring)
   */
  getConversationSummary(userId: string): string {
    const conversation = this.conversations.get(userId);
    if (!conversation) {
      return "No conversation found";
    }

    const now = Date.now();
    const timeSinceUpdate = Math.floor((now - conversation.lastUpdated) / 1000);
    const isActive = timeSinceUpdate < this.CONVERSATION_TIMEOUT / 1000;

    return (
      `User: ${userId}\n` +
      `Messages: ${conversation.messages.length}\n` +
      `Last Updated: ${timeSinceUpdate}s ago\n` +
      `Status: ${isActive ? "Active" : "Expired"}`
    );
  }
}

// Export singleton instance
export const conversationHistoryService = new ConversationHistoryService();
