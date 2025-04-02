import { Router } from "express";
import {
  scrapeHandler,
  processBlogsHandler,
  getRecommendationsHandler,
  generateContentMetadataHandler,
  updateBlogsMetadataHandler,
  modifyBlogEmbeddingHandler,
  modifyEmbeddingTextHandler,
} from "../controllers/blogs.js";

const router = Router();

router.get("/scrape", scrapeHandler);
router.post("/process", processBlogsHandler);
router.post("/recommend", getRecommendationsHandler);
router.post("/generate-metadata", generateContentMetadataHandler);
router.post("/update-metadata", updateBlogsMetadataHandler);
router.put("/:postId/modify-embedding", modifyBlogEmbeddingHandler);
router.put("/modify-embedding-text", modifyEmbeddingTextHandler);

export default router;
