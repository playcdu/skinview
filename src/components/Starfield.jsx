import React, { useRef, useEffect } from 'react'
import './Starfield.css'

function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Create stars
    const stars = []
    const numStars = 300 // Increased from 200
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5 + 0.5, // Increased minimum radius from 0 to 0.5
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.5 + 0.5 // Increased opacity range (0.5 to 1.0 instead of 0 to 1)
      })
    }

    let animationId
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'

      stars.forEach(star => {
        // Move stars (parallax effect)
        star.y += star.speed
        if (star.y > canvas.height) {
          star.y = 0
          star.x = Math.random() * canvas.width
        }

        // Draw star with brighter color
        ctx.globalAlpha = star.opacity
        ctx.fillStyle = '#ffffff' // Ensure white color
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.globalAlpha = 1
      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield" />
}

export default Starfield

