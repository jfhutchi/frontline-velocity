import {
  Color3,
  Color4,
  DynamicTexture,
  Matrix,
  MeshBuilder,
  PBRMaterial,
  ParticleSystem,
  Quaternion,
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
  private particleSystems: ParticleSystem[] = [];
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
    const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 96 }, this.scene);
    this.addSubtleTerrainHeight(ground);
    const gMat = this.buildGroundMaterial(size);
    ground.material = gMat;
    ground.position.y = 0;
    ground.receiveShadows = true;
    this.meshes.push(ground);

    const treeDecs: MapDecoration[] = [];
    for (const d of mission.decorations) {
      if (d.kind === 'tree') {
        treeDecs.push(d);
        continue;
      }
      const m = this.buildDecoration(d);
      if (m) {
        this.meshes.push(m);
        if (d.kind === 'building' && d.destructible) {
          this.buildingVisuals.set(d.id, { mesh: m, destroyed: false });
        }
      }
    }
    this.buildTreeInstances(treeDecs);

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
  private buildGroundMaterial(size: number): PBRMaterial {
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

    const mat = new PBRMaterial('groundMat', this.scene);
    const tile = Math.max(2, size / 80);
    tex.uScale = tile;
    tex.vScale = tile;
    mat.albedoTexture = tex;
    mat.albedoColor = new Color3(1, 1, 1);
    mat.metallic = 0;
    mat.roughness = 0.95;
    return mat;
  }

  updateObjective(objective: ObjectiveZone) {
    if (!this.objectiveRing) return;
    const mat = this.objectiveRing.material as PBRMaterial | null;
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
        return null; // handled via thin instances in buildTreeInstances()
      case 'hill':
        return this.buildHill(d);
      case 'hedgerow':
        return this.buildHedgerow(d);
      case 'stoneWall':
        return this.buildStoneWall(d);
      case 'fence':
        return this.buildFence(d);
      case 'roadSign':
        return this.buildRoadSign(d);
      default:
        return null;
    }
  }

  private buildRoad(d: MapDecoration): Mesh {
    const center = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: d.scale.y, depth: d.scale.z }, this.scene);
    center.position = new Vector3(d.position.x, d.scale.y / 2 + 0.002, d.position.z);
    center.rotation.y = d.rotation;
    center.material = this.material(`${d.id}_mat`, d.tint === 'dirt' ? colorVariant(COLOR.dirt, d.id, 0.035) : COLOR.road);

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
    for (let i = 0; i < 18; i += 1) {
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
    const rutMat = this.material(`${d.id}_rutMat`, { r: 0.13, g: 0.12, b: 0.1 });
    rutMat.alpha = 0.48;
    for (const lane of [-0.23, 0.23]) {
      const rut = MeshBuilder.CreateBox(`${d.id}_rut_${lane}`, {
        width: horizontal ? d.scale.x * 0.96 : 0.16,
        height: 0.022,
        depth: horizontal ? 0.16 : d.scale.z * 0.96,
      }, this.scene);
      rut.parent = center;
      rut.position = horizontal
        ? new Vector3(0, 0.016, lane * d.scale.z)
        : new Vector3(lane * d.scale.x, 0.016, 0);
      rut.material = rutMat;
    }
    const gravelMat = this.material(`${d.id}_gravelMat`, { r: 0.46, g: 0.39, b: 0.29 });
    for (let i = 0; i < 14; i += 1) {
      const gravel = MeshBuilder.CreateBox(`${d.id}_edge_gravel_${i}`, {
        width: 0.18 + seeded(i * 7 + d.position.x) * 0.26,
        height: 0.035,
        depth: 0.18 + seeded(i * 11 + d.position.z) * 0.24,
      }, this.scene);
      gravel.parent = center;
      const side = i % 2 === 0 ? -1 : 1;
      const t = seeded(i * 17 + d.scale.x);
      gravel.position = horizontal
        ? new Vector3((t - 0.5) * d.scale.x, 0.026, side * (d.scale.z * 0.5 + seeded(i * 23 + 4) * 1.4))
        : new Vector3(side * (d.scale.x * 0.5 + seeded(i * 23 + 4) * 1.4), 0.026, (t - 0.5) * d.scale.z);
      gravel.material = gravelMat;
    }
    const crownMat = this.material(`${d.id}_crownMat`, d.tint === 'dirt' ? { r: 0.48, g: 0.38, b: 0.24 } : { r: 0.18, g: 0.18, b: 0.16 });
    crownMat.alpha = d.tint === 'dirt' ? 0.32 : 0.22;
    const crown = MeshBuilder.CreateBox(`${d.id}_crown`, {
      width: horizontal ? d.scale.x * 0.96 : 0.26,
      height: 0.022,
      depth: horizontal ? 0.26 : d.scale.z * 0.96,
    }, this.scene);
    crown.parent = center;
    crown.position.y = 0.012;
    crown.material = crownMat;
    return center;
  }

  private buildFieldPatch(d: MapDecoration): Mesh {
    const m = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.035, depth: d.scale.z }, this.scene);
    m.position = new Vector3(d.position.x, 0.035, d.position.z);
    m.rotation.y = d.rotation;
    const isCropSetPiece = d.id.startsWith('crop_setpiece') || Math.abs(d.position.z) > 48;
    const mat = this.material(
      `${d.id}_mat`,
      d.tint === 'dirt' ? COLOR.dirt : isCropSetPiece ? { r: 0.36, g: 0.34, b: 0.17 } : COLOR.fieldPatch,
    );
    mat.alpha = 0.86;
    m.material = mat;

    const furrowMat = this.material(`${d.id}_furrow`, isCropSetPiece ? { r: 0.48, g: 0.41, b: 0.2 } : { r: 0.29, g: 0.27, b: 0.16 });
    const rowCount = isCropSetPiece ? Math.max(8, Math.floor(d.scale.z / 2.2)) : 5;
    for (let i = 0; i < rowCount; i += 1) {
      const t = rowCount === 1 ? 0.5 : i / (rowCount - 1);
      const rowZ = (t - 0.5) * d.scale.z * 0.86;
      const furrow = MeshBuilder.CreateBox(`${d.id}_furrow_${i}`, {
        width: d.scale.x * 0.9,
        height: isCropSetPiece ? 0.08 : 0.02,
        depth: isCropSetPiece ? 0.1 : 0.18,
      }, this.scene);
      furrow.parent = m;
      furrow.position = new Vector3(0, isCropSetPiece ? 0.075 : 0.024, rowZ);
      furrow.material = furrowMat;
    }
    if (isCropSetPiece) {
      const wheatMat = this.material(`${d.id}_wheat`, { r: 0.54, g: 0.46, b: 0.21 });
      const strawMat = this.material(`${d.id}_straw`, { r: 0.43, g: 0.34, b: 0.16 });
      for (let i = 0; i < 44; i += 1) {
        const clump = MeshBuilder.CreateBox(`${d.id}_wheat_clump_${i}`, {
          width: 0.18,
          height: 0.9 + seeded(i * 11 + d.position.x) * 0.34,
          depth: 0.12,
        }, this.scene);
        clump.parent = m;
        clump.position = new Vector3(
          (seeded(i * 19 + 4) - 0.5) * d.scale.x * 0.9,
          0.44,
          (seeded(i * 23 + 9) - 0.5) * d.scale.z * 0.88,
        );
        clump.rotation.z = (seeded(i * 31 + 3) - 0.5) * 0.28;
        clump.material = i % 3 === 0 ? strawMat : wheatMat;
      }
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
      wallTint = colorVariant({ r: 0.36, g: 0.24, b: 0.18 }, d.id, 0.05);
      roofTint = colorVariant({ r: 0.17, g: 0.1, b: 0.075 }, `${d.id}_roof`, 0.03);
    } else if (style === 'factory') {
      wallTint = colorVariant({ r: 0.42, g: 0.4, b: 0.36 }, d.id, 0.05);
      roofTint = colorVariant({ r: 0.18, g: 0.18, b: 0.18 }, `${d.id}_roof`, 0.03);
    } else if (style === 'church') {
      wallTint = colorVariant({ r: 0.61, g: 0.55, b: 0.45 }, d.id, 0.035);
      roofTint = colorVariant({ r: 0.14, g: 0.09, b: 0.07 }, `${d.id}_roof`, 0.025);
    } else if (style === 'bunker') {
      wallTint = colorVariant({ r: 0.36, g: 0.38, b: 0.32 }, d.id, 0.03);
      roofTint = colorVariant({ r: 0.24, g: 0.26, b: 0.22 }, `${d.id}_roof`, 0.03);
    }

    const wall = MeshBuilder.CreateBox(d.id, { width: w, height: h, depth }, this.scene);
    wall.material = this.surfaceMaterial(`${d.id}_wall`, wallTint, 'wall');
    wall.position = new Vector3(d.position.x, h / 2, d.position.z);
    wall.rotation.y = d.rotation;
    this.shadowCaster(wall);

    if (style === 'bunker') {
      // Bunkers are squat, with a flat roof slab and slit windows.
      const top = MeshBuilder.CreateBox(`${d.id}_top`, { width: w + 0.6, height: 0.6, depth: depth + 0.6 }, this.scene);
      top.material = this.surfaceMaterial(`${d.id}_topMat`, roofTint, 'roof');
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
      // Pitched-roof barn. The 3-tessellation cylinder is an equilateral
      // triangular prism, which without correction makes the peak rise nearly
      // a full footprint above the eaves and visually dwarfs the walls.
      // Squash the cross-section vertically (`scaling.y`) and tuck the base
      // back down so it still rests on the wall top.
      const ROOF_PITCH_Y = 0.48;
      const span = Math.min(w, depth);
      const roof = MeshBuilder.CreateCylinder(`${d.id}_roof`, {
        diameter: span * 1.15,
        height: w + 0.6,
        tessellation: 3,
      }, this.scene);
      roof.material = this.surfaceMaterial(`${d.id}_roofMat`, roofTint, 'roof');
      roof.parent = wall;
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scaling.y = ROOF_PITCH_Y;
      // Base of the squashed prism sits on the wall top: offset = r/2 * scaling.y
      // where r = diameter / 2.
      roof.position = new Vector3(0, h / 2 + (span * 1.15 * 0.25) * ROOF_PITCH_Y, 0);
      this.shadowCaster(roof);
    } else if (style === 'church') {
      const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.4, height: 0.4, depth: depth + 0.4 }, this.scene);
      roof.material = this.surfaceMaterial(`${d.id}_roofMat`, roofTint, 'roof');
      roof.parent = wall;
      roof.position = new Vector3(0, h / 2 + 0.2, 0);
      this.shadowCaster(roof);
      const tower = MeshBuilder.CreateBox(`${d.id}_tower`, {
        width: Math.min(3.0, w * 0.42),
        height: h * 1.25,
        depth: Math.min(3.1, depth * 0.48),
      }, this.scene);
      tower.material = this.material(`${d.id}_towerMat`, colorVariant(wallTint, `${d.id}_tower`, 0.035));
      tower.parent = wall;
      tower.position = new Vector3(-w * 0.22, h * 0.125, depth * 0.02);
      this.shadowCaster(tower);
      const belfry = MeshBuilder.CreateBox(`${d.id}_belfry`, {
        width: Math.min(2.65, w * 0.36),
        height: h * 0.34,
        depth: Math.min(2.8, depth * 0.42),
      }, this.scene);
      belfry.material = this.material(`${d.id}_belfryMat`, colorVariant(wallTint, `${d.id}_belfry`, 0.02));
      belfry.parent = tower;
      belfry.position = new Vector3(0, h * 0.72, 0);
      this.shadowCaster(belfry);
      const steeple = MeshBuilder.CreateCylinder(`${d.id}_steeple`, {
        diameterTop: 0,
        diameterBottom: 2.8,
        height: h * 1.1,
        tessellation: 6,
      }, this.scene);
      steeple.material = this.surfaceMaterial(`${d.id}_steepleMat`, roofTint, 'roof');
      steeple.parent = tower;
      steeple.position = new Vector3(0, h * 1.18, 0);
      this.shadowCaster(steeple);
      const archMat = this.material(`${d.id}_archMat`, { r: 0.13, g: 0.13, b: 0.11 });
      for (const side of [-1, 1]) {
        const arch = MeshBuilder.CreateBox(`${d.id}_tower_arch_${side}`, { width: 0.7, height: 1.05, depth: 0.08 }, this.scene);
        arch.material = archMat;
        arch.parent = tower;
        arch.position = new Vector3(0, h * 0.68, side * (Math.min(3.1, depth * 0.48) / 2 + 0.05));
      }
    } else if (style === 'factory') {
      const roof = MeshBuilder.CreateBox(`${d.id}_roof`, { width: w + 0.3, height: 0.35, depth: depth + 0.3 }, this.scene);
      roof.material = this.surfaceMaterial(`${d.id}_roofMat`, roofTint, 'roof');
      roof.parent = wall;
      roof.position = new Vector3(0, h / 2 + 0.17, 0);
      this.shadowCaster(roof);
      const stack = MeshBuilder.CreateCylinder(`${d.id}_stack`, { diameter: 0.9, height: h * 0.8, tessellation: 8 }, this.scene);
      stack.material = this.material(`${d.id}_stackMat`, { r: 0.16, g: 0.14, b: 0.12 });
      stack.parent = wall;
      stack.position = new Vector3(w * 0.28, h / 2 + h * 0.4, depth * 0.18);
      this.shadowCaster(stack);
    } else {
      // House pitched roof — same equilateral-triangle prism technique as
      // the barn, just slightly shallower so houses read distinct from barns.
      const ROOF_PITCH_Y = 0.42;
      const span = Math.min(w, depth);
      const roof = MeshBuilder.CreateCylinder(`${d.id}_roof`, {
        diameter: span * 1.12,
        height: w + 0.75,
        tessellation: 3,
      }, this.scene);
      roof.material = this.surfaceMaterial(`${d.id}_roofMat`, roofTint, 'roof');
      roof.parent = wall;
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scaling.y = ROOF_PITCH_Y;
      roof.position = new Vector3(0, h / 2 + (span * 1.12 * 0.25) * ROOF_PITCH_Y, 0);
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

    const trimMat = this.material(`${d.id}_trimMat`, { r: 0.76, g: 0.7, b: 0.58 });
    const baseMat = this.material(`${d.id}_foundationMat`, colorVariant(COLOR.stoneWall, `${d.id}_foundation`, 0.04));
    const foundation = MeshBuilder.CreateBox(`${d.id}_foundation`, { width: w + 0.16, height: 0.42, depth: depth + 0.16 }, this.scene);
    foundation.material = baseMat;
    foundation.parent = wall;
    foundation.position = new Vector3(0, -h / 2 + 0.22, 0);
    for (const zSide of [-1, 1]) {
      for (const x of [-w * 0.28, w * 0.28]) {
        const lintel = MeshBuilder.CreateBox(`${d.id}_lintel_${x}_${zSide}`, { width: 1.32, height: 0.12, depth: 0.1 }, this.scene);
        lintel.material = trimMat;
        lintel.parent = wall;
        lintel.position = new Vector3(x, 0.74, zSide * (depth / 2 + 0.075));
        const sill = MeshBuilder.CreateBox(`${d.id}_sill_${x}_${zSide}`, { width: 1.18, height: 0.1, depth: 0.12 }, this.scene);
        sill.material = trimMat;
        sill.parent = wall;
        sill.position = new Vector3(x, -0.2, zSide * (depth / 2 + 0.08));
      }
    }
    if (style === 'house' || style === 'church') {
      const dormerMat = this.material(`${d.id}_dormerMat`, wallTint);
      for (const x of [-w * 0.18, w * 0.18]) {
        const dormer = MeshBuilder.CreateBox(`${d.id}_dormer_${x}`, { width: 0.9, height: 0.65, depth: 0.58 }, this.scene);
        dormer.material = dormerMat;
        dormer.parent = wall;
        dormer.position = new Vector3(x, h / 2 + 0.55, depth * 0.18);
        this.shadowCaster(dormer);
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

  /**
   * Replace ~330 individual tree meshes with 7 archetype meshes driven by
   * ThinInstances. Each archetype is built at a representative scale and each
   * instance matrix encodes the per-tree position, rotation, and size.
   *
   * Before: ~55 pines×3 + ~30 oaks×5 + ~20 shrubs×2 ≈ 330 draw calls from trees.
   * After: 3 pine + 2 oak + 2 shrub = 7 draw calls regardless of tree count.
   */
  private buildTreeInstances(trees: MapDecoration[]) {
    if (!trees.length) return;
    const pines = trees.filter((t) => t.tint === 'pine');
    const oaks = trees.filter((t) => t.tint === 'oak');
    const shrubs = trees.filter((t) => t.tint === 'shrub');
    if (pines.length) this.buildPineThinInstances(pines);
    if (oaks.length) this.buildOakThinInstances(oaks);
    if (shrubs.length) this.buildShrubThinInstances(shrubs);
  }

  /**
   * Build the per-instance matrix buffer for a set of tree decorations.
   * scaleMode: 'yOnly' applies Scale(1, sy/ref, 1); 'uniform' applies Scale(k,k,k).
   */
  private treeMatrices(
    trees: MapDecoration[],
    scaleMode: 'yOnly' | 'uniform',
    refSy: number,
  ): Float32Array {
    const buf = new Float32Array(trees.length * 16);
    const tmp = Matrix.Identity();
    trees.forEach((d, i) => {
      const k = d.scale.y / refSy;
      const scale = scaleMode === 'yOnly' ? new Vector3(1, k, 1) : new Vector3(k, k, k);
      Matrix.ComposeToRef(
        scale,
        Quaternion.RotationYawPitchRoll(d.rotation, 0, 0),
        new Vector3(d.position.x, 0, d.position.z),
        tmp,
      );
      tmp.copyToArray(buf, i * 16);
    });
    return buf;
  }

  /** Register a mesh as a thin-instanced archetype, baking a Y-center lift into vertices. */
  private thinArch(mesh: Mesh, mat: PBRMaterial, yCenter: number, matrices: Float32Array): Mesh {
    mesh.material = mat;
    mesh.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster(mesh);
    if (yCenter !== 0) mesh.bakeTransformIntoVertices(Matrix.Translation(0, yCenter, 0));
    mesh.thinInstanceSetBuffer('matrix', matrices, 16);
    this.meshes.push(mesh);
    return mesh;
  }

  private buildPineThinInstances(trees: MapDecoration[]) {
    // Archetype at sy = 4 (representative mid-point of the 3–5.5 sy range).
    // Per-instance scale: Scale(1, sy/4, 1) → trunk height and foliage position
    // scale nearly linearly with sy, error < 0.1 units at the extremes.
    const REF = 4.0;
    const trunkH = REF * 0.38;            // 1.52
    const foliageH = REF * 0.82;          // 3.28
    const lowerH = foliageH * 0.58;       // 1.9024
    const fUpperY = trunkH + foliageH / 2 - 0.18;  // 2.98
    const fLowerY = trunkH + foliageH * 0.24;       // 2.3072
    const mats = this.treeMatrices(trees, 'yOnly', REF);
    const trunkMat = this.material('pine_trunk_mat', COLOR.treeTrunk);
    const folMat = this.material('pine_fol_mat', COLOR.treePine);
    const folLowMat = this.material('pine_fol_low_mat', colorVariant(COLOR.treePine, 'pine_low', 0.045));
    this.thinArch(
      MeshBuilder.CreateCylinder('pine_trunk_arch', { height: trunkH, diameter: 0.42 + REF * 0.035, tessellation: 8 }, this.scene),
      trunkMat, trunkH / 2, mats,
    );
    this.thinArch(
      MeshBuilder.CreateCylinder('pine_fol_upper_arch', { height: foliageH, diameterTop: 0.18, diameterBottom: 2.15 + REF * 0.16, tessellation: 8 }, this.scene),
      folMat, fUpperY, mats,
    );
    this.thinArch(
      MeshBuilder.CreateCylinder('pine_fol_lower_arch', { height: lowerH, diameterTop: 0.28, diameterBottom: 2.65 + REF * 0.2, tessellation: 9 }, this.scene),
      folLowMat, fLowerY, mats,
    );
  }

  private buildOakThinInstances(trees: MapDecoration[]) {
    // Archetype at sy = 4; uniform Scale(sy/4, sy/4, sy/4) per instance.
    // Position error ≤ 0.25 units at the sy extremes — imperceptible from tactical altitude.
    const REF = 4.0;
    const trunkH = Math.max(0.6, REF * 0.38);  // 1.52
    const trunkDiam = 0.42 + REF * 0.035;       // 0.56
    const diam = 2.0 + REF * 0.32;              // 3.28
    const foliageY = trunkH / 2 + diam * 0.34;  // 1.875
    const mats = this.treeMatrices(trees, 'uniform', REF);
    const trunkMat = this.material('oak_trunk_mat', COLOR.treeTrunk);
    const folMat = this.material('oak_fol_mat', COLOR.treeOak);
    this.thinArch(
      MeshBuilder.CreateCylinder('oak_trunk_arch', { height: trunkH, diameter: trunkDiam, tessellation: 8 }, this.scene),
      trunkMat, trunkH / 2, mats,
    );
    // Bake the Y-flattening (scaling.y=0.86) and foliage offset together.
    const fMesh = MeshBuilder.CreateSphere('oak_fol_arch', { diameter: diam, segments: 7 }, this.scene);
    fMesh.scaling.y = 0.86;
    fMesh.position.y = foliageY;
    fMesh.bakeCurrentTransformIntoVertices();
    fMesh.scaling = Vector3.One();
    fMesh.position = Vector3.Zero();
    this.thinArch(fMesh, folMat, 0, mats);
  }

  private buildShrubThinInstances(trees: MapDecoration[]) {
    // Shrub sy range: 1.1–1.9 → use REF = 1.5; uniform scale so the whole shrub scales.
    const REF = 1.5;
    const trunkH = 0.28;
    const sphereDiam = REF * 1.55;             // 2.325
    const foliageY = trunkH / 2 + sphereDiam * 0.34;  // 0.93
    const mats = this.treeMatrices(trees, 'uniform', REF);
    const trunkMat = this.material('shrub_trunk_mat', COLOR.treeTrunk);
    const folMat = this.material('shrub_fol_mat', COLOR.shrub);
    this.thinArch(
      MeshBuilder.CreateCylinder('shrub_trunk_arch', { height: trunkH, diameter: 0.18, tessellation: 8 }, this.scene),
      trunkMat, trunkH / 2, mats,
    );
    const fMesh = MeshBuilder.CreateSphere('shrub_fol_arch', { diameter: sphereDiam, segments: 7 }, this.scene);
    fMesh.scaling.y = 0.62;
    fMesh.position.y = foliageY;
    fMesh.bakeCurrentTransformIntoVertices();
    fMesh.scaling = Vector3.One();
    fMesh.position = Vector3.Zero();
    this.thinArch(fMesh, folMat, 0, mats);
  }

  private buildHill(d: MapDecoration): Mesh {
    const m = MeshBuilder.CreateSphere(d.id, { diameter: d.scale.x, segments: 12 }, this.scene);
    m.scaling = new Vector3(1, d.scale.y / d.scale.x, 1);
    m.position = new Vector3(d.position.x, -d.scale.y * 0.36, d.position.z);
    m.material = this.material(`${d.id}_mat`, colorVariant(COLOR.hill, d.id, 0.04));
    m.receiveShadows = true;
    return m;
  }

  private buildHedgerow(d: MapDecoration): Mesh {
    const root = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.28, depth: d.scale.z }, this.scene);
    root.position = new Vector3(d.position.x, 0.18, d.position.z);
    root.rotation.y = d.rotation;
    root.material = this.material(`${d.id}_base`, { r: 0.11, g: 0.19, b: 0.08 });
    root.receiveShadows = true;
    const clumpCount = Math.max(5, Math.floor(d.scale.x / 4));
    for (let i = 0; i < clumpCount; i += 1) {
      const t = clumpCount === 1 ? 0.5 : i / (clumpCount - 1);
      const bush = MeshBuilder.CreateSphere(`${d.id}_bush_${i}`, {
        diameter: 1.75 + seeded(i * 17 + d.position.x) * 0.8,
        segments: 7,
      }, this.scene);
      bush.parent = root;
      bush.position = new Vector3(
        (t - 0.5) * d.scale.x,
        0.48 + seeded(i * 13 + 4) * 0.22,
        (seeded(i * 19 + 2) - 0.5) * d.scale.z * 0.7,
      );
      bush.scaling.y = 0.62 + seeded(i * 11 + 6) * 0.28;
      bush.material = this.material(`${d.id}_bushMat_${i}`, colorVariant(COLOR.hedge, `${d.id}_${i}`, 0.07));
      this.shadowCaster(bush);
    }
    return root;
  }

  private buildStoneWall(d: MapDecoration): Mesh {
    const root = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.28, depth: d.scale.z }, this.scene);
    root.position = new Vector3(d.position.x, 0.25, d.position.z);
    root.rotation.y = d.rotation;
    root.material = this.material(`${d.id}_mortar`, colorVariant(COLOR.stoneWall, d.id, 0.04));
    root.receiveShadows = true;
    const stones = Math.max(7, Math.floor(d.scale.x / 2.2));
    for (let i = 0; i < stones; i += 1) {
      const stone = MeshBuilder.CreateBox(`${d.id}_stone_${i}`, {
        width: 1.0 + seeded(i * 5 + 1) * 0.55,
        height: 0.42 + seeded(i * 7 + 2) * 0.28,
        depth: d.scale.z * (0.72 + seeded(i * 13 + 3) * 0.22),
      }, this.scene);
      stone.parent = root;
      stone.position = new Vector3((i / Math.max(1, stones - 1) - 0.5) * d.scale.x, 0.22, 0);
      stone.rotation.y = (seeded(i * 17 + 6) - 0.5) * 0.14;
      stone.material = this.material(`${d.id}_stoneMat_${i}`, colorVariant(COLOR.stoneWall, `${d.id}_${i}`, 0.08));
      this.shadowCaster(stone);
    }
    return root;
  }

  private buildFence(d: MapDecoration): Mesh {
    const root = MeshBuilder.CreateBox(d.id, { width: d.scale.x, height: 0.08, depth: 0.08 }, this.scene);
    root.position = new Vector3(d.position.x, 0.5, d.position.z);
    root.rotation.y = d.rotation;
    root.material = this.material(`${d.id}_railMat`, COLOR.fenceWood);
    root.receiveShadows = true;
    const railMat = this.material(`${d.id}_railMat2`, colorVariant(COLOR.fenceWood, d.id, 0.05));
    for (const y of [-0.22, 0.18]) {
      const rail = MeshBuilder.CreateBox(`${d.id}_rail_${y}`, { width: d.scale.x, height: 0.1, depth: 0.1 }, this.scene);
      rail.parent = root;
      rail.position.y = y;
      rail.material = railMat;
      this.shadowCaster(rail);
    }
    const posts = Math.max(4, Math.floor(d.scale.x / 5));
    for (let i = 0; i < posts; i += 1) {
      const post = MeshBuilder.CreateBox(`${d.id}_post_${i}`, { width: 0.18, height: 1.1, depth: 0.18 }, this.scene);
      post.parent = root;
      post.position = new Vector3((i / Math.max(1, posts - 1) - 0.5) * d.scale.x, 0, 0);
      post.material = railMat;
      this.shadowCaster(post);
    }
    return root;
  }

  private buildRoadSign(d: MapDecoration): Mesh {
    const root = MeshBuilder.CreateBox(d.id, { width: 0.18, height: d.scale.y, depth: 0.18 }, this.scene);
    root.position = new Vector3(d.position.x, d.scale.y / 2, d.position.z);
    root.rotation.y = d.rotation;
    root.material = this.material(`${d.id}_postMat`, COLOR.fenceWood);
    this.shadowCaster(root);
    const plankMat = this.material(`${d.id}_plankMat`, { r: 0.39, g: 0.26, b: 0.14 });
    const labels = this.roadSignLabels(d.id);
    for (let i = 0; i < 3; i += 1) {
      const width = 4.35 - i * 0.38;
      const plank = MeshBuilder.CreateBox(`${d.id}_plank_${i}`, { width, height: 0.42, depth: 0.12 }, this.scene);
      plank.parent = root;
      plank.position = new Vector3(i % 2 === 0 ? 1.78 : -1.48, 0.82 - i * 0.48, 0);
      plank.rotation.z = (i - 1) * 0.05;
      plank.material = plankMat;
      this.shadowCaster(plank);
      const face = MeshBuilder.CreatePlane(`${d.id}_label_${i}`, { width: width * 0.92, height: 0.3 }, this.scene);
      face.parent = root;
      face.position = new Vector3(plank.position.x, plank.position.y, 0.071);
      face.rotation.z = plank.rotation.z;
      face.material = this.roadSignMaterial(`${d.id}_${i}`, labels[i] ?? 'AHEAD');
      face.isPickable = false;
    }
    return root;
  }

  private roadSignLabels(id: string): string[] {
    if (id.includes('south')) {
      return ['CAEN 12 km ->', 'STE. MERE-EGLISE ->', 'CARENTAN 18 km ->'];
    }
    return ['VILLAGE CENTER', 'CROSSROADS ->', 'ARMOR ROUTE'];
  }

  private roadSignMaterial(name: string, text: string): StandardMaterial {
    const tex = new DynamicTexture(`roadsign_text_${name}`, { width: 512, height: 96 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#5b3b1f';
    ctx.fillRect(0, 0, 512, 96);
    for (let i = 0; i < 90; i += 1) {
      const x = seeded(i * 13 + text.length) * 512;
      const y = seeded(i * 17 + text.charCodeAt(0)) * 96;
      ctx.fillStyle = `rgba(115,83,48,${0.2 + seeded(i * 19) * 0.24})`;
      ctx.fillRect(x, y, 18 + seeded(i * 23) * 52, 1 + seeded(i * 29) * 2);
    }
    ctx.strokeStyle = 'rgba(38,24,12,0.95)';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 502, 86);
    ctx.fillStyle = 'rgba(238,221,181,0.9)';
    ctx.font = text.length > 15 ? '28px Bahnschrift, Arial' : '32px Bahnschrift, Arial';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 50, 460);
    tex.update();
    tex.hasAlpha = false;

    const mat = new StandardMaterial(`roadsign_text_mat_${name}`, this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.emissiveColor = new Color3(0.15, 0.12, 0.07);
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    return mat;
  }

  private buildBattlefieldDetails(size: number) {
    const craterMat = this.material('crater_scars_mat', { r: 0.14, g: 0.12, b: 0.09 });
    craterMat.alpha = 0.58;
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

    // Procedural puff texture: soft radial alpha disc
    const puffTex = new DynamicTexture('smoke_puff_tex', { width: 64, height: 64 }, this.scene, false);
    puffTex.hasAlpha = true;
    const puffCtx = puffTex.getContext() as CanvasRenderingContext2D;
    const puffGrad = puffCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    puffGrad.addColorStop(0, 'rgba(210,200,185,0.9)');
    puffGrad.addColorStop(0.55, 'rgba(160,152,140,0.45)');
    puffGrad.addColorStop(1, 'rgba(110,105,98,0)');
    puffCtx.fillStyle = puffGrad;
    puffCtx.beginPath();
    puffCtx.arc(32, 32, 32, 0, Math.PI * 2);
    puffCtx.fill();
    puffTex.update();

    const smokeSources = [
      { x: -12, z: -18, scale: 1.35, drift: 0.5 },
      { x: 24, z: -24, scale: 1.18, drift: -0.25 },
      { x: 38, z: -18, scale: 1.62, drift: -0.4 },
      { x: 3, z: 16, scale: 0.92, drift: 0.25 },
    ];
    smokeSources.forEach((source, sourceIdx) => {
      const ps = new ParticleSystem(`smoke_ps_${sourceIdx}`, 60, this.scene);
      ps.particleTexture = puffTex;
      ps.emitter = new Vector3(source.x, 1.8, source.z);
      ps.minSize = 1.4 * source.scale;
      ps.maxSize = 4.2 * source.scale;
      ps.minLifeTime = 3.0;
      ps.maxLifeTime = 5.5;
      ps.emitRate = 5;
      ps.color1 = new Color4(0.42, 0.40, 0.37, 0.65);
      ps.color2 = new Color4(0.26, 0.25, 0.23, 0.32);
      ps.colorDead = new Color4(0.10, 0.10, 0.09, 0);
      ps.direction1 = new Vector3(-0.2 + source.drift * 0.4, 1.0, -0.2);
      ps.direction2 = new Vector3(0.2 + source.drift * 0.4, 1.9, 0.2);
      ps.minAngularSpeed = -0.4;
      ps.maxAngularSpeed = 0.4;
      ps.gravity = new Vector3(0, 0.04, 0);
      ps.start();
      this.particleSystems.push(ps);
    });

    const dustMat = this.material('road_dust_mat', { r: 0.58, g: 0.48, b: 0.32 });
    dustMat.alpha = 0.18;
    const dustPatches = [
      { x: -10, z: 64, sx: 18, sz: 8, rot: -0.28 },
      { x: 18, z: 54, sx: 14, sz: 7, rot: 0.22 },
      { x: 2, z: 21, sx: 16, sz: 8, rot: 0.05 },
    ];
    dustPatches.forEach((d, i) => {
      const dust = MeshBuilder.CreateCylinder(`road_dust_${i}`, {
        diameter: 1,
        height: 0.035,
        tessellation: 24,
      }, this.scene);
      dust.position = new Vector3(d.x, 0.13, d.z);
      dust.scaling = new Vector3(d.sx, 1, d.sz);
      dust.rotation.y = d.rot;
      dust.material = dustMat;
      this.meshes.push(dust);
    });

    const timberMat = this.material('battlefield_timber_mat', COLOR.fenceWood);
    const metalMat = this.material('battlefield_metal_mat', { r: 0.16, g: 0.15, b: 0.13 });
    const debrisMat = this.material('battlefield_debris_mat', { r: 0.34, g: 0.28, b: 0.2 });
    const barricades = [
      { x: -8, z: 9, rot: 0.35 },
      { x: 11, z: -8, rot: -0.25 },
      { x: -24, z: -3, rot: 1.5 },
      { x: 24, z: 6, rot: 1.45 },
    ];
    barricades.forEach((b, i) => {
      for (let j = 0; j < 3; j += 1) {
        const beam = MeshBuilder.CreateBox(`barricade_${i}_${j}`, { width: 4.4, height: 0.22, depth: 0.28 }, this.scene);
        beam.position = new Vector3(b.x, 0.35 + j * 0.26, b.z);
        beam.rotation.y = b.rot + (j - 1) * 0.18;
        beam.rotation.z = (j - 1) * 0.08;
        beam.material = timberMat;
        this.shadowCaster(beam);
        this.meshes.push(beam);
      }
    });

    const staticWrecks = [
      { x: -6, z: -15, rot: -0.8 },
      { x: 18, z: 32, rot: 0.45 },
    ];
    staticWrecks.forEach((w, i) => {
      const hull = MeshBuilder.CreateBox(`static_wreck_${i}`, { width: 2.8, height: 0.65, depth: 3.7 }, this.scene);
      hull.position = new Vector3(w.x, 0.45, w.z);
      hull.rotation.y = w.rot;
      hull.rotation.z = 0.16;
      hull.material = metalMat;
      this.shadowCaster(hull);
      this.meshes.push(hull);
      const rubble = MeshBuilder.CreateBox(`static_wreck_debris_${i}`, { width: 4.4, height: 0.18, depth: 3.2 }, this.scene);
      rubble.position = new Vector3(w.x + 0.8, 0.12, w.z - 0.4);
      rubble.rotation.y = w.rot + 0.35;
      rubble.material = debrisMat;
      this.meshes.push(rubble);
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

  private surfaceMaterial(name: string, c: { r: number; g: number; b: number }, kind: 'wall' | 'roof'): PBRMaterial {
    const tex = new DynamicTexture(`${name}_texture`, { width: 256, height: 256 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = rgbString(c);
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 900; i += 1) {
      const x = seeded(i * 13 + name.length) * 256;
      const y = seeded(i * 17 + name.charCodeAt(0)) * 256;
      const v = kind === 'roof' ? 18 + seeded(i * 19) * 36 : 26 + seeded(i * 19) * 42;
      ctx.fillStyle = `rgba(${v},${v},${Math.max(0, v - 10)},${kind === 'roof' ? 0.18 : 0.14})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    if (kind === 'roof') {
      ctx.strokeStyle = 'rgba(28,18,12,0.34)';
      ctx.lineWidth = 2;
      for (let y = 18; y < 256; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y + (seeded(y + name.length) - 0.5) * 3);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(58,38,28,0.22)';
      ctx.lineWidth = 1;
      for (let x = 12; x < 256; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (seeded(x * 2 + name.length) - 0.5) * 4, 256);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(34,31,25,0.3)';
      ctx.lineWidth = 2;
      for (let y = 20; y < 256; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y + (seeded(y + name.length) - 0.5) * 4);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(222,207,172,0.18)';
      ctx.lineWidth = 1;
      for (let x = 18; x < 256; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x + (seeded(x + name.length) - 0.5) * 6, 0);
        ctx.lineTo(x + (seeded(x * 3 + name.length) - 0.5) * 6, 256);
        ctx.stroke();
      }
    }
    tex.update();

    const mat = new PBRMaterial(name, this.scene);
    mat.albedoTexture = tex;
    mat.albedoColor = Color3.White();
    mat.metallic = 0;
    mat.roughness = kind === 'roof' ? 0.86 : 0.82;
    return mat;
  }

  private material(name: string, c: { r: number; g: number; b: number }): PBRMaterial {
    const mat = new PBRMaterial(name, this.scene);
    mat.albedoColor = new Color3(c.r, c.g, c.b);
    mat.metallic = 0;
    mat.roughness = 0.88;
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
    for (const ps of this.particleSystems) {
      ps.stop();
      ps.dispose();
    }
    this.particleSystems = [];
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

function rgbString(c: { r: number; g: number; b: number }) {
  const r = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
  return `rgb(${r},${g},${b})`;
}

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
