import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
process.env.AGNES_API_KEY = apiKey;

const out = fs.openSync('./out.log', 'a');
const err = fs.openSync('./out.log', 'a');

const child = spawn('python3', [
  'agnes_video.py',
  '--prompt', '第一人称球迷视角，世界杯决赛现场，手持摄像机晃动效果，周围球迷疯狂庆祝，举杯欢呼，烟火表演，真实现场音效氛围',
  '--num-frames', '121',
  '--frame-rate', '24',
  '--output', 'outputs/agnes-video.mp4',
  '--no-wait',
  '--raw-output', 'outputs/create.json'
], {
  detached: true,
  stdio: [ 'ignore', out, err ]
});

child.unref();
console.log("Spawned python process with PID:", child.pid);
