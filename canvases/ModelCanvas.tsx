"use client"

import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  Vector3,
} from "@babylonjs/core"
import { GridMaterial } from "@babylonjs/materials"
import { useRef, useEffect } from "react"
import { subscribeMarkers } from "@/state/MarkerSync"
import { MarkerTransform } from "@/types/marker"

export default function ModelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true)
    engineRef.current = engine

    const scene = new Scene(engine)

    CreateCamera(scene)
    CreateGround(scene)

    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
    light.intensity = 0.9

    const houses = new Map<string, Mesh>()

    const unsubscribe = subscribeMarkers((markers: MarkerTransform[]) => {
      const seen = new Set<string>()

      markers.forEach((marker) => {
        seen.add(marker.id)
        let mesh = houses.get(marker.id)
        if (!mesh) {
          mesh = MeshBuilder.CreateBox(
            `house-${marker.id}`,
            { width: 4, depth: 4, height: 2 },
            scene
          )
          houses.set(marker.id, mesh)
        }

        mesh.position.x = marker.position.x
        mesh.position.z = marker.position.z
        mesh.position.y = 1
      })

      for (const [id, mesh] of houses) {
        if (!seen.has(id)) {
          mesh.dispose()
          houses.delete(id)
        }
      }
    })

    engine.runRenderLoop(() => scene.render())

    const onResize = () => engine.resize()
    window.addEventListener("resize", onResize)

    return () => {
      unsubscribe()
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
    }
  }, [])

  /**
   * Creates an arc-rotate camera with constrained rotation limits for a 3D view.
   * The camera is positioned at an angle and can orbit around the scene.
   *
   * @param scene - The Babylon.js scene to add the camera to
   * @returns The configured arc-rotate camera
   */
  function CreateCamera(scene: Scene) {
    const camera = new ArcRotateCamera(
      "camera",
      0,
      Math.PI / 4,
      20,
      Vector3.Zero(),
      scene
    )
    camera.attachControl()
    camera.lowerBetaLimit = 0
    camera.upperBetaLimit = Math.PI / 2.1
    camera.minZ = 0.1
    camera.maxZ = 1000
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 100
    return camera
  }

  /**
   * Creates a large ground plane with a grid material for visual reference.
   * The ground serves as the base plane for the 3D scene.
   *
   * @param scene - The Babylon.js scene to add the ground to
   */
  function CreateGround(scene: Scene) {
    const groundSize = 400
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: groundSize, height: groundSize, subdivisions: 100 },
      scene
    )

    const gridMat = new GridMaterial("gridMat", scene)
    gridMat.majorUnitFrequency = 5
    gridMat.minorUnitVisibility = 0.45
    gridMat.gridRatio = 1
    gridMat.backFaceCulling = false
    gridMat.mainColor = new Color3(0.2, 0.4, 0.2)
    gridMat.lineColor = new Color3(1, 1, 1)
    gridMat.opacity = 1

    ground.material = gridMat
  }

  return <canvas ref={canvasRef} className="w-full h-full" />
}
