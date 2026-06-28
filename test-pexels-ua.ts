import fetch from "node-fetch";

async function test() {
  const url = "https://videos.pexels.com/video-files/1448735/1448735-hd_1080_1920_24fps.mp4";
  const res = await fetch(url, {
      headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
  });
  console.log("Status:", res.status);
}
test();
