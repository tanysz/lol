/**
 * RAG Bot menggunakan Gemini 2.5 Pro dengan Cookies
 * Knowledge base: fanbel.txt (PT Fanbel Finance)
 * NO @xenova/transformers needed! Hemat 500MB + 1GB RAM
 */

import { GeminiClient } from '../../gemini_lib/dist/index.js';
import { readFileSync } from 'fs';
import path from 'path';

class RagGeminiService {
  private client: GeminiClient | null = null;
  private isReady: boolean = false;
  private knowledgeBase: string = '';
  private conversationHistory = new Map<
    string,
    Array<{ role: string; content: string }>
  >();
  private maxHistoryLength = 20; // Keep last 10 exchanges

  constructor() {
    // Will be initialized on first use
  }

  /**
   * Initialize Gemini Client dengan knowledge base Fanbel
   */
  async initialize(): Promise<void> {
    if (this.isReady) {
      console.log('⚠️  RAG Gemini already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing RAG Gemini Service...');

      // 1. Load cookies
      const cookiesPath = path.join(__dirname, '../../gemini_lib/cookies.json');
      const cookiesData = JSON.parse(readFileSync(cookiesPath, 'utf-8'));

      const secure1PSID = cookiesData.find(
        (c: any) => c.name === '__Secure-1PSID'
      )?.value;

      const secure1PSIDTS = cookiesData.find(
        (c: any) => c.name === '__Secure-1PSIDTS'
      )?.value;

      if (!secure1PSID || !secure1PSIDTS) {
        throw new Error(
          'Gemini cookies not found. Run: npm run cookie:login in gemini_lib/'
        );
      }

      // 2. Load knowledge base (fanbel.txt)
      try {
        const knowledgePath = path.join(
          __dirname,
          '../../gemini_lib/fanbel.txt'
        );
        this.knowledgeBase = readFileSync(knowledgePath, 'utf-8');
        console.log(
          `📚 Loaded Fanbel knowledge base: ${this.knowledgeBase.length} characters`
        );
      } catch (error) {
        console.warn('⚠️  Knowledge base not found, using basic prompt');
        this.knowledgeBase = 'PT Fanbel Jaya Bersama adalah perusahaan rental alat berat dan maintenance.';
      }

      // 3. Create Gemini client
      this.client = new GeminiClient({
        secure1PSID,
        secure1PSIDTS,
        modelName: 'gemini-2.5-pro', // Update ke 2.5 Pro
        timeout: 30000,
      });

      // 4. Initialize dengan auto-refresh
      console.log('🔄 Enabling auto-refresh cookies (30 min interval)...');
      await this.client.initializeWithAutoRefresh(1800000); // 30 minutes

      this.isReady = true;

      console.log('✅ RAG Gemini Service ready!');
      console.log('   Model: gemini-2.5-pro');
      console.log('   Knowledge: PT Fanbel Finance');
      console.log('   Auto-refresh: Every 30 minutes');
      console.log('   Dependencies: Lightweight (no transformers)');

      // Setup cleanup
      this.setupCleanupHandlers();
    } catch (error: any) {
      console.error('❌ Failed to initialize RAG Gemini:', error.message);
      console.error('   Make sure cookies.json and fanbel.txt exist in gemini_lib/');
      throw error;
    }
  }

  /**
   * Get response dengan context dari knowledge base
   */
  async chat(userMessage: string, userId: string): Promise<string> {
    // Auto-initialize on first use
    if (!this.isReady) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error('RAG Gemini service failed to initialize');
    }

    try {
      // Get conversation history for this user
      const history = this.conversationHistory.get(userId) || [];

      // Build system prompt dengan knowledge base
      const systemContext = `Anda adalah Sales dan Assistant Representative dari PT Fanbel Jaya Bersama.

INFORMASI PERUSAHAAN:
${this.knowledgeBase}

INSTRUKSI:
- Jawab pertanyaan customer berdasarkan informasi perusahaan di atas
- Gunakan Bahasa Indonesia yang profesional dan ramah
- Jika pertanyaan tentang layanan/produk Fanbel, berikan detail lengkap
- Jika pertanyaan di luar scope Fanbel (misal: teknis programming, tutorial, dll), jawab dengan singkat: "Maaf, saya hanya bisa membantu pertanyaan tentang layanan PT Fanbel Finance. Untuk informasi lengkap, hubungi: [kontak perusahaan]"
- Selalu helpful dan accurate
- Format jawaban dengan jelas (gunakan bullet points jika perlu)

RIWAYAT PERCAKAPAN:
${history
  .slice(-10) // Only last 5 exchanges
  .map((h) => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
  .join('\n')}

PERTANYAAN BARU:
Customer: ${userMessage}

Berikan jawaban yang profesional dan sesuai dengan role Anda sebagai representative PT Fanbel Finance:`;

      // Get response dari Gemini 2.5 Pro
      const response = await this.client.ask(systemContext);

      // Save to conversation history
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: response });

      // Keep only last N messages
      if (history.length > this.maxHistoryLength) {
        history.splice(0, history.length - this.maxHistoryLength);
      }

      this.conversationHistory.set(userId, history);

      return response;
    } catch (error: any) {
      console.error('❌ RAG chat error:', error.message);
      
      // Fallback message
      return 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi atau hubungi admin.';
    }
  }

  /**
   * Streaming version untuk real-time updates di WA
   */
  async chatStream(
    userMessage: string,
    userId: string,
    onChunk: (chunk: string, fullText: string) => Promise<void>
  ): Promise<string> {
    // Get full response
    const response = await this.chat(userMessage, userId);

    // Simulate streaming dengan kata per kata
    const words = response.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + words[i];

      // Call callback untuk update message di WA
      try {
        await onChunk(words[i], accumulated);
      } catch (error) {
        // Ignore streaming errors, continue
      }

      // Small delay untuk simulate streaming (lebih smooth)
      if (i < words.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }

    return response;
  }

  /**
   * Clear conversation history
   */
  clearHistory(userId?: string): void {
    if (userId) {
      this.conversationHistory.delete(userId);
      console.log(`🗑️  Cleared history for user ${userId}`);
    } else {
      this.conversationHistory.clear();
      console.log('🗑️  Cleared all conversation history');
    }
  }

  /**
   * Get service stats
   */
  getStats() {
    return {
      ready: this.isReady,
      model: 'gemini-2.5-pro',
      provider: 'Gemini Web (Cookies)',
      activeConversations: this.conversationHistory.size,
      totalMessages: Array.from(this.conversationHistory.values()).reduce(
        (sum, hist) => sum + hist.length,
        0
      ),
      knowledgeBaseSize: this.knowledgeBase.length,
      autoRefresh: true,
    };
  }

  /**
   * Check if ready
   */
  isServiceReady(): boolean {
    return this.isReady;
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.client && this.isReady) {
      console.log('🧹 Cleaning up RAG Gemini service...');

      try {
        await this.client.cleanup();
        this.client = null;
        this.isReady = false;

        console.log('✅ RAG Gemini cleanup done');
      } catch (error: any) {
        console.error('❌ Cleanup error:', error.message);
      }
    }
  }
}

// Export singleton instance
export const ragGeminiService = new RagGeminiService();
