# 3D Skin Viewer - Real-Time Online Players

A fun, animated React website that displays Minecraft players walking around in 3D space using the skinview3d library. Watch characters move independently, interact with each other, and respond to your clicks!

🌐 **Live Preview**: [https://skins.playcdu.co/](https://skins.playcdu.co/)

> **Note**: This is just for fun! A playful way to visualize online players in 3D.

## Features

- 🎮 **Real-Time Player Sync** - Automatically fetches and displays players from your configured source
- 🚶 **Smooth Animations** - Walking, running, idle, wave, and hit animations
- 👋 **Wave Animation** - Characters wave when spawning or when hit by you
- 🌐 **Intelligent Pathfinding** - Characters path to less crowded areas with obstacle avoidance
- 👊 **Player Interactions** - Characters occasionally hit each other, causing knockback and run-away behavior
- 🖱️ **Click Interactions** - Click to hit characters, drag to move them around
- 🎯 **Physics-Based Throwing** - Throw characters with inertia - they'll fly and hit others!
- 💀 **Death System** - Characters turn red, fall over, fade out, and respawn when hit by flying characters
- 🏷️ **Nametags** - Player usernames displayed above each character
- 💬 **Live Chatbox** - Shows login/logout messages in real-time
- 📊 **Player Count** - Displays total number of online players
- 🎨 **Starfield Background** - Animated starfield for depth perception
- 🎵 **Background Music** - Optional YouTube audio with play/pause controls

## Data Sources

The app supports multiple ways to get player data:

### 1. Craft Down Under API (Default)
Uses the Craft Down Under query API to fetch real-time online players.

### 2. Text File
Simple text file with one username per line.

### 3. Custom Function
Implement your own data fetching logic (API, database, etc.)

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Configure your player data source (see Configuration below)

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to the URL shown in the terminal (usually `http://localhost:5173`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to deploy to any static hosting (Cloudflare Pages, Netlify, Vercel, etc.).

## Configuration

### Setting Up Your Player Data Source

Edit `src/config/playerSource.js` to configure how players are loaded:

#### Option 1: Craft Down Under API (Default)

```javascript
export const PLAYER_SOURCE_TYPE = 'cdu_api'
export const CDU_API_URL = 'https://api.playcdu.co/query'
```

The API should return an array of server objects, each with:
- `clusterId`: Server cluster identifier
- `onlinePlayerList`: Array of player objects with `name` property

#### Option 2: Text File

1. Create a file `public/players.txt` with one username per line:
```
Player1
Player2
Player3
```

2. Configure:
```javascript
export const PLAYER_SOURCE_TYPE = 'text_file'
export const TEXT_FILE_PATH = '/players.txt'
```

#### Option 3: Custom Function

Implement your own fetch function:

```javascript
export const PLAYER_SOURCE_TYPE = 'custom'

export const fetchCustomPlayers = async () => {
  // Example: Fetch from your own API
  const response = await fetch('https://your-api.com/players')
  const data = await response.json()
  return data.map(p => ({ 
    username: p.name, 
    clusterId: p.cluster || 'DEFAULT' 
  }))
  
  // Example: Return static list
  // return [
  //   { username: 'Player1', clusterId: 'cluster1' },
  //   { username: 'Player2', clusterId: 'cluster2' }
  // ]
}
```

**Return Format**: Your function should return an array of objects with:
- `username` (required): The Minecraft username
- `clusterId` (optional): Cluster/server identifier for grouping

### Skin Loading

Skins are loaded from `https://heads.playcdu.co/skin/{username}` by default. To use a different skin source, edit the `loadSkinImage` function in `src/components/SkinViewer.jsx`.

### Sync Interval

Players are synced every 5 seconds by default. To change this, edit `src/components/SkinViewer.jsx`:

```javascript
syncIntervalRef.current = setInterval(() => {
  syncCharacters()
}, 5000) // Change 5000 to your desired interval in milliseconds
```

## How It Works

1. **Initial Load**: Fetches players from your configured source and spawns them in the 3D scene
2. **Real-Time Sync**: Periodically checks for new players and removes offline players
3. **Seamless Updates**: Characters are added/removed without resetting animations or positions
4. **Automatic Behavior**: Characters walk around, avoid each other, occasionally hit each other, and wave

## Project Structure

```
skinview/
├── src/
│   ├── components/
│   │   ├── SkinViewer.jsx      # Main component with player sync
│   │   ├── SkinViewer.css      # Component styles
│   │   ├── NameTagObject.js    # Custom nametag implementation
│   │   ├── Starfield.jsx       # Starfield background
│   │   ├── BackgroundAudio.jsx # Background music player
│   │   └── ...
│   ├── config/
│   │   └── playerSource.js     # Player data source configuration
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── players.txt             # Text file source (if using)
│   └── oof.ogg                 # Death sound effect
├── index.html
├── package.json
└── README.md
```

## Technologies Used

- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [skinview3d](https://github.com/bs-community/skinview3d) - 3D Minecraft skin viewer
- [Three.js](https://threejs.org/) - 3D graphics (via skinview3d)

## Customization

### Movement Speed

Edit `baseMoveSpeed` in `src/components/SkinViewer.jsx` (currently `2.0`).

### Animation Speed

Edit `animSpeed` values in `src/components/SkinViewer.jsx` (currently `0.87285`).

### Camera Position

Edit camera settings in `src/components/SkinViewer.jsx`:
- `cameraDistance`: Currently `500`
- `skinViewer.zoom`: Currently `0.0000002`

### Death Sound

Replace `public/oof.ogg` with your own sound file (OGG format recommended).

## Deployment

This is a static site that can be deployed to:

- **Cloudflare Pages** (recommended)
- **Netlify**
- **Vercel**
- **GitHub Pages**
- Any static hosting service

Just run `npm run build` and upload the `dist/` folder.

## Notes

- Skins are loaded using usernames (case-sensitive)
- Characters sync automatically based on your configured interval
- Characters use intelligent pathfinding to avoid crowding
- Player-to-player hits occur randomly (configurable)
- Click interactions: Quick clicks hit, longer drags move characters
- Built with React hooks for easy extensibility
- **This is just for fun!** 🎮

## License

Feel free to use this for your own projects!

## Credits

- Uses [skinview3d](https://github.com/bs-community/skinview3d) for 3D skin rendering
- Default skin source: [heads.playcdu.co](https://heads.playcdu.co)
- Default player source: [api.playcdu.co](https://api.playcdu.co) (Craft Down Under)

---

**Have fun!** 🎉
