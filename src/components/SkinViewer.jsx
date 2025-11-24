import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as skinview3d from 'skinview3d'
import { PlayerObject } from 'skinview3d'
import { Group, Texture, TextureLoader, CanvasTexture } from 'three'
import { NameTagObject } from './NameTagObject'
import Starfield from './Starfield'
import './SkinViewer.css'

// UUID with dashes for API
const UUID = '1418475b-1029-4a9a-af78-fbf5d59dfee0'
const UUID_NO_DASHES = '1418475b10294a9aaf78fbf5d59dfee0'

// Function to get skin URL from playcdu.co API (supports both UUID and username)
const loadSkinImage = async (identifier) => {
  try {
    const skinUrl = `https://heads.playcdu.co/skin/${identifier}`
    const response = await fetch(skinUrl, {
      mode: 'cors',
      cache: 'no-cache'
    })
    
    if (!response.ok) {
      throw new Error(`Skin fetch failed: ${response.status}`)
    }
    
    const blob = await response.blob()
    return URL.createObjectURL(blob)
    
  } catch (error) {
    console.error('playcdu.co API failed:', error)
    throw error
  }
}

// Function to fetch online players from API
const fetchOnlinePlayers = async () => {
  try {
    const response = await fetch('https://api.playcdu.co/query', {
      mode: 'cors',
      cache: 'no-cache'
    })
    
    if (!response.ok) {
      throw new Error(`API fetch failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Extract all usernames from all servers
    const usernames = []
    if (Array.isArray(data)) {
      data.forEach(server => {
        if (server.onlinePlayerList && Array.isArray(server.onlinePlayerList)) {
          server.onlinePlayerList.forEach(player => {
            if (player.name && !usernames.includes(player.name)) {
              usernames.push(player.name)
            }
          })
        }
      })
    }
    
    return usernames
  } catch (error) {
    console.error('Error fetching online players:', error)
    return []
  }
}

// Animation states
const ANIMATION_STATES = {
  IDLE: 'idle',
  WALK: 'walk',
  HIT: 'hit',
  WAVE: 'wave'
}


const PunchingAnimation = (player, time) => {
  const skin = player.skin
  // Punch animation - quick arm forward motion
  time *= 10
  const punchCycle = Math.sin(time)
  // Right arm punches forward
  skin.rightArm.rotation.x = punchCycle > 0 ? -Math.PI * 0.7 : -Math.PI * 0.2
  skin.rightArm.rotation.z = punchCycle > 0 ? Math.PI * 0.1 : Math.PI * 0.02
  // Left arm pulls back slightly
  skin.leftArm.rotation.x = punchCycle > 0 ? Math.PI * 0.3 : Math.PI * 0.1
  // Slight body rotation
  skin.body.rotation.y = punchCycle > 0 ? Math.PI * 0.05 : 0
  // Head follows punch
  skin.head.rotation.y = punchCycle > 0 ? Math.PI * 0.03 : 0
}

// Custom walking animation without head bobbing - faster animation, slower movement
const WalkingAnimationNoHeadBob = (player, progress) => {
  const skin = player.skin
  // Use progress directly, multiply by faster walking animation speed
  const time = progress * 5.819 // 10% faster (5.29 * 1.1 = 5.819)
  // Leg swing - slower and smoother
  skin.leftLeg.rotation.x = Math.sin(time) * 0.5
  skin.rightLeg.rotation.x = Math.sin(time + Math.PI) * 0.5
  // Arm swing
  skin.leftArm.rotation.x = Math.sin(time + Math.PI) * 0.5
  skin.rightArm.rotation.x = Math.sin(time) * 0.5
  const basicArmRotationZ = Math.PI * 0.02
  skin.leftArm.rotation.z = Math.cos(time) * 0.03 + basicArmRotationZ
  skin.rightArm.rotation.z = Math.cos(time + Math.PI) * 0.03 - basicArmRotationZ
  // NO HEAD BOBBING - keep head still
  skin.head.rotation.y = 0
  skin.head.rotation.x = 0
  // Disable cape rotation if cape exists
  if (player.cape) {
    const basicCapeRotationX = Math.PI * 0.06
    player.cape.rotation.x = Math.sin(time / 1.5) * 0.06 + basicCapeRotationX
    player.cape.visible = false
  }
}

// Wave animation - character waves at camera
const WaveAnimation = (player, progress, whichArm = 'left') => {
  const skin = player.skin
  const t = progress * 2 * Math.PI * 0.5
  
  const targetArm = whichArm === 'left' ? skin.leftArm : skin.rightArm
  
  // Wave arm - raise it up and wave side to side
  targetArm.rotation.x = Math.PI // 180 degrees (arm raised)
  targetArm.rotation.z = Math.sin(t) * 0.5 // Wave side to side
  
  // Reset other arm to neutral position
  const otherArm = whichArm === 'left' ? skin.rightArm : skin.leftArm
  otherArm.rotation.x = 0
  otherArm.rotation.z = 0
  
  // Keep legs still
  skin.leftLeg.rotation.x = 0
  skin.rightLeg.rotation.x = 0
  
  // Keep head still and facing forward
  skin.head.rotation.y = 0
  skin.head.rotation.x = 0
  
  // Disable cape if exists
  if (player.cape) {
    player.cape.visible = false
  }
}

function SkinViewerComponent() {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const skinViewerRef = useRef(null)
  const animationsRef = useRef({})
  const currentAnimationRef = useRef(null)
  const controlsRef = useRef(null)
  const animationFrameRef = useRef(null)
  const timeRef = useRef(0)
  const randomActionTimerRef = useRef(null)
  const charactersRef = useRef([]) // Array to store multiple characters
  const cameraFollowRef = useRef(true)
  const originalCharStateRef = useRef(null) // Store original character animation state
  const skinBlobUrlRef = useRef(null)
  const lastFrameTimeRef = useRef(0)
  const syncIntervalRef = useRef(null) // Store sync interval for cleanup
  const targetFPS = 24
  const frameInterval = 1000 / targetFPS // ~41.67ms per frame at 24fps
  
  const [animationKey, setAnimationKey] = useState(0)
  const [currentAnimation, setCurrentAnimation] = useState(ANIMATION_STATES.IDLE)
  const [chatMessages, setChatMessages] = useState([]) // Store chat messages
  const isInitialLoadRef = useRef(true) // Track if this is the initial load
  const chatMessagesRef = useRef(null) // Ref for chat messages container
  
  // Auto-scroll chatbox when messages change
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  // Initialize skin viewer
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current

    // Create skin viewer - fullscreen for 3D space effect
    const skinViewer = new skinview3d.SkinViewer({
      canvas: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      model: 'default'
    })
    
    // Handle window resize
    const handleResize = () => {
      skinViewer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // Set up lighting and background - darker for room effect
    skinViewer.renderer.setClearColor(0x0a0a0f, 1) // Very dark background
    skinViewer.cameraLight.intensity = 1.5 // Brighter light to see character in distance
    skinViewer.globalLight.intensity = 0.6
    
    // Add a subtle background gradient effect using a panorama or custom background
    // This creates depth perception

    // Store animation functions
    animationsRef.current = {
      walk: skinview3d.WalkingAnimation,
      idle: skinview3d.IdleAnimation,
      run: skinview3d.RunningAnimation
    }
    currentAnimationRef.current = skinview3d.WalkingAnimation
    setCurrentAnimation(ANIMATION_STATES.WALK)

    // Set zoom to make characters like ants - zoomed out 5x more
    skinViewer.zoom = 0.0000002 // Zoomed out 5x more (0.000001 / 5 = 0.0000002)
    skinViewer.camera.fov = 120 // Maximum field of view
    
    // Disable orbit controls - camera is fixed
    const control = skinview3d.createOrbitControls(skinViewer)
    control.enableRotate = false
    control.enableZoom = false // Fixed zoom
    control.enablePan = false
    controlsRef.current = control
    

    // Fixed camera position - 45 degree angle from 500m away
    // Camera positioned 500 units away at 45 degree angle looking down
    const cameraDistance = 500
    const angle45 = Math.PI / 4 // 45 degrees
    skinViewer.camera.position.set(
      Math.sin(angle45) * cameraDistance, // X offset
      Math.cos(angle45) * cameraDistance, // Y height (looking down)
      Math.cos(angle45) * cameraDistance  // Z distance
    )
    skinViewer.camera.lookAt(0, 0, 0) // Look at origin where characters are
    
    // Function to add a single character
    function addCharacter(skinViewer, username) {
      const characters = charactersRef.current || []
      
      // Check if character already exists
      if (characters.some(char => char.username === username)) {
        return Promise.resolve() // Already exists
      }
      
      return loadSkinImage(username)
        .then(skinUrl => {
          return new Promise((resolve, reject) => {
            const textureLoader = new TextureLoader()
            textureLoader.load(
              skinUrl,
              (texture) => {
                texture.needsUpdate = true
                
                try {
                  const newSkinTexture = texture.clone()
                  newSkinTexture.needsUpdate = true
                  const newCapeTexture = null
                  
                  const newPlayer = new skinview3d.PlayerObject(newSkinTexture, newCapeTexture)
                  
                  // Disable cape/elytra
                  newPlayer.traverse((obj) => {
                    if (obj.name && (obj.name.toLowerCase().includes('cape') || obj.name.toLowerCase().includes('elytra'))) {
                      obj.visible = false
                    }
                    if (obj === newPlayer.cape || obj === newPlayer.elytra) {
                      obj.visible = false
                    }
                  })
                  
                  if (newPlayer.cape) {
                    newPlayer.cape.visible = false
                  }
                  if (newPlayer.elytra) {
                    newPlayer.elytra.visible = false
                  }
                  
                  const characterGroup = new Group()
                  characterGroup.add(newPlayer)
                  
                  // Random spawn position
                  const spacing = 120
                  const angle = Math.random() * Math.PI * 2
                  const radius = 50 + Math.random() * 150
                  const startX = Math.cos(angle) * radius + (Math.random() - 0.5) * spacing * 0.5
                  const startZ = Math.sin(angle) * radius + (Math.random() - 0.5) * spacing * 0.5
                  
                  characterGroup.position.set(startX, 0, startZ)
                  characterGroup.rotation.y = Math.random() * Math.PI * 2
                  characterGroup.visible = true
                  
                  // Create nametag
                  const nameTag = new NameTagObject(username, {
                    font: '56px Arial',
                    height: 6.5,
                    textStyle: 'white',
                    backgroundStyle: 'rgba(0,0,0,.7)',
                    opacity: 0.5
                  })
                  nameTag.position.set(0, 25, 0)
                  nameTag.renderOrder = 999
                  characterGroup.add(nameTag)
                  
                  skinViewer.scene.add(characterGroup)
                  
                  const characterData = {
                    group: characterGroup,
                    player: newPlayer,
                    nameTag: nameTag,
                    username: username,
                    uuid: username, // Use username as identifier
                    animProgress: Math.random() * 2,
                    animSpeed: 0.87285,
                    animationState: ANIMATION_STATES.WALK,
                    animationStateTimer: Math.random() * 10 + 5,
                    path: {
                      x: startX,
                      z: startZ,
                      angle: Math.random() * Math.PI * 2,
                      targetX: Math.cos(Math.random() * Math.PI * 2) * (50 + Math.random() * 150),
                      targetZ: Math.sin(Math.random() * Math.PI * 2) * (50 + Math.random() * 150),
                      changeTargetTime: Math.random() * 3 + 2
                    },
                    waveTimer: undefined, // Will be initialized in animation loop
                    waveDuration: 0,
                    waveArm: Math.random() > 0.5 ? 'left' : 'right'
                  }
                  
                  characters.push(characterData)
                  charactersRef.current = characters
                  console.log(`Added character: ${username}`)
                  resolve()
                } catch (err) {
                  console.error(`Error creating character ${username}:`, err)
                  reject(err)
                }
              },
              undefined,
              (error) => {
                console.error(`Failed to load skin for ${username}:`, error)
                reject(error)
              }
            )
          })
        })
        .catch(err => {
          console.error(`Error adding character ${username}:`, err)
        })
    }
    
    // Function to remove a character
    function removeCharacter(skinViewer, username) {
      const characters = charactersRef.current || []
      const index = characters.findIndex(char => char.username === username)
      
      if (index === -1) return // Not found
      
      const char = characters[index]
      
      // Remove from scene
      if (char.group && char.group.parent) {
        char.group.parent.remove(char.group)
      }
      
      // Dispose of resources
      if (char.player) {
        char.player.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => {
                if (mat.map) mat.map.dispose()
                mat.dispose()
              })
            } else {
              if (obj.material.map) obj.material.map.dispose()
              obj.material.dispose()
            }
          }
        })
      }
      
      // Remove from array
      characters.splice(index, 1)
      charactersRef.current = characters
      console.log(`Removed character: ${username}`)
    }
    
    // Function to add chat message (with deduplication)
    function addChatMessage(username, type) {
      const message = type === 'login' 
        ? `${username} Logged in!`
        : `${username} Logged out!`
      
      setChatMessages(prev => {
        // Check if this exact message was added recently (within last 2 seconds)
        const now = Date.now()
        const recentDuplicate = prev.some(msg => 
          msg.username === username && 
          msg.type === type && 
          (now - msg.timestamp) < 2000
        )
        
        // Skip if duplicate found
        if (recentDuplicate) {
          return prev
        }
        
        const newMessages = [...prev, { username, message, type, timestamp: now }]
        // Keep only last 50 messages
        return newMessages.slice(-50)
      })
    }
    
    // Function to sync characters with online players
    async function syncCharacters() {
      const onlineUsernames = await fetchOnlinePlayers()
      const currentCharacters = charactersRef.current || []
      const currentUsernames = currentCharacters.map(char => char.username)
      
      // Find characters to add
      const toAdd = onlineUsernames.filter(username => !currentUsernames.includes(username))
      
      // Find characters to remove
      const toRemove = currentUsernames.filter(username => !onlineUsernames.includes(username))
      
      // Remove characters that went offline and add chat messages (skip on initial load)
      toRemove.forEach(username => {
        removeCharacter(skinViewer, username)
        if (!isInitialLoadRef.current) {
          addChatMessage(username, 'logout')
        }
      })
      
      // Add new characters and add chat messages (skip on initial load)
      if (!isInitialLoadRef.current) {
        toAdd.forEach(username => {
          addChatMessage(username, 'login')
        })
      }
      
      // Add new characters
      const addPromises = toAdd.map(username => addCharacter(skinViewer, username))
      await Promise.all(addPromises)
      
      // Mark initial load as complete after first sync
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false
      }
      
      console.log(`Synced: ${toAdd.length} added, ${toRemove.length} removed`)
    }
    
    // Initial fetch and sync
    syncCharacters().then(() => {
      // Set up interval to sync every 5 seconds
      syncIntervalRef.current = setInterval(() => {
        syncCharacters()
      }, 5000) // 5 seconds
    }).catch(err => {
      console.error('Error in initial sync:', err)
    })
    
    // Function to create characters with user data
    function createCharacters(skinViewer, users) {
      const numCharacters = users.length
      const characters = []
      
      if (users.length === 0) return
      
      // Load first user's skin for the original character
      const firstUser = users[0]
      loadSkinImage(firstUser.minecraft_uuid)
      .then(skinUrl => {
        skinBlobUrlRef.current = skinUrl
        return skinViewer.loadSkin(skinUrl)
      })
      .then(() => {
        // After skin loads, create the original character
        const originalGroup = skinViewer.playerWrapper
        const originalPlayer = skinViewer.playerObject
        
        // Disable cape/elytra for original character - traverse to find all cape/elytra objects
        originalPlayer.traverse((obj) => {
          if (obj.name && (obj.name.toLowerCase().includes('cape') || obj.name.toLowerCase().includes('elytra'))) {
            obj.visible = false
          }
          if (obj === originalPlayer.cape || obj === originalPlayer.elytra) {
            obj.visible = false
          }
        })
        
        // Explicitly disable cape and elytra if they exist
        if (originalPlayer.cape) {
          originalPlayer.cape.visible = false
          originalPlayer.cape.traverse((obj) => {
            if (obj.visible !== undefined) obj.visible = false
          })
        }
        if (originalPlayer.elytra) {
          originalPlayer.elytra.visible = false
          originalPlayer.elytra.traverse((obj) => {
            if (obj.visible !== undefined) obj.visible = false
          })
        }
        
        // Ensure original is visible
        originalGroup.visible = true
        originalGroup.traverse((child) => {
          if (child.visible !== undefined) {
            if (child.name && (child.name.toLowerCase().includes('cape') || child.name.toLowerCase().includes('elytra'))) {
              child.visible = false
            } else if (child !== originalPlayer.cape && child !== originalPlayer.elytra) {
              child.visible = true
            }
          }
        })
        
        // Set original character's starting position - random spawn (not perfect grid)
        const spacing = 120 // Base spacing between characters
        const gridSize = Math.ceil(Math.sqrt(numCharacters))
        const gridX = (0 % gridSize) - gridSize / 2
        const gridZ = Math.floor(0 / gridSize) - gridSize / 2
        // Add significant randomness to break the perfect grid pattern
        const randomOffsetX = (Math.random() - 0.5) * spacing * 0.8 // Random offset up to 80% of spacing
        const randomOffsetZ = (Math.random() - 0.5) * spacing * 0.8
        const originalStartX = gridX * spacing + randomOffsetX
        const originalStartZ = gridZ * spacing + randomOffsetZ
        originalGroup.position.set(originalStartX, 0, originalStartZ)
        originalGroup.rotation.y = Math.random() * Math.PI * 2
        
        // Create nametag for original character using username from API
        const originalNameTag = new NameTagObject(users[0].minecraft_username || 'Player1', {
          font: '56px Arial', // Slightly smaller font
          height: 6.5, // Smaller height
          textStyle: 'white',
          backgroundStyle: 'rgba(0,0,0,.7)',
          opacity: 0.5 // More transparent
        })
        originalNameTag.position.set(0, 25, 0) // Position well above the character's head
        originalNameTag.renderOrder = 999 // Render on top
        originalGroup.add(originalNameTag)
        
        // Add original as first character
        characters.push({
          group: originalGroup,
          player: originalPlayer,
          nameTag: originalNameTag,
          username: users[0].minecraft_username,
          uuid: users[0].minecraft_uuid,
          animProgress: 0,
          animSpeed: 0.87285, // 10% faster (0.7935 * 1.1 = 0.87285)
          animationState: ANIMATION_STATES.WALK, // Start with walking
          animationStateTimer: Math.random() * 10 + 5, // Random timer for state changes
          path: {
            x: originalStartX,
            z: originalStartZ,
            angle: 0,
            targetX: Math.random() * 300 - 150, // Random target
            targetZ: Math.random() * 300 - 150
          }
        })
        
        // Now create all other characters with their own unique skins
        const textureLoader = new TextureLoader()
        const skinPromises = []
        
        // Pre-load all skins in parallel
        for (let i = 1; i < numCharacters; i++) {
          const user = users[i] || users[0]
          const skinPromise = loadSkinImage(user.minecraft_uuid)
            .then(skinUrl => {
              return new Promise((resolve, reject) => {
                textureLoader.load(
                  skinUrl,
                  (texture) => {
                    texture.needsUpdate = true
                    resolve({ texture, user, index: i })
                  },
                  undefined,
                  (error) => {
                    console.error(`Failed to load skin for ${user.minecraft_username}:`, error)
                    // Fallback to first user's skin
                    if (skinBlobUrlRef.current) {
                      textureLoader.load(
                        skinBlobUrlRef.current,
                        (fallbackTexture) => {
                          fallbackTexture.needsUpdate = true
                          resolve({ texture: fallbackTexture, user, index: i })
                        },
                        undefined,
                        reject
                      )
                    } else {
                      reject(error)
                    }
                  }
                )
              })
            })
            .catch(err => {
              console.error(`Error loading skin for ${user.minecraft_username}:`, err)
              // Return null to skip this character
              return null
            })
          
          skinPromises.push(skinPromise)
        }
        
        // Wait for all skins to load, then create characters
        Promise.all(skinPromises).then(results => {
          results.forEach((result, promiseIndex) => {
            if (!result) return // Skip failed loads
            
            const { texture, user, index } = result
            const i = index
            
            try {
              // Clone the texture properly - each character needs its own texture instance
              const newSkinTexture = texture.clone()
              newSkinTexture.needsUpdate = true
              // Don't create a cape texture - pass null/undefined to avoid cape issues
              const newCapeTexture = null
              
              // Create new PlayerObject with this character's unique skin
              const newPlayer = new skinview3d.PlayerObject(newSkinTexture, newCapeTexture)
              
              // Disable cape/elytra rendering - traverse to find all cape/elytra objects
              newPlayer.traverse((obj) => {
                if (obj.name && (obj.name.toLowerCase().includes('cape') || obj.name.toLowerCase().includes('elytra'))) {
                  obj.visible = false
                }
                // Also check if it's the cape or elytra property
                if (obj === newPlayer.cape || obj === newPlayer.elytra) {
                  obj.visible = false
                }
              })
              
              // Explicitly disable cape and elytra if they exist
              if (newPlayer.cape) {
                newPlayer.cape.visible = false
                newPlayer.cape.traverse((obj) => {
                  if (obj.visible !== undefined) obj.visible = false
                })
              }
              if (newPlayer.elytra) {
                newPlayer.elytra.visible = false
                newPlayer.elytra.traverse((obj) => {
                  if (obj.visible !== undefined) obj.visible = false
                })
              }
              
              const characterGroup = new Group()
              characterGroup.add(newPlayer)
              
              // Random spawn positions - not a perfect grid
              const spacing = 120 // Base spacing between characters
              const gridSize = Math.ceil(Math.sqrt(numCharacters))
              const gridX = (i % gridSize) - gridSize / 2
              const gridZ = Math.floor(i / gridSize) - gridSize / 2
              // Add significant randomness to break the perfect grid pattern
              const randomOffsetX = (Math.random() - 0.5) * spacing * 0.8 // Random offset up to 80% of spacing
              const randomOffsetZ = (Math.random() - 0.5) * spacing * 0.8
              const startX = gridX * spacing + randomOffsetX
              const startZ = gridZ * spacing + randomOffsetZ
              
              characterGroup.position.set(startX, 0, startZ)
              characterGroup.rotation.y = Math.random() * Math.PI * 2
              characterGroup.visible = true
              
              newPlayer.traverse((obj) => {
                // Make sure everything except cape/elytra is visible
                if (obj.visible !== undefined) {
                  if (obj.name && (obj.name.toLowerCase().includes('cape') || obj.name.toLowerCase().includes('elytra'))) {
                    obj.visible = false
                  } else if (obj !== newPlayer.cape && obj !== newPlayer.elytra) {
                    obj.visible = true
                  }
                }
              })
              
              // Create nametag for this character using username from API
              const nameTag = new NameTagObject(user.minecraft_username || `Player${i + 1}`, {
                font: '56px Arial', // Slightly smaller font
                height: 6.5, // Smaller height
                textStyle: 'white',
                backgroundStyle: 'rgba(0,0,0,.7)',
                opacity: 0.5 // More transparent
              })
              nameTag.position.set(0, 25, 0) // Position well above the character's head
              nameTag.renderOrder = 999 // Render on top
              characterGroup.add(nameTag)
              
              skinViewer.scene.add(characterGroup)
              
              // Ensure all required properties are initialized
              const characterData = {
                group: characterGroup,
                player: newPlayer,
                nameTag: nameTag,
                username: user.minecraft_username,
                uuid: user.minecraft_uuid,
                animProgress: i * 0.2,
                animSpeed: 0.87285, // 10% faster (0.7935 * 1.1 = 0.87285)
                animationState: ANIMATION_STATES.WALK, // Start with walking
                animationStateTimer: Math.random() * 10 + 5, // Random timer for state changes
                path: {
                  x: startX,
                  z: startZ,
                  angle: Math.random() * Math.PI * 2,
                  targetX: Math.random() * 300 - 150,
                  targetZ: Math.random() * 300 - 150,
                  changeTargetTime: Math.random() * 5 + 3 // More frequent target changes
                }
              }
              
              // Validate character data before adding
              if (characterData.group && characterData.player && characterData.path) {
                characters.push(characterData)
              } else {
                console.error('Invalid character data:', characterData)
              }
            } catch (charError) {
              console.error(`Error creating character ${i}:`, charError)
            }
          })
          
          // Update characters ref and render
          charactersRef.current = characters
          console.log(`Created ${characters.length} characters with unique skins`)
          skinViewer.render()
        })
        .catch(err => {
          console.error('Error loading skins:', err)
        })
      })
      .catch(err => {
        console.error('Error loading skin:', err)
        // Try with dashes as fallback
        return loadSkinImage(UUID)
          .then(skinUrl => {
            skinBlobUrlRef.current = skinUrl
            return skinViewer.loadSkin(skinUrl)
          })
      })
      .catch(fallbackErr => {
        console.error('All skin loading methods failed:', fallbackErr)
      })
    } // End of createCharacters function

    skinViewerRef.current = skinViewer

    // Animation loop with 3D movement for multiple characters
    // Throttled to 24fps for smooth animation
    function animate(currentTime) {
      animationFrameRef.current = requestAnimationFrame(animate)
      
      // Throttle to 24fps
      const elapsed = currentTime - lastFrameTimeRef.current
      if (elapsed < frameInterval) {
        return // Skip this frame
      }
      
      lastFrameTimeRef.current = currentTime - (elapsed % frameInterval)
      
      {
        const deltaTime = frameInterval / 1000 // Convert to seconds (1/24 = ~0.0417)
        timeRef.current += deltaTime
        
        // Base movement speed - will be adjusted based on animation state
        const baseMoveSpeed = 2.0 // Increased to move further distances
        
        // Update all characters
        const characters = charactersRef.current || []
        
        // If no cloned characters yet, use the original player
        if (!characters || characters.length === 0) {
          const player = skinViewer.playerObject
          
          // Create temporary character state for original player
          if (!originalCharStateRef.current) {
            originalCharStateRef.current = {
              animationState: ANIMATION_STATES.WALK,
              animationStateTimer: Math.random() * 10 + 5,
              animProgress: 0,
              animSpeed: 0.6
            }
          }
          const charState = originalCharStateRef.current
          
          // Create a temporary path object for the original player - random movement with collision avoidance
          const path = { 
            x: player.position.x, 
            z: player.position.z, 
            angle: 0,
            targetX: Math.random() * 400 - 200, // Larger movement area
            targetZ: Math.random() * 400 - 200,
            changeTargetTime: Math.random() * 3 + 2 // More frequent changes (2-5 seconds)
          }
          
          // Move towards random target
          path.changeTargetTime -= deltaTime
          if (path.changeTargetTime <= 0) {
            path.targetX = Math.random() * 400 - 200
            path.targetZ = Math.random() * 400 - 200
            path.changeTargetTime = Math.random() * 3 + 2
          }
          
          let dx = path.targetX - path.x
          let dz = path.targetZ - path.z
          let distance = Math.sqrt(dx * dx + dz * dz)
          
          if (distance < 15) {
            // Use uniform distribution in a circle to avoid center bias
            const angle = Math.random() * Math.PI * 2
            const radius = 50 + Math.random() * 150 // Between 50 and 200 units from center
            path.targetX = Math.cos(angle) * radius
            path.targetZ = Math.sin(angle) * radius
            path.changeTargetTime = Math.random() * 3 + 2
            dx = path.targetX - path.x
            dz = path.targetZ - path.z
            distance = Math.sqrt(dx * dx + dz * dz)
          }
          
          // Collision avoidance - prevent clumping but allow natural movement
          const avoidanceRadius = 80 // Start avoiding from 80 units away (reduced from 120)
          const minDistance = 50 // Minimum distance of 50 units (reduced from 80)
          let avoidX = 0
          let avoidZ = 0
          
          // Center repulsion - gentle push away from center
          const centerDist = Math.sqrt(path.x ** 2 + path.z ** 2)
          const centerRepulsionRadius = 60 // Start repelling from center when within 60 units (reduced)
          if (centerDist < centerRepulsionRadius && centerDist > 0) {
            const centerRepulsionStrength = (centerRepulsionRadius - centerDist) / centerRepulsionRadius
            avoidX += (path.x / centerDist) * centerRepulsionStrength * 5 // Gentle push (reduced from 12)
            avoidZ += (path.z / centerDist) * centerRepulsionStrength * 5
          }
          
          const allCharacters = charactersRef.current || []
          allCharacters.forEach((otherChar, otherIndex) => {
            if (!otherChar || !otherChar.path || !otherChar.group) return
            const otherPath = otherChar.path
            const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
            const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
            
            const distX = path.x - otherX
            const distZ = path.z - otherZ
            const dist = Math.sqrt(distX * distX + distZ * distZ)
            
            // Gentle avoidance when close to other characters
            if (dist < avoidanceRadius && dist > 0) {
              const avoidStrength = (avoidanceRadius - dist) / avoidanceRadius
              // Moderate avoidance force - allows natural movement (reduced from 10)
              avoidX += (distX / dist) * avoidStrength * 4
              avoidZ += (distZ / dist) * avoidStrength * 4
              
              // If very close, override target to move away (but less aggressively)
              if (dist < minDistance) {
                path.targetX = path.x + (distX / dist) * 60
                path.targetZ = path.z + (distZ / dist) * 60
                path.changeTargetTime = 1.0 // Change target less aggressively (increased from 0.5)
              }
            }
          })
          
          // Update animation state timer
          charState.animationStateTimer -= deltaTime
          
          // Always walking - no state changes needed
          charState.animationState = ANIMATION_STATES.WALK
          
          const moveSpeed = baseMoveSpeed
          // Prioritize avoidance over target movement - if avoiding, reduce target movement
          const avoidancePriority = Math.abs(avoidX) + Math.abs(avoidZ) > 0 ? 0.3 : 1.0 // Reduce target movement when avoiding
          const moveX = ((dx / Math.max(distance, 0.1)) * moveSpeed * 5 * avoidancePriority) + avoidX * 2 // Avoidance is 2x stronger
          const moveZ = ((dz / Math.max(distance, 0.1)) * moveSpeed * 5 * avoidancePriority) + avoidZ * 2
          
          const forwardDistance = path.z + moveZ
          const sideDistance = path.x + moveX
          
          const newX = sideDistance
          const newZ = forwardDistance
          
          const lerpFactor = 0.25
          player.position.x += (newX - player.position.x) * lerpFactor
          player.position.z += (newZ - player.position.z) * lerpFactor
          
          const oldX = path.x !== undefined ? path.x : player.position.x
          const oldZ = path.z !== undefined ? path.z : player.position.z
          const rotDx = player.position.x - oldX
          const rotDz = player.position.z - oldZ
          
          if (Math.abs(rotDx) > 0.001 || Math.abs(rotDz) > 0.001) {
            const targetRotation = Math.atan2(rotDx, rotDz)
            let currentRot = player.rotation.y
            while (currentRot > Math.PI) currentRot -= Math.PI * 2
            while (currentRot < -Math.PI) currentRot += Math.PI * 2
            let targetRot = targetRotation
            while (targetRot > Math.PI) targetRot -= Math.PI * 2
            while (targetRot < -Math.PI) targetRot += Math.PI * 2
            let diff = targetRot - currentRot
            if (diff > Math.PI) diff -= Math.PI * 2
            if (diff < -Math.PI) diff += Math.PI * 2
            // Faster, smoother rotation for original character too
            const rotationSpeed = Math.min(0.8, Math.abs(diff) * 2 + 0.3)
            player.rotation.y += diff * rotationSpeed
          }
          
          path.x = player.position.x
          path.z = player.position.z
          
          // Apply animation based on state
          charState.animProgress += deltaTime * charState.animSpeed
          
          // Always walking
          try {
            if (player && charState.animProgress !== undefined) {
              WalkingAnimationNoHeadBob(player, charState.animProgress)
            }
          } catch (err) {
            console.error('Animation error for original character:', err)
          }
          
          // Update nametag position if it exists (for original character)
          const originalChar = characters[0]
          if (originalChar && originalChar.nameTag) {
            originalChar.nameTag.position.y = 25 // Keep it well above character's head
          }
        } else {
          // Get characters from ref
          const allCharacters = charactersRef.current || []
          
          allCharacters.forEach((char, index) => {
            // Safety checks
            if (!char || !char.path || !char.group || !char.player) {
              return // Skip invalid characters
            }
            
            const path = char.path
            const group = char.group
            const player = char.player
            
            // Update animation state timer
            if (!char.animationStateTimer) char.animationStateTimer = Math.random() * 10 + 5
            char.animationStateTimer -= deltaTime
            
            // Initialize wave timer if not exists (only once)
            if (char.waveTimer === undefined) {
              char.waveTimer = Math.random() * 20 + 10 // Random time between 10-30 seconds before first wave
              char.waveDuration = 0
              char.waveArm = Math.random() > 0.5 ? 'left' : 'right' // Randomly choose which arm to wave
            }
            
            // Wave state logic
            if (char.animationState === ANIMATION_STATES.WAVE) {
              // Currently waving - count down duration
              char.waveDuration -= deltaTime
              if (char.waveDuration <= 0) {
                // Wave finished, return to walking
                char.animationState = ANIMATION_STATES.WALK
                char.waveTimer = Math.random() * 25 + 15 // Reset timer for next wave (15-40 seconds)
                char.waveDuration = 0
              }
            } else {
              // Not waving - check if it's time to wave
              char.waveTimer -= deltaTime
              if (char.waveTimer <= 0) {
                // Time to wave! (occasionally, not too often)
                if (Math.random() < 0.4) { // 40% chance when timer expires (increased from 30%)
                  char.animationState = ANIMATION_STATES.WAVE
                  char.waveDuration = 4.0 + Math.random() * 2.0 // Wave for 4-6 seconds (longer)
                  char.waveArm = Math.random() > 0.5 ? 'left' : 'right' // Randomly choose arm
                } else {
                  // Reset timer even if we don't wave this time
                  char.waveTimer = Math.random() * 20 + 10 // Try again in 10-30 seconds
                }
              } else {
                // Normal walking
                char.animationState = ANIMATION_STATES.WALK
              }
            }
            
            // Create a path that moves towards random targets with collision avoidance
            // Each character walks towards a target, then picks a new one
            if (!path.changeTargetTime) {
              path.changeTargetTime = Math.random() * 3 + 2 // Change targets more frequently (2-5 seconds)
              // Use uniform distribution in a circle to avoid center bias
              const angle = Math.random() * Math.PI * 2
              const radius = 50 + Math.random() * 150 // Between 50 and 200 units from center
              path.targetX = Math.cos(angle) * radius
              path.targetZ = Math.sin(angle) * radius
            }
            
            // Move towards target - calculate distance first
            let dx = path.targetX - path.x
            let dz = path.targetZ - path.z
            let distance = Math.sqrt(dx * dx + dz * dz)
            
            // Check if it's time to change target - more frequent changes
            path.changeTargetTime -= deltaTime
            if (path.changeTargetTime <= 0 || distance < 15) {
              // Use uniform distribution in a circle to avoid center bias
              // Generate angle and radius for better distribution
              const angle = Math.random() * Math.PI * 2
              const radius = 50 + Math.random() * 150 // Between 50 and 200 units from center
              const newTargetX = Math.cos(angle) * radius
              const newTargetZ = Math.sin(angle) * radius
              
              // Ensure new target is far enough away from current position
              const newDist = Math.sqrt((newTargetX - path.x) ** 2 + (newTargetZ - path.z) ** 2)
              if (newDist >= 30) {
                path.targetX = newTargetX
                path.targetZ = newTargetZ
              } else {
                // If too close, try again with a different angle
                const retryAngle = Math.random() * Math.PI * 2
                path.targetX = Math.cos(retryAngle) * radius
                path.targetZ = Math.sin(retryAngle) * radius
              }
              
              path.changeTargetTime = Math.random() * 3 + 2 // Change targets more frequently (2-5 seconds)
              // Recalculate dx, dz, and distance after changing target
              dx = path.targetX - path.x
              dz = path.targetZ - path.z
              distance = Math.sqrt(dx * dx + dz * dz)
            }
            
            // Collision avoidance - prevent clumping but allow natural movement
            const avoidanceRadius = 80 // Start avoiding from 80 units away (reduced from 120)
            const minDistance = 50 // Minimum distance of 50 units (reduced from 80)
            let avoidX = 0
            let avoidZ = 0
            
            // Center repulsion - gentle push away from center
            const centerDist = Math.sqrt(path.x ** 2 + path.z ** 2)
            const centerRepulsionRadius = 60 // Start repelling from center when within 60 units (reduced)
            if (centerDist < centerRepulsionRadius && centerDist > 0) {
              const centerRepulsionStrength = (centerRepulsionRadius - centerDist) / centerRepulsionRadius
              avoidX += (path.x / centerDist) * centerRepulsionStrength * 5 // Gentle push (reduced from 12)
              avoidZ += (path.z / centerDist) * centerRepulsionStrength * 5
            }
            
            // Second priority: Avoid other characters (gentler to allow natural movement)
            allCharacters.forEach((otherChar, otherIndex) => {
              if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
              
              const otherPath = otherChar.path
              const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
              const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
              
              const distX = path.x - otherX
              const distZ = path.z - otherZ
              const dist = Math.sqrt(distX * distX + distZ * distZ)
              
              // Gentle avoidance when close to other characters
              if (dist < avoidanceRadius && dist > 0) {
                const avoidStrength = (avoidanceRadius - dist) / avoidanceRadius
                // Moderate avoidance force - allows natural movement (reduced from 10)
                avoidX += (distX / dist) * avoidStrength * 4
                avoidZ += (distZ / dist) * avoidStrength * 4
                
                // If very close, override target to move away (but less aggressively)
                if (dist < minDistance) {
                  // Calculate escape direction (away from other character)
                  const escapeDist = 60 // Move 60 units away (reduced from 100)
                  const newTargetX = path.x + (distX / dist) * escapeDist
                  const newTargetZ = path.z + (distZ / dist) * escapeDist
                  
                  // Only update if new target is far enough from current position
                  const newTargetDist = Math.sqrt((newTargetX - path.x) ** 2 + (newTargetZ - path.z) ** 2)
                  if (newTargetDist >= 30) {
                    path.targetX = newTargetX
                    path.targetZ = newTargetZ
                    path.changeTargetTime = 1.0 // Change target less aggressively (increased from 0.5)
                    
                    // Also update dx/dz to reflect new target
                    dx = path.targetX - path.x
                    dz = path.targetZ - path.z
                    distance = Math.sqrt(dx * dx + dz * dz)
                  }
                }
              }
            })
            
            const moveSpeed = baseMoveSpeed
            
            // Update character position in 3D space
            // Move in a path that goes away from camera
            path.angle += moveSpeed * 0.15
            
            // Normal movement towards target - don't reduce it
            const moveX = (dx / Math.max(distance, 0.1)) * moveSpeed + avoidX * 0.5
            const moveZ = (dz / Math.max(distance, 0.1)) * moveSpeed + avoidZ * 0.5
            
            // Calculate movement direction for rotation BEFORE moving
            // Use the intended movement direction, not the actual movement
            const totalMoveX = moveX
            const totalMoveZ = moveZ
            const moveDistance = Math.sqrt(totalMoveX * totalMoveX + totalMoveZ * totalMoveZ)
            
            // Rotate to face movement direction or camera (if waving)
            if (char.animationState === ANIMATION_STATES.WAVE) {
              // Face camera when waving - camera is at 45 degree angle looking down
              // Camera position: (sin(45)*500, cos(45)*500, cos(45)*500)
              // Character needs to face towards camera position from origin
              // Rotation angle in XZ plane: atan2(cameraX, cameraZ) = atan2(sin(45), cos(45)) = PI/4
              const cameraAngle = Math.PI / 4 // 45 degrees
              const targetRotation = cameraAngle // Face towards camera (PI/4 radians)
              let currentRot = group.rotation.y
              
              // Normalize angles
              while (currentRot > Math.PI) currentRot -= Math.PI * 2
              while (currentRot < -Math.PI) currentRot += Math.PI * 2
              
              let targetRot = targetRotation
              while (targetRot > Math.PI) targetRot -= Math.PI * 2
              while (targetRot < -Math.PI) targetRot += Math.PI * 2
              
              let diff = targetRot - currentRot
              if (diff > Math.PI) diff -= Math.PI * 2
              if (diff < -Math.PI) diff += Math.PI * 2
              
              // Smooth rotation to face camera (faster rotation)
              const rotationSpeed = 0.2
              group.rotation.y += diff * rotationSpeed
            } else if (moveDistance > 0.001) {
              // Normal movement rotation
              const targetRotation = Math.atan2(totalMoveX, totalMoveZ)
              let currentRot = group.rotation.y
              
              // Normalize angles
              while (currentRot > Math.PI) currentRot -= Math.PI * 2
              while (currentRot < -Math.PI) currentRot += Math.PI * 2
              
              let targetRot = targetRotation
              while (targetRot > Math.PI) targetRot -= Math.PI * 2
              while (targetRot < -Math.PI) targetRot += Math.PI * 2
              
              let diff = targetRot - currentRot
              if (diff > Math.PI) diff -= Math.PI * 2
              if (diff < -Math.PI) diff += Math.PI * 2
              
              // Clamp turn speed to prevent flip-flopping
              const maxRotationSpeed = 0.15 // Maximum radians per frame (prevents rapid back-and-forth)
              const baseRotationSpeed = 0.08 // Base rotation speed
              const rotationSpeed = Math.min(maxRotationSpeed, Math.abs(diff) * 0.5 + baseRotationSpeed)
              const rotationDelta = Math.sign(diff) * Math.min(Math.abs(diff * rotationSpeed), maxRotationSpeed)
              group.rotation.y += rotationDelta
            }
            
            // Update position (only if not waving)
            let newX = path.x
            let newZ = path.z
            if (char.animationState !== ANIMATION_STATES.WAVE) {
              // Only move when not waving
              const forwardDistance = path.z + moveZ
              const sideDistance = path.x + moveX
              newX = sideDistance
              newZ = forwardDistance
            }
            
            // Smoother interpolation for position - faster movement
            const lerpFactor = 0.35 // Increased from 0.25 for faster, more responsive movement
            group.position.x += (newX - group.position.x) * lerpFactor
            group.position.z += (newZ - group.position.z) * lerpFactor
            
            // Update path reference
            path.x = group.position.x
            path.z = group.position.z
            
            // Apply animation based on state
            if (player) {
              if (!char.animProgress) char.animProgress = 0
              if (!char.animSpeed) char.animSpeed = 0.87285
              
              char.animProgress += deltaTime * char.animSpeed // Accumulate progress with deltaTime
              
              // Apply animation based on state
              try {
                if (char.animationState === ANIMATION_STATES.WAVE) {
                  WaveAnimation(player, char.animProgress, char.waveArm || 'left')
                } else {
                  WalkingAnimationNoHeadBob(player, char.animProgress)
                }
              } catch (err) {
                console.error('Animation error:', err)
              }
            }
            
            // Make nametag face camera (sprites auto-face camera, but ensure it's visible)
            if (char.nameTag) {
              // Sprites automatically face camera, but ensure it's positioned correctly
              char.nameTag.position.y = 25 // Keep it well above character's head
            }
          })
        }
        
        // Camera is FIXED - 45 degree angle from 500m away
        // Camera positioned 500 units away at 45 degree angle looking down
        const cameraDistance = 500
        const angle45 = Math.PI / 4
        skinViewer.camera.position.set(
          Math.sin(angle45) * cameraDistance,
          Math.cos(angle45) * cameraDistance,
          Math.cos(angle45) * cameraDistance
        )
        skinViewer.camera.lookAt(0, 0, 0) // Look at origin
      }
      
      skinViewer.render()
    }

    animate()

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
      window.removeEventListener('resize', handleResize)
      // Clean up blob URL if created
      if (skinBlobUrlRef.current && skinBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(skinBlobUrlRef.current)
        skinBlobUrlRef.current = null
      }
      skinViewer.dispose()
    }
  }, []) // Run once on mount

  // Animation transition function
  const transitionToAnimation = useCallback((newState) => {
    const animations = animationsRef.current
    if (!animations || !animations[newState]) return

    const currentAnim = currentAnimationRef.current
    const targetAnim = animations[newState]

    // Don't transition if already in this state
    if (currentAnim === targetAnim) return

    // Start new animation
    targetAnim.paused = false
    currentAnimationRef.current = targetAnim
    setCurrentAnimation(newState)
  }, [])


  return (
    <>
      <Starfield />
      <div 
        ref={wrapperRef}
        className="canvas-wrapper"
        key={animationKey}
      >
        <canvas ref={canvasRef} id="skinCanvas" />
      </div>
      <div className="info-box">
        You're looking at everybody online on Craft Down Under right now!
      </div>
      <div className="chatbox">
        <div className="chatbox-messages" ref={chatMessagesRef}>
          {chatMessages.map((msg, index) => (
            <div key={index} className={`chat-message chat-message-${msg.type}`}>
              {msg.message}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default SkinViewerComponent

