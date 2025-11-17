import {
  Mesh,
  Vector3,
  AbstractMesh,
  Scene,
  Camera,
  PointerEventTypes,
  Observer,
  Plane,
  Matrix,
} from "@babylonjs/core"

/**
 * ResizeBehaviour class for controlling marker resizing via corner and edge handles.
 * Supports both corner resizing (diagonal) and edge resizing (one dimension).
 */
export class ResizeBehaviour {
  private marker: Mesh
  private cornerHandles: AbstractMesh[]
  private edgeHandles: AbstractMesh[]
  private scene: Scene
  private camera: Camera
  private movementBehaviour: any
  private markerId: string
  private selectMarkerFn: (id: string | null) => void
  private isSelected: () => boolean

  private cornerResizeObserver?: Observer<any>
  private edgeResizeObserver?: Observer<any>

  private BASE_WIDTH = 10
  private BASE_HEIGHT = 10

  private isResizing = false
  private isResizingEdge = false

  private resizeEndCallbacks: (() => void)[] = []

  /**
   * Constructor of ResizeBehaviour.
   *
   * @param marker - Marker mesh to resize.
   * @param cornerHandles - Array of 4 corner handles.
   * @param edgeHandles - Array of 4 edge handles.
   * @param scene - Scene reference.
   * @param camera - Camera reference.
   * @param movementBehaviour - MovementBehaviour instance to disable during resize.
   * @param markerId - Unique identifier for the marker.
   * @param selectMarkerFn - Function to call when selecting the marker.
   * @param isSelected - Function to check if marker is selected.
   */
  constructor(
    marker: Mesh,
    cornerHandles: AbstractMesh[],
    edgeHandles: AbstractMesh[],
    scene: Scene,
    camera: Camera,
    movementBehaviour: any,
    markerId: string,
    selectMarkerFn: (id: string | null) => void,
    isSelected: () => boolean
  ) {
    this.marker = marker
    this.cornerHandles = cornerHandles
    this.edgeHandles = edgeHandles
    this.scene = scene
    this.camera = camera
    this.movementBehaviour = movementBehaviour
    this.markerId = markerId
    this.selectMarkerFn = selectMarkerFn
    this.isSelected = isSelected
  }

  /**
   * Get pointer position on ground plane (Y = 0).
   */
  private getPointerOnGround(): Vector3 | null {
    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      Matrix.Identity(),
      this.camera,
      false
    )

    const groundPlane = Plane.FromPositionAndNormal(
      Vector3.Zero(),
      new Vector3(0, 1, 0)
    )

    const dist = ray.intersectsPlane(groundPlane)
    if (dist === null) return null

