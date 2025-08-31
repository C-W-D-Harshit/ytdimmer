# 🛡️ YT Dimmer – Smart Brightness Control

![Preview](public/preview.gif)

**Protect your eyes from sudden bright flashes and eye strain while watching videos.**

YT Dimmer is a Chrome extension that automatically detects bright content in videos and dims them in real-time to prevent eye strain, especially when watching in dark environments.

## ✨ Features

- **🔍 Real-time Brightness Detection** - Analyzes video frames at 30 FPS using advanced algorithms
- **⚡ Instant Flash Protection** - Immediately dims videos when brightness spikes occur
- **🎛️ Customizable Controls** - Adjust brightness trigger sensitivity and dim strength
- **🌐 Universal Support** - Works on YouTube, Twitch, Vimeo, and all other video sites
- **🎯 Performance Optimized** - Efficient monitoring with no video lag or interruption
- **🎨 Beautiful UI** - Modern dark theme with intuitive controls
- **💾 Sync Settings** - Your preferences sync across all your devices

## 🎮 How It Works

1. **Detection**: Continuously monitors video brightness using canvas sampling
2. **Protection**: When brightness exceeds your threshold, applies CSS filter dimming
3. **Recovery**: Smoothly returns to normal when content gets darker
4. **Customization**: Adjust both trigger sensitivity and dim strength to your preference

## 🚀 Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "YTDimmer"
3. Click "Add to Chrome"

### Manual Installation (Development)

1. Clone this repository:

   ```bash
   git clone https://github.com/c-w-d-harshit/ytdimmer.git
   cd ytdimmer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` folder

## 🎛️ Settings

### Brightness Trigger

Controls when dimming activates:

- **Very Low (0.1)** - Dims almost all bright content
- **Medium (0.6)** - Balanced protection (default)
- **Very High (1.0)** - Only extremely bright flashes

### Dim Strength

Controls how much videos are dimmed:

- **Light (0.1)** - Subtle dimming
- **Moderate (0.5)** - Balanced dimming (default)
- **Maximum (0.9)** - Heavy dimming for maximum protection

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Commands

```bash
# Development server
npm run dev

# Development with Firefox
npm run dev:firefox

# Build for production
npm run build

# Build for Firefox
npm run build:firefox

# Type checking
npm run compile

# Create distributable ZIP
npm run zip
```

### Tech Stack

- **Framework**: [WXT](https://wxt.dev) - Modern web extension development
- **UI**: React 19 with TypeScript
- **Styling**: CSS Custom Properties with OKLCH colors
- **APIs**: Chrome Extension APIs via WXT's unified browser API
- **Build**: Vite for fast development and optimized builds

### Architecture

```bash
ytdimmer/
├── entrypoints/
│   ├── background.ts      # Service worker for settings management
│   ├── content.ts         # Video monitoring and dimming logic
│   └── popup/            # Extension popup interface
│       ├── App.tsx       # Main React component
│       ├── App.css       # Styled with CSS variables
│       └── main.tsx      # React entry point
├── public/               # Extension icons and assets
└── wxt.config.ts        # Extension configuration
```

## 🔒 Privacy & Security

- **No Data Collection** - YTDimmer doesn't collect or transmit any user data
- **Local Processing** - All video analysis happens locally on your device
- **Minimal Permissions** - Only requests necessary permissions for functionality
- **Open Source** - Full source code available for transparency

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Areas for Contribution

- 🐛 Bug fixes and improvements
- 🌟 New features (white flash detection, custom profiles, etc.)
- 📚 Documentation improvements
- 🌍 Internationalization support
- 🎨 UI/UX enhancements

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [WXT](https://wxt.dev) - Amazing web extension framework
- UI inspired by modern design systems
- Color palette using OKLCH for perceptual uniformity

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/c-w-d-harshit/ytdimmer/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/c-w-d-harshit/ytdimmer/discussions)
- 📧 **Email**: <support@ytdimmer.com>

---

**Made with ❤️ for developers who care about eye health**
