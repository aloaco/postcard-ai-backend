import { Router } from "express";
import articleRoutes from "./article.js";
const router = Router();
router.use("/article", articleRoutes);
export default router;
