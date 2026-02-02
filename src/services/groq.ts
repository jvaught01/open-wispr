import Groq from 'groq-sdk';

export interface SentimentResult {
  intent: 'write' | 'edit' | 'delete' | 'refactor' | 'explain' | 'debug' | 'question' | 'other';
  emotion: 'neutral' | 'frustrated' | 'excited' | 'confused';
  confidence: number;
}

export interface TranscribeOptions {
  model?: string;
  language?: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  options: TranscribeOptions = {}
): Promise<string> {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

  // Determine file extension from blob type
  let filename = 'recording.webm';
  if (audioBlob.type.includes('wav')) {
    filename = 'recording.wav';
  } else if (audioBlob.type.includes('mp4')) {
    filename = 'recording.mp4';
  } else if (audioBlob.type.includes('ogg')) {
    filename = 'recording.ogg';
  }

  // Convert blob to file for the API
  const file = new File([audioBlob], filename, { type: audioBlob.type });

  const model = options.model || 'whisper-large-v3-turbo';
  const language = options.language === 'auto' ? undefined : (options.language || 'en');

  const transcription = await groq.audio.transcriptions.create({
    file,
    model,
    language,
    response_format: 'text',
  });

  return transcription as unknown as string;
}

export async function analyzeSentiment(
  text: string,
  apiKey: string
): Promise<SentimentResult> {
  const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

  const prompt = `Analyze the following transcribed voice command for coding intent and emotion.

Text: "${text}"

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": one of ["write", "edit", "delete", "refactor", "explain", "debug", "question", "other"],
  "emotion": one of ["neutral", "frustrated", "excited", "confused"],
  "confidence": number between 0 and 1
}

Intent definitions:
- write: Creating new code, adding features
- edit: Modifying existing code
- delete: Removing code
- refactor: Restructuring without changing behavior
- explain: Asking for explanation
- debug: Finding/fixing bugs
- question: General question
- other: Doesn't fit other categories`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
    max_tokens: 100,
  });

  const response = completion.choices[0]?.message?.content || '';

  try {
    // Parse the JSON response
    const parsed = JSON.parse(response.trim());
    return {
      intent: parsed.intent || 'other',
      emotion: parsed.emotion || 'neutral',
      confidence: parsed.confidence || 0.5,
    };
  } catch {
    // Default fallback if parsing fails
    return {
      intent: 'other',
      emotion: 'neutral',
      confidence: 0.5,
    };
  }
}
