"use server";

import { validateSession } from "@/lib/auth-helpers";

export async function generatePageAISummary(page: "wip" | "capacity" | "procurement", context: Record<string, any>) {
  // We use checkAuth equivalent
  if (process.env.BYPASS_AUTH_FOR_TEST !== "true") {
    const session = await validateSession();
    if (!session) {
      throw new Error("Unauthorized.");
    }
  }

  try {
    const contextString = Object.entries(context)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");

    const pageNames = {
      wip: "WIP Dashboard",
      capacity: "Capacity & Risk",
      procurement: "Procurement Hub"
    };

    const prompt = `You are an operations assistant for Chadwick Switchboards, a switchboard manufacturing company. Based on the following data from the ${pageNames[page]}, write exactly 2-3 sentences in plain English summarising the current situation and highlighting any key takeaways. Be direct and specific. No bullet points. No headers.

Current data:
${contextString}

Summary:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        prompt: prompt,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.response) {
      throw new Error("No response string from Ollama");
    }

    return { success: true, data: { summary: json.response.trim() } };

  } catch (error) {
    console.error(`[generatePageAISummary - ${page}] Error:`, error);
    return { success: false, error: "AI insights unavailable" };
  }
}
