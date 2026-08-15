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
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `- ${key}:\n${JSON.stringify(value, null, 2)}`;
        }
        return `- ${key}: ${value}`;
      })
      .join("\n");

    const pageNames = {
      wip: "WIP Dashboard",
      capacity: "Capacity & Risk",
      procurement: "Procurement Hub"
    };

    let promptInstructions = `First: exactly 2 sentences — a punchy plain English lead that captures the most important thing about the current data state. Direct, specific, include at least one number. Dry wit welcome, forced enthusiasm not. If the data looks bad, roast the team for it.
Then: exactly 3 bullet points (using a hyphen - not asterisk *) covering key stats or things to act on. Each bullet one sentence max.
OUTPUT FORMAT (CRITICAL): No headers, no bold formatting, no numbered lists, no "key takeaways" sections. Your entire response must be ONLY the 2 sentences followed immediately by the 3 hyphen bullets. Do not include any meta-text, pleasantries, or acknowledge these instructions.`;

    if (page === "capacity") {
      promptInstructions = `First: exactly 2 sentences — a punchy plain English lead that interprets the data and tells the operations team what they should actually pay attention to right now. Is the workload front-loaded or spread evenly? When does capacity get tight? Is there enough buffer? Direct, specific, include at least one number. Dry wit welcome, forced enthusiasm not. If the data looks bad, roast the team for it.
Then: exactly 3 bullet points (using a hyphen - not asterisk *) covering key stats or things to act on. Each bullet one sentence max.
OUTPUT FORMAT (CRITICAL): No headers, no bold formatting, no numbered lists, no "key takeaways" sections. Your entire response must be ONLY the 2 sentences followed immediately by the 3 hyphen bullets. Do not include any meta-text, pleasantries, or acknowledge these instructions.`;
    }

    const prompt = `You are an operations assistant for Chadwick Switchboards, a switchboard manufacturing company. Based on the following data from the ${pageNames[page]}, perform the following analysis:

${promptInstructions}

Current data:
${contextString}

Response:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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

export async function interpretNaturalLanguageFilter(
  query: string,
  context: {
    pmNames: string[];
    statusValues: string[];
    projectTypes: string[];
    todayDate: string;
  }
) {
  if (process.env.BYPASS_AUTH_FOR_TEST !== "true") {
    const session = await validateSession();
    if (!session) {
      return null;
    }
  }

  try {
    const prompt = `Act as a filter interpreter for a project management dashboard.
Available PM names: ${context.pmNames.join(', ')}
Available status values: ${context.statusValues.join(', ')}
Available project types: ${context.projectTypes.join(', ')}
Today's date: ${context.todayDate}

User query: "${query}"

Return ONLY a valid JSON object with no other text, no markdown, no explanation — just raw JSON.
The JSON object should have these optional fields: searchText (string), pm (string matching one of the available PMs), status (string matching one of the available statuses), projectType ("IFC" or "IFM"), dueDateFrom (ISO date string), dueDateTo (ISO date string), startDateFrom (ISO date string), startDateTo (ISO date string), overdue (boolean).
"overdue" means due date is before today, "this month" means due date within the current month, "this week" means due date within the current week.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
      return null;
    }

    const json = await response.json();
    if (!json || !json.response) {
      return null;
    }

    const rawResponse = json.response.trim();
    const startIndex = rawResponse.indexOf('{');
    const endIndex = rawResponse.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1) {
      return null;
    }

    const cleanJsonString = rawResponse.substring(startIndex, endIndex + 1);

    return JSON.parse(cleanJsonString);
  } catch (error) {
    console.error('[interpretNaturalLanguageFilter] Error:', error);
    return null;
  }
}

export async function generateProjectNarrative(context: Record<string, any>) {
  if (process.env.BYPASS_AUTH_FOR_TEST !== "true") {
    const session = await validateSession();
    if (!session) {
      throw new Error("Unauthorized.");
    }
  }

  try {
    const contextString = Object.entries(context)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `- ${key}:\n${JSON.stringify(value, null, 2)}`;
        }
        return `- ${key}: ${value}`;
      })
      .join("\n");

    const promptInstructions = `Write a short, plain English narrative (3 to 5 sentences) explaining the overall financial story of this project.
CRITICAL RULES:
1. DO NOT restate exact numbers, percentages, or dollar figures. The user can already see these in the dashboard.
2. Focus entirely on interpretation and likely cause. Offer a plausible explanation for why this pattern occurred based on the combination of figures (e.g., if hours are wildly over budget but tasks completed is moderate, reason about whether scope was underestimated or if there were hidden complications).
3. Explain what this specific pattern implies for the rest of the project or future similar projects if it isn't a one-off.
4. Conclude with one concrete, specific action or question a project manager should raise (e.g., instead of "review the budget", suggest "check if the sub-assembly delays were caused by missing components").
Dry wit is welcome, but no forced enthusiasm.

OUTPUT FORMAT (CRITICAL): Only return the paragraph text. No headers, no bold formatting, no bullet points, no "key takeaways" prefixes.`;

    const prompt = `You are a sharp financial analyst for Chadwick Switchboards. Based on the following project data and triggered insights, perform the analysis:

${promptInstructions}

Project Data:
${contextString}

Summary:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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

    return { success: true, data: { narrative: json.response.trim() } };

  } catch (error) {
    console.error(`[generateProjectNarrative] Error:`, error);
    return { success: false, error: "AI summary unavailable" };
  }
}

export async function generateGroupNarrative(context: Record<string, any>) {
  if (process.env.BYPASS_AUTH_FOR_TEST !== "true") {
    const session = await validateSession();
    if (!session) {
      throw new Error("Unauthorized.");
    }
  }

  try {
    const contextString = Object.entries(context)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `- ${key}:\n${JSON.stringify(value, null, 2)}`;
        }
        return `- ${key}: ${value}`;
      })
      .join("\n");

    const promptInstructions = `Write a short, plain English narrative (3 to 5 sentences) explaining the overall financial story of this group of projects.
CRITICAL RULES:
1. DO NOT restate exact numbers, percentages, or dollar figures. The user can already see these in the dashboard.
2. Focus on patterns across the sub-projects (e.g., if multiple sub-projects show the same type of overrun, call that out as a shared pattern worth investigating).
3. Offer a plausible explanation for why this pattern occurred based on the combination of figures across the group.
4. Conclude with one concrete, specific action or question a project manager should raise regarding the systemic estimating or execution of this group.
Dry wit is welcome, but no forced enthusiasm.

OUTPUT FORMAT (CRITICAL): Only return the paragraph text. No headers, no bold formatting, no bullet points, no "key takeaways" prefixes.`;

    const prompt = `You are a sharp financial analyst for Chadwick Switchboards. Based on the following group project data, sub-project details, and triggered insights, perform the analysis:

${promptInstructions}

Group Data & Sub-projects:
${contextString}

Summary:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for group, slightly larger data

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

    return { success: true, data: { narrative: json.response.trim() } };

  } catch (error) {
    console.error(`[generateGroupNarrative] Error:`, error);
    return { success: false, error: "AI summary unavailable" };
  }
}
