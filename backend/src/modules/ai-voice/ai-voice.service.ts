import axios from "axios";
import { env } from "@/config/env";
import { prisma } from "@/config/prisma";
import { askCopilot } from "@/modules/ai-copilot/ai-copilot.service";

interface TranscribeInput {
  hospitalId: string;
  userId: string;
  audioBase64: string;
  language?: string;
}

// Spec §32: transcription happens here via ai-service (faster-whisper);
// "intent detection + response" is delegated to the existing ai-copilot
// Q&A path, which only ever answers questions — voice input can never
// silently book, cancel, or modify anything.
export async function transcribeAndAsk(input: TranscribeInput) {
  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId: input.hospitalId,
      userId: input.userId,
      feature: "voice",
      inputSummary: "Voice transcription request",
      dataScope: {},
    },
  });

  let transcript: string;
  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/voice/transcribe`, {
      audio_base64: input.audioBase64,
      language: input.language,
    });
    transcript = data.text;
  } catch {
    await prisma.aIOutput.create({
      data: { aiRequestId: aiRequest.id, output: { error: "transcription_failed" } as never, requiresApproval: false },
    });
    throw Object.assign(
      new Error("Transcription failed — the AI service may be unavailable, or the Whisper model isn't ready yet."),
      { statusCode: 502 }
    );
  }

  if (!transcript.trim()) {
    await prisma.aIOutput.create({
      data: { aiRequestId: aiRequest.id, output: { transcript: "" } as never, requiresApproval: false },
    });
    return { transcript: "", answer: "I couldn't hear anything in that recording — please try again.", dataUsed: null };
  }

  const { answer, dataUsed } = await askCopilot(input.hospitalId, input.userId, transcript);

  await prisma.aIOutput.create({
    data: { aiRequestId: aiRequest.id, output: { transcript, answer } as never, requiresApproval: false },
  });

  return { transcript, answer, dataUsed };
}