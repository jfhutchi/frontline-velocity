import {
  Color3,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  type Mesh,
} from '@babylonjs/core';
import { COLOR } from '../constants';
import type { MapDecoration, MissionDefinition, ObjectiveZone } from '../types';

export class TerrainRenderer {
  private scene: Scene;
  private shadowGenerator?: ShadowGenerator;
  private meshes: Mesh[] = [];
  private objectiveRing?: Mesh;

  constructor(scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  build(mission: MissionDefinition) {
    this.dispose();
    const size = mission.mapSize;
    const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 48 }, this.scene);
    this.addSubtleTerrainHeight(ground);
    const gMat = this.material('groundMat', COLOR.ground);
    gMat.diffuseColor = new Color3(0.3, 0.41, 0.27);
    ground.material = gMat;
    ground.position.y = 0;
    ground.receiveShadows = true;
    this.meshes.push(ground);

    for (const d of mission.decorations) {
      const m = this.buildDecoration(d);
      if (m) this.meshes.push(m);
    }

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
    const ring = MeshBuilder.CreateTorus('objective', { diameter: o.radius * 2, thickness: 0.35, tessellation: 72 }, this.scene);
    ring.position = new Vector3(o.position.x, 0.12, o.position.z);
    const mat = this.material('objectiveMat', COLOR.objective);
    mat.emissiveColor = new Color3(0.7, 0.55, 0.2);
    mat.alpha = 0.78;
    ring.material = mat;
    this.meshes.push(ring);

