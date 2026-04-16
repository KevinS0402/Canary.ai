import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

// speed bump
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// initializing supabase and claude
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey || !anthropicKey) {
  throw new Error("Missing credentials! Check your .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

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
      `Found ${alerts.length} historical alerts. Starting Claude summarization and import...`,
    );

    // loop through and insert each one into Supabase
    for (const rawText of alerts) {
      let issued_at = "2026-01-21T12:00:00Z";
      const match = rawText.match(/[A-Z]{4} (\d{2})(\d{2})(\d{2})/);
      if (match) {
        issued_at = `2026-01-${match[1]}T${match[2]}:${match[3]}:00Z`;
      }

      // Claude for summaries
      console.log(`Generating summary for alert issued at ${issued_at}...`);
      let aiSummary = "Summary unavailable.";
      let retries = 3;

      while (retries > 0) {
        try {
          const claudeResponse = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 250,
            system:
              "You are a helpful meteorologist for a consumer weather app. Read the following raw National Weather Service bulletin and summarize the most important threats and timing. Do not skip out on important details that would be relevant to the reader (who is currently in the affected region). Do not use technical jargon.",
            messages: [{ role: "user", content: `Raw Bulletin:\n${rawText}` }],
          });

          aiSummary =
            claudeResponse.content[0].type === "text"
              ? claudeResponse.content[0].text
              : "Summary unavailable.";
          break; // if success, break out of the retry loop.
        } catch (aiError: any) {
          // claude throws 529 for overloaded or 429 for rate limits
          if (
            aiError.status === 529 ||
            aiError.status === 429 ||
            aiError.status === 503
          ) {
            console.warn(
              `Server busy or rate limited (${aiError.status}). Retries left: ${retries - 1}. Waiting 10 seconds to retry...`,
            );
            await delay(10000); // Wait 10 seconds
            retries--;
          } else {
            console.error(
              "Claude API failed with a different error:",
              aiError.message,
            );
            break; // if it's a different error, move to next
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
          `Successfully inserted alert from ${issued_at} with Claude summary!`,
        );
      }

      // wait before requesting AI summary for next alert
      console.log("Waiting 3 seconds to respect Anthropic API rate limits...");
      await delay(3000);
    }

    console.log(
      "Historical import complete! Check your Supabase Table Editor.",
    );
  } catch (error) {
    console.error("Failed to fetch from IEM Archive:", error);
  }
}

importNashvilleData();
