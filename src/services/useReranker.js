import cohere from "../clients/cohore.js";
import { useVectorRanking } from "./useVectorRanking.js";

export const useReranker = async (preferences, model) => {
  const vectorRanking = await useVectorRanking(preferences);

  let documents = [];

  vectorRanking.recommendations.map((blog) => {
    documents.push(blog.embedding_text);
  });

  const query = JSON.stringify(preferences);

  const response = await cohere.rerank({
    model: "rerank-v3.5",
    query: query,
    documents: documents,
    top_n: 5,
  });

  const rerankedBlogs = response.results.map((result) => {
    return vectorRanking.recommendations[result.index];
  });

  return {
    rerankedBlogs: rerankedBlogs,
    vectorRanking: vectorRanking,
  };
};
