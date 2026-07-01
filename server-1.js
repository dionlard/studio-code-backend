const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;

// ============ ROUTE TEXTE (Claude) ============
app.post("/generate", async (req, res) => {
  const { serie, format, ton, details } = req.body;

  if (!serie || !format || !ton) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  const prompt = `Tu es un expert en création de contenu pour TikTok, Instagram Reels et YouTube Shorts.
Génère un ${format} pour la série "${serie}" avec un ton ${ton}.
${details ? `Détails : ${details}` : ""}
Formate ta réponse de façon professionnelle et prête à l'emploi. Réponds en français.`;

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
    res.status(500).json({ error: "Erreur génération texte" });
  }
});

// ============ ROUTE VIDÉO (Runway ML) ============
app.post("/generate-video", async (req, res) => {
  const { prompt, duration = 5 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt manquant" });
  }

  try {
    // Étape 1 — Créer la tâche de génération vidéo
    const createResponse = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen4_turbo",
        promptText: prompt,
        duration: duration,
        ratio: "9:16", // Format vertical TikTok/Reels
      }),
    });

    const createData = await createResponse.json();

    if (!createData.id) {
      return res.status(500).json({ error: "Erreur création tâche Runway", details: createData });
    }

    const taskId = createData.id;

    // Étape 2 — Attendre que la vidéo soit prête (polling)
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 tentatives max (environ 5 minutes)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Attendre 10 secondes

      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "X-Runway-Version": "2024-11-06",
        },
      });

      const statusData = await statusResponse.json();

      if (statusData.status === "SUCCEEDED") {
        videoUrl = statusData.output?.[0];
        break;
      } else if (statusData.status === "FAILED") {
        return res.status(500).json({ error: "Génération vidéo échouée", details: statusData });
      }

      attempts++;
    }

    if (!videoUrl) {
      return res.status(408).json({ error: "Timeout — la vidéo prend trop de temps" });
    }

    res.json({ videoUrl, taskId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur génération vidéo" });
  }
});

// ============ ROUTE STATUT VIDÉO ============
app.get("/video-status/:taskId", async (req, res) => {
  const { taskId } = req.params;

  try {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": "2024-11-06",
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erreur statut vidéo" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Studio CODE backend lancé sur le port ${PORT}`));
