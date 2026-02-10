import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import OpenAI from "openai";

// Gemini configuration
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const geminiModelName = process.env.GEMINI_MODEL || "gemini-pro-latest";

// OpenAI configuration
const openaiApiKey = process.env.OPENAI_API_KEY;

// Arli configuration
const arliApiKey = process.env.ARLI_API_KEY;
const arliModelName = process.env.ARLI_MODEL || "Gemma-3-27B-ArliAI-RPMax-v3";

/**
 * Query Gemini with a text prompt.
 *
 * @param {string} query - The user input or prompt to send to Gemini.
 * @returns {Promise<string>} - The text response from Gemini.
 */
export async function queryGemini(query) {
  if (!geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please configure it in your .env file.",
    );
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: geminiModelName });
  const result = await model.generateContent(query);

  const text = result?.response?.text?.();
  if (!text) {
    throw new Error("No response content returned from Gemini.");
  }

  return text;
}

/**
 * Query Arli with a text prompt.
 *
 * @param {string} query - The user input or prompt to send to Arli.
 * @returns {Promise<string>} - The text response from Arli.
 */
export async function queryArli(query) {
  if (!arliApiKey) {
    throw new Error(
      "ARLI_API_KEY is not set. Please configure it in your .env file.",
    );
  }

  const response = await fetch("https://api.arliai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${arliApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: arliModelName,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: query },
      ],
      repetition_penalty: 1.1,
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      max_completion_tokens: 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Arli API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message?.content;

  if (!message) {
    throw new Error("No response content returned from Arli.");
  }

  return message;
}

/**
 * Query OpenAI with a text prompt.
 *
 * @param {string} query - The user input or prompt to send to OpenAI.
 * @returns {Promise<string>} - The text response from OpenAI.
 */
export async function queryOpenAI(query) {
  if (!openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please configure it in your .env file.",
    );
  }

  const client = new OpenAI({
    apiKey: openaiApiKey,
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
  });

  const message = response.choices?.[0]?.message?.content;
  if (!message) {
    throw new Error("No response content returned from OpenAI.");
  }

  return message;
}

/**
 * General query method that queries the default provider (Gemini).
 *
 * @param {string} query - The user input or prompt to send to the LLM.
 * @returns {Promise<string>} - The text response from the LLM.
 */
export async function query(query) {
  return queryGemini(query);
}

(async () => {
  const result = await queryArli("Say hello!");
  console.log(result);
})();
