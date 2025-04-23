import { embedLLM } from "../clients/llmClient.js";
import { supabase } from "../clients/supabase.js";

export const useVectorRanking = async (preferences) => {
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
        match_count: 5,
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
          similarity: blog.similarity,
          summary: blog.summary,
          url: blog.url,
          content_metadata: blog.content_metadata,
          embedding_text: blog.embedding_text,
        };
      }),
    };
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
