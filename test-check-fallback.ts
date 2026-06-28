import fetch from "node-fetch";

async function test() {
  const res = await fetch("http://localhost:3000/api/check-video-agnes/fallback_scenic");
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
