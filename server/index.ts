import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './trpc';
import { projectsRouter } from './routers/projects';
import { router } from './trpc';
import { GoogleGenAI } from "@google/genai";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

function localRegexSanitize(prompt: string): string {
  let sanitized = prompt;

  const replacements: { pattern: RegExp; replacement: string }[] = [
    // English nouns / weapons
    { pattern: /\bswords\b/gi, replacement: "glowing wands" },
    { pattern: /\bsword\b/gi, replacement: "glowing wand" },
    { pattern: /\bblades\b/gi, replacement: "light staffs" },
    { pattern: /\bblade\b/gi, replacement: "light staff" },
    { pattern: /\bdaggers\b/gi, replacement: "magic wands" },
    { pattern: /\bdagger\b/gi, replacement: "magic wand" },
    { pattern: /\bknives\b/gi, replacement: "prism rods" },
    { pattern: /\bknife\b/gi, replacement: "prism rod" },
    { pattern: /\bweapons\b/gi, replacement: "magical tools" },
    { pattern: /\bweapon\b/gi, replacement: "magical tool" },
    { pattern: /\bguns\b/gi, replacement: "beam emitters" },
    { pattern: /\bgun\b/gi, replacement: "beam emitter" },
    { pattern: /\brifles\b/gi, replacement: "energy devices" },
    { pattern: /\brifle\b/gi, replacement: "energy device" },
    { pattern: /\bpistols\b/gi, replacement: "spark pointers" },
    { pattern: /\bpistol\b/gi, replacement: "spark pointer" },
    { pattern: /\bshields\b/gi, replacement: "aurora wards" },
    { pattern: /\bshield\b/gi, replacement: "aurora ward" },

    // English verbs / actions
    { pattern: /\bfighting\b/gi, replacement: "dancing gracefully" },
    { pattern: /\bfights\b/gi, replacement: "dance interactions" },
    { pattern: /\bfight\b/gi, replacement: "dance interaction" },
    { pattern: /\bbattling\b/gi, replacement: "performing together" },
    { pattern: /\bbattles\b/gi, replacement: "performances" },
    { pattern: /\bbattle\b/gi, replacement: "aesthetic performance" },
    { pattern: /\battacking\b/gi, replacement: "moving toward" },
    { pattern: /\battacks\b/gi, replacement: "moves toward" },
    { pattern: /\battack\b/gi, replacement: "move toward" },
    { pattern: /\bclashing\b/gi, replacement: "blending" },
    { pattern: /\bclashes\b/gi, replacement: "blends" },
    { pattern: /\bclash\b/gi, replacement: "blend" },
    { pattern: /\bpunching\b/gi, replacement: "tapping" },
    { pattern: /\bpunches\b/gi, replacement: "taps" },
    { pattern: /\bpunch\b/gi, replacement: "tap" },
    { pattern: /\bkicking\b/gi, replacement: "stepping" },
    { pattern: /\bkicks\b/gi, replacement: "steps" },
    { pattern: /\bkick\b/gi, replacement: "step" },
    { pattern: /\bbeating\b/gi, replacement: "guiding" },

    // English harm / blood / death
    { pattern: /\bbloody\b/gi, replacement: "sparkling" },
    { pattern: /\bblood\b/gi, replacement: "star dust" },
    { pattern: /\bbleeding\b/gi, replacement: "glowing" },
    { pattern: /\bbleed\b/gi, replacement: "glow" },
    { pattern: /\bwounded\b/gi, replacement: "sparked" },
    { pattern: /\bwound\b/gi, replacement: "spark" },
    { pattern: /\binjured\b/gi, replacement: "glittered" },
    { pattern: /\binjury\b/gi, replacement: "glitter" },
    { pattern: /\bkilling\b/gi, replacement: "bathing in light" },
    { pattern: /\bkills\b/gi, replacement: "vanquishes with light" },
    { pattern: /\bkill\b/gi, replacement: "vanquish with light" },
    { pattern: /\bmurder\b/gi, replacement: "transform" },
    { pattern: /\bdeath\b/gi, replacement: "transition" },
    { pattern: /\bdead\b/gi, replacement: "asleep" },
    { pattern: /\bdying\b/gi, replacement: "resting" },
    { pattern: /\bdie\b/gi, replacement: "rest" },
    { pattern: /\bcorpses\b/gi, replacement: "sleeping figures" },
    { pattern: /\bcorpse\b/gi, replacement: "sleeping figure" },

    // English monsters / horror
    { pattern: /\bdemons\b/gi, replacement: "shadow figures" },
    { pattern: /\bdemon\b/gi, replacement: "shadow figure" },
    { pattern: /\bmonsters\b/gi, replacement: "creatures" },
    { pattern: /\bmonster\b/gi, replacement: "creature" },
    { pattern: /\bghosts\b/gi, replacement: "misty lights" },
    { pattern: /\bghost\b/gi, replacement: "misty light" },
    { pattern: /\bscary\b/gi, replacement: "mysterious" },
    { pattern: /\bhorror\b/gi, replacement: "fantasy" },

    // Chinese characters
    { pattern: /戰鬥/g, replacement: "華麗舞蹈" },
    { pattern: /打架/g, replacement: "動態編舞" },
    { pattern: /打/g, replacement: "舞" },
    { pattern: /殺/g, replacement: "渡" },
    { pattern: /死/g, replacement: "眠" },
    { pattern: /血/g, replacement: "星砂" },
    { pattern: /受傷/g, replacement: "流光溢彩" },
    { pattern: /傷/g, replacement: "光" },
    { pattern: /武器/g, replacement: "魔法法器" },
    { pattern: /劍/g, replacement: "光能手杖" },
    { pattern: /刀/g, replacement: "流光法杖" },
    { pattern: /槍/g, replacement: "能量棒" },
    { pattern: /怪物/g, replacement: "奇幻生物" },
    { pattern: /鬼/g, replacement: "幻影" },
    { pattern: /魔/g, replacement: "陰影" }
  ];

  for (const item of replacements) {
    sanitized = sanitized.replace(item.pattern, item.replacement);
  }

  return sanitized;
}

