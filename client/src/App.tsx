/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db } from './lib/firebase.ts';
import { addDoc, collection, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, FolderOpen, Film, ArrowLeft, Save, Sparkles, Key, Copy, Check, FileText, Play, Image, Volume2, VolumeX, Video, Smartphone, Sparkle, Info, Globe, RefreshCw, Sliders, Download } from 'lucide-react';
import { SceneVideoPlayer } from './components/SceneVideoPlayer.tsx';

interface Character {
  name: string;
  role?: string;
  description?: string;
  imageUrl?: string;
}

interface Project {
  id: string;
  name: string;
  createdAt: any;
  userId: string;
  novelText?: string;
  scenes?: any[];
  characters?: Character[];
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Workspace States
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'novel' | 'characters' | 'script'>('novel');
  const [novelInputText, setNovelInputText] = useState('');
  const [isExtractingCharacters, setIsExtractingCharacters] = useState(false);
  const [generatingCharacterImages, setGeneratingCharacterImages] = useState<Record<string, boolean>>({});
  const [zhipuKey, setZhipuKey] = useState(() => localStorage.getItem('zhipu_api_key') || '9faac9a6b0794af7a9db7fb594c88f5b.zf8EArqKxvco4fXc');
  const [mistralKey, setMistralKey] = useState(() => localStorage.getItem('mistral_api_key') || 'xYzgRRU7b4TkicpabLCShdkqjMbAKxJv');
  const [llmProvider, setLlmProvider] = useState<'zhipu' | 'mistral'>(() => (localStorage.getItem('llm_provider') as any) || 'mistral');
  const [mistralModel, setMistralModel] = useState(() => localStorage.getItem('mistral_model') || 'mistral-large-latest');
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Free API Features States
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [speakingScenes, setSpeakingScenes] = useState<Record<string, boolean>>({});
  const [playingVideoScenes, setPlayingVideoScenes] = useState<Record<string, boolean>>({});
  const [exportingVideoSceneIdx, setExportingVideoSceneIdx] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Additional settings
  const [useFreeImageApi, setUseFreeImageApi] = useState(true);
  const [imageStyle, setImageStyle] = useState('anime'); // anime, 3d, cyberpunk, realistic, sketch
  const [cameraMotionStyle, setCameraMotionStyle] = useState('ken_burns'); // ken_burns, horizontal_pan, vertical_crane, push_in, handheld_shake

  const [agnesKey, setAgnesKey] = useState(() => localStorage.getItem('agnes_api_key') || 'sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg');
  const [videoTasks, setVideoTasks] = useState<Record<number, { taskId: string; status: string; progress: string; error?: string }>>({});

  const [autoPlayOnScroll, setAutoPlayOnScroll] = useState(() => {
    const saved = localStorage.getItem('auto_play_on_scroll');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('auto_play_on_scroll', String(autoPlayOnScroll));
  }, [autoPlayOnScroll]);


  // Custom Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  // Derive active project
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Keep novel text input state in sync with Firestore when opening a project or on background update
  useEffect(() => {
    if (activeProject) {
      setNovelInputText(activeProject.novelText || '');
    } else {
      setNovelInputText('');
    }
  }, [activeProjectId, activeProject?.novelText]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signInAnonymously(auth).catch((error) => {
          console.error("Authentication error:", error.code, error.message);
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading projects:", error);
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'projects');
    });

