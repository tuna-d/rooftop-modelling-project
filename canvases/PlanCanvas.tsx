"use client"

import {
  AbstractMesh,
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
import {
  setMarkerTransform,
  selectMarker as selectMarkerInStore,
  subscribeMarkers,
} from "@/state/MarkerSync"
import { MarkerTransform } from "@/types/marker"
import { MovementBehaviour } from "@/behaviours/MovementBehaviour"
import { RotationBehaviour } from "@/behaviours/RotationBehaviour"
import { ResizeBehaviour } from "@/behaviours/ResizeBehaviour"

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
  const markersRef = useRef<
    Map<
      string,
      {
        marker: Mesh
        movementBehaviour: MovementBehaviour
        rotationBehaviour: RotationBehaviour
        resizeBehaviour: ResizeBehaviour
        cornerHandles: AbstractMesh[]
        edgeHandles: AbstractMesh[]
        rotateHandle: AbstractMesh
      }
    >
  >(new Map())
  const selectedMarkerIdRef = useRef<string | null>(null)

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
      if (ev.button !== 0) return

      const pickedMesh = pointerInfo.pickInfo?.pickedMesh
      if (pickedMesh && pickedMesh.metadata?.id) {
        const markerId = pickedMesh.metadata.id as string
        const isHandle = pickedMesh.name.includes("handle-")
        if (!isHandle) {
          selectMarker(markerId)
          return
        }
        return
      }

      const hitPoint = getPointerOnGround(scene, camera)
      if (!hitPoint) return

      const id = `marker-${Date.now()}-${markersRef.current.size}`
      const position = new Vector3(hitPoint.x, 0.02, hitPoint.z)

      const markerData = CreateRoofMarker(scene, position, roofType, id)

      markersRef.current.set(id, markerData)

      selectedMarkerIdRef.current = id
      updateSelectionVisuals()

      const initialTransform: MarkerTransform = {
        id,
        roofType,
        position: {
          x: markerData.marker.position.x,
          y: markerData.marker.position.y,
          z: markerData.marker.position.z,
        },
        rotationY: markerData.marker.rotation.y,
        scaleX: markerData.marker.scaling.x,
        scaleY: markerData.marker.scaling.y,
        widthMeters: 10,
        heightMeters: 10,
        isResizing: false,
        isSelected: true,
      }

      setMarkerTransform(initialTransform)

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

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || addCommand) return

    const selectionObserver = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return

      const ev = pointerInfo.event as PointerEvent
      if (ev.button !== 0) return

      const pickedMesh = pointerInfo.pickInfo?.pickedMesh
      if (pickedMesh && pickedMesh.metadata?.id) {
        const markerId = pickedMesh.metadata.id as string
        const isHandle = pickedMesh.name.includes("handle-")
        if (!isHandle) {
          selectMarker(markerId)
        }
      } else {
        selectMarker(null)
      }
    })

    return () => {
      if (scene && selectionObserver) {
        scene.onPointerObservable.remove(selectionObserver)
      }
    }
  }, [addCommand])

  // Sync marker removals from the store
  useEffect(() => {
    return subscribeMarkers((markers) => {
      const scene = sceneRef.current
      if (!scene) return

      const markerIds = new Set(markers.map((m) => m.id))
      const toRemove: string[] = []

      markersRef.current.forEach((markerData, markerId) => {
        if (!markerIds.has(markerId)) {
          toRemove.push(markerId)
        }
      })

      toRemove.forEach((markerId) => {
        const markerData = markersRef.current.get(markerId)
        if (markerData) {
          markerData.movementBehaviour.detach()
          markerData.rotationBehaviour.detach()
          markerData.resizeBehaviour.detach()

          markerData.marker.dispose()
          markerData.cornerHandles.forEach((h) => h.dispose())
          markerData.edgeHandles.forEach((h) => h.dispose())
          markerData.rotateHandle.dispose()

          markersRef.current.delete(markerId)
        }
      })

      if (
        selectedMarkerIdRef.current &&
        !markerIds.has(selectedMarkerIdRef.current)
      ) {
        selectedMarkerIdRef.current = null
        updateSelectionVisuals()
      }
    })
  }, [])

  /**
   * Creates an orthographic camera positioned above the scene looking down.
   * The camera is locked to prevent rotation and configured for top-down panning.
   *
   * @param scene - The Babylon.js scene to add the camera to
   * @returns The configured orthographic camera
   */
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
    cam._panningMouseButton = 2
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

      plane.isPickable = false

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

  /**
   * Calculates the 3D world position where the mouse pointer intersects the ground plane.
   * Used for placing markers at the clicked location on the roof image.
   *
   * @param scene - The Babylon.js scene
   * @param camera - The camera to use for ray casting
   * @returns The intersection point on the ground plane, or null if no intersection
   */
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

  /**
   * Creates handles for a marker that's lying flat (rotation.x = PI/2).
   * Returns corner handles, edge handles, and a rotation handle.
   */
  function createHandlesForMarker(
    marker: Mesh,
    scene: Scene,
    baseWidth: number,
    baseHeight: number
  ): {
    cornerHandles: AbstractMesh[]
    edgeHandles: AbstractMesh[]
    rotationHandle: AbstractMesh
  } {
    const handleSize = 0.3
    const zOffset = 0.2

    const bbox = marker.getBoundingInfo().boundingBox.extendSize
    const halfW = bbox.x
    const halfH = bbox.y

    const handleMat = new StandardMaterial(`handleMat-${marker.name}`, scene)
    handleMat.emissiveColor = new Color3(1, 0.5, 0)
    handleMat.disableLighting = true
    handleMat.backFaceCulling = false

    const cornerHandles: AbstractMesh[] = []
    const cornerPositions = [
      new Vector3(-halfW, halfH, zOffset), // top-left
      new Vector3(halfW, halfH, zOffset), // top-right
      new Vector3(-halfW, -halfH, zOffset), // bottom-left
      new Vector3(halfW, -halfH, zOffset), // bottom-right
    ]

    cornerPositions.forEach((pos, index) => {
      const h = MeshBuilder.CreatePlane(
        `${marker.name}-corner-${index}`,
        { width: handleSize, height: handleSize },
        scene
      )
      h.parent = marker
      h.position = pos
      h.material = handleMat
      h.isPickable = true
      h.isVisible = false
      h.renderingGroupId = 1
      cornerHandles.push(h)
    })

    const edgeHandles: AbstractMesh[] = []
    const edgePositions = [
      new Vector3(0, halfH, zOffset), // top
      new Vector3(halfW, 0, zOffset), // right
      new Vector3(0, -halfH, zOffset), // bottom
      new Vector3(-halfW, 0, zOffset), // left
    ]

    const edgeNames = ["top", "right", "bottom", "left"] as const

    edgePositions.forEach((pos, index) => {
      const h = MeshBuilder.CreatePlane(
        `${marker.name}-edge-${edgeNames[index]}`,
        { width: handleSize * 1.2, height: handleSize * 0.7 },
        scene
      )
      h.parent = marker
      h.position = pos
      h.material = handleMat
      h.isPickable = true
      h.isVisible = false
      h.metadata = { edgeSide: edgeNames[index] }
      h.renderingGroupId = 1
      edgeHandles.push(h)
    })

    edgeHandles[1].rotation.z = Math.PI / 2
    edgeHandles[3].rotation.z = Math.PI / 2

    const rotationHandle = MeshBuilder.CreateDisc(
      `${marker.name}-rot`,
      { radius: handleSize },
      scene
    )
    rotationHandle.parent = marker
    rotationHandle.position = new Vector3(0, halfH + 2, zOffset)
    rotationHandle.material = handleMat
    rotationHandle.isPickable = true
    rotationHandle.isVisible = false
    rotationHandle.renderingGroupId = 1

    return { cornerHandles, edgeHandles, rotationHandle }
  }

  /**
   * Keeps the rotation handle at a fixed distance from the marker center.
   */
  function keepRotateHandleDistanceConstant(
    scene: Scene,
    marker: Mesh,
    rotationHandle: AbstractMesh,
    distance: number
  ): void {
    scene.onBeforeRenderObservable.add(() => {
      if (!marker || !rotationHandle) return

      const markerWorldMatrix = marker.getWorldMatrix()
      const markerForward = Vector3.TransformNormal(
        new Vector3(0, 0, 1),
        markerWorldMatrix
      ).normalize()

      const markerPosition = marker.getAbsolutePosition()
      const targetPosition = markerPosition.add(markerForward.scale(distance))

      const inverseMatrix = new Matrix()
      marker.getWorldMatrix().invertToRef(inverseMatrix)
      const localTarget = Vector3.TransformCoordinates(
        targetPosition,
        inverseMatrix
      )

      rotationHandle.position = localTarget
    })
  }

  /**
   * Updates the scaling of handles to maintain constant size regardless of marker scaling.
   */
  function updateHandleScaling(
    marker: Mesh,
    cornerHandles: AbstractMesh[],
    edgeHandles: AbstractMesh[],
    rotationHandle: AbstractMesh
  ): void {
    const MIN_SCALE = 0.001
    const scaleX = Math.max(Math.abs(marker.scaling.x), MIN_SCALE)
    const scaleY = Math.max(Math.abs(marker.scaling.y), MIN_SCALE)
    const scaleZ = Math.max(Math.abs(marker.scaling.z), MIN_SCALE)

    const invScaleX = 1 / scaleX
    const invScaleY = 1 / scaleY
    const invScaleZ = 1 / scaleZ

    cornerHandles.forEach((handle) => {
      if (handle) {
        handle.scaling.x = invScaleX
        handle.scaling.y = invScaleY
        handle.scaling.z = invScaleZ
      }
    })

    edgeHandles.forEach((handle) => {
      if (handle) {
        handle.scaling.x = invScaleX
        handle.scaling.y = invScaleY
        handle.scaling.z = invScaleZ
      }
    })

    if (rotationHandle) {
      rotationHandle.scaling.x = invScaleX
      rotationHandle.scaling.y = invScaleY
      rotationHandle.scaling.z = invScaleZ
    }
  }

  /**
   * Updates the visibility of handles based on the selected marker.
   */
  function updateSelectionVisuals(): void {
    const scene = sceneRef.current
    if (!scene) return

    markersRef.current.forEach((markerData, markerId) => {
      const isSelected = markerId === selectedMarkerIdRef.current
      const allHandles = [
        ...markerData.cornerHandles,
        ...markerData.edgeHandles,
        markerData.rotateHandle,
      ]

      allHandles.forEach((handle) => {
        if (handle) {
          handle.isVisible = isSelected
          handle.setEnabled(isSelected)
        }
      })
    })
  }

  /**
   * Selects a marker by ID and updates visuals.
   */
  function selectMarker(markerId: string | null): void {
    selectedMarkerIdRef.current = markerId
    updateSelectionVisuals()
    selectMarkerInStore(markerId)
  }

  /**
   * Creates a roof marker with handles and movement behavior.
   */
  function CreateRoofMarker(
    scene: Scene,
    position: Vector3,
    roofType: RoofType,
    markerId: string
  ): {
    marker: Mesh
    movementBehaviour: MovementBehaviour
    rotationBehaviour: RotationBehaviour
    resizeBehaviour: ResizeBehaviour
    cornerHandles: AbstractMesh[]
    edgeHandles: AbstractMesh[]
    rotateHandle: AbstractMesh
  } {
    const marker = MeshBuilder.CreatePlane(
      `marker-${markerId}`,
      { width: 10, height: 10 },
      scene
    )
    marker.rotation.x = Math.PI / 2
    marker.position = position
    marker.isPickable = true

    if (!marker.metadata) {
      marker.metadata = {}
    }
    marker.metadata.id = markerId

    const mat = new StandardMaterial(`markerMat-${markerId}`, scene)
    mat.emissiveColor =
      roofType === "flat"
        ? new Color3(0.2, 0.6, 0.9)
        : new Color3(0.9, 0.4, 0.2)
    mat.alpha = 0.4
    mat.disableLighting = true
    marker.material = mat

    const movementBehaviour = new MovementBehaviour(marker, 0.5)
    movementBehaviour.attach()

    const BASE_WIDTH = 10
    const BASE_HEIGHT = 10
    const { cornerHandles, edgeHandles, rotationHandle } =
      createHandlesForMarker(marker, scene, BASE_WIDTH, BASE_HEIGHT)

    const allResizeHandles = [...cornerHandles, ...edgeHandles]

    movementBehaviour.addExcludedMeshes([...allResizeHandles, rotationHandle])

    const camera = cameraRef.current
    if (!camera) {
      throw new Error("Camera not initialized")
    }

    const rotationBehaviour = new RotationBehaviour(
      marker,
      rotationHandle,
      scene,
      camera
    )
    rotationBehaviour.attach()

    const resizeBehaviour = new ResizeBehaviour(
      marker,
      cornerHandles,
      edgeHandles,
      scene,
      camera,
      movementBehaviour,
      markerId,
      selectMarker,
      () => selectedMarkerIdRef.current === markerId
    )
    resizeBehaviour.attach()

    updateHandleScaling(marker, cornerHandles, edgeHandles, rotationHandle)

    const updateMarkerState = () => {
      const markerData: MarkerTransform = {
        id: markerId,
        roofType,
        position: {
          x: marker.position.x,
          y: marker.position.y,
          z: marker.position.z,
        },
        rotationY: marker.rotation.y,
        scaleX: marker.scaling.x,
        scaleY: marker.scaling.y,
        widthMeters: marker.scaling.x * BASE_WIDTH,
        heightMeters: marker.scaling.y * BASE_HEIGHT,
        isResizing: resizeBehaviour.getIsResizing(),
        isSelected: selectedMarkerIdRef.current === markerId,
      }
      setMarkerTransform(markerData)
    }

    const syncObserver = scene.onBeforeRenderObservable.add(() => {
      if (resizeBehaviour.getIsResizing()) {
        updateMarkerState()
      }
      updateHandleScaling(marker, cornerHandles, edgeHandles, rotationHandle)
    })

    movementBehaviour.onDragEnd(updateMarkerState)
    rotationBehaviour.onDragEnd(updateMarkerState)
    resizeBehaviour.onResizeEnd(updateMarkerState)

    return {
      marker,
      movementBehaviour,
      rotationBehaviour,
      resizeBehaviour,
      cornerHandles,
      edgeHandles,
      rotateHandle: rotationHandle,
    }
  }

  return <canvas ref={canvasRef} className="w-full h-full" />
}
