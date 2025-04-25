import { embedLLM } from "../clients/llmClient.js";
import { supabase } from "../clients/supabase.js";

export const useVectorRanking = async (preferences, targetCount) => {
  try {
    const stringifiedPreferences = JSON.stringify(preferences);

    // Create embedding directly from the preferences object
    const embeddingResponse = await embedLLM.embeddings.create({
      model: "text-embedding-3-small",
      input: stringifiedPreferences,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Query Supabase using the match_blogs function
    const { data: recommendedBlogs, error } = await supabase.rpc(
      "match_blogs",
      {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: targetCount,
      }
    );

    if (error) {
      throw error;
    }

    return {
      preferences, // Return the original preferences object
      recommendations: recommendedBlogs.map((blog) => {
        return {
          id: blog.id,
          title: blog.title,
          post_id: blog.post_id,
          publish_date: blog.publish_date,
          featured_image: blog.featured_image,
          summary: blog.summary,
          url: blog.url,
          content_metadata: blog.content_metadata,
          embedding_text: blog.embedding_text,
          author: blog.author,
          similarity: blog.similarity,
          appliedModifier: blog.appliedModifier,
          tags: blog.tags,
        };
      }),
    };
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
