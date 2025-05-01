# Postcard AI Backend

Postcard AI Backend is a Node.js API service that powers the Postcard AI travel recommendation platform. It provides blog content scraping, processing, and AI-driven recommendation services using embeddings and reranking algorithms.

## Features

- **Web Scraping**: Automatically scrapes travel blog content from SLO CAL and other sources
- **Content Processing**: Processes blog content and generates metadata using AI
- **Embedding Generation**: Creates vector embeddings for efficient semantic search
- **Recommendation Engine**: Provides personalized blog recommendations based on user preferences
- **Multiple Ranking Strategies**: Supports vector similarity, LLM-based ranking, and reranking approaches

## Tech Stack

- **Backend Framework**: Node.js with Express
- **Database**: Supabase (PostgreSQL with vector support)
- **AI Models**: 
  - OpenAI for embeddings and content metadata generation
  - Cohere for reranking
- **Data Processing**: Custom scraping and processing services

## API Endpoints

### Blogs API (`/api/blogs`)

- `GET /scrape`: Scrapes travel blog content from configured sources
- `POST /process`: Processes scraped blog content and stores in database
- `POST /recommend`: Returns personalized blog recommendations based on preferences
- `POST /generate-metadata`: Generates content metadata for provided text
- `POST /update-metadata`: Updates metadata and embeddings for all blogs
- `PUT /:postId/modify-embedding`: Modifies embedding for a specific blog post
- `PUT /modify-embedding-text`: Modifies embedding text content

## Getting Started

1. **Clone the repository**:
   ```
   git clone https://github.com/your-username/postcard-ai-backend.git
   cd postcard-ai-backend
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=8080
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   OPENAI_API_KEY=your_openai_api_key
   COHERE_API_KEY=your_cohere_api_key
   ```

4. **Run the development server**:
   ```
   npm run dev
   ```

## Scripts

- `npm start`: Starts the production server
- `npm run dev`: Starts the development server with hot-reloading
- `npm run duplicate-blogs`: Utility script to duplicate blogs for testing
- `npm run delete-duplicate-blogs`: Utility script to clean up duplicate blogs

## Environment Requirements

- Node.js 18+
- npm or yarn
- Supabase account with vector extension enabled
- OpenAI API key
- Cohere API key

## Database Structure

The application uses Supabase with the following main tables:

- `blogs`: Stores blog posts with vector embeddings
- `categories`: Blog categories
- `tags`: Blog tags

## Deployment

The application is configured for deployment on services like Render. The production instance is currently hosted at `https://postcard-ai-backend.onrender.com`.
