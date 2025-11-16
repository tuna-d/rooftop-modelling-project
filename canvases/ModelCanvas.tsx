"use client"

import { useRef, useEffect } from "react"

export default function ModelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("Model Canvas created")
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
