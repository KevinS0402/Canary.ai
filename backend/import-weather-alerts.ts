import { createClient } from "@supabase/supabase-js";

// initializing supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials! Check your .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log(`Found ${alerts.length} historical alerts. Starting import...`);

    // loop through and insert each one into Supabase
    for (const rawText of alerts) {
      // extract the exact UTC timestamp from the NWS WMO header (e.g., "KOHX 210751")
      let issued_at = "2026-01-21T12:00:00Z"; // Fallback timestamp
      const match = rawText.match(/[A-Z]{4} (\d{2})(\d{2})(\d{2})/);
      if (match) {
        issued_at = `2026-01-${match[1]}T${match[2]}:${match[3]}:00Z`;
      }

      const { error } = await supabase.from("weather_alerts").insert({
        wfo: "OHX",
        pil: "WSWOHX",
        raw_text: rawText,
        issued_at: issued_at,
        event_name: "Nashville Snowstorm 2026",
      });

      if (error) {
        console.error(`Error inserting alert:`, error.message);
      } else {
        console.log(`Successfully inserted alert from ${issued_at}`);
      }
    }

    console.log(
      "Historical import complete! Check your Supabase Table Editor.",
    );
  } catch (error) {
    console.error("Failed to fetch from IEM Archive:", error);
  }
}

importNashvilleData();
