async function testTensorHeader() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  try {
    const res = await fetch("https://api.tensor.art/v1/jobs", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorHeader();
