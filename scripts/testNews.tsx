import fs from "fs";
import { radioBrowserService, StationFilter } from "./radioBrowserService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import dotenv from "dotenv";
dotenv.config({ path: "../backend/.env" });

// initialize Gemini
const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * helper to record a live audio stream to a file for X seconds
 */
async function recordStreamChunk(
  url: string,
  outputPath: string,
  durationMs: number,
): Promise<void> {
  console.log(`Tuning in to: ${url}`);
  console.log(`Recording ${durationMs / 1000} seconds of live audio...`);

  const response = await fetch(url);
  if (!response.body) throw new Error("Could not connect to stream.");

  const fileStream = fs.createWriteStream(outputPath);
  const reader = response.body.getReader();

  return new Promise((resolve, reject) => {
    // stop recording after  duration is up
    const timeout = setTimeout(() => {
      console.log("Recording finished.");
      fileStream.close();
      resolve();
    }, durationMs);

    // read the live stream and pipe it to file
    async function pump() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(value);
        }
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    }
    pump();
  });
}

/**
 * Main execution
 */
(async () => {
  try {
    // find a news/talk station (Using Nashville or a general news tag as an example)
    console.log("Searching for a station...");
    const filter: StationFilter = {
      by: "name",
      searchterm: "WPLN", // Nashville's local NPR/News station
      limit: 1,
    };
    const stations = await radioBrowserService.getStations(filter);

    if (stations.length === 0) {
      console.log("No stations found.");
      return;
    }

    const station = stations[0];
    const streamUrl = radioBrowserService.getStreamUrl(station);
    console.log(`Found station: ${station.name}`);

    // record 15 seconds of the live stream
    const tempAudioPath = "./temp_broadcast.mp3";
    await recordStreamChunk(streamUrl, tempAudioPath, 15000); // 15 seconds

    // upload the recorded chunk to Gemini
    console.log("Uploading audio to Gemini...");
    const uploadResult = await fileManager.uploadFile(tempAudioPath, {
      mimeType: "audio/mp3",
      displayName: "Live Radio Chunk",
    });

    // ask Gemini to summarize what it heard
    console.log("Generating summary...");
    const prompt = `You are an emergency weather and news assistant. 
    Listen to this short clip from a live radio broadcast. 
    Provide a 1-sentence summary of the main topic being discussed. 
    If it's just music, ads, or dead air, reply with 'No actionable news at the moment.'`;

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      { text: prompt },
    ]);

    console.log("\n==================================");
    console.log(`STATION: ${station.name}`);
    console.log(`GEMINI SUMMARY: ${result.response.text()}`);
    console.log("==================================\n");

    // clean up the temporary audio file
    fs.unlinkSync(tempAudioPath);
  } catch (error) {
    console.error("Error in radio pipeline:", error);
  }
})();
