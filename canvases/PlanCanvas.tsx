"use client"

import { useEffect, useRef } from "react"

interface Props {
  roofImage: string
}

export default function PlanCanvas({ roofImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    console.log("Plan Canvas created")
  }, [])

  return <canvas ref={canvasRef} />
}
