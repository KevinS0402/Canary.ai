import twikit
import json
import asyncio
import traceback
import time
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# setup environment & supabase
dotenv_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# setting up Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel(
    model_name='gemini-3-flash-preview',
    safety_settings={
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    }
)

# twikit config
client = twikit.Client('en-US')
RATE_LIMIT_WINDOW = 15 * 60
RATE_LIMIT_MAX = 50
REQUEST_INTERVAL = RATE_LIMIT_WINDOW / RATE_LIMIT_MAX
query = 'lang:en (Nashville) (emergency OR danger OR road OR traffic OR outage OR disaster OR storm OR blizzard OR ice OR tornado OR warning OR "power outage" OR "schools closed" OR closure OR accident OR stranded) min_retweets:1 since:2026-01-22 until:2026-02-02'

# --- TEST LIMIT TO SAVE QUOTA ---
TEST_LIMIT = 2 

# AI summarizer helper
async def get_ai_summary(text: str) -> str:
    if not text or len(text) < 15:
        return "Post too short to summarize."
    
    prompt = f"""You are an emergency response assistant for a weather app. 
Read this social media post about a Nashville storm/emergency. 
Summarize the core threat, damage, or actionable info. Do not leave out any important details 
that would be relevant to the reader (who is currently in the affected region).
If it's just irrelevant chatter or opinions, reply with "No actionable emergency info."

Post: "{text}"
"""
    retries = 3
    while retries > 0:
        try:
            response = await model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            error_msg = str(e).lower()
            if "503" in error_msg or "timed out" in error_msg or "deadline" in error_msg:
                print(f"Server busy. Retries left: {retries - 1}. Waiting 10s...")
                await asyncio.sleep(10)
                retries -= 1
            elif "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg:
                print("Daily API Quota Exceeded! Returning fallback text.")
                return "Summary unavailable (Rate Limit)."
            else:
                print(f"Gemini API error: {e}")
                return "Summary unavailable."
                
    return "Summary unavailable (Timeout)."

# main loop
async def main():
    last_request = {'t': 0.0}
    tweets = None

    async def wait_for_slot():
        elapsed = time.time() - last_request['t']
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)

    async def update_database(tweet_list):
        if not tweet_list: return
        try:
            print(f"Upserting {len(tweet_list)} rows to Supabase...")
            response = (
                supabase.table("tweets")
                .upsert(tweet_list, on_conflict='tweet_id')
                .execute()
            )
            print("Upsert ok!")
        except Exception as e:
            print("update database failure: ", e)
    
    with open('twikit_cookies.json') as f:
        client.set_cookies(json.load(f))
        
        for retry in range(RATE_LIMIT_MAX):
            await wait_for_slot()
            tweet_list = []
            processed_this_run = 0
            print("retrying request: ", retry)
            
            try:
                last_request['t'] = time.time()
                if tweets is None:
                    tweets = await client.search_tweet(query, 'Top')
                else:
                    next_page = await tweets.next()
                    if not next_page:
                        print("no more pages returned from twikit, stopping pagination")
                        break
                    tweets = next_page
                
                page_count = 0
                for tweet in tweets:
                    # enforce the test limit so we don't drain the API quota
                    if processed_this_run >= TEST_LIMIT:
                        print(f"Reached TEST_LIMIT of {TEST_LIMIT}. Stopping to save API quota.")
                        break

                    page_count += 1
                    print(f"Summarizing tweet by {tweet.user.screen_name}...")
                    
                    # call Gemini here
                    summary = await get_ai_summary(tweet.text)
                    print(f"-> Gemini generated: \"{summary}\"")
                    
                    tweet_dict = {
                        "tweet_id": tweet.id,
                        "created_at": tweet.created_at_datetime.isoformat(),
                        "author_id": tweet.user.id,
                        "author": tweet.user.screen_name,
                        "url": f'https://x.com/{tweet.user.id}/status/{tweet.id}',
                        "raw_text": tweet.text,
                        "raw_json": str(tweet.__dict__),
                        "summary": summary
                    }
                    tweet_list.append(tweet_dict)
                    processed_this_run += 1
                    
                    # 15-second speed bump
                    print("Waiting 15s to respect rate limits...")
                    await asyncio.sleep(15)

                print(f"fetched and summarized {len(tweet_list)} tweets on retry {retry}")
                
                if not tweet_list:
                    print("empty page, stopping")
                    break
                    
                await update_database(tweet_list)
                
                # if we hit our limit, break entirely out of the pagination loop
                if processed_this_run >= TEST_LIMIT:
                    break

            except Exception as e:
                status = getattr(e, "status", None)
                msg = getattr(e, "message", "") or ""
                is_404 = status == 404 or "404" in msg or "404" in repr(e)
                if is_404:
                    print("request failed expectedly")
                    continue
                print(e)
                traceback.print_exc()

asyncio.run(main())