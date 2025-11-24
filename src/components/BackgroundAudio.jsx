import React, { useEffect, useRef, useState } from 'react'
import './BackgroundAudio.css'

const BackgroundAudio = ({ videoId, startTime = 0 }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const playerRef = useRef(null)
  const iframeRef = useRef(null)

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer()
      }
    } else {
      initializePlayer()
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [])

  const initializePlayer = () => {
    if (window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player('youtube-background-audio', {
        videoId: videoId,
        playerVars: {
          autoplay: 0, // Start paused
          mute: 0, // Not muted (user controls via pause/play)
          loop: 1,
          playlist: videoId, // Required for loop to work
          start: startTime,
          controls: 0,
          showinfo: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            // Don't play on ready - wait for user interaction
            setIsPlaying(false)
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true)
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false)
            } else if (event.data === window.YT.PlayerState.ENDED) {
              // Video ended - restart it to loop forever
              if (playerRef.current) {
                playerRef.current.playVideo()
              }
            }
          },
        },
      })
    }
  }

  const handleTogglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo()
        setIsPlaying(false)
      } else {
        playerRef.current.playVideo()
        setIsPlaying(true)
      }
    }
  }

  return (
    <>
      {/* Hidden YouTube player - completely invisible */}
      <div id="youtube-background-audio" className="youtube-player-hidden"></div>
      
      {/* Play/Pause control button in bottom left */}
      <div className="background-audio-container">
        <button
          className={`audio-button ${isPlaying ? 'playing' : 'paused'}`}
          onClick={handleTogglePlayPause}
          title={isPlaying ? 'Click to pause background music' : 'Click to play background music'}
          aria-label={isPlaying ? 'Pause background music' : 'Play background music'}
        >
          {isPlaying ? (
            // Pause icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="currentColor"/>
            </svg>
          ) : (
            // Play icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5v14l11-7z" fill="currentColor"/>
            </svg>
          )}
        </button>
      </div>
    </>
  )
}

export default BackgroundAudio

