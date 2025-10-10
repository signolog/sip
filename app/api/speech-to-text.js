export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Speech-to-text API çağrıldı");

    // FormData'yı doğrudan PHP'ye forward edin
    const formData = new FormData();

    // Request'den audio blob'u al
    const buffer = Buffer.from(await req.arrayBuffer());
    const blob = new Blob([buffer], { type: "audio/webm" });
    formData.append("audio", blob, "voice.webm");

    const response = await fetch("https://signolog.com/controllers/chat.php?action=speech-to-text", {
      method: "POST",
      body: formData,
    });

    console.log("PHP API response status:", response.status);

    if (!response.ok) {
      throw new Error(`PHP API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("PHP API response:", data);

    return res.json(data);
  } catch (error) {
    console.error("API Route error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
