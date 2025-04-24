import { supabase } from "../clients/supabase.js";

/**
 * Service to duplicate blogs in the database until we reach 2500 records
 * Each duplicated blog will have the isDuplicate flag set to true
 */
export const duplicateBlogs = async () => {
  try {
    // First, get the current count of blogs
    const { count: currentCount, error: countError } = await supabase
      .from("blogs")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    console.log(`Current blog count: ${currentCount}`);

    // If we already have 2500 or more blogs, no need to duplicate
    if (currentCount >= 2500) {
      console.log("Already have 2500 or more blogs. No duplication needed.");
      return {
        status: "success",
        message: "Already have 2500 or more blogs. No duplication needed.",
        originalCount: currentCount,
        duplicatedCount: 0,
        finalCount: currentCount,
      };
    }

    // Fetch all existing blogs
    const { data: existingBlogs, error: fetchError } = await supabase
      .from("blogs")
      .select("*");

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Fetched ${existingBlogs.length} existing blogs`);

    // Calculate how many blogs we need to duplicate
    const blogsNeeded = 2500 - currentCount;
    console.log(`Need to duplicate ${blogsNeeded} blogs`);

    // Prepare duplicated blogs
    const duplicatedBlogs = [];
    let duplicatedCount = 0;

    // Continue duplicating until we reach the target
    while (duplicatedCount < blogsNeeded) {
      // Use modulo to cycle through existing blogs if we need more duplicates than original blogs
      const sourceBlog = existingBlogs[duplicatedCount % existingBlogs.length];

      // Create a duplicate with isDuplicate flag - completely remove id field
      const duplicateBlog = { ...sourceBlog };
      // Delete the id instead of setting to undefined
      delete duplicateBlog.id;
      // Add isDuplicate flag
      duplicateBlog.is_duplicate = true;
      // Modify the title to indicate it's a duplicate
      duplicateBlog.title = `[DUPLICATE] ${sourceBlog.title}`;

      duplicatedBlogs.push(duplicateBlog);
      duplicatedCount++;

      // Insert in batches of 100 to avoid potential issues with large insertions
      if (duplicatedBlogs.length === 100 || duplicatedCount === blogsNeeded) {
        const { error: insertError } = await supabase
          .from("blogs")
          .insert(duplicatedBlogs);

        if (insertError) {
          throw insertError;
        }

        console.log(
          `Inserted batch of ${duplicatedBlogs.length} duplicated blogs`
        );
        // Clear the array for next batch
        duplicatedBlogs.length = 0;
      }
    }

    // Get final count
    const { count: finalCount, error: finalCountError } = await supabase
      .from("blogs")
      .select("*", { count: "exact", head: true });

    if (finalCountError) {
      throw finalCountError;
    }

    return {
      status: "success",
      message: `Successfully duplicated ${duplicatedCount} blogs`,
      originalCount: currentCount,
      duplicatedCount,
      finalCount,
    };
  } catch (error) {
    console.error("Error duplicating blogs:", error);
    return {
      status: "error",
      message: error.message,
      error,
    };
  }
};

/**
 * Service to delete all duplicated blogs from the database
 * Removes all blogs with is_duplicate flag set to true
 */
export const deleteDuplicateBlogs = async () => {
  try {
    // First, count how many duplicate blogs exist
    const { count: duplicateCount, error: countError } = await supabase
      .from("blogs")
      .select("*", { count: "exact", head: true })
      .eq("is_duplicate", true);

    if (countError) {
      throw countError;
    }

    console.log(`Found ${duplicateCount} duplicate blogs to delete`);

    if (duplicateCount === 0) {
      return {
        status: "success",
        message: "No duplicate blogs found to delete",
        deletedCount: 0,
      };
    }

    // Delete all duplicate blogs
    const { error: deleteError } = await supabase
      .from("blogs")
      .delete()
      .eq("is_duplicate", true);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Successfully deleted ${duplicateCount} duplicate blogs`);

    return {
      status: "success",
      message: `Successfully deleted ${duplicateCount} duplicate blogs`,
      deletedCount: duplicateCount,
    };
  } catch (error) {
    console.error("Error deleting duplicate blogs:", error);
    return {
      status: "error",
      message: error.message,
      error,
    };
  }
};
