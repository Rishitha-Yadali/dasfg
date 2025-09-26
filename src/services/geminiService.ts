// src/services/geminiService.ts
import { ResumeData, UserType, AdditionalSection } from '../types/resume'; // Import AdditionalSection

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

// --- NEW CONSTANTS FOR ERROR HANDLING AND RETRIES ---
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const MAX_INPUT_LENGTH = 50000; // Max characters for combined resume and JD input to the AI model
export const MAX_RETRIES = 3; // Changed from 5
export const INITIAL_RETRY_DELAY_MS = 1000; // Changed from 2000
// --- END NEW ---

const deepCleanComments = (val: any): any => {
  const stripLineComments = (input: string): string => {
    let cleanedInput = input;

    // 1. Remove block comments /* ... */
    cleanedInput = cleanedInput.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Remove specific "// Line XXX" comments anywhere in the string
    cleanedInput = cleanedInput.replace(/\/\/\s*Line\s*\d+\s*/g, '');

    // 3. Process line-by-line for traditional single-line comments (// at start or mid-line)
    const lines = cleanedInput.split(/\r?\n/).map((line) => {
      // If the line starts with //, remove the whole line
      if (/^\s*\/\//.test(line)) return '';

      // If // appears mid-line, remove from // to end of line, but only if it's not part of a URL
      const idx = line.indexOf('//');
      if (idx !== -1) {
        const before = line.slice(0, idx);
        // Check if it's not part of a URL (e.g., "https://")
        if (!before.includes('://')) {
          return line.slice(0, idx).trimEnd();
        }
      }
      return line;
    });
    cleanedInput = lines.join('\n');

    // 4. Remove excessive newlines
    cleanedInput = cleanedInput.replace(/\n{3,}/g, '\n\n'); // Fixed: changed 'cleanedOut' to 'cleanedInput'

    return cleanedInput.trim();
  };
  if (typeof val === 'string') return stripLineComments(val);
  if (Array.isArray(val)) return val.map(deepCleanComments);
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(val)) out[k] = deepCleanComments(val[k]);
    return out;
  }
  return val;
};

