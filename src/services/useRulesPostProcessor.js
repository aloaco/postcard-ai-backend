import { genLLM } from "../clients/llmClient.js";

/**
 * Apply rules to modify blog similarity scores in parallel
 * @param {Array} blogs - Array of blog objects with similarity scores
 * @param {String} rules - String of rules to apply (e.g. "increase all blogs about surfing by 0.08 points")
 * @returns {Array} - Blogs with updated similarity scores
 */
export const useRulesPostProcessor = async (blogs, rules) => {
  if (!rules || !blogs || blogs.length === 0) {
    return blogs;
  }

  // Process all blogs in parallel
  const modifierPromises = blogs.map(async (blog) => {
    const prompt = `
Given the following blog content and a set of rules, determine a modifier value to apply to the blog's similarity score.
Return ONLY a number (positive or negative) with no other text or explanation.

BLOG CONTENT: ${JSON.stringify(blog)}

RULES: ${JSON.stringify(rules)}

MODIFIER VALUE:

Example:

If the blog is about surfing, and the rules are to increase all blogs about surfing by 0.08 points, then the modifier value should be 0.08.
If the blog is about surfing, and the rules are to decrease all blogs about surfing by 0.08 points, then the modifier value should be -0.08.
`;

    try {
      const response = await genLLM.chat.completions.create({
        model: "google/gemini-2.0-flash-lite-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 10,
      });

      const modifierText = response.choices[0].message.content.trim();

      const modifier = parseFloat(modifierText);

      // Validate if the response is a valid number
      if (!isNaN(modifier)) {
        return {
          ...blog,
          similarity: blog.similarity + modifier,
          appliedModifier: modifier,
        };
      }

      // Return original blog if invalid response
      return blog;
    } catch (error) {
      console.error(`Error calculating modifier for blog: ${error}`);
      return blog;
    }
  });

  // Wait for all promises to resolve
  return Promise.all(modifierPromises);
};
