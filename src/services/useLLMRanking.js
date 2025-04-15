import { genLLM } from "../clients/llmClient.js";
import { supabase } from "../clients/supabase.js";

// Helper function to duplicate blogs to reach target count
const duplicateBlogsToTargetCount = (blogs, targetCount) => {
  const duplicatedBlogs = [...blogs];

  // If we already have more blogs than the target count, cut the array
  if (duplicatedBlogs.length > targetCount) {
    return duplicatedBlogs.slice(0, targetCount);
  }

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
    const expandedBlogs = duplicateBlogsToTargetCount(blogs, 200);
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
    
    Please return a JSON array of objects with the following structure:
    [
      {
        "id": "blog_id",
        "score": numeric_score_between_0_and_100
      },
      ...
    ]
    
    Sort the array by score in descending order (highest scores first).
    Only return the JSON array, nothing else. Do not include any other text or formatting.
    `;

    console.log("entering response");

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

    console.log("completed response");

    // Use regex to extract the first complete array from the response
    const responseContent = response.choices[0].message.content.trim();

    let parsedResponse;
    try {
      // Attempt to parse the entire response as JSON
      parsedResponse = JSON.parse(responseContent);
    } catch (e) {
      // If full parsing fails, try to extract just the array using regex
      const arrayMatch = responseContent.match(/\[[\s\S]*?\]/);
      if (!arrayMatch) {
        throw new Error("No valid array found in the LLM response");
      }
      try {
        parsedResponse = JSON.parse(arrayMatch[0]);
      } catch (e) {
        throw new Error("Failed to parse LLM response as JSON");
      }
    }

    if (!Array.isArray(parsedResponse)) {
      throw new Error("LLM response is not an array");
    }

    // Extract the blog IDs in ranked order
    const rankedBlogs = parsedResponse.map((item) =>
      typeof item === "object" && item !== null ? item.id : String(item)
    );

    // Map the ranked titles back to full blog data
    const rankedBlogsWithData = rankedBlogs
      .map((id, index) => {
        // Find in the expanded blogs list
        const blog = expandedBlogs.find((b) => String(b.id) === String(id));

        if (!blog) {
          console.warn(`Blog with id ${id} not found in expanded list`);
          return null;
        }

        // Get reasoning and score if available
        const rankingInfo = parsedResponse[index];
        const score =
          typeof rankingInfo === "object" && rankingInfo !== null
            ? rankingInfo.score
            : null;

        return {
          id: blog.id,
          title: blog.title,
          score,
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
        total: expandedBlogs.length,
      },
      preferences,
      recommendations: rankedBlogsWithData,
    };
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