    return ray.origin.add(ray.direction.scale(dist))
  }

  /**
   * Attach corner resize behavior.
   */
  private attachCornerResize(): void {
    if (this.cornerResizeObserver) return

    const oppositeCornerMap = [3, 2, 1, 0]
    let activeCornerIndex: number | null = null
    let fixedCornerWorld: Vector3 | null = null
    let initialMarkerCenter: Vector3 | null = null

    this.cornerResizeObserver = this.scene.onPointerObservable.add(
      (pointerInfo) => {
        switch (pointerInfo.type) {
          case PointerEventTypes.POINTERDOWN: {
            const pick = pointerInfo.pickInfo
            if (!pick?.hit || !pick.pickedMesh) return

            const idx = this.cornerHandles.indexOf(
              pick.pickedMesh as AbstractMesh
            )
            if (idx === -1) return

            this.selectMarkerFn(this.markerId)
            if (!this.isSelected()) return

            this.isResizing = true
            activeCornerIndex = idx
            this.movementBehaviour.disable()

            const oppositeIdx = oppositeCornerMap[idx]
            const oppositeHandle = this.cornerHandles[oppositeIdx]
            fixedCornerWorld = oppositeHandle.getAbsolutePosition().clone()
            initialMarkerCenter = this.marker.position.clone()

            break
          }

          case PointerEventTypes.POINTERUP: {
            if (this.isResizing) {
              this.isResizing = false
              activeCornerIndex = null
              fixedCornerWorld = null
              initialMarkerCenter = null
              this.movementBehaviour.enable()
              this.resizeEndCallbacks.forEach((cb) => cb())
            }
            break
          }

          case PointerEventTypes.POINTERMOVE: {
            if (
              !this.isResizing ||
              activeCornerIndex === null ||
              !fixedCornerWorld ||
              !initialMarkerCenter
            ) {
              return
            }

            const hitPoint = this.getPointerOnGround()
            if (!hitPoint) return

            const deltaWorld = hitPoint.subtract(fixedCornerWorld)
            const axisX = this.marker.getDirection(Vector3.Right()).normalize()
            let axisZ = Vector3.Cross(Vector3.Up(), axisX)
            if (axisZ.lengthSquared() < 1e-6) {
              axisZ = new Vector3(0, 0, 1)
            } else {
              axisZ.normalize()
            }

            const projX = Vector3.Dot(deltaWorld, axisX)
            const projZ = Vector3.Dot(deltaWorld, axisZ)

            const MIN_SIZE = 0.5
            const signX = projX >= 0 ? 1 : -1
            const signZ = projZ >= 0 ? 1 : -1
            const fullWidthWorld = Math.max(Math.abs(projX), MIN_SIZE)
            const fullHeightWorld = Math.max(Math.abs(projZ), MIN_SIZE)
            const halfWidthWorld = fullWidthWorld / 2
            const halfHeightWorld = fullHeightWorld / 2

            this.marker.scaling.x = fullWidthWorld / this.BASE_WIDTH
            this.marker.scaling.y = fullHeightWorld / this.BASE_HEIGHT

            const centerWorld = fixedCornerWorld
              .add(axisX.scale(signX * halfWidthWorld))
              .add(axisZ.scale(signZ * halfHeightWorld))

            this.marker.position.x = centerWorld.x
            this.marker.position.z = centerWorld.z
            this.marker.position.y = initialMarkerCenter.y

            break
          }
        }
      }
    )
  }

  /**
   * Attach edge resize behavior.
   */
  private attachEdgeResize(): void {
    if (this.edgeResizeObserver) return

    let activeEdge: AbstractMesh | null = null
    let resizeAxis: Vector3 | null = null
    let isWidthResize = true
    let fixedEdgeCenter: Vector3 | null = null
    let initialScaleX = 1
    let initialScaleY = 1
    let initialCenterY = 0

    this.edgeResizeObserver = this.scene.onPointerObservable.add(
      (pointerInfo) => {
        switch (pointerInfo.type) {
          case PointerEventTypes.POINTERDOWN: {
            const pick = pointerInfo.pickInfo
            if (!pick?.hit || !pick.pickedMesh) return

            const idx = this.edgeHandles.indexOf(
              pick.pickedMesh as AbstractMesh
            )
            if (idx === -1) return

            this.selectMarkerFn(this.markerId)
            if (!this.isSelected()) return

            const handle = this.edgeHandles[idx]
            this.isResizingEdge = true
            activeEdge = handle
            this.movementBehaviour.disable()

            const axisX = this.marker.getDirection(Vector3.Right()).normalize()
            let axisZ = Vector3.Cross(Vector3.Up(), axisX)
            if (axisZ.lengthSquared() < 1e-6) {
              axisZ = new Vector3(0, 0, 1)
            } else {
              axisZ.normalize()
            }

            const center = this.marker.position.clone()
            const handlePos = handle.getAbsolutePosition()
            const v = handlePos.subtract(center)

            const dotX = Vector3.Dot(v, axisX)
            const dotZ = Vector3.Dot(v, axisZ)

            if (Math.abs(dotX) >= Math.abs(dotZ)) {
              isWidthResize = true
              resizeAxis = axisX
              const signSide = dotX >= 0 ? 1 : -1
              const half = Math.abs(dotX)
              fixedEdgeCenter = center.subtract(
                resizeAxis.scale(signSide * half)
              )
            } else {
              isWidthResize = false
              resizeAxis = axisZ
              const signSide = dotZ >= 0 ? 1 : -1
              const half = Math.abs(dotZ)
              fixedEdgeCenter = center.subtract(
                resizeAxis.scale(signSide * half)
              )
            }

            initialScaleX = this.marker.scaling.x
            initialScaleY = this.marker.scaling.y
            initialCenterY = this.marker.position.y

            break
          }

          case PointerEventTypes.POINTERUP: {
            if (this.isResizingEdge) {
              this.isResizingEdge = false
              activeEdge = null
              resizeAxis = null
              fixedEdgeCenter = null
              this.movementBehaviour.enable()
              this.resizeEndCallbacks.forEach((cb) => cb())
            }
            break
          }

          case PointerEventTypes.POINTERMOVE: {
            if (
              !this.isResizingEdge ||
              !activeEdge ||
              !resizeAxis ||
              !fixedEdgeCenter
            ) {
              return
            }

            const hitPoint = this.getPointerOnGround()
            if (!hitPoint) return

            const diff = hitPoint.subtract(fixedEdgeCenter)
            const t = Vector3.Dot(diff, resizeAxis)

            const MIN_HALF = 0.25
            const sign = t >= 0 ? 1 : -1
            const absT = Math.abs(t)
            let newHalf = absT / 2

            if (newHalf < MIN_HALF) newHalf = MIN_HALF

            const fullWorld = newHalf * 2

            if (isWidthResize) {
              this.marker.scaling.x = fullWorld / this.BASE_WIDTH
              this.marker.scaling.y = initialScaleY
            } else {
              this.marker.scaling.y = fullWorld / this.BASE_HEIGHT
              this.marker.scaling.x = initialScaleX
            }

            const centerWorld = fixedEdgeCenter.add(
              resizeAxis.scale(sign * newHalf)
            )

            this.marker.position.x = centerWorld.x
            this.marker.position.z = centerWorld.z
            this.marker.position.y = initialCenterY

            break
          }
        }
      }
    )
  }

  /**
   * Attach resize behavior (both corner and edge).
   */
  public attach(): void {
    this.attachCornerResize()
    this.attachEdgeResize()
  }

  /**
   * Detach resize behavior and clean up observers.
   */
  public detach(): void {
    if (this.cornerResizeObserver) {
      this.scene.onPointerObservable.remove(this.cornerResizeObserver)
      this.cornerResizeObserver = undefined
    }

    if (this.edgeResizeObserver) {
      this.scene.onPointerObservable.remove(this.edgeResizeObserver)
      this.edgeResizeObserver = undefined
    }

    this.isResizing = false
    this.isResizingEdge = false
  }

  /**
   * Set callback for when resize ends.
   */
  public onResizeEnd(callback: () => void): void {
    this.resizeEndCallbacks.push(callback)
  }

  /**
   * Check if marker is currently being resized.
   */
  public getIsResizing(): boolean {
    return this.isResizing || this.isResizingEdge
  }
}
