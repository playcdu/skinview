# 3D Skin Viewer - Real-Time Online Players (React)

An animated React website featuring all online Minecraft players from Craft Down Under servers walking around in 3D space using the skinview3d library. Characters sync in real-time with the server API, move independently with collision avoidance, and occasionally wave at the camera.

🌐 **Live Site**: [https://skins.playcdu.co/](https://skins.playcdu.co/)

## Features

- 🎮 **Real-Time Player Sync** - Automatically fetches and displays all online players from Craft Down Under servers
- 🚶 **Custom Walking Animation** - Smooth walking animation without head bobbing
- 👋 **Wave Animation** - Characters wave when spawning in or when hit by the user
- 🌐 **Intelligent Pathfinding** - Characters path to the least crowded areas, avoiding obstacles and steering around blocked paths
- 🎯 **Idle Behavior** - Characters stand still and idle when reaching their destination before choosing a new path
- 👊 **Player Interactions** - Characters occasionally decide to hit other players, causing knockback and run-away behavior
- 🖱️ **Click-to-Hit** - Click on characters to hit them (red overlay, knockback, then wave)
- 🖱️ **Click-and-Drag** - Drag characters around the scene (they float and play idle animation)
- 🏷️ **Nametags** - Player usernames displayed above each character
- 💬 **Live Chatbox** - Shows login/logout messages in real-time (bottom-right corner)
- 📊 **Player Count** - Displays total number of online players (top-left)
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
- Characters spawn in a circular distribution pattern and wave on spawn
- Each character has independent movement, animation state, collision avoidance, and pathfinding
- Characters maintain their state (position, animation) when other players join/leave
- **Player-to-Player Hits**: Characters have a 0.8% chance every 5 seconds to decide to hit another player
- **Hit Behavior**: Hitting characters path directly to target, play hit animation, then return to walking
- **Run-Away Behavior**: Hit characters receive knockback, run away (with slight bias towards center), then return to walking

### Movement & Animation
- Custom `WalkingAnimationNoHeadBob` function prevents head bobbing
- **Intelligent Pathfinding**: Characters sample 25 candidate positions and select targets in the least crowded areas (top 20% lowest density)
- **Target Selection**: Prioritizes empty areas, avoids other characters' targets, and prefers areas away from the bottom of the screen
- **Movement Speed**: Normal walking is 15% slower than base speed; running and seeking targets use faster speeds
- **Idle Behavior**: Characters idle for 1.5-4 seconds when reaching their target (within 10 units) before choosing a new path
- **Collision Avoidance**: Characters maintain safe distances (25-30 units) and use steering behaviors to navigate around obstacles
- **Pathfinding**: Detects stuck characters and blocked paths, uses waypoint system to steer around obstacles
- **Screen Bounds**: Characters stay within 450 units from center, with gentle repulsion at edges
- **Wave Animation**: Characters wave when spawning in or when hit by the user (4-6 seconds)
- Animation runs at 24fps for consistent performance

### Camera
- Fixed camera positioned at 45-degree angle, 500m away from origin
- Field of view set to 120 degrees for wide-angle view
- Zoom level: 0.0000002 (extremely zoomed out for "ants" view)
- Camera does not follow characters - provides a fixed room perspective
- No user controls - fully automatic

### User Interactions
- **Click-to-Hit**: Click on a character to hit them (red overlay, knockback, then wave animation)
- **Hover Effect**: Characters glow slightly when hovered (cursor changes to pointer)
- **Click-and-Drag**: Click and drag characters to move them around (they float and play idle animation)
- **Quick Clicks**: Quick clicks (< 200ms) trigger hit effect; longer drags move characters

### Chatbox
- Positioned in bottom-right corner
- Shows "{username} Logged in!" messages (green border)
- Shows "{username} Logged out!" messages (red border)
- Keeps last 50 messages with deduplication (prevents duplicate messages within 2 seconds)
- Auto-scrolls to show new messages
- No messages shown on initial load (only changes after)

### UI Elements
- **Info Box**: Top-center, displays "You're looking at everybody online on Craft Down Under right now!"
- **Player Count**: Top-left, shows total number of online players
- **Chatbox**: Bottom-right, shows login/logout messages
- All UI elements have semi-transparent dark backgrounds with blur effects

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
- Normal walking: `baseMoveSpeed * 0.85` (15% slower)
- Seeking target: `baseMoveSpeed * 1.1` (10% faster)
- Running away: `baseMoveSpeed * 2.5` (2.5x faster)

### Animation Speed
Edit `animSpeed` values in `src/components/SkinViewer.jsx` (currently `0.87285`).

### Wave Animation
- Wave duration: `4.0 + Math.random() * 2.0` (4-6 seconds)
- Triggers: On spawn and when hit by user (not player-to-player hits)
- Characters face camera during wave

### Hit System
- Hit decision chance: `0.008` (0.8% every 5 seconds)
- Hit range: Characters must be within 12 units and facing target (within 45 degrees)
- Hit animation: Plays once, then character returns to walking
- Run-away duration: `3.0 + Math.random() * 2.0` (3-5 seconds)
- Run-away bias: 10% towards center of screen

### Pathfinding & Target Selection
- `maxTargetDistance`: Currently `450` units (characters can path far from center)
- `minTargetDistance`: Currently `60` units (minimum distance for new targets)
- `densityRadius`: Currently `120` units (radius for detecting crowded areas)
- Candidate sampling: 25 candidates per target selection
- Bottom screen penalty: 50% density penalty (characters prefer not to path to bottom)
- Target selection: Top 20% lowest density candidates, preferring furthest from center

### Camera Position
Edit camera position in `src/components/SkinViewer.jsx`:
- `cameraDistance`: Currently `500`
- `angle45`: Currently `Math.PI / 4` (45 degrees)
- `skinViewer.zoom`: Currently `0.0000002`
- `maxDistanceFromCenter`: Currently `450` units (screen bounds)

## API Endpoints

- **Online Players**: `https://api.playcdu.co/query` - Returns array of server objects with `onlinePlayerList`
- **Skin Loading**: `https://heads.playcdu.co/skin/{username}` - Loads Minecraft skin by username (case-sensitive)

## Notes

- Skins are loaded using usernames (case-sensitive) from the API
- Characters sync every 5 seconds automatically
- Characters path to the least crowded areas using density-based pathfinding
- Characters idle when reaching their destination before choosing a new path
- Player-to-player hits occur randomly (0.8% chance every 5 seconds)
- Characters avoid the bottom of the screen when selecting targets
- Click interactions: Quick clicks hit, longer drags move characters
- Chat messages only appear for players who join/leave after initial load
- Characters maintain their positions and animations when other players sync
- Built with React hooks for state management and extensibility
- Ready for deployment to Cloudflare Pages or similar static hosting
