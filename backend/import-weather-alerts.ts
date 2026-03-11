import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// created a speed bump to ensure we're not going over the limit
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// initializing supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
  throw new Error("Missing credentials! Check your .env file.");
}

// initializing supabase and gemini
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiKey);
// We use the 'flash' model because it is incredibly fast and cheap for text tasks
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

async function importNashvilleData() {
  console.log("Fetching historical winter storm data for Nashville...");

  // using the historical archive endpoint instead of the recent list cache
  const archiveUrl =
    "https://mesonet.agron.iastate.edu/cgi-bin/afos/retrieve.py?limit=9999&pil=WSWOHX&fmt=text&sdate=2026-01-20&edate=2026-01-28";

  try {
    const response = await fetch(archiveUrl);
    const rawBulkText = await response.text();

    // historical NWS text dumps are separated by a Control-C (\x03) character
    const alerts = rawBulkText
      .split("\x03")
      .map((alert) => alert.trim())
      .filter((alert) => alert.length > 50); // filter out empty strings/errors

    if (alerts.length === 0) {
      console.log("No historical alerts found.");
      return;
    }

    console.log(
      `Found ${alerts.length} historical alerts. Starting AI summarization and import...`,
    );

    // loop through and insert each one into Supabase
    for (const rawText of alerts) {
      let issued_at = "2026-01-21T12:00:00Z";
      const match = rawText.match(/[A-Z]{4} (\d{2})(\d{2})(\d{2})/);
      if (match) {
        issued_at = `2026-01-${match[1]}T${match[2]}:${match[3]}:00Z`;
      }

      // --- NEW Gemini AI Step (for summaries) ---
      console.log(`Generating summary for alert issued at ${issued_at}...`);
      let aiSummary = "Summary unavailable.";
      let retries = 3;

      while (retries > 0) {
        try {
          const prompt = `
            You are a helpful meteorologist for a consumer weather app. 
            Read the following raw National Weather Service bulletin and summarize the most important 
            threats and timing in 1 to 2 short, easy-to-read sentences. Do not use technical jargon.
            
            Raw Bulletin:
            ${rawText}
          `;
          const result = await model.generateContent(prompt);
          aiSummary = result.response.text().trim();
          break; // Success! Break out of the retry loop.
        } catch (aiError: any) {
          if (aiError.status === 503) {
            console.warn(
              `⚠️ Server busy (503). Retries left: ${retries - 1}. Waiting 10 seconds to retry...`,
            );
            await delay(10000); // Wait 10 seconds before knocking on the door again
            retries--;
          } else {
            console.error(
              "Gemini API failed with a different error:",
              aiError.message,
            );
            break; // If it is a different error (like a safety block), give up and move on
          }
        }
      }

      const { error } = await supabase.from("weather_alerts").insert({
        wfo: "OHX",
        pil: "WSWOHX",
        raw_text: rawText,
        summary: aiSummary,
        issued_at: issued_at,
        event_name: "Nashville Snowstorm 2026",
      });

      if (error) {
        console.error(`Error inserting alert:`, error.message);
      } else {
        console.log(
          `Successfully inserted alert from ${issued_at} with AI summary!`,
        );
      }

      // wait before requesting the AI summary for the next one
      console.log("Waiting 15 seconds to respect Gemini API rate limits...");
      await delay(15000);
    }

    console.log(
      "Historical import complete! Check your Supabase Table Editor.",
    );
  } catch (error) {
    console.error("Failed to fetch from IEM Archive:", error);
  }
}

importNashvilleData();
