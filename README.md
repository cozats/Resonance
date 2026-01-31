# Resonance 🎙️

**Local AI-powered transcription for creators and professionals.**

Resonance is a desktop application that provides high-quality audio and video transcription completely offline, using OpenAI's Whisper models. No data ever leaves your computer, ensuring total privacy and security for your sensitive recordings.

![Resonance Preview](assets/resonance_preview.png)

## ✨ Features

- 🔒 **100% Private**: All processing happens locally on your machine. No cloud uploads.
- ⚡ **High Performance**: Optimized using Apple Silicon acceleration for instant results.
- 📁 **Native Integration**: Native file browsers and folder pickers with full macOS permissions.
- 📝 **Multiple Formats**: Export transcripts as `.srt` (subtitles), `.md` (Markdown), or `.txt` (Plain Text).
- 🌍 **Multi-language Support**: Auto-detects and transcribes over 90 languages.
- 🔥 **No Subscriptions**: Free and open-source. Buy the hardware, own the AI.

## 🚀 Getting Started

### Prerequisites

- macOS (Intel or Apple Silicon)
- Python 3.9+
- [ffmpeg](https://ffmpeg.org/) installed (`brew install ffmpeg`)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/cozats/Resonance.git
   cd resonance
   ```

2. Fix npm permissions (if needed):
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the app:
   ```bash
   npm start
   ```

### 📦 Building the App

To create a standalone `.dmg` for distribution (macOS):
```bash
npm run build
```

### 🚀 Releasing a New Version

Resonance uses GitHub Actions to automatically build and release the app for **macOS, Windows, and Linux**.

1. Update the version in `package.json` (e.g., `"1.0.0"`).
2. Commit and push your changes.
3. Create a new Git tag matching the version:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. GitHub Actions will detect the tag, build all versions, and create a new **Release** in your repository.

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript
- **Backend**: Electron.js
- **ML Engine**: OpenAI Whisper (Python Subprocess)
- **Styling**: Google Fonts (Space Grotesk), Material Design Icons

---

Made with ❤️ by [Your Name]
