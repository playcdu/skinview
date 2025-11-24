import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as skinview3d from 'skinview3d'
import { PlayerObject } from 'skinview3d'
import { Group, Texture, TextureLoader, CanvasTexture, Raycaster, Vector2, Vector3, Box3, Sphere, Plane } from 'three'
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
    
    // Extract all players with their clusterId from all servers
    const playersWithCluster = []
    if (Array.isArray(data)) {
      data.forEach(server => {
        const clusterId = server.clusterId || 'UNKNOWN'
        if (server.onlinePlayerList && Array.isArray(server.onlinePlayerList)) {
          server.onlinePlayerList.forEach(player => {
            if (player.name) {
              playersWithCluster.push({
                username: player.name,
                clusterId: clusterId
              })
            }
          })
        }
      })
    }
    
    return playersWithCluster
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
  WAVE: 'wave',
  RUN: 'run'
}

// Idle animation - character stands still with subtle arm movement
const IdleAnimation = (player, progress) => {
  const skin = player.skin
  // Multiply by animation's natural speed
  const t = progress * 2
  
  // Arm swing - subtle movement
  const basicArmRotationZ = Math.PI * 0.02
  skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ
  skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ
  
  // Reset other rotations to idle state
  skin.leftLeg.rotation.x = 0
  skin.rightLeg.rotation.x = 0
  skin.leftArm.rotation.x = 0
  skin.rightArm.rotation.x = 0
  skin.head.rotation.y = 0
  skin.head.rotation.x = 0
  
  // Cape rotation if cape exists
  if (player.cape) {
    const basicCapeRotationX = Math.PI * 0.06
    player.cape.rotation.x = Math.sin(t) * 0.01 + basicCapeRotationX
    player.cape.visible = false
  }
}


// Hit animation - based on skinview3d HitAnimation class
const HitAnimation = (player, progress) => {
  const skin = player.skin
  const t = progress * 18
  
  skin.rightArm.rotation.x = -0.4537860552 * 2 + 2 * Math.sin(t + Math.PI) * 0.3
  const basicArmRotationZ = 0.01 * Math.PI + 0.06
  skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ
  skin.body.rotation.y = -Math.cos(t) * 0.06
  skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077
  skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05
  skin.leftArm.position.z = Math.cos(t) * 0.3
  skin.leftArm.position.x = 5 - Math.cos(t) * 0.05
}

