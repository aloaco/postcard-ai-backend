import { useLLMRanking } from "./useLLMRanking.js";
import { useReranker } from "./useReranker.js";
import { useVectorRanking } from "./useVectorRanking.js";

export const getRecommendedBlogs = async (body) => {
  try {
    const {
      preferences,
      searchType,
      model = "google/gemini-2.0-flash-001",
      targetCount = 5,
    } = body;

    switch (searchType) {
      case "vector":
        return useVectorRanking(preferences, useReranker);
      case "llm":
        return useLLMRanking(preferences, model, targetCount);
      case "reranker":
        return useReranker(preferences, model);
      default:
        throw new Error("Invalid search type");
    }
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
