# 3D Skin Viewer - Walking Animation (React)

An animated React website featuring your Minecraft skin walking around the screen in 3D space using the skinview3d library.

## Features

- 🎮 3D Minecraft skin rendering
- 🚶 Walking animation
- 🌐 Skin moves around the screen in 3D space
- 🎨 Beautiful gradient background
- 🖱️ Interactive controls (rotate, zoom)
- ⏸️ Pause/Resume functionality
- 🔄 Reset position button
- ⚛️ Built with React for easy extensibility

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## How to Use

1. Start the development server with `npm run dev`
2. Your skin will automatically load and start walking around the screen
3. Use your mouse to rotate and zoom the skin
4. Click "Pause" to pause the animation
5. Click "Reset Position" to reset the camera and animation position

## Project Structure

```
skinview/
├── src/
│   ├── components/
│   │   ├── SkinViewer.jsx      # Main skin viewer component
│   │   └── SkinViewer.css      # Component styles
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── vite.config.js               # Vite configuration
└── README.md                    # This file
```

## Technologies Used

- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [skinview3d](https://github.com/bs-community/skinview3d) - 3D Minecraft skin viewer library
- HTML5 Canvas
- CSS3 Animations

## Notes

- The skin is loaded from Crafatar using your UUID (`1418475b-1029-4a9a-af78-fbf5d59dfee2`)
- The animation uses CSS keyframes for screen movement and skinview3d for 3D rendering
- Built with React hooks for easy state management and extensibility
- Ready to be extended with more complex features

