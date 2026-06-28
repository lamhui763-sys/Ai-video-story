import fetch from "node-fetch";

async function test() {
  const res = await fetch("https://apihub.agnes-ai.com/agnesapi?video_id=task_invalid", {
    method: "GET"
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
