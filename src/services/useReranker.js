import cohere from "../clients/cohore.js";
import { useVectorRanking } from "./useVectorRanking.js";
import { useRulesPostProcessor } from "./useRulesPostProcessor.js";

export const useReranker = async (
  preferences,
  targetCount,
  rules = null,
  rerankerEnabled = false
) => {
  console.log("reranker", preferences, targetCount, rules, rerankerEnabled);
  const vectorRanking = await useVectorRanking(preferences, targetCount);

  let processedBlogs;

  if (rerankerEnabled) {
    // Only perform reranking if enabled
    let documents = [];

    vectorRanking.recommendations.map((blog) => {
      documents.push(blog.embedding_text);
    });

    const query = JSON.stringify(preferences);

    const response = await cohere.rerank({
      model: "rerank-v3.5",
      query: query,
      documents: documents,
      top_n: targetCount,
    });

    const rerankedBlogs = response.results.map((result) => {
      let blog = vectorRanking.recommendations[result.index];
      blog.similarity = result.relevanceScore;
      return blog;
    });

    // Apply post-processing rules if provided
    if (rules) {
      processedBlogs = await useRulesPostProcessor(rerankedBlogs, rules);
    } else {
      processedBlogs = rerankedBlogs;
    }

    // Re-sort blogs by similarity after applying rules
    const sortedBlogs = [...processedBlogs].sort(
      (a, b) => b.similarity - a.similarity
    );

    return {
      rerankedBlogs: sortedBlogs,
    };
  } else {
    // If reranker is disabled, use vector search results directly
    if (rules) {
      processedBlogs = await useRulesPostProcessor(
        vectorRanking.recommendations,
        rules
      );
    } else {
      processedBlogs = vectorRanking.recommendations;
    }

    return {
      rerankedBlogs: processedBlogs,
    };
  }
};
