async function testVideo() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const res = await fetch("https://apihub.agnes-ai.com/v1/video/generations", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "agnes-video-v2.0",
        prompt: "A beautiful anime girl sitting in a sunny cozy room, smiling warmly at the camera"
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    console.log("Status:", res.status);
    console.log("Headers:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("Response:", text);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error("Error:", err.message);
  }
}
testVideo();
