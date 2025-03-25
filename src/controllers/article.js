import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Function to extract ID from URL
const extractIdFromUrl = (url) => {
  const matches = url.match(/\/([^\/]+)\/$/);
  return matches ? matches[1] : null;
};

// Function to clean HTML and get text content
const cleanText = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Function to extract and structure main content
const extractMainContent = ($) => {
  const $postContent = $(".post-content");

  // Remove unwanted elements
  $postContent
    .find("script, style, iframe, .advertisement, .social-share")
    .remove();

  let content = "";

  // Process each content element
  $postContent.find("h3, h5, p, li").each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();
    const text = cleanText($el.html());

    if (!text) return;

    // Add appropriate spacing based on element type
    switch (tagName) {
      case "h3":
        content += `\n\n${text}\n\n`;
        break;
      case "h5":
        content += `\n\n${text}\n\n`;
        break;
      case "p":
        content += `${text}\n\n`;
        break;
      case "li":
        // Check if this is part of a list
        const $parent = $el.parent();
        if ($parent.is("ul, ol")) {
          content += `• ${text}\n`;
        } else {
          content += `${text}\n\n`;
        }
        break;
    }
  });

  // Clean up extra whitespace and return
  return content.replace(/\n{3,}/g, "\n\n").trim();
};

// Function to scrape a single blog post
const scrapeBlogPost = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract post ID and slug from URL
    const postId = extractIdFromUrl(url);
    const slug = url.split("/").slice(-2)[0];

    // Extract featured image
    const featuredImage = {
      url: $(".simple-image img").attr("src") || "",
      alt: $(".simple-image img").attr("alt") || "",
    };

    // Extract author information
    const author = {
      name: $(".author-by-line a").text().trim() || "",
      profileUrl: $(".author-by-line a").attr("href") || "",
    };

    // Extract categories
    const categories = [];
    $(".post-categories a").each((_, element) => {
      const $el = $(element);
      categories.push({
        name: $el.text().trim(),
        id: extractIdFromUrl($el.attr("href")),
        url: $el.attr("href"),
      });
    });

    // Extract tags
    const tags = [];
    $(".post-tags a").each((_, element) => {
      const $el = $(element);
      tags.push({
        name: $el.text().trim(),
        id: extractIdFromUrl($el.attr("href")),
        url: $el.attr("href"),
      });
    });

    // Extract related posts
    const relatedPosts = [];
    $(".related-item").each((_, element) => {
      const $el = $(element);
      relatedPosts.push({
        title: $el.find(".title").text().trim(),
        url: $el.find("a").attr("href"),
        imageUrl: $el.find("img").attr("src"),
      });
    });

    // Extract navigation
    const previousPost = {
      title: $(".prev-post .title").text().trim() || "",
      url: $(".prev-post a").attr("href") || "",
    };

    const nextPost = {
      title: $(".next-post .title").text().trim() || "",
      url: $(".next-post a").attr("href") || "",
    };

    // Extract main content
    const mainContent = extractMainContent($);

    // Construct the blog post object
    const blogPost = {
      postId,
      title: $("h1.title").text().trim(),
      slug,
      publishDate: new Date($("time[datetime]").attr("datetime")),
      featuredImage,
      author,
      content: $(".post-content").html(),
      mainContent,
      summary: $(".post-content p").first().text().trim(),
      categories,
      tags,
      relatedPosts,
      previousPost,
      nextPost,
    };

    return blogPost;
  } catch (error) {
    console.error(`Error scraping blog post ${url}:`, error.message);
    return null;
  }
};

export const scrapeHandler = async (req, res) => {
  try {
    console.log("Starting to scrape SLO CAL blog");

    const baseUrl = "https://www.slocal.com";

    // Fetch the main blog page
    const mainPageUrl = "https://www.slocal.com/blog/";
    const mainPageResponse = await axios.get(mainPageUrl);
    const $ = cheerio.load(mainPageResponse.data);

    // Extract category URLs from the primary navigation list only
    const categoryUrls = new Set();
    $(".custom-navbar .primary-list a").each((_, element) => {
      const href = $(element).attr("href");
      if (href && href.includes("/blog/all-posts/category/")) {
        categoryUrls.add(href);
      }
    });

    console.log("Found category URLs:", Array.from(categoryUrls));

    // Function to scrape a single category page
    const scrapeCategoryPage = async (url, page = 1) => {
      const pageUrl = page === 1 ? url : `${url}?&page=${page}`;
      const response = await axios.get(pageUrl);
      const $ = cheerio.load(response.data);

      // Collect blog URLs from current page
      const blogUrls = new Set();
      $(".blog-post a").each((_, element) => {
        const href = $(element).attr("href");
        if (href) {
          // Add base URL if the href is a relative path
          const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
          // Only add URLs that are actual blog posts
          if (fullUrl.includes("/blog/post/")) {
            blogUrls.add(fullUrl);
          }
        }
      });

      // Check for next page
      const hasNextPage = $(".paging-button .next-link").length > 0;

      return {
        blogUrls: Array.from(blogUrls),
        hasNextPage,
      };
    };

    // Scrape all pages for each category
    const allBlogUrls = new Set();
    for (const categoryUrl of categoryUrls) {
      console.log(`Scraping category: ${categoryUrl}`);
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        console.log(`Scraping page ${currentPage}`);
        const { blogUrls, hasNextPage: hasMore } = await scrapeCategoryPage(
          categoryUrl,
          currentPage
        );

        // Add blog URLs to the set
        blogUrls.forEach((url) => allBlogUrls.add(url));

        hasNextPage = hasMore;
        currentPage++;
      }
    }

    console.log(`Total unique blog URLs found: ${allBlogUrls.size}`);

    // Create a directory for storing blog posts in the user's home directory
    const outputDir = path.join(os.homedir(), "slocal-blog-data");
    await fs.mkdir(outputDir, { recursive: true });

    // Scrape and save each blog post
    const scrapedPosts = [];
    for (const blogUrl of allBlogUrls) {
      console.log(`Scraping blog post: ${blogUrl}`);
      const blogPost = await scrapeBlogPost(blogUrl);
      if (blogPost) {
        scrapedPosts.push(blogPost);

        // Save individual blog post to a file
        const fileName = `${blogPost.slug}.json`;
        const filePath = path.join(outputDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(blogPost, null, 2));
      }
    }

    // Save all blog posts to a single file
    const allPostsPath = path.join(outputDir, "all-posts.json");
    await fs.writeFile(allPostsPath, JSON.stringify(scrapedPosts, null, 2));

    res.json({
      success: true,
      categoryUrls: Array.from(categoryUrls),
      blogUrls: Array.from(allBlogUrls),
      totalBlogs: allBlogUrls.size,
      scrapedPosts: scrapedPosts.length,
      outputDirectory: outputDir,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