    const fill = MeshBuilder.CreateDisc('objective_fill', { radius: o.radius * 0.95, tessellation: 48 }, this.scene);
    fill.rotation.x = Math.PI / 2;
    fill.position = new Vector3(o.position.x, 0.065, o.position.z);
    const fillMat = this.material('objectiveFillMat', { r: 0.65, g: 0.48, b: 0.16 });
    fillMat.alpha = 0.22;
    fill.material = fillMat;
    this.meshes.push(fill);

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const sandbag = MeshBuilder.CreateCylinder(`sandbag_${i}`, { diameter: 0.55, height: 3.0, tessellation: 8 }, this.scene);
      sandbag.position = new Vector3(Math.sin(angle) * (o.radius + 1.2), 0.32, Math.cos(angle) * (o.radius + 1.2));
      sandbag.position.x += o.position.x;
      sandbag.position.z += o.position.z;
      sandbag.rotation.z = Math.PI / 2;
      sandbag.rotation.y = angle;
      sandbag.material = this.material(`sandbag_mat_${i}`, COLOR.sandbag);
      this.shadowCaster(sandbag);
      this.meshes.push(sandbag);
    }

    for (let i = 0; i < 5; i += 1) {
      const crate = MeshBuilder.CreateBox(`objective_crate_${i}`, { width: 1.4, height: 1.1, depth: 1.4 }, this.scene);
      crate.position = new Vector3(o.position.x - 4 + i * 2, 0.55, o.position.z + 7.4 + (i % 2) * 1.2);
      crate.rotation.y = i * 0.35;
      crate.material = this.material(`crate_mat_${i}`, { r: 0.38, g: 0.28, b: 0.17 });
      this.shadowCaster(crate);
      this.meshes.push(crate);
    }
    return ring;
  }

  private buildDecoration(d: MapDecoration): Mesh | null {
    switch (d.kind) {
      case 'road':
        return this.buildRoad(d);
      case 'fieldPatch':
        return this.buildFieldPatch(d);
      case 'building':
        return this.buildBuilding(d);
      case 'tree':
        return this.buildTree(d);
      case 'hill':
        return this.buildHill(d);
      default:
        return null;
    }
  }

  private buildRoad(d: MapDecoration): Mesh {
    const center = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: d.scale.y, depth: d.scale.z }, this.scene);
    center.position = new Vector3(d.position.x, d.scale.y / 2 + 0.002, d.position.z);
    center.rotation.y = d.rotation;
    center.material = this.material(`${d.id}_mat`, COLOR.road);

    const horizontal = d.scale.x >= d.scale.z;
    const shoulderMat = this.material(`${d.id}_shoulderMat`, COLOR.roadShoulder);
    for (const side of [-1, 1]) {
      const shoulder = MeshBuilder.CreateBox(`${d.id}_shoulder_${side}`, {
        width: horizontal ? d.scale.x : 2.4,
        height: 0.035,
        depth: horizontal ? 2.4 : d.scale.z,
      }, this.scene);
      shoulder.parent = center;
      shoulder.position = horizontal
        ? new Vector3(0, 0.002, side * (d.scale.z / 2 + 1.2))
        : new Vector3(side * (d.scale.x / 2 + 1.2), 0.002, 0);
      shoulder.material = shoulderMat;
    }

    const dirtMat = this.material(`${d.id}_wornMat`, COLOR.dirt);
    for (let i = 0; i < 14; i += 1) {
      const patch = MeshBuilder.CreateBox(`${d.id}_wear_${i}`, {
        width: horizontal ? 3.5 + (i % 3) : 0.9,
        height: 0.04,
        depth: horizontal ? 0.85 : 3.5 + (i % 3),
      }, this.scene);
      patch.parent = center;
      const lane = -0.35 + (i % 2) * 0.7;
      const along = -0.45 + i / 13;
      patch.position = horizontal
        ? new Vector3((along - 0.5) * d.scale.x, 0.006, lane * d.scale.z)
        : new Vector3(lane * d.scale.x, 0.006, (along - 0.5) * d.scale.z);
      patch.material = dirtMat;
    }
    return center;
  }

  private buildFieldPatch(d: MapDecoration): Mesh {
    const m = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.035, depth: d.scale.z }, this.scene);
    m.position = new Vector3(d.position.x, 0.035, d.position.z);
    m.rotation.y = d.rotation;
    const mat = this.material(`${d.id}_mat`, d.tint === 'dirt' ? COLOR.dirt : COLOR.fieldPatch);
    mat.alpha = 0.86;
    m.material = mat;

    const furrowMat = this.material(`${d.id}_furrow`, { r: 0.29, g: 0.27, b: 0.16 });
    for (let i = -2; i <= 2; i += 1) {
      const furrow = MeshBuilder.CreateBox(`${d.id}_furrow_${i}`, { width: d.scale.x * 0.9, height: 0.02, depth: 0.18 }, this.scene);
      furrow.parent = m;
      furrow.position = new Vector3(0, 0.024, i * (d.scale.z / 6));
      furrow.material = furrowMat;
    }
    return m;
  }

  private buildBuilding(d: MapDecoration): Mesh {
    const w = d.scale.x;
    const h = d.scale.y;
    const depth = d.scale.z;
    const wall = MeshBuilder.CreateBox(d.id, { width: w, height: h, depth }, this.scene);
    wall.material = this.material(`${d.id}_wall`, colorVariant(COLOR.building, d.id, 0.06));
    wall.position = new Vector3(d.position.x, h / 2, d.position.z);
    wall.rotation.y = d.rotation;
    this.shadowCaster(wall);

    const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.7, height: 0.55, depth: depth + 0.7 }, this.scene);
    roof.material = this.material(`${d.id}_roofMat`, colorVariant(COLOR.buildingRoof, `${d.id}_roof`, 0.09));
    roof.parent = wall;
    roof.position = new Vector3(0, h / 2 + 0.28, 0);
    this.shadowCaster(roof);

    const door = MeshBuilder.CreateBox(`${d.id}_door`, { width: 1.2, height: 2.0, depth: 0.08 }, this.scene);
    door.material = this.material(`${d.id}_doorMat`, { r: 0.2, g: 0.14, b: 0.09 });
    door.parent = wall;
    door.position = new Vector3(-w * 0.22, -h / 2 + 1.0, depth / 2 + 0.05);

    const windowMat = this.material(`${d.id}_windowMat`, { r: 0.18, g: 0.22, b: 0.2 });
    windowMat.emissiveColor = new Color3(0.04, 0.06, 0.04);
    for (const x of [-w * 0.28, w * 0.28]) {
      for (const zSide of [-1, 1]) {
        const win = MeshBuilder.CreateBox(`${d.id}_win_${x}_${zSide}`, { width: 1.05, height: 0.8, depth: 0.08 }, this.scene);
        win.material = windowMat;
        win.parent = wall;
        win.position = new Vector3(x, 0.25, zSide * (depth / 2 + 0.055));
      }
    }

    if (h > 4.5) {
      const chimney = MeshBuilder.CreateBox(`${d.id}_chimney`, { width: 0.7, height: 1.1, depth: 0.7 }, this.scene);
      chimney.material = this.material(`${d.id}_chimneyMat`, { r: 0.28, g: 0.2, b: 0.16 });
      chimney.parent = wall;
      chimney.position = new Vector3(w * 0.24, h / 2 + 1.0, -depth * 0.18);
      this.shadowCaster(chimney);
    }
    return wall;
  }

  private buildTree(d: MapDecoration): Mesh {
    const trunkH = d.tint === 'shrub' ? 0.28 : Math.max(0.6, d.scale.y * 0.38);
    const trunkDiameter = d.tint === 'shrub' ? 0.18 : 0.42 + d.scale.y * 0.035;
    const trunk = MeshBuilder.CreateCylinder(d.id, { height: trunkH, diameter: trunkDiameter, tessellation: 8 }, this.scene);
    trunk.material = this.material(`${d.id}_trunk`, COLOR.treeTrunk);
    trunk.position = new Vector3(d.position.x, trunkH / 2, d.position.z);
    trunk.rotation.y = d.rotation;
    this.shadowCaster(trunk);

    if (d.tint === 'pine') {
      const foliageH = d.scale.y * 0.82;
      const foliage = MeshBuilder.CreateCylinder(`${d.id}_foliage`, {
        height: foliageH,
        diameterTop: 0.18,
        diameterBottom: 2.15 + d.scale.y * 0.16,
        tessellation: 8,
      }, this.scene);
      foliage.material = this.material(`${d.id}_fol`, colorVariant(COLOR.treePine, d.id, 0.04));
      foliage.parent = trunk;
      foliage.position = new Vector3(0, trunkH / 2 + foliageH / 2 - 0.18, 0);
      this.shadowCaster(foliage);
    } else {
      const diameter = d.tint === 'shrub' ? d.scale.y * 1.55 : 2.0 + d.scale.y * 0.32;
      const foliage = MeshBuilder.CreateSphere(`${d.id}_foliage`, { diameter, segments: 7 }, this.scene);
      const palette = d.tint === 'shrub' ? COLOR.shrub : COLOR.treeOak;
      foliage.material = this.material(`${d.id}_fol`, colorVariant(palette, d.id, 0.05));
      foliage.parent = trunk;
      foliage.scaling.y = d.tint === 'shrub' ? 0.62 : 0.86;
      foliage.position = new Vector3(0, trunkH / 2 + diameter * 0.34, 0);
      this.shadowCaster(foliage);
    }
    return trunk;
  }

  private buildHill(d: MapDecoration): Mesh {
    const m = MeshBuilder.CreateSphere(d.id, { diameter: d.scale.x, segments: 12 }, this.scene);
    m.scaling = new Vector3(1, d.scale.y / d.scale.x, 1);
    m.position = new Vector3(d.position.x, -d.scale.y * 0.36, d.position.z);
    m.material = this.material(`${d.id}_mat`, colorVariant(COLOR.hill, d.id, 0.04));
    m.receiveShadows = true;
    return m;
  }

  private addSubtleTerrainHeight(ground: Mesh) {
    const positions = ground.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const roadMask = Math.abs(x) < 7 || Math.abs(z) < 7 ? 0.18 : 1;
      positions[i + 1] =
        (Math.sin(x * 0.09) * 0.22 + Math.cos(z * 0.075) * 0.18 + Math.sin((x + z) * 0.045) * 0.16) *
        roadMask;
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.refreshBoundingInfo();
  }

  private material(name: string, c: { r: number; g: number; b: number }): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = new Color3(c.r, c.g, c.b);
    mat.specularColor = new Color3(0.015, 0.015, 0.012);
    return mat;
  }

  private shadowCaster(mesh: Mesh) {
    mesh.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster(mesh);
  }

  dispose() {
    for (const m of this.meshes) {
      m.dispose(false, true);
    }
    this.meshes = [];
    this.objectiveRing = undefined;
  }
}

function colorVariant(c: { r: number; g: number; b: number }, seed: string, amount: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  const t = ((hash % 100) / 100 - 0.5) * amount;
  return {
    r: Math.max(0, Math.min(1, c.r + t)),
    g: Math.max(0, Math.min(1, c.g + t)),
    b: Math.max(0, Math.min(1, c.b + t)),
  };
}