// --- NEW: safeFetch function with retry logic and enhanced error handling ---
const safeFetch = async (options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> => {
  let retries = 0;
  let delay = INITIAL_RETRY_DELAY_MS;

  while (retries < maxRetries) {
    try {
      const res = await fetch(OPENROUTER_API_URL, options);

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = `OpenRouter API error: ${res.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
            errorMessage = `OpenRouter API error: ${errorJson.error.message} (Code: ${errorJson.error.code || res.status})`;
          } else {
            errorMessage = `OpenRouter API error: ${errorText} (Status: ${res.status})`;
          }
        } catch (parseError) {
          // If response is not JSON, use raw text
          errorMessage = `OpenRouter API error: ${errorText} (Status: ${res.status})`;
        }

        // Check for specific retryable errors
        if (res.status === 400) { // Bad Request, often due to invalid input or prompt too long
          throw new Error(`OpenRouter API: Bad Request. This might be due to an invalid prompt or exceeding context length. ${errorMessage}`);
        }
        if (res.status === 401) { // Unauthorized, invalid API key
          throw new Error(`OpenRouter API: Invalid API Key. Please check your VITE_OPENROUTER_API_KEY. ${errorMessage}`);
        }
        if (res.status === 402) { // Payment Required / Insufficient Credits
          throw new Error(`OpenRouter API: Insufficient Credits. Please check your OpenRouter account balance. ${errorMessage}`);
        }
        if (res.status === 429 || res.status >= 500) { // Too Many Requests or Server Errors (retryable)
          retries++;
          if (retries >= maxRetries) {
            throw new Error(`OpenRouter API error: Failed after ${maxRetries} retries. ${errorMessage}`);
          }
          console.warn(`OpenRouter API: ${errorMessage}. Retrying in ${delay / 1000}s... (Attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        // For any other non-retryable HTTP errors
        throw new Error(errorMessage);
      }
      return res;
    } catch (err: any) {
      // Catch network errors or errors thrown from inside the try block
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error(`Network/Fetch error: Failed after ${maxRetries} retries. ${err.message}`);
        }
        console.warn(`Network/Fetch error: ${err.message}. Retrying in ${delay / 1000}s... (Attempt ${retries}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err; // Re-throw non-retryable errors
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`); // Should not be reached if errors are thrown inside the loop
};
// --- END NEW ---

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
  additionalSections?: AdditionalSection[] // NEW: Add additionalSections parameter
): Promise<ResumeData> => {
  // MODIFIED: Changed console.warn to throw an error
  if (resume.length + jobDescription.length > MAX_INPUT_LENGTH) {
    throw new Error(
      `Input too long. Combined resume and job description exceed ${MAX_INPUT_LENGTH} characters. Please shorten your input.`
    );
  }

  const getPromptForUserType = (type: UserType) => {
    if (type === 'experienced') {
      return `You are a professional resume optimization assistant for EXPERIENCED PROFESSIONALS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

EXPERIENCED PROFESSIONAL REQUIREMENTS:
1. MUST include a compelling Professional Summary (2-3 lines highlighting key experience and value proposition)
2. PRIORITIZE Work Experience section - this should be the most prominent
3. Education section should be minimal or omitted unless specifically required by the job
4. Focus on quantifiable achievements and leadership experience
5. Emphasize career progression and increasing responsibilities

SECTION ORDER FOR EXPERIENCED PROFESSIONALS:
1. Contact Information
2. Professional Summary (REQUIRED)
3. Technical Skills
4. Professional Experience (MOST IMPORTANT)
5. Projects (if relevant to role)
6. Certifications
7. Education (minimal or omit if not required)
8. Additional Sections (if provided, with custom titles)`;
    } else if (type === 'student') {
      return `You are a professional resume optimization assistant for COLLEGE STUDENTS. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

COLLEGE STUDENT REQUIREMENTS:
1. MUST include a compelling Career Objective (2 lines, ATS-readable, focusing on learning goals and internship aspirations)
2. PRIORITIZE Education section - this should be prominent with CGPA and institution location
3. Focus on academic projects, coursework, and transferable skills
4. Include achievements, certifications, and extracurricular activities
5. Highlight learning ability, enthusiasm, and academic excellence
6. ALL INTERNSHIPS, TRAININGS, and WORK EXPERIENCE should be categorized under "workExperience" section
7. Extract CGPA from education if mentioned (e.g., "CGPA: 8.4/10" or "GPA: 3.8/4.0")
8. Include location in contact information and education details

SECTION ORDER FOR COLLEGE STUDENTS:
1. Contact Information (including location)
2. Career Objective (REQUIRED - 2 lines focusing on internship goals)
3. Education (PROMINENT - with CGPA and location)
4. Technical Skills
5. Academic Projects (IMPORTANT)
6. Internships & Work Experience (if any)
7. Certifications
8. Additional Sections (if provided, with custom titles)`;
    } else {
      return `You are a professional resume optimization assistant for FRESHERS/NEW GRADUATES. Analyze the provided resume and job description, then create an optimized resume that better matches the job requirements.

FRESHER REQUIREMENTS:
1. MUST include a compelling Career Objective (2 lines MAX, ATS-readable, focusing on entry-level goals, relevant skills, and aspirations)
2. PRIORITIZE Education, Academic Projects, and Internships
3. Include additional sections that showcase potential: Achievements, Extra-curricular Activities, Languages
4. Focus on academic projects, internships, and transferable skills
5. Highlight learning ability, enthusiasm, and relevant coursework
6. ALL INTERNSHIPS, TRAININGS, and WORK EXPERIENCE should be categorized under "workExperience" section
7. Extract CGPA from education if mentioned (e.g., "CGPA: 8.4/10")

SECTION ORDER FOR FRESHERS:
1. Contact Information
2. Career Objective (REQUIRED - 2 lines focusing on entry-level goals)
3. Technical Skills
4. Education (PROMINENT)
5. Internships & Work Experience (IMPORTANT - includes all internships, trainings, and work)
6. Academic Projects (IMPORTANT)
7. Certifications
8. Additional Sections (if provided, with custom titles)`;
    }
  };

  const promptContent = `${getPromptForUserType(userType)}

CRITICAL REQUIREMENTS FOR BULLET POINTS:
1. Each bullet point MUST be concise, containing up to 20 words.
2. Include at least 30 relevant keywords from the job description across all bullet points.
3. Use STRONG ACTION VERBS only (no weak verbs like "helped", "assisted", "worked on", "was responsible for", "participated in", "involved in", "contributed to")
4. Start each bullet with powerful verbs like: Developed, Implemented, Architected, Optimized, Engineered, Designed, Led, Managed, Created, Built, Delivered, Achieved, Increased, Reduced, Streamlined, Automated, Transformed, Executed, Spearheaded, Established
5. Ensure no word is repeated more than twice across all bullet points within a section.
6. Quantify achievements with specific numbers, percentages, or metrics wherever possible, demonstrating clear impact and value. If direct quantification is not available, infer and suggest plausible metrics or outcomes. Vary the type of metrics used (e.g., time saved, revenue generated, efficiency improved, user growth).
7. Focus on tangible RESULTS and measurable IMPACT, not just tasks or responsibilities.
8. Do not give more than three bullet points for each project or work experience entry.
9. All section titles MUST be in ALL CAPS (e.g., WORK EXPERIENCE, EDUCATION, PROJECTS).
10. Dates should be on the same line as roles/education, using the exact format "Jan 2023 – Mar 2024".
11. Integrate keywords naturally and contextually within sentences, avoiding keyword stuffing. Use synonyms or related terms where appropriate to enhance semantic matching.
12. Ensure at least 70% of resume keywords match the job description for better ATS compatibility.
13. Avoid using subjective adjectives like "passionate", "dedicated", or "hardworking" unless contextually backed with measurable achievements. DO NOT add adjectives like "dedicated", "motivated", or "hardworking" unless backed by resume content.
14. Ensure all language is direct, professional, and free of jargon unless it's industry-standard and relevant to the JD.
15. Penalize any section (WORK EXPERIENCE, PROJECTS, INTERNSHIPS) that lacks proper formatting or content quality:
    - Missing roles, company names, or dates
    - Inconsistent date formats
    - More than 3 bullets per item
    - Bullets that do not begin with action verbs
    - No quantified metrics
    - Disorganized or incomplete structure
    - Date format not in "Jan 2023 – Mar 2024" format
14. If formatting is poor or inconsistent in any section, reduce overall score by 5–15% depending on severity.

SKILLS REQUIREMENTS: (Generate comprehensive skills based on the resume content and job description)
1. Include at least 6-8 distinct skill categories.
2. Each category should contain 5-8 specific, relevant skills.
4. Match skills to job requirements and industry standards
5. Include both technical and soft skills relevant to the role
6.TO GENERATE SOFT SKILLS according jd
CERTIFICATIONS REQUIREMENTS:
1. For each certification, provide a concise 15 words description in the 'description' field.

SOCIAL LINKS REQUIREMENTS - CRITICAL:
1. LinkedIn URL: "${linkedinUrl || ''}" - ONLY include if this is NOT empty
2. GitHub URL: "${githubUrl || ''}" - ONLY include if this is NOT empty
3. If LinkedIn URL is empty (""), set linkedin field to empty string ""
4. If GitHub URL is empty (""), set github field to empty string ""
5. DO NOT create, modify, or generate any social media links
6. Use EXACTLY what is provided - no modifications

TARGET ROLE INFORMATION:
${targetRole ? `Target Role: "${targetRole}"` : 'No specific target role provided'}

CONDITIONAL SECTION GENERATION: (Ensure these sections are generated based on user type)
${userType === 'experienced' ? `
- Professional Summary: REQUIRED - Create a compelling 2-3 line summary
- Education: MINIMAL or OMIT unless specifically required by job
- Focus heavily on work experience and achievements
- Omit or minimize fresher-specific sections
` : userType === 'student' ? `
- Career Objective: REQUIRED - Create a compelling 2-line objective focusing on internship goals
- Education: PROMINENT - include degree, institution, year, CGPA, and location
- Academic Projects: IMPORTANT - treat as main experience section
- Work Experience: Include any internships, part-time jobs, or training
- Achievements: Include academic awards, competitions, rankings
- Languages Known: Include if present (list languages with proficiency levels if available)
- Location: Include in contact information and education details
` : `
- Professional Summary: OPTIONAL - only if candidate has relevant internships/experience
- Career Objective: REQUIRED - Create a compelling 2-line objective focusing on entry-level goals.
- Education: INCLUDE CGPA if mentioned in original resume (e.g., "CGPA: 8.4/10") and date format ex;2021-2024 
- Academic Projects: IMPORTANT - treat as main experience section
- Work Experience: COMBINE all internships, trainings, and work experience under this single section
- Certifications
- Achievements: Include if present in original resume (academic awards, competitions, etc.)
- Extra-curricular Activities: Include if present (leadership roles, clubs, volunteer work)
- Languages Known: Include if present (list languages with proficiency levels if available)
- Personal Details (if present in original resume)`
}

IMPORTANT: Follow the exact structure provided below. Only include sections that have actual content.

Rules:
1. Only respond with valid JSON
2. Use the exact structure provided below
3. Rewrite bullet points following the CRITICAL REQUIREMENTS above
4. Generate comprehensive skills section based on resume and job description
5. Only include sections that have meaningful content
6. If optional sections don't exist in original resume, set them as empty arrays or omit
7. Ensure all dates are in proper format (e.g., "Jan 2023 – Mar 2024")
8. Use professional language and industry-specific keywords from the job description
9. For LinkedIn and GitHub, use EXACTLY what is provided - empty string if not provided
10. The "name" field in the JSON should ONLY contain the user's name. The "email", "phone", "linkedin", "github", and "location" fields MUST NOT contain the user's name or any part of it. The user's name should appear ONLY in the dedicated "name" field.
11. NEW: If 'additionalSections' are provided, include them in the output JSON with their custom titles and optimized bullet points. Apply all bullet point optimization rules to these sections as well.

JSON Structure:
{
  "name": "${userName || '...'}",
  "location": "...", 
  "phone": "${userPhone || '...'}",
  "email": "${userEmail || '...'}",
  "linkedin": "${userLinkedin || linkedinUrl || '...'}",
  "github": "${userGithub || githubUrl || '...'}",
  "targetRole": "${targetRole || '...'}",
  ${userType === 'experienced' ? '"summary": "...",' : ''}
  ${userType === 'student' ? '"careerObjective": "...",' : ''}
  ${userType === 'fresher' ? '"careerObjective": "...",' : ''}
  "education": [
    {"degree": "...", "school": "...", "year": "...", "cgpa": "...", "location": "..."}
  ],
  "workExperience": [
    {"role": "...", "company": "...", "year": "...", "bullets": ["...", "...", "..."]}
  ],
  "projects": [
    {"title": "...", "bullets": ["...", "...", "..."]}
  ],
  "skills": [
    {"category": "...", "count": 0, "list": ["...", "..."]}
  ],
  "certifications": [{"title": "...", "description": "..."}, "..."],
  ${additionalSections && additionalSections.length > 0 ? '"additionalSections": [' : ''}
  ${additionalSections && additionalSections.length > 0 ? '{"title": "...", "bullets": ["...", "...", "..."]}' : ''}
  ${additionalSections && additionalSections.length > 0 ? ']' : ''}
}
Resume:
${resume}

Job Description:
${jobDescription}

User Type: ${userType.toUpperCase()}

LinkedIn URL provided: ${linkedinUrl || 'NONE - leave empty'}
GitHub URL provided: ${githubUrl || 'NONE - leave empty'}
${additionalSections && additionalSections.length > 0 ? `Additional Sections Provided: ${JSON.stringify(additionalSections)}` : ''}`;

  const response = await safeFetch({
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://primoboost.ai", // Replace with your actual domain
      "X-Title": "PrimoBoost AI", // Replace with your actual app name
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash", // Set to google/gemini-flash-1.5
      messages: [{ role: "user", content: promptContent }],
    }),
  });

  const data = await response.json();
  let raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No content returned from OpenRouter");

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  let cleanedResult: string;
  if (jsonMatch && jsonMatch[1]) {
    cleanedResult = jsonMatch[1].trim();
  } else {
    cleanedResult = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  try {
    let parsedResult = JSON.parse(cleanedResult);

    parsedResult = deepCleanComments(parsedResult);

    const EMPTY_TOKEN_RE = /^(?:n\/a|not\s*specified|none)$/i;
    const deepClean = (val: any): any => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return EMPTY_TOKEN_RE.test(trimmed) ? '' : trimmed;
      }
      if (Array.isArray(val)) return val.map(deepClean);
      if (val && typeof val === 'object') {
        const out: Record<string, any> = {};
        for (const k of Object.keys(val)) out[k] = deepClean(val[k]);
        return out;
      }
      return val;
    };
    parsedResult = deepClean(parsedResult);

    if (parsedResult.skills && Array.isArray(parsedResult.skills)) {
      parsedResult.skills = parsedResult.skills.map((skill: any) => ({
        ...skill,
        count: skill.list ? skill.list.length : 0
      }));
    }

    if (parsedResult.certifications && Array.isArray(parsedResult.certifications)) {
      parsedResult.certifications = parsedResult.certifications
        .map((cert: any) => {
          if (typeof cert === 'string') {
            return { title: cert.trim(), description: '' };
          }
          if (cert && typeof cert === 'object') {
            const title =
              (typeof cert.title === 'string' && cert.title) ||
              (typeof cert.name === 'string' && cert.name) ||
              (typeof cert.certificate === 'string' && cert.certificate) ||
              (typeof cert.issuer === 'string' && cert.issuer) ||
              (typeof cert.provider === 'string' && cert.provider) ||
              '';
            const description =
              (typeof cert.description === 'string' && cert.description) ||
              (typeof cert.issuer === 'string' && cert.issuer) ||
              (typeof cert.provider === 'string' && cert.provider) ||
              '';
            if (!title && !description) return null;
            return { title: title.trim(), description: description.trim() };
          }
          return { title: String(cert), description: '' };
        })
        .filter(Boolean);
    }

    if (parsedResult.workExperience && Array.isArray(parsedResult.workExperience)) {
      parsedResult.workExperience = parsedResult.workExperience.filter(
        (work: any) => work && work.role && work.company && work.year
      );
    }

    if (parsedResult.projects && Array.isArray(parsedResult.projects)) {
      parsedResult.projects = parsedResult.projects.filter(
        (project: any) => project && project.title && project.bullets && project.bullets.length > 0
      );
    }

    if (parsedResult.additionalSections && Array.isArray(parsedResult.additionalSections)) {
      parsedResult.additionalSections = parsedResult.additionalSections.filter(
        (section: any) => section && section.title && section.bullets && section.bullets.length > 0
      );
    }


    parsedResult.name = userName || parsedResult.name || '';

    parsedResult.linkedin = userLinkedin || parsedResult.linkedin || '';
    parsedResult.github = userGithub || parsedResult.github || '';

    if (userEmail) {
      parsedResult.email = userEmail;
    } else if (parsedResult.email) {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
      const match = String(parsedResult.email).match(emailRegex);
      parsedResult.email = match && match[0] ? match[0] : '';
    } else {
      parsedResult.email = '';
    }

    if (userPhone) {
      parsedResult.phone = userPhone;
    } else if (parsedResult.phone) {
      const phoneRegex = /(\+?\d{1,3}[-.\s]?)(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
      const match = String(parsedResult.phone).match(phoneRegex);
      parsedResult.phone = match && match[0] ? match[0] : '';
    } else {
      parsedResult.phone = '';
    }
parsedResult.summary = String(parsedResult.summary || '');
parsedResult.careerObjective = String(parsedResult.careerObjective || '');
    parsedResult.origin = 'jd_optimized';

    return parsedResult;
  } catch (err) {
    console.error('JSON parsing error:', err);
    console.error('Raw response attempted to parse:', cleanedResult);
    throw new Error('Invalid JSON response from OpenRouter API');
  }
};

