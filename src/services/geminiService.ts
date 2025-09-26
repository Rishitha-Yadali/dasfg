// src/services/geminiService.ts
import { ResumeData, UserType, AdditionalSection } from '../types/resume';

// ===================== 🔑 CONFIG CONSTANTS =====================
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Max input size before truncation / warning (tokens ~ chars proxy)
export const MAX_INPUT_LENGTH = 15000;

// Retry policy
export const MAX_RETRIES = 5;
export const INITIAL_RETRY_DELAY_MS = 2000;

if (!OPENROUTER_API_KEY) {
  throw new Error(
    "OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables."
  );
}

// ===================== 🧹 HELPERS =====================
const deepCleanComments = (val: any): any => {
  const stripLineComments = (input: string): string => {
    let cleaned = input;
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ""); // block comments
    cleaned = cleaned.replace(/\/\/\s*Line\s*\d+\s*/g, ""); // // Line 123
    const lines = cleaned.split(/\r?\n/).map(line => {
      if (/^\s*\/\//.test(line)) return "";
      const idx = line.indexOf("//");
      if (idx !== -1 && !line.slice(0, idx).includes("://")) {
        return line.slice(0, idx).trimEnd();
      }
      return line;
    });
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  if (typeof val === "string") return stripLineComments(val);
  if (Array.isArray(val)) return val.map(deepCleanComments);
  if (val && typeof val === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(val)) out[k] = deepCleanComments(val[k]);
    return out;
  }
  return val;
};

const safeFetch = async (options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> => {
  let retries = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (retries < maxRetries) {
    try {
      const res = await fetch(OPENROUTER_API_URL, options);

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 401) throw new Error("Invalid API key.");
        if (res.status === 429 || res.status >= 500) {
          retries++;
          if (retries >= maxRetries) throw new Error(`OpenRouter API error: ${res.status} - ${errorText}`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        throw new Error(`OpenRouter API error: ${res.status} - ${errorText}`);
      }
      return res;
    } catch (err: any) {
      if (retries === maxRetries - 1) throw new Error(`Network/Fetch error: ${err.message}`);
      retries++;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
};

const cleanJSON = (result: string) => {
  const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
  return jsonMatch ? jsonMatch[1].trim() : result.replace(/```json|```/g, "").trim();
};

// ===================== 🚀 MAIN FUNCTIONS =====================
export const optimizeResume = async (
  resume: string,
  jobDescription: string,
  userType: UserType,
  userName?: string,
  userEmail?: string,
  userPhone?: string,
  userLinkedin?: string,
  userGithub?: string,
  linkedinUrl?: string,
  githubUrl?: string,
  targetRole?: string,
  additionalSections?: AdditionalSection[]
): Promise<ResumeData> => {
  if (resume.length + jobDescription.length > MAX_INPUT_LENGTH) {
    console.warn("[optimizeResume] Input too long, may truncate or fail.");
  }

  const prompt = `
You are a resume optimization assistant.
User Type: ${userType.toUpperCase()}

Resume:
${resume}

Job Description:
${jobDescription}
`;

  const body = JSON.stringify({
    model: "google/gemini-flash-1.5",
    messages: [{ role: "user", content: prompt }],
  });

  const response = await safeFetch({
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://primoboost.ai",
      "X-Title": "PrimoBoost AI",
    },
    body,
  });

  const data = await response.json();
  let raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No content returned from OpenRouter");

  raw = cleanJSON(raw);

  try {
    let parsed = JSON.parse(raw);
    parsed = deepCleanComments(parsed);

    parsed.name = userName || parsed.name || "";
    parsed.email = userEmail || parsed.email || "";
    parsed.phone = userPhone || parsed.phone || "";
    parsed.linkedin = userLinkedin || linkedinUrl || "";
    parsed.github = userGithub || githubUrl || "";
    parsed.targetRole = targetRole || parsed.targetRole || "";
    parsed.origin = "jd_optimized";

    return parsed;
  } catch (err) {
    console.error("[optimizeResume] Parse Error:", err, "Raw:", raw);
    throw new Error("Invalid JSON response from OpenRouter API");
  }
};
