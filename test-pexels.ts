import fetch from "node-fetch";

async function test() {
  const url = "https://videos.pexels.com/video-files/1448735/1448735-hd_1080_1920_24fps.mp4";
  const res = await fetch(url, { headers: { "Authorization": "Bearer dummy_key" } });
  console.log("Status:", res.status);
  console.log("StatusText:", res.statusText);
}
test();
