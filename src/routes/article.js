import { Router } from "express";
import { scrapeHandler } from "../controllers/article.js";

const router = Router();

router.get("/scrape", scrapeHandler);

export default router;