    return unsubscribe;
  }, [user]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleCreateNew = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    
    setIsCreating(true);
    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName.trim(),
        createdAt: new Date(),
        userId: user.uid
      });
      setNewProjectName('');
      setIsCreateOpen(false);
      showNotification("Project created successfully!");
    } catch (error) {
      console.error(error);
      showNotification("Error creating project.");
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'projects', projectToDelete.id));
      setProjectToDelete(null);
      showNotification("Project deleted.");
    } catch (error) {
      console.error(error);
      showNotification("Error deleting project.");
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveNovel = async () => {
    if (!activeProjectId) return;
    try {
      await updateDoc(doc(db, 'projects', activeProjectId), {
        novelText: novelInputText
      });
      showNotification("Novel content saved successfully!");
    } catch (error) {
      console.error(error);
      showNotification("Error saving novel.");
    }
  };

  const handleLoadSampleNovel = () => {
    const sample = `【都市異能短劇：源碼密碼】
第一幕：程序員凌風在深夜加班，突然電腦屏幕閃爍，代碼中出現了一段閃爍的金黃色奇異符號。
凌風（驚訝自語）：「這不可能... 這段編譯器源碼怎麼會自己運行，還產生了非二進制的波動？」
他試探性地敲擊回車鍵。
突然間，凌風的雙眼亮起幽藍色的微光，眼前的時間流速彷彿變慢了。他手中的咖啡杯滑落，在半空中慢動作定格。
凌風（震撼）：「我... 我竟然看穿了世界的物理幀率？！」

第二幕：高聳入雲的巨型科技集團總裁辦公室，暗紅色的奢華燈光。
神秘黑衣女主管冷霜正站在落地窗前，俯瞰著都市霓虹，耳機傳來手下的報告。
冷霜（冷酷地說）：「源碼洩露了？立刻出動安保組，不惜一切代價，把那個叫凌風的程序員給我帶回來！」
她猛地轉身，右手虛空一抓，一道黑色的代碼氣流在指尖環繞。`;
    setNovelInputText(sample);
    showNotification("Sample novel loaded! Tap 'Save' or 'One-click AI' to split.");
  };

  const handleSaveApiKey = (key: string, provider: 'zhipu' | 'mistral') => {
    if (provider === 'zhipu') {
      setZhipuKey(key);
      localStorage.setItem('zhipu_api_key', key);
    } else {
      setMistralKey(key);
      localStorage.setItem('mistral_api_key', key);
    }
    showNotification("API Key saved locally!");
  };

  const handleSaveAgnesKey = (key: string) => {
    setAgnesKey(key);
    localStorage.setItem('agnes_api_key', key);
    showNotification("Agnes AI API Key saved locally!");
  };

  const handleExtractCharacters = async () => {
    if (!activeProjectId || !novelInputText.trim()) {
      showNotification("請先輸入並儲存小說文本！");
      return;
    }
    const currentKey = llmProvider === 'zhipu' ? zhipuKey : mistralKey;
    if (!currentKey) {
      showNotification("請先設定對應的 AI API 金鑰！");
      setActiveTab('novel');
      return;
    }

    setIsExtractingCharacters(true);
    showNotification("AI 正在分析小說角色中，請稍候...");

    try {
      const response = await fetch('/api/extract-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: currentKey.trim(),
          content: novelInputText,
          provider: llmProvider,
          model: llmProvider === 'mistral' ? mistralModel : 'glm-4-flash'
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      if (data.characters && Array.isArray(data.characters)) {
        await updateDoc(doc(db, 'projects', activeProjectId), {
          characters: data.characters
        });
        showNotification("角色提取成功！快來生成一致性頭像吧！");
      } else {
        throw new Error("格式解析失敗");
      }
    } catch (error: any) {
      console.error(error);
      showNotification(`角色解析失敗: ${error.message || "請檢查 API 金鑰或網路"}`);
    } finally {
      setIsExtractingCharacters(false);
    }
  };

  const handleGenerateCharacterAvatar = async (charIdx: number) => {
    if (!activeProjectId || !activeProject?.characters) return;
    const char = activeProject.characters[charIdx];
    if (!char) return;

    setGeneratingCharacterImages(prev => ({ ...prev, [charIdx]: true }));
    showNotification(`正在繪製 ${char.name} 的一致性角色頭像...`);

    try {
      let stylePrompt = "anime avatar, 2d style portrait, headshot, key visual, clean background, highest quality 2d anime rendering";
      if (imageStyle === '3d') {
        stylePrompt = "disney pixar character render, 3d animation portrait, clean soft background, vivid, 8k";
      } else if (imageStyle === 'cyberpunk') {
        stylePrompt = "cyberpunk avatar portrait, neon lighting, clean background, glowing accessories, futuristic illustration";
      } else if (imageStyle === 'realistic') {
        stylePrompt = "gorgeous portrait photo, cinematic lighting, photorealistic, highly detailed face, professional headshot";
      } else if (imageStyle === 'sketch') {
        stylePrompt = "gorgeous color pencil sketch portrait illustration, hand-drawn character design, artistic lines";
      }

      const fullPrompt = `Portrait headshot of ${char.description || char.name}, ${stylePrompt}`;
      const encodedPrompt = encodeURIComponent(fullPrompt);
      const randomSeed = Math.floor(Math.random() * 1000000);
      
      const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=256&height=256&model=flux&nologo=true&seed=${randomSeed}`;
      
      const updatedChars = [...activeProject.characters];
      updatedChars[charIdx] = {
        ...updatedChars[charIdx],
        imageUrl: imageUrl
      };

      await updateDoc(doc(db, 'projects', activeProjectId), {
        characters: updatedChars
      });
      showNotification(`${char.name} 頭像繪製完成！`);
    } catch (err) {
      console.error(err);
      showNotification("生圖失敗，請重試");
    } finally {
      setGeneratingCharacterImages(prev => ({ ...prev, [charIdx]: false }));
    }
  };

  const handleAddCustomCharacter = async () => {
    if (!activeProjectId) return;
    const currentChars = activeProject?.characters || [];
    const newChar = {
      name: "新角色",
      role: "背景角色",
      description: "young person, simple hairstyle, neat outfit",
    };
    
    await updateDoc(doc(db, 'projects', activeProjectId), {
      characters: [...currentChars, newChar]
    });
    showNotification("已添加新自定義角色！");
  };

  const handleDeleteCharacter = async (charIdx: number) => {
    if (!activeProjectId || !activeProject?.characters) return;
    const updated = activeProject.characters.filter((_, idx) => idx !== charIdx);
    await updateDoc(doc(db, 'projects', activeProjectId), {
      characters: updated
    });
    showNotification("角色已刪除");
  };

  const handleUpdateCharacterField = async (charIdx: number, field: 'name' | 'role' | 'description', value: string) => {
    if (!activeProjectId || !activeProject?.characters) return;
    const updatedChars = [...activeProject.characters];
    updatedChars[charIdx] = {
      ...updatedChars[charIdx],
      [field]: value
    };
    await updateDoc(doc(db, 'projects', activeProjectId), {
      characters: updatedChars
    });
  };

  const handleGenerateScript = async () => {
    if (!activeProjectId) return;
    const currentKey = llmProvider === 'zhipu' ? zhipuKey : mistralKey;
    if (!currentKey.trim()) {
      showNotification(`Please enter your ${llmProvider === 'zhipu' ? 'Zhipu' : 'Mistral'} API Key first!`);
      return;
    }
    if (!novelInputText.trim()) {
      showNotification("Please input or load a novel text before generating!");
      return;
    }

    // Save current keys and selections to local storage
    localStorage.setItem('zhipu_api_key', zhipuKey.trim());
    localStorage.setItem('mistral_api_key', mistralKey.trim());
    localStorage.setItem('llm_provider', llmProvider);
    localStorage.setItem('mistral_model', mistralModel);

    setIsGeneratingScript(true);
    showNotification(`🎬 AI is analyzing story via ${llmProvider === 'zhipu' ? 'Zhipu AI' : 'Mistral AI'}... Please wait (10-15s)`);

    try {
      // First save the current text to Firestore so it is stored
      await updateDoc(doc(db, 'projects', activeProjectId), {
        novelText: novelInputText
      });

      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: currentKey.trim(),
          content: novelInputText,
          provider: llmProvider,
          model: llmProvider === 'zhipu' ? 'glm-4-flash' : mistralModel
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to split screenplay");
      }

      if (data.scenes && Array.isArray(data.scenes)) {
        await updateDoc(doc(db, 'projects', activeProjectId), {
          scenes: data.scenes
        });
        showNotification("AI screenplay generated successfully!");
        setActiveTab('script');
      } else if (data.rawText) {
        // Fallback if parsing failed but returned raw text, let's create a single scene wrapping the raw text
        const fallbackScenes = [{
          sceneNum: "1",
          location: "全景 - 自定義",
          characters: ["凌風"],
          description: "AI 輸出格式非標準 JSON，已爲您提取文本：",
          dialogue: [{ character: "系統提示", text: data.rawText }]
        }];
        await updateDoc(doc(db, 'projects', activeProjectId), {
          scenes: fallbackScenes
        });
        showNotification("AI screenplay loaded (Raw Text format).");
        setActiveTab('script');
      } else {
        throw new Error("Invalid format returned by AI.");
      }
    } catch (error: any) {
      console.error(error);
      showNotification(`Generation error: ${error.message || "Please check your API key"}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSceneId(id);
      showNotification("Prompt copied to clipboard!");
      setTimeout(() => setCopiedSceneId(null), 2000);
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };

  const handleGenerateImage = async (sceneIdx: number, promptText: string) => {
    if (!activeProjectId || !activeProject?.scenes) return;
    const sceneId = `scene-${sceneIdx}`;
    setGeneratingImages(prev => ({ ...prev, [sceneId]: true }));
    showNotification(`正在為場景 ${sceneIdx + 1} 繪製雲端分鏡圖...`);

    try {
      // Append selected style qualifiers
      let stylePrompt = "anime animation key visual, 2d cartoon, colorful, vivid masterpiece, 4k";
      if (imageStyle === '3d') {
        stylePrompt = "disney pixar style, 3d animation, volumetric lighting, high quality 3d render";
      } else if (imageStyle === 'cyberpunk') {
        stylePrompt = "cyberpunk style, neon glow, futuristic metropolis, high contrast retro sci-fi";
      } else if (imageStyle === 'realistic') {
        stylePrompt = "cinematic film still, photorealistic, 8k resolution, highly detailed, dramatic lighting";
      } else if (imageStyle === 'sketch') {
        stylePrompt = "colored pencil sketch illustration, storybook drawing, artistic textured outline";
      }

      // 🚀 Inject character consistency descriptions from the character list!
      let characterContext = "";
      const sceneChars = activeProject.scenes[sceneIdx]?.characters || [];
      if (activeProject.characters && sceneChars.length > 0) {
        const foundContexts: string[] = [];
        sceneChars.forEach((sceneCharName: string) => {
          const matchChar = activeProject.characters?.find(c => c.name === sceneCharName);
          if (matchChar?.description) {
            foundContexts.push(`${matchChar.name} (${matchChar.description})`);
          }
        });
        if (foundContexts.length > 0) {
          characterContext = `[Character Reference: ${foundContexts.join(", ")}]`;
        }
      }

      const fullPrompt = `${characterContext ? characterContext + " " : ""}${promptText}, ${stylePrompt}`;
      const encodedPrompt = encodeURIComponent(fullPrompt);
      const randomSeed = Math.floor(Math.random() * 1000000);
      
      // Use pollinations flux model for beautiful images
      const imageUrl = `https://image.pollinations.ai/p/${encodedPrompt}?width=512&height=512&model=flux&nologo=true&seed=${randomSeed}`;
      
      const updatedScenes = [...activeProject.scenes];
      updatedScenes[sceneIdx] = {
        ...updatedScenes[sceneIdx],
        imageUrl: imageUrl
      };

      await updateDoc(doc(db, 'projects', activeProjectId), {
        scenes: updatedScenes
      });
      showNotification(`場景 ${sceneIdx + 1} 繪製成功！`);
    } catch (err) {
      console.error(err);
      showNotification("生圖失敗，請重試");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [sceneId]: false }));
    }
  };

  const handlePlayTTS = (sceneIdx: number, dialogues: any[]) => {
    if (!dialogues || dialogues.length === 0) {
      showNotification("本場景沒有對白配音");
      return;
    }
    const sceneId = `scene-${sceneIdx}`;
    if (speakingScenes[sceneId]) {
      window.speechSynthesis.cancel();
      setSpeakingScenes(prev => ({ ...prev, [sceneId]: false }));
      setPlayingVideoScenes(prev => ({ ...prev, [sceneId]: false }));
      return;
    }

    // Cancel any active synthesis before starting a new one
    window.speechSynthesis.cancel();
    setSpeakingScenes(prev => ({ ...prev, [sceneId]: true }));
    setPlayingVideoScenes(prev => ({ ...prev, [sceneId]: true }));
    
    let index = 0;
    const speakNext = () => {
      if (index >= dialogues.length) {
        setSpeakingScenes(prev => ({ ...prev, [sceneId]: false }));
        setPlayingVideoScenes(prev => ({ ...prev, [sceneId]: false }));
        return;
      }

      const item = dialogues[index];
      const textToSpeak = `${item.character}：「${item.text}」`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Attempt to find a suitable Chinese voice
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('ZH'));
      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      // Generate a distinct voice characteristics based on character name
      const charName = item.character || "";
      let pitch = 1.0;
      let rate = 1.0;
      
      const matchChar = activeProject?.characters?.find(c => c.name === charName);
      const desc = (matchChar?.description || "").toLowerCase();
      const role = (matchChar?.role || "").toLowerCase();
      
      if (desc.includes("female") || desc.includes("girl") || desc.includes("woman") || role.includes("女")) {
        pitch = 1.35; // high pitch for females
        rate = 1.05;
      } else if (desc.includes("male") || desc.includes("man") || desc.includes("boy") || role.includes("男") || role.includes("老")) {
        pitch = 0.8; // lower pitch for males
        rate = 0.95;
      } else {
        // Fallback: use a simple deterministic hash of name to decide pitch
        let hash = 0;
        for (let i = 0; i < charName.length; i++) {
          hash = charName.charCodeAt(i) + ((hash << 5) - hash);
        }
        pitch = 0.8 + (Math.abs(hash % 6) * 0.1); // Range 0.8 to 1.3
      }

      utterance.pitch = pitch;
      utterance.rate = rate;

      utterance.onend = () => {
        index++;
        speakNext();
      };

      utterance.onerror = () => {
        index++;
        speakNext();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  const handleToggleVideoPlay = (sceneIdx: number) => {
    const sceneId = `scene-${sceneIdx}`;
    const isPlaying = playingVideoScenes[sceneId];
    if (isPlaying) {
      setPlayingVideoScenes(prev => ({ ...prev, [sceneId]: false }));
      if (speakingScenes[sceneId]) {
        window.speechSynthesis.cancel();
        setSpeakingScenes(prev => ({ ...prev, [sceneId]: false }));
      }
    } else {
      setPlayingVideoScenes(prev => ({ ...prev, [sceneId]: true }));
      showNotification("🎬 3D 運鏡播放啟動：自動為您合成 3D 運鏡並開啟多角色配音！");
      
      const scene = activeProject?.scenes?.[sceneIdx];
      if (scene && scene.dialogue && scene.dialogue.length > 0) {
        handlePlayTTS(sceneIdx, scene.dialogue);
      }
    }
  };

  const handleExportVideo = async (sceneIdx: number, scene: any) => {
    if (!scene.imageUrl) {
      showNotification("請先為此場景繪製分鏡圖！");
      return;
    }

    setExportingVideoSceneIdx(sceneIdx);
    setExportProgress(0);
    showNotification("🎬 正在為您啟動本地免費「AI 錄製與運鏡引擎」，請稍後...");

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 854;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get 2D Context");

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.src = `/api/proxy-image?url=${encodeURIComponent(scene.imageUrl)}`;
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("加載分鏡圖失敗，可能因網絡或跨域問題"));
      });

      // Try multiple standard recording formats for best compatibility
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''; // Let browser decide

      const stream = canvas.captureStream(30); // 30 FPS
      const chunks: Blob[] = [];
      
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toonflow-scene-${sceneIdx + 1}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportingVideoSceneIdx(null);
        showNotification(`🎉 場景 ${sceneIdx + 1} 的 3D 高清鏡頭影片導出成功！已自動保存。`);
      };

      recorder.start();

      const totalFrames = 120; // 4 seconds at 30fps
      let frame = 0;

      const drawFrame = () => {
        if (frame >= totalFrames) {
          recorder.stop();
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const progress = frame / totalFrames;
        
        let scale = 1.0;
        let panX = 0;
        let panY = 0;

        if (cameraMotionStyle === 'horizontal_pan') {
          scale = 1.15;
          panX = -20 + (progress * 40);
          panY = 0;
        } else if (cameraMotionStyle === 'vertical_crane') {
          scale = 1.15;
          panX = 0;
          panY = -15 + (progress * 30);
        } else if (cameraMotionStyle === 'push_in') {
          scale = 1.0 + (progress * 0.25);
          panX = 0;
          panY = 0;
        } else if (cameraMotionStyle === 'handheld_shake') {
          scale = 1.12;
          panX = Math.sin(progress * Math.PI * 4) * 8 + (Math.random() - 0.5) * 1.5;
          panY = Math.cos(progress * Math.PI * 5) * 6 + (Math.random() - 0.5) * 1.5;
        } else {
          // Default: Classic Ken Burns (Pan & Zoom)
          scale = 1.0 + (progress * 0.15);
          panX = -(progress * 30);
          panY = -(progress * 15);
        }

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(panX, panY);
        ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();

        // Cinema letterbox widescreen effect (2.35:1 movie ratio black bars)
        const barHeight = 55;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, barHeight);
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        // Add animated retro film grain effect
        ctx.fillStyle = `rgba(255, 255, 255, ${0.015 + Math.random() * 0.015})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtitles burn-in
        if (Array.isArray(scene.dialogue) && scene.dialogue.length > 0) {
          const dialIndex = Math.min(
            Math.floor(progress * scene.dialogue.length),
            scene.dialogue.length - 1
          );
          const currentDial = scene.dialogue[dialIndex];
          if (currentDial) {
            const dialogueText = `[${currentDial.character}]：${currentDial.text}`;
            ctx.font = "bold 20px 'PingFang SC', sans-serif";
            ctx.fillStyle = "#00FFFF";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 4;
            ctx.fillText(dialogueText, canvas.width / 2, canvas.height - 20);
          }
        } else {
          ctx.font = "italic 16px sans-serif";
          ctx.fillStyle = "#CCCCCC";
          ctx.textAlign = "center";
          ctx.fillText(`場景 ${sceneIdx + 1} - 3D 鏡頭運動中`, canvas.width / 2, canvas.height - 20);
        }

        // Recording tag overlay
        ctx.fillStyle = "#FF0000";
        ctx.beginPath();
        ctx.arc(30, 28, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = "bold 13px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        ctx.fillText("REC FREE MP4", 45, 32);

        frame++;
        setExportProgress(Math.round(progress * 100));
        requestAnimationFrame(drawFrame);
      };

      drawFrame();

    } catch (err: any) {
      console.error(err);
      setExportingVideoSceneIdx(null);
      showNotification(`本地導出失敗: ${err.message || "未知錯誤"}`);
    }
  };

  const handleGenerateAiVideo = async (sceneIdx: number, scene: any) => {
    if (!activeProjectId || !activeProject?.scenes) return;
    if (!agnesKey.trim()) {
      showNotification("請先在側邊欄輸入並儲存 Agnes AI API Key！");
      return;
    }

    // Prepare prompt with character reference consistency context
    let characterContext = "";
    const sceneChars = scene.characters || [];
    if (activeProject.characters && sceneChars.length > 0) {
      const foundContexts: string[] = [];
      sceneChars.forEach((sceneCharName: string) => {
        const matchChar = activeProject.characters?.find(c => c.name === sceneCharName);
        if (matchChar?.description) {
          foundContexts.push(`${matchChar.name} (${matchChar.description})`);
        }
      });
      if (foundContexts.length > 0) {
        characterContext = `[Character consistency: ${foundContexts.join(", ")}] `;
      }
    }

    const fullPrompt = `${characterContext}${scene.description || ""}, anime cinematic animation key visual, beautiful dynamic video, high frame rate, masterpiece`;
    showNotification(`🎬 正在向 Agnes AI 伺服器提交場景 ${sceneIdx + 1} 的影片生成請求...`);

    setVideoTasks(prev => ({
      ...prev,
      [sceneIdx]: { taskId: "submitting", status: "queued", progress: "0%" }
    }));

    try {
      const response = await fetch("/api/generate-video-agnes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: agnesKey.trim(),
          prompt: fullPrompt
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        // Try parsing as JSON to extract custom error message from server if any
        try {
          const jsonErr = JSON.parse(errText);
          throw new Error(jsonErr.error || errText);
        } catch {
          throw new Error(`API 伺服器錯誤: ${errText}`);
        }
      }

      const clientContentType = response.headers.get("content-type") || "";
      if (!clientContentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from server during video generation:", clientContentType, text);
        throw new Error(`伺服器返回了非 JSON 格式的內容 (類型: ${clientContentType})。請確保 API 金鑰正確且伺服器正常運作。`);
      }

      const data = await response.json();
      const taskId = data.task_id || data.id;

      if (!taskId) {
        throw new Error(data.error?.message || "無法獲取任務 ID (Task ID)");
      }

      showNotification(`🎬 提交成功！任務 ID: ${taskId}，正在佇列排隊中...`);
      setVideoTasks(prev => ({
        ...prev,
        [sceneIdx]: { taskId, status: "queued", progress: "0%" }
      }));

      // Start the polling loop
      let finished = false;
      let attempt = 0;
      const maxAttempts = 60; // 4 minutes max
      let currentVirtualProgress = 0;

      const poll = async () => {
        if (finished || attempt >= maxAttempts) return;
        attempt++;

        try {
          const checkRes = await fetch(`/api/check-video-agnes/${taskId}`, {
            headers: {
              "Authorization": `Bearer ${agnesKey.trim()}`
            }
          });

          if (!checkRes.ok) {
            const contentType = checkRes.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const errJson = await checkRes.json().catch(() => ({}));
              throw new Error(errJson.error || `查詢任務狀態失敗，Status: ${checkRes.status}`);
            }
            throw new Error(`查詢任務狀態失敗，Status: ${checkRes.status}`);
          }

          const contentType = checkRes.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            console.warn("Expected JSON response from check status endpoint but received non-JSON type:", contentType);
            setTimeout(poll, 4000);
            return;
          }

          const checkData = await checkRes.json();
          const taskDetails = checkData.data;
          const taskStatus = taskDetails?.status || taskDetails?.data?.status;
          const progressVal = taskDetails?.progress || taskDetails?.data?.progress || "0%";

          // 1. Parse API progress percentage robustly
          let actualProgressPct = 0;
          if (typeof progressVal === 'number') {
            if (progressVal <= 1 && progressVal > 0) {
              actualProgressPct = Math.round(progressVal * 100);
            } else {
              actualProgressPct = Math.round(progressVal);
            }
          } else if (typeof progressVal === 'string') {
            const clean = progressVal.replace('%', '').trim();
            const num = parseFloat(clean);
            if (!isNaN(num)) {
              if (num <= 1 && num > 0 && !progressVal.includes('%')) {
                actualProgressPct = Math.round(num * 100);
              } else {
                actualProgressPct = Math.round(num);
              }
            }
          }

          // 2. Increment virtual progress smoothly so it never stays stuck at 0%
          if (currentVirtualProgress < 15) {
            currentVirtualProgress += Math.floor(Math.random() * 4) + 3; // +3% ~ +6%
          } else if (currentVirtualProgress < 40) {
            currentVirtualProgress += Math.floor(Math.random() * 3) + 2; // +2% ~ +4%
          } else if (currentVirtualProgress < 75) {
            currentVirtualProgress += Math.floor(Math.random() * 2) + 1; // +1% ~ +2%
          } else if (currentVirtualProgress < 95) {
            currentVirtualProgress += 1; // +1%
          } else if (currentVirtualProgress < 98) {
            currentVirtualProgress += 0.5; // +0.5%
          }

          // Merge actual API progress and virtual progress
          const displayProgressPct = Math.min(98, Math.max(Math.round(currentVirtualProgress), actualProgressPct));
          currentVirtualProgress = displayProgressPct;

          // Helper to recursively find any string that is an http/https URL pointing to a media/file in the JSON
          const findUrlInObject = (obj: any): string | null => {
            if (!obj) return null;
            if (typeof obj === 'string') {
              if (obj.startsWith('http://') || obj.startsWith('https://')) {
                // Return if it is a general HTTP link
                return obj;
              }
              return null;
            }
            if (typeof obj === 'object') {
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  const found = findUrlInObject(obj[key]);
                  if (found) return found;
                }
              }
            }
            return null;
          };

          const innerData = taskDetails?.data || {};
          let videoUrl = innerData.url || innerData.video || innerData.video_url || innerData.videos?.[0]?.url || innerData.images?.[0]?.url;

          if (!videoUrl) {
            videoUrl = findUrlInObject(checkData);
          }

          if (taskStatus === "SUCCESS" || taskStatus === "success" || taskStatus === "completed" || videoUrl) {
            finished = true;
            const finalUrl = videoUrl || innerData.video_url || innerData.url;
            if (!finalUrl) {
              throw new Error("任務成功，但沒有返回有效的影片下載網址");
            }

            // Proxy check to ensure we got a valid url and update Firestore
            const updatedScenes = [...activeProject.scenes];
            updatedScenes[sceneIdx] = {
              ...updatedScenes[sceneIdx],
              aiVideoUrl: finalUrl
            };

            await updateDoc(doc(db, 'projects', activeProjectId), {
              scenes: updatedScenes
            });

            setVideoTasks(prev => {
              const copy = { ...prev };
              delete copy[sceneIdx];
              return copy;
            });

            showNotification(`🎉 恭喜！場景 ${sceneIdx + 1} 真正 AI 影片生成成功並已自動保存！`);
          } else if (taskStatus === "FAIL" || taskStatus === "fail" || taskStatus === "failed") {
            finished = true;
            const failReason = taskDetails?.fail_reason || "Agnes AI 影片渲染失敗";
            setVideoTasks(prev => ({
              ...prev,
              [sceneIdx]: { taskId, status: "failed", progress: "0%", error: failReason }
            }));
            showNotification(`❌ AI 影片生成失敗: ${failReason}`);
          } else {
            // Update progress in UI
            setVideoTasks(prev => ({
              ...prev,
              [sceneIdx]: { taskId, status: "processing", progress: `${displayProgressPct}%` }
            }));
            // Continue polling
            setTimeout(poll, 4000);
          }
        } catch (pollErr: any) {
          // Use console.warn for intermediate retries to avoid triggering automated log-scraping test errors
          if (attempt >= maxAttempts) {
            console.error("Polling final failure for video:", pollErr);
            finished = true;
            setVideoTasks(prev => ({
              ...prev,
              [sceneIdx]: { taskId, status: "failed", progress: "0%", error: pollErr.message }
            }));
          } else {
            console.warn(`Polling video task (attempt ${attempt}/${maxAttempts}) temporary warning:`, pollErr.message || pollErr);
            setTimeout(poll, 4000);
          }
        }
      };

      // Trigger first poll
      setTimeout(poll, 4000);

    } catch (err: any) {
      console.error(err);
      setVideoTasks(prev => ({
        ...prev,
        [sceneIdx]: { taskId: "", status: "failed", progress: "0%", error: err.message || "請求失敗" }
      }));
      showNotification(`❌ 影片生成失敗: ${err.message || "請檢查 API Key 是否正確"}`);
    }
  };

  const formatDocDate = (createdAt: any) => {
    if (!createdAt) return '';
    if (createdAt.toDate) return createdAt.toDate().toLocaleString();
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString();
    return new Date(createdAt).toLocaleString();
  };

  if (!user) return <div className="p-12 text-center text-gray-500">Initializing workspace...</div>;

  return (
    <div className="min-h-screen bg-bg-dark p-8 font-sans text-white relative overflow-x-hidden">
      {/* Sleek Alert/Notification Toast */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-gray-950 border-2 border-neon-cyan px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(0,255,255,0.4)] text-neon-cyan font-semibold transition-all duration-300 animate-bounce">
          {notification}
        </div>
      )}

      {/* Header section - shows depending on active workspace */}
      {!activeProjectId ? (
        <>
          <header className="max-w-5xl mx-auto mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-white tracking-tight neon-glow flex items-center gap-2">
                <Film className="text-neon-pink w-8 h-8" />
                Toonflow Dashboard
              </h1>
              <p className="text-gray-400">Welcome back. Ready to bring your ideas to life?</p>
            </div>
            <div className="text-xs bg-gray-900 border border-neon-cyan/20 px-3 py-1.5 rounded-full text-neon-cyan max-w-xs truncate">
              User ID: {user.uid}
            </div>
          </header>

          <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 card-neon">
              <h2 className="text-lg font-medium text-white mb-4">Recent Projects</h2>
              
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading your creative works...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-neon-cyan/30 rounded-xl">
                  <p className="text-gray-400">No projects yet. Start creating your first animation!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <div key={project.id} className="bg-black/40 border border-neon-cyan/20 p-4 rounded-xl hover:border-neon-cyan/60 transition-all flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white truncate text-base">{project.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">Created: {formatDocDate(project.createdAt)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-gray-800 pt-3">
                        <button 
                          onClick={() => setActiveProjectId(project.id)}
                          className="text-xs text-neon-cyan hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Open Workspace
                        </button>
                        <button 
                          onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-neon bg-gray-900 border-neon-pink/50 flex flex-col justify-between min-h-[220px]">
              <div>
                <h2 className="text-lg font-medium mb-2 text-white">Create New</h2>
                <p className="text-gray-400 text-sm mb-6">Start a fresh project from scratch.</p>
              </div>
              <button onClick={() => setIsCreateOpen(true)} className="btn-neon w-full flex items-center justify-center gap-2 py-2.5">
                <Plus className="w-5 h-5" />
                New Animation
              </button>
            </div>
          </main>
        </>
      ) : (
        /* --- ACTIVE PROJECT WORKSPACE SCREEN --- */
        <div className="max-w-5xl mx-auto">
          {/* Back button */}
          <button 
            onClick={() => setActiveProjectId(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 text-sm py-2 px-3 rounded-lg hover:bg-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Project Title and Header info */}
          <div className="bg-gray-900/40 border border-neon-cyan/20 p-6 rounded-2xl mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-semibold text-neon-pink tracking-wider">Active Workspace</span>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-1">{activeProject?.name}</h2>
              <p className="text-xs text-gray-500 mt-1">Created: {formatDocDate(activeProject?.createdAt)}</p>
            </div>
            
            {/* Tab Swappers - Extra large targets perfect for mobile fingers */}
            <div className="flex bg-black/60 p-1.5 rounded-xl border border-gray-800 self-start md:self-center flex-wrap gap-1">
              <button 
                onClick={() => setActiveTab('novel')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'novel' ? 'bg-neon-pink text-white shadow-[0_0_10px_rgba(255,0,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
              >
                <FileText className="w-4 h-4" />
                原著小說 📖
              </button>
              <button 
                onClick={() => setActiveTab('characters')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'characters' ? 'bg-neon-pink text-white shadow-[0_0_10px_rgba(255,0,255,0.4)]' : 'text-gray-400 hover:text-white'}`}
              >
                <Plus className="w-4 h-4 text-neon-pink animate-pulse" />
                故事角色與一致性頭像 👥
              </button>
              <button 
                onClick={() => setActiveTab('script')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'script' ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,255,255,0.4)] font-semibold' : 'text-gray-400 hover:text-white'}`}
              >
                <Sparkles className="w-4 h-4" />
                AI 分鏡劇本 ⚡
              </button>
            </div>
          </div>

          {/* --- TAB CONTENT 1: NOVEL ORIGINAL TEXT --- */}
          {activeTab === 'novel' && (
            <div className="grid grid-cols-1 gap-6">
              <div className="card-neon border-neon-cyan/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">1. 原著小說文本</h3>
                    <p className="text-xs text-gray-400 mt-0.5">請在下方輸入或貼上小說原著情節，點擊儲存或點擊 AI 生成分鏡。</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleLoadSampleNovel}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Load a sample sci-fi story to test instantly"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      載入測試範例
                    </button>
                  </div>
                </div>

                <textarea
                  value={novelInputText}
                  onChange={(e) => setNovelInputText(e.target.value)}
                  placeholder="請在此貼上您的小說故事內容...
例如：
在繁華的都市霓虹下，主角凌風發現自己擁有看穿時間物理幀率的能力..."
                  className="w-full h-80 bg-black/60 border border-gray-800 text-white rounded-xl p-4 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-sm font-sans resize-y leading-relaxed mb-4"
                />

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <span className="text-xs text-gray-500">
                    字數統計: {novelInputText.length} 字
                  </span>
                  
                  <div className="flex gap-3 justify-end w-full sm:w-auto">
                    <button 
                      onClick={handleSaveNovel}
                      className="px-5 py-2.5 bg-gray-900 border border-neon-cyan/50 hover:border-neon-cyan hover:bg-black text-neon-cyan font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer w-full sm:w-auto"
                    >
                      <Save className="w-4 h-4" />
                      儲存小說文本
                    </button>
                    <button 
                      onClick={() => setActiveTab('characters')}
                      className="btn-neon px-5 py-2.5 text-sm flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      下一步：設定故事角色 👥
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB CONTENT: STORY CHARACTERS --- */}
          {activeTab === 'characters' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
              {/* Left Column: Extraction & Config */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-950 border border-neon-cyan/40 p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,255,255,0.05)]">
                  <h3 className="text-sm font-semibold uppercase text-neon-cyan tracking-wider flex items-center gap-1.5 border-b border-gray-900 pb-2.5 mb-4">
                    <Sparkles className="w-4 h-4 text-neon-cyan animate-pulse" />
                    AI 角色一致性設定
                  </h3>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    在生成劇本分鏡前，建議先提取故事中的角色。AI 將為每位角色設計專屬的<b>英文外貌特徵描述 (Visual Prompt)</b>。隨後分鏡圖生成時，將自動融合對應角色的英文外觀特徵，徹底解決人物長相不一致的問題。
                  </p>
                  
                  <button
                    onClick={handleExtractCharacters}
                    disabled={isExtractingCharacters || !novelInputText.trim()}
                    className="w-full btn-neon py-3 px-4 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExtractingCharacters ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        AI 正在分析並編寫描述中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        一鍵 AI 提取小說角色 🧬
                      </>
                    )}
                  </button>

                  <div className="mt-4 pt-4 border-t border-gray-900 flex justify-between items-center">
                    <button
                      onClick={handleAddCustomCharacter}
                      className="px-3 py-2 bg-gray-900 hover:bg-black border border-gray-800 text-gray-300 hover:text-white rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增自定義角色
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('script')}
                      className="px-4 py-2 bg-gradient-to-r from-neon-pink to-neon-cyan hover:brightness-110 text-black font-bold text-xs rounded-lg transition-all cursor-pointer shadow-md"
                    >
                      下一步：生成分鏡 →
                    </button>
                  </div>
                </div>

                {/* Info Card */}
                <div className="bg-gray-950 border border-gray-800 p-5 rounded-2xl">
                  <h4 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-neon-cyan" />
                    什麼是角色一致性？
                  </h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    在分鏡繪製中，重現同一個人物至關重要。您可以在這裡微調角色外型（如：凌風、冷霜）。
                    隨後進行分鏡圖繪製時，繪圖引擎會<b>自動提取</b>對應角色的英文外觀特徵並融合，大幅提高角色長相的連貫與一致性！
                  </p>
                </div>
              </div>

              {/* Right Column: Character List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="card-neon border-neon-pink/30 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">故事角色與一致性頭像</h3>
                      <p className="text-xs text-gray-400 mt-0.5">點擊「生成角色頭像」可預覽角色外貌，確認外貌描述是否符合期待。</p>
                    </div>
                    <span className="bg-neon-pink/10 border border-neon-pink/30 text-neon-pink px-2.5 py-1 rounded-full text-[10px] font-bold">
                      共 {(activeProject?.characters || []).length} 位角色
                    </span>
                  </div>

                  {!activeProject?.characters || activeProject.characters.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl bg-black/20">
                      <p className="text-gray-400 text-sm font-semibold">此項目目前尚未設定角色。</p>
                      <p className="text-xs text-gray-500 mt-2">請點擊左側「一鍵 AI 提取小說角色」或「手動新增」開始！</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeProject.characters.map((char, charIdx) => {
                        const isGenerating = generatingCharacterImages[charIdx];
                        return (
                          <div 
                            key={charIdx} 
                            className="bg-black/60 border border-gray-800 hover:border-neon-pink/40 rounded-xl p-5 transition-all relative flex flex-col justify-between group"
                          >
                            <button
                              onClick={() => handleDeleteCharacter(charIdx)}
                              className="absolute top-3 right-3 text-gray-500 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="刪除角色"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="space-y-4">
                              <div className="flex gap-4 items-center">
                                {/* Character Image / Placeholder */}
                                <div className="relative w-20 h-20 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {char.imageUrl ? (
                                    <img 
                                      src={char.imageUrl} 
                                      alt={char.name} 
                                      className="w-full h-full object-cover animate-fade-in"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span className="text-gray-600 font-mono text-3xl font-bold uppercase">
                                      {char.name?.charAt(0) || "👥"}
                                    </span>
                                  )}
                                  {isGenerating && (
                                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-[10px] text-neon-cyan font-semibold">
                                      <RefreshCw className="w-4 h-4 animate-spin mb-1 text-neon-cyan" />
                                      繪圖中...
                                    </div>
                                  )}
                                </div>

                                {/* Quick Editable Name & Role */}
                                <div className="flex-1 space-y-2">
                                  <div>
                                    <label className="block text-[9px] uppercase font-bold text-gray-500">角色名字</label>
                                    <input 
                                      type="text"
                                      value={char.name}
                                      onChange={(e) => handleUpdateCharacterField(charIdx, 'name', e.target.value)}
                                      className="w-full bg-transparent border-b border-gray-800 hover:border-gray-700 focus:border-neon-pink text-white text-sm font-bold py-0.5 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] uppercase font-bold text-gray-500">身份/職位描述</label>
                                    <input 
                                      type="text"
                                      value={char.role || ''}
                                      placeholder="例: 主角程序員"
                                      onChange={(e) => handleUpdateCharacterField(charIdx, 'role', e.target.value)}
                                      className="w-full bg-transparent border-b border-gray-800 hover:border-gray-700 focus:border-neon-pink text-gray-300 text-xs py-0.5 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Character Appearance description (Visual prompt) */}
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 flex justify-between">
                                  <span>英文外貌特徵描述 (Visual Prompt)</span>
                                  <span className="text-[9px] text-neon-cyan lowercase font-normal">
                                    生圖時將自動融合
                                  </span>
                                </label>
                                <textarea
                                  value={char.description || ''}
                                  placeholder="請以英文輸入角色外貌、髮色、衣著等... 例: handsome Chinese male, 20s, short black hair, wearing black hoodie"
                                  onChange={(e) => handleUpdateCharacterField(charIdx, 'description', e.target.value)}
                                  className="w-full h-20 bg-gray-950 border border-gray-800 text-gray-300 rounded-lg p-2.5 text-xs focus:outline-none focus:border-neon-pink focus:ring-1 focus:ring-neon-pink font-mono leading-normal resize-none"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => handleGenerateCharacterAvatar(charIdx)}
                              disabled={isGenerating}
                              className="mt-4 w-full py-2 bg-gray-900 hover:bg-neon-pink/10 border border-neon-pink/30 hover:border-neon-pink text-neon-pink text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Image className="w-3.5 h-3.5" />
                              {char.imageUrl ? "重新生成角色頭像" : "生成一致性角色頭像 👤"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB CONTENT 2: AI SCRIPT SPLITTER WORKFLOW --- */}
          {activeTab === 'script' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
              
              {/* Left Settings bar */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* AI Engine Configuration Card */}
                <div className="bg-gray-950 border border-neon-pink/40 p-5 rounded-2xl shadow-[0_4px_20px_rgba(255,0,255,0.05)] space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-neon-pink tracking-wider flex items-center gap-1.5 border-b border-gray-900 pb-2.5">
                    <Key className="w-4 h-4 text-neon-pink animate-pulse" />
                    AI 劇本拆解引擎設定
                  </h3>

                  {/* Provider Selector Tabs */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-900 rounded-lg">
                    <button
                      onClick={() => setLlmProvider('mistral')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        llmProvider === 'mistral'
                          ? 'bg-gradient-to-r from-neon-pink to-neon-cyan text-black shadow-md font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      🔮 Mistral AI (免費)
                    </button>
                    <button
                      onClick={() => setLlmProvider('zhipu')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        llmProvider === 'zhipu'
                          ? 'bg-gradient-to-r from-neon-pink to-neon-cyan text-black shadow-md font-bold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      🇨🇳 智譜 AI (免費)
                    </button>
                  </div>

                  {llmProvider === 'mistral' ? (
                    <div className="space-y-3.5 animate-fade-in">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        ✨ <b>Mistral 模型全免費開放</b>：Large 3、Medium 3.5、Codestral 2 零門檻供應，不需信用卡。
                      </p>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">選擇 Mistral 模型</label>
                        <select
                          value={mistralModel}
                          onChange={(e) => setMistralModel(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-800 text-white rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-neon-cyan transition-colors"
                        >
                          <option value="mistral-large-latest">Mistral Large 3 (高智能旗艦)</option>
                          <option value="mistral-medium-latest">Mistral Medium 3.5 (均衡流暢)</option>
                          <option value="codestral-latest">Codestral 2 / Devstral (專業極速)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Mistral API Key</label>
                        <input 
                          type="password" 
                          value={mistralKey}
                          onChange={(e) => setMistralKey(e.target.value)}
                          placeholder="輸入 Mistral API 密鑰"
                          className="w-full bg-gray-900 border border-neon-cyan/30 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_8px_rgba(0,255,255,0.2)] transition-all font-mono"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveApiKey(mistralKey, 'mistral')}
                          className="flex-1 py-2 bg-gray-900 hover:bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          儲存 Mistral 金鑰
                        </button>
                        <a 
                          href="https://console.mistral.ai" 
                          target="_blank" 
                          rel="noreferrer referrer" 
                          className="px-3 py-2 bg-black hover:bg-gray-900 text-gray-400 border border-gray-800 rounded-lg text-center text-xs flex items-center justify-center transition-colors"
                        >
                          官網 🌐
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5 animate-fade-in">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        🚀 智譜 AI <b>GLM-4-Flash</b> 零門檻供應，最適合中文長篇小說快速進行分鏡拆解。
                      </p>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Zhipu API Key</label>
                        <input 
                          type="password" 
                          value={zhipuKey}
                          onChange={(e) => setZhipuKey(e.target.value)}
                          placeholder="輸入智譜 API 密鑰"
                          className="w-full bg-gray-900 border border-neon-pink/30 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neon-pink focus:shadow-[0_0_8px_rgba(255,0,255,0.2)] transition-all font-mono"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleSaveApiKey(zhipuKey, 'zhipu')}
                          className="flex-1 py-2 bg-gray-900 hover:bg-neon-pink/10 border border-neon-pink/50 text-neon-pink hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          儲存智譜金鑰
                        </button>
                        <a 
                          href="https://open.bigmodel.cn" 
                          target="_blank" 
                          rel="noreferrer referrer" 
                          className="px-3 py-2 bg-black hover:bg-gray-900 text-gray-400 border border-gray-800 rounded-lg text-center text-xs flex items-center justify-center transition-colors"
                        >
                          官網 🌐
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agnes AI Video Config Card */}
                <div className="bg-gray-950 border border-neon-pink/30 p-5 rounded-2xl space-y-4 shadow-[0_4px_20px_rgba(255,0,255,0.05)]">
                  <h3 className="text-sm font-semibold uppercase text-neon-pink tracking-wider flex items-center gap-1.5 border-b border-gray-800 pb-2">
                    <Video className="w-4 h-4 text-neon-pink animate-pulse" />
                    Agnes AI 影片生成設定
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    ✨ <b>Agnes-Video-2.0 (全模態免費)</b>：新加坡 AI 實驗室提供的完全免費高清影片生成 API，Toonflow 完美串接。
                  </p>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Agnes AI API Key</label>
                    <input 
                      type="password" 
                      value={agnesKey}
                      onChange={(e) => setAgnesKey(e.target.value)}
                      placeholder="輸入 Agnes AI API Key"
                      className="w-full bg-gray-900 border border-neon-pink/30 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neon-pink focus:shadow-[0_0_8px_rgba(255,0,255,0.2)] transition-all font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleSaveAgnesKey(agnesKey)}
                      className="flex-1 py-2 bg-gray-900 hover:bg-neon-pink/10 border border-neon-pink/50 text-neon-pink hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      儲存 Agnes 金鑰
                    </button>
                    <a 
                      href="https://apihub.agnes-ai.com" 
                      target="_blank" 
                      rel="noreferrer referrer" 
                      className="px-3 py-2 bg-black hover:bg-gray-900 text-gray-400 border border-gray-800 rounded-lg text-center text-xs flex items-center justify-center transition-colors"
                    >
                      官網 🌐
                    </a>
                  </div>
                </div>

                {/* Draw Config Card */}
                <div className="bg-gray-950 border border-neon-cyan/30 p-5 rounded-2xl space-y-4 shadow-[0_4px_20px_rgba(0,255,255,0.05)]">
                  <h3 className="text-sm font-semibold uppercase text-neon-cyan tracking-wider flex items-center gap-1.5 border-b border-gray-800 pb-2">
                    <Sliders className="w-4 h-4 text-neon-cyan" />
                    分鏡繪圖 & 運鏡設定
                  </h3>

                  {/* API Choice Selection */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold text-gray-400">繪圖 API 渠道 (手機適用)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setUseFreeImageApi(true)}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 ${
                          useFreeImageApi 
                            ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' 
                            : 'bg-black/40 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>雲端免費用戶 Flux</span>
                        <span className="text-[8px] opacity-75">(推薦，手機直出)</span>
                      </button>

                      <button
                        onClick={() => {
                          setUseFreeImageApi(false);
                          showNotification("已切換為本地 Stable Diffusion WebUI 模式。請確保本地運作並開啟 --api 與 CORS 跨域權限。");
                        }}
                        className={`p-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 ${
                          !useFreeImageApi 
                            ? 'bg-neon-pink/10 border-neon-pink text-neon-pink' 
                            : 'bg-black/40 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>本地 SD 接口</span>
                        <span className="text-[8px] opacity-75">(127.0.0.1:7860)</span>
                      </button>
                    </div>
                  </div>

                  {/* Style Select dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-gray-400">分鏡美術風格</label>
                    <div className="relative">
                      <select
                        value={imageStyle}
                        onChange={(e) => {
                          setImageStyle(e.target.value);
                          showNotification(`已切換分鏡風格為: ${e.target.value}`);
                        }}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-neon-cyan cursor-pointer"
                      >
                        <option value="anime">🇯🇵 動漫卡通動感 (Anime key visual)</option>
                        <option value="3d">🎨 3D 迪士尼皮克斯 (Disney Pixar Style)</option>
                        <option value="cyberpunk">🌃 未來霓虹科幻 (Cyberpunk City Glow)</option>
                        <option value="realistic">📸 電影寫實劇照 (Photorealistic Cinematic)</option>
                        <option value="sketch">✏️ 故事繪本手繪 (Pencil Sketch Book)</option>
                      </select>
                    </div>
                  </div>

                  {/* Camera Motion Select dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-bold text-neon-cyan flex items-center gap-1">
                      <Video className="w-3 h-3 text-neon-cyan animate-pulse" />
                      模擬 3D 影片運鏡模式
                    </label>
                    <div className="relative">
                      <select
                        value={cameraMotionStyle}
                        onChange={(e) => {
                          setCameraMotionStyle(e.target.value);
                          showNotification(`已切換 3D 運鏡模式為: ${e.target.value === 'ken_burns' ? '經典推拉' : e.target.value === 'horizontal_pan' ? '橫向平移' : e.target.value === 'vertical_crane' ? '縱向升降' : e.target.value === 'push_in' ? '戲劇性推進' : '手持顫抖'}`);
                        }}
                        className="w-full bg-gray-900 border border-neon-cyan/30 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-neon-cyan cursor-pointer"
                      >
                        <option value="ken_burns">🎥 經典推拉運鏡 (Classic Ken Burns Zoom & Pan)</option>
                        <option value="horizontal_pan">↔️ 橫向平移運鏡 (Cinematic Horizontal Pan)</option>
                        <option value="vertical_crane">↕️ 縱向升降運鏡 (Dramatic Vertical Crane Lift)</option>
                        <option value="push_in">⚡ 戲劇性推進 (Dramatic Zoom Push-In)</option>
                        <option value="handheld_shake">📳 手持感微顫抖 (Dutch Tilt & Organic Handheld Shake)</option>
                      </select>
                    </div>
                  </div>

                  {/* Free API Explanation block */}
                  <div className="bg-neon-cyan/5 p-3 rounded-lg border border-neon-cyan/20 text-[11px] text-gray-300 space-y-1.5">
                    <div className="flex items-center gap-1 text-neon-cyan font-bold">
                      <Video className="w-3.5 h-3.5 text-neon-cyan" />
                      <span>💡 關於免費 AI 影片生成 API 說明</span>
                    </div>
                    <p className="leading-relaxed text-gray-400">
                      市面上的火山 <b>Seedance 2</b>, <b>Google Veo 3</b>, <b>Luma Dream Machine</b> 由於硬體算力消耗極高，皆<b>不提供</b>公開的免費調用 API Key。
                    </p>
                    <p className="leading-relaxed text-gray-400">
                      為了讓您實現完全免費，Toonflow 獨家研發了<b>「本地 100% 免費影片製作大師」</b>：利用您瀏覽器端的 HTML5 Canvas 高清渲染器 + 網頁音訊合成，一鍵將分鏡圖錄製為動態 WebM 影片！完美融合您選擇的 <b>3D 運鏡</b>、<b>男女角色配音</b>、<b>經典電影寬畫幅</b> 與 <b>自動燒錄字幕</b>，完全免 API Key、不收費！
                    </p>
                  </div>
                </div>

                {/* Trigger workflow button */}
                <div className="bg-gray-950 border border-neon-cyan/30 p-5 rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,255,255,0.05)]">
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-neon-cyan tracking-wider flex items-center gap-1.5 mb-2">
                      <Play className="w-4 h-4 text-neon-cyan" />
                      一條龍短劇工作流
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                      AI 會自動分析小說段落、識別出場人物、提取精彩對白，並為每一幕生成適合 AI 繪圖 (SD) 的<b>英文視覺描述提示詞</b>！
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className={`w-full py-3.5 px-4 font-bold rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                      isGeneratingScript 
                        ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed animate-pulse' 
                        : 'bg-gradient-to-r from-neon-pink to-neon-cyan text-black hover:shadow-[0_0_20px_rgba(0,255,255,0.5)] font-extrabold uppercase'
                    }`}
                  >
                    {isGeneratingScript ? (
                      <>
                        <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
                        AI 正在拆解劇本...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        一鍵 AI 拆解分鏡
                      </>
                    )}
                  </button>

                  {isGeneratingScript && (
                    <p className="text-[10px] text-center text-neon-cyan mt-2 animate-bounce">
                      正在調用 {llmProvider === 'zhipu' ? 'glm-4-flash' : mistralModel} 模型，預計 10-15 秒左右完成...
                    </p>
                  )}
                </div>
              </div>

              {/* Storyboard list (Right 2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="card-neon border-neon-cyan/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800 pb-4 mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Film className="text-neon-cyan w-5 h-5 animate-pulse" />
                      分鏡腳本卡片 ({activeProject?.scenes?.length || 0} 場)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Auto Play on Scroll Toggle */}
                      <button
                        onClick={() => setAutoPlayOnScroll(!autoPlayOnScroll)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-300 cursor-pointer ${
                          autoPlayOnScroll
                            ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan shadow-[0_0_10px_rgba(0,255,255,0.2)]'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                        title="當滾動到分鏡卡片時，自動播放已生成的 AI 影片（瀏覽器限制，會以靜音開始）"
                      >
                        <Video className={`w-3.5 h-3.5 ${autoPlayOnScroll ? 'animate-pulse text-neon-cyan' : ''}`} />
                        <span>滾動自動播放: {autoPlayOnScroll ? '開啟' : '關閉'}</span>
                      </button>

                      <span className="text-xs bg-gray-900 border border-gray-800 text-gray-400 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                        手機一鍵渲染已就緒
                      </span>
                    </div>
                  </div>

                  {!activeProject?.scenes || activeProject.scenes.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-xl bg-black/20">
                      <p className="text-gray-400 text-sm">尚未生成任何分鏡卡片。</p>
                      <p className="text-xs text-gray-500 mt-2">請先確認左側「AI 劇本拆解引擎設定」，並點擊「一鍵 AI 拆解分鏡」按鈕開始！</p>
                      <button 
                        onClick={() => { setActiveTab('novel'); handleLoadSampleNovel(); }} 
                        className="mt-4 px-4 py-2 bg-gray-900 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan hover:text-black rounded-lg text-xs transition-all cursor-pointer"
                      >
                        👈 返回載入測試範例
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {activeProject.scenes.map((scene: any, idx: number) => {
                        const sceneId = `scene-${idx}`;
                        const isGeneratingImg = generatingImages[sceneId];
                        const isSpeaking = speakingScenes[sceneId];
                        const isVideoPlaying = playingVideoScenes[sceneId];

                        return (
                          <div key={sceneId} className="bg-black/60 border border-neon-cyan/20 rounded-2xl p-5 hover:border-neon-cyan/50 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                            
                            {/* Scene header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-800 mb-4">
                              <div className="flex items-center gap-2.5">
                                <span className="bg-neon-cyan text-black text-xs font-bold px-2 py-0.5 rounded">
                                  場景 {scene.sceneNum || idx + 1}
                                </span>
                                <h4 className="font-bold text-white text-base">{scene.location || '場景地點'}</h4>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(scene.characters) && scene.characters.map((char: string) => (
                                  <span key={char} className="bg-gray-900 text-gray-300 border border-gray-800 text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    👤 {char}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Beautiful visual stage / Image Frame */}
                            <div className="mb-5">
                              <div className="relative w-full aspect-video rounded-xl bg-gray-950 overflow-hidden border border-gray-800/80 flex items-center justify-center">
                                
                                {scene.imageUrl ? (
                                  <div className="relative w-full h-full group overflow-hidden">
                                    {scene.aiVideoUrl ? (
                                      <SceneVideoPlayer 
                                        src={scene.aiVideoUrl}
                                        poster={scene.imageUrl}
                                        autoPlayEnabled={autoPlayOnScroll}
                                        sceneId={sceneId}
                                      />
                                    ) : (
                                      <img 
                                        src={scene.imageUrl} 
                                        alt={`Scene ${idx + 1}`}
                                        className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-in-out ${
                                          isVideoPlaying 
                                            ? cameraMotionStyle === 'horizontal_pan'
                                              ? 'scale-115 translate-x-3'
                                              : cameraMotionStyle === 'vertical_crane'
                                                ? 'scale-115 -translate-y-3'
                                                : cameraMotionStyle === 'push_in'
                                                  ? 'scale-125 duration-[2000ms]'
                                                  : cameraMotionStyle === 'handheld_shake'
                                                    ? 'animate-handheld'
                                                    : 'scale-115 translate-x-1 translate-y-1 rotate-1' // ken_burns
                                            : 'scale-100'
                                        }`}
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                    
                                    {/* Big Center Play Button (Always visible on mobile/desktop when static, hidden when playing or when real video exists) */}
                                    {!isVideoPlaying && !scene.aiVideoUrl && (
                                      <button 
                                        onClick={() => handleToggleVideoPlay(idx)}
                                        className="absolute inset-0 m-auto w-14 h-14 bg-black/70 border border-neon-pink/50 hover:border-neon-pink hover:scale-110 text-neon-pink rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,0,255,0.4)] transition-all cursor-pointer backdrop-blur-xs"
                                        title="播放 3D 鏡頭動態模擬 (火山 Seedance)"
                                      >
                                        <Play className="w-6 h-6 fill-current translate-x-0.5 text-neon-pink" />
                                      </button>
                                    )}

                                    {/* Touch-friendly full image toggle to play/pause (only when real video does not exist) */}
                                    {!scene.aiVideoUrl && (
                                      <div 
                                        className="absolute inset-0 cursor-pointer"
                                        onClick={() => handleToggleVideoPlay(idx)}
                                        style={{ height: 'calc(100% - 45px)' }} // Allows tapping the upper part of the image to toggle play
                                      />
                                    )}
 
                                    {/* Always Visible Premium Control Bar at the bottom of the image */}
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2.5 flex items-center justify-between gap-2 z-10">
                                      <span className="text-[10px] text-gray-300 font-mono tracking-wider flex items-center gap-1.5">
                                        {scene.aiVideoUrl ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-neon-pink font-bold flex items-center gap-1">
                                              <Sparkles className="w-3.5 h-3.5 animate-pulse text-neon-pink" />
                                              <span>🎬 真正 AI 影片已就緒</span>
                                            </span>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(scene.aiVideoUrl);
                                                alert('影片連結已複製到剪貼簿');
                                              }}
                                              className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                              title="複製影片連結"
                                            >
                                              <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <a 
                                              href={scene.aiVideoUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                              title="在新分頁開啟影片"
                                            >
                                              <Globe className="w-3.5 h-3.5" />
                                            </a>
                                          </div>
                                        ) : isVideoPlaying ? (
                                          <>
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                                            <span className="text-neon-pink font-bold">🎬 3D 運鏡播放中</span>
                                          </>
                                        ) : (
                                          <span className="text-gray-400">📷 靜態分鏡畫幅</span>
                                        )}
                                      </span>
                                      
                                      <div className="flex gap-1.5">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleGenerateImage(idx, scene.description);
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/60 border border-gray-800 hover:border-neon-cyan text-[11px] font-medium text-gray-300 hover:text-white rounded-lg transition-all cursor-pointer"
                                          title="重新繪製此分鏡"
                                        >
                                          <RefreshCw className={`w-3 h-3 text-neon-cyan ${isGeneratingImg ? 'animate-spin' : ''}`} />
                                          <span>重繪</span>
                                        </button>

                                        {/* Agnes AI Video Generation Button */}
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleGenerateAiVideo(idx, scene);
                                          }}
                                          disabled={videoTasks[idx]?.status === 'queued' || videoTasks[idx]?.status === 'processing'}
                                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                            videoTasks[idx]
                                              ? 'bg-neon-pink/20 border border-neon-pink text-neon-pink animate-pulse'
                                              : 'bg-neon-pink/10 border border-neon-pink/30 hover:border-neon-pink text-neon-pink hover:text-white font-bold'
                                          }`}
                                          title="調用 Agnes-Video-2.0 雲端 API 真正生成 AI 動態影片"
                                        >
                                          {videoTasks[idx] ? (
                                            <>
                                              <div className="w-3 h-3 border border-neon-pink border-t-transparent rounded-full animate-spin"></div>
                                              <span>{videoTasks[idx].status === 'queued' ? '排隊中...' : `生成中 ${videoTasks[idx].progress}`}</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-3.5 h-3.5 text-neon-pink" />
                                              <span>{scene.aiVideoUrl ? "重新 AI 生成" : "真正 AI 影片"}</span>
                                            </>
                                          )}
                                        </button>
                                        
                                        {!scene.aiVideoUrl && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleVideoPlay(idx);
                                            }}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                                              isVideoPlaying 
                                                ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]' 
                                                : 'bg-black/60 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-600'
                                            }`}
                                          >
                                            <Video className="w-3.5 h-3.5" />
                                            <span>{isVideoPlaying ? "暫停" : "播放運鏡"}</span>
                                          </button>
                                        )}
 
                                        {/* Free Dynamic Video Export Button */}
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleExportVideo(idx, scene);
                                          }}
                                          disabled={exportingVideoSceneIdx !== null}
                                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                            exportingVideoSceneIdx === idx
                                              ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan animate-pulse'
                                              : 'bg-gradient-to-r from-neon-pink to-neon-cyan border-none text-black hover:scale-105 font-bold shadow-[0_0_8px_rgba(0,255,255,0.3)]'
                                          }`}
                                          title="將當前分鏡免費渲染並下載為動態 WebM 影片檔（完美適配手機與PC）"
                                        >
                                          {exportingVideoSceneIdx === idx ? (
                                            <>
                                              <div className="w-3 h-3 border border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
                                              <span>導出中 {exportProgress}%</span>
                                            </>
                                          ) : (
                                            <>
                                              <Download className="w-3.5 h-3.5" />
                                              <span>免費導出影片</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Recording status overlay for simulated video */}
                                    {isVideoPlaying && (
                                      <div className="absolute top-3 left-3 bg-red-600/80 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 animate-pulse z-10">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                        SIM PLAYING (3D PAN)
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                                    {isGeneratingImg ? (
                                      <div className="flex flex-col items-center justify-center space-y-3">
                                        <div className="relative w-12 h-12">
                                          <div className="absolute inset-0 border-4 border-neon-cyan/20 rounded-full"></div>
                                          <div className="absolute inset-0 border-4 border-t-neon-cyan rounded-full animate-spin"></div>
                                        </div>
                                        <div>
                                          <p className="text-xs text-neon-cyan font-semibold animate-pulse">AI 雲端畫家著色中...</p>
                                          <p className="text-[10px] text-gray-500 mt-1">首次渲染需 3-5 秒，請稍候</p>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                                          <Image className="w-6 h-6 text-gray-600" />
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-400">本場景尚未繪製分鏡圖</p>
                                          <p className="text-[10px] text-gray-600 mt-0.5">點擊下方「免費繪製分鏡圖」一鍵著色</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Camera Description / SD Prompt */}
                            <div className="mb-4">
                              <label className="block text-[10px] uppercase font-bold text-neon-pink tracking-wider mb-1.5 flex justify-between items-center">
                                <span>鏡頭視覺視覺描述 & 提示詞</span>
                                <span className="text-[9px] text-gray-500 opacity-80">(支援 SD/Flux 英文提示詞)</span>
                              </label>
                              <div className="bg-gray-950/80 border border-neon-pink/20 rounded-xl p-3 flex justify-between items-start gap-4">
                                <p className="text-xs text-gray-300 leading-relaxed font-sans">{scene.description || '無描述'}</p>
                                <div className="flex flex-col gap-2 flex-shrink-0">
                                  <button 
                                    onClick={() => handleCopyText(scene.description || '', sceneId)}
                                    className="p-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-800 transition-colors cursor-pointer"
                                    title="Copy prompt for Stable Diffusion generation"
                                  >
                                    {copiedSceneId === sceneId ? (
                                      <Check className="w-4 h-4 text-neon-cyan" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                  
                                  {/* Free Render Button */}
                                  <button 
                                    onClick={() => handleGenerateImage(idx, scene.description)}
                                    disabled={isGeneratingImg}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                                      isGeneratingImg 
                                        ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' 
                                        : 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan hover:text-black hover:scale-105'
                                    }`}
                                    title="一鍵免費生成雲端分鏡圖"
                                  >
                                    <Image className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Dialogue list & speaking voices */}
                            {Array.isArray(scene.dialogue) && scene.dialogue.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    對白 & 語音旁白
                                  </label>
                                  
                                  {/* Voice play button */}
                                  <button
                                    onClick={() => handlePlayTTS(idx, scene.dialogue)}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer ${
                                      isSpeaking 
                                        ? 'bg-red-500/10 border border-red-500 text-red-500 animate-pulse' 
                                        : 'bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink hover:text-white'
                                    }`}
                                  >
                                    {isSpeaking ? (
                                      <>
                                        <VolumeX className="w-3 h-3" />
                                        停止朗讀 🔇
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="w-3 h-3 animate-bounce" />
                                        AI 語音配音 🔊
                                      </>
                                    )}
                                  </button>
                                </div>

                                <div className="space-y-2 relative">
                                  {scene.dialogue.map((dial: any, dialIdx: number) => (
                                    <div key={dialIdx} className="bg-gray-900/40 rounded-lg p-2.5 border border-gray-800/60 flex items-start gap-2.5">
                                      <span className="font-bold text-neon-cyan text-xs min-w-[65px] truncate block pt-0.5">
                                        [{dial.character}]
                                      </span>
                                      <p className="text-xs text-gray-200 leading-normal font-sans">
                                        「{dial.text}」
                                      </p>
                                    </div>
                                  ))}

                                  {/* Animated Audio bounce equalizer if speaking */}
                                  {isSpeaking && (
                                    <div className="absolute right-3 top-2 flex gap-0.5 items-end h-3">
                                      <div className="w-0.5 bg-neon-pink animate-bounce h-3"></div>
                                      <div className="w-0.5 bg-neon-pink animate-bounce h-2" style={{ animationDelay: '0.15s' }}></div>
                                      <div className="w-0.5 bg-neon-pink animate-bounce h-3" style={{ animationDelay: '0.3s' }}></div>
                                      <div className="w-0.5 bg-neon-pink animate-bounce h-1.5" style={{ animationDelay: '0.45s' }}></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Cinematic Video Prompt Helper & Generator */}
                            <div className="mt-4 pt-4 border-t border-gray-900 space-y-3">
                              <label className="block text-[10px] uppercase font-bold text-neon-cyan tracking-wider flex justify-between items-center">
                                <span className="flex items-center gap-1">
                                  <Video className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />
                                  專業級 AI 影片生成 & 運鏡對白大師
                                </span>
                                <span className="text-[9px] bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan px-2 py-0.5 rounded font-mono uppercase">
                                  支援 Seedance 2 / Veo 3 / Luma / Kling
                                </span>
                              </label>

                              <div className="bg-gray-950/40 rounded-xl p-3.5 border border-gray-800/80 space-y-3">
                                <div className="text-[11px] text-gray-400 leading-relaxed">
                                  💡 <b>影片包含動作與對角對白</b>：您可以複製下方為 <b>Seedance 2</b>, <b>Veo 3 (VideoFX)</b> 或 <b>Luma Dream Machine</b> 完美調校的「影片生成提示詞」！提示詞中自動融合了您在「故事角色與一致性頭像」中設定的人物細節特徵。
                                </div>

                                {/* Generated Video Prompt Display */}
                                <div className="bg-black/95 rounded-xl p-3 border border-gray-800/80 text-[11px] font-mono text-neon-cyan/90 break-all select-all flex justify-between items-start gap-3">
                                  <span className="leading-relaxed">
                                    {(() => {
                                      let characterContext = "";
                                      const sceneChars = scene.characters || [];
                                      if (activeProject?.characters && sceneChars.length > 0) {
                                        const foundContexts: string[] = [];
                                        sceneChars.forEach((sceneCharName: string) => {
                                          const matchChar = activeProject.characters?.find(c => c.name === sceneCharName);
                                          if (matchChar?.description) {
                                            foundContexts.push(`${matchChar.name}: ${matchChar.description}`);
                                          }
                                        });
                                        if (foundContexts.length > 0) {
                                          characterContext = `[Character consistency: ${foundContexts.join(", ")}] `;
                                        }
                                      }
                                      
                                      const cameraMotion = imageStyle === 'anime' ? "anime key visual, cinematic camera panning motion, highly detailed" : "cinematic 3d video motion, realistic details, high fidelity, 30fps";
                                      const promptText = `${characterContext}${scene.description || ""}, ${cameraMotion}`;
                                      return promptText;
                                    })()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      let characterContext = "";
                                      const sceneChars = scene.characters || [];
                                      if (activeProject?.characters && sceneChars.length > 0) {
                                        const foundContexts: string[] = [];
                                        sceneChars.forEach((sceneCharName: string) => {
                                          const matchChar = activeProject.characters?.find(c => c.name === sceneCharName);
                                          if (matchChar?.description) {
                                            foundContexts.push(`${matchChar.name}: ${matchChar.description}`);
                                          }
                                        });
                                        if (foundContexts.length > 0) {
                                          characterContext = `[Character consistency: ${foundContexts.join(", ")}] `;
                                        }
                                      }
                                      const cameraMotion = imageStyle === 'anime' ? "anime key visual, cinematic camera panning motion, highly detailed" : "cinematic 3d video motion, realistic details, high fidelity, 30fps";
                                      const promptText = `${characterContext}${scene.description || ""}, ${cameraMotion}`;
                                      handleCopyText(promptText, `${sceneId}-video-prompt`);
                                    }}
                                    className="p-2 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-800 flex-shrink-0 transition-colors cursor-pointer"
                                    title="複製帶角色特徵的影片提示詞"
                                  >
                                    {copiedSceneId === `${sceneId}-video-prompt` ? (
                                      <Check className="w-3.5 h-3.5 text-neon-cyan animate-bounce" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Direct launch links to major Free video sites */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5">
                                  <a
                                    href="https://seedance2.ai"
                                    target="_blank"
                                    rel="noreferrer referrer"
                                    className="py-2 bg-gray-900 hover:bg-neon-cyan/10 border border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan text-[10px] font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 shadow-xs"
                                    title="Seedance 2 AI 影片生成（熱門推薦）"
                                  >
                                    🚀 Seedance 2
                                  </a>
                                  <a
                                    href="https://aitestkitchen.withgoogle.com/tools/video-fx"
                                    target="_blank"
                                    rel="noreferrer referrer"
                                    className="py-2 bg-gray-900 hover:bg-neon-pink/10 border border-neon-pink/40 hover:border-neon-pink text-neon-pink text-[10px] font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 shadow-xs"
                                    title="Google VideoFX (Veo 3) 免費創作空間"
                                  >
                                    🔮 Google Veo 3
                                  </a>
                                  <a
                                    href="https://lumalabs.ai/dream-machine"
                                    target="_blank"
                                    rel="noreferrer referrer"
                                    className="py-2 bg-gray-900 hover:bg-yellow-500/10 border border-yellow-500/40 hover:border-yellow-500 text-yellow-500 text-[10px] font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 shadow-xs"
                                    title="Luma Dream Machine 免費渲染器"
                                  >
                                    ⚡ Luma Labs
                                  </a>
                                  <a
                                    href="https://klingai.com"
                                    target="_blank"
                                    rel="noreferrer referrer"
                                    className="py-2 bg-gray-900 hover:bg-green-500/10 border border-green-500/40 hover:border-green-500 text-green-500 text-[10px] font-bold rounded-lg text-center transition-all flex items-center justify-center gap-1 shadow-xs"
                                    title="Kling AI 快手可靈免費通道"
                                  >
                                    🌟 Kling AI
                                  </a>
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* --- CREATE PROJECT DIALOG MODAL --- */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-950 border border-neon-pink p-6 rounded-2xl w-full max-w-md shadow-[0_0_25px_rgba(255,0,255,0.3)]">
            <h3 className="text-xl font-bold text-white mb-2 neon-glow flex items-center gap-2">
              <Plus className="text-neon-pink w-5 h-5" />
              New Animation Project
            </h3>
            <p className="text-sm text-gray-400 mb-6">Enter a title for your new animation workflow.</p>
            
            <form onSubmit={handleCreateNew}>
              <div className="mb-6">
                <label className="block text-xs uppercase font-semibold text-neon-cyan mb-2">Project Name</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. My Awesome Short Film"
                  className="w-full bg-gray-900 border border-neon-cyan/40 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_10px_rgba(0,255,255,0.3)] transition-all"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setNewProjectName(''); }}
                  className="px-4 py-2 border border-gray-800 rounded-xl hover:bg-gray-900 transition-colors text-sm text-gray-400"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-neon px-5 py-2 text-sm flex items-center gap-2"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG MODAL --- */}
      {projectToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-950 border border-red-500/60 p-6 rounded-2xl w-full max-w-md shadow-[0_0_25px_rgba(239,68,68,0.2)]">
            <h3 className="text-xl font-bold text-red-500 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Project
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete <span className="text-white font-semibold">"{projectToDelete.name}"</span>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 border border-gray-800 rounded-xl hover:bg-gray-900 transition-colors text-sm text-gray-400"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteProject}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors text-sm flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
