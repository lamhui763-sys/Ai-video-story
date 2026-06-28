import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function generateVideo() {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    console.error("AGNES_API_KEY is not set in .env");
    return;
  }

  const prompt = "第一人称球迷视角，世界杯决赛现场，手持摄像机晃动效果，周围球迷疯狂庆祝，举杯欢呼，烟火表演，真实现场音效氛围";
  console.log("Submitting video generation request with prompt:", prompt);

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
    })
  });

  if (!res.ok) {
    console.error("Failed to submit request:", res.status, await res.text());
    return;
  }

  const data = await res.json() as any;
  console.log("Submit Response:", data);

  const videoId = data.video_id || data.task_id || data.id;
  if (!videoId) {
    console.error("No video_id found in response");
    return;
  }

  console.log("Task created with ID:", videoId);
  console.log("Polling for status...");

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusRes = await fetch(`https://apihub.agnes-ai.com/agnesapi?video_id=${videoId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!statusRes.ok) {
      console.error("Failed to check status:", statusRes.status, await statusRes.text());
      continue;
    }

    const statusData = await statusRes.json() as any;
    const taskStatus = statusData.data?.status || statusData.status || statusData.data?.data?.status;
    const progress = statusData.data?.progress || statusData.progress || statusData.data?.data?.progress;
    
    console.log(`Status: ${taskStatus}, Progress: ${progress}`);

    if (taskStatus === "SUCCESS" || taskStatus === "success" || taskStatus === "completed" || statusData.data?.data?.video || statusData.data?.data?.url || statusData.data?.data?.video_url) {
      console.log("Video Generation Completed!");
      console.log(JSON.stringify(statusData, null, 2));
      break;
    } else if (taskStatus === "FAIL" || taskStatus === "fail" || taskStatus === "FAILED" || taskStatus === "failed") {
      console.error("Video Generation Failed!");
      console.log(JSON.stringify(statusData, null, 2));
      break;
    }
  }
}

generateVideo().catch(console.error);
