import {
  Mesh,
  Vector3,
  Scene,
  Camera,
  PointerEventTypes,
  AbstractMesh,
} from "@babylonjs/core"
import { Observer } from "@babylonjs/core/Misc/observable"

/**
 * RotationBehaviour class for controlling rotation via drag on a rotation handle.
 * Allows rotating a mesh around its center (Y axis) by dragging a handle in a top-down view.
 */
export class RotationBehaviour {
  private mesh: Mesh
  private handle: AbstractMesh
  private scene: Scene
  private camera: Camera

  private pointerObserver?: Observer<any>

  private dragging: boolean = false

  private startRotationY: number = 0

  private startAngle: number = 0

  private initialMeshPosition: Vector3

  private dragStartCallbacks: (() => void)[] = []

  private dragEndCallbacks: (() => void)[] = []

  /**
   * Constructor of RotationBehaviour.
   *
   * @param mesh - Mesh to rotate.
   * @param handle - Handle mesh that triggers rotation when dragged.
   * @param scene - Scene reference.
   * @param camera - Camera reference.
   */
  constructor(mesh: Mesh, handle: AbstractMesh, scene: Scene, camera: Camera) {
    this.mesh = mesh
    this.handle = handle
    this.scene = scene
    this.camera = camera
    this.initialMeshPosition = mesh.position.clone()

    this.handle.isPickable = true
  }

  /**
   * Set callback for when drag starts.
   */
  public onDragStart(callback: () => void): void {
    this.dragStartCallbacks.push(callback)
  }

  /**
   * Set callback for when drag ends.
   */
  public onDragEnd(callback: () => void): void {
    this.dragEndCallbacks.push(callback)
  }

  /**
   * Check if the picked mesh is the rotation handle (not the marker or other meshes)
   */
  private isHandlePicked(pickedMesh: AbstractMesh | null): boolean {
    if (!pickedMesh) return false
    return pickedMesh === this.handle
  }

  /**
   * Enable the rotation behaviour.
   * Attaches pointer observers to handle drag events.
   */
  public attach(): void {
    if (this.pointerObserver) return

    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN: {
          const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null
          if (this.isHandlePicked(pickedMesh)) {
            this.dragging = true
            this.startRotationY = this.mesh.rotation.y
            this.initialMeshPosition = this.mesh.position.clone()

            const groundPoint = this.getMousePositionOnGroundPlane()
            if (groundPoint) {
              this.startAngle = this.computeAngleFromPoint(groundPoint)
            }

            if (this.camera instanceof Camera) {
              this.camera.detachControl()
            }

            this.dragStartCallbacks.forEach((cb) => cb())
          }
          break
        }
        case PointerEventTypes.POINTERMOVE: {
          if (!this.dragging) return

          const groundPoint = this.getMousePositionOnGroundPlane()
          if (!groundPoint) return

          const currentAngle = this.computeAngleFromPoint(groundPoint)
          const delta = currentAngle - this.startAngle

          this.mesh.rotation.y = this.startRotationY - delta

          this.mesh.position = this.initialMeshPosition.clone()
          break
        }
        case PointerEventTypes.POINTERUP:
        case PointerEventTypes.POINTERDOUBLETAP: {
          if (!this.dragging) return
          this.dragging = false

          this.dragEndCallbacks.forEach((cb) => cb())
          break
        }
      }
    })
  }

  /**
   * Disable behaviour and clean observers if needed.
   */
  public detach(): void {
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver)
      this.pointerObserver = undefined
    }
    this.dragging = false
  }

  /**
   * Get mouse position projected onto the ground plane (Y = mesh Y position).
   */
  private getMousePositionOnGroundPlane(): Vector3 | null {
    const pickInfo = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      undefined,
      false
    )

    if (!pickInfo || !pickInfo.ray) return null

    const groundY = this.mesh.position.y
    const ray = pickInfo.ray

    if (Math.abs(ray.direction.y) < 0.0001) return null

    const t = (groundY - ray.origin.y) / ray.direction.y
    if (t < 0) return null

    const intersection = ray.origin.add(ray.direction.scale(t))
    return intersection
  }

  /**
   * Compute angle of world point around mesh center in XZ plane.
   * Returns angle in radians, where 0 is along positive X axis.
   */
  private computeAngleFromPoint(worldPoint: Vector3): number {
    const center = this.mesh.position.clone()
    const v = worldPoint.subtract(center)
    return Math.atan2(v.z, v.x)
  }
}
