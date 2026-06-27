async function testTensorArtSearch() {
  const apiKey = "ak_tensor_M0l2M4E0AEAzc5RMMVIqv7-N5k4XVBYBtWGwq6VQC3A";
  try {
    const res = await fetch("https://api.tensor.art/v1/models/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        keyword: "flux"
      })
    });
    console.log("Search response code:", res.status);
    const json = await res.json();
    console.log("Search response:", JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorArtSearch();
