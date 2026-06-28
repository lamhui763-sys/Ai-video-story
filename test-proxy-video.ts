import fetch from "node-fetch";

async function test() {
  const url = encodeURIComponent("https://videos.pexels.com/video-files/1448735/1448735-hd_1080_1920_24fps.mp4");
  const res = await fetch(`http://localhost:3000/api/proxy-video?url=${url}&apiKey=dummy_key`);
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
