import { genLLM } from "../clients/llmClient.js";
import { supabase } from "../clients/supabase.js";

// Helper function to duplicate blogs to reach target count
const duplicateBlogsToTargetCount = (blogs, targetCount) => {
  const duplicatedBlogs = [...blogs];

  while (duplicatedBlogs.length < targetCount) {
    // Get the next blog to duplicate (cycling through the original list)
    const originalBlog = blogs[duplicatedBlogs.length % blogs.length];

    // Create a duplicate with a new id to avoid conflicts
    const duplicatedBlog = {
      ...originalBlog,
      id: `dup-${duplicatedBlogs.length}`, // Create a unique ID
    };

    duplicatedBlogs.push(duplicatedBlog);
  }

  return duplicatedBlogs;
};

export const useLLMRanking = async (preferences) => {
  try {
    const startTime = new Date();

    // Fetch all blogs from Supabase
    const { data: blogs, error } = await supabase.from("blogs").select("*");

    if (error) {
      throw error;
    }

    console.log(`Original blog count: ${blogs.length}`);

    // Duplicate blogs to reach 1000 entries
    const expandedBlogs = duplicateBlogsToTargetCount(blogs, 1000);
    console.log(`Expanded blog count for testing: ${expandedBlogs.length}`);

    // Prepare the blogs data for ranking
    const blogsData = expandedBlogs.map((blog) => ({
      id: blog.id,
      title: blog.title,
      content_metadata: blog.content_metadata,
    }));

    // Create the prompt for ranking
    const prompt = `
    You are a helpful assistant that ranks blog posts based on user preferences.
    Given the following user preferences and a list of blog posts, rank the blog posts from most relevant to least relevant.
    Consider the title and content_metadata when ranking.
    
    User Preferences:
    ${JSON.stringify(preferences, null, 2)}
    
    Blog Posts to Rank:
    ${JSON.stringify(blogsData, null, 2)}
    
    Please return a JSON array of blog ids in order of relevance, from most to least relevant.
    Only return the array of ids, nothing else. Do not include any other text or formatting.
    `;

    // Get ranking from LLM
    const response = await genLLM.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: {
        type: "json_schema",
      },
    });

    // Use regex to extract the first complete array from the response
    const responseContent = response.choices[0].message.content.trim();

    const arrayMatch = responseContent.match(/\[[\s\S]*?\]/);

    if (!arrayMatch) {
      throw new Error("No valid array found in the LLM response");
    }

    const rankedBlogs = JSON.parse(arrayMatch[0]);

    // Map the ranked titles back to full blog data
    const rankedBlogsWithData = rankedBlogs
      .map((id) => {
        // Find in the expanded blogs list
        const blog = expandedBlogs.find((b) => String(b.id) === String(id));

        if (!blog) {
          console.warn(`Blog with id ${id} not found in expanded list`);
          return null;
        }

        return {
          id: blog.id,
          title: blog.title,
          summary: blog.summary,
          url: blog.url,
          content_metadata: blog.content_metadata,
          categories:
            blog.categories && blog.categories.length > 0
              ? blog.categories.map((c) => c.name)
              : [],
          tags:
            blog.tags && blog.tags.length > 0
              ? blog.tags.map((t) => t.name)
              : [],
        };
      })
      .filter(Boolean); // Filter out any null values

    const endTime = new Date();
    const duration = endTime - startTime;

    return {
      metric: {
        duration,
        usage: response.usage,
        originalBlogCount: blogs.length,
        expandedBlogCount: expandedBlogs.length,
      },
      preferences,
      recommendations: rankedBlogsWithData,
      totalBlogs: expandedBlogs.length,
    };
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
