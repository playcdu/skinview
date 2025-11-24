# 3D Skin Viewer - Multi-Character Animation (React)

An animated React website featuring multiple Minecraft skins walking around in 3D space using the skinview3d library. Characters move independently with collision avoidance, creating a dynamic "ants" view from a fixed camera perspective.

## Features

- 🎮 3D Minecraft skin rendering with multiple characters (1-100)
- 🚶 Custom walking animation without head bobbing
- 🌐 Characters move independently in 3D space with collision avoidance
- 🏷️ Nametags displayed above each character
- 🎚️ Slider control to adjust number of characters (1-100)
- 🎨 Starfield background for depth perception
- 📷 Fixed camera at 45-degree angle, 500m away
- 🔄 Center repulsion system to prevent clumping
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
2. Characters will automatically load and start walking around the 3D space
3. Use the slider at the top to adjust the number of characters (1-100)
4. Characters automatically avoid each other and the center to prevent clumping
5. Each character displays a nametag above their head

## Project Structure

```
skinview/
├── src/
│   ├── components/
│   │   ├── SkinViewer.jsx      # Main skin viewer component with multi-character logic
│   │   ├── SkinViewer.css      # Component styles
│   │   ├── NameTagObject.js    # Custom nametag implementation
│   │   ├── Starfield.jsx       # Starfield background component
│   │   └── Starfield.css       # Starfield styles
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── vite.config.js              # Vite configuration with proxy for skin API
└── README.md                    # This file
```

## Technologies Used

- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [skinview3d](https://github.com/bs-community/skinview3d) - 3D Minecraft skin viewer library
- [Three.js](https://threejs.org/) - 3D graphics library (via skinview3d)
- HTML5 Canvas
- CSS3

## Technical Details

### Character System
- Characters are fetched from `https://craftdownunder.co/auth/public/featured-users`
- Each character loads its unique skin from `https://heads.playcdu.co/skin/{identifier}`
- Characters spawn in a circular distribution pattern to avoid center bias
- Each character has independent movement, animation state, and collision avoidance

### Movement & Animation
- Custom `WalkingAnimationNoHeadBob` function prevents head bobbing
- Characters move towards random targets in a circular area (50-200 units radius)
- Collision avoidance system keeps characters at least 40 units apart
- Center repulsion pushes characters away from the center when within 50 units
- Turn speed is clamped to prevent rapid flip-flopping when avoiding multiple characters
- Animation runs at 24fps for consistent performance

### Camera
- Fixed camera positioned at 45-degree angle, 500m away from origin
- Field of view set to 120 degrees for wide-angle view
- Zoom level: 0.0000002 (extremely zoomed out for "ants" view)
- Camera does not follow characters - provides a fixed room perspective

### Performance
- Frame rate throttled to 24fps for consistent animation
- Characters are rendered efficiently using shared textures where possible
- Capes and elytra are disabled for all characters to improve performance

## Configuration

### Adjusting Character Count
Use the slider at the top of the screen to control the number of characters (1-100).

### Movement Speed
Edit `baseMoveSpeed` in `src/components/SkinViewer.jsx` (currently `2.0`).

### Animation Speed
Edit `animSpeed` values in `src/components/SkinViewer.jsx` (currently `0.87285`).

### Camera Position
Edit camera position in `src/components/SkinViewer.jsx`:
- `cameraDistance`: Currently `500`
- `angle45`: Currently `Math.PI / 4` (45 degrees)
- `skinViewer.zoom`: Currently `0.0000002`

## Notes

- Skins are loaded from `https://heads.playcdu.co/skin/{identifier}` API
- Character data is fetched from `https://craftdownunder.co/auth/public/featured-users`
- The animation uses custom walking animation without head bobbing for smoother movement
- Built with React hooks for state management and extensibility
- Ready to be extended with more complex features