async function sanitizeAndTranslatePrompt(originalPrompt: string): Promise<string> {
  // Pass 1: Local Regex Sanitization
  const preSanitized = localRegexSanitize(originalPrompt);

  if (!ai) {
    console.log("No GEMINI_API_KEY configured server-side. Falling back to local regex sanitization.");
    return preSanitized;
  }

  try {
    const promptForGemini = `You are an expert prompt engineer and video art director.
Your goal is to optimize, translate, and completely sanitize the following video generation prompt to ensure it is beautiful, in English, and 100% compliant with standard AI content and safety policies (to avoid content policy violations).

Rules for Sanitization and Optimization:
1. Translate any Chinese/foreign text to descriptive, elegant, cinematic English.
2. Ensure the prompt is 100% safe, positive, and non-violent:
   - Absolutely NO descriptions of violence, combat, weapons (like swords, knives, daggers, guns, blades), physical fights, bleeding, injuries, death, or dark/scary horror elements.
   - If there are fights or battles, reword them into "dynamic aesthetic choreography", "magical aura glows", "graceful dance-like movements with swirling neon lights", "sparkling particle effects", or "luminous magical energy".
   - If there are weapons, replace them with "luminous magical energy wands", "sparkling light staffs", or just "focused hand gestures with glowing runes/runic light trails".
   - If there are injuries or blood, replace them with "shimmering star dust", "soft cherry blossom petals drifting", "sparkling light aura", or "glowing energy sparkles".
   - If there are suggestive/adult-themed elements, make them completely safe, poetic, and elegant (e.g. replace revealing clothing with "elegant flowing robe/dress", replace intimate contact with "two characters standing close, looking into each other's eyes under soft romantic sunset lighting").
3. Retain the visual character consistency context (e.g. [Character consistency: ...] block if present) as-is at the beginning of the prompt.
4. Add premium aesthetic enhancements suitable for highly polished anime style videos (e.g., "anime cinematic style, masterfully rendered, vibrant colors, beautiful lighting, highly detailed, high frame rate").
5. Return ONLY the final safe optimized English prompt text. Do not include any explanations, preambles, or markdown formatting (like \`\`\` or "Prompt:").

Here is the original prompt:
"""
${preSanitized}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptForGemini,
    });

    if (response.text) {
      const optimized = response.text.trim();
      console.log("Original prompt:", originalPrompt);
      console.log("Optimized safe prompt:", optimized);
      
      // Pass 3: Final local regex sweep on Gemini's output just to be absolutely certain!
      return localRegexSanitize(optimized);
    }
  } catch (err) {
    console.error("Gemini prompt optimization failed, falling back to local pre-sanitized:", err);
  }
  return preSanitized;
}

async function makeUltraSafePrompt(originalPrompt: string): Promise<string> {
  if (!ai) {
    return "A young man sitting at a table in a brightly lit room, looking at a screen and smiling warmly, anime style.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `You are an expert prompt engineer. A video generation prompt has triggered a strict content policy filter.
Please completely rewrite the following prompt to be 100% compliant, G-rated, extremely peaceful, joyful, and positive.

Rules:
1. Do not use ANY dramatic, tense, violent, dark, or potentially sensitive words (avoid words like "shocked", "dimly", "flickering", "darkness", "disheveled", "hovering", "mysterious").
2. Describe a bright, happy, calm scene with clean lighting (e.g., "brightly lit room", "smiling gently", "peaceful setting", "warm cozy atmosphere").
3. Retain the character's general physical attributes (like male/female, glasses, hair color) if mentioned, but describe them with a neat appearance and a peaceful/cheerful expression.
4. Keep any [Character consistency: ...] block at the beginning exactly as-is.
5. Return ONLY the final safe prompt text. No quotes, no markdown, no explanation.

Here is the original prompt:
"""
${originalPrompt}
"""`,
    });

    if (response.text) {
      return response.text.trim();
    }
  } catch (err) {
    console.error("Failed to generate ultra safe prompt:", err);
  }
  return "A young man sitting at a table in a brightly lit room, looking at a screen and smiling warmly, anime style.";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRouter = router({
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use(
    '/api/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/proxy-image", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing url parameter");
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch original image: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error("Proxy image error:", err);
      res.status(500).send("Error proxying image");
    }
  });

  app.post("/api/generate-video-agnes", async (req, res) => {
    const { apiKey, prompt } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing Agnes API Key" });
    }
    if (!prompt) {
      return res.status(400).json({ error: "Missing video generation prompt" });
    }

    try {
      // Tier 1: Optimize, translate, and sanitize the prompt to avoid content policy violations
      const safePrompt = await sanitizeAndTranslatePrompt(prompt);
      console.log("Tier 1 - safePrompt:", safePrompt);

      let response = await fetch("https://apihub.agnes-ai.com/v1/video/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "agnes-video-v2.0",
          prompt: safePrompt
        })
      });

      let responseDataText = "";
      if (!response.ok) {
        responseDataText = await response.text();
        console.warn("Agnes Tier 1 generation attempt failed:", responseDataText);

        // Check if it is a content policy violation
        if (responseDataText.includes("content_policy_violation")) {
          console.log("Detected content policy violation. Tier 2 - Retrying with ultra-safe prompt...");
          const ultraSafe = await makeUltraSafePrompt(prompt);
          console.log("Attempting Tier 2 with ultra-safe prompt:", ultraSafe);

          response = await fetch("https://apihub.agnes-ai.com/v1/video/generations", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "agnes-video-v2.0",
              prompt: ultraSafe
            })
          });

          if (!response.ok) {
            responseDataText = await response.text();
            console.warn("Agnes Tier 2 generation attempt failed:", responseDataText);

            if (responseDataText.includes("content_policy_violation")) {
              console.log("Ultra-safe prompt also triggered policy. Tier 3 - Retrying with a bulletproof generic safe prompt...");
              
              // Extract character consistency tag if any
              const consistencyMatch = prompt.match(/^\[Character consistency:[^\]]+\]/i);
              const consistencyTag = consistencyMatch ? consistencyMatch[0] + " " : "";
              
              let finalFoolproofPrompt = `${consistencyTag}A beautiful anime illustration of a character smiling in a brightly lit peaceful room, clean and sunny, soft warm colors.`;
              if (prompt.toLowerCase().includes("female") || prompt.toLowerCase().includes("girl") || prompt.toLowerCase().includes("woman")) {
                finalFoolproofPrompt = `${consistencyTag}A cheerful anime girl sitting in a sunny cozy room, smiling warmly at the camera, beautiful bright colors, highly detailed.`;
              } else if (prompt.toLowerCase().includes("male") || prompt.toLowerCase().includes("boy") || prompt.toLowerCase().includes("man")) {
                finalFoolproofPrompt = `${consistencyTag}A cheerful anime boy sitting in a sunny cozy room, smiling warmly at the camera, beautiful bright colors, highly detailed.`;
              }

              console.log("Attempting Tier 3 with foolproof prompt:", finalFoolproofPrompt);
              response = await fetch("https://apihub.agnes-ai.com/v1/video/generations", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: "agnes-video-v2.0",
                  prompt: finalFoolproofPrompt
                })
              });
            }
          }
        }
      }

      if (!response.ok) {
        const errText = responseDataText || await response.text();
        console.error("Agnes Video API final failure:", errText);
        return res.status(response.status).json({ error: `Agnes API Error: ${errText}` });
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errText = await response.text();
        console.error("Agnes Video API returned non-JSON response:", contentType, errText.slice(0, 500));
        return res.status(502).json({ error: `Agnes AI 伺服器返回了非 JSON 格式的內容 (類型: ${contentType})。可能是服務器在進行維護，請稍後再試。` });
      }

      const data = await response.json() as any;
      res.json(data);
    } catch (err: any) {
      console.error("Agnes Video Server Error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.get("/api/check-video-agnes/:taskId?", async (req, res) => {
    const { taskId } = req.params;
    const apiKey = req.headers.authorization; // Expecting "Bearer sk-..."
    
    if (!taskId || taskId === "undefined") {
      return res.status(400).json({ error: "Missing or invalid taskId parameter" });
    }
    if (!apiKey) {
      return res.status(400).json({ error: "Missing authorization header" });
    }

    try {
      const response = await fetch(`https://apihub.agnes-ai.com/v1/video/generations/${taskId}`, {
        headers: {
          "Authorization": apiKey
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Agnes Task Status API Error:", errText);
        return res.status(response.status).json({ error: `Agnes API Error: ${errText}` });
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const errText = await response.text();
        console.error("Agnes Task Status API returned non-JSON response:", contentType, errText.slice(0, 500));
        return res.status(502).json({ error: `Agnes AI 任務查詢返回了非 JSON 格式的內容 (類型: ${contentType})。` });
      }

      const data = await response.json() as any;
      res.json(data);
    } catch (err: any) {
      console.error("Agnes Task Status Server Error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/extract-characters", async (req, res) => {
    const { apiKey, content, provider = "zhipu", model } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API Key" });
    }
    if (!content) {
      return res.status(400).json({ error: "Missing novel content" });
    }

    try {
      const prompt = `你是一位專業的角色設定師與原畫美術指導。請分析以下小說內容，提取出小說中所有主要及次要故事人物。
請以嚴格的 JSON 陣列格式輸出，不要包含任何 Markdown 格式標記（如 \`\`\`json 等），只返回一個包含多個 Character 物件的 JSON 陣列。
每個 Character 物件必須包含以下屬性：
- name (string): 角色姓名（例如 "凌風"）
- role (string): 角色描述或社會身份（例如 "深夜加班的主角程序員"）
- description (string): 角色的詳細外貌、穿著特徵與氣質描寫（必須是英文描述句，適合 Stable Diffusion/Flux 繪圖。請具體說明年齡、髮型、眼珠顏色、穿著、神情等關鍵特徵，以便在生圖時保持人物外貌一致。例如: "handsome Chinese male programmer in his 20s, short black hair, wearing a black hoodie, looking thoughtful, realistic facial details"）

小說內容如下：
${content}`;

      let response;
      if (provider === "mistral") {
        const selectedModel = model || "mistral-large-latest";
        response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });
      } else {
        const selectedModel = model || "glm-4-flash";
        response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error("Extract Characters API Error:", errText);
        return res.status(response.status).json({ error: `AI API error: ${errText}` });
      }

      const data = await response.json() as any;
      const assistantMessage = data.choices?.[0]?.message?.content || "";
      
      let cleanedText = assistantMessage.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.substring(7);
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.substring(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();

      try {
        let parsedJSON = JSON.parse(cleanedText);
        if (!Array.isArray(parsedJSON) && parsedJSON.characters) {
          parsedJSON = parsedJSON.characters;
        }
        res.json({ characters: parsedJSON });
      } catch (jsonErr) {
        console.error("Error parsing characters JSON:", cleanedText);
        res.json({ rawText: cleanedText, error: "JSON parsing failed but returned raw text" });
      }

    } catch (err: any) {
      console.error("Server character extraction error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/generate-script", async (req, res) => {
    const { apiKey, content, provider = "zhipu", model } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API Key" });
    }
    if (!content) {
      return res.status(400).json({ error: "Missing novel content" });
    }

    try {
      const prompt = `你是一位專業的短劇編劇與分鏡師。請將以下小說/故事文本改編成結構化的短劇分鏡劇本。
請以嚴格的 JSON 陣列格式輸出，不要包含任何 Markdown 格式標記（如 \`\`\`json 等），只返回一個包含多個 Scene 物件的 JSON 陣列。
每個 Scene 物件必須包含以下屬性：
- sceneNum (string): 場景編號，例如 "1"
- location (string): 場景地點與時間，例如 "客廳 - 日"
- characters (array of string): 出場角色
- description (string): 畫面鏡頭視覺描述（包含演員動作、表情、鏡頭運作，以及適合 Stable Diffusion 繪圖的英文提示詞提示，格式如 "Medium shot of a handsome man sitting on a sofa, looking thoughtful, cinematic lighting, 8k"）
- dialogue (array of object): 角色台詞對白列表，每個對白包含 character (角色名字) 和 text (台詞內容)

小說內容如下：
${content}`;

      let response;
      if (provider === "mistral") {
        const selectedModel = model || "mistral-large-latest";
        response = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });
      } else {
        const selectedModel = model || "glm-4-flash";
        response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI API Error response:", errText);
        return res.status(response.status).json({ error: `AI API error: ${errText}` });
      }

      const data = await response.json() as any;
      const assistantMessage = data.choices?.[0]?.message?.content || "";
      
      // Clean up markdown block wraps if model outputted them despite prompt instructions
      let cleanedText = assistantMessage.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.substring(7);
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.substring(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();

      try {
        let parsedJSON = JSON.parse(cleanedText);
        // Sometimes the API might wrap the array under a top-level key like "scenes" or "script"
        if (!Array.isArray(parsedJSON) && parsedJSON.scenes) {
          parsedJSON = parsedJSON.scenes;
        } else if (!Array.isArray(parsedJSON) && parsedJSON.script) {
          parsedJSON = parsedJSON.script;
        }
        res.json({ scenes: parsedJSON });
      } catch (jsonErr) {
        console.error("Error parsing JSON output from GLM-4-Flash:", cleanedText);
        // Fallback to sending the clean text
        res.json({ rawText: cleanedText, error: "JSON parsing failed but returned raw text" });
      }

    } catch (err: any) {
      console.error("Server script generation error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // API catch-all route to prevent fallback to SPA HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: "client",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'client/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
