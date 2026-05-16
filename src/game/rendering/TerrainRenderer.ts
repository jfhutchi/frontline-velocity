import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  type Mesh,
} from '@babylonjs/core';
import { COLOR } from '../constants';
import type { BuildingState, MapDecoration, MissionDefinition, ObjectiveZone, SimulationState } from '../types';

export class TerrainRenderer {
  private scene: Scene;
  private shadowGenerator?: ShadowGenerator;
  private meshes: Mesh[] = [];
  private objectiveRing?: Mesh;
  /** Per-building visual roots so we can swap them to rubble on destruction. */
  private buildingVisuals = new Map<string, { mesh: Mesh; rubble?: Mesh; destroyed: boolean }>();

  constructor(scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
  }

  build(mission: MissionDefinition) {
    this.dispose();
    const size = mission.mapSize;
    const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 64 }, this.scene);
    this.addSubtleTerrainHeight(ground);
    const gMat = this.buildGroundMaterial(size);
    ground.material = gMat;
    ground.position.y = 0;
    ground.receiveShadows = true;
    this.meshes.push(ground);

    for (const d of mission.decorations) {
      const m = this.buildDecoration(d);
      if (m) {
        this.meshes.push(m);
        if (d.kind === 'building' && d.destructible) {
          this.buildingVisuals.set(d.id, { mesh: m, destroyed: false });
        }
      }
    }

    this.buildBattlefieldDetails(size);
    this.objectiveRing = this.buildObjectiveRing(mission.objective);
  }

  /**
   * Called each frame by the engine so the terrain renderer can react to
   * structural HP changes — collapsed buildings get swapped to a low rubble
   * mound so the visual matches the simulation/pathing state.
   */
  syncBuildings(state: SimulationState) {
    for (const [id, vis] of this.buildingVisuals) {
      if (vis.destroyed) continue;
      const live = state.buildings.get(id) as BuildingState | undefined;
      if (live && live.isDestroyed) {
        this.collapseBuilding(id, vis, live);
      }
    }
  }

  private collapseBuilding(
    id: string,
    vis: { mesh: Mesh; rubble?: Mesh; destroyed: boolean },
    live: BuildingState,
  ) {
    vis.destroyed = true;
    vis.mesh.dispose(false, true);
    const rubble = MeshBuilder.CreateBox(`rubble_${id}`, {
      width: live.radius * 1.6,
      height: 1.0,
      depth: live.radius * 1.6,
    }, this.scene);
    rubble.position = new Vector3(live.position.x, 0.45, live.position.z);
    rubble.rotation.y = Math.random() * 0.4;
    rubble.scaling.y = 0.6;
    rubble.material = this.material(`rubble_mat_${id}`, { r: 0.32, g: 0.28, b: 0.24 });
    rubble.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster(rubble);
    this.meshes.push(rubble);
    vis.rubble = rubble;
    for (let i = 0; i < 3; i += 1) {
      const chunk = MeshBuilder.CreateBox(`rubble_chunk_${id}_${i}`, {
        width: 0.7 + Math.random() * 0.6,
        height: 0.5 + Math.random() * 0.4,
        depth: 0.7 + Math.random() * 0.6,
      }, this.scene);
      chunk.position = new Vector3(
        live.position.x + (Math.random() - 0.5) * live.radius * 1.2,
        0.35,
        live.position.z + (Math.random() - 0.5) * live.radius * 1.2,
      );
      chunk.rotation.y = Math.random() * Math.PI;
      chunk.rotation.z = (Math.random() - 0.5) * 0.4;
      chunk.material = this.material(`rubble_chunk_mat_${id}_${i}`, { r: 0.36, g: 0.32, b: 0.27 });
      this.shadowGenerator?.addShadowCaster(chunk);
      this.meshes.push(chunk);
    }
  }

  /**
   * Hand-painted dynamic texture for the ground: layered grass/dirt patches and
   * gravel near roads. Avoids relying on any external asset while producing a
   * less flat, more believable battlefield surface.
   */
  private buildGroundMaterial(size: number): StandardMaterial {
    const tex = new DynamicTexture('groundDyn', { width: 1024, height: 1024 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    // Base grass tone.
    ctx.fillStyle = '#3c5230';
    ctx.fillRect(0, 0, 1024, 1024);
    // Scatter darker / lighter grass patches.
    for (let i = 0; i < 1400; i += 1) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 18 + Math.random() * 70;
      const tone = 0.55 + Math.random() * 0.45;
      const r0 = Math.floor(40 + tone * 50);
      const g0 = Math.floor(70 + tone * 60);
      const b0 = Math.floor(32 + tone * 32);
      ctx.fillStyle = `rgba(${r0},${g0},${b0},0.32)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mud/dirt patches.
    for (let i = 0; i < 220; i += 1) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 12 + Math.random() * 48;
      ctx.fillStyle = `rgba(${80 + Math.random() * 26},${60 + Math.random() * 20},${40 + Math.random() * 16},0.42)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gravel/dust streaks roughly along the central cross axes.
    ctx.fillStyle = 'rgba(95,82,60,0.32)';
    ctx.fillRect(490, 0, 44, 1024);
    ctx.fillRect(0, 490, 1024, 44);
    // Speckle noise so it doesn't look like flat colored ovals.
    for (let i = 0; i < 6000; i += 1) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const v = 30 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v},${v + 14},${v - 8},0.25)`;
      ctx.fillRect(x, y, 1, 1);
    }
    tex.update();

    const mat = new StandardMaterial('groundMat', this.scene);
    const tile = Math.max(2, size / 80);
    tex.uScale = tile;
    tex.vScale = tile;
    mat.diffuseTexture = tex;
    mat.diffuseColor = new Color3(1, 1, 1);
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    return mat;
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
    const style = d.buildingStyle ?? 'house';
    const w = d.scale.x;
    const h = d.scale.y;
    const depth = d.scale.z;

    let wallTint = colorVariant(COLOR.building, d.id, 0.06);
    let roofTint = colorVariant(COLOR.buildingRoof, `${d.id}_roof`, 0.09);
    if (style === 'barn') {
      wallTint = colorVariant({ r: 0.45, g: 0.22, b: 0.18 }, d.id, 0.06);
      roofTint = colorVariant({ r: 0.32, g: 0.18, b: 0.14 }, `${d.id}_roof`, 0.05);
    } else if (style === 'factory') {
      wallTint = colorVariant({ r: 0.42, g: 0.4, b: 0.36 }, d.id, 0.05);
      roofTint = colorVariant({ r: 0.18, g: 0.18, b: 0.18 }, `${d.id}_roof`, 0.03);
    } else if (style === 'church') {
      wallTint = colorVariant({ r: 0.68, g: 0.62, b: 0.52 }, d.id, 0.04);
      roofTint = colorVariant({ r: 0.28, g: 0.18, b: 0.13 }, `${d.id}_roof`, 0.04);
    } else if (style === 'bunker') {
      wallTint = colorVariant({ r: 0.36, g: 0.38, b: 0.32 }, d.id, 0.03);
      roofTint = colorVariant({ r: 0.24, g: 0.26, b: 0.22 }, `${d.id}_roof`, 0.03);
    }

    const wall = MeshBuilder.CreateBox(d.id, { width: w, height: h, depth }, this.scene);
    wall.material = this.material(`${d.id}_wall`, wallTint);
    wall.position = new Vector3(d.position.x, h / 2, d.position.z);
    wall.rotation.y = d.rotation;
    this.shadowCaster(wall);

    if (style === 'bunker') {
      // Bunkers are squat, with a flat roof slab and slit windows.
      const top = MeshBuilder.CreateBox(`${d.id}_top`, { width: w + 0.6, height: 0.6, depth: depth + 0.6 }, this.scene);
      top.material = this.material(`${d.id}_topMat`, roofTint);
      top.parent = wall;
      top.position = new Vector3(0, h / 2 + 0.3, 0);
      this.shadowCaster(top);
      const slitMat = this.material(`${d.id}_slitMat`, { r: 0.06, g: 0.06, b: 0.04 });
      slitMat.emissiveColor = new Color3(0.02, 0.02, 0.01);
      for (const zSide of [-1, 1]) {
        const slit = MeshBuilder.CreateBox(`${d.id}_slit_${zSide}`, { width: w * 0.6, height: 0.28, depth: 0.06 }, this.scene);
        slit.material = slitMat;
        slit.parent = wall;
        slit.position = new Vector3(0, 0, zSide * (depth / 2 + 0.04));
      }
      return wall;
    }

    if (style === 'barn') {
      // Big pitched roof barn.
      const roof = MeshBuilder.CreateCylinder(`${d.id}_roof`, {
        diameter: Math.min(w, depth) * 1.15,
        height: w + 0.6,
        tessellation: 3,
      }, this.scene);
      roof.material = this.material(`${d.id}_roofMat`, roofTint);
      roof.parent = wall;
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position = new Vector3(0, h / 2 + Math.min(w, depth) * 0.32, 0);
      this.shadowCaster(roof);
    } else if (style === 'church') {
      const steeple = MeshBuilder.CreateCylinder(`${d.id}_steeple`, {
        diameterTop: 0,
        diameterBottom: 2.4,
        height: h * 0.9,
        tessellation: 6,
      }, this.scene);
      steeple.material = this.material(`${d.id}_steepleMat`, roofTint);
      steeple.parent = wall;
      steeple.position = new Vector3(w * 0.32, h / 2 + h * 0.45, 0);
      this.shadowCaster(steeple);
      const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.4, height: 0.4, depth: depth + 0.4 }, this.scene);
      roof.material = this.material(`${d.id}_roofMat`, roofTint);
      roof.parent = wall;
      roof.position = new Vector3(0, h / 2 + 0.2, 0);
      this.shadowCaster(roof);
    } else if (style === 'factory') {
      const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.3, height: 0.35, depth: depth + 0.3 }, this.scene);
      roof.material = this.material(`${d.id}_roofMat`, roofTint);
      roof.parent = wall;
      roof.position = new Vector3(0, h / 2 + 0.17, 0);
      this.shadowCaster(roof);
      const stack = MeshBuilder.CreateCylinder(`${d.id}_stack`, { diameter: 0.9, height: h * 0.8, tessellation: 8 }, this.scene);
      stack.material = this.material(`${d.id}_stackMat`, { r: 0.16, g: 0.14, b: 0.12 });
      stack.parent = wall;
      stack.position = new Vector3(w * 0.28, h / 2 + h * 0.4, depth * 0.18);
      this.shadowCaster(stack);
    } else {
      const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.7, height: 0.55, depth: depth + 0.7 }, this.scene);
      roof.material = this.material(`${d.id}_roofMat`, roofTint);
      roof.parent = wall;
      roof.position = new Vector3(0, h / 2 + 0.28, 0);
      this.shadowCaster(roof);
    }

    if (style !== 'factory') {
      const door = MeshBuilder.CreateBox(`${d.id}_door`, { width: 1.2, height: 2.0, depth: 0.08 }, this.scene);
      door.material = this.material(`${d.id}_doorMat`, { r: 0.2, g: 0.14, b: 0.09 });
      door.parent = wall;
      door.position = new Vector3(-w * 0.22, -h / 2 + 1.0, depth / 2 + 0.05);
    }

    const windowMat = this.material(`${d.id}_windowMat`, { r: 0.18, g: 0.22, b: 0.2 });
    windowMat.emissiveColor = new Color3(0.05, 0.07, 0.05);
    for (const x of [-w * 0.28, w * 0.28]) {
      for (const zSide of [-1, 1]) {
        const win = MeshBuilder.CreateBox(`${d.id}_win_${x}_${zSide}`, { width: 1.05, height: 0.8, depth: 0.08 }, this.scene);
        win.material = windowMat;
        win.parent = wall;
        win.position = new Vector3(x, 0.25, zSide * (depth / 2 + 0.055));
      }
    }

    if (h > 4.5 && (style === 'house' || style === 'factory')) {
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
      const lower = MeshBuilder.CreateCylinder(`${d.id}_foliage_low`, {
        height: foliageH * 0.58,
        diameterTop: 0.28,
        diameterBottom: 2.65 + d.scale.y * 0.2,
        tessellation: 9,
      }, this.scene);
      lower.material = this.material(`${d.id}_fol_low`, colorVariant(COLOR.treePine, `${d.id}_low`, 0.05));
      lower.parent = trunk;
      lower.position = new Vector3(0, trunkH / 2 + foliageH * 0.24, 0);
      this.shadowCaster(lower);
    } else {
      const diameter = d.tint === 'shrub' ? d.scale.y * 1.55 : 2.0 + d.scale.y * 0.32;
      const foliage = MeshBuilder.CreateSphere(`${d.id}_foliage`, { diameter, segments: 7 }, this.scene);
      const palette = d.tint === 'shrub' ? COLOR.shrub : COLOR.treeOak;
      foliage.material = this.material(`${d.id}_fol`, colorVariant(palette, d.id, 0.05));
      foliage.parent = trunk;
      foliage.scaling.y = d.tint === 'shrub' ? 0.62 : 0.86;
      foliage.position = new Vector3(0, trunkH / 2 + diameter * 0.34, 0);
      this.shadowCaster(foliage);
      if (d.tint !== 'shrub') {
        const offsets = [
          { x: 0.48, z: -0.28, s: 0.64 },
          { x: -0.42, z: 0.34, s: 0.58 },
          { x: 0.12, z: 0.52, s: 0.52 },
        ];
        offsets.forEach((o, i) => {
          const crown = MeshBuilder.CreateSphere(`${d.id}_crown_${i}`, {
            diameter: diameter * o.s,
            segments: 7,
          }, this.scene);
          crown.material = this.material(`${d.id}_crown_mat_${i}`, colorVariant(palette, `${d.id}_${i}`, 0.08));
          crown.parent = trunk;
          crown.scaling.y = 0.72;
          crown.position = new Vector3(o.x * diameter * 0.34, trunkH / 2 + diameter * (0.28 + i * 0.035), o.z * diameter * 0.34);
          this.shadowCaster(crown);
        });
      }
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

  private buildBattlefieldDetails(size: number) {
    const craterMat = this.material('crater_scars_mat', { r: 0.14, g: 0.12, b: 0.09 });
    craterMat.alpha = 0.58;
    craterMat.specularColor = new Color3(0, 0, 0);
    const rimMat = this.material('crater_rim_mat', { r: 0.31, g: 0.25, b: 0.17 });
    rimMat.alpha = 0.5;
    const trackMat = this.material('track_scars_mat', { r: 0.18, g: 0.15, b: 0.1 });
    trackMat.alpha = 0.44;

    const half = size / 2;
    for (let i = 0; i < 22; i += 1) {
      const x = (seeded(i * 11 + 3) * 2 - 1) * (half - 18);
      const z = (seeded(i * 13 + 9) * 2 - 1) * (half - 18);
      if (Math.abs(x) < 12 || Math.abs(z) < 12) continue;
      const diameter = 2.4 + seeded(i * 17 + 2) * 4.6;
      const crater = MeshBuilder.CreateCylinder(`crater_${i}`, {
        diameter,
        height: 0.035,
        tessellation: 24,
      }, this.scene);
      crater.position = new Vector3(x, 0.09, z);
      crater.scaling.x = 0.8 + seeded(i * 5 + 1) * 0.45;
      crater.scaling.z = 0.7 + seeded(i * 7 + 4) * 0.55;
      crater.rotation.y = seeded(i * 19 + 6) * Math.PI;
      crater.material = craterMat;
      this.meshes.push(crater);

      const rim = MeshBuilder.CreateTorus(`crater_rim_${i}`, {
        diameter: diameter * 1.04,
        thickness: 0.1,
        tessellation: 24,
      }, this.scene);
      rim.position = new Vector3(x, 0.12, z);
      rim.scaling.x = crater.scaling.x;
      rim.scaling.z = crater.scaling.z;
      rim.rotation.y = crater.rotation.y;
      rim.material = rimMat;
      this.meshes.push(rim);
    }

    for (let i = 0; i < 14; i += 1) {
      const horizontal = i % 2 === 0;
      const track = MeshBuilder.CreateBox(`mud_track_${i}`, {
        width: horizontal ? 18 + seeded(i + 31) * 18 : 0.38,
        height: 0.025,
        depth: horizontal ? 0.38 : 18 + seeded(i + 41) * 18,
      }, this.scene);
      const lane = (seeded(i * 23 + 5) * 2 - 1) * (half - 26);
      const cross = (seeded(i * 29 + 7) * 2 - 1) * 18;
      track.position = horizontal ? new Vector3(lane, 0.115, cross) : new Vector3(cross, 0.115, lane);
      track.rotation.y = (seeded(i * 37 + 11) - 0.5) * 0.4 + (horizontal ? 0 : Math.PI / 2);
      track.material = trackMat;
      this.meshes.push(track);
    }

    const smokeMat = this.material('ambient_smoke_mat', { r: 0.17, g: 0.17, b: 0.15 });
    smokeMat.alpha = 0.34;
    smokeMat.specularColor = new Color3(0, 0, 0);
    const smokeSources = [
      { x: -12, z: -18, scale: 1.1 },
      { x: 22, z: -24, scale: 0.9 },
      { x: 3, z: 16, scale: 0.75 },
    ];
    smokeSources.forEach((source, sourceIdx) => {
      for (let i = 0; i < 8; i += 1) {
        const puff = MeshBuilder.CreateSphere(`ambient_smoke_${sourceIdx}_${i}`, {
          diameter: (2.4 + i * 0.42) * source.scale,
          segments: 8,
        }, this.scene);
        puff.position = new Vector3(
          source.x + Math.sin(i * 1.7) * (0.45 + i * 0.12),
          2.0 + i * 1.45,
          source.z + Math.cos(i * 1.2) * (0.45 + i * 0.14),
        );
        puff.scaling.y = 0.72 + i * 0.08;
        puff.material = smokeMat;
        this.meshes.push(puff);
      }
    });
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
    this.buildingVisuals.clear();
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

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
