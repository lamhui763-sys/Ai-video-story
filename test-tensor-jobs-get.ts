async function testTensorArtJobsGet() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  try {
    const res = await fetch("https://api.tensor.art/v1/jobs", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    console.log("Jobs GET response status:", res.status);
    const text = await res.text();
    console.log("Jobs GET response text:", text);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorArtJobsGet();