// --- RE-ADDED: generateMultipleAtsVariations function ---
export const generateMultipleAtsVariations = async (
  sectionType: 'summary' | 'careerObjective' | 'workExperienceBullets' | 'projectBullets' | 'skillsList' | 'certifications' | 'achievements' | 'additionalSectionBullets',
  data: any,
  modelOverride?: string,
  variationCount: number = 3,
  draftText?: string // NEW: Optional draft text to polish
): Promise<string[][]> => { // Changed return type to string[][]
  // --- NEW: Input Length Validation ---
  const combinedInputLength = JSON.stringify(data).length + (draftText?.length || 0);
  if (combinedInputLength > MAX_INPUT_LENGTH) {
    throw new Error(
      `Input for variations too long (${combinedInputLength} characters). ` +
      `The maximum allowed is ${MAX_INPUT_LENGTH} characters. Please shorten your input.`
    );
  }
  // --- END NEW ---

  const getPromptForMultipleVariations = (type: string, sectionData: any, count: number, draft?: string) => {
    const baseInstructions = `
CRITICAL ATS OPTIMIZATION RULES:
1. Use strong action verbs and industry keywords
2. Focus on quantifiable achievements and impact
3. Keep content concise
4. Avoid personal pronouns ("I", "my")
`;

    if (draft) {
      // If draft text is provided, instruct AI to polish it
      switch (type) {
        case 'summary':
          return `You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${count} distinctly different polished professional summary variations based on the following draft:
Draft: "${draft}"
${baseInstructions}
Each summary should be 2-3 sentences (50-80 words max).
Return ONLY a JSON array with exactly ${count} variations: ["summary1", "summary2", "summary3"]`;
        case 'careerObjective':
          return `You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${count} distinctly different polished career objective variations based on the following draft:
Draft: "${draft}"
${baseInstructions}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${count} variations: ["objective1", "objective2", "objective3"]`;
        // Other sections already handle their "draft" via `sectionData` fields.
      }
    }

    // Existing logic for generating from scratch
    switch (type) {
      case 'summary':
        return `You are an expert resume writer specializing in ATS optimization for experienced professionals.
Generate ${count} distinctly different professional summary variations based on:
- User Type: ${sectionData.userType}
- Target Role: ${sectionData.targetRole || 'General Professional Role'}
- Experience: ${JSON.stringify(sectionData.experience || [])}
${baseInstructions}
Each summary should be 2-3 sentences (50-80 words max) and have a different focus:
- Variation 1: Achievement-focused with metrics
- Variation 2: Skills and expertise-focused
- Variation 3: Leadership and impact-focused
Return ONLY a JSON array with exactly ${count} variations: ["summary1", "summary2", "summary3"]`;

      case 'careerObjective':
        return `You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
Generate ${count} distinctly different career objective variations based on:
- User Type: ${sectionData.userType}
- Target Role: ${sectionData.targetRole || 'Entry-level Professional Position'}
- Education: ${JSON.stringify(sectionData.education || [])}
${baseInstructions}
Each objective should be 2 sentences (30-50 words max) and have a different approach:
- Variation 1: Learning and growth-focused
- Variation 2: Skills and contribution-focused
- Variation 3: Career goals and enthusiasm-focused
Return ONLY a JSON array with exactly ${count} variations: ["objective1", "objective2", "objective3"]`;

      case 'workExperienceBullets': // MODIFIED PROMPT: Generate individual bullet points
        return `You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a work experience entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided role, company, and duration context.

DRAFT BULLET POINTS TO POLISH:
${sectionData.description}

CONTEXT:
- Role: ${sectionData.role}
- Company: ${sectionData.company}
- Duration: ${sectionData.year}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start each bullet with STRONG ACTION VERBS (Developed, Implemented, Led, Managed, Optimized, Achieved, Increased, Reduced)
3. NO weak verbs (helped, assisted, worked on, responsible for)
4. Include quantifiable achievements and metrics
5. Use industry-standard keywords
6. Focus on impact and results, not just responsibilities
7. Avoid repetitive words across bullets
8. Make each bullet distinct and valuable

Generate exactly ${count} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;

      case 'projectBullets': // MODIFIED PROMPT: Generate individual bullet points
        return `You are an expert resume writer specializing in ATS optimization.
The following are DRAFT bullet points provided by the user for a project entry. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided project title, tech stack, and user type context.

DRAFT BULLET POINTS TO POLISH:
${sectionData.description}

CONTEXT:
- Project Title: ${sectionData.title}
- Tech Stack: ${sectionData.techStack || 'Modern technologies'}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start with STRONG ACTION VERBS (Developed, Built, Implemented, Designed, Created, Architected)
3. Include specific technologies mentioned in tech stack
4. Focus on technical achievements and impact
5. Include quantifiable results where possible
6. Use industry-standard technical keywords
7. Highlight problem-solving and innovation
8. Make each bullet showcase different aspects

Generate exactly ${count} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;

      case 'additionalSectionBullets': // NEW/MODIFIED PROMPT FOR POLISHING
        return `You are an expert resume writer specializing in ATS optimization.

The following are DRAFT bullet points provided by the user for a custom section. Your task is to POLISH and REWRITE these drafts, maintaining their core meaning and achievements, while strictly adhering to the ATS optimization rules. If the drafts are very short or generic, expand upon them using the provided section title and user type context.

DRAFT BULLET POINTS TO POLISH:
${sectionData.details}

CONTEXT:
- Section Title: ${sectionData.title}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start with STRONG ACTION VERBS (e.g., Awarded, Recognized, Achieved, Led, Volunteered, Fluent in)
3. Focus on achievements, contributions, or relevant details for the section type
4. Use industry-standard keywords where applicable
5. Quantify results where possible
6. Avoid repetitive words across bullets
7. Make each bullet distinct and valuable

Generate exactly ${count} individual polished bullet points.
Return ONLY a JSON array of strings, where each string is a single polished bullet point:
["polished_bullet_point_1", "polished_bullet_point_2", "polished_bullet_point_3", ...]`;

      case 'certifications': // NEW/MODIFIED PROMPT FOR POLISHING
        return `You are an expert resume writer specializing in ATS optimization.

Given the following certification details and context:
- Current Certification Title: "${sectionData.currentCertTitle || 'Not provided'}"
- Current Certification Description: "${sectionData.currentCertDescription || 'Not provided'}"
- Target Role: ${sectionData.targetRole || 'Professional Role'}
- Current Skills: ${JSON.stringify(sectionData.skills || [])}
- Job Description Context: ${sectionData.jobDescription || 'General professional context'}

Your task is to generate ${count} distinctly different polished and ATS-friendly titles for this certification.
Each title should be concise, professional, and highlight the most relevant aspect of the certification for a resume.
If the provided title/description is generic, make the generated titles more impactful and specific.

Return ONLY a JSON array with exactly ${count} polished certification titles: ["Polished Title 1", "Polished Title 2", "Polished Title 3"]`;

      case 'achievements':
        return `You are an expert resume writer specializing in ATS optimization.

Generate ${count} different achievement variations based on:
- User Type: ${sectionData.userType}
- Experience Level: ${sectionData.experienceLevel || 'Professional'}
- Target Role: ${sectionData.targetRole || 'Professional Role'}
- Context: ${sectionData.context || 'General professional achievements'}

${baseInstructions}

Each achievement MUST be 2 lines and between 15-20 words.
Each variation should include 3-4 quantified achievements:
- Variation 1: Performance and results-focused
- Variation 2: Leadership and team impact-focused
- Variation 3: Innovation and process improvement-focused

Return ONLY a JSON array with exactly ${count} achievement lists: [["achievement1", "achievement2"], ["achievement3", "achievement4"], ["achievement5", "achievement6"]]`;

      case 'skillsList': // NEW/MODIFIED PROMPT FOR POLISHING
        let skillsPrompt = `You are an expert resume writer specializing in ATS optimization.

Given the following skill category and existing skills:
- Category: ${sectionData.category}
- Existing Skills (DRAFT): ${sectionData.existingSkills || 'None'}
- User Type: ${sectionData.userType}
- Job Description: ${sectionData.jobDescription || 'None'}

CRITICAL REQUIREMENTS:
1. Provide 5-8 specific and relevant skills for the given category.
2. Prioritize skills mentioned in the job description or commonly associated with the user type and category.
3. Ensure skills are ATS-friendly.

`;
        if (sectionData.category === 'Databases') {
          skillsPrompt += `
IMPORTANT: For the 'Databases' category, the suggestions MUST be database languages (e.g., SQL, T-SQL, PL/SQL, MySQL, PostgreSQL, MongoDB, Oracle, Cassandra, Redis, DynamoDB, Firebase, Supabase), not theoretical topics like normalization, indexing, or database design principles. Focus on specific technologies and query languages.
`;
        }
        skillsPrompt += `
Return ONLY a JSON array of strings: ["skill1", "skill2", "skill3", "skill4", "skill5"]`;
        return skillsPrompt;

      default:
        return `Generate ${count} ATS-optimized variations for ${type}.`;
    }
  };

  const prompt = getPromptForMultipleVariations(sectionType, data, variationCount, draftText);

  const response = await safeFetch({
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://primoboost.ai",
      "X-Title": "PrimoBoost AI",
    },
    body: JSON.stringify({
      model: modelOverride || 'deepseek/deepseek-chat-v3.1:free', // Set to deepseek/deepseek-chat-v3.1:free
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const responseData = await response.json();
  let result = responseData?.choices?.[0]?.message?.content;

  if (!result) throw new Error('No response content from OpenRouter API');

  result = result.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    const parsedResult = JSON.parse(result);
    // MODIFIED: Handle cases where AI returns a simple array of strings (individual bullet points)
    if (Array.isArray(parsedResult) && !parsedResult.every(Array.isArray)) {
      // If it's an array of strings, map each string to an array containing just that string
      return parsedResult.map((item: string) => [item]);
    } else if (Array.isArray(parsedResult) && parsedResult.every(Array.isArray)) {
      // If it's already an array of arrays (e.g., skillsList, achievements), return directly
      return parsedResult.slice(0, variationCount);
    } else {
      // Fallback: if not a proper JSON array, treat as single string and wrap
      return [[result.split('\n')
        .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, variationCount)]]; // Wrap in an array of arrays
    }
  } catch (parseError) {
    console.error(`JSON parsing error for ${sectionType}:`, parseError);
    console.error('Raw response that failed to parse:', result);
    // Fallback parsing: always return string[][]
    return [[result.split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, variationCount)]]; // Wrap in an array of arrays
  }
};

