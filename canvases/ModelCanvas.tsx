"use client"

import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core"
import { GridMaterial } from "@babylonjs/materials"
import { useRef, useEffect } from "react"
import { subscribeMarkers } from "@/state/MarkerSync"
import { MarkerTransform } from "@/types/marker"
import { RoofType } from "@/types/roof"

interface HouseState {
  root: TransformNode
  roofType: RoofType
  lastPos: { x: number; z: number } | null
  positionLocked: boolean
}

export default function ModelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const housesRef = useRef<Map<string, HouseState>>(new Map())

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

    function createHouseRoot(scene: Scene, roofType: RoofType): TransformNode {
      const width = 5
      const depth = 5
      const wallHeight = 1.5
      const roofHeight = 1.5

      const root = new TransformNode(
        roofType === "flat" ? "flatRoot" : "dualRoot",
        scene
      )

      root.position.y = 0

      const base = MeshBuilder.CreateBox(
        roofType === "flat" ? "flatBase" : "dualBase",
        { width, depth, height: wallHeight },
        scene
      )

      base.position.y = wallHeight / 2
      base.parent = root

      if (roofType === "flat") {
        const flatSlab = MeshBuilder.CreateBox(
          "flatSlab",
          { width, depth, height: 0.2 },
          scene
        )

        flatSlab.position.y = wallHeight + 0.1
        flatSlab.parent = root
      } else {
        const halfW = width / 2
        const halfD = depth / 2

        const frontLeft = new Vector3(-halfW, 0, -halfD)
        const frontRidge = new Vector3(0, roofHeight, -halfD)
        const frontRight = new Vector3(halfW, 0, -halfD)

        const backLeft = new Vector3(-halfW, 0, halfD)
        const backRidge = new Vector3(0, roofHeight, halfD)
        const backRight = new Vector3(halfW, 0, halfD)

        const roofPrism = new Mesh("roofPrism", scene)

        const positions: number[] = []
        const indices: number[] = []

        positions.push(
          frontLeft.x,
          frontLeft.y,
          frontLeft.z,
          frontRight.x,
          frontRight.y,
          frontRight.z,
          frontRidge.x,
          frontRidge.y,
          frontRidge.z
        )
        indices.push(0, 1, 2)

        positions.push(
          backLeft.x,
          backLeft.y,
          backLeft.z,
          backRidge.x,
          backRidge.y,
          backRidge.z,
          backRight.x,
          backRight.y,
          backRight.z
        )
        indices.push(3, 4, 5)

        positions.push(
          frontLeft.x,
          frontLeft.y,
          frontLeft.z,
          frontRidge.x,
          frontRidge.y,
          frontRidge.z,
          backRidge.x,
          backRidge.y,
          backRidge.z,
          backLeft.x,
          backLeft.y,
          backLeft.z
        )
        indices.push(6, 7, 8, 6, 8, 9)

        positions.push(
          frontRight.x,
          frontRight.y,
          frontRight.z,
          backRight.x,
          backRight.y,
          backRight.z,
          backRidge.x,
          backRidge.y,
          backRidge.z,
          frontRidge.x,
          frontRidge.y,
          frontRidge.z
        )
        indices.push(10, 11, 12, 10, 12, 13)

        positions.push(
          frontLeft.x,
          frontLeft.y,
          frontLeft.z,
          backLeft.x,
          backLeft.y,
          backLeft.z,
          backRight.x,
          backRight.y,
          backRight.z,
          frontRight.x,
          frontRight.y,
          frontRight.z
        )
        indices.push(14, 15, 16, 14, 16, 17)

        roofPrism.setVerticesData("position", positions)
        roofPrism.setIndices(indices)
        roofPrism.createNormals(true)
        roofPrism.flipFaces(true)

        const roofMaterial = new StandardMaterial("roofMat", scene)
        roofMaterial.backFaceCulling = false
        roofPrism.material = roofMaterial

        roofPrism.position.y = wallHeight
        roofPrism.parent = root
      }

      return root
    }

    function syncHousesToMarkers(
      scene: Scene,
      markers: MarkerTransform[],
      map: Map<string, HouseState>
    ) {
      const seen = new Set<string>()

      markers.forEach((m) => seen.add(m.id))

      for (const [id, house] of map) {
        if (!seen.has(id)) {
          house.root.dispose()
          map.delete(id)
        }
      }

      markers.forEach((marker) => {
        let house = map.get(marker.id)

        if (!house) {
          const root = createHouseRoot(scene, marker.roofType)
          house = {
            root,
            roofType: marker.roofType,
            lastPos: null,
            positionLocked: false,
          }
          map.set(marker.id, house)
        } else if (house.roofType !== marker.roofType) {
          house.root.dispose()
          const root = createHouseRoot(scene, marker.roofType)
          house.root = root
          house.roofType = marker.roofType
          house.lastPos = null
          house.positionLocked = false
        }

        updateHouseTransform(house, marker)
      })
    }

    function updateHouseTransform(house: HouseState, t: MarkerTransform) {
      const model = house.root
      const EPS = 1e-3
      const lastPos = house.lastPos

      model.rotation.y = t.rotationY

      const moved =
        lastPos === null
          ? true
          : Math.abs(t.position.x - lastPos.x) > EPS ||
            Math.abs(t.position.z - lastPos.z) > EPS

      if (t.isResizing) {
        house.positionLocked = true
        model.scaling.x = t.scaleX
        model.scaling.z = t.scaleY
        model.scaling.y = 1
      } else {
        model.scaling.x = t.scaleX
        model.scaling.z = t.scaleY
        model.scaling.y = 1

        if (house.positionLocked) {
          if (moved) {
            house.positionLocked = false
            model.position.x = t.position.x
            model.position.z = t.position.z
            model.position.y = 0
          }
        } else {
          if (moved) {
            model.position.x = t.position.x
            model.position.z = t.position.z
            model.position.y = 0
          }
        }
      }

      house.lastPos = { x: t.position.x, z: t.position.z }
    }

    const unsubscribe = subscribeMarkers((markers: MarkerTransform[]) => {
      syncHousesToMarkers(scene, markers, housesRef.current)
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
