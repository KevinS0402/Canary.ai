import twikit
import json
import asyncio
import traceback
import time
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
dotenv_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path)
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

client = twikit.Client('en-US')
RATE_LIMIT_WINDOW = 15 * 60
RATE_LIMIT_MAX = 50
REQUEST_INTERVAL = RATE_LIMIT_WINDOW / RATE_LIMIT_MAX
query = 'lang:en (Nashville) (emergency OR danger OR road OR traffic OR outage OR disaster OR storm OR blizzard OR ice OR tornado OR warning OR "power outage" OR "schools closed" OR closure OR accident OR stranded) min_retweets:1 since:2026-01-22 until:2026-02-02'

async def main():
    last_request = {'t': 0.0}
    tweets = None

    async def wait_for_slot():
        elapsed = time.time() - last_request['t']
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)

    async def update_database(tweet_list):
        try:
            response = (
                supabase.table("tweets")
                .upsert(tweet_list, on_conflict='tweet_id')
                .execute()
            )
        except Exception as e:
            print("update database failure: ", e)
    
    with open('twikit_cookies.json') as f:
        client.set_cookies(json.load(f))
        for retry in range(RATE_LIMIT_MAX):
            await wait_for_slot()
            tweet_list = []
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
                    page_count += 1
                    tweet_dict = {
                        "tweet_id": tweet.id,
                        "created_at": tweet.created_at_datetime.isoformat(),
                        "author_id": tweet.user.id,
                        "author": tweet.user.screen_name,
                        "url": f'https://x.com/{tweet.user.id}/status/{tweet.id}',
                        "raw_text": tweet.text,
                        "raw_json": str(tweet.__dict__)
                    }
                    tweet_list.append(tweet_dict)
                print(f"fetched {page_count} tweets on retry {retry}")
                if not tweet_list:
                    print("empty page, stopping")
                    break
                await update_database(tweet_list)
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
while True:
    pass

