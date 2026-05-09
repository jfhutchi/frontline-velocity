import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { COLOR } from '../constants';
import type { MapDecoration, MissionDefinition, ObjectiveZone } from '../types';

export class TerrainRenderer {
  private scene: Scene;
  private meshes: Mesh[] = [];
  private objectiveRing?: Mesh;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  build(mission: MissionDefinition) {
    this.dispose();
    const size = mission.mapSize;
    const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 16 }, this.scene);
    const gMat = new StandardMaterial('groundMat', this.scene);
    gMat.diffuseColor = new Color3(COLOR.ground.r, COLOR.ground.g, COLOR.ground.b);
    gMat.specularColor = new Color3(0, 0, 0);
    ground.material = gMat;
    ground.position.y = 0;
    this.meshes.push(ground);

    // Map boundary fence — a simple thin wall for visual edge.
    const boundary = MeshBuilder.CreateBox('boundary', { width: size, height: 1.2, depth: size }, this.scene);
    const bMat = new StandardMaterial('boundaryMat', this.scene);
    bMat.diffuseColor = new Color3(0.1, 0.16, 0.12);
    bMat.specularColor = new Color3(0, 0, 0);
    bMat.alpha = 0.0; // hidden — kept as logical bounds only
    boundary.material = bMat;
    boundary.isVisible = false;
    this.meshes.push(boundary);

    // Decorations.
    for (const d of mission.decorations) {
      const m = this.buildDecoration(d);
      if (m) this.meshes.push(m);
    }

    // Objective ring.
    this.objectiveRing = this.buildObjectiveRing(mission.objective);
  }

  updateObjective(objective: ObjectiveZone) {
    if (!this.objectiveRing) return;
    const mat = this.objectiveRing.material as StandardMaterial | null;
    if (!mat) return;
    if (objective.captured) {
      mat.emissiveColor = new Color3(0.2, 0.8, 0.3);
    } else if (objective.contested) {
      mat.emissiveColor = new Color3(0.9, 0.3, 0.3);
    } else if (objective.occupiedByFriendly) {
      mat.emissiveColor = new Color3(COLOR.objective.r, COLOR.objective.g, COLOR.objective.b);
    } else {
      mat.emissiveColor = new Color3(0.7, 0.55, 0.2);
    }
  }

  private buildObjectiveRing(o: ObjectiveZone): Mesh {
    const ring = MeshBuilder.CreateDisc('objective', { radius: o.radius, tessellation: 48 }, this.scene);
    ring.rotation.x = Math.PI / 2;
    ring.position = new Vector3(o.position.x, 0.06, o.position.z);
    const mat = new StandardMaterial('objectiveMat', this.scene);
    mat.diffuseColor = new Color3(COLOR.objective.r, COLOR.objective.g, COLOR.objective.b);
    mat.emissiveColor = new Color3(0.7, 0.55, 0.2);
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0.35;
    ring.material = mat;
    this.meshes.push(ring);

    // Inner pulse marker.
    const inner = MeshBuilder.CreateDisc('objective_inner', { radius: o.radius * 0.28, tessellation: 24 }, this.scene);
    inner.rotation.x = Math.PI / 2;
    inner.position = new Vector3(o.position.x, 0.07, o.position.z);
    const innerMat = new StandardMaterial('objectiveInnerMat', this.scene);
    innerMat.diffuseColor = new Color3(1, 0.85, 0.4);
    innerMat.emissiveColor = new Color3(0.85, 0.6, 0.25);
    innerMat.specularColor = new Color3(0, 0, 0);
    inner.material = innerMat;
    this.meshes.push(inner);
    return ring;
  }

  private buildDecoration(d: MapDecoration): Mesh | null {
    switch (d.kind) {
      case 'road': {
        const m = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: d.scale.y, depth: d.scale.z }, this.scene);
        m.position = new Vector3(d.position.x, d.scale.y / 2 + 0.001, d.position.z);
        const mat = new StandardMaterial(`${d.id}_mat`, this.scene);
        mat.diffuseColor = new Color3(COLOR.road.r, COLOR.road.g, COLOR.road.b);
        mat.specularColor = new Color3(0, 0, 0);
        m.material = mat;
        return m;
      }
      case 'fieldPatch': {
        const m = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.04, depth: d.scale.z }, this.scene);
        m.position = new Vector3(d.position.x, 0.025, d.position.z);
        m.rotation.y = d.rotation;
        const mat = new StandardMaterial(`${d.id}_mat`, this.scene);
        mat.diffuseColor = new Color3(COLOR.fieldPatch.r, COLOR.fieldPatch.g, COLOR.fieldPatch.b);
        mat.specularColor = new Color3(0, 0, 0);
        m.material = mat;
        return m;
      }
      case 'building': {
        const w = d.scale.x;
        const h = d.scale.y;
        const depth = d.scale.z;
        const wallMat = new StandardMaterial(`${d.id}_wall`, this.scene);
        wallMat.diffuseColor = new Color3(COLOR.building.r, COLOR.building.g, COLOR.building.b);
        wallMat.specularColor = new Color3(0, 0, 0);
        const wall = MeshBuilder.CreateBox(d.id, { width: w, height: h, depth }, this.scene);
        wall.material = wallMat;
        wall.position = new Vector3(d.position.x, h / 2, d.position.z);
        wall.rotation.y = d.rotation;

        const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.5, height: 0.5, depth: depth + 0.5 }, this.scene);
        const roofMat = new StandardMaterial(`${d.id}_roofMat`, this.scene);
        roofMat.diffuseColor = new Color3(COLOR.buildingRoof.r, COLOR.buildingRoof.g, COLOR.buildingRoof.b);
        roofMat.specularColor = new Color3(0, 0, 0);
        roof.material = roofMat;
        roof.position = new Vector3(d.position.x, h + 0.25, d.position.z);
        roof.rotation.y = d.rotation;
        roof.parent = wall;
        // Re-position child relative to parent.
        roof.position = new Vector3(0, h / 2 + 0.25, 0);
        return wall;
      }
      case 'tree': {
        const trunkH = d.scale.y * 0.4;
        const trunk = MeshBuilder.CreateCylinder(d.id, { height: trunkH, diameter: 0.5 }, this.scene);
        const trunkMat = new StandardMaterial(`${d.id}_trunk`, this.scene);
        trunkMat.diffuseColor = new Color3(COLOR.treeTrunk.r, COLOR.treeTrunk.g, COLOR.treeTrunk.b);
        trunkMat.specularColor = new Color3(0, 0, 0);
        trunk.material = trunkMat;
        trunk.position = new Vector3(d.position.x, trunkH / 2, d.position.z);
        trunk.rotation.y = d.rotation;

        const foliageH = d.scale.y * 0.9;
        const foliage =
          d.tint === 'pine'
            ? MeshBuilder.CreateCylinder(
                `${d.id}_foliage`,
                { height: foliageH, diameterTop: 0.2, diameterBottom: 2.4, tessellation: 8 },
                this.scene,
              )
            : MeshBuilder.CreateSphere(`${d.id}_foliage`, { diameter: 2.4, segments: 6 }, this.scene);
        const foliageMat = new StandardMaterial(`${d.id}_fol`, this.scene);
        const palette = d.tint === 'pine' ? COLOR.treePine : COLOR.treeOak;
        foliageMat.diffuseColor = new Color3(palette.r, palette.g, palette.b);
        foliageMat.specularColor = new Color3(0, 0, 0);
        foliage.material = foliageMat;
        foliage.parent = trunk;
        foliage.position = new Vector3(0, trunkH / 2 + foliageH / 2, 0);
        return trunk;
      }
      case 'hill': {
        const m = MeshBuilder.CreateSphere(d.id, { diameter: d.scale.x, segments: 8 }, this.scene);
        m.scaling = new Vector3(1, d.scale.y / d.scale.x, 1);
        m.position = new Vector3(d.position.x, -d.scale.y * 0.4, d.position.z);
        const mat = new StandardMaterial(`${d.id}_mat`, this.scene);
        mat.diffuseColor = new Color3(COLOR.hill.r, COLOR.hill.g, COLOR.hill.b);
        mat.specularColor = new Color3(0, 0, 0);
        m.material = mat;
        return m;
      }
      default:
        return null;
    }
  }

  dispose() {
    for (const m of this.meshes) {
      m.dispose(false, true);
    }
    this.meshes = [];
    this.objectiveRing = undefined;
  }
}
