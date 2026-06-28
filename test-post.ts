import fetch from "node-fetch";

async function test() {
  const res = await fetch("http://localhost:3000/api/generate-video-agnes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: "dummy_key", prompt: "cat on the beach" })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
