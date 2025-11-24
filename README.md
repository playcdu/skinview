# 3D Skin Viewer - Real-Time Online Players (React)

An animated React website featuring all online Minecraft players from Craft Down Under servers walking around in 3D space using the skinview3d library. Characters sync in real-time with the server API, move independently with collision avoidance, and occasionally wave at the camera.

## Features

- 🎮 **Real-Time Player Sync** - Automatically fetches and displays all online players from Craft Down Under servers
- 🚶 **Custom Walking Animation** - Smooth walking animation without head bobbing
- 👋 **Wave Animation** - Characters occasionally stop, face the camera, and wave for 4-6 seconds
- 🌐 **Independent Movement** - Characters move independently in 3D space with collision avoidance
- 🏷️ **Nametags** - Player usernames displayed above each character
- 💬 **Live Chatbox** - Shows login/logout messages in real-time (bottom-right corner)
- ℹ️ **Info Box** - Displays "You're looking at everybody online on Craft Down Under right now!" (top-center)
- 🎨 **Starfield Background** - Animated starfield for depth perception
- 📷 **Fixed Camera** - 45-degree angle view, 500m away (no controls)
- 🔄 **Seamless Updates** - Characters spawn/despawn without page refresh or animation reset
- ⚛️ **Built with React** - Modern React hooks for state management

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

## How It Works

1. **Initial Load**: Fetches all online players from `https://api.playcdu.co/query` and spawns them in the 3D scene
2. **Real-Time Sync**: Every 5 seconds, the app checks for new players and removes offline players
3. **Seamless Updates**: Characters are added/removed without resetting animations or positions of other characters
4. **Chat Messages**: Login/logout messages appear in the chatbox (no messages on initial load)
5. **Automatic Animation**: Characters walk around, avoid each other, and occasionally wave at the camera

## Project Structure

```
skinview/
├── src/
│   ├── components/
│   │   ├── SkinViewer.jsx      # Main component with real-time player sync
│   │   ├── SkinViewer.css      # Component styles (chatbox, info box)
│   │   ├── NameTagObject.js    # Custom nametag implementation
│   │   ├── Starfield.jsx       # Starfield background component
│   │   └── Starfield.css       # Starfield styles
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── vite.config.js              # Vite configuration
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

### Real-Time Player Sync
- Fetches online players from `https://api.playcdu.co/query` every 5 seconds
- Extracts usernames from all servers in the response
- Uses usernames (case-sensitive) as identifiers for skin loading
- Seamlessly adds new characters when players join
- Seamlessly removes characters when players leave
- No page refresh or animation reset during sync

### Character System
- Each character loads its unique skin from `https://heads.playcdu.co/skin/{username}`
- Characters spawn in a circular distribution pattern to avoid center bias
- Each character has independent movement, animation state, and collision avoidance
- Characters maintain their state (position, animation) when other players join/leave

### Movement & Animation
- Custom `WalkingAnimationNoHeadBob` function prevents head bobbing
- Characters move towards random targets in a circular area (50-200 units radius)
- Collision avoidance system keeps characters at least 50 units apart
- Center repulsion pushes characters away from the center when within 60 units
- Turn speed is clamped to prevent rapid flip-flopping when avoiding multiple characters
- **Wave Animation**: Characters occasionally stop, face camera, and wave for 4-6 seconds
- Animation runs at 24fps for consistent performance

### Camera
- Fixed camera positioned at 45-degree angle, 500m away from origin
- Field of view set to 120 degrees for wide-angle view
- Zoom level: 0.0000002 (extremely zoomed out for "ants" view)
- Camera does not follow characters - provides a fixed room perspective
- No user controls - fully automatic

### Chatbox
- Positioned in bottom-right corner
- Shows "{username} Logged in!" messages (green border)
- Shows "{username} Logged out!" messages (red border)
- Keeps last 50 messages
- Auto-scrolls to show new messages
- No messages shown on initial load (only changes after)

### Info Box
- Positioned at top-center of screen
- Displays: "You're looking at everybody online on Craft Down Under right now!"
- Semi-transparent dark background with blur effect

### Performance
- Frame rate throttled to 24fps for consistent animation
- Characters are rendered efficiently using unique textures per character
- Capes and elytra are disabled for all characters to improve performance
- Efficient resource cleanup when characters are removed

## Configuration

### Sync Interval
Edit the sync interval in `src/components/SkinViewer.jsx`:
```javascript
syncIntervalRef.current = setInterval(() => {
  syncCharacters()
}, 5000) // Currently 5 seconds
```

### Movement Speed
Edit `baseMoveSpeed` in `src/components/SkinViewer.jsx` (currently `2.0`).

### Animation Speed
Edit `animSpeed` values in `src/components/SkinViewer.jsx` (currently `0.87285`).

### Wave Animation
- Wave duration: `2.5 + Math.random() * 1.5` (4-6 seconds)
- Wave chance: 40% when timer expires
- Wave timer: 10-30 seconds between opportunities

### Camera Position
Edit camera position in `src/components/SkinViewer.jsx`:
- `cameraDistance`: Currently `500`
- `angle45`: Currently `Math.PI / 4` (45 degrees)
- `skinViewer.zoom`: Currently `0.0000002`

## API Endpoints

- **Online Players**: `https://api.playcdu.co/query` - Returns array of server objects with `onlinePlayerList`
- **Skin Loading**: `https://heads.playcdu.co/skin/{username}` - Loads Minecraft skin by username (case-sensitive)

## Notes

- Skins are loaded using usernames (case-sensitive) from the API
- Characters sync every 5 seconds automatically
- No user controls - the experience is fully automatic
- Chat messages only appear for players who join/leave after initial load
- Characters maintain their positions and animations when other players sync
- Built with React hooks for state management and extensibility
- Ready for deployment to Cloudflare Pages or similar static hosting
