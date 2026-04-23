# AR Language Learning Assistant

> Point your camera at real-world objects and instantly learn vocabulary in 7 languages — with pronunciation, definitions, and a built-in quiz.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.10-FF6F00?logo=tensorflow)
![Languages](https://img.shields.io/badge/languages-7-green)

---

## What It Does

- **Live Object Detection** — AI scans your webcam feed in real time using COCO-SSD (80 classes) + MobileNet (1000 classes)
- **AR Vocabulary Overlay** — Labels appear directly on detected objects with their name in your chosen language
- **7 Languages** — English 🇬🇧, French 🇫🇷, Spanish 🇪🇸, Hindi 🇮🇳, Marathi 🇮🇳, Japanese 🇯🇵, Arabic 🇸🇦
- **Pronunciation** — Tap the 🔊 button to hear any word spoken aloud
- **Vocabulary Cards** — See translation, phonetic spelling, definition, and example sentence
- **Quiz Mode** — Test yourself on words you've encountered
- **Progress Tracker** — Track all words seen and learned across sessions

---

## Installation (Windows)

### Option A — Installer (Recommended)

1. Go to the [**Releases**](../../releases) page
2. Download **`AR Language Learning Assistant Setup 1.0.0.exe`**
3. Double-click the downloaded file
4. Click **Next** → choose your install folder → click **Install**
5. Launch from your **Start Menu** or **Desktop shortcut**

### Option B — Portable (No Installation)

1. Go to the [**Releases**](../../releases) page
2. Download **`AR Language Learning Assistant-Portable-1.0.0.exe`**
3. Double-click to run — no installation needed
4. Works from a USB drive or any folder

---

## System Requirements

| Requirement | Minimum |
|---|---|
| **OS** | Windows 10 (64-bit) or later |
| **RAM** | 4 GB (8 GB recommended) |
| **Webcam** | Any USB or built-in camera |
| **Internet** | Required on first launch (downloads AI model weights ~50 MB) |
| **Storage** | 500 MB free space |

> **Note:** The AI models (TensorFlow.js COCO-SSD + MobileNet) are downloaded from Google's servers on first launch and then cached locally. Subsequent launches work faster.

---

## First Launch Guide

1. Open the app — you'll see the **Home Screen** with your stats
2. Select your **target language** from the dropdown (e.g. Hindi, French, etc.)
3. Tap **📷 Start AR Camera** — allow camera access when prompted
4. Wait ~15–30 seconds for AI models to load (one-time download)
5. **Point your camera** at any object — labels appear automatically!
6. **Tap a label** to open the full vocabulary card
7. Use **Quiz Mode** to test your knowledge

---

## How It Works

```
Webcam Feed
    │
    ├── COCO-SSD (every frame)     → Bounding boxes on 80 object types
    └── MobileNet (every 5 frames) → Scene recognition across 1000 classes
            │
            ▼
    Vocabulary Database (200+ entries + auto-generation for unknown words)
            │
            ▼
    AR Overlay + Vocab Card + Text-to-Speech (Web Speech API)
```

---

## Running from Source

If you'd like to run or modify the app from source code:

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A webcam

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Rishabh-11-bit/ar-language-learning-assistant.git
cd ar-language-learning-assistant

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Run the app
npm start
```

### Build your own .exe

```bash
# Installer + Portable .exe (output goes to /dist folder)
npm run build
```

---

## Supported Languages

| Code | Language | TTS Locale |
|------|----------|------------|
| `en` | English 🇬🇧 | `en-US` |
| `fr` | French 🇫🇷 | `fr-FR` |
| `es` | Spanish 🇪🇸 | `es-ES` |
| `hi` | Hindi 🇮🇳 | `hi-IN` |
| `mr` | Marathi 🇮🇳 | `mr-IN` |
| `ja` | Japanese 🇯🇵 | `ja-JP` |
| `ar` | Arabic 🇸🇦 | `ar-SA` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Runtime | Electron 28 |
| Object Detection | TensorFlow.js + COCO-SSD |
| Scene Recognition | TensorFlow.js + MobileNet |
| Speech | Web Speech API |
| Storage | localStorage |
| UI | HTML / CSS / Vanilla JS |

---

## Project Structure

```
ar-language-learning-assistant/
├── main.js              # Electron main process
├── index.html           # App UI (5 screens)
├── style.css            # Dark theme styles
├── js/
│   ├── app.js           # ARApp class — all camera & detection logic
│   └── vocabulary.js    # 200+ word database in 7 languages
├── package.json
└── dist/                # Built .exe files (after npm run build)
```

---

## Troubleshooting

**Camera not detected?**
- Make sure no other app (Zoom, Teams, etc.) is using your camera
- Restart the app and allow camera permission when asked

**"Models loading…" stuck for more than 2 minutes?**
- Check your internet connection — AI model weights download from Google on first launch
- Try restarting the app

**Labels not appearing?**
- Ensure good lighting — the AI works better in well-lit environments
- Point the camera steadily at objects for 1–2 seconds

---

*Built for ARVR Course 2025–26*
