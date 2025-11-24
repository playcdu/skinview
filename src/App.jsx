import React from 'react'
import SkinViewer from './components/SkinViewer'
import BackgroundAudio from './components/BackgroundAudio'
import './App.css'

function App() {
  // YouTube video ID from https://www.youtube.com/watch?v=WpQM1jrBQX8
  const youtubeVideoId = 'WpQM1jrBQX8'
  
  return (
    <div className="app">
      <SkinViewer />
      <BackgroundAudio videoId={youtubeVideoId} startTime={0} />
    </div>
  )
}

export default App

