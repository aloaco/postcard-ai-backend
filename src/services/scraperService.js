import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { generateSummary } from "./llmService.js";

// Utility functions
const extractIdFromUrl = (url) => {
  const matches = url.match(/\/([^\/]+)\/$/);
  return matches ? matches[1] : null;
};

const cleanText = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

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

// Core scraping functions
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

    // Extract main content
    const mainContent = extractMainContent($);

    // Generate summary using LLM
    const summary = await generateSummary(mainContent);

    // Construct the blog post object
    return {
      postId,
      title: $("h1.title").text().trim(),
      slug,
      url: `https://www.slocal.com/blog/post/${slug}/`,
      publishDate: new Date($("time[datetime]").attr("datetime")),
      featuredImage,
      author,
      content: $(".post-content").html(),
      mainContent,
      summary: summary || $(".post-content p").first().text().trim(), // Fallback to first paragraph if LLM fails
      categories,
      tags,
    };
  } catch (error) {
    console.error(`Error scraping blog post ${url}:`, error.message);
    return null;
  }
};

const scrapeCategoryPage = async (url, baseUrl, page = 1) => {
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

// Main service functions
export const scrapeAllContent = async (limit) => {
  const baseUrl = "https://www.slocal.com";
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
        baseUrl,
        currentPage
      );

      blogUrls.forEach((url) => allBlogUrls.add(url));
      hasNextPage = hasMore;
      currentPage++;

      // Break if we've reached the limit
      if (limit && allBlogUrls.size >= limit) {
        hasNextPage = false;
        break;
      }
    }

    // Break category loop if we've reached the limit
    if (limit && allBlogUrls.size >= limit) {
      break;
    }
  }

  // Create output directory
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

      // Break if we've reached the limit
      if (limit && scrapedPosts.length >= limit) {
        break;
      }
    }
  }

  // Save all blog posts to a single file
  const allPostsPath = path.join(outputDir, "all-posts.json");
  await fs.writeFile(allPostsPath, JSON.stringify(scrapedPosts, null, 2));

  return {
    categoryUrls: Array.from(categoryUrls),
    blogUrls: Array.from(allBlogUrls),
    totalBlogs: allBlogUrls.size,
    scrapedPosts: scrapedPosts.length,
    outputDirectory: outputDir,
    limit: limit || "none",
  };
};
