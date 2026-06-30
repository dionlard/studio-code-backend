// Backend pour Studio CODE — sécurise la clé API Anthropic
// L'app mobile appelle CE serveur, jamais directement l'API Anthropic.

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // dans ton .env, jamais dans le code

app.post("/generate", async (req, res) => {
  const { serie, format, ton, details } = req.body;

  if (!serie || !format || !ton) {
    return res.status(400).json({ error: "Paramètres manquants (serie, format, ton requis)" });
  }

  const prompt = `Tu es un expert en création de contenu pour TikTok, Instagram Reels et YouTube Shorts.
Génère un ${format} pour la série "${serie}" avec un ton ${ton}.
${details ? `Détails supplémentaires : ${details}` : ""}
Formate ta réponse de façon professionnelle et prête à l'emploi, avec des indications de mise en scène si c'est un script. Réponds en français.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text || "";

    res.json({ content: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la génération" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Studio CODE backend lancé sur le port ${PORT}`));
