"use client"

import {
  ArcRotateCamera,
  Camera,
  Color3,
  Engine,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  Plane,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core"
import { useEffect, useRef } from "react"
import { AddRoofCommand, RoofType } from "@/types/roof"

interface Props {
  roofImage: string
  addCommand: AddRoofCommand | null
}

export default function PlanCanvas({ roofImage, addCommand }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const zoomRef = useRef<number>(100)
  const markersRef = useRef<Mesh[]>([])

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
    sceneRef.current = scene

    CreateCamera(scene)

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
      sceneRef.current = null
    }
  }, [roofImage])

  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const canvas = canvasRef.current

    if (!scene || !camera || !canvas || !addCommand) return

    const { roofType } = addCommand

    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return

      const ev = pointerInfo.event as PointerEvent
      if (ev.button !== 0) return // only left click

      const hitPoint = getPointerOnGround(scene, camera)
      if (!hitPoint) return

      const marker = MeshBuilder.CreatePlane(
        `marker-${markersRef.current.length}`,
        { width: 10, height: 10 },
        scene
      )
      marker.rotation.x = Math.PI / 2
      marker.position = new Vector3(hitPoint.x, 0.02, hitPoint.z)

      const mat = new StandardMaterial(
        `markerMat-${markersRef.current.length}`,
        scene
      )
      mat.emissiveColor =
        roofType === "flat"
          ? new Color3(0.2, 0.6, 0.9)
          : new Color3(0.9, 0.4, 0.2)
      mat.alpha = 0.4
      mat.disableLighting = true
      marker.material = mat

      markersRef.current.push(marker)

      if (observer) {
        scene.onPointerObservable.remove(observer)
      }
    })

    return () => {
      if (scene && observer) {
        scene.onPointerObservable.remove(observer)
      }
    }
  }, [addCommand])

  function CreateCamera(scene: Scene) {
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

    return cam
  }

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

  function getPointerOnGround(scene: Scene, camera: Camera): Vector3 | null {
    const ray = scene.createPickingRay(
      scene.pointerX,
      scene.pointerY,
      Matrix.Identity(),
      camera,
      false
    )

    const groundPlane = Plane.FromPositionAndNormal(
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0)
    )

    const dist = ray.intersectsPlane(groundPlane)
    if (dist === null) return null

    return ray.origin.add(ray.direction.scale(dist))
  }

  return <canvas ref={canvasRef} className="w-full h-full" />
}
