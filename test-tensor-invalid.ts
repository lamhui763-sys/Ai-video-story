async function testTensorArtInvalid() {
  const apiKey = "invalid-key-example-1234";
  try {
    const res = await fetch("https://api.tensor.art/v1/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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
    console.log("Response status:", res.status);
    const json = await res.json();
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorArtInvalid();
