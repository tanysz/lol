/**
 * Gemini 2.5 Pro Service dengan Auto-Refresh
 * Compatible dengan existing AI control system
 */

import { GeminiClient } from '../../gemini_lib/dist/index.js';
import { readFileSync } from 'fs';
import path from 'path';

class GeminiService {
  private client: GeminiClient | null = null;
  private isReady: boolean = false;
  private cookiesPath: string;
  private autoRefreshInterval: number = 1800000; // 30 minutes

  constructor() {
    // Path ke cookies.json
    this.cookiesPath = path.join(__dirname, '../../gemini_lib/cookies.json');
  }

  /**
   * Initialize Gemini Client dengan auto-refresh
   */
  async initialize(): Promise<void> {
    if (this.isReady) {
      console.log('⚠️  Gemini already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing Gemini Service...');

      // Load cookies
      const cookiesData = JSON.parse(readFileSync(this.cookiesPath, 'utf-8'));

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

      // Create Gemini client
      this.client = new GeminiClient({
        secure1PSID,
        secure1PSIDTS,
        modelName: 'gemini-2.5-pro',
        timeout: 30000,
      });

      // Initialize dengan auto-refresh
      console.log('🔄 Enabling auto-refresh cookies...');
      await this.client.initializeWithAutoRefresh(this.autoRefreshInterval);

      this.isReady = true;

      console.log('✅ Gemini Service ready!');
      console.log(`   Model: gemini-2.5-pro`);
      console.log(`   Auto-refresh: Every ${this.autoRefreshInterval / 60000} minutes`);
      console.log(`   Cookies: ${this.cookiesPath}`);

      // Setup cleanup handlers
      this.setupCleanupHandlers();
    } catch (error: any) {
      console.error('❌ Failed to initialize Gemini:', error.message);
      console.error('   Make sure cookies.json exists in gemini_lib/');
      throw error;
    }
  }

  /**
   * Ask question to Gemini 2.5 Pro
   */
  async ask(question: string): Promise<string> {
    if (!this.isReady || !this.client) {
      throw new Error('Gemini service not ready. Call initialize() first.');
    }

    try {
      const response = await this.client.ask(question);
      return response.content;
    } catch (error: any) {
      console.error('❌ Gemini ask error:', error.message);
      throw error;
    }
  }

  /**
   * Ask with image support
   */
  async askWithImage(question: string, imagePath: string): Promise<string> {
    if (!this.isReady || !this.client) {
      throw new Error('Gemini service not ready. Call initialize() first.');
    }

    try {
      const response = await this.client.ask(question, imagePath);
      return response.content;
    } catch (error: any) {
      console.error('❌ Gemini ask with image error:', error.message);
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isServiceReady(): boolean {
    return this.isReady;
  }

  /**
   * Get service status
   */
  getStatus(): {
    ready: boolean;
    model: string;
    autoRefresh: boolean;
    refreshInterval: number;
  } {
    return {
      ready: this.isReady,
      model: 'gemini-2.5-pro',
      autoRefresh: true,
      refreshInterval: this.autoRefreshInterval / 60000, // in minutes
    };
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
      console.log('🧹 Cleaning up Gemini service...');

      try {
        await this.client.cleanup();
        this.isReady = false;
        this.client = null;

        console.log('✅ Gemini cleanup done');
      } catch (error: any) {
        console.error('❌ Cleanup error:', error.message);
      }
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
