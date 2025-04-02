import { genLLM } from "../clients/llmClient.js";

export const generateSummary = async (content) => {
  try {
    const response = await genLLM.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: `
          You are a helpful assistant that creates concise, engaging summaries of blog posts. Keep the summary under 2-3 sentences and focus on the main points.
          
          Please summarize this blog post content:\n\n${content}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating summary:", error);
    return null;
  }
};

export const generateContentMetadata = async (content) => {
  try {
    const response = await genLLM.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: `
          You are a helpful assistant that analyzes content to extract key metadata. Based on the following content, generate a JSON object with the following structure and specific options:

          {
            "activities": ["array of activities from these options only: Beach, Wine, Outdoors, Adventure, Luxury, Cuisine, Relaxation, Culture, Wellness"],
            "exertionLevel": number between 1-5 where:
              1 = Relaxing
              3 = Medium
              5 = Adventurous/Thrilling,
            "group": one of these options only: "Solo", "Couple", "Family", "Friends",
            "priceRange": one of these options only: "$" (Budget), "$$" (Moderate), "$$$" (Luxury)
          }
          
          Please analyze this content and return ONLY the JSON object:\n\n${content}`,
        },
      ],
      response_format: {
        type: "json_schema",
      },
      temperature: 0.7,
      max_tokens: 200,
    });

    const metadataString = response.choices[0].message.content.trim();
    // Extract the first JSON object from the response
    const jsonMatch = metadataString.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON object found in response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error generating content metadata:", error);
    return null;
  }
};
