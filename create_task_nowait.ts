import fetch from "node-fetch";

async function createVideoTask() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const prompt = "第一人称球迷视角，世界杯决赛现场，手持摄像机晃动效果，周围球迷疯狂庆祝，举杯欢呼，烟火表演，真实现场音效氛围";
  
  console.log("Submitting request...");
  try {
    const res = await fetch("https://apihub.agnes-ai.com/v1/videos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "agnes-video-v2.0",
        prompt: prompt,
        num_frames: 121,
        frame_rate: 24
      }),
      timeout: 360000 // 6 minutes
    } as any);

    const data = await res.json() as any;
    console.log("RESPONSE:", JSON.stringify(data));
  } catch(e: any) {
    console.log("ERROR:", e.message);
  }
}

createVideoTask().catch(console.error);
