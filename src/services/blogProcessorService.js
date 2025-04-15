import { embedLLM } from "../clients/llmClient.js";
import { supabase } from "../clients/supabase.js";
import { generateContentMetadata } from "../services/llmService.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const processBlogs = async () => {
  try {
    // Read all JSON files from the blog data directory in user's home directory
    const blogDataDir = path.join(os.homedir(), "slocal-blog-data");
    const files = await fs.readdir(blogDataDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    console.log(`Found ${jsonFiles.length} blog files to process`);

    const results = {
      total: jsonFiles.length,
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(blogDataDir, file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const blogData = JSON.parse(fileContent);

        // Extract required fields
        const {
          postId,
          title,
          slug,
          publishDate,
          featuredImage,
          author,
          content,
          mainContent,
          summary,
          categories,
          tags,
          url,
        } = blogData;

        // Generate content metadata
        const contentMetadata = await generateContentMetadata(mainContent);

        // Create a string representation for embedding
        const textToEmbed = JSON.stringify({
          contentMetadata,
        });

        // Generate embedding
        const embeddingResponse = await embedLLM.embeddings.create({
          model: "text-embedding-3-small",
          input: textToEmbed,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Store in Supabase
        const { error } = await supabase.from("blogs").insert({
          post_id: postId,
          title,
          slug,
          url,
          publish_date: publishDate,
          featured_image: featuredImage,
          author,
          content,
          main_content: mainContent,
          summary,
          categories,
          tags,
          content_metadata: contentMetadata,
          embedding,
          embedding_text: textToEmbed,
        });

        if (error) {
          throw error;
        }

        console.log(`Successfully processed ${file}`);
        results.processed++;
      } catch (error) {
        console.error(`Error processing blog file ${file}:`, error);
        results.failed++;
        results.errors.push({
          file,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error in blog processing service:", error);
    throw error;
  }
};
