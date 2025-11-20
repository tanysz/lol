/**
 * Gemini Controller untuk WA Bot
 * Handle commands /ai dan integrasi dengan webhook
 */

import { Request, Response } from 'express';
import { geminiService } from '../services/gemini-service';

/**
 * Initialize Gemini Service
 * Panggil ini saat aplikasi startup
 */
export async function initializeGemini(): Promise<void> {
  try {
    await geminiService.initialize();
    console.log('✅ Gemini Controller ready');
  } catch (error) {
    console.error('❌ Failed to initialize Gemini Controller:', error);
    throw error;
  }
}

/**
 * Handle /ai command dari WhatsApp
 * 
 * Usage: /ai Apa itu TypeScript?
 */
export async function handleAiCommand(
  message: string,
  from: string
): Promise<{ success: boolean; reply: string }> {
  
  try {
    // Remove /ai prefix
    const question = message.replace(/^\/ai\s+/i, '').trim();

    if (!question) {
      return {
        success: false,
        reply: '❌ *Cara Pakai:*\n\n/ai <pertanyaan>\n\n*Contoh:*\n/ai Apa itu Node.js?\n/ai Jelaskan TypeScript'
      };
    }

    // Check if service ready
    if (!geminiService.isServiceReady()) {
      return {
        success: false,
        reply: '❌ AI service belum siap. Coba lagi dalam beberapa detik.'
      };
    }

    // Get response from Gemini
    console.log(`🤖 Processing AI request from ${from}: ${question.substring(0, 50)}...`);
    
    const answer = await geminiService.ask(question);

    return {
      success: true,
      reply: `🤖 *Gemini 2.5 Pro:*\n\n${answer}`
    };

  } catch (error: any) {
    console.error('❌ AI command error:', error.message);
    
    return {
      success: false,
      reply: '❌ Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.'
    };
  }
}

/**
 * Handle /ai command dengan gambar
 * 
 * Usage: kirim gambar dengan caption /ai Jelaskan gambar ini
 */
export async function handleAiImageCommand(
  message: string,
  imagePath: string,
  from: string
): Promise<{ success: boolean; reply: string }> {
  
  try {
    const question = message.replace(/^\/ai\s+/i, '').trim() || 'Jelaskan gambar ini';

    if (!geminiService.isServiceReady()) {
      return {
        success: false,
        reply: '❌ AI service belum siap. Coba lagi dalam beberapa detik.'
      };
    }

    console.log(`🤖 Processing AI image request from ${from}`);
    
    const answer = await geminiService.askWithImage(question, imagePath);

    return {
      success: true,
      reply: `🤖 *Gemini 2.5 Pro:*\n\n${answer}`
    };

  } catch (error: any) {
    console.error('❌ AI image command error:', error.message);
    
    return {
      success: false,
      reply: '❌ Maaf, terjadi kesalahan saat memproses gambar. Silakan coba lagi.'
    };
  }
}

/**
 * Get Gemini service status
 * For monitoring/health check
 */
export function getGeminiStatus() {
  const status = geminiService.getStatus();
  
  return {
    service: 'Gemini AI',
    ...status,
    refreshIntervalText: `${status.refreshInterval} minutes`
  };
}

/**
 * Express route handler (optional)
 */
export async function geminiWebhookHandler(req: Request, res: Response) {
  try {
    const { message, from, hasImage, imagePath } = req.body;

    // Check if it's AI command
    if (!message?.toLowerCase().startsWith('/ai')) {
      return res.json({ handled: false });
    }

    // Handle with or without image
    let result;
    if (hasImage && imagePath) {
      result = await handleAiImageCommand(message, imagePath, from);
    } else {
      result = await handleAiCommand(message, from);
    }

    return res.json({
      handled: true,
      ...result
    });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
