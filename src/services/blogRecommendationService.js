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
      rules = null,
      rerankerEnabled = false,
    } = body;

    switch (searchType) {
      case "vector":
        return useVectorRanking(preferences, targetCount);
      case "llm":
        return useLLMRanking(preferences, model, targetCount);
      case "reranker":
        return useReranker(preferences, targetCount, rules, rerankerEnabled);
      default:
        throw new Error("Invalid search type");
    }
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    throw error;
  }
};
