async function testTensorArt() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  try {
    const res = await fetch("https://api.tensor.art/v1/billing/status", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    console.log("Billing status response code:", res.status);
    const json = await res.json();
    console.log("Billing response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorArt();
