# AR Language Learning Assistant

An Augmented Reality desktop app that uses your camera to detect objects in real-time and teaches you vocabulary in 7 languages.

**ARVR Course 2025–26**

## Features

- Real-time object detection using COCO-SSD (TensorFlow.js)
- Vocabulary cards with translations, phonetics, and definitions
- Audio pronunciation (text-to-speech)
- Quiz mode to test your knowledge
- Progress tracking
- 7 languages: English, French, Spanish, Hindi, Marathi, Japanese, Arabic

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- A webcam

## Installation & Running

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ar-language-learning-assistant.git
cd ar-language-learning-assistant

# Install dependencies
npm install

# Run the app
npm start
```

## How to Use

1. Launch the app with `npm start`
2. Select the language you want to learn
3. Click **Start AR Camera**
4. Point your camera at objects — the app will detect them and show vocabulary labels
5. Click any label to open a vocabulary card with translation, definition, and audio
6. Use **Quiz Mode** to test yourself on detected objects
7. Track your progress with the **Progress** screen

## Detectable Objects

The app recognises 80+ COCO-SSD object classes including: person, laptop, phone, chair, bottle, cup, book, keyboard, mouse, car, bicycle, dog, cat, and many more.

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop wrapper
- [TensorFlow.js](https://www.tensorflow.org/js) — ML inference in the browser
- [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) — object detection
- Vanilla JS / HTML / CSS

## Building a Standalone Executable

```bash
npm run build
```

The installer will be created in the `dist/` folder.
