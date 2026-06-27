async function checkStatus() {
  const apiKey = "sk-vpH23xzs2wpkh6FZnTMo4DgejsPg4ZA4RJbwWl4mw5QgtoWg";
  const taskId = "task_kDe4ui1Ei1lWIFj2SK0UL9UiZupVmibV";
  
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`https://apihub.agnes-ai.com/v1/video/generations/${taskId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      const json = await res.json();
      const status = json.data?.status || json.data?.data?.status;
      console.log(`Poll #${i+1} | Status: ${status} | Progress: ${json.data?.progress}`);
      
      if (status === "SUCCESS" || status === "success" || status === "completed" || json.data?.data?.video || json.data?.data?.url || json.data?.data?.video_url) {
        console.log("SUCCESS! Completed JSON:");
        console.log(JSON.stringify(json, null, 2));
        break;
      }
      if (status === "FAIL" || status === "fail" || status === "failed") {
        console.log("FAILED! JSON:");
        console.log(JSON.stringify(json, null, 2));
        break;
      }
    } catch (err: any) {
      console.log("Error:", err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
checkStatus();
