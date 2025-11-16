import {
  Mesh,
  Vector3,
  AbstractMesh,
  PointerEventTypes,
  Observer,
} from "@babylonjs/core"
import { PointerDragBehavior } from "@babylonjs/core/Behaviors/Meshes/pointerDragBehavior"

export class MovementBehaviour {
  private pointerDragBehaviorXZ: PointerDragBehavior
  private mesh: Mesh
  private isDisabled: boolean = false
  private onDragStartCallback?: () => void
  private onDragEndCallback?: () => void
  private excludedMeshes: AbstractMesh[] = []
  private initialPickedMesh: AbstractMesh | null = null
  private isDragging: boolean = false
  private pointerObserver?: Observer<any>

  /**
   * Constructor of MovementBehaviour.
   *
   * @param mesh - Mesh to attach movement Behaviour.
   * @param dragDeltaRatio - Optional drag sensitivity (default: 0.5).
   */
  constructor(mesh: Mesh, dragDeltaRatio: number = 0.5) {
    this.mesh = mesh

    this.pointerDragBehaviorXZ = new PointerDragBehavior({
      dragPlaneNormal: new Vector3(0, 1, 0),
    })

    this.pointerDragBehaviorXZ.dragDeltaRatio = dragDeltaRatio
    this.pointerDragBehaviorXZ.dragButtons = [0]
    this.pointerDragBehaviorXZ.detachCameraControls = true
    this.pointerDragBehaviorXZ.useObjectOrientationForDragging = false

    const scene = this.mesh.getScene()
    if (scene) {
      this.pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null
          this.initialPickedMesh = pickedMesh
        } else if (
          pointerInfo.type === PointerEventTypes.POINTERUP ||
          pointerInfo.type === PointerEventTypes.POINTERDOUBLETAP
        ) {
          this.initialPickedMesh = null
        }
      })
    }

    this.pointerDragBehaviorXZ.validateDrag = (targetPosition) => {
      if (this.isDisabled) {
        return false
      }

      if (
        this.initialPickedMesh &&
        this.excludedMeshes.includes(this.initialPickedMesh)
      ) {
        return false
      }

      const scene = this.mesh.getScene()
      if (!scene) return true

      const pointerInfo =
        scene.pointerX >= 0 && scene.pointerY >= 0
          ? scene.pick(scene.pointerX, scene.pointerY)
          : null

      const pickedMesh = pointerInfo?.pickedMesh
      if (!pickedMesh) return false

      if (this.isDragging) {
        return true
      }

      if (pickedMesh !== this.mesh) {
        return false
      }

      return true
    }

    this.pointerDragBehaviorXZ.onDragStartObservable.add((evt) => {
      if (this.initialPickedMesh === this.mesh) {
        this.isDragging = true
      }
      if (this.onDragStartCallback) {
        this.onDragStartCallback()
      }
    })

    this.pointerDragBehaviorXZ.onDragEndObservable.add(() => {
      this.isDragging = false
      if (this.onDragEndCallback) {
        this.onDragEndCallback()
      }
    })
  }

  public onDragStart(callback: () => void): void {
    this.onDragStartCallback = callback
  }

  public onDragEnd(callback: () => void): void {
    this.onDragEndCallback = callback
  }

  public startDrag(): void {
    this.mesh.addBehavior(this.pointerDragBehaviorXZ)
    this.pointerDragBehaviorXZ.startDrag()
  }

  public attach(): void {
    if (!this.mesh.behaviors.includes(this.pointerDragBehaviorXZ)) {
      this.mesh.addBehavior(this.pointerDragBehaviorXZ)
    }
  }

  public detach(): void {
    this.pointerDragBehaviorXZ.detach()
    if (this.pointerObserver) {
      const scene = this.mesh.getScene()
      if (scene) {
        scene.onPointerObservable.remove(this.pointerObserver)
        this.pointerObserver = undefined
      }
    }
  }

  public disable(): void {
    this.isDisabled = true
  }

  public enable(): void {
    this.isDisabled = false
  }

  public addExcludedMeshes(meshes: AbstractMesh[]): void {
    this.excludedMeshes.push(...meshes)
  }
}
