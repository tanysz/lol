// AI Control Service untuk mengelola status AI dan anti-spam

import { persistentStateService } from "./persistent-state.service";

interface MessageTracker {
  count: number;
  firstMessageTime: number;
  lastMessageTime: number;
  blockedUntil?: number;
}

class AIControlService {
  private messageTrackers: Map<string, MessageTracker> = new Map();

  // Konfigurasi anti-spam
  private readonly SPAM_THRESHOLD = 5; // 5 pesan dalam waktu singkat dianggap spam
  private readonly SPAM_TIME_WINDOW = 60000; // 60 detik (1 menit)
  private readonly SPAM_BLOCK_DURATION = 3600000; // 1 jam
  private readonly MESSAGE_COOLDOWN = 3000; // 3 detik jeda antar pesan

  /**
   * Set status AI (on/off)
   */
  setAIStatus(enabled: boolean, updatedBy?: string): void {
    persistentStateService.setAIStatus(enabled, updatedBy);
    console.log(`AI status changed to: ${enabled ? "ON" : "OFF"}`);
  }

  /**
   * Get status AI
   */
  getAIStatus(): boolean {
    return persistentStateService.getAIStatus();
  }

  /**
   * Cek apakah user di-block karena spam
   */
  isUserBlocked(userId: string): boolean {
    const tracker = this.messageTrackers.get(userId);
    if (!tracker || !tracker.blockedUntil) {
      return false;
    }

    const now = Date.now();
    if (now < tracker.blockedUntil) {
      return true;
    }

    // Block sudah expired, reset tracker
    tracker.blockedUntil = undefined;
    tracker.count = 0;
    return false;
  }

  /**
   * Hitung waktu tersisa block (dalam menit)
   */
  getBlockTimeRemaining(userId: string): number {
    const tracker = this.messageTrackers.get(userId);
    if (!tracker || !tracker.blockedUntil) {
      return 0;
    }

    const remaining = tracker.blockedUntil - Date.now();
    return Math.ceil(remaining / 60000); // konversi ke menit
  }

  /**
   * Cek dan track pesan untuk deteksi spam
   * Returns: { isSpam: boolean, shouldWait: boolean, waitTime: number }
   */
  checkAndTrackMessage(userId: string): {
    isSpam: boolean;
    shouldWait: boolean;
    waitTime: number;
  } {
    const now = Date.now();
    let tracker = this.messageTrackers.get(userId);

    // Jika user sudah di-block
    if (this.isUserBlocked(userId)) {
      return {
        isSpam: true,
        shouldWait: false,
        waitTime: 0,
      };
    }

    // Inisialisasi tracker baru
    if (!tracker) {
      tracker = {
        count: 1,
        firstMessageTime: now,
        lastMessageTime: now,
      };
      this.messageTrackers.set(userId, tracker);
      return {
        isSpam: false,
        shouldWait: false,
        waitTime: 0,
      };
    }

    // Cek cooldown antar pesan
    const timeSinceLastMessage = now - tracker.lastMessageTime;
    if (timeSinceLastMessage < this.MESSAGE_COOLDOWN) {
      return {
        isSpam: false,
        shouldWait: true,
        waitTime: this.MESSAGE_COOLDOWN - timeSinceLastMessage,
      };
    }

    // Reset counter jika sudah lewat dari time window
    const timeSinceFirst = now - tracker.firstMessageTime;
    if (timeSinceFirst > this.SPAM_TIME_WINDOW) {
      tracker.count = 1;
      tracker.firstMessageTime = now;
      tracker.lastMessageTime = now;
      return {
        isSpam: false,
        shouldWait: false,
        waitTime: 0,
      };
    }

    // Increment counter
    tracker.count++;
    tracker.lastMessageTime = now;

    // Cek apakah sudah melewati threshold spam
    if (tracker.count > this.SPAM_THRESHOLD) {
      tracker.blockedUntil = now + this.SPAM_BLOCK_DURATION;
      console.log(
        `User ${userId} detected as spam. Blocked for 1 hour until ${new Date(
          tracker.blockedUntil
        ).toISOString()}`
      );
      return {
        isSpam: true,
        shouldWait: false,
        waitTime: 0,
      };
    }

    return {
      isSpam: false,
      shouldWait: false,
      waitTime: 0,
    };
  }

  /**
   * Manual unblock user (untuk admin)
   */
  unblockUser(userId: string): boolean {
    const tracker = this.messageTrackers.get(userId);
    if (tracker && tracker.blockedUntil) {
      tracker.blockedUntil = undefined;
      tracker.count = 0;
      console.log(`User ${userId} manually unblocked`);
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): {
    aiEnabled: boolean;
    totalTrackedUsers: number;
    blockedUsers: number;
  } {
    let blockedCount = 0;
    this.messageTrackers.forEach((tracker) => {
      if (tracker.blockedUntil && Date.now() < tracker.blockedUntil) {
        blockedCount++;
      }
    });

    return {
      aiEnabled: this.getAIStatus(),
      totalTrackedUsers: this.messageTrackers.size,
      blockedUsers: blockedCount,
    };
  }

  /**
   * Cleanup old trackers (jalankan secara periodik)
   */
  cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    this.messageTrackers.forEach((tracker, userId) => {
      // Hapus tracker yang sudah tidak aktif lebih dari 24 jam
      const inactiveDuration = now - tracker.lastMessageTime;
      if (
        inactiveDuration > 86400000 &&
        (!tracker.blockedUntil || now > tracker.blockedUntil)
      ) {
        entriesToDelete.push(userId);
      }
    });

    entriesToDelete.forEach((userId) => {
      this.messageTrackers.delete(userId);
    });

    if (entriesToDelete.length > 0) {
      console.log(`Cleaned up ${entriesToDelete.length} old message trackers`);
    }
  }
}

// Export singleton instance
export const aiControlService = new AIControlService();

// Cleanup setiap 1 jam
setInterval(() => {
  aiControlService.cleanup();
}, 3600000);
