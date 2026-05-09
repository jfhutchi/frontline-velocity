import {
  Color3,
  LinesMesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
} from '@babylonjs/core';
import { COLOR } from '../constants';
import type { Unit, UnitType } from '../types';

interface UnitVisual {
  root: TransformNode;
  hull: Mesh;
  turretPivot?: TransformNode;
  selectionRing: Mesh;
  threatRing: Mesh;
  marker: Mesh;
  hpBarBg: Mesh;
  hpBarFill: Mesh;
  destinationMarker: Mesh;
  attackLine?: LinesMesh;
  isDestroyed: boolean;
  type: UnitType;
}

export class UnitRenderer {
  private scene: Scene;
  private shadowGenerator?: ShadowGenerator;
  private visuals = new Map<string, UnitVisual>();
  private materials: Record<string, StandardMaterial> = {};

  constructor(scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.buildSharedMaterials();
  }

  private buildSharedMaterials() {
    const mk = (name: string, c: { r: number; g: number; b: number }) => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = new Color3(c.r, c.g, c.b);
      m.specularColor = new Color3(0.08, 0.08, 0.07);
      this.materials[name] = m;
      return m;
    };
    mk('friendlyHull', COLOR.friendlyHull);
    mk('friendlyTurret', COLOR.friendlyTurret);
    mk('friendlyMarker', COLOR.friendlyMarker);
    mk('enemyHull', COLOR.enemyHull);
    mk('enemyTurret', COLOR.enemyTurret);
    mk('enemyMarker', COLOR.enemyMarker);
    mk('track', { r: 0.08, g: 0.08, b: 0.075 });
    mk('rubber', { r: 0.045, g: 0.045, b: 0.045 });
    mk('glass', { r: 0.28, g: 0.42, b: 0.46 });
    mk('gunMetal', { r: 0.18, g: 0.18, b: 0.17 });
    mk('soldier', { r: 0.22, g: 0.32, b: 0.19 });
    mk('wreck', { r: 0.17, g: 0.15, b: 0.13 });
    const sel = mk('selectionRing', COLOR.selection);
    sel.emissiveColor = new Color3(0.3, 0.7, 0.3);
    sel.alpha = 0.85;
    const threat = mk('threatRing', { r: 1, g: 0.34, b: 0.22 });
    threat.emissiveColor = new Color3(0.8, 0.18, 0.08);
    threat.alpha = 0.7;
    const dest = mk('destination', { r: 0.95, g: 0.78, b: 0.28 });
    dest.emissiveColor = new Color3(0.6, 0.42, 0.12);
    dest.alpha = 0.78;
    const hpBg = mk('hpBg', { r: 0.05, g: 0.05, b: 0.05 });
    hpBg.alpha = 0.85;
    const hpFill = mk('hpFill', { r: 0.4, g: 0.85, b: 0.4 });
    hpFill.emissiveColor = new Color3(0.3, 0.7, 0.3);
    const hpLow = mk('hpLow', { r: 0.92, g: 0.25, b: 0.22 });
    hpLow.emissiveColor = new Color3(0.65, 0.08, 0.06);
  }

  ensureVisual(unit: Unit): UnitVisual {
    let vis = this.visuals.get(unit.id);
    if (vis) return vis;
    vis = this.buildVisual(unit);
    this.visuals.set(unit.id, vis);
    return vis;
  }

  private buildVisual(unit: Unit): UnitVisual {
    const root = new TransformNode(`unit_${unit.id}`, this.scene);
    const isFriendly = unit.faction === 'friendly';
    const hullMat = this.materials[isFriendly ? 'friendlyHull' : 'enemyHull'];
    const turretMat = this.materials[isFriendly ? 'friendlyTurret' : 'enemyTurret'];
    const markerMat = this.materials[isFriendly ? 'friendlyMarker' : 'enemyMarker'];

    let hull: Mesh;
    let turretPivot: TransformNode | undefined;

    switch (unit.type) {
      case 'mediumTank':
      case 'lightTank': {
        const scale = unit.type === 'mediumTank' ? 1 : 0.88;
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 3.2 * scale, height: 0.85 * scale, depth: 4.25 * scale }, this.scene), hullMat, root);
        hull.position.y = 0.75 * scale;

        const upper = this.mesh(`upper_${unit.id}`, MeshBuilder.CreateBox(`upper_${unit.id}`, { width: 2.45 * scale, height: 0.48 * scale, depth: 2.85 * scale }, this.scene), hullMat, root);
        upper.position.y = 1.25 * scale;
        upper.position.z = -0.12 * scale;

        for (const x of [-1.9 * scale, 1.9 * scale]) {
          const track = this.mesh(`track_${unit.id}_${x}`, MeshBuilder.CreateBox(`track_${unit.id}_${x}`, { width: 0.55 * scale, height: 0.58 * scale, depth: 4.55 * scale }, this.scene), this.materials.track, root);
          track.position = new Vector3(x, 0.42 * scale, 0);
          for (const z of [-1.55, -0.55, 0.55, 1.55]) {
            const block = this.mesh(`tread_${unit.id}_${x}_${z}`, MeshBuilder.CreateBox(`tread_${unit.id}_${x}_${z}`, { width: 0.62 * scale, height: 0.12 * scale, depth: 0.42 * scale }, this.scene), this.materials.rubber, root);
            block.position = new Vector3(x, 0.16 * scale, z * scale);
          }
        }

        const nose = this.mesh(`front_${unit.id}`, MeshBuilder.CreateBox(`front_${unit.id}`, { width: 1.1 * scale, height: 0.16 * scale, depth: 0.18 * scale }, this.scene), markerMat, root);
        nose.position = new Vector3(0, 1.25 * scale, 2.22 * scale);

        turretPivot = new TransformNode(`turretPivot_${unit.id}`, this.scene);
        turretPivot.parent = root;
        turretPivot.position.y = 1.68 * scale;
        this.mesh(`turretBase_${unit.id}`, MeshBuilder.CreateCylinder(`turretBase_${unit.id}`, { diameter: 1.85 * scale, height: 0.72 * scale, tessellation: 10 }, this.scene), turretMat, turretPivot);
        const barrel = this.mesh(`barrel_${unit.id}`, MeshBuilder.CreateCylinder(`barrel_${unit.id}`, { diameter: 0.22 * scale, height: 3.0 * scale, tessellation: 8 }, this.scene), this.materials.gunMetal, turretPivot);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 1.95 * scale;
        barrel.position.y = 0.05 * scale;
        break;
      }
      case 'reconJeep': {
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 1.75, height: 0.58, depth: 2.85 }, this.scene), hullMat, root);
        hull.position.y = 0.58;
        const hood = this.mesh(`hood_${unit.id}`, MeshBuilder.CreateBox(`hood_${unit.id}`, { width: 1.55, height: 0.34, depth: 1.0 }, this.scene), hullMat, root);
        hood.position = new Vector3(0, 0.86, 0.95);
        const rear = this.mesh(`rear_${unit.id}`, MeshBuilder.CreateBox(`rear_${unit.id}`, { width: 1.6, height: 0.46, depth: 0.85 }, this.scene), hullMat, root);
        rear.position = new Vector3(0, 0.9, -0.92);
        for (const [x, z] of [
          [-0.98, 1.02],
          [0.98, 1.02],
          [-0.98, -1.02],
          [0.98, -1.02],
        ]) {
          const wheel = this.mesh(`wheel_${unit.id}_${x}_${z}`, MeshBuilder.CreateCylinder(`wheel_${unit.id}_${x}_${z}`, { diameter: 0.58, height: 0.34, tessellation: 12 }, this.scene), this.materials.rubber, root);
          wheel.rotation.z = Math.PI / 2;
          wheel.position = new Vector3(x, 0.38, z);
        }
        const windshield = this.mesh(`windshield_${unit.id}`, MeshBuilder.CreateBox(`windshield_${unit.id}`, { width: 1.25, height: 0.1, depth: 0.72 }, this.scene), this.materials.glass, root);
        windshield.rotation.x = -0.55;
        windshield.position = new Vector3(0, 1.18, 0.18);
        turretPivot = new TransformNode(`turretPivot_${unit.id}`, this.scene);
        turretPivot.parent = root;
        turretPivot.position.y = 1.2;
        const mg = this.mesh(`mg_${unit.id}`, MeshBuilder.CreateCylinder(`mg_${unit.id}`, { diameter: 0.16, height: 1.65, tessellation: 8 }, this.scene), this.materials.gunMetal, turretPivot);
        mg.rotation.x = Math.PI / 2;
        mg.position.z = 0.82;
        break;
      }
      case 'infantry': {
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateCylinder(`hull_${unit.id}`, { diameter: 1.75, height: 0.12, tessellation: 14 }, this.scene), hullMat, root);
        hull.position.y = 0.08;
        const spots = [
          [-0.46, 0.44],
          [0.48, 0.36],
          [-0.34, -0.48],
          [0.42, -0.42],
        ];
        for (const [x, z] of spots) {
          const body = this.mesh(`soldier_${unit.id}_${x}_${z}`, MeshBuilder.CreateCylinder(`soldier_${unit.id}_${x}_${z}`, { diameter: 0.28, height: 0.8, tessellation: 8 }, this.scene), this.materials.soldier, root);
          body.position = new Vector3(x, 0.48, z);
          const head = this.mesh(`head_${unit.id}_${x}_${z}`, MeshBuilder.CreateSphere(`head_${unit.id}_${x}_${z}`, { diameter: 0.24, segments: 6 }, this.scene), this.materials.soldier, root);
          head.position = new Vector3(x, 0.98, z);
          const rifle = this.mesh(`rifle_${unit.id}_${x}_${z}`, MeshBuilder.CreateCylinder(`rifle_${unit.id}_${x}_${z}`, { diameter: 0.055, height: 0.8, tessellation: 6 }, this.scene), this.materials.gunMetal, root);
          rifle.rotation.x = Math.PI / 2;
          rifle.position = new Vector3(x + 0.08, 0.74, z + 0.33);
        }
        break;
      }
      case 'antiTankGun': {
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 1.65, height: 0.34, depth: 1.2 }, this.scene), hullMat, root);
        hull.position.y = 0.35;
        const shield = this.mesh(`shield_${unit.id}`, MeshBuilder.CreateBox(`shield_${unit.id}`, { width: 2.35, height: 1.15, depth: 0.18 }, this.scene), hullMat, root);
        shield.position = new Vector3(0, 0.88, 0.38);
        turretPivot = new TransformNode(`turretPivot_${unit.id}`, this.scene);
        turretPivot.parent = root;
        turretPivot.position.y = 0.9;
        const barrel = this.mesh(`barrel_${unit.id}`, MeshBuilder.CreateCylinder(`barrel_${unit.id}`, { diameter: 0.22, height: 3.25, tessellation: 8 }, this.scene), this.materials.gunMetal, turretPivot);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 1.55;
        for (const x of [-0.9, 0.9]) {
          const wheel = this.mesh(`atwheel_${unit.id}_${x}`, MeshBuilder.CreateCylinder(`atwheel_${unit.id}_${x}`, { diameter: 0.58, height: 0.18, tessellation: 10 }, this.scene), this.materials.rubber, root);
          wheel.rotation.z = Math.PI / 2;
          wheel.position = new Vector3(x, 0.32, -0.3);
        }
        const trail = this.mesh(`attrail_${unit.id}`, MeshBuilder.CreateBox(`attrail_${unit.id}`, { width: 0.22, height: 0.16, depth: 2.1 }, this.scene), this.materials.gunMetal, root);
        trail.position = new Vector3(0, 0.22, -1.15);
        break;
      }
      default:
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 2, height: 1, depth: 2 }, this.scene), hullMat, root);
        hull.position.y = 0.5;
    }

    const marker = MeshBuilder.CreateDisc(`marker_${unit.id}`, { radius: 0.95, tessellation: 18 }, this.scene);
    marker.rotation.x = Math.PI / 2;
    marker.parent = root;
    marker.position.y = 0.06;
    marker.material = markerMat;

    const selectionRing = MeshBuilder.CreateTorus(`sel_${unit.id}`, { diameter: unit.radius * 3.4, thickness: 0.18, tessellation: 28 }, this.scene);
    selectionRing.material = this.materials.selectionRing;
    selectionRing.parent = root;
    selectionRing.position.y = 0.08;
    selectionRing.isVisible = false;

    const threatRing = MeshBuilder.CreateTorus(`threat_${unit.id}`, { diameter: unit.radius * 3.8, thickness: 0.14, tessellation: 24 }, this.scene);
    threatRing.material = this.materials.threatRing;
    threatRing.parent = root;
    threatRing.position.y = 0.1;
    threatRing.isVisible = false;

    const destinationMarker = MeshBuilder.CreateTorus(`dest_${unit.id}`, { diameter: 3.4, thickness: 0.14, tessellation: 24 }, this.scene);
    destinationMarker.material = this.materials.destination;
    destinationMarker.position.y = 0.1;
    destinationMarker.isVisible = false;

    const hpBarBg = MeshBuilder.CreatePlane(`hpbg_${unit.id}`, { width: 2.8, height: 0.2 }, this.scene);
    hpBarBg.material = this.materials.hpBg;
    hpBarBg.parent = root;
    hpBarBg.position.y = 3.35;
    hpBarBg.billboardMode = 7;

    const hpBarFill = MeshBuilder.CreatePlane(`hpfill_${unit.id}`, { width: 2.7, height: 0.15 }, this.scene);
    hpBarFill.material = this.materials.hpFill;
    hpBarFill.parent = root;
    hpBarFill.position.y = 3.35;
    hpBarFill.billboardMode = 7;
    hpBarFill.position.z = -0.001;

    return {
      root,
      hull,
      turretPivot,
      selectionRing,
      threatRing,
      marker,
      hpBarBg,
      hpBarFill,
      destinationMarker,
      isDestroyed: false,
      type: unit.type,
    };
  }

  update(unit: Unit, isSelected: boolean, isControlled: boolean, target: Unit | null, simTime: number) {
    const vis = this.ensureVisual(unit);

    vis.root.position.x = unit.position.x;
    vis.root.position.z = unit.position.z;
    vis.root.position.y = unit.isDestroyed ? -0.2 : 0;
    vis.root.rotation.y = unit.rotation;
    if (vis.turretPivot) {
      vis.turretPivot.rotation.y = unit.turretRotation;
    }

    const recentlyHit = unit.lastDamagedAt !== undefined && simTime - unit.lastDamagedAt < 1.2;
    vis.selectionRing.isVisible = isSelected && !unit.isDestroyed && !isControlled;
    vis.threatRing.isVisible = recentlyHit && !unit.isDestroyed;

    const destination = unit.currentOrder.destination ?? unit.lastOrderDestination;
    vis.destinationMarker.isVisible = Boolean(isSelected && destination && !unit.isDestroyed);
    if (destination) {
      vis.destinationMarker.position.x = destination.x;
      vis.destinationMarker.position.z = destination.z;
    }

    const hpFrac = Math.max(0, Math.min(1, unit.health / unit.maxHealth));
    vis.hpBarFill.scaling.x = hpFrac;
    vis.hpBarFill.position.x = -((1 - hpFrac) * 1.35);
    vis.hpBarFill.material = hpFrac < 0.35 ? this.materials.hpLow : this.materials.hpFill;
    vis.hpBarFill.isVisible = !unit.isDestroyed && hpFrac < 0.999;
    vis.hpBarBg.isVisible = !unit.isDestroyed && hpFrac < 0.999;

    this.updateAttackLine(vis, unit, target, isSelected);

    if (unit.isDestroyed && !vis.isDestroyed) {
      vis.isDestroyed = true;
      vis.hull.material = this.materials.wreck;
      if (vis.turretPivot) {
        vis.turretPivot.rotation.y += 0.4;
      }
      vis.marker.isVisible = false;
      vis.root.rotation.z = unit.type === 'infantry' ? 0 : 0.18;
      vis.destinationMarker.isVisible = false;
      vis.attackLine?.dispose();
      vis.attackLine = undefined;
    }
  }

  removeMissing(activeIds: Set<string>) {
    for (const [id, vis] of this.visuals) {
      if (!activeIds.has(id)) {
        vis.attackLine?.dispose();
        vis.destinationMarker.dispose(false, true);
        vis.root.dispose(false, true);
        this.visuals.delete(id);
      }
    }
  }

  dispose() {
    for (const v of this.visuals.values()) {
      v.attackLine?.dispose();
      v.destinationMarker.dispose(false, true);
      v.root.dispose(false, true);
    }
    this.visuals.clear();
  }

  private updateAttackLine(vis: UnitVisual, unit: Unit, target: Unit | null, isSelected: boolean) {
    const visible = Boolean(target && !target.isDestroyed && !unit.isDestroyed && (isSelected || unit.aiState === 'engage'));
    if (!visible || !target) {
      vis.attackLine?.dispose();
      vis.attackLine = undefined;
      return;
    }
    vis.attackLine?.dispose();
    vis.attackLine = MeshBuilder.CreateLines(`attack_${unit.id}`, {
      points: [
        new Vector3(unit.position.x, 0.18, unit.position.z),
        new Vector3(target.position.x, 0.18, target.position.z),
      ],
    }, this.scene);
    vis.attackLine.color = unit.faction === 'friendly' ? new Color3(0.55, 0.8, 1) : new Color3(1, 0.45, 0.28);
  }

  private mesh(name: string, mesh: Mesh, material: StandardMaterial, parent: TransformNode): Mesh {
    mesh.name = name;
    mesh.material = material;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster(mesh);
    return mesh;
  }
}
