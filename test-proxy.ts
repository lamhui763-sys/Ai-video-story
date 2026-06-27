async function testProxy() {
  try {
    const res = await fetch("http://localhost:3000/api/tensor-art/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A",
        requestId: "test-req-123",
        stages: [
          {
            type: "INPUT_INITIAL",
            input: {
              prompts: "A simple cat",
              width: 512,
              height: 512
            }
          }
        ]
      })
    });
    console.log("Proxy response status:", res.status);
    const json = await res.json();
    console.log("Proxy response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testProxy();
