// Load environment variables first
import "dotenv/config";
// Then import the service that uses them
import { duplicateBlogs } from "../src/services/blogDuplicatorService.js";

const run = async () => {
  console.log("Starting blog duplication process...");

  try {
    const result = await duplicateBlogs();

    console.log("Blog duplication completed:");
    console.log(`Original blog count: ${result.originalCount}`);
    console.log(`Blogs duplicated: ${result.duplicatedCount}`);
    console.log(`Final blog count: ${result.finalCount}`);

    if (result.status === "error") {
      console.error("Error occurred:", result.message);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error("Unhandled error during blog duplication:", error);
    process.exit(1);
  }
};

run();
