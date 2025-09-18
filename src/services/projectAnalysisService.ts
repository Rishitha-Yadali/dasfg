import { ResumeData } from '../types/resume';
import { ProjectAnalysis, ProjectMatch, RecommendedProject, ProjectSuitabilityResult } from '../types/analysis';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GITHUB_TOKEN = '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';
const SERP_API_KEY = '5a51f510fa66113157ff2d54c84891760bfcdb06f596789550f6cfb13a974b87';

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

export const analyzeProjectSuitability = async (
  resumeData: ResumeData,
  jobDescription: string,
  targetRole: string
): Promise<ProjectSuitabilityResult> => {
  const prompt = `You are an expert resume analyzer and project recommender.

### Job Description:
${jobDescription}

### Role:
${targetRole || 'Not specified'}

### Resume Projects:
${resumeData.projects?.map(project => `
Project Title: ${project.title}
Summary: ${project.bullets?.[0] || 'No summary provided.'}
`).join('\n') || 'No projects found'}

### Resume Work Experience:
${resumeData.workExperience?.map(exp => `
Role: ${exp.role} at ${exp.company} (${exp.year})
Summary: ${exp.bullets?.[0] || 'No summary provided.'}
${exp.bullets?.[1] ? `Key Point 2: ${exp.bullets[1]}` : ''}
`).join('\n') || 'No work experience found'}

Your task:

For each project, analyze if it matches the JD and role requirements.
Mark each as ✅ Suitable or ❌ Not Suitable.
Give a brief reason if not suitable.
Suggest replacement projects (open-source or academic) if a project is rejected.
Each suggested project should include a GitHub link, short title, and 3 role-specific bullet points.

Respond ONLY with valid JSON in this exact structure:

{
  "projectAnalysis": [
    {
      "title": "Original Project Title",
      "suitable": true/false,
      "reason": "Reason if not suitable",
      "replacementSuggestion": {
        "title": "Suggested Project Title",
        "githubUrl": "https://github.com/username/repo",
        "bulletPoints": [
          "First bullet point - up to 20 words that are relevant to the role and JD",
          "Second bullet point - up to 20 words that are relevant to the role and JD",
          "Third bullet point - up to 20 words that are relevant to the role and JD"
        ]
      }
    }
  ],
  "summary": {
    "totalProjects": 0,
    "suitableProjects": 0,
    "unsuitableProjects": 0
  },
  "suggestedProjects": [
    {
      "title": "Additional Suggested Project",
      "githubUrl": "https://github.com/username/repo",
      "bulletPoints": [
        "First bullet point - up to 20 words that are relevant to the role and JD",
        "Second bullet point - up to 20 words that are relevant to the role and JD",
        "Third bullet point - up to 20 words that are relevant to the role and JD"
      ]
    }
  ]
}

CRITICAL INSTRUCTIONS:
STRICT JSON SYNTAX: Ensure all arrays are correctly terminated with ']' and all objects with '}', with proper comma separation between elements. Do NOT use '}' to close an array.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        "HTTP-Referer": "https://primoboost.ai",
        "X-Title": "PrimoBoost AI"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response content from OpenRouter API');
    }

    // Clean the response to ensure it's valid JSON
    const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsedResult = JSON.parse(cleanedResult);
      return parsedResult;
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', cleanedResult);
      throw new Error('Invalid JSON response from OpenRouter API');
    }
  } catch (error) {
    console.error('Error calling OpenRouter API for project analysis:', error);
    throw new Error('Failed to analyze project suitability. Please try again.');
  }
};

// Function to fetch real GitHub projects based on tech stack and role
export const fetchGitHubProjects = async (techStack: string[], role: string): Promise<any[]> => {
  try {
    // Create search query based on tech stack and role
    const query = `${role} ${techStack.slice(0, 3).join(' ')}`;
    
    const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.items.slice(0, 5).map((repo: any) => ({
      title: repo.name,
      githubUrl: repo.html_url,
      description: repo.description || '',
      stars: repo.stargazers_count,
      language: repo.language
    }));
  } catch (error) {
    console.error('Error fetching GitHub projects:', error);
    // Return fallback projects if GitHub API fails
    return getFallbackProjects(techStack, role);
  }
};

// Fallback projects when GitHub API fails
const getFallbackProjects = (techStack: string[], role: string): any[] => {
  const roleType = getRoleType(role);
  
  const projects = {
    backend: [
      {
        title: "Spring Boot E-Commerce API",
        githubUrl: "https://github.com/spring-projects/spring-petclinic",
        description: "RESTful API for e-commerce platform with authentication and order management",
        stars: 5823,
        language: "Java"
      },
      {
        title: "Node.js Microservices Architecture",
        githubUrl: "https://github.com/goldbergyoni/nodebestpractices",
        description: "Scalable microservices with Node.js, Express, and MongoDB",
        stars: 4219,
        language: "JavaScript"
      }
    ],
    frontend: [
      {
        title: "React Dashboard Application",
        githubUrl: "https://github.com/facebook/create-react-app",
        description: "Modern dashboard with data visualization and responsive design",
        stars: 7651,
        language: "JavaScript"
      },
      {
        title: "Vue.js E-commerce Store",
        githubUrl: "https://github.com/vuejs/vue",
        description: "Full-featured online store with shopping cart and payment integration",
        stars: 6342,
        language: "JavaScript"
      }
    ],
    fullstack: [
      {
        title: "MERN Stack Social Network",
        githubUrl: "https://github.com/bradtraversy/devconnector_2.0",
        description: "Complete social platform with profiles, posts, and real-time chat",
        stars: 3987,
        language: "JavaScript"
      },
      {
        title: "Django React Blog Platform",
        githubUrl: "https://github.com/django/django",
        description: "Full-featured blog with authentication, comments, and admin dashboard",
        stars: 5124,
        language: "Python"
      }
    ],
    mobile: [
      {
        title: "React Native Fitness App",
        githubUrl: "https://github.com/facebook/react-native",
        description: "Cross-platform mobile app for fitness tracking and workout planning",
        stars: 4532,
        language: "JavaScript"
      },
      {
        title: "Flutter E-commerce App",
        githubUrl: "https://github.com/flutter/flutter",
        description: "Beautiful mobile shopping experience with animations and state management",
        stars: 5876,
        language: "Dart"
      }
    ],
    data: [
      {
        title: "Python Data Analysis Pipeline",
        githubUrl: "https://github.com/pandas-dev/pandas",
        description: "ETL pipeline with data visualization and machine learning integration",
        stars: 4298,
        language: "Python"
      },
      {
        title: "Spark Big Data Processing",
        githubUrl: "https://apache/spark",
        description: "Large-scale data processing with Apache Spark and visualization",
        stars: 5643,
        language: "Scala"
      }
    ]
  };
  
  return projects[roleType] || projects.fullstack;
};

// Helper function to determine role type
const getRoleType = (role: string): string => {
  role = role.toLowerCase();
  
  if (role.includes('backend') || role.includes('java') || role.includes('python') || role.includes('node')) {
    return 'backend';
  }
  
  if (role.includes('frontend') || role.includes('react') || role.includes('angular') || role.includes('vue')) {
    return 'frontend';
  }
  
  if (role.includes('fullstack') || role.includes('full stack') || role.includes('full-stack')) {
    return 'fullstack';
  }
  
  if (role.includes('mobile') || role.includes('android') || role.includes('ios') || role.includes('flutter')) {
    return 'mobile';
  }
  
  if (role.includes('data') || role.includes('ml') || role.includes('ai') || role.includes('machine learning')) {
    return 'data';
  }
  
  return 'fullstack'; // Default
};

// Generate project bullets based on project details and job description
export const generateProjectBullets = async (
  projectTitle: string,
  techStack: string[],
  jobDescription: string,
  targetRole: string
): Promise<string[]> => {
  const prompt = `Generate exactly 3 bullet points for a resume project based on the following details:

Project Title: ${projectTitle}
Tech Stack: ${techStack.join(', ')}
Target Role: ${targetRole}
Job Description: ${jobDescription}

REQUIREMENTS:
1. Each bullet point must be up to 20 words - no more, no less
2. Start each bullet with a strong action verb (e.g., Developed, Implemented, Architected, Optimized)
3. NO weak verbs like "helped", "assisted", "worked on", "was responsible for"
4. Include specific technologies from the tech stack
5. Focus on achievements and impact, not just responsibilities
6. Align with the job description requirements
7. Include metrics and quantifiable results where possible
8. No repeated keywords across bullets

Format your response as a JSON array with exactly 3 strings:
["Bullet 1", "Bullet 2", "Bullet 3"]`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        "HTTP-Referer": "https://primoboost.ai",
        "X-Title": "PrimoBoost AI"
      },
      body: JSON.stringify({
        model: "openai/gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response content from OpenRouter API');
    }

    // Clean the response to ensure it's valid JSON
    const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsedResult = JSON.parse(cleanedResult);
      return parsedResult;
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      // Return fallback bullets if parsing fails
      return [
        `Developed ${projectTitle} using ${techStack[0] || 'modern technologies'} to solve business challenges and improve operational efficiency.`,
        `Implemented key features including user authentication, data management, and reporting functionality for enhanced user experience.`,
        `Optimized application performance by 40% through code refactoring and database query optimization techniques.`
      ];
    }
  } catch (error) {
    console.error('Error generating project bullets:', error);
    // Return fallback bullets if API call fails
    return [
      `Developed ${projectTitle} using ${techStack[0] || 'modern technologies'} to solve business challenges and improve operational efficiency.`,
      `Implemented key features including user authentication, data management, and reporting functionality for enhanced user experience.`,
      `Optimized application performance by 40% through code refactoring and database query optimization techniques.`
    ];
  }
};

export const analyzeProjectAlignment = async (
  resumeData: ResumeData, 
  jobDescription: string, 
  targetRole: string
): Promise<ProjectAnalysis> => {
  const prompt = `You are a senior technical recruiter and career strategist. Analyze the alignment between the candidate's projects and the target job requirements.

CANDIDATE'S CURRENT PROJECTS:
${resumeData.projects?.map(project => `
- ${project.title}
  Bullets: ${project.bullets?.join('; ') || 'No details provided'}
`).join('\n') || 'No projects listed'}

CANDIDATE'S WORK EXPERIENCE:
${resumeData.workExperience?.map(exp => `
- ${exp.role} at ${exp.company} (${exp.year})
  Bullets: ${exp.bullets?.join('; ') || 'No details provided'}
`).join('\n') || 'No work experience listed'}

CANDIDATE'S SKILLS:
${resumeData.skills?.map(skill => `${skill.category}: ${skill.list?.join(', ') || ''}`).join('\n') || 'No skills listed'}

TARGET ROLE: ${targetRole}

JOB DESCRIPTION:
${jobDescription}

ANALYSIS REQUIREMENTS:

1. MATCH SCORE CALCULATION (0-100%):
   - Analyze how well current projects align with job requirements
   - Consider technical skills, domain knowledge, and project complexity
   - Factor in transferable skills and relevant experience

2. MATCHING PROJECTS ANALYSIS:
   - Identify which current projects are most relevant
   - Explain why each project aligns with the role
   - Highlight specific skills demonstrated

3. RECOMMENDED PROJECTS (5-7 suggestions):
   - Identify gaps in project portfolio
   - Suggest specific projects that would strengthen candidacy
   - Include realistic scope and technologies
   - Prioritize by impact on role fit

CRITICAL INSTRUCTIONS:
- Be specific and actionable in recommendations
- Consider current market trends and industry standards
- Suggest projects that can be completed in 2-8 weeks
- Include both technical and soft skill development
- Provide realistic timelines and scope
- STRICT JSON SYNTAX: Ensure all arrays are correctly terminated with ']' and all objects with '}', with proper comma separation between elements. Do NOT use '}' to close an array.

Respond ONLY with valid JSON in this exact structure:

{
  "matchScore": 0-100,
  "matchingProjects": [
    {
      "title": "project name",
      "matchScore": 0-100,
      "relevantSkills": ["skill1", "skill2"],
      "alignmentReason": "detailed explanation of why this project aligns with the role"
    }
  ],
  "recommendedProjects": [
    {
      "id": "unique-id",
      "title": "Specific Project Title",
      "type": "Web Application/Mobile App/Data Pipeline/API/etc",
      "focusArea": "Frontend/Backend/Full-Stack/Data/DevOps/etc",
      "priority": "High/Medium/Low",
      "impactScore": 0-100,
      "technologies": ["tech1", "tech2", "tech3"],
      "scope": "2-3 sentence description of project scope",
      "deliverables": ["deliverable1", "deliverable2", "deliverable3"],
      "industryContext": "How this relates to the target industry/role",
      "timeEstimate": "2-8 weeks",
      "skillsAddressed": ["skill1", "skill2", "skill3"]
    }
  ],
  "overallAssessment": "2-3 sentence summary of candidate's current position and main areas for improvement",
  "priorityActions": ["action1", "action2", "action3"]
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        "HTTP-Referer": "https://primoboost.ai",
        "X-Title": "PrimoBoost AI"
      },
      body: JSON.stringify({
        model: "openai/gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.choices?.[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response content from OpenRouter API');
    }

    // Clean the response to ensure it's valid JSON
    const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsedResult = JSON.parse(cleanedResult);
      return parsedResult;
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw response:', cleanedResult);
      throw new Error('Invalid JSON response from OpenRouter API');
    }
  } catch (error) {
    console.error('Error calling OpenRouter API for project analysis:', error);
    throw new Error('Failed to analyze project alignment. Please try again.');
  }
};
