import OpenAI from "openai";

const genLLM = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const embedLLM = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { genLLM, embedLLM };
