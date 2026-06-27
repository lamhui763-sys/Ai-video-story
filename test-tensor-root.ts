async function testTensorRoot() {
  try {
    const res = await fetch("https://api.tensor.art/");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
testTensorRoot();
