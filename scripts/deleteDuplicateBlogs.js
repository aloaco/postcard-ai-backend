// Load environment variables first
import "dotenv/config";
// Then import the service that uses them
import { deleteDuplicateBlogs } from "../src/services/blogDuplicatorService.js";

const run = async () => {
  console.log("Starting duplicate blog deletion process...");

  try {
    const result = await deleteDuplicateBlogs();

    console.log("Blog deletion completed:");
    console.log(`Blogs deleted: ${result.deletedCount}`);

    if (result.status === "error") {
      console.error("Error occurred:", result.message);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error("Unhandled error during blog deletion:", error);
    process.exit(1);
  }
};

run();
