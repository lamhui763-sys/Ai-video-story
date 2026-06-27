async function testTrailing() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  const urls = [
    "https://api.tensor.art/v1/jobs",
    "https://api.tensor.art/v1/jobs/",
    "https://api.tensor.art/v1/models",
    "https://api.tensor.art/v1/models/"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
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
      console.log(`POST ${url} status:`, res.status);
      const text = await res.text();
      console.log(`Response:`, text.substring(0, 200));
    } catch (err: any) {
      console.error(`Error for ${url}:`, err.message);
    }
  }
}
testTrailing();
