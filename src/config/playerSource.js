// Player Data Source Configuration
// Choose one of the following options:

// Option 1: Craft Down Under API (default)
export const PLAYER_SOURCE_TYPE = 'cdu_api' // Options: 'cdu_api', 'text_file', 'custom'

// Option 2: Text File - Put usernames in public/players.txt (one per line)
// Set PLAYER_SOURCE_TYPE to 'text_file'

// Option 3: Custom Function - Implement your own fetch function
// Set PLAYER_SOURCE_TYPE to 'custom' and implement fetchCustomPlayers below

// CDU API Configuration (used when PLAYER_SOURCE_TYPE === 'cdu_api')
export const CDU_API_URL = 'https://api.playcdu.co/query'

// Text File Configuration (used when PLAYER_SOURCE_TYPE === 'text_file')
export const TEXT_FILE_PATH = '/players.txt' // Path relative to public folder

// Custom Function (used when PLAYER_SOURCE_TYPE === 'custom')
// Return format: Array of {username: string, clusterId?: string}
export const fetchCustomPlayers = async () => {
  // Example: Return static list
  // return [
  //   { username: 'Player1', clusterId: 'cluster1' },
  //   { username: 'Player2', clusterId: 'cluster2' }
  // ]
  
  // Example: Fetch from your own API
  // const response = await fetch('https://your-api.com/players')
  // const data = await response.json()
  // return data.map(p => ({ username: p.name, clusterId: p.cluster }))
  
  return []
}

