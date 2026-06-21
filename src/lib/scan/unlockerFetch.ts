const LOG_PREFIX = "[scrape]";

/** Bright Data Web Unlocker REST fallback when direct fetch is blocked or composition is missing. */
export async function fetchWithBrightData(url: string): Promise<string | null> {
  const token = process.env.BRIGHT_DATA_TOKEN;
  const zone = process.env.BRIGHT_DATA_ZONE || "buffi_unlocker";

  if (!token) {
    console.log(LOG_PREFIX, "Bright Data token not set, skipping fallback");
    return null;
  }

  try {
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        zone,
        url,
        format: "raw"
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      console.log(LOG_PREFIX, "Bright Data returned non-OK", response.status);
      return null;
    }

    const html = await response.text();
    console.log(LOG_PREFIX, "Bright Data success, html length:", html.length);
    return html;
  } catch (err) {
    console.log(LOG_PREFIX, "Bright Data error:", (err as Error).message);
    return null;
  }
}
