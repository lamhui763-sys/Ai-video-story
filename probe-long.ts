import * as fs from "fs";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync("probe.log", line);
  console.log(msg);
}

async function probeLong() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const url = "https://apihub.agnes-ai.com/v1/video/generations";
  
  log("Sending POST request (180s timeout) to: " + url);
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 180s timeout
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "agnes-video-v2.0",
        prompt: "a majestic golden dragon flying over mountains, high quality, 3D render"
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Success in ${duration}s! Status: ${res.status}`);
    const body = await res.text();
    log("Body: " + body);
  } catch (err: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Failed after ${duration}s: ${err.name === "AbortError" ? "Timeout" : err.message}`);
  }
}

probeLong();
