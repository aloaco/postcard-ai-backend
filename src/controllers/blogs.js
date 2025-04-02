import { scrapeAllContent } from "../services/scraperService.js";
import { processBlogs } from "../services/blogProcessorService.js";
import { getRecommendedBlogs } from "../services/blogRecommendationService.js";
import { generateContentMetadata } from "../services/llmService.js";
import { supabase } from "../clients/supabase.js";
import { embedLLM } from "../clients/llmClient.js";

export const scrapeHandler = async (req, res) => {
  try {
    console.log("Starting to scrape SLO CAL blog");
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

    if (!limit) {
      return res.status(400).json({
        success: false,
        error: "Limit is required",
      });
    }

    const result = await scrapeAllContent(limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const processBlogsHandler = async (req, res) => {
  try {
    console.log("Starting to process blog files");
    const results = await processBlogs();

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Blog processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getRecommendationsHandler = async (req, res) => {
  try {
    const { activities, exertionLevel, group, priceRange } = req.body;

    // // Basic validation
    // if (!activities || !Array.isArray(activities) || activities.length === 0) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "Activities array is required",
    //   });
    // }

    // const preferences = {
    //   activities,
    //   exertionLevel: parseInt(exertionLevel) || 3,
    //   group: group || "",
    //   priceRange: priceRange || "$$",
    // };

    const results = await getRecommendedBlogs(req.body);

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error getting blog recommendations:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const generateContentMetadataHandler = async (req, res) => {
  try {
    const { content } = req.body;
    const metadata = await generateContentMetadata(content);
    res.json({ success: true, metadata });
  } catch (error) {
    console.error("Error generating content metadata:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const updateBlogsMetadataHandler = async (req, res) => {
  try {
    console.log("Starting to update blogs metadata and embeddings");

    // Get all blogs from the database
    const { data: blogs, error: fetchError } = await supabase
      .from("blogs")
      .select("*");

    if (fetchError) {
      throw fetchError;
    }

    const results = {
      total: blogs.length,
      processed: 0,
      failed: 0,
      errors: [],
    };

    // Process each blog
    for (const blog of blogs) {
      try {
        // Generate content metadata
        const contentMetadata = await generateContentMetadata(
          blog.main_content
        );

        // Create text for embedding (combine title, summary, and content metadata)
        const textToEmbed = JSON.stringify({
          title: blog.title,
          summary: blog.summary,
          publishDate: blog.publish_date,
          categories: blog.categories.map((c) => c.name),
          tags: blog.tags.map((t) => t.name),
          contentMetadata,
        });

        // Generate new embedding
        const embeddingResponse = await embedLLM.embeddings.create({
          model: "text-embedding-3-small",
          input: textToEmbed,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Update the blog in the database
        const { error: updateError } = await supabase
          .from("blogs")
          .update({
            content_metadata: contentMetadata,
            embedding_text: textToEmbed,
            embedding: embedding,
          })
          .eq("post_id", blog.post_id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Successfully processed blog: ${blog.title}`);
        results.processed++;
      } catch (error) {
        console.error(`Error processing blog ${blog.title}:`, error);
        results.failed++;
        results.errors.push({
          post_id: blog.post_id,
          title: blog.title,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error updating blogs metadata:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const modifyBlogEmbeddingHandler = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({
        success: false,
        error: "Post ID is required",
      });
    }

    // First, check if the blog exists
    const { data: existingBlog, error: fetchError } = await supabase
      .from("blogs")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError) {
      console.error("Error fetching blog:", fetchError);
      return res.status(404).json({
        success: false,
        error: "Blog not found",
        details: fetchError.message,
      });
    }

    console.log("Found blog:", existingBlog);

    // Create a simple test embedding with just "ice fishing"
    const textToEmbed = `{"activities": "ice fishing" }`;

    // Generate new embedding
    const embeddingResponse = await embedLLM.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update the blog in the database
    const { data: updatedBlog, error: updateError } = await supabase
      .from("blogs")
      .update({
        embedding_text: textToEmbed,
        embedding: embedding,
      })
      .eq("id", postId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating blog:", updateError);
      throw updateError;
    }

    console.log("Updated blog:", updatedBlog);

    res.json({
      success: true,
      message: `Successfully modified embedding for blog ${postId}`,
      blog: updatedBlog,
      embedding_text: textToEmbed,
    });
  } catch (error) {
    console.error("Error modifying blog embedding:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const modifyEmbeddingTextHandler = async (req, res) => {
  try {
    console.log(
      "Starting to modify embedding text and update embeddings for all blogs"
    );

    // Get all blogs from the database
    const { data: blogs, error: fetchError } = await supabase
      .from("blogs")
      .select("*");

    if (fetchError) {
      throw fetchError;
    }

    const results = {
      total: blogs.length,
      processed: 0,
      failed: 0,
      errors: [],
    };

    // Process each blog
    for (const blog of blogs) {
      try {
        // Parse the existing embedding_text
        const parsedEmbeddingText = JSON.parse(blog.embedding_text);

        // Keep only the contentMetadata field
        const modifiedEmbeddingText = JSON.stringify(
          parsedEmbeddingText.contentMetadata
        );

        // Generate new embedding
        const embeddingResponse = await embedLLM.embeddings.create({
          model: "text-embedding-3-small",
          input: modifiedEmbeddingText,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Update the blog in the database with both the modified text and new embedding
        const { error: updateError } = await supabase
          .from("blogs")
          .update({
            embedding_text: modifiedEmbeddingText,
            embedding: embedding,
          })
          .eq("post_id", blog.post_id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Successfully processed blog: ${blog.title}`);
        results.processed++;
      } catch (error) {
        console.error(`Error processing blog ${blog.title}:`, error);
        results.failed++;
        results.errors.push({
          post_id: blog.post_id,
          title: blog.title,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error modifying blog embeddings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
