async function testTensorArtJobs() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  try {
    const res = await fetch("https://api.tensor.art/v1/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestId: "test-request-id-123456",
        stages: [
          {
            type: "INPUT_INITIAL",
            input: {
              prompts: "A cute fluffy anime cat sitting on a desk, soft warm lighting, highest quality, masterpiece",
              width: 512,
              height: 512
            }
          }
        ]
      })
    });
    console.log("Jobs response status:", res.status);
    const json = await res.json();
    console.log("Jobs response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorArtJobs();
