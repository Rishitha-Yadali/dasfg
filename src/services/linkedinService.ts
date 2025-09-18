const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

interface MessageForm {
  messageType: 'connection' | 'cold-outreach' | 'follow-up' | 'job-inquiry';
  recipientFirstName: string;
  recipientLastName: string;
  recipientCompany: string;
  recipientJobTitle: string;
  senderName: string;
  senderCompany: string;
  senderRole: string;
  messagePurpose: string;
  tone: 'professional' | 'casual' | 'friendly';
  personalizedContext: string;
  industry: string;
}

export const generateLinkedInMessage = async (formData: MessageForm): Promise<string[]> => {
  const getPromptForMessageType = (type: string) => {
    const baseContext = `
RECIPIENT: ${formData.recipientFirstName} ${formData.recipientLastName}, ${formData.recipientJobTitle} at ${formData.recipientCompany}
SENDER: ${formData.senderName}, ${formData.senderRole}${formData.senderCompany ? ` at ${formData.senderCompany}` : ''}
PURPOSE: ${formData.messagePurpose}
TONE: ${formData.tone}
INDUSTRY: ${formData.industry || 'Not specified'}
CONTEXT: ${formData.personalizedContext || 'No additional context provided'}`;

    switch (type) {
      case 'connection':
        return `You are an expert LinkedIn networking specialist.

${baseContext}

Write 3 different personalized LinkedIn connection request messages.

REQUIREMENTS:
- Under 200 characters each
- Professional and ${formData.tone} tone
- Include one specific detail about them or their company
- End with clear value proposition
- Avoid generic templates
- Make each version distinctly different

CRITICAL: Each message must be under 200 characters (LinkedIn's connection request limit).

Respond with exactly 3 messages, each on a separate line, numbered 1-3.`;

      case 'cold-outreach':
        return `Act as a LinkedIn sales messaging expert.

${baseContext}

Create 3 different cold outreach messages.

REQUIREMENTS:
- Maximum 300 characters each
- Personalize with recipient's background
- Include one clear call-to-action
- ${formData.tone} but conversational tone
- Provide value upfront
- Make each version have different approach

Respond with exactly 3 messages, each on a separate line, numbered 1-3.`;

      case 'follow-up':
        return `You are a professional relationship manager.

${baseContext}

Write 3 different LinkedIn follow-up messages.

REQUIREMENTS:
- Reference previous interaction context
- Provide new value or update
- Keep under 250 characters each
- Include specific next step
- ${formData.tone} tone
- Make each version unique

Respond with exactly 3 messages, each on a separate line, numbered 1-3.`;

      case 'job-inquiry':
        return `Act as a career coach and job search expert.

${baseContext}

Generate 3 different job inquiry LinkedIn messages.

REQUIREMENTS:
- Express genuine interest in opportunities
- Highlight relevant skills/experience
- Professional and ${formData.tone} tone
- Under 280 characters each
- Include clear call-to-action
- Make each version have different angle

Respond with exactly 3 messages, each on a separate line, numbered 1-3.`;

      default:
        return `You are a LinkedIn messaging specialist.

${baseContext}

Create 3 different professional LinkedIn messages for the specified purpose.

REQUIREMENTS:
- ${formData.tone} tone
- Under 250 characters each
- Personalized and specific
- Include clear call-to-action
- Make each version unique

Respond with exactly 3 messages, each on a separate line, numbered 1-3.`;
    }
  };

  const prompt = getPromptForMessageType(formData.messageType);

  const maxRetries = 3;
  let retryCount = 0;
  let delay = 1000;

  while (retryCount < maxRetries) {
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
          model: "deepseek/deepseek-r1:free",
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

        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenRouter API key configuration.');
        } else if (response.status === 429 || response.status >= 500) {
          console.warn(`Retrying due to OpenRouter API error: ${response.status}. Attempt ${retryCount + 1}/${maxRetries}. Retrying in ${delay / 1000}s...`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        } else {
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      let result = data?.choices?.[0]?.message?.content;

      if (!result) {
        throw new Error('No response content from OpenRouter API');
      }

      // Parse the numbered messages
      const messages = result
        .split('\n')
        .filter((line: string) => line.trim().match(/^\d+\./))
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((msg: string) => msg.length > 0);

      if (messages.length === 0) {
        // Fallback: split by numbers or return the whole response
        const fallbackMessages = result
          .split(/\d+\./)
          .filter((msg: string) => msg.trim().length > 10)
          .map((msg: string) => msg.trim())
          .slice(0, 3);

        return fallbackMessages.length > 0 ? fallbackMessages : [result.trim()];
      }

      return messages.slice(0, 3); // Ensure we return exactly 3 messages

    } catch (error) {
      console.error('Error calling OpenRouter API:', error);

      if (error instanceof Error && (
          error.message.includes('API key') ||
          error.message.includes('Rate limit') ||
          error.message.includes('service is temporarily unavailable')
      )) {
        throw error;
      }

      if (retryCount === maxRetries - 1) {
        throw new Error('Failed to generate LinkedIn messages after multiple attempts.');
      }

      retryCount++;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error(`Failed to generate LinkedIn messages after ${maxRetries} attempts.`);
};