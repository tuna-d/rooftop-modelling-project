"use client"

import {
  ArcRotateCamera,
  Camera,
  Color3,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core"
import { useEffect, useRef } from "react"

interface Props {
  roofImage: string
}

export default function PlanCanvas({ roofImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const zoomRef = useRef<number>(100)

  const updateOrtho = () => {
    const cam = cameraRef.current
    const eng = engineRef.current
    if (!cam || !eng) return

    const w = eng.getRenderWidth(true)
    const h = eng.getRenderHeight(true)
    const z = zoomRef.current

    cam.orthoLeft = -w / z
    cam.orthoRight = w / z
    cam.orthoTop = h / z
    cam.orthoBottom = -h / z
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true)
    engineRef.current = engine

    const scene = new Scene(engine)

    const cam = new ArcRotateCamera("planCam", 0, 0, 100, Vector3.Zero(), scene)
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    cam.setTarget(Vector3.Zero())
    cam.rotation.x = Math.PI / 2
    cam.minZ = 0.1
    cam.attachControl()
    cameraRef.current = cam

    cam.lowerAlphaLimit = 0
    cam.upperAlphaLimit = 0
    cam.lowerBetaLimit = 0
    cam.upperBetaLimit = 0
    cam.panningSensibility = 200
    cam._panningMouseButton = 0
    cam.lowerRadiusLimit = 5
    cam.upperRadiusLimit = 100

    const hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
    hemiLight.intensity = 0.1

    AddRoofImage(scene, roofImage)
    updateOrtho()

    engine.runRenderLoop(() => scene.render())

    const onResize = () => {
      engine.resize()
      updateOrtho()
    }
    window.addEventListener("resize", onResize)

    const onWheel = (e: WheelEvent) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      zoomRef.current = Math.max(5, Math.min(500, zoomRef.current * factor))
      updateOrtho()
      e.preventDefault()
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      canvas.removeEventListener("wheel", onWheel)
      window.removeEventListener("resize", onResize)

      try {
        engine.stopRenderLoop()
      } catch {}
      try {
        scene.dispose()
      } catch {}
      try {
        engine.dispose()
      } catch {}

      engineRef.current = null
      cameraRef.current = null
    }
  }, [roofImage])

  /**
   * Creates a plane mesh with the roof image as a texture and adds it to the scene.
   * The image is scaled down, rotated to lay flat (facing upward), and rendered
   * without lighting for accurate color representation.
   *
   * @param scene - The Babylon.js scene to add the roof plane to
   * @param imgUrl - URL/path to the roof image texture
   */
  function AddRoofImage(scene: Scene, imgUrl: string) {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      const scaleFactor = 50

      const plane = MeshBuilder.CreatePlane(
        "roofImg",
        { width: img.width / scaleFactor, height: img.height / scaleFactor },
        scene
      )

      plane.rotation.x = Math.PI / 2
      plane.rotation.y = -Math.PI / 2

      const mat = new StandardMaterial("planMat", scene)
      const texture = new Texture(imgUrl, scene)

      mat.diffuseTexture = texture
      mat.emissiveTexture = texture
      mat.disableLighting = true
      mat.specularColor = new Color3(0, 0, 0)
      mat.backFaceCulling = false

      plane.material = mat
    }

    img.onerror = () => {
      console.error(`Failed to load image: ${imgUrl}`)
    }

    img.src = imgUrl
  }

  return <canvas ref={canvasRef} className="w-full h-full" />
}
