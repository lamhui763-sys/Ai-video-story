async function check() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const taskId = "task_kDe4ui1Ei1lWIFj2SK0UL9UiZupVmibV";
  try {
    const res = await fetch(`https://apihub.agnes-ai.com/v1/video/generations/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
check();
