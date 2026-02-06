import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Query OpenAI with a text prompt.
 *
 * @param {string} query - The user input or prompt to send to OpenAI.
 * @returns {Promise<string>} - The text response from OpenAI.
 */
export async function queryOpenAI(query) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please configure it in your .env file.",
    );
  }

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
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

// Example usage (uncomment to test manually):
(async () => {
  const result = await queryOpenAI("Say hello!");
  console.log(result);
})();