// --- RE-ADDED: generateAtsOptimizedSection function ---
export const generateAtsOptimizedSection = async (
  sectionType: 'summary' | 'careerObjective' | 'workExperienceBullets' | 'projectBullets' | 'skillsList' | 'additionalSectionBullets' | 'certifications' | 'achievements',
  data: any,
  modelOverride?: string,
  draftText?: string // NEW: Optional draft text to polish
): Promise<string | string[]> => {
  // --- NEW: Input Length Validation ---
  const combinedInputLength = JSON.stringify(data).length + (draftText?.length || 0);
  if (combinedInputLength > MAX_INPUT_LENGTH) {
    throw new Error(
      `Input for section optimization too long (${combinedInputLength} characters). ` +
      `The maximum allowed is ${MAX_INPUT_LENGTH} characters. Please shorten your input.`
    );
  }
  // --- END NEW ---

  const getPromptForSection = (type: string, sectionData: any, draft?: string) => {
    const baseInstructions = `
      CRITICAL ATS OPTIMIZATION RULES:
      1. Highlight key skills and measurable achievements
      2. Use strong action verbs and industry keywords
      3. Focus on value proposition and career goals
      4. Keep it concise
      5. Avoid personal pronouns ("I", "my")
      6. Include quantifiable results where possible
      7. Make it ATS-friendly with clear, direct language
    `;

    if (draft) {
      // If draft text is provided, instruct AI to polish it
      switch (type) {
        case 'summary':
          return `You are an expert resume writer specializing in ATS optimization for experienced professionals.
            Polish and optimize the following professional summary draft for ATS compatibility and impact:
            Draft: "${draft}"
            ${baseInstructions}
            Ensure the polished summary is 2-3 sentences (50-80 words max).
            Return ONLY the polished professional summary text, no additional formatting or explanations.`;
        case 'careerObjective':
          return `You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
            Polish and optimize the following career objective draft for ATS compatibility and impact:
            Draft: "${draft}"
            ${baseInstructions}
            Ensure the polished objective is 2 sentences (30-50 words max).
            Return ONLY the polished career objective text, no additional formatting or explanations.`;
        // For other sections, the existing 'description' or 'details' fields in `sectionData` already serve as the draft.
        // We just need to ensure the prompt for those sections implies polishing if the field is populated.
        // This means the existing prompts for workExperienceBullets, projectBullets, etc., are mostly fine,
        // as they already take the existing content and are expected to optimize it.
        // The main change is for summary/careerObjective.
        // For certifications, it's about generating *titles*, not polishing a description.
        // For skillsList, it's about generating *lists*, not polishing a description.
        // So, `draftText` is primarily for `summary` and `careerObjective`.
        // For bullets, the existing `description` field in `sectionData` already serves this purpose.
      }
    }

    // Existing logic for generating from scratch or based on provided context (not polishing a specific draft)
    switch (type) {
      case 'summary':
        return `You are an expert resume writer specializing in ATS optimization for experienced professionals.
          Generate a compelling 2-3 sentence professional summary based on:
          - User Type: ${sectionData.userType}
          - Target Role: ${sectionData.targetRole || 'General Professional Role'}
          - Experience: ${JSON.stringify(sectionData.experience || [])}
          ${baseInstructions}
          Return ONLY the professional summary text, no additional formatting or explanations.`;

      case 'careerObjective':
        return `You are an expert resume writer specializing in ATS optimization for entry-level professionals and students.
          Generate a compelling 2-sentence career objective based on:
          - User Type: ${sectionData.userType}
          - Target Role: ${sectionData.targetRole || 'Entry-level Professional Position'}
          - Education: ${JSON.stringify(sectionData.education || [])}
          ${baseInstructions}
          Return ONLY the career objective text, no additional formatting or explanations.`;

      case 'workExperienceBullets':
        return `You are an expert resume writer specializing in ATS optimization.

Generate exactly 3 concise bullet points for work experience based on:
- Role: ${sectionData.role}
- Company: ${sectionData.company}
- Duration: ${sectionData.year}
- Description: ${sectionData.description || 'General responsibilities'}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start each bullet with STRONG ACTION VERBS (Developed, Implemented, Led, Managed, Optimized, Achieved, Increased, Reduced)
3. NO weak verbs (helped, assisted, worked on, responsible for)
4. Include quantifiable achievements and metrics
5. Use industry-standard keywords
6. Focus on impact and results, not just responsibilities
7. Avoid repetitive words across bullets
8. Make each bullet distinct and valuable

Return ONLY a JSON array with exactly 3 bullet points: ["bullet1", "bullet2", "bullet3"]`;

      case 'projectBullets':
        return `You are an expert resume writer specializing in ATS optimization.

Generate exactly 3 concise bullet points for a project based on:
- Project Title: ${sectionData.title}
- Description: ${sectionData.description || 'Technical project'}
- Tech Stack: ${sectionData.techStack || 'Modern technologies'}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start with STRONG ACTION VERBS (Developed, Built, Implemented, Designed, Created, Architected)
3. Include specific technologies mentioned in tech stack
4. Focus on technical achievements and impact
5. Include quantifiable results where possible
6. Use industry-standard technical keywords
7. Highlight problem-solving and innovation
8. Make each bullet showcase different aspects

Return ONLY a JSON array with exactly 3 bullet points: ["bullet1", "bullet2", "bullet3"]`;

      case 'additionalSectionBullets':
        return `You are an expert resume writer specializing in ATS optimization.

Generate exactly 3 concise bullet points for a custom resume section based on:
- Section Title: ${sectionData.title}
- User Provided Details: ${sectionData.details || 'General information'}
- User Type: ${sectionData.userType}

CRITICAL ATS OPTIMIZATION RULES:
1. Each bullet point MUST be 2 lines and between 15-20 words.
2. Start with STRONG ACTION VERBS (e.g., Awarded, Recognized, Achieved, Led, Volunteered, Fluent in)
3. Focus on achievements, contributions, or relevant details for the section type
4. Use industry-standard keywords where applicable
5. Quantify results where possible
6. Avoid repetitive words across bullets
7. Make each bullet distinct and valuable

Return ONLY a JSON array with exactly 3 bullet points: ["bullet1", "bullet2", "bullet3"]`;

      case 'certifications':
        // MODIFIED: Conditional prompt based on currentCertTitle
        if (sectionData.currentCertTitle && sectionData.currentCertTitle.trim() !== '') {
          return `You are an expert resume writer specializing in ATS optimization.

Given the following certification title:
- Certification Title: "${sectionData.currentCertTitle}"
- Target Role: ${sectionData.targetRole || 'Professional Role'}
- Current Skills: ${JSON.stringify(sectionData.skills || [])}
- Job Description Context: ${sectionData.jobDescription || 'General professional context'}

Your task is to generate a single, concise, ATS-friendly description for this certification.
The description MUST be a maximum of 15 words.
It should highlight the most relevant aspect of the certification for a resume and align with the target role and skills.

Return ONLY the description text as a single string, no additional formatting or explanations.`;
        } else {
          return `You are an expert resume writer specializing in ATS optimization.

Given the following certification details and context:
- Current Certification Title: "${sectionData.currentCertTitle || 'Not provided'}"
- Current Certification Description: "${sectionData.currentCertDescription || 'Not provided'}"
- Target Role: ${sectionData.targetRole || 'Professional Role'}
- Current Skills: ${JSON.stringify(sectionData.skills || [])}
- Job Description Context: ${sectionData.jobDescription || 'General professional context'}

Your task is to generate 3 polished and ATS-friendly titles for this certification.
Each title should be concise, professional, and highlight the most relevant aspect of the certification for a resume.
If the provided title/description is generic, make the generated titles more impactful and specific.

Return ONLY a JSON array with exactly 3 polished certification titles: ["Polished Title 1", "Polished Title 2", "Polished Title 3"]`;
        }

      case 'achievements':
        return `You are an expert resume writer specializing in ATS optimization.

Generate exactly 4 quantified achievements based on:
- User Type: ${sectionData.userType}
- Experience Level: ${sectionData.experienceLevel || 'Professional'}
- Target Role: ${sectionData.targetRole || 'Professional Role'}
- Context: ${sectionData.context || 'General professional achievements'}

CRITICAL REQUIREMENTS:
1. Each achievement MUST be 2 lines and between 15-20 words.
2. Start with strong action verbs (Achieved, Increased, Led, Improved, etc.)
3. Focus on results and impact, not just activities
4. Make achievements relevant to the target role
5. Include different types of achievements (performance, leadership, innovation, efficiency)

Return ONLY a JSON array with exactly 4 achievements: ["achievement1", "achievement2", "achievement3", "achievement4"]`;

      case 'skillsList':
        let skillsPrompt = `You are an expert resume writer specializing in ATS optimization.

Given the following skill category and existing skills:
- Category: ${sectionData.category}
- Existing Skills: ${sectionData.existingSkills || 'None'}
- User Type: ${sectionData.userType}
- Job Description: ${sectionData.jobDescription || 'None'}

CRITICAL REQUIREMENTS:
1. Provide 5-8 specific and relevant skills for the given category.
2. Prioritize skills mentioned in the job description or commonly associated with the user type and category.
3. Ensure skills are ATS-friendly.

`;
        if (sectionData.category === 'Databases') {
          skillsPrompt += `
IMPORTANT: For the 'Databases' category, the suggestions MUST be database languages (e.g., SQL, T-SQL, PL/SQL, MySQL, PostgreSQL, MongoDB, Oracle, Cassandra, Redis, DynamoDB, Firebase, Supabase), not theoretical topics like normalization, indexing, or database design principles. Focus on specific technologies and query languages.
`;
        }
        skillsPrompt += `
Return ONLY a JSON array of strings: ["skill1", "skill2", "skill3", "skill4", "skill5"]`;
        return skillsPrompt;

      default:
        return `Generate ATS-optimized content for ${type}.`;
    }
  };

  const prompt = getPromptForSection(sectionType, data, draftText);

  const response = await safeFetch({
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://primoboost.ai",
      "X-Title": "PrimoBoost AI",
    },
    body: JSON.stringify({
      model: modelOverride || 'deepseek/deepseek-chat-v3.1:free', // Set to deepseek/deepseek-chat-v3.1:free
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const responseData = await response.json();
  let result = responseData?.choices?.[0]?.message?.content;
  
  if (!result) {
    throw new Error('No response content from OpenRouter API');
  }

  result = result.replace(/```json/g, '').replace(/```/g, '').trim();
  console.log(`[GEMINI_SERVICE] Raw result for ${sectionType}:`, result); // Log raw result

  // MODIFIED: Consolidated JSON parsing for all array-returning section types
  if (
    sectionType === 'workExperienceBullets' ||
    sectionType === 'projectBullets' ||
    sectionType === 'additionalSectionBullets' ||
    sectionType === 'achievements' ||   // Added for JSON parsing
    sectionType === 'skillsList'        // Added for JSON parsing
  ) {
    try {
      console.log(`Parsing JSON for ${sectionType}:`, result); // Log the result before parsing
      const parsed = JSON.parse(result);
      console.log(`[GEMINI_SERVICE] Parsed result for ${sectionType}:`, parsed); // Log parsed result
      return parsed;
    } catch (parseError) {
      console.error(`JSON parsing error for ${sectionType}:`, parseError); // Log parsing error
      console.error('Raw response that failed to parse:', result); // Log the raw response
      // Fallback to splitting by lines if JSON parsing fails
      return result.split('\n')
        .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 5); // Limit to 5 for fallback, adjust as needed
    }
  } else if (sectionType === 'certifications') {
    // If the prompt was to generate a description (single string), return it directly
    if (data.currentCertTitle && data.currentCertTitle.trim() !== '') { // Use data.currentCertTitle for check
      return result; // Return as a single string
    } else {
      // Otherwise, it's generating titles (array of strings)
      try {
        const parsed = JSON.parse(result);
        return parsed;
      } catch (parseError) {
        console.error(`JSON parsing error for ${sectionType} titles:`, parseError);
        console.error('Raw response that failed to parse:', result);
        return result.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      }
    }
  }

  return result;
};
