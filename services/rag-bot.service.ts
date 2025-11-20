/**
 * RAG Bot Service - Wrapper untuk RAG Gemini (Lightweight)
 * Uses Gemini 2.5 Pro via cookies (NO @xenova/transformers needed!)
 * Knowledge base: fanbel.txt (PT Fanbel Finance)
 */

import { ragGeminiService } from './rag-gemini.service';

export const getRagBotResponse = async (
  userMessage: string,
  userId: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> => {
  try {
    return await ragGeminiService.chat(userMessage, userId);
  } catch (error) {
    console.error("Error calling RAG Gemini:", error);
    return "Maaf, terjadi kesalahan dalam memproses permintaan Anda.";
  }
};

// Streaming version with callback for real-time updates
export const getRagBotResponseStream = async (
  userMessage: string,
  userId: string,
  onChunk: (chunk: string, fullText: string) => Promise<void>,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> => {
  try {
    const agent = await getUserAgent(userId);
    
    // Get response (Gemini currently doesn't support true streaming, so we'll simulate it)
    const response = await agent.chat(userMessage);
    
    // Simulate word-by-word streaming for better UX
    const words = response.split(" ");
    let fullText = "";
    let buffer = "";
    const WORDS_PER_CHUNK = 8; // Send every 8 words
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? " " : "");
      buffer += word;
      fullText += word;
      
      // Send chunk every WORDS_PER_CHUNK words or at the end
      if ((i + 1) % WORDS_PER_CHUNK === 0 || i === words.length - 1) {
        await onChunk(buffer, fullText);
        buffer = "";
        
        // Small delay to make streaming feel more natural
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return fullText;
  } catch (error) {
    console.error("Error calling Gemini Agent (streaming):", error);
    throw error;
  }
};
