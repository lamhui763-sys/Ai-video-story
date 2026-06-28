import fetch from "node-fetch";

async function triggerServer() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const prompt = "第一人称球迷视角，世界杯决赛现场，手持摄像机晃动效果，周围球迷疯狂庆祝，举杯欢呼，烟火表演，真实现场音效氛围";
  
  console.log("Triggering server API...");
  try {
    const res = await fetch("http://localhost:3000/api/generate-video-agnes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: apiKey,
        prompt: prompt
      })
    });

    const data = await res.json() as any;
    console.log("RESPONSE:", JSON.stringify(data));
  } catch(e: any) {
    console.log("ERROR:", e.message);
  }
}

triggerServer().catch(console.error);
