import fs from 'fs';
import os from 'os';

const home = os.homedir();
console.log("Home dir:", home);
try {
  const files = fs.readdirSync(home + '/.claude/skills/agnes-image-generator/scripts/');
  console.log(files);
} catch(e: any) {
  console.log("Error:", e.message);
}
