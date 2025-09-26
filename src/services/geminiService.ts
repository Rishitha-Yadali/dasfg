// src/services/geminiService.ts

import { ResumeData, UserType } from '../types/resume';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// --- NEW CONSTANTS FOR ERROR HANDLING AND RETRIES ---
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_INPUT_LENGTH = 50000; // Max characters for combined resume and JD input to the AI model
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second initial delay for exponential backoff

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

export const optimizeResume = async (
  resumeText: string,
  jobDescription: string,
  userType: UserType,
  userName: string,
  userEmail: string,
  userPhone: string,
  userLinkedin: string,
  userGithub: string,
  existingResumeData?: ResumeData, // This parameter is not directly used in the prompt but kept for signature consistency
  projectAnalysis?: any, // This parameter is not directly used in the prompt but kept for signature consistency
  targetRole?: string
): Promise<ResumeData> => {
  // --- NEW: Input Length Check at the service level ---
  const combinedInputLength = resumeText.length + jobDescription.length;
  if (combinedInputLength > MAX_INPUT_LENGTH) {
    throw new Error(
      `Input too long. Combined resume and job description exceed ${MAX_INPUT_LENGTH} characters. Please shorten your input.`
    );
  }
  // --- END NEW ---

  let retryCount = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (retryCount < MAX_RETRIES) {
    try {
      // Construct the prompt for the AI model
      const prompt = `You are an expert resume writer and career coach. Your task is to optimize a resume based on a given job description and user profile.
      
      Given the following information:
      
      --- USER PROFILE ---
      Name: ${userName}
      Email: ${userEmail}
      Phone: ${userPhone}
      LinkedIn: ${userLinkedin}
      GitHub: ${userGithub}
      User Type: ${userType}
      Target Role: ${targetRole || 'Not specified'}
      
      --- JOB DESCRIPTION ---
      ${jobDescription}
      
      --- CANDIDATE'S CURRENT RESUME CONTENT ---
      ${resumeText}
      
      --- INSTRUCTIONS ---
      1.  **Extract and Structure**: Parse the provided resume content and job description.
      2.  **Optimize**: Rewrite and enhance the resume content to maximize its alignment with the job description and ATS (Applicant Tracking System) compatibility.
      3.  **Quantify Achievements**: For work experience and projects, transform responsibilities into quantifiable achievements using action verbs and metrics.
      4.  **Keyword Integration**: Integrate relevant keywords from the job description naturally into the resume sections.
      5.  **Tailor Sections**: Adjust sections like 'Summary'/'Career Objective' based on 'User Type' (fresher/experienced/student) and 'Target Role'.
      6.  **Contact Information**: Ensure contact details from the user profile are correctly integrated.
      7.  **Project Enhancement (if applicable)**: If projectAnalysis is provided, consider its insights for project descriptions.
      8.  **Output Format**: Return the optimized resume data in the exact JSON structure of the ResumeData interface.
      
      --- RESUME DATA INTERFACE (JSON Structure) ---
      {
        "name": "string",
        "phone": "string",
        "email": "string",
        "linkedin": "string",
        "github": "string",
        "location": "string",
        "targetRole": "string",
        "summary": "string", // For experienced
        "careerObjective": "string", // For students/freshers
        "education": [
          {
            "degree": "string",
            "school": "string",
            "year": "string",
            "cgpa": "string",
            "location": "string"
          }
        ],
        "workExperience": [
          {
            "role": "string",
            "company": "string",
            "year": "string",
            "bullets": ["string"]
          }
        ],
        "projects": [
          {
            "title": "string",
            "bullets": ["string"],
            "githubUrl": "string"
          }
        ],
        "skills": [
          {
            "category": "string",
            "count": "number",
            "list": ["string"]
          }
        ],
        "certifications": ["string"], // Can also be { title: string, description: string }
        "additionalSections": [
          {
            "title": "string",
            "bullets": ["string"]
          }
        ],
        "achievements": ["string"],
        "origin": "string" // e.g., 'optimized', 'guided'
      }
      
      Ensure all bullet points are concise, impactful, and start with strong action verbs.
      Do NOT include any conversational text outside the JSON.
      `;

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          "HTTP-Referer": "https://primoboost.ai", // Replace with your actual domain
          "X-Title": "PrimoBoost AI" // Replace with your actual app name
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash", // Ensure this model is correct and available
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
      });

      // --- MODIFIED: Enhanced Error Handling ---
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenRouter API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
            errorMessage = `OpenRouter API error: ${errorJson.error.message} (Code: ${errorJson.error.code || response.status})`;
          } else {
            errorMessage = `OpenRouter API error: ${errorText} (Status: ${response.status})`;
          }
        } catch (parseError) {
          // If response is not JSON, use raw text
          errorMessage = `OpenRouter API error: ${errorText} (Status: ${response.status})`;
        }

        // Check for specific retryable errors
        if (response.status === 429 || response.status >= 500) { // 429: Too Many Requests, 5xx: Server Errors
          console.warn(`OpenRouter API: ${errorMessage}. Retrying in ${delay / 1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue; // Continue to the next retry attempt
        } else if (response.status === 400) { // Bad Request, often due to prompt too long or invalid input
          throw new Error(`OpenRouter API: Bad Request. This might be due to an invalid prompt or exceeding context length. ${errorMessage}`);
        } else if (response.status === 402) { // Insufficient Credits
          throw new Error(`OpenRouter API: Insufficient Credits. Please check your OpenRouter account balance. ${errorMessage}`);
        } else if (response.status === 401) { // Invalid credentials
          throw new Error(`OpenRouter API: Invalid API Key. Please check your VITE_OPENROUTER_API_KEY. ${errorMessage}`);
        } else {
          throw new Error(errorMessage); // For other non-retryable errors
        }
      }
      // --- END MODIFIED ---

      const data = await response.json();
      const result = data?.choices?.[0]?.message?.content;

      if (!result) {
        throw new Error('No response content from OpenRouter API');
      }

      const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsedResult: ResumeData = JSON.parse(cleanedResult);
        return parsedResult;
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response that failed to parse:', cleanedResult);
        throw new Error('Invalid JSON response from OpenRouter API');
      }
    } catch (error: any) {
      // Catch network errors or errors thrown from inside the try block
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.warn(`Network error connecting to OpenRouter API. Retrying in ${delay / 1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error; // Re-throw non-retryable errors
    }
  }

  // If all retries fail
  throw new Error('Failed to connect to OpenRouter API after multiple retries. Please check your internet connection and try again.');
};
