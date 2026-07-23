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

    let promptInstructions = `write exactly 2-3 sentences in plain English summarising the current situation and highlighting any key takeaways. Be direct and specific. No bullet points. No headers.`;

    if (page === "capacity") {
      promptInstructions = `interpret the data and tell the operations team what they should actually pay attention to right now. Is the workload front-loaded or spread evenly? When does capacity get tight? Is there enough buffer? Write exactly 2-3 sentences in plain English containing genuine insight, not just a restatement of the numbers provided. Be direct and specific. No bullet points. No headers.`;
    }

    const prompt = `You are an operations assistant for Chadwick Switchboards, a switchboard manufacturing company. Based on the following data from the ${pageNames[page]}, ${promptInstructions}

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
