// src/services/geminiService.ts
import { ResumeData, UserType } from '../types/resume';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

const deepCleanComments = (val: any): any => {
  const stripLineComments = (input: string): string => {
    let cleanedInput = input;

    // 1. Remove block comments /* ... */
    cleanedInput = cleanedInput.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. Remove specific "// Line XXX" comments anywhere in the string
    // This regex targets "// Line" followed by numbers and optional spaces, then removes it.
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
    cleanedInput = cleanedInput.replace(/\n{3,}/g, '\n\n');

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
  targetRole?: string
): Promise<ResumeData> => {
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
7. Education (minimal or omit if not required)`;
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
8. Achievements (academic awards, competitions, etc.)
9. Languages Known (if present in original resume)`;
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
7. Achievements (if present in original resume)
8. Extra-curricular Activities (if present in original resume)
9. Certifications
10. Languages Known (if present in original resume)
11. Personal Details (if present in original resume)`;
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
13. Avoid using subjective adjectives like "passionate", "dedicated", or "hardworking" unless contextually backed with measurable achievements. DO NOT add adjectives like “dedicated”, “motivated”, or “hardworking” unless backed by resume content.
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
- Achievements: Include if present in original resume (academic awards, competitions, etc.)
- Extra-curricular Activities: Include if present (leadership roles, clubs, volunteer work)
- Certifications
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
7. Ensure all dates are in proper format (e.g., "Jan 2024 – Mar 2024")
8. Use professional language and industry-specific keywords from the job description
9. For LinkedIn and GitHub, use EXACTLY what is provided - empty string if not provided
10. The "name" field in the JSON should ONLY contain the user's name. The "email", "phone", "linkedin", "github", and "location" fields MUST NOT contain the user's name or any part of it. The user's name should appear ONLY in the dedicated "name" field.

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
  ${userType === 'fresher' || userType === 'student' ? `
  "achievements": ["...", "..."],
  
  "personalDetails": "..."` : ''}
}
Resume:
${resume}

Job Description:
${jobDescription}

User Type: ${userType.toUpperCase()}

LinkedIn URL provided: ${linkedinUrl || 'NONE - leave empty'}
GitHub URL provided: ${githubUrl || 'NONE - leave empty'}`;

  const maxRetries = 5;
  let retryCount = 0;
  let delay = 2000;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://primoboost.ai',
          'X-Title': 'PrimoBoost AI'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: promptContent }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenRouter API key configuration.');
        } else if (response.status === 429 || response.status >= 500) {
          retryCount++;
          if (retryCount >= maxRetries) throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        } else {
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      let result = data?.choices?.[0]?.message?.content;
      if (!result) throw new Error('No response content from OpenRouter API');

      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      let cleanedResult: string;
      if (jsonMatch && jsonMatch[1]) {
        cleanedResult = jsonMatch[1].trim();
      } else {
        cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
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

        parsedResult.name = userName || parsedResult.name || '';

        parsedResult.linkedin = userLinkedin || parsedResult.linkedin || '';
        parsedResult.github = userGithub || parsedResult.github || '';

        if (userEmail) {
          parsedResult.email = userEmail;
        } else if (parsedResult.email) {
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
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

        parsedResult.origin = 'jd_optimized';

        return parsedResult;
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response attempted to parse:', cleanedResult);
        throw new Error('Invalid JSON response from OpenRouter API');
      }
    } catch (error: any) {
      if (
        error instanceof Error &&
        (error.message.includes('API key') ||
          error.message.includes('Rate limit') ||
          error.message.includes('service is temporarily unavailable') ||
          error.message.includes('Invalid JSON response'))
      ) {
        throw error;
      }
      throw new Error('Failed to connect to OpenRouter API. Please check your internet connection and try again.');
    }
  }

  throw new Error(`Failed to optimize resume after ${maxRetries} attempts.`);
};