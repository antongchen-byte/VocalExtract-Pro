import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractTextFromChunk(blob: Blob, index: number, total: number): Promise<string> {
  const base64Data = await blobToBase64(blob);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: blob.type || "audio/mpeg",
              data: base64Data,
            },
          },
          {
            text: `This is part ${index + 1} of ${total} of an audio recording extracted from a video. 
            Please transcribe the voice/speech in this segment with high accuracy. 
            Identify the speakers: mark the female speaker as "interviewer" and all other speakers as "interviewee". 
            Format the transcript as a dialogue. Provide a clean, readable transcript.`,
          },
        ],
      },
    ],
  });

  return response.text || "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });
}
