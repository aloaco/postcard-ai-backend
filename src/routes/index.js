import { Router } from "express";
import blogRoutes from "./blogs.js";

const router = Router();
router.use("/blogs", blogRoutes);

export default router;
