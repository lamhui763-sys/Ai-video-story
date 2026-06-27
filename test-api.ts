async function test() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  try {
    const res = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "agnes-video-v2.0",
        prompt: "a majestic golden dragon flying over mountains, high quality, 3D render",
        n: 1,
        size: "1024x1024" // standard size
      })
    });
    const data = await res.json();
    console.log("Generations response status:", res.status);
    console.log("Generations response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error generating:", err);
  }
}
test();