// Running animation - based on skinview3d RunningAnimation class
const RunningAnimation = (player, progress) => {
  const skin = player.skin
  // Multiply by animation's natural speed
  const t = progress * 15 + Math.PI * 0.5
  
  // Leg swing with larger amplitude
  skin.leftLeg.rotation.x = Math.cos(t + Math.PI) * 1.3
  skin.rightLeg.rotation.x = Math.cos(t) * 1.3
  
  // Arm swing
  skin.leftArm.rotation.x = Math.cos(t) * 1.5
  skin.rightArm.rotation.x = Math.cos(t + Math.PI) * 1.5
  const basicArmRotationZ = Math.PI * 0.1
  skin.leftArm.rotation.z = Math.cos(t) * 0.1 + basicArmRotationZ
  skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.1 - basicArmRotationZ
  
  // Jumping
  player.position.y = Math.cos(t * 2)
  
  // Dodging when running
  player.position.x = Math.cos(t) * 0.15
  
  // Slightly tilting when running
  player.rotation.z = Math.cos(t + Math.PI) * 0.01
  
  // Apply higher swing frequency, lower amplitude,
  // and greater basic rotation around x axis,
  // to cape when running.
  if (player.cape) {
    const basicCapeRotationX = Math.PI * 0.3
    player.cape.rotation.x = Math.sin(t * 2) * 0.1 + basicCapeRotationX
    player.cape.visible = false
  }
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
// Flying animation - for thrown characters
const FlyingAnimation = (player, progress) => {
  const skin = player.skin
  
  // Body rotation finishes in 0.5s
  // Elytra expansion finishes in 3.3s
  const t = progress > 0 ? progress * 20 : 0
  const startProgress = Math.min(Math.max((t * t) / 100, 0), 1)
  
  // Rotate body forward (flying pose)
  player.rotation.x = (startProgress * Math.PI) / 2
  
  // Head rotation
  skin.head.rotation.x = startProgress > 0.5 ? Math.PI / 4 - player.rotation.x : 0
  
  // Arm rotation (spread out like wings)
  const basicArmRotationZ = Math.PI * 0.25 * startProgress
  skin.leftArm.rotation.z = basicArmRotationZ
  skin.rightArm.rotation.z = -basicArmRotationZ
  
  // Elytra rotation (if elytra exists)
  if (player.elytra) {
    const elytraRotationX = 0.34906584
    const elytraRotationZ = Math.PI / 2
    const interpolation = Math.pow(0.9, t)
    if (player.elytra.leftWing) {
      player.elytra.leftWing.rotation.x = elytraRotationX + interpolation * (0.2617994 - elytraRotationX)
      player.elytra.leftWing.rotation.z = elytraRotationZ + interpolation * (0.2617994 - elytraRotationZ)
    }
    if (player.elytra.updateRightWing) {
      player.elytra.updateRightWing()
    }
  }
  
  // Keep legs still
  skin.leftLeg.rotation.x = 0
  skin.rightLeg.rotation.x = 0
  
  // Disable cape if exists
  if (player.cape) {
    player.cape.visible = false
  }
}

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
  const raycasterRef = useRef(null) // Raycaster for click detection
  const handleClickRef = useRef(null) // Store click handler for cleanup
  const handleMouseMoveRef = useRef(null) // Store mousemove handler for cleanup
  const handleMouseDownRef = useRef(null) // Store mousedown handler for cleanup
  const handleDragMoveRef = useRef(null) // Store drag move handler for cleanup
  const handleMouseUpRef = useRef(null) // Store mouseup handler for cleanup
  const hoveredCharRef = useRef(null) // Currently hovered character
  const removeHoverEffectRef = useRef(null) // Store removeHoverEffect function for cleanup
  const draggedCharRef = useRef(null) // Currently dragged character
  const isDraggingRef = useRef(false) // Whether user is currently dragging
  const dragStartTimeRef = useRef(0) // Time when drag started
  const lastDragPosRef = useRef({ x: 0, z: 0 }) // Last drag position for velocity calculation
  const dragVelocityRef = useRef({ x: 0, z: 0 }) // Current drag velocity
  const lastDragTimeRef = useRef(0) // Last drag time for velocity calculation
  const targetFPS = 24
  const frameInterval = 1000 / targetFPS // ~41.67ms per frame at 24fps
  
  const [animationKey, setAnimationKey] = useState(0)
  const [currentAnimation, setCurrentAnimation] = useState(ANIMATION_STATES.IDLE)
  const [chatMessages, setChatMessages] = useState([]) // Store chat messages
  const [playerCount, setPlayerCount] = useState(0) // Total number of players online
  const [clusters, setClusters] = useState([]) // Detected player clusters
  const [selectedCluster, setSelectedCluster] = useState(null) // Selected cluster for formation
  const [formationMode, setFormationMode] = useState(false) // Whether formation mode is active
  const [clusterMenuOpen, setClusterMenuOpen] = useState(false) // Whether cluster menu is open
  
  // Refs to access current state values in animation loop
  const formationModeRef = useRef(false)
  const selectedClusterRef = useRef(null)
  const clustersRef = useRef([])
  
  // Update refs when state changes
  useEffect(() => {
    formationModeRef.current = formationMode
  }, [formationMode])
  
  useEffect(() => {
    selectedClusterRef.current = selectedCluster
  }, [selectedCluster])
  
  useEffect(() => {
    clustersRef.current = clusters
  }, [clusters])
  const isInitialLoadRef = useRef(true) // Track if this is the initial load
  const chatMessagesRef = useRef(null) // Ref for chat messages container
  
  // Auto-scroll chatbox when messages change
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chatMessages])

  // Detect clusters based on clusterId from API
  const detectClusters = useCallback(() => {
    const characters = charactersRef.current || []
    if (characters.length === 0) {
      setClusters([])
      return
    }

    // Group characters by clusterId
    const clusterMap = new Map()
    characters.forEach(char => {
      if (char.clusterId) {
        if (!clusterMap.has(char.clusterId)) {
          clusterMap.set(char.clusterId, [])
        }
        // Only add if not already in the array (prevent duplicates)
        if (!clusterMap.get(char.clusterId).includes(char.username)) {
          clusterMap.get(char.clusterId).push(char.username)
        }
      }
    })

    // Convert to array format
    const detectedClusters = Array.from(clusterMap.values())
    setClusters(detectedClusters)
  }, [])

  // Store detectClusters in a ref so it can be called from syncCharacters
  const detectClustersRef = useRef(detectClusters)
  detectClustersRef.current = detectClusters

  // Update clusters periodically
  useEffect(() => {
    const clusterInterval = setInterval(() => {
      detectClusters()
    }, 2000) // Update clusters every 2 seconds

    return () => clearInterval(clusterInterval)
  }, [detectClusters])

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
    
    // Create raycaster for click detection
    const raycaster = new Raycaster()
    raycasterRef.current = raycaster
    
    // Helper function to find character closest to mouse
    function findCharacterUnderMouse(event) {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      
      const allCharacters = charactersRef.current || []
      let closestChar = null
      let closestDistance = Infinity
      
      // Update camera matrices
      skinViewer.camera.updateMatrixWorld()
      
      // Project each character's position to screen coordinates and find closest
      allCharacters.forEach((char) => {
        if (char.group && char.player) {
          // Get the world position of the character group
          const worldPosition = new Vector3()
          char.group.getWorldPosition(worldPosition)
          
          // Project 3D position to screen coordinates
          const screenPosition = worldPosition.clone()
          screenPosition.project(skinViewer.camera)
          
          // Convert normalized device coordinates to screen pixels
          const screenX = (screenPosition.x * 0.5 + 0.5) * rect.width
          const screenY = (-screenPosition.y * 0.5 + 0.5) * rect.height
          
          // Calculate distance from mouse to character in screen space
          const dx = screenX - mouseX
          const dy = screenY - mouseY
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // Check if this character is closer than the current closest
          if (distance < closestDistance) {
            closestDistance = distance
            closestChar = char
          }
        }
      })
      
      // Only return if within a reasonable distance (e.g., 100 pixels)
      if (closestChar && closestDistance < 100) {
        return closestChar
      }
      
      return null
    }
    
    // Handle mouse move for hover detection
    const handleMouseMove = (event) => {
      event.preventDefault() // Prevent text selection
      const hoveredChar = findCharacterUnderMouse(event)
      
      // Remove hover effect from previous character
      if (hoveredCharRef.current && hoveredCharRef.current !== hoveredChar) {
        removeHoverEffect(hoveredCharRef.current)
      }
      
      // Apply hover effect to new character
      if (hoveredChar && hoveredChar !== hoveredCharRef.current) {
        applyHoverEffect(hoveredChar)
        canvas.style.cursor = 'pointer'
      } else if (!hoveredChar) {
        canvas.style.cursor = 'default'
      }
      
      hoveredCharRef.current = hoveredChar
    }
    
    // Handle mouse down / touch start - start drag or prepare for click
    const handleMouseDown = (event) => {
      event.preventDefault()
      event.stopPropagation()
      
      const hitChar = findCharacterUnderMouse(event)
      if (hitChar) {
        draggedCharRef.current = hitChar
        isDraggingRef.current = false
        dragStartTimeRef.current = Date.now()
        canvas.style.cursor = 'grabbing'
        
        // Switch to idle animation and start floating
        hitChar.animationState = ANIMATION_STATES.IDLE
        hitChar.isFloating = true
        hitChar.floatHeight = 3.0 // Float 3 units above ground
        hitChar.dropVelocity = 0 // Reset drop velocity
        hitChar.animProgress = 0 // Reset animation progress for idle
        hitChar.throwVelocity = null // Initialize throw velocity
        hitChar.isThrown = false // Track if character is being thrown
        hitChar.throwRotation = { x: 0, z: 0 } // Tilt rotation during drag/throw
        // Initialize drag tracking
        const rect = canvas.getBoundingClientRect()
        const clientX = event.clientX !== undefined ? event.clientX : event.touches?.[0]?.clientX
        const clientY = event.clientY !== undefined ? event.clientY : event.touches?.[0]?.clientY
        if (clientX !== undefined && clientY !== undefined) {
          const mouse = new Vector2()
          mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
          mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(mouse, skinViewer.camera)
          const planeNormal = new Vector3(0, 1, 0)
          const plane = new Plane(planeNormal, 0)
          const intersectionPoint = new Vector3()
          raycaster.ray.intersectPlane(plane, intersectionPoint)
          if (intersectionPoint) {
            lastDragPosRef.current = { x: intersectionPoint.x, z: intersectionPoint.z }
          } else {
            // Fallback to character's current position
            lastDragPosRef.current = { x: hitChar.path.x, z: hitChar.path.z }
          }
        } else {
          // Fallback to character's current position
          lastDragPosRef.current = { x: hitChar.path.x, z: hitChar.path.z }
        }
        lastDragTimeRef.current = Date.now()
        dragVelocityRef.current = { x: 0, z: 0 }
        hitChar.throwVelocity = { x: 0, z: 0, y: 0 } // Initialize throw velocity
        hitChar.isThrown = false // Track if character is being thrown
        hitChar.throwRotation = { x: 0, z: 0 } // Tilt rotation during throw
      }
    }
    
    // Handle mouse move / touch move - drag character if dragging
    const handleDragMove = (event) => {
      if (!draggedCharRef.current) return
      
      const rect = canvas.getBoundingClientRect()
      const clientX = event.clientX !== undefined ? event.clientX : event.touches?.[0]?.clientX
      const clientY = event.clientY !== undefined ? event.clientY : event.touches?.[0]?.clientY
      
      if (clientX === undefined || clientY === undefined) return
      
      // Check if we've moved enough to consider it a drag
      const mouse = new Vector2()
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
      
      // Project mouse to ground plane (y = 0)
      raycaster.setFromCamera(mouse, skinViewer.camera)
      
      // Create a plane at y = 0 (ground level)
      const planeNormal = new Vector3(0, 1, 0)
      const plane = new Plane(planeNormal, 0)
      
      const intersectionPoint = new Vector3()
      raycaster.ray.intersectPlane(plane, intersectionPoint)
      
      if (intersectionPoint) {
        isDraggingRef.current = true
        
        // Move character to intersection point
        const char = draggedCharRef.current
        if (char && char.group && char.path) {
          const currentTime = Date.now()
          const deltaTime = Math.max(0.001, (currentTime - lastDragTimeRef.current) / 1000) // Convert to seconds
          
          // Calculate velocity based on movement
          const dx = intersectionPoint.x - lastDragPosRef.current.x
          const dz = intersectionPoint.z - lastDragPosRef.current.z
          const velocityX = deltaTime > 0 ? dx / deltaTime : 0
          const velocityZ = deltaTime > 0 ? dz / deltaTime : 0
          
          // Smooth velocity with exponential moving average
          const smoothing = 0.3
          dragVelocityRef.current.x = dragVelocityRef.current.x * (1 - smoothing) + velocityX * smoothing
          dragVelocityRef.current.z = dragVelocityRef.current.z * (1 - smoothing) + velocityZ * smoothing
          
          // Calculate movement speed for tilt
          const speed = Math.sqrt(dragVelocityRef.current.x ** 2 + dragVelocityRef.current.z ** 2)
          const maxTilt = Math.min(speed * 0.15, 0.4) // Max tilt of 0.4 radians (~23 degrees)
          
          // Initialize throw properties if not set
          if (!char.throwRotation) {
            char.throwRotation = { x: 0, z: 0 }
          }
          
          // Apply tilt based on movement direction
          if (speed > 0.1) {
            const tiltDirection = Math.atan2(dragVelocityRef.current.x, dragVelocityRef.current.z)
            char.throwRotation.x = Math.sin(tiltDirection) * maxTilt // Tilt left/right
            char.throwRotation.z = Math.cos(tiltDirection) * maxTilt * 0.5 // Slight forward tilt
          } else {
            // Gradually return to neutral when not moving
            char.throwRotation.x *= 0.9
            char.throwRotation.z *= 0.9
          }
          
          // Update path position directly
          char.path.x = intersectionPoint.x
          char.path.z = intersectionPoint.z
          
          // Also update group position immediately (less lerp for dragging)
          char.group.position.x = intersectionPoint.x
          char.group.position.z = intersectionPoint.z
          
          // Apply tilt rotation
          char.group.rotation.x = char.throwRotation.x
          char.group.rotation.z = char.throwRotation.z
          
          // Keep character floating while dragging
          if (char.isFloating) {
            char.group.position.y = char.floatHeight || 3.0
          }
          
          // Update tracking
          lastDragPosRef.current = { x: intersectionPoint.x, z: intersectionPoint.z }
          lastDragTimeRef.current = currentTime
        }
      }
    }
    
    // Handle mouse up / touch end - end drag or hit character
    const handleMouseUp = (event) => {
      if (!draggedCharRef.current) return
      
      const char = draggedCharRef.current
      const dragDuration = Date.now() - dragStartTimeRef.current
      const wasDragging = isDraggingRef.current
      
      // Store the character before cleaning up drag state
      const draggedCharacter = char
      
      // Clean up drag state first
      draggedCharRef.current = null
      isDraggingRef.current = false
      
      // If it was a quick click (< 200ms) and not dragged much, hit the character
      if (!wasDragging && dragDuration < 200) {
        // Quick click - hit the character
        removeHoverEffect(draggedCharacter)
        hitCharacter(skinViewer, draggedCharacter)
        // Reset floating state
        draggedCharacter.isFloating = false
        draggedCharacter.group.position.y = 0
      } else if (wasDragging) {
        // Was dragging - check if thrown with force
        const throwSpeed = Math.sqrt(dragVelocityRef.current.x ** 2 + dragVelocityRef.current.z ** 2)
        const throwThreshold = 2.0 // Lower threshold - minimum speed to trigger throw (units per second)
        
        // Always reset tilt immediately when released (tilt only during drag)
        draggedCharacter.group.rotation.x = 0
        draggedCharacter.group.rotation.z = 0
        draggedCharacter.throwRotation = { x: 0, z: 0 }
        
        if (throwSpeed > throwThreshold) {
          // Character was thrown - apply inertia
          draggedCharacter.isThrown = true
          draggedCharacter.isFloating = true
          // Use the raw velocity, scale it appropriately for visible effect
          draggedCharacter.throwVelocity = {
            x: dragVelocityRef.current.x * 1.5, // Scale up for more visible effect
            z: dragVelocityRef.current.z * 1.5,
            y: Math.min(throwSpeed * 0.2, 15) // Reduced upward velocity - lower height (was 0.5, 35)
          }
          draggedCharacter.dropVelocity = draggedCharacter.throwVelocity.y
          draggedCharacter.animationState = ANIMATION_STATES.IDLE // Idle while flying
          
          // Face the direction they're being thrown
          const throwDirection = Math.atan2(draggedCharacter.throwVelocity.x, draggedCharacter.throwVelocity.z)
          draggedCharacter.group.rotation.y = throwDirection
          
          console.log(`🚀 Thrown ${draggedCharacter.username} with speed ${throwSpeed.toFixed(2)}, velocity=(${draggedCharacter.throwVelocity.x.toFixed(2)}, ${draggedCharacter.throwVelocity.z.toFixed(2)}, ${draggedCharacter.throwVelocity.y.toFixed(2)})`)
        } else {
          // Gentle drop - no throw, just gently lower to ground
          if (draggedCharacter.group.position.y > 0) {
            // Character is floating, gently drop them
            draggedCharacter.isFloating = true
            draggedCharacter.dropVelocity = -2.0 // Gentle downward velocity (much slower than gravity)
            draggedCharacter.animationState = ANIMATION_STATES.IDLE // Idle while gently dropping
            console.log(`📦 Gently dropping ${draggedCharacter.username} (speed ${throwSpeed.toFixed(2)} was below threshold ${throwThreshold})`)
          } else {
            // Already on ground, just reset
            draggedCharacter.isFloating = false
            draggedCharacter.dropVelocity = undefined
            draggedCharacter.animationState = ANIMATION_STATES.WALK // Return to walking
            console.log(`📦 Dropped ${draggedCharacter.username} (already on ground)`)
          }
        }
        
        // Mark that this was a drag release to prevent click handler from firing
        draggedCharacter.wasJustDragged = true
        setTimeout(() => {
          draggedCharacter.wasJustDragged = false
        }, 100) // Clear flag after 100ms
        
        // Reset drag tracking
        dragVelocityRef.current = { x: 0, z: 0 }
        lastDragPosRef.current = { x: 0, z: 0 }
      }
      
      hoveredCharRef.current = null
      canvas.style.cursor = 'default'
    }
    
    // Handle click to hit characters (fallback for quick clicks)
    const handleClick = (event) => {
      // Only handle click if we're not dragging and character wasn't just dragged
      const hitChar = findCharacterUnderMouse(event)
      if (hitChar && hitChar.wasJustDragged) {
        // Character was just dragged, don't hit them
        event.preventDefault()
        event.stopPropagation()
        return
      }
      
      if (!isDraggingRef.current && !draggedCharRef.current) {
        event.preventDefault()
        event.stopPropagation()
        
        if (hitChar) {
          // Remove hover effect and apply hit effect
          removeHoverEffect(hitChar)
          hitCharacter(skinViewer, hitChar)
          hoveredCharRef.current = null
          canvas.style.cursor = 'default'
        }
      }
    }
    
    // Function to apply hover effect (outline/glow)
    function applyHoverEffect(char) {
      if (!char.player || char.isHovered) return
      
      char.isHovered = true
      char.originalEmissive = {}
      
      // Add white emissive glow to all materials
      char.player.traverse((obj) => {
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((mat, idx) => {
            if (mat.emissive !== undefined) {
              const key = `${obj.uuid}-${idx}`
              char.originalEmissive[key] = { ...mat.emissive }
              mat.emissive.setHex(0x444444) // Subtle white glow
              mat.emissiveIntensity = 0.3
              mat.needsUpdate = true
            }
          })
        }
      })
    }
    
    // Function to remove hover effect
    function removeHoverEffect(char) {
      if (!char || !char.player || !char.isHovered) return
      
      char.isHovered = false
      
      // Restore original emissive values
      char.player.traverse((obj) => {
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((mat, idx) => {
            const key = `${obj.uuid}-${idx}`
            if (char.originalEmissive && char.originalEmissive[key]) {
              mat.emissive.copy(char.originalEmissive[key])
              mat.emissiveIntensity = 0
              mat.needsUpdate = true
            }
          })
        }
      })
      
      char.originalEmissive = {}
    }
    
    // Store removeHoverEffect for cleanup
    removeHoverEffectRef.current = removeHoverEffect
    
    // Function to hit a character (user-initiated click)
    function hitCharacter(skinViewer, char) {
      // Skip if already being hit
      if (char.isHit) return
      
      char.isHit = true
      char.hitTimer = 0.6 // Red overlay duration (0.6 seconds - increased)
      char.wasHitByPlayer = false // Mark as user-initiated hit (not player-to-player)
      
      // Apply red overlay to all materials
      const redTint = { r: 1.5, g: 0.5, b: 0.5 } // Red tint
      char.player.traverse((obj) => {
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach(mat => {
            if (mat.color) {
              mat.color.r *= redTint.r
              mat.color.g *= redTint.g
              mat.color.b *= redTint.b
              mat.needsUpdate = true
            }
          })
        }
      })
      
      // Apply knockback - upward and backward from camera direction
      const cameraDirection = new Vector3()
      skinViewer.camera.getWorldDirection(cameraDirection)
      cameraDirection.normalize()
      
      // Knockback force: upward and away from camera (increased for more intensity)
      const knockbackUp = 22 // Upward force (increased from 15)
      const knockbackBack = 18 // Backward force (increased from 12)
      
      char.knockbackVelocity = {
        x: -cameraDirection.x * knockbackBack,
        y: knockbackUp,
        z: -cameraDirection.z * knockbackBack
      }
      
      char.gravity = 0.5 // Gravity strength
      char.knockbackStartTime = Date.now() // Track when knockback started
      char.knockbackMinDuration = 0.8 // Minimum knockback duration in seconds (ensures longer knockback)
    }
    
    handleClickRef.current = handleClick
    handleMouseMoveRef.current = handleMouseMove
    handleMouseDownRef.current = handleMouseDown
    handleDragMoveRef.current = handleDragMove
    handleMouseUpRef.current = handleMouseUp
    
    // Verify canvas exists before adding listeners
    if (!canvas) {
      console.error('Canvas element not found!')
      return
    }
    
    console.log('Adding event listeners to canvas:', canvas)
    console.log('Canvas dimensions:', canvas.width, canvas.height)
    console.log('Canvas style:', window.getComputedStyle(canvas))
    
    // Prevent text selection on canvas and wrapper
    const preventSelection = (e) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    
    canvas.addEventListener('selectstart', preventSelection)
    canvas.addEventListener('mousedown', preventSelection)
    canvas.addEventListener('contextmenu', preventSelection)
    canvas.addEventListener('dragstart', preventSelection)
    
    // Also prevent on wrapper
    const wrapper = wrapperRef.current
    if (wrapper) {
      wrapper.addEventListener('selectstart', preventSelection)
      wrapper.addEventListener('mousedown', preventSelection)
      wrapper.addEventListener('contextmenu', preventSelection)
      wrapper.addEventListener('dragstart', preventSelection)
    }
    
    // Test handlers removed - events are working
    
    // Add main handlers with capture to ensure they fire
    canvas.addEventListener('mousedown', handleMouseDown, { capture: true })
    canvas.addEventListener('mousemove', handleMouseMove, { capture: true })
    canvas.addEventListener('mousemove', handleDragMove, { capture: true })
    canvas.addEventListener('mouseup', handleMouseUp, { capture: true })
    canvas.addEventListener('click', handleClick, { capture: true })
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleMouseDown, { capture: true })
    canvas.addEventListener('touchmove', handleDragMove, { capture: true })
    canvas.addEventListener('touchend', handleMouseUp, { capture: true })
    
    // Also add to wrapper as backup
    if (wrapper) {
      wrapper.addEventListener('click', handleClick, { capture: true })
      wrapper.addEventListener('mousemove', handleMouseMove, { capture: true })
    }
    
    console.log('Event listeners added successfully to canvas and wrapper')

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
    function addCharacter(skinViewer, username, clusterId) {
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
                    clusterId: clusterId || 'UNKNOWN', // Store clusterId from API
                    animProgress: Math.random() * 2,
                    animSpeed: 0.87285,
                    animationState: ANIMATION_STATES.WAVE, // Start with wave animation on spawn
                    animationStateTimer: Math.random() * 10 + 5,
                    path: {
                      x: startX,
                      z: startZ,
                      angle: Math.random() * Math.PI * 2,
                      targetX: Math.cos(Math.random() * Math.PI * 2) * (50 + Math.random() * 150),
                      targetZ: Math.sin(Math.random() * Math.PI * 2) * (50 + Math.random() * 150),
                      changeTargetTime: Math.random() * 3 + 2
                    },
                    waveDuration: 4.0 + Math.random() * 2.0, // Wave for 4-6 seconds on spawn
                    waveArm: Math.random() > 0.5 ? 'left' : 'right',
                    // Pathfinding state
                    lastPosition: { x: startX, z: startZ },
                    stuckTimer: 0,
                    stuckThreshold: 2.0, // Consider stuck if not progressing for 2 seconds
                    pathBlockedCheckTimer: 0
                  }
                  
                  characters.push(characterData)
                  charactersRef.current = characters
                  // Don't update player count here - it's updated in syncCharacters
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
      // Don't update player count here - it's updated in syncCharacters
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
      const onlinePlayers = await fetchOnlinePlayers() // Now returns array of {username, clusterId}
      const currentCharacters = charactersRef.current || []
      const currentUsernames = currentCharacters.map(char => char.username)
      const onlineUsernames = onlinePlayers.map(p => p.username)
      
      // Find characters to add
      const toAdd = onlinePlayers.filter(player => !currentUsernames.includes(player.username))
      
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
        toAdd.forEach(player => {
          addChatMessage(player.username, 'login')
        })
      }
      
      // Add new characters with their clusterId
      const addPromises = toAdd.map(player => addCharacter(skinViewer, player.username, player.clusterId))
      await Promise.all(addPromises)
      
      // Update clusterId for existing characters (in case they switched servers)
      onlinePlayers.forEach(player => {
        const existingChar = currentCharacters.find(char => char.username === player.username)
        if (existingChar) {
          existingChar.clusterId = player.clusterId
        }
      })
      
      // Mark initial load as complete after first sync
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false
      }
      
      // Update player count from online players (not from characters array to avoid double counting)
      setPlayerCount(onlineUsernames.length)
      
      // Update clusters after sync
      if (detectClustersRef.current) {
        detectClustersRef.current()
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
          setPlayerCount(characters.length) // Update player count
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
          
          // Formation mode logic - use refs to get current values
          const currentFormationMode = formationModeRef.current
          const currentSelectedCluster = selectedClusterRef.current
          const currentClusters = clustersRef.current
          
          if (currentFormationMode && currentSelectedCluster !== null && currentClusters.length > currentSelectedCluster) {
            const selectedClusterUsernames = currentClusters[currentSelectedCluster]
            const clusterCharacters = allCharacters.filter(char => 
              selectedClusterUsernames.includes(char.username)
            )
            const nonClusterCharacters = allCharacters.filter(char => 
              !selectedClusterUsernames.includes(char.username)
            )
            
            // Log formation mode statistics (only once per activation)
            const wasFormationModeActive = allCharacters.some(char => char.formationMode)
            if (!wasFormationModeActive) {
              const clusterId = clusterCharacters[0]?.clusterId || 'UNKNOWN'
              const formationRows = Math.ceil(Math.sqrt(clusterCharacters.length))
              const formationCols = Math.ceil(clusterCharacters.length / formationRows)
              console.log(`🎯 Formation Mode Activated!`)
              console.log(`   Cluster: ${clusterId}`)
              console.log(`   📊 ${clusterCharacters.length} players will form up in military formation`)
              console.log(`   🚶 ${nonClusterCharacters.length} players will walk offscreen and despawn`)
              console.log(`   📐 Formation grid: ${formationRows} rows × ${formationCols} columns`)
              console.log(`   ⏳ Waiting for players to reach formation positions...`)
            }
            
            // Clear formation mode flags when exiting formation mode
            allCharacters.forEach(char => {
              if (!currentFormationMode) {
                char.formationMode = false
                char.shouldDespawn = false
                if (char.path.changeTargetTime === 999999) {
                  char.path.changeTargetTime = Math.random() * 5 + 4 // Reset to normal
                }
              }
            })

            // Calculate formation positions for cluster characters (military grid formation)
            // Line up shoulder to shoulder facing camera
            const formationRows = Math.ceil(Math.sqrt(clusterCharacters.length))
            const formationCols = Math.ceil(clusterCharacters.length / formationRows)
            const formationSpacing = 40 // Much more spacing between players in formation
            const formationCenterX = 0 // Center of screen
            const formationCenterZ = 0 // Center of screen

            clusterCharacters.forEach((char, idx) => {
              if (!char || !char.path || !char.group) return

              const row = Math.floor(idx / formationCols)
              const col = idx % formationCols
              const offsetX = (col - (formationCols - 1) / 2) * formationSpacing
              const offsetZ = (row - (formationRows - 1) / 2) * formationSpacing

              // Set formation target
              char.path.targetX = formationCenterX + offsetX
              char.path.targetZ = formationCenterZ + offsetZ
              char.path.changeTargetTime = 999999 // Prevent random target changes
              char.formationMode = true
              // Stop all other actions
              char.hitTargetPlayer = null
              char.isHitting = false
              char.runAwayTimer = undefined
              char.runAwayTarget = null
              char.runAwayFrom = null
              char.shouldRunAway = false
              char.animationState = ANIMATION_STATES.WALK // Will change to IDLE when in position
            })

            // Make non-cluster characters run offscreen (all go right)
            nonClusterCharacters.forEach((char, idx) => {
              if (!char || !char.path || !char.group) return

              // All characters go right (positive X)
              const offscreenDistance = 600
              
              // Stagger Z positions to avoid stacking (spread them out vertically)
              const zOffset = (idx % 10) * 8 - 36 // Spread across Z axis (-36 to +36)
              
              // Path to offscreen right only - keep Z staggered to avoid collisions
              char.path.targetX = offscreenDistance
              char.path.targetZ = zOffset // Staggered Z position to avoid stacking
              char.path.changeTargetTime = 999999 // Prevent random target changes
              char.formationMode = true
              char.shouldDespawn = true // Mark for despawning
              char.animationState = ANIMATION_STATES.RUN // Use run animation
              char.fadeOutOpacity = 1.0 // Track opacity for fade out
              char.isFadedOut = false // Track if character is faded out
            })
          }

          allCharacters.forEach((char, index) => {
            // Safety checks
            if (!char || !char.path || !char.group || !char.player) {
              return // Skip invalid characters
            }
            
            const path = char.path
            const group = char.group
            const player = char.player
            
            // Handle death sequence FIRST (for all dying characters - thrown or hit)
            if (char.isDying) {
              char.deathTimer -= deltaTime
              
              // Keep character stopped (no movement during death)
              if (char.throwVelocity) {
                char.throwVelocity.x = 0
                char.throwVelocity.z = 0
              }
              if (char.dropVelocity !== undefined) {
                char.dropVelocity = 0
              }
              
              // Stop pathing and movement completely
              char.path.targetX = char.path.x
              char.path.targetZ = char.path.z
              char.path.changeTargetTime = Infinity
              group.position.x = char.path.x // Lock position
              group.position.z = char.path.z
              
              // Stop any other movement states
              char.shouldRunAway = false
              char.runAwayTimer = undefined
              char.runAwayTarget = undefined
              char.runAwayFrom = undefined
              char.hitTargetPlayer = undefined
              char.isHitting = false
              
              // Smooth rotation to fall over
              if (char.fallRotation) {
                const rotationSpeed = 0.15 // Rotation speed per frame
                const targetX = char.fallRotation.targetX
                const targetZ = char.fallRotation.targetZ
                let currentX = char.fallRotation.currentX
                let currentZ = char.fallRotation.currentZ
                
                // Smoothly rotate towards target
                const diffX = targetX - currentX
                const diffZ = targetZ - currentZ
                currentX += diffX * rotationSpeed
                currentZ += diffZ * rotationSpeed
                
                // Update rotation
                group.rotation.x = currentX
                group.rotation.z = currentZ
                
                // Update stored values
                char.fallRotation.currentX = currentX
                char.fallRotation.currentZ = currentZ
                
                // If close enough to target, snap to it
                if (Math.abs(diffX) < 0.01 && Math.abs(diffZ) < 0.01) {
                  group.rotation.x = targetX
                  group.rotation.z = targetZ
                  char.fallRotation = undefined // Clear after reaching target
                }
              } else {
                // Initialize fall rotation if not already set
                char.fallRotation = {
                  targetX: Math.PI / 2, // Fall forward
                  targetZ: (Math.random() - 0.5) * 0.3, // Slight random tilt
                  currentX: group.rotation.x || 0,
                  currentZ: group.rotation.z || 0
                }
              }
              
              // Fade out
              const fadeProgress = 1 - (char.deathTimer / 1.2)
              player.traverse((obj) => {
                if (obj.material) {
                  const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                  materials.forEach((mat) => {
                    mat.transparent = true
                    mat.opacity = 1 - fadeProgress
                  })
                }
              })
              
              // Fade nametag
              if (char.nameTag && char.nameTag.material) {
                char.nameTag.material.opacity = 1 - fadeProgress
              }
              
              // Respawn when fade complete
              if (char.deathTimer <= 0) {
                // Respawn at new random location
                const spacing = 120
                const angle = Math.random() * Math.PI * 2
                const radius = 50 + Math.random() * 150
                const newX = Math.cos(angle) * radius + (Math.random() - 0.5) * spacing * 0.5
                const newZ = Math.sin(angle) * radius + (Math.random() - 0.5) * spacing * 0.5
                
                // Reset position
                path.x = newX
                path.z = newZ
                group.position.set(newX, 0, newZ)
                group.rotation.y = Math.random() * Math.PI * 2
                
                // Reset all states
                char.isThrown = false
                char.isFloating = false
                char.isDying = false
                char.throwVelocity = null
                char.dropVelocity = undefined
                char.isHit = false
                char.hitTimer = undefined
                char.animationState = ANIMATION_STATES.WAVE // Wave on respawn
                char.waveDuration = 2.0 + Math.random() * 1.0
                char.waveArm = Math.random() > 0.5 ? 'left' : 'right'
                char.animProgress = 0
                
                // Reset pathing
                char.path.changeTargetTime = Date.now() + Math.random() * 2000 + 1000
                
                // Reset all rotations (including fall-over rotation)
                group.rotation.x = 0
                group.rotation.z = 0
                char.throwRotation = { x: 0, z: 0 }
                char.fallRotation = undefined // Clear fall rotation
                if (player.rotation) {
                  player.rotation.x = 0
                  player.rotation.z = 0
                }
                if (player.skin && player.skin.head) {
                  player.skin.head.rotation.x = 0
                }
                if (player.skin && player.skin.leftArm) {
                  player.skin.leftArm.rotation.z = 0
                }
                if (player.skin && player.skin.rightArm) {
                  player.skin.rightArm.rotation.z = 0
                }
                
                // Restore materials (remove red tint and restore opacity)
                player.traverse((obj) => {
                  if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                    materials.forEach((mat) => {
                      if (mat.color) {
                        mat.color.setRGB(1.0, 1.0, 1.0) // Reset to white
                      }
                      mat.transparent = false
                      mat.opacity = 1.0
                      mat.needsUpdate = true
                    })
                  }
                })
                
                // Restore nametag
                if (char.nameTag && char.nameTag.material) {
                  char.nameTag.material.opacity = 0.5 // Original nametag opacity
                }
                
                console.log(`✨ ${char.username} respawned at (${newX.toFixed(1)}, ${newZ.toFixed(1)})`)
                
                // Skip rest of logic this frame
                return
              }
              
              // Skip rest of logic while dying
              return
            }
            
            // Skip normal movement logic if in formation mode (handled above)
            if (char.formationMode) {
              // Check if this is a cluster character (should form up) or non-cluster (should despawn)
              const isClusterChar = currentFormationMode && currentSelectedCluster !== null && currentClusters.length > currentSelectedCluster && 
                                    currentClusters[currentSelectedCluster].includes(char.username)
              
              if (isClusterChar) {
                // Cluster character - move to formation position
                const dx = path.targetX - path.x
                const dz = path.targetZ - path.z
                const distance = Math.sqrt(dx * dx + dz * dz)
                
                if (distance > 0.3) {
                  // Move towards formation position
                  const moveSpeed = baseMoveSpeed * 5.0 // Much faster movement in formation mode
                  const moveX = (dx / distance) * moveSpeed
                  const moveZ = (dz / distance) * moveSpeed
                  
                  path.x += moveX * deltaTime
                  path.z += moveZ * deltaTime
                  group.position.x = path.x
                  group.position.z = path.z
                  
                  // Face the direction they are walking (not camera)
                  if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
                    const targetRotation = Math.atan2(dx, dz)
                    let currentRot = group.rotation.y
                    while (currentRot > Math.PI) currentRot -= Math.PI * 2
                    while (currentRot < -Math.PI) currentRot += Math.PI * 2
                    let targetRot = targetRotation
                    while (targetRot > Math.PI) targetRot -= Math.PI * 2
                    while (targetRot < -Math.PI) targetRot += Math.PI * 2
                    let diff = targetRot - currentRot
                    if (diff > Math.PI) diff -= Math.PI * 2
                    if (diff < -Math.PI) diff += Math.PI * 2
                    const rotationSpeed = 0.5
                    group.rotation.y += diff * rotationSpeed
                  }
                  
                  // Play walking animation (only if not already waving)
                  if (char.animationState !== ANIMATION_STATES.WAVE) {
                    char.animationState = ANIMATION_STATES.WALK
                    char.animProgress += deltaTime * char.animSpeed
                    try {
                      WalkingAnimationNoHeadBob(player, char.animProgress)
                    } catch (err) {
                      console.error('Animation error:', err)
                    }
                  }
                } else {
                  // Reached formation position - idle and face camera
                  if (char.animationState === ANIMATION_STATES.WALK) {
                    // Mark that this character has reached formation position
                    char.reachedFormationPosition = true
                    char.animationState = ANIMATION_STATES.IDLE
                    char.animProgress = 0 // Reset animation progress for idle
                    
                    // Count how many have reached formation
                    const clusterCharacters = allCharacters.filter(c => 
                      c.formationMode && !c.shouldDespawn && currentSelectedCluster !== null && 
                      currentClusters[currentSelectedCluster]?.includes(c.username)
                    )
                    const reachedCount = clusterCharacters.filter(c => c.reachedFormationPosition).length
                    const totalCount = clusterCharacters.length
                    
                    if (reachedCount === totalCount && totalCount > 0) {
                      console.log(`   ✅ All ${totalCount} players have reached formation positions!`)
                    } else {
                      console.log(`   ✅ ${char.username} reached formation (${reachedCount}/${totalCount})`)
                    }
                  }
                  
                  // Stop moving - character has reached formation position
                  // Don't update path.x or path.z - keep them at formation position
                  
                  // Face camera
                  const cameraAngle = Math.PI / 4 // 45 degrees
                  let currentRot = group.rotation.y
                  while (currentRot > Math.PI) currentRot -= Math.PI * 2
                  while (currentRot < -Math.PI) currentRot += Math.PI * 2
                  let diff = cameraAngle - currentRot
                  if (diff > Math.PI) diff -= Math.PI * 2
                  if (diff < -Math.PI) diff += Math.PI * 2
                  const rotationSpeed = 0.5
                  group.rotation.y += diff * rotationSpeed
                  
                  // Idle animation
                  char.animProgress += deltaTime * char.animSpeed
                  try {
                    IdleAnimation(player, char.animProgress)
                  } catch (err) {
                    console.error('Animation error:', err)
                  }
                }
              } else {
                // Non-cluster character - run offscreen and fade out (left/right only)
                const dx = path.targetX - path.x
                const targetZ = 0 // Always move to center Z for horizontal movement
                const dz = targetZ - path.z
                
                // Initialize fade out opacity if not set
                if (char.fadeOutOpacity === undefined) {
                  char.fadeOutOpacity = 1.0
                  char.isFadedOut = false
                }
                
                // First, move to center Z if not already there (quickly)
                if (Math.abs(dz) > 0.5) {
                  // Move towards center Z quickly
                  const zMoveSpeed = baseMoveSpeed * 10
                  const moveZ = (dz > 0 ? 1 : -1) * zMoveSpeed * deltaTime
                  path.z += moveZ
                  group.position.z = path.z
                } else {
                  // At center Z, now move horizontally only
                  path.z = 0
                  group.position.z = 0
                }
                
                // Move horizontally (right only) with collision avoidance
                if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
                  // Collision avoidance with other offscreen characters
                  const avoidanceRadius = 15
                  const minDistance = 12
                  let avoidX = 0
                  let avoidZ = 0
                  
                  allCharacters.forEach(otherChar => {
                    if (otherChar === char || !otherChar.shouldDespawn || !otherChar.path) return
                    
                    const otherX = otherChar.path.x
                    const otherZ = otherChar.path.z
                    const distX = path.x - otherX
                    const distZ = path.z - otherZ
                    const dist = Math.sqrt(distX * distX + distZ * distZ)
                    
                    if (dist < avoidanceRadius && dist > 0) {
                      const strength = (avoidanceRadius - dist) / avoidanceRadius
                      avoidX += (distX / dist) * strength * 20
                      avoidZ += (distZ / dist) * strength * 20
                    }
                  })
                  
                  // Apply avoidance
                  if (Math.abs(avoidX) > 0.01 || Math.abs(avoidZ) > 0.01) {
                    path.x += avoidX * deltaTime
                    path.z += avoidZ * deltaTime
                    group.position.x = path.x
                    group.position.z = path.z
                  }
                  
                  // Move towards offscreen target (very fast, like running)
                  const moveSpeed = baseMoveSpeed * 25.0 // Much faster - all go right
                  const moveX = (dx > 0 ? 1 : -1) * moveSpeed * deltaTime
                  const moveZ = (dz > 0 ? 1 : -1) * moveSpeed * deltaTime
                  
                  path.x += moveX
                  path.z += moveZ
                  group.position.x = path.x
                  group.position.z = path.z
                  
                  // Face movement direction (right)
                  const targetRotation = Math.PI / 2 // Right = 90°
                  let currentRot = group.rotation.y
                  while (currentRot > Math.PI) currentRot -= Math.PI * 2
                  while (currentRot < -Math.PI) currentRot += Math.PI * 2
                  let diff = targetRotation - currentRot
                  if (diff > Math.PI) diff -= Math.PI * 2
                  if (diff < -Math.PI) diff += Math.PI * 2
                  const rotationSpeed = 0.6
                  group.rotation.y += diff * rotationSpeed
                  
                  // Play running animation
                  char.animationState = ANIMATION_STATES.RUN
                  char.animProgress += deltaTime * char.animSpeed
                  try {
                    RunningAnimation(player, char.animProgress)
                  } catch (err) {
                    console.error('Animation error:', err)
                  }
                } else {
                  // Reached offscreen position - fade out
                  if (!char.isFadedOut) {
                    char.isFadedOut = true
                    console.log(`   👻 ${char.username} reached offscreen position - fading out`)
                  }
                  
                  // Fade out gradually
                  if (char.fadeOutOpacity > 0) {
                    char.fadeOutOpacity = Math.max(0, char.fadeOutOpacity - deltaTime * 2) // Fade out over 0.5 seconds
                    
                    // Apply opacity to all materials in the character group
                    group.traverse((child) => {
                      if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                          child.material.forEach(mat => {
                            mat.transparent = true
                            mat.opacity = char.fadeOutOpacity
                          })
                        } else {
                          child.material.transparent = true
                          child.material.opacity = char.fadeOutOpacity
                        }
                      }
                    })
                    
                    // Also fade nametag
                    if (char.nameTag && char.nameTag.material) {
                      char.nameTag.material.opacity = char.fadeOutOpacity
                    }
                  }
                }
              }
              
              // Skip rest of normal movement logic
              return
            }
            
            // Handle fade-in for characters that were faded out (when formation mode is cancelled)
            if (char.fadeOutOpacity !== undefined && char.fadeOutOpacity < 1.0 && !char.isFadedOut && !char.formationMode) {
              char.fadeOutOpacity = Math.min(1.0, char.fadeOutOpacity + deltaTime * 2) // Fade in over 0.5 seconds
              
              // Apply opacity to all materials
              if (group) {
                group.traverse((child) => {
                  if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach(mat => {
                        mat.transparent = true
                        mat.opacity = char.fadeOutOpacity
                      })
                    } else {
                      child.material.transparent = true
                      child.material.opacity = char.fadeOutOpacity
                    }
                  }
                })
              }
              
              // Also fade nametag
              if (char.nameTag && char.nameTag.material) {
                char.nameTag.material.opacity = char.fadeOutOpacity
              }
            }

            // Don't remove characters - they fade out instead
            // Characters are kept in scene but invisible when faded out
            
            // Handle thrown characters FIRST (before formation mode check)
            if (char.isThrown && char.throwVelocity) {
              // Check if character hit screen edge (death condition)
              const distFromCenter = Math.sqrt(path.x ** 2 + path.z ** 2)
              const screenEdgeDistance = 500 // Screen edge distance (increased from 450)
              
              if (distFromCenter > screenEdgeDistance && !char.isDying) {
                // Character hit screen edge - start death sequence
                char.isDying = true
                char.deathTimer = 1.2 // Fade out over 1.2 seconds (increased from 0.3)
                char.isHit = true
                char.hitTimer = 1.2 // Red overlay duration (matches fade out)
                
                // Stop all movement immediately
                char.throwVelocity.x = 0
                char.throwVelocity.z = 0
                char.dropVelocity = 0
                
                // Apply red overlay
                const redTint = { r: 1.5, g: 0.5, b: 0.5 }
                player.traverse((obj) => {
                  if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                    materials.forEach((mat) => {
                      if (mat.color) {
                        mat.color.setRGB(
                          Math.min(mat.color.r * redTint.r, 1.0),
                          Math.min(mat.color.g * redTint.g, 1.0),
                          Math.min(mat.color.b * redTint.b, 1.0)
                        )
                        mat.needsUpdate = true
                      }
                    })
                  }
                })
                
                console.log(`💀 ${char.username} hit screen edge and died!`)
              } else if (!char.isDying) {
                // Normal flying behavior (not dying)
                // Check for collisions with other characters while flying
                // Use infinite vertical collision (like a pole) - only check horizontal distance
                const horizontalCollisionRadius = 8.0 // Horizontal collision radius
                const thrownCharPos = { 
                  x: path.x, 
                  z: path.z
                }
                
                allCharacters.forEach((otherChar) => {
                  // Skip self, already dying characters, and other thrown characters
                  if (otherChar === char || otherChar.isDying || otherChar.isThrown) return
                  
                  // Skip characters in formation mode
                  if (otherChar.formationMode) return
                  
                  // Safety check
                  if (!otherChar.path || !otherChar.group) return
                  
                  const otherPath = otherChar.path
                  
                  // Calculate horizontal distance only (infinite vertical collision - like a pole)
                  const dx = thrownCharPos.x - otherPath.x
                  const dz = thrownCharPos.z - otherPath.z
                  const horizontalDist = Math.sqrt(dx * dx + dz * dz)
                  
                  // Collision detected if within horizontal radius (ignoring vertical distance completely)
                  if (horizontalDist < horizontalCollisionRadius && !otherChar.isDying) {
                    // Hit character dies
                    otherChar.isDying = true
                    otherChar.deathTimer = 1.2 // Fade out over 1.2 seconds
                    otherChar.isHit = true
                    otherChar.hitTimer = 1.2
                    
                    // Stop the hit character's movement immediately
                    otherChar.path.targetX = otherPath.x
                    otherChar.path.targetZ = otherPath.z
                    otherChar.path.x = otherPath.x // Stop at current position
                    otherChar.path.z = otherPath.z
                    otherChar.path.changeTargetTime = Infinity // Prevent new path
                    otherChar.animationState = ANIMATION_STATES.IDLE
                    otherChar.group.position.x = otherPath.x // Stop movement immediately
                    otherChar.group.position.z = otherPath.z
                    
                    // Stop any running away or other movement states
                    otherChar.shouldRunAway = false
                    otherChar.runAwayTimer = undefined
                    otherChar.runAwayTarget = undefined
                    otherChar.runAwayFrom = undefined
                    otherChar.hitTargetPlayer = undefined
                    otherChar.isHitting = false
                    
                    // Apply red overlay to hit character
                    const redTint = { r: 1.5, g: 0.5, b: 0.5 }
                    otherChar.player.traverse((obj) => {
                      if (obj.material) {
                        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                        materials.forEach((mat) => {
                          if (mat.color) {
                            mat.color.setRGB(
                              Math.min(mat.color.r * redTint.r, 1.0),
                              Math.min(mat.color.g * redTint.g, 1.0),
                              Math.min(mat.color.b * redTint.b, 1.0)
                            )
                            mat.needsUpdate = true
                          }
                        })
                      }
                    })
                    
                    // Initialize smooth rotation for falling over
                    otherChar.fallRotation = {
                      targetX: Math.PI / 2, // Fall forward
                      targetZ: (Math.random() - 0.5) * 0.3, // Slight random tilt
                      currentX: otherChar.group.rotation.x || 0,
                      currentZ: otherChar.group.rotation.z || 0
                    }
                    
                    console.log(`💥 ${char.username} hit ${otherChar.username} while flying!`)
                  }
                })
                
                // Apply horizontal throw velocity
                const moveX = char.throwVelocity.x * deltaTime
                const moveZ = char.throwVelocity.z * deltaTime
                path.x += moveX
                path.z += moveZ
                group.position.x = path.x
                group.position.z = path.z
                
                // Apply vertical velocity (but keep height lower)
                group.position.y += char.dropVelocity * deltaTime
                
                // Clamp maximum height to keep characters lower
                const maxHeight = 8.0 // Maximum height while flying (reduced from unlimited)
                if (group.position.y > maxHeight) {
                  group.position.y = maxHeight
                  char.dropVelocity = 0 // Stop upward movement at max height
                }
                
                // Apply gravity
                char.dropVelocity -= 9.8 * deltaTime // Gravity (units per second squared)
                
                // Apply air resistance to horizontal velocity (gradual slowdown)
                char.throwVelocity.x *= (1 - deltaTime * 2) // Slow down over time
                char.throwVelocity.z *= (1 - deltaTime * 2)
                
                // Stop horizontal movement when velocity is very small
                if (Math.abs(char.throwVelocity.x) < 0.1) char.throwVelocity.x = 0
                if (Math.abs(char.throwVelocity.z) < 0.1) char.throwVelocity.z = 0
                
                // Keep rotation neutral while flying (no tilt)
                group.rotation.x = 0
                group.rotation.z = 0
                
                // Face the direction of movement while flying
                const horizontalSpeed = Math.sqrt(char.throwVelocity.x ** 2 + char.throwVelocity.z ** 2)
                if (horizontalSpeed > 0.1) {
                  const flyDirection = Math.atan2(char.throwVelocity.x, char.throwVelocity.z)
                  let currentRot = group.rotation.y
                  // Normalize angles
                  while (currentRot > Math.PI) currentRot -= Math.PI * 2
                  while (currentRot < -Math.PI) currentRot += Math.PI * 2
                  let targetRot = flyDirection
                  while (targetRot > Math.PI) targetRot -= Math.PI * 2
                  while (targetRot < -Math.PI) targetRot += Math.PI * 2
                  let diff = targetRot - currentRot
                  if (diff > Math.PI) diff -= Math.PI * 2
                  if (diff < -Math.PI) diff += Math.PI * 2
                  // Smooth rotation to face throw direction
                  const rotationSpeed = 0.3
                  group.rotation.y += diff * rotationSpeed
                }
                
                // Play flying animation while thrown
                char.animProgress += deltaTime * char.animSpeed
                try {
                  FlyingAnimation(player, char.animProgress)
                } catch (err) {
                  console.error('Animation error:', err)
                }
              }
              
              // Stop when character hits ground (only if not dying)
              if (!char.isDying && group.position.y <= 0) {
                group.position.y = 0
                char.isThrown = false
                char.isFloating = false
                char.throwVelocity = null
                char.dropVelocity = undefined
                char.animationState = ANIMATION_STATES.WALK // Return to walking
                // Reset all rotations to upright position
                group.rotation.x = 0
                group.rotation.z = 0
                char.throwRotation = { x: 0, z: 0 }
                // Reset player body rotation (from flying animation)
                if (player.rotation) {
                  player.rotation.x = 0
                  player.rotation.z = 0
                }
                // Reset head rotation
                if (player.skin && player.skin.head) {
                  player.skin.head.rotation.x = 0
                }
                // Reset arm rotations
                if (player.skin && player.skin.leftArm) {
                  player.skin.leftArm.rotation.z = 0
                }
                if (player.skin && player.skin.rightArm) {
                  player.skin.rightArm.rotation.z = 0
                }
                console.log(`🏁 ${char.username} landed after throw`)
              }
              
              // Skip rest of normal logic while thrown
              return
            }
            
            // Handle gentle drop (not thrown, but was floating)
            if (char.isFloating && char.dropVelocity !== undefined && !char.isThrown && char.dropVelocity < 0) {
              // Apply gentle downward velocity
              group.position.y += char.dropVelocity * deltaTime
              
              // Gentle gravity (much lighter than thrown gravity)
              char.dropVelocity -= 2.0 * deltaTime // Light gravity
              
              // Play idle animation while gently dropping
              char.animProgress += deltaTime * char.animSpeed
              try {
                IdleAnimation(player, char.animProgress)
              } catch (err) {
                console.error('Animation error:', err)
              }
              
              // Stop when character hits ground
              if (group.position.y <= 0) {
                group.position.y = 0
                char.isFloating = false
                char.dropVelocity = undefined
                char.animationState = ANIMATION_STATES.WALK // Return to walking
                console.log(`🏁 ${char.username} gently landed`)
              }
              
              // Skip rest of normal logic while gently dropping
              return
            }
            
            // Skip all other behaviors if in formation mode (already handled above)
            if (char.formationMode) {
              // Formation mode logic is handled above - skip rest of this iteration
              return
            }
            
            // Check if this character is being dragged (used in multiple places)
            const isBeingDragged = draggedCharRef.current === char && isDraggingRef.current
            
            // Update animation state timer
            if (!char.animationStateTimer) char.animationStateTimer = Math.random() * 10 + 5
            char.animationStateTimer -= deltaTime
            
            // Initialize wave arm if not exists
            if (char.waveArm === undefined) {
              char.waveArm = Math.random() > 0.5 ? 'left' : 'right'
            }
            
            // Very low chance to decide to hit another player (check every 5 seconds)
            // Skip if in formation mode
            if (!char.formationMode && !char.hitTargetPlayer && !char.isHitting && char.animationState !== ANIMATION_STATES.RUN) {
              if (!char.hitDecisionTimer) {
                char.hitDecisionTimer = 5.0 // Check every 5 seconds
              }
              char.hitDecisionTimer -= deltaTime
              if (char.hitDecisionTimer <= 0) {
                char.hitDecisionTimer = 5.0 // Reset timer
                // Low chance (0.8% per check = ~1.6% per minute) - slightly increased
                if (Math.random() < 0.008) {
                  // Find a nearby player to target
                  let closestPlayer = null
                  let closestDist = Infinity
                  allCharacters.forEach((otherChar, otherIndex) => {
                    if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                    if (otherChar.animationState === ANIMATION_STATES.RUN) return // Don't target running players
                    
                    const otherPath = otherChar.path
                    const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                    const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                    
                    const distX = path.x - otherX
                    const distZ = path.z - otherZ
                    const dist = Math.sqrt(distX * distX + distZ * distZ)
                    
                    // Only target players within reasonable range (50-200 units)
                    if (dist >= 50 && dist <= 200 && dist < closestDist) {
                      closestDist = dist
                      closestPlayer = otherChar
                    }
                  })
                  
                  if (closestPlayer) {
                    // Set this player as the target to hit
                    char.hitTargetPlayer = closestPlayer
                    // Set path target to walk towards them
                    const targetPath = closestPlayer.path
                    const targetX = targetPath.x !== undefined ? targetPath.x : closestPlayer.group.position.x
                    const targetZ = targetPath.z !== undefined ? targetPath.z : closestPlayer.group.position.z
                    path.targetX = targetX
                    path.targetZ = targetZ
                    path.changeTargetTime = 999 // Don't change target until we hit or give up
                  }
                }
              }
            }
            
            // If we have a hit target, walk towards them and check if we're close enough to hit
            if (char.hitTargetPlayer && !char.isHitting) {
              const targetPath = char.hitTargetPlayer.path
              const targetX = targetPath.x !== undefined ? targetPath.x : char.hitTargetPlayer.group.position.x
              const targetZ = targetPath.z !== undefined ? targetPath.z : char.hitTargetPlayer.group.position.z
              
              // Update path target to follow the player
              path.targetX = targetX
              path.targetZ = targetZ
              
              // Check distance to target
              const distX = path.x - targetX
              const distZ = path.z - targetZ
              const dist = Math.sqrt(distX * distX + distZ * distZ)
              
              // If VERY close (within 5 units) AND facing the target, hit them!
              // Check if we're facing the target (within 30 degrees for stricter requirement)
              const currentRot = group.rotation.y
              const targetRotation = Math.atan2(distX, distZ)
              let rotDiff = Math.abs(targetRotation - currentRot)
              // Normalize to -PI to PI range
              while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
              rotDiff = Math.abs(rotDiff)
              
              // Only hit if VERY close (within 4 units) AND facing the target (within 30 degrees = PI/6)
              // Make sure we're actually very close - stricter distance check
              if (dist < 4 && dist > 0.5 && rotDiff < Math.PI / 6) {
                // Trigger hit animation
                char.isHitting = true
                char.hitAnimationTimer = 0.5 // Hit animation duration
                
                // Apply hit to the target character
                const targetChar = char.hitTargetPlayer
                
                // Verify target is still valid and close
                if (targetChar && targetChar.path) {
                  targetChar.isBeingHit = true
                  targetChar.hitTimer = 0.6 // Red overlay duration (increased from 0.3)
                
                  // Apply red overlay to hit character
                  const redTint = { r: 1.5, g: 0.5, b: 0.5 }
                  targetChar.player.traverse((obj) => {
                    if (obj.material) {
                      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                      materials.forEach(mat => {
                        if (mat.color) {
                          mat.color.r *= redTint.r
                          mat.color.g *= redTint.g
                          mat.color.b *= redTint.b
                          mat.needsUpdate = true
                        }
                      })
                    }
                  })
                  
                  // Apply knockback to hit character (away from hitter) - increased intensity
                  const knockbackDirection = new Vector3(distX / dist, 0, distZ / dist)
                  const knockbackUp = 18 // Increased from 10
                  const knockbackBack = 15 // Increased from 8
                  
                  targetChar.knockbackVelocity = {
                    x: knockbackDirection.x * knockbackBack,
                    y: knockbackUp,
                    z: knockbackDirection.z * knockbackBack
                  }
                  targetChar.gravity = 0.5
                  targetChar.knockbackStartTime = Date.now() // Track when knockback started
                  targetChar.knockbackMinDuration = 0.8 // Minimum knockback duration in seconds
                  
                  // Set up run away for after knockback finishes (don't start running yet)
                  targetChar.runAwayTimer = 6.0 + Math.random() * 4.0 // Run for 6-10 seconds (longer duration)
                  // Run away from hitter, but bias slightly towards center (0, 0)
                  const runAwayX = targetX - knockbackDirection.x * 180 // Increased from 100 to 180 units
                  const runAwayZ = targetZ - knockbackDirection.z * 180 // Increased from 100 to 180 units
                  // Bias towards center: blend 90% away direction, 10% center direction
                  const centerBias = 0.1
                  targetChar.runAwayTarget = {
                    x: runAwayX * (1 - centerBias) + 0 * centerBias, // Slight bias towards center (x=0)
                    z: runAwayZ * (1 - centerBias) + 0 * centerBias  // Slight bias towards center (z=0)
                  }
                  targetChar.runAwayFrom = char // Remember who to run from
                  targetChar.shouldRunAway = true // Flag to start running after knockback finishes
                  // Don't set animation state to RUN yet - wait for knockback to finish
                  targetChar.wasHitByPlayer = true // Mark that this was a player-to-player hit
                  
                  // Clear hit target - we've hit them
                  char.hitTargetPlayer = null
                  path.changeTargetTime = 0 // Allow new target selection
                } else {
                  // Target invalid - clear hit target
                  char.hitTargetPlayer = null
                  path.changeTargetTime = 0
                }
              } else if (dist > 250) {
                // Target got too far away, give up
                char.hitTargetPlayer = null
                path.changeTargetTime = 0 // Allow new target selection
              }
            }
            
            // Handle hit animation timer (when character is hitting another)
            // Hit animation should play once, then return to walking
            if (char.isHitting && char.hitAnimationTimer !== undefined) {
              char.hitAnimationTimer -= deltaTime
              if (char.hitAnimationTimer <= 0) {
                // Hit animation complete - idle for a few seconds before pathing
                char.isHitting = false
                char.hitAnimationTimer = undefined
                char.animationState = ANIMATION_STATES.IDLE
                char.idleDuration = 2.0 + Math.random() * 2.0 // Idle for 2-4 seconds after hitting
                char.animProgress = 0 // Reset animation progress
              }
            }
            
            // Handle run away timer (when character is running away after being hit)
            if (char.runAwayTimer !== undefined && char.runAwayTimer > 0) {
              char.runAwayTimer -= deltaTime
              
              // Update run away target to keep running from the hitter
              // Only update if hitter is still valid and exists
              if (char.runAwayFrom && char.runAwayFrom.path && char.runAwayFrom.group) {
                const hitterX = char.runAwayFrom.path.x
                const hitterZ = char.runAwayFrom.path.z
                const runAwayDirX = path.x - hitterX
                const runAwayDirZ = path.z - hitterZ
                const runAwayDist = Math.sqrt(runAwayDirX * runAwayDirX + runAwayDirZ * runAwayDirZ)
                
                // Only continue running away if hitter is still reasonably close (within 300 units)
                // If hitter moved too far or was removed, stop running away
                if (runAwayDist > 0 && runAwayDist < 300) {
                  // Keep running away from the hitter, but bias slightly towards center
                  const pureRunAwayX = path.x + (runAwayDirX / runAwayDist) * 180 // Increased from 100 to 180 units
                  const pureRunAwayZ = path.z + (runAwayDirZ / runAwayDist) * 180 // Increased from 100 to 180 units
                  // Bias towards center: blend 90% away direction, 10% center direction
                  const centerBias = 0.1
                  char.runAwayTarget = {
                    x: pureRunAwayX * (1 - centerBias) + 0 * centerBias, // Slight bias towards center (x=0)
                    z: pureRunAwayZ * (1 - centerBias) + 0 * centerBias  // Slight bias towards center (z=0)
                  }
                } else {
                  // Hitter is too far away or invalid - stop running away
                  char.animationState = ANIMATION_STATES.WALK
                  char.runAwayTimer = undefined
                  char.runAwayTarget = null
                  char.runAwayFrom = null
                }
              } else {
                // Hitter reference is invalid - stop running away
                char.animationState = ANIMATION_STATES.WALK
                char.runAwayTimer = undefined
                char.runAwayTarget = null
                char.runAwayFrom = null
              }
              
              if (char.runAwayTimer <= 0) {
                // Stop running, return to walking
                char.animationState = ANIMATION_STATES.WALK
                char.runAwayTimer = undefined
                char.runAwayTarget = null
                char.runAwayFrom = null
              }
            }
            
            // Don't change animation state if being dragged (keep idle) or hitting
            if (!isBeingDragged && !char.isHitting) {
              // Wave state logic - only wave on spawn or when hit by user
              if (char.animationState === ANIMATION_STATES.WAVE) {
                // Currently waving - count down duration
                if (char.waveDuration !== undefined && char.waveDuration > 0) {
                  char.waveDuration -= deltaTime
                  if (char.waveDuration <= 0) {
                    // Wave finished, return to walking
                    char.animationState = ANIMATION_STATES.WALK
                    char.waveDuration = undefined
                  }
                } else if (char.waveDuration === undefined) {
                  // No duration set, return to walking
                  char.animationState = ANIMATION_STATES.WALK
                }
              } else if (char.animationState === ANIMATION_STATES.RUN) {
                // Running away - handled by runAwayTimer above
                // Don't change state here - only used when running away after being hit
              } else if (char.animationState === ANIMATION_STATES.IDLE) {
                // Idle state - handled by idleDuration above
                // Don't change state here
              } else {
                // Normal walking (only if not hitting and not running)
                if (char.animationState !== ANIMATION_STATES.RUN) {
                  char.animationState = ANIMATION_STATES.WALK
                }
              }
            }
            
            // Create a path that moves towards random targets, preferring less crowded areas
            // Each character walks towards a target, then picks a new one
            // Keep targets within screen bounds and ensure good distances
            const maxTargetDistance = 450 // Keep targets within screen bounds (increased to allow further paths)
            const minTargetDistance = 120 // Minimum distance from current position (ensures considerable movement)
            if (!path.changeTargetTime) {
              path.changeTargetTime = Math.random() * 5 + 4 // Change targets every 4-9 seconds (longer paths)
              
              // Try to find a less crowded area for the target, prioritizing areas with LEAST users
              const densityRadius = 120 // Increased radius to better detect crowded areas
              const candidates = []
              
              // Sample many potential targets across the entire screen area
              // Bias towards further distances to spread characters out
              for (let attempt = 0; attempt < 25; attempt++) {
                const angle = Math.random() * Math.PI * 2
                // Bias towards further distances: 60% chance to be in outer half, 40% in inner half
                const distanceBias = Math.random() < 0.6 ? 0.5 : 0.0
                const radius = (maxTargetDistance * 0.3) + Math.random() * (maxTargetDistance * (0.7 + distanceBias)) // Between 30% and 100% of max distance
                const candidateX = Math.cos(angle) * radius
                const candidateZ = Math.sin(angle) * radius
                
                // Ensure candidate is a good distance from current position
                const distToCandidate = Math.sqrt((candidateX - path.x) ** 2 + (candidateZ - path.z) ** 2)
                if (distToCandidate < minTargetDistance) continue
                
                // Calculate density at candidate location (including other characters' targets to avoid clustering)
                let candidateDensity = 0
                allCharacters.forEach((otherChar, otherIndex) => {
                  if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                  
                  const otherPath = otherChar.path
                  const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                  const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                  
                  // Check distance to other character's position
                  const distToOther = Math.sqrt((candidateX - otherX) ** 2 + (candidateZ - otherZ) ** 2)
                  if (distToOther < densityRadius && distToOther > 0) {
                    candidateDensity += (densityRadius - distToOther) / densityRadius
                  }
                  
                  // STRONGLY avoid other characters' targets - no two characters should path to the same area
                  if (otherPath.targetX !== undefined && otherPath.targetZ !== undefined) {
                    const distToTarget = Math.sqrt((candidateX - otherPath.targetX) ** 2 + (candidateZ - otherPath.targetZ) ** 2)
                    const targetAvoidRadius = 100 // Large radius to avoid other targets
                    if (distToTarget < targetAvoidRadius && distToTarget > 0) {
                      // Heavy penalty - make it very undesirable to path near other targets
                      const penalty = (targetAvoidRadius - distToTarget) / targetAvoidRadius
                      candidateDensity += penalty * 3.0 // Strong penalty (3x weight)
                    }
                  }
                })
                
                // Prefer not to path to bottom of screen (negative Z values) - add small penalty
                // Bottom of screen is typically negative Z in this coordinate system
                let bottomPenalty = 0
                if (candidateZ < 0) {
                  // Add penalty based on how far down (more negative = more penalty)
                  // Normalize: -maxDistance to 0 becomes 0 to 1 penalty
                  const normalizedBottom = Math.abs(candidateZ) / maxTargetDistance
                  bottomPenalty = normalizedBottom * 2.0 // Up to 200% density penalty for bottom area (much stronger bias)
                }
                
                // Add some randomness to prevent all characters choosing the exact same spot
                const randomNoise = Math.random() * 0.2 // Reduced randomness (0-20%) since we have strong target avoidance
                candidates.push({
                  x: candidateX,
                  z: candidateZ,
                  density: (candidateDensity + bottomPenalty) * (1 + randomNoise) // Add randomness to density score
                })
              }
              
              // Sort by density and pick from the top 20% LOWEST density (most empty areas)
              // This ensures characters path to the least crowded areas
              candidates.sort((a, b) => a.density - b.density)
              const topCandidates = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.2))) // Top 20% lowest density
              // Prefer candidates further from center AND further from current position if density is similar (within 10% of each other)
              const lowestDensity = topCandidates[0].density
              const densityThreshold = lowestDensity * 1.1
              const bestCandidates = topCandidates.filter(c => c.density <= densityThreshold)
              // Among best candidates, prefer those further from current position AND further from center
              bestCandidates.forEach(c => {
                // Calculate distance from current position for scoring
                const distFromCurrent = Math.sqrt((c.x - path.x) ** 2 + (c.z - path.z) ** 2)
                const distFromCenter = Math.sqrt(c.x ** 2 + c.z ** 2)
                // Combined score: prioritize distance from current position (70%) and distance from center (30%)
                c.combinedDistance = distFromCurrent * 0.7 + distFromCenter * 0.3
              })
              bestCandidates.sort((a, b) => b.combinedDistance - a.combinedDistance) // Furthest combined distance first
              const selectedCandidate = bestCandidates[0] || topCandidates[0] // Pick the furthest among best, or fallback to first
              
              if (selectedCandidate) {
                path.targetX = selectedCandidate.x
                path.targetZ = selectedCandidate.z
              } else {
                // Fallback to random target (further from center)
                const angle = Math.random() * Math.PI * 2
                const radius = (maxTargetDistance * 0.5) + Math.random() * (maxTargetDistance * 0.5) // Outer 50% of range
                path.targetX = Math.cos(angle) * radius
                path.targetZ = Math.sin(angle) * radius
              }
            }
            
            // Move towards target - calculate distance first
            let dx = path.targetX - path.x
            let dz = path.targetZ - path.z
            let distance = Math.sqrt(dx * dx + dz * dz)
            
            // Idle behavior - idle when reaching target, then path somewhere else
            // Check if character has reached their target
            const reachedTarget = distance < 10 // Consider reached when within 10 units
            
            // Handle idle state - characters stand still when idling
            if (char.animationState === ANIMATION_STATES.IDLE) {
              if (char.idleDuration !== undefined) {
                char.idleDuration -= deltaTime
                if (char.idleDuration <= 0) {
                  // Idle finished, return to walking and pick new target
                  char.animationState = ANIMATION_STATES.WALK
                  char.idleDuration = undefined
                  path.changeTargetTime = 0 // Force new target selection
                }
              } else {
                // No duration set, return to walking
                char.animationState = ANIMATION_STATES.WALK
                path.changeTargetTime = 0 // Force new target selection
              }
            } else if (reachedTarget && char.animationState === ANIMATION_STATES.WALK && !char.hitTargetPlayer && !char.waypoint) {
              // Reached target - enter idle animation
              char.animationState = ANIMATION_STATES.IDLE
              char.idleDuration = 2.0 + Math.random() * 3.0 // Idle for 2-5 seconds (random)
            }
            
            // Track progress to detect if stuck
            const distToTarget = distance
            if (!char.lastDistanceToTarget) {
              char.lastDistanceToTarget = distToTarget
              char.stuckTimer = 0
            }
            
            // Check if making progress towards target
            const progressMade = char.lastDistanceToTarget - distToTarget
            if (progressMade < 0.5 && distToTarget > 10) { // Not making progress and still far from target
              char.stuckTimer += deltaTime
            } else {
              char.stuckTimer = 0 // Reset if making progress
              char.lastDistanceToTarget = distToTarget
            }
            
            // Check if path is blocked by obstacles
            char.pathBlockedCheckTimer = (char.pathBlockedCheckTimer || 0) + deltaTime
            let isPathBlocked = false
            if (char.pathBlockedCheckTimer > 0.5 && distToTarget > 15) { // Check every 0.5 seconds
              char.pathBlockedCheckTimer = 0
              
              // Sample points along the path to target to check for obstacles
              const pathCheckPoints = 5
              const stepSize = distToTarget / pathCheckPoints
              const dirX = dx / distToTarget
              const dirZ = dz / distToTarget
              
              let blockedCount = 0
              for (let i = 1; i <= pathCheckPoints; i++) {
                const checkX = path.x + dirX * stepSize * i
                const checkZ = path.z + dirZ * stepSize * i
                const checkRadius = 40 // Check radius for obstacles
                
                // Check if any character is blocking this point
                allCharacters.forEach((otherChar, otherIndex) => {
                  if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                  
                  const otherPath = otherChar.path
                  const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                  const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                  
                  const distToCheck = Math.sqrt((checkX - otherX) ** 2 + (checkZ - otherZ) ** 2)
                  if (distToCheck < checkRadius) {
                    blockedCount++
                  }
                })
              }
              
              // If more than 30% of path is blocked, consider it blocked
              isPathBlocked = blockedCount > pathCheckPoints * 0.3
            }
            
            // If stuck or path blocked, find alternative path
            if ((char.stuckTimer > char.stuckThreshold || isPathBlocked) && !char.hitTargetPlayer && char.animationState !== ANIMATION_STATES.IDLE) {
              // Try to find a path around obstacles using steering
              const steeringRadius = 80 // How far to look for alternative paths
              const steeringAngles = []
              
              // Sample angles around the target direction
              const targetAngle = Math.atan2(dx, dz)
              for (let i = -3; i <= 3; i++) {
                steeringAngles.push(targetAngle + (i * Math.PI / 6)) // ±90 degrees in 30-degree steps
              }
              
              let bestSteerAngle = null
              let bestSteerScore = Infinity
              
              steeringAngles.forEach(angle => {
                const steerX = path.x + Math.cos(angle) * steeringRadius
                const steerZ = path.z + Math.sin(angle) * steeringRadius
                
                // Check if this steering direction avoids obstacles
                let obstacleCount = 0
                let totalDistToTarget = 0
                
                allCharacters.forEach((otherChar, otherIndex) => {
                  if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                  
                  const otherPath = otherChar.path
                  const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                  const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                  
                  const distToOther = Math.sqrt((steerX - otherX) ** 2 + (steerZ - otherZ) ** 2)
                  if (distToOther < 50) {
                    obstacleCount++
                  }
                  
                  // Also check distance to other targets
                  if (otherPath.targetX !== undefined && otherPath.targetZ !== undefined) {
                    const distToOtherTarget = Math.sqrt((steerX - otherPath.targetX) ** 2 + (steerZ - otherPath.targetZ) ** 2)
                    if (distToOtherTarget < 80) {
                      obstacleCount += 0.5
                    }
                  }
                })
                
                // Calculate distance from steer point to target
                const distFromSteerToTarget = Math.sqrt((steerX - path.targetX) ** 2 + (steerZ - path.targetZ) ** 2)
                
                // Score: lower is better (fewer obstacles, closer to target)
                const score = obstacleCount * 10 + distFromSteerToTarget * 0.1
                
                if (score < bestSteerScore) {
                  bestSteerScore = score
                  bestSteerAngle = angle
                }
              })
              
              // If we found a good steering angle, set intermediate waypoint
              if (bestSteerAngle !== null && bestSteerScore < 50) {
                const waypointX = path.x + Math.cos(bestSteerAngle) * steeringRadius
                const waypointZ = path.z + Math.sin(bestSteerAngle) * steeringRadius
                
                // Clamp to screen bounds
                const waypointDist = Math.sqrt(waypointX ** 2 + waypointZ ** 2)
                if (waypointDist < maxTargetDistance) {
                  // Set intermediate waypoint (will path to this first, then continue to target)
                  if (!char.waypoint) {
                    char.waypoint = { x: waypointX, z: waypointZ }
                  } else {
                    // Update waypoint if we have a better one
                    char.waypoint.x = waypointX
                    char.waypoint.z = waypointZ
                  }
                  
                  // Reset stuck timer
                  char.stuckTimer = 0
                  char.lastDistanceToTarget = distToTarget
                }
              } else {
                // If no good steering found, pick completely new target
                path.changeTargetTime = 0 // Force new target selection
                char.stuckTimer = 0
                char.lastDistanceToTarget = undefined
              }
            }
            
            // Use waypoint if available (pathfinding around obstacles)
            if (char.waypoint) {
              const waypointDx = char.waypoint.x - path.x
              const waypointDz = char.waypoint.z - path.z
              const waypointDist = Math.sqrt(waypointDx * waypointDx + waypointDz * waypointDz)
              
              if (waypointDist < 20) {
                // Reached waypoint, clear it and continue to target
                char.waypoint = null
              } else {
                // Path to waypoint instead of direct target
                dx = waypointDx
                dz = waypointDz
                distance = waypointDist
              }
            }
            
            // Check if it's time to change target
            // Don't change target if we're walking towards a hit target, idling, or in formation mode
            // Don't change target while idling - wait for idle to finish
            if (!char.hitTargetPlayer && char.animationState !== ANIMATION_STATES.IDLE && !char.formationMode) {
              path.changeTargetTime -= deltaTime
            }
            // Only change target if not idling and not in formation mode (idle will trigger new target when it finishes)
            if ((path.changeTargetTime <= 0 || distance < 5) && !char.hitTargetPlayer && char.animationState !== ANIMATION_STATES.IDLE && !char.formationMode) {
              // Try to find a less crowded area for the new target, with randomness to prevent clustering
              // Prioritize areas with the LEAST users surrounding them
              const densityRadius = 120 // Increased radius to better detect crowded areas
              const candidates = []
              
              // Sample many potential targets across the entire screen area
              // Bias towards further distances to spread characters out
              for (let attempt = 0; attempt < 25; attempt++) {
                const angle = Math.random() * Math.PI * 2
                // Bias towards further distances: 60% chance to be in outer half, 40% in inner half
                const distanceBias = Math.random() < 0.6 ? 0.5 : 0.0
                const radius = (maxTargetDistance * 0.3) + Math.random() * (maxTargetDistance * (0.7 + distanceBias)) // Between 30% and 100% of max distance
                const candidateX = Math.cos(angle) * radius
                const candidateZ = Math.sin(angle) * radius
                
                // Ensure candidate is a good distance from current position
                const distToCandidate = Math.sqrt((candidateX - path.x) ** 2 + (candidateZ - path.z) ** 2)
                if (distToCandidate < minTargetDistance) continue
                
                // Calculate density at candidate location (including other characters' targets to avoid clustering)
                let candidateDensity = 0
                allCharacters.forEach((otherChar, otherIndex) => {
                  if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                  
                  const otherPath = otherChar.path
                  const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                  const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                  
                  // Check distance to other character's position
                  const distToOther = Math.sqrt((candidateX - otherX) ** 2 + (candidateZ - otherZ) ** 2)
                  if (distToOther < densityRadius && distToOther > 0) {
                    candidateDensity += (densityRadius - distToOther) / densityRadius
                  }
                  
                  // STRONGLY avoid other characters' targets - no two characters should path to the same area
                  if (otherPath.targetX !== undefined && otherPath.targetZ !== undefined) {
                    const distToTarget = Math.sqrt((candidateX - otherPath.targetX) ** 2 + (candidateZ - otherPath.targetZ) ** 2)
                    const targetAvoidRadius = 100 // Large radius to avoid other targets
                    if (distToTarget < targetAvoidRadius && distToTarget > 0) {
                      // Heavy penalty - make it very undesirable to path near other targets
                      const penalty = (targetAvoidRadius - distToTarget) / targetAvoidRadius
                      candidateDensity += penalty * 3.0 // Strong penalty (3x weight)
                    }
                  }
                })
                
                // Prefer not to path to bottom of screen (negative Z values) - add small penalty
                // Bottom of screen is typically negative Z in this coordinate system
                let bottomPenalty = 0
                if (candidateZ < 0) {
                  // Add penalty based on how far down (more negative = more penalty)
                  // Normalize: -maxDistance to 0 becomes 0 to 1 penalty
                  const normalizedBottom = Math.abs(candidateZ) / maxTargetDistance
                  bottomPenalty = normalizedBottom * 2.0 // Up to 200% density penalty for bottom area (much stronger bias)
                }
                
                // Add randomness to prevent all characters choosing the exact same spot
                const randomNoise = Math.random() * 0.2 // Reduced randomness (0-20%) since we have strong target avoidance
                candidates.push({
                  x: candidateX,
                  z: candidateZ,
                  density: (candidateDensity + bottomPenalty) * (1 + randomNoise) // Add randomness to density score
                })
              }
              
              // Sort by density and pick from the top 20% LOWEST density (most empty areas)
              // This ensures characters path to the least crowded areas
              candidates.sort((a, b) => a.density - b.density)
              const topCandidates = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.2))) // Top 20% lowest density
              // Prefer candidates further from current position AND further from center if density is similar (within 10% of each other)
              const lowestDensity = topCandidates[0].density
              const densityThreshold = lowestDensity * 1.1
              const bestCandidates = topCandidates.filter(c => c.density <= densityThreshold)
              // Among best candidates, prefer those further from current position AND further from center
              bestCandidates.forEach(c => {
                // Calculate distance from current position for scoring
                const distFromCurrent = Math.sqrt((c.x - path.x) ** 2 + (c.z - path.z) ** 2)
                const distFromCenter = Math.sqrt(c.x ** 2 + c.z ** 2)
                // Combined score: prioritize distance from current position (70%) and distance from center (30%)
                c.combinedDistance = distFromCurrent * 0.7 + distFromCenter * 0.3
              })
              bestCandidates.sort((a, b) => b.combinedDistance - a.combinedDistance) // Furthest combined distance first
              const selectedCandidate = bestCandidates[0] || topCandidates[0] // Pick the furthest among best, or fallback to first
              
              if (selectedCandidate) {
                path.targetX = selectedCandidate.x
                path.targetZ = selectedCandidate.z
              } else {
                // Fallback: pick one relative to current position (considerable distance away)
                const angle = Math.random() * Math.PI * 2
                path.targetX = path.x + Math.cos(angle) * minTargetDistance
                path.targetZ = path.z + Math.sin(angle) * minTargetDistance
                // Clamp to screen bounds
                const distFromCenter = Math.sqrt(path.targetX ** 2 + path.targetZ ** 2)
                if (distFromCenter > maxTargetDistance) {
                  const scale = maxTargetDistance / distFromCenter
                  path.targetX *= scale
                  path.targetZ *= scale
                }
              }
              
              path.changeTargetTime = Math.random() * 5 + 4 // Change targets every 4-9 seconds (longer paths)
              // Recalculate dx, dz, and distance after changing target
              dx = path.targetX - path.x
              dz = path.targetZ - path.z
              distance = Math.sqrt(dx * dx + dz * dz)
            }
            
            // Density-based pathing - prefer areas with fewer people
            // Skip collision avoidance entirely when targeting a player to hit (path directly)
            let avoidX = 0
            let avoidZ = 0
            
            // Screen bounds - keep characters visible (camera is 500 units away, keep within ~450 units from center)
            const maxDistanceFromCenter = 450
            const centerDist = Math.sqrt(path.x ** 2 + path.z ** 2)
            if (centerDist > maxDistanceFromCenter) {
              // Gently push back towards center (only when at edge)
              const pushStrength = (centerDist - maxDistanceFromCenter) / 50
              avoidX -= (path.x / centerDist) * pushStrength * 1.0
              avoidZ -= (path.z / centerDist) * pushStrength * 1.0
            }
            
            // Only do collision avoidance and density checking if NOT targeting a player to hit
            if (!char.hitTargetPlayer) {
              const avoidanceRadius = 30 // Only avoid when very close
              const minDistance = 25 // Minimum distance before forcing target change
              
              // Calculate local density (how many characters are nearby)
              const densityRadius = 80 // Check density in 80 unit radius
              let localDensity = 0
              
              allCharacters.forEach((otherChar, otherIndex) => {
                if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                
                const otherPath = otherChar.path
                const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                
                const distX = path.x - otherX
                const distZ = path.z - otherZ
                const dist = Math.sqrt(distX * distX + distZ * distZ)
                
                // Count nearby characters for density calculation
                if (dist < densityRadius && dist > 0) {
                  localDensity += (densityRadius - dist) / densityRadius // Weight by distance
                }
                
                // Only avoid when very close - prevent stacking but don't cause jiggling
                if (dist < avoidanceRadius && dist > 0) {
                  const avoidStrength = (avoidanceRadius - dist) / avoidanceRadius
                  // Very minimal avoidance force - just enough to prevent stacking
                  avoidX += (distX / dist) * avoidStrength * 0.5
                  avoidZ += (distZ / dist) * avoidStrength * 0.5
                  
                  // Only override target if extremely close (prevent actual collision)
                  // BUT: Don't override if we're very close to our goal (< 15 units) - prioritize reaching destination
                  if (dist < minDistance && char.animationState !== ANIMATION_STATES.RUN && distance > 15) {
                    // Calculate escape direction (away from other character)
                    // Make sure escape target is a good distance away
                    const escapeDist = 80 // Move 80 units away (good distance)
                    const newTargetX = path.x + (distX / dist) * escapeDist
                    const newTargetZ = path.z + (distZ / dist) * escapeDist
                    
                    // Check if new target is within screen bounds
                    const newTargetDist = Math.sqrt(newTargetX ** 2 + newTargetZ ** 2)
                    if (newTargetDist < maxTargetDistance) {
                      // Only change target if it's far enough from current position
                      const distToNewTarget = Math.sqrt((newTargetX - path.x) ** 2 + (newTargetZ - path.z) ** 2)
                      if (distToNewTarget >= 50) { // Ensure we're moving a good distance
                        path.targetX = newTargetX
                        path.targetZ = newTargetZ
                        path.changeTargetTime = 0.3 // Quick reaction to avoid collision
                        
                        // Also update dx/dz to reflect new target
                        dx = path.targetX - path.x
                        dz = path.targetZ - path.z
                        distance = Math.sqrt(dx * dx + dz * dz)
                      }
                    }
                  }
                }
              })
              
              // If in a crowded area, prefer moving towards less crowded areas
              // But add randomness and avoid other characters' targets to prevent clustering
              if (localDensity > 2.5 && path.changeTargetTime < 1.5) { // Only when very crowded and close to changing target
                const sampleRadius = 100 // Sample density at this distance
                const sampleAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4] // 8 directions
                const candidates = []
                
                sampleAngles.forEach(angle => {
                  const sampleX = path.x + Math.cos(angle) * sampleRadius
                  const sampleZ = path.z + Math.sin(angle) * sampleRadius
                  
                  // Check if sample point is within bounds
                  const sampleDistFromCenter = Math.sqrt(sampleX ** 2 + sampleZ ** 2)
                  if (sampleDistFromCenter < maxTargetDistance) {
                    // Calculate density at this sample point (including other targets)
                    let sampleDensity = 0
                    allCharacters.forEach((otherChar, otherIndex) => {
                      if (otherIndex === index || !otherChar || !otherChar.path || !otherChar.group) return
                      
                      const otherPath = otherChar.path
                      const otherX = otherPath.x !== undefined ? otherPath.x : otherChar.group.position.x
                      const otherZ = otherPath.z !== undefined ? otherPath.z : otherChar.group.position.z
                      
                      // Check distance to other character
                      const distToOther = Math.sqrt((sampleX - otherX) ** 2 + (sampleZ - otherZ) ** 2)
                      if (distToOther < densityRadius && distToOther > 0) {
                        sampleDensity += (densityRadius - distToOther) / densityRadius
                      }
                      
                      // STRONGLY avoid other characters' targets - no two characters should path to the same area
                      if (otherPath.targetX !== undefined && otherPath.targetZ !== undefined) {
                        const distToTarget = Math.sqrt((sampleX - otherPath.targetX) ** 2 + (sampleZ - otherPath.targetZ) ** 2)
                        const targetAvoidRadius = 100 // Large radius to avoid other targets
                        if (distToTarget < targetAvoidRadius && distToTarget > 0) {
                          // Heavy penalty - make it very undesirable to path near other targets
                          const penalty = (targetAvoidRadius - distToTarget) / targetAvoidRadius
                          sampleDensity += penalty * 3.0 // Strong penalty (3x weight)
                        }
                      }
                    })
                    
                    // Add randomness
                    const randomNoise = Math.random() * 0.2
                    candidates.push({
                      angle: angle,
                      density: sampleDensity * (1 + randomNoise)
                    })
                  }
                })
                
                // Sort by density and pick from top 40% with randomness
                if (candidates.length > 0) {
                  candidates.sort((a, b) => a.density - b.density)
                  const topCandidates = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.4)))
                  const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)]
                  
                  if (selected && selected.density < localDensity * 0.8) {
                    const newTargetX = path.x + Math.cos(selected.angle) * sampleRadius
                    const newTargetZ = path.z + Math.sin(selected.angle) * sampleRadius
                    
                    // Ensure new target is within bounds and far enough
                    const newTargetDist = Math.sqrt(newTargetX ** 2 + newTargetZ ** 2)
                    if (newTargetDist < maxTargetDistance) {
                      const distToNewTarget = Math.sqrt((newTargetX - path.x) ** 2 + (newTargetZ - path.z) ** 2)
                      if (distToNewTarget >= 50) {
                        path.targetX = newTargetX
                        path.targetZ = newTargetZ
                        path.changeTargetTime = 0.5 // Quick adjustment towards less crowded area
                        
                        // Also update dx/dz to reflect new target
                        dx = path.targetX - path.x
                        dz = path.targetZ - path.z
                        distance = Math.sqrt(dx * dx + dz * dz)
                      }
                    }
                  }
                }
              }
            }
            
            // Increase speed by 10% when seeking a hit target
            // Reduce walk speed by 15% unless running or seeking a target
            let moveSpeed = baseMoveSpeed
            if (char.hitTargetPlayer) {
              moveSpeed = baseMoveSpeed * 1.1 // 10% faster when seeking target
            } else if (char.animationState !== ANIMATION_STATES.RUN) {
              moveSpeed = baseMoveSpeed * 0.85 // 15% slower for normal walking
            } else {
              moveSpeed = baseMoveSpeed // Keep normal speed when running
            }
            
            // Update character position in 3D space
            // Move in a path that goes away from camera
            path.angle += moveSpeed * 0.15
            
            // Normal movement towards target - minimal avoidance influence (just enough to prevent stacking)
            const moveX = (dx / Math.max(distance, 0.1)) * moveSpeed + avoidX * 0.2
            const moveZ = (dz / Math.max(distance, 0.1)) * moveSpeed + avoidZ * 0.2
            
            // Calculate movement direction for rotation BEFORE moving
            // Use the intended movement direction, not the actual movement
            const totalMoveX = moveX
            const totalMoveZ = moveZ
            const moveDistance = Math.sqrt(totalMoveX * totalMoveX + totalMoveZ * totalMoveZ)
            
            // Rotate to face movement direction or camera (if waving or idle/dragged)
            // Priority: Hit target > Wave/Idle > Run away > Normal movement
            if (char.hitTargetPlayer && !char.isHitting) {
              // Face the hit target when seeking them
              const targetPath = char.hitTargetPlayer.path
              const targetX = targetPath.x !== undefined ? targetPath.x : char.hitTargetPlayer.group.position.x
              const targetZ = targetPath.z !== undefined ? targetPath.z : char.hitTargetPlayer.group.position.z
              
              const targetDirX = targetX - path.x
              const targetDirZ = targetZ - path.z
              const targetDist = Math.sqrt(targetDirX * targetDirX + targetDirZ * targetDirZ)
              
              if (targetDist > 0.001) {
                const targetRotation = Math.atan2(targetDirX, targetDirZ)
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
                
                // Fast rotation to face target (faster when close)
                const rotationSpeed = targetDist < 20 ? 0.5 : 0.3 // Faster rotation when close
                group.rotation.y += diff * rotationSpeed
              }
            } else if (char.animationState === ANIMATION_STATES.WAVE || char.animationState === ANIMATION_STATES.IDLE) {
              // Face camera when waving or idle (being dragged) - camera is at 45 degree angle looking down
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
            } else if (char.animationState === ANIMATION_STATES.RUN && char.runAwayTarget) {
              // When running away, face the direction of movement
              const runAwayDx = char.runAwayTarget.x - path.x
              const runAwayDz = char.runAwayTarget.z - path.z
              const runAwayDist = Math.sqrt(runAwayDx * runAwayDx + runAwayDz * runAwayDz)
              
              if (runAwayDist > 0.001) {
                const targetRotation = Math.atan2(runAwayDx, runAwayDz)
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
                
                // Fast rotation when running away
                const rotationSpeed = 0.3
                group.rotation.y += diff * rotationSpeed
              }
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
            
            // Handle normal drop physics (when released from drag without throw)
            if (!char.isFloating && char.dropVelocity !== undefined && group.position.y > 0) {
              // Normal drop (not thrown)
              // Apply drop velocity
              group.position.y += char.dropVelocity * deltaTime
              
              // Apply gravity
              char.dropVelocity -= 0.5 // Gravity
              
              // Stop dropping when character hits ground
              if (group.position.y <= 0) {
                group.position.y = 0
                char.dropVelocity = undefined
              }
            }
            
            // Handle hit timer and red overlay removal (for character-to-character hits)
            if (char.isBeingHit && char.hitTimer !== undefined) {
              char.hitTimer -= deltaTime
              if (char.hitTimer <= 0) {
                // Remove red overlay
                char.player.traverse((obj) => {
                  if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                    materials.forEach(mat => {
                      if (mat.color) {
                        // Reset to original color (divide by the tint we applied)
                        mat.color.r /= 1.5
                        mat.color.g /= 0.5
                        mat.color.b /= 0.5
                        mat.needsUpdate = true
                      }
                    })
                  }
                })
                char.isBeingHit = false
                char.hitTimer = undefined
                
                // Start running away immediately after red overlay finishes
                if (char.shouldRunAway && char.runAwayTimer !== undefined) {
                  char.animationState = ANIMATION_STATES.RUN
                  char.shouldRunAway = false // Clear flag
                }
              }
            }
            
            // Handle knockback physics
            if (char.knockbackVelocity) {
              // Check minimum duration - ensure knockback lasts at least a certain time
              const knockbackElapsed = char.knockbackStartTime ? (Date.now() - char.knockbackStartTime) / 1000 : Infinity
              const minDuration = char.knockbackMinDuration || 0
              
              // Apply knockback velocity
              path.x += char.knockbackVelocity.x * deltaTime
              path.z += char.knockbackVelocity.z * deltaTime
              group.position.y += char.knockbackVelocity.y * deltaTime
              
              // Apply gravity
              char.knockbackVelocity.y -= char.gravity || 0.5
              
              // Stop knockback when character hits ground AND minimum duration has passed
              if (group.position.y <= 0 && knockbackElapsed >= minDuration) {
                group.position.y = 0
                char.knockbackVelocity = null
                char.knockbackStartTime = undefined
                char.knockbackMinDuration = undefined
                
                // If running away, continue running (don't wave or change state)
                if (char.animationState === ANIMATION_STATES.RUN) {
                  // Already running away - continue running
                  char.wasHitByPlayer = false // Clear flag
                } else if (!char.wasHitByPlayer) {
                  // Only wave if this was NOT a player-to-player hit (i.e., user clicked them)
                  char.animationState = ANIMATION_STATES.WAVE
                  char.waveDuration = 4.0 + Math.random() * 2.0 // Wave for 4-6 seconds
                  char.waveArm = Math.random() > 0.5 ? 'left' : 'right' // Randomly choose arm
                  char.animProgress = 0 // Reset animation progress for wave
                } else {
                  // Was hit by player but not running away yet (will start when red overlay finishes)
                  // Don't change state here - run-away will start when red overlay finishes
                  char.wasHitByPlayer = false // Clear flag
                }
              } else if (group.position.y <= 0) {
                // Hit ground but minimum duration not met - keep on ground but continue knockback timer
                group.position.y = 0
                // Still apply horizontal knockback
                path.x += char.knockbackVelocity.x * deltaTime
                path.z += char.knockbackVelocity.z * deltaTime
              }
            }
            
            // Update position (only if not waving, not being knocked back, not being dragged, and not idling)
            let newX = path.x
            let newZ = path.z
            // isBeingDragged is already declared above in the animation state logic
            
            // Handle running away movement (faster than normal walking)
            if (char.animationState === ANIMATION_STATES.RUN && char.runAwayTarget && !char.knockbackVelocity) {
              // Move towards run away target at faster speed
              const runAwayDx = char.runAwayTarget.x - path.x
              const runAwayDz = char.runAwayTarget.z - path.z
              const runAwayDist = Math.sqrt(runAwayDx * runAwayDx + runAwayDz * runAwayDz)
              
              if (runAwayDist > 0.1) {
                const runSpeed = baseMoveSpeed * 2.5 // Run 2.5x faster than walking
                const runMoveX = (runAwayDx / runAwayDist) * runSpeed
                const runMoveZ = (runAwayDz / runAwayDist) * runSpeed
                newX = path.x + runMoveX
                newZ = path.z + runMoveZ
              } else {
                // Reached target, continue normal movement
                const forwardDistance = path.z + moveZ
                const sideDistance = path.x + moveX
                newX = sideDistance
                newZ = forwardDistance
              }
            } else if (char.animationState === ANIMATION_STATES.IDLE) {
              // Stand still when idling - don't move
              newX = path.x
              newZ = path.z
            } else if (char.animationState !== ANIMATION_STATES.WAVE && !char.knockbackVelocity && !isBeingDragged) {
              // Only move when not waving, not being knocked back, not being dragged, and not idling
              const forwardDistance = path.z + moveZ
              const sideDistance = path.x + moveX
              newX = sideDistance
              newZ = forwardDistance
            } else if (char.knockbackVelocity) {
              // Use knockback position
              newX = path.x
              newZ = path.z
            } else if (isBeingDragged) {
              // Use dragged position (already set in handleDragMove)
              newX = path.x
              newZ = path.z
            }
            
            // Smoother interpolation for position - faster movement
            const lerpFactor = 0.35 // Increased from 0.25 for faster, more responsive movement
            group.position.x += (newX - group.position.x) * lerpFactor
            group.position.z += (newZ - group.position.z) * lerpFactor
            
            // Update path reference
            path.x = group.position.x
            path.z = group.position.z
            
            // Handle hit timer and red overlay
            if (char.isHit && char.hitTimer !== undefined) {
              char.hitTimer -= deltaTime
              if (char.hitTimer <= 0) {
                // Remove red overlay
                char.player.traverse((obj) => {
                  if (obj.material) {
                    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
                    materials.forEach(mat => {
                      if (mat.color) {
                        // Reset to original color (divide by the tint we applied)
                        mat.color.r /= 1.5
                        mat.color.g /= 0.5
                        mat.color.b /= 0.5
                        mat.needsUpdate = true
                      }
                    })
                  }
                })
                char.isHit = false
                char.hitTimer = undefined
              }
            }
            
            // Apply animation based on state
            if (player) {
              if (!char.animProgress) char.animProgress = 0
              if (!char.animSpeed) char.animSpeed = 0.87285
              
              char.animProgress += deltaTime * char.animSpeed // Accumulate progress with deltaTime
              
              // Apply animation based on state
              try {
                // Hit animation takes priority - plays once when hitting, then returns to walking
                if (char.isHitting && char.hitAnimationTimer !== undefined) {
                  HitAnimation(player, char.animProgress)
                } else if (char.animationState === ANIMATION_STATES.WAVE) {
                  WaveAnimation(player, char.animProgress, char.waveArm || 'left')
                } else if (char.animationState === ANIMATION_STATES.IDLE) {
                  IdleAnimation(player, char.animProgress)
                } else if (char.animationState === ANIMATION_STATES.RUN) {
                  // Run animation only used when running away after being hit
                  RunningAnimation(player, char.animProgress)
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
      const canvas = canvasRef.current
      if (canvas) {
        if (handleClickRef.current) {
          canvas.removeEventListener('click', handleClickRef.current)
        }
        if (handleMouseMoveRef.current) {
          canvas.removeEventListener('mousemove', handleMouseMoveRef.current)
        }
        // Remove drag handlers
        if (handleMouseDownRef.current) {
          canvas.removeEventListener('mousedown', handleMouseDownRef.current)
          canvas.removeEventListener('touchstart', handleMouseDownRef.current)
        }
        if (handleDragMoveRef.current) {
          canvas.removeEventListener('mousemove', handleDragMoveRef.current)
          canvas.removeEventListener('touchmove', handleDragMoveRef.current)
        }
        if (handleMouseUpRef.current) {
          canvas.removeEventListener('mouseup', handleMouseUpRef.current)
          canvas.removeEventListener('touchend', handleMouseUpRef.current)
        }
        // Remove hover effect from any hovered character
        if (hoveredCharRef.current && removeHoverEffectRef.current) {
          removeHoverEffectRef.current(hoveredCharRef.current)
        }
        canvas.style.cursor = 'default'
      }
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


  const handleClusterSelect = (clusterIndex) => {
    if (selectedCluster === clusterIndex) {
      // Deselect - return to normal mode
      console.log(`🔄 Formation Mode Deactivated - returning to normal movement`)
      setSelectedCluster(null)
      setFormationMode(false)
      // Clear formation mode flags and fade back in
      const characters = charactersRef.current || []
      characters.forEach(char => {
        char.formationMode = false
        char.shouldDespawn = false
        if (char.path && char.path.changeTargetTime === 999999) {
          char.path.changeTargetTime = Math.random() * 5 + 4 // Reset to normal
        }
        
        // Reset animation state - clear RUN state and return to WALK
        if (char.animationState === ANIMATION_STATES.RUN || char.animationState === ANIMATION_STATES.WAVE) {
          char.animationState = ANIMATION_STATES.WALK
          char.animProgress = 0
        }
        char.reachedFormationPosition = false
        char.waveDuration = undefined
        
        // Fade back in if faded out
        if (char.isFadedOut) {
          char.isFadedOut = false
          char.fadeOutOpacity = 0 // Start from 0 for fade in (will fade in during animation loop)
        }
      })
    } else {
      // Select cluster - enter formation mode
      console.log(`🎯 Selecting cluster ${clusterIndex + 1}`)
      console.log(`   Current clusters state:`, clusters)
      console.log(`   Setting selectedCluster to:`, clusterIndex)
      console.log(`   Setting formationMode to: true`)
      setSelectedCluster(clusterIndex)
      setFormationMode(true)
      // Also update refs immediately
      selectedClusterRef.current = clusterIndex
      formationModeRef.current = true
    }
  }

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
      {/* Cluster Selector - Hamburger Menu */}
      {clusters.length > 0 && (
        <div className="cluster-selector-container">
          <button
            className="cluster-hamburger-button"
            onClick={() => setClusterMenuOpen(!clusterMenuOpen)}
            aria-label="Toggle cluster menu"
          >
            <span className={`hamburger-line ${clusterMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${clusterMenuOpen ? 'open' : ''}`}></span>
            <span className={`hamburger-line ${clusterMenuOpen ? 'open' : ''}`}></span>
          </button>
          {clusterMenuOpen && (
            <div className="cluster-selector">
              <div className="cluster-selector-header">Clusters ({clusters.length})</div>
              <div className="cluster-list">
                {clusters.map((cluster, index) => {
                  // Get clusterId from first character in cluster
                  const characters = charactersRef.current || []
                  const firstChar = characters.find(char => cluster.includes(char.username))
                  const clusterId = firstChar?.clusterId || `Cluster ${index + 1}`
                  
                  return (
                    <button
                      key={index}
                      className={`cluster-button ${selectedCluster === index ? 'active' : ''}`}
                      onClick={() => handleClusterSelect(index)}
                    >
                      {clusterId} ({cluster.length} players)
                    </button>
                  )
                })}
              </div>
              {formationMode && (
                <button
                  className="cluster-button cancel"
                  onClick={() => {
                    console.log(`🔄 Formation Mode Cancelled - returning to normal movement`)
                    setSelectedCluster(null)
                    setFormationMode(false)
                // Clear formation mode flags and fade back in
                const characters = charactersRef.current || []
                characters.forEach(char => {
                  char.formationMode = false
                  char.shouldDespawn = false
                  if (char.path && char.path.changeTargetTime === 999999) {
                    char.path.changeTargetTime = Math.random() * 5 + 4 // Reset to normal
                  }
                  
                  // Reset animation state - clear RUN state and return to WALK
                  if (char.animationState === ANIMATION_STATES.RUN || char.animationState === ANIMATION_STATES.WAVE) {
                    char.animationState = ANIMATION_STATES.WALK
                    char.animProgress = 0
                  }
                  char.reachedFormationPosition = false
                  char.waveDuration = undefined
                  
                  // Fade back in if faded out
                  if (char.isFadedOut) {
                    char.isFadedOut = false
                    char.fadeOutOpacity = 0 // Start from 0 for fade in (will fade in during animation loop)
                  }
                })
                  }}
                >
                  Cancel Formation
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className="info-box">
        You're looking at everybody online on Craft Down Under right now!
      </div>
      <div className="player-count">
        {playerCount} {playerCount === 1 ? 'player' : 'players'} online
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

