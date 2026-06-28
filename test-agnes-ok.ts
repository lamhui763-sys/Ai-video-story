import fetch from "node-fetch";

async function test() {
  const res = await fetch("https://apihub.agnes-ai.com/v1/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "agnes-video-v2.0",
      prompt: "cat on the beach"
    })
  });
  console.log("ok:", res.ok);
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
