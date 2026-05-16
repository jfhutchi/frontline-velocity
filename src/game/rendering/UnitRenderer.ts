import {
  Color3,
  DynamicTexture,
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
  hoverRing: Mesh;
  threatRing: Mesh;
  marker: Mesh;
  /** Parent transform for health-bar bg+fill so they always move together. */
  hpBarPivot: TransformNode;
  hpBarBg: Mesh;
  hpBarFill: Mesh;
  /** Constant width of the bar background (used to clip the fill). */
  hpBarWidth: number;
  destinationMarker: Mesh;
  attackLine?: LinesMesh;
  isDestroyed: boolean;
  type: UnitType;
}

const HP_BAR_WIDTH = 2.8;
const HP_BAR_HEIGHT = 0.22;
const HP_BAR_FILL_INSET = 0.05; // small inset so fill clearly sits inside the bg

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
    const friendlyMarker = mk('friendlyMarker', COLOR.friendlyMarker);
    friendlyMarker.alpha = 0.28;
    mk('enemyHull', COLOR.enemyHull);
    mk('enemyTurret', COLOR.enemyTurret);
    const enemyMarker = mk('enemyMarker', COLOR.enemyMarker);
    enemyMarker.alpha = 0.22;
    mk('track', { r: 0.08, g: 0.08, b: 0.075 });
    mk('rubber', { r: 0.045, g: 0.045, b: 0.045 });
    mk('glass', { r: 0.28, g: 0.42, b: 0.46 });
    mk('gunMetal', { r: 0.18, g: 0.18, b: 0.17 });
    mk('soldier', { r: 0.22, g: 0.32, b: 0.19 });
    mk('stowageCanvas', { r: 0.37, g: 0.33, b: 0.22 });
    mk('deckDetail', { r: 0.1, g: 0.105, b: 0.085 });
    mk('edgeHighlight', { r: 0.43, g: 0.46, b: 0.3 });
    mk('wreck', { r: 0.17, g: 0.15, b: 0.13 });
    this.materials.insignia = this.buildInsigniaMaterial();
    const sel = mk('selectionRing', COLOR.selection);
    sel.emissiveColor = new Color3(0.3, 0.7, 0.3);
    sel.alpha = 0.85;
    const hover = mk('hoverRing', { r: 0.85, g: 0.95, b: 0.55 });
    hover.emissiveColor = new Color3(0.55, 0.7, 0.25);
    hover.alpha = 0.55;
    const threat = mk('threatRing', { r: 1, g: 0.34, b: 0.22 });
    threat.emissiveColor = new Color3(0.8, 0.18, 0.08);
    threat.alpha = 0.7;
    const dest = mk('destination', { r: 0.95, g: 0.78, b: 0.28 });
    dest.emissiveColor = new Color3(0.6, 0.42, 0.12);
    dest.alpha = 0.78;
    // Health-bar background: opaque dark plate that the colored fill sits inside.
    const hpBg = mk('hpBg', { r: 0.04, g: 0.04, b: 0.04 });
    hpBg.alpha = 0.92;
    hpBg.emissiveColor = new Color3(0.04, 0.04, 0.04);
    const hpFill = mk('hpFill', { r: 0.4, g: 0.85, b: 0.4 });
    hpFill.emissiveColor = new Color3(0.3, 0.7, 0.3);
    const hpLow = mk('hpLow', { r: 0.92, g: 0.25, b: 0.22 });
    hpLow.emissiveColor = new Color3(0.65, 0.08, 0.06);
  }

  private buildInsigniaMaterial(): StandardMaterial {
    const tex = new DynamicTexture('tank_insignia_star', { width: 128, height: 128 }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(245,242,220,0.96)';
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 48 : 19;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = 64 + Math.cos(angle) * radius;
      const y = 64 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    tex.update();
    tex.hasAlpha = true;
    const mat = new StandardMaterial('tankInsigniaMat', this.scene);
    mat.diffuseTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveTexture = tex;
    mat.emissiveColor = new Color3(0.18, 0.18, 0.15);
    mat.specularColor = Color3.Black();
    mat.useAlphaFromDiffuseTexture = true;
    mat.backFaceCulling = false;
    return mat;
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
      case 'heavyTank':
      case 'mediumTank':
      case 'lightTank': {
        const scale = unit.type === 'heavyTank' ? 1.18 : unit.type === 'mediumTank' ? 1 : 0.88;
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 3.2 * scale, height: 0.85 * scale, depth: 4.25 * scale }, this.scene), hullMat, root);
        hull.position.y = 0.75 * scale;

        const upper = this.mesh(`upper_${unit.id}`, MeshBuilder.CreateBox(`upper_${unit.id}`, { width: 2.45 * scale, height: 0.48 * scale, depth: 2.85 * scale }, this.scene), hullMat, root);
        upper.position.y = 1.25 * scale;
        upper.position.z = -0.12 * scale;

        for (const x of [-1.9 * scale, 1.9 * scale]) {
          const track = this.mesh(`track_${unit.id}_${x}`, MeshBuilder.CreateBox(`track_${unit.id}_${x}`, { width: 0.55 * scale, height: 0.58 * scale, depth: 4.55 * scale }, this.scene), this.materials.track, root);
          track.position = new Vector3(x, 0.42 * scale, 0);
          const skirt = this.mesh(`skirt_${unit.id}_${x}`, MeshBuilder.CreateBox(`skirt_${unit.id}_${x}`, { width: 0.18 * scale, height: 0.48 * scale, depth: 4.75 * scale }, this.scene), hullMat, root);
          skirt.position = new Vector3(x * 0.96, 0.78 * scale, -0.05 * scale);
          skirt.rotation.z = x < 0 ? -0.06 : 0.06;
          for (const z of [-1.85, -1.22, -0.58, 0.08, 0.74, 1.4, 1.95]) {
            const block = this.mesh(`tread_${unit.id}_${x}_${z}`, MeshBuilder.CreateBox(`tread_${unit.id}_${x}_${z}`, { width: 0.62 * scale, height: 0.12 * scale, depth: 0.42 * scale }, this.scene), this.materials.rubber, root);
            block.position = new Vector3(x, 0.16 * scale, z * scale);
          }
          for (const z of [-1.55, -0.78, 0, 0.78, 1.55]) {
            const wheel = this.mesh(`roadwheel_${unit.id}_${x}_${z}`, MeshBuilder.CreateCylinder(`roadwheel_${unit.id}_${x}_${z}`, { diameter: 0.48 * scale, height: 0.14 * scale, tessellation: 12 }, this.scene), this.materials.gunMetal, root);
            wheel.rotation.z = Math.PI / 2;
            wheel.position = new Vector3(x, 0.46 * scale, z * scale);
          }
        }

        const nose = this.mesh(`front_${unit.id}`, MeshBuilder.CreateBox(`front_${unit.id}`, { width: 1.1 * scale, height: 0.16 * scale, depth: 0.18 * scale }, this.scene), markerMat, root);
        nose.position = new Vector3(0, 1.25 * scale, 2.22 * scale);
        const glacis = this.mesh(`glacis_${unit.id}`, MeshBuilder.CreateBox(`glacis_${unit.id}`, { width: 2.5 * scale, height: 0.22 * scale, depth: 1.15 * scale }, this.scene), hullMat, root);
        glacis.position = new Vector3(0, 1.26 * scale, 1.34 * scale);
        glacis.rotation.x = -0.22;
        const rearDeck = this.mesh(`rearDeck_${unit.id}`, MeshBuilder.CreateBox(`rearDeck_${unit.id}`, { width: 2.35 * scale, height: 0.14 * scale, depth: 1.2 * scale }, this.scene), this.materials.gunMetal, root);
        rearDeck.position = new Vector3(0, 1.56 * scale, -1.42 * scale);
        for (const x of [-0.78, -0.26, 0.26, 0.78]) {
          const grille = this.mesh(`engine_grille_${unit.id}_${x}`, MeshBuilder.CreateBox(`engine_grille_${unit.id}_${x}`, { width: 0.34 * scale, height: 0.06 * scale, depth: 0.95 * scale }, this.scene), this.materials.deckDetail, root);
          grille.position = new Vector3(x * scale, 1.66 * scale, -1.42 * scale);
        }
        for (const x of [-1.02, -0.5, 0.02, 0.54, 1.06]) {
          const pack = this.mesh(`stowage_${unit.id}_${x}`, MeshBuilder.CreateSphere(`stowage_${unit.id}_${x}`, { diameter: 0.58 * scale, segments: 8 }, this.scene), this.materials.stowageCanvas, root);
          pack.scaling = new Vector3(1.05, 0.52, 0.72);
          pack.position = new Vector3(x * scale, 1.5 * scale, -2.26 * scale);
          pack.rotation.x = 0.08 + x * 0.02;
        }
        for (const x of [-1.3, 1.3]) {
          const rearBox = this.mesh(`rear_box_${unit.id}_${x}`, MeshBuilder.CreateBox(`rear_box_${unit.id}_${x}`, { width: 0.42 * scale, height: 0.42 * scale, depth: 0.54 * scale }, this.scene), this.materials.stowageCanvas, root);
          rearBox.position = new Vector3(x * scale, 1.28 * scale, -2.2 * scale);
          rearBox.rotation.z = x < 0 ? -0.05 : 0.05;
        }
        for (const x of [-1.12, 1.12]) {
          for (const z of [-0.74, -0.24, 0.26, 0.76]) {
            const deckBolt = this.mesh(`deck_bolt_${unit.id}_${x}_${z}`, MeshBuilder.CreateCylinder(`deck_bolt_${unit.id}_${x}_${z}`, { diameter: 0.1 * scale, height: 0.045 * scale, tessellation: 8 }, this.scene), this.materials.deckDetail, root);
            deckBolt.position = new Vector3(x * scale, 1.62 * scale, z * scale);
          }
        }

        turretPivot = new TransformNode(`turretPivot_${unit.id}`, this.scene);
        turretPivot.parent = root;
        turretPivot.position.y = 1.68 * scale;
        this.mesh(`turretBase_${unit.id}`, MeshBuilder.CreateCylinder(`turretBase_${unit.id}`, { diameter: 1.85 * scale, height: 0.72 * scale, tessellation: 10 }, this.scene), turretMat, turretPivot);
        const turretRear = this.mesh(`turretRear_${unit.id}`, MeshBuilder.CreateBox(`turretRear_${unit.id}`, { width: 1.45 * scale, height: 0.42 * scale, depth: 0.76 * scale }, this.scene), turretMat, turretPivot);
        turretRear.position = new Vector3(0, -0.03 * scale, -0.58 * scale);
        for (const x of [-0.72, 0.72]) {
          const cheek = this.mesh(`turretCheek_${unit.id}_${x}`, MeshBuilder.CreateBox(`turretCheek_${unit.id}_${x}`, { width: 0.42 * scale, height: 0.46 * scale, depth: 0.78 * scale }, this.scene), turretMat, turretPivot);
          cheek.position = new Vector3(x * scale, -0.01 * scale, 0.28 * scale);
          cheek.rotation.y = x < 0 ? 0.2 : -0.2;
        }
        const mantlet = this.mesh(`mantlet_${unit.id}`, MeshBuilder.CreateBox(`mantlet_${unit.id}`, { width: 0.9 * scale, height: 0.5 * scale, depth: 0.34 * scale }, this.scene), this.materials.gunMetal, turretPivot);
        mantlet.position = new Vector3(0, 0.02 * scale, 0.8 * scale);
        const barrelSleeve = this.mesh(`barrelSleeve_${unit.id}`, MeshBuilder.CreateCylinder(`barrelSleeve_${unit.id}`, { diameter: 0.36 * scale, height: 0.76 * scale, tessellation: 10 }, this.scene), this.materials.gunMetal, turretPivot);
        barrelSleeve.rotation.x = Math.PI / 2;
        barrelSleeve.position.z = 1.16 * scale;
        barrelSleeve.position.y = 0.05 * scale;
        const barrel = this.mesh(`barrel_${unit.id}`, MeshBuilder.CreateCylinder(`barrel_${unit.id}`, { diameter: 0.22 * scale, height: 3.0 * scale, tessellation: 8 }, this.scene), this.materials.gunMetal, turretPivot);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 1.95 * scale;
        barrel.position.y = 0.05 * scale;
        const coax = this.mesh(`coax_${unit.id}`, MeshBuilder.CreateCylinder(`coax_${unit.id}`, { diameter: 0.07 * scale, height: 1.45 * scale, tessellation: 6 }, this.scene), this.materials.gunMetal, turretPivot);
        coax.rotation.x = Math.PI / 2;
        coax.position = new Vector3(0.36 * scale, 0.18 * scale, 1.34 * scale);
        const muzzle = this.mesh(`muzzle_${unit.id}`, MeshBuilder.CreateCylinder(`muzzle_${unit.id}`, { diameter: 0.32 * scale, height: 0.28 * scale, tessellation: 10 }, this.scene), this.materials.gunMetal, turretPivot);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.z = 3.48 * scale;
        muzzle.position.y = 0.05 * scale;
        const cupola = this.mesh(`cupola_${unit.id}`, MeshBuilder.CreateCylinder(`cupola_${unit.id}`, { diameter: 0.62 * scale, height: 0.32 * scale, tessellation: 10 }, this.scene), turretMat, turretPivot);
        cupola.position = new Vector3(-0.34 * scale, 0.52 * scale, -0.18 * scale);
        const cupolaRing = this.mesh(`cupolaRing_${unit.id}`, MeshBuilder.CreateCylinder(`cupolaRing_${unit.id}`, { diameter: 0.74 * scale, height: 0.08 * scale, tessellation: 12 }, this.scene), this.materials.gunMetal, turretPivot);
        cupolaRing.position = new Vector3(-0.34 * scale, 0.7 * scale, -0.18 * scale);
        const hatch = this.mesh(`hatch_${unit.id}`, MeshBuilder.CreateBox(`hatch_${unit.id}`, { width: 0.62 * scale, height: 0.08 * scale, depth: 0.42 * scale }, this.scene), this.materials.gunMetal, turretPivot);
        hatch.position = new Vector3(0.36 * scale, 0.52 * scale, -0.08 * scale);
        hatch.rotation.y = 0.34;
        const turretInsignia = this.mesh(`turret_star_${unit.id}`, MeshBuilder.CreatePlane(`turret_star_${unit.id}`, { width: 0.86 * scale, height: 0.86 * scale }, this.scene), this.materials.insignia, turretPivot);
        turretInsignia.position = new Vector3(0.98 * scale, 0.04 * scale, -0.18 * scale);
        turretInsignia.rotation.y = Math.PI / 2;
        const deckInsignia = this.mesh(`deck_star_${unit.id}`, MeshBuilder.CreatePlane(`deck_star_${unit.id}`, { width: 0.72 * scale, height: 0.72 * scale }, this.scene), this.materials.insignia, root);
        deckInsignia.position = new Vector3(0.78 * scale, 1.66 * scale, -0.72 * scale);
        deckInsignia.rotation.x = Math.PI / 2;
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
      case 'mortar': {
        hull = this.mesh(`hull_${unit.id}`, MeshBuilder.CreateBox(`hull_${unit.id}`, { width: 1.4, height: 0.25, depth: 1.4 }, this.scene), hullMat, root);
        hull.position.y = 0.18;
        const baseplate = this.mesh(`mortar_base_${unit.id}`, MeshBuilder.CreateCylinder(`mortar_base_${unit.id}`, { diameter: 1.6, height: 0.18, tessellation: 14 }, this.scene), this.materials.gunMetal, root);
        baseplate.position.y = 0.09;
        const bipod = this.mesh(`mortar_bipod_${unit.id}`, MeshBuilder.CreateBox(`mortar_bipod_${unit.id}`, { width: 0.85, height: 0.07, depth: 0.07 }, this.scene), this.materials.gunMetal, root);
        bipod.position = new Vector3(0, 0.55, 0.18);
        bipod.rotation.x = -0.35;
        turretPivot = new TransformNode(`turretPivot_${unit.id}`, this.scene);
        turretPivot.parent = root;
        turretPivot.position.y = 0.5;
        const tube = this.mesh(`mortar_tube_${unit.id}`, MeshBuilder.CreateCylinder(`mortar_tube_${unit.id}`, { diameter: 0.24, height: 1.85, tessellation: 10 }, this.scene), this.materials.gunMetal, turretPivot);
        tube.rotation.x = -0.55; // angled up so it reads as indirect-fire
        tube.position.z = 0.2;
        tube.position.y = 0.55;
        for (let i = 0; i < 3; i += 1) {
          const ammo = this.mesh(`mortar_ammo_${unit.id}_${i}`, MeshBuilder.CreateCylinder(`mortar_ammo_${unit.id}_${i}`, { diameter: 0.18, height: 0.32, tessellation: 8 }, this.scene), markerMat, root);
          ammo.position = new Vector3(-0.55 + i * 0.22, 0.34, -0.7);
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

    const hoverRing = MeshBuilder.CreateTorus(`hover_${unit.id}`, { diameter: unit.radius * 3.0, thickness: 0.12, tessellation: 24 }, this.scene);
    hoverRing.material = this.materials.hoverRing;
    hoverRing.parent = root;
    hoverRing.position.y = 0.07;
    hoverRing.isVisible = false;

    const threatRing = MeshBuilder.CreateTorus(`threat_${unit.id}`, { diameter: unit.radius * 3.8, thickness: 0.14, tessellation: 24 }, this.scene);
    threatRing.material = this.materials.threatRing;
    threatRing.parent = root;
    threatRing.position.y = 0.1;
    threatRing.isVisible = false;

    const destinationMarker = MeshBuilder.CreateTorus(`dest_${unit.id}`, { diameter: 3.4, thickness: 0.14, tessellation: 24 }, this.scene);
    destinationMarker.material = this.materials.destination;
    destinationMarker.position.y = 0.1;
    destinationMarker.isVisible = false;

    // Health bar: bg and fill share a single billboarded pivot above the unit.
    // Both meshes are children of the pivot, so their world transforms can never
    // drift apart regardless of camera angle, unit rotation, or terrain pitch.
    const hpBarPivot = new TransformNode(`hpPivot_${unit.id}`, this.scene);
    hpBarPivot.parent = root;
    hpBarPivot.position.y = 3.45;

    const hpBarBg = MeshBuilder.CreatePlane(`hpbg_${unit.id}`, { width: HP_BAR_WIDTH, height: HP_BAR_HEIGHT }, this.scene);
    hpBarBg.material = this.materials.hpBg;
    hpBarBg.parent = hpBarPivot;
    // No per-mesh billboard: hpBarPivot is oriented each frame toward the active
    // camera so background + fill stay one rigid local group above the hull.
    hpBarBg.billboardMode = 0;
    hpBarBg.renderingGroupId = 1;

    const fillWidth = HP_BAR_WIDTH - HP_BAR_FILL_INSET * 2;
    const hpBarFill = MeshBuilder.CreatePlane(`hpfill_${unit.id}`, { width: fillWidth, height: HP_BAR_HEIGHT - HP_BAR_FILL_INSET * 2 }, this.scene);
    hpBarFill.material = this.materials.hpFill;
    hpBarFill.billboardMode = 0;
    // Anchor the fill at the LEFT edge of the bg by parenting to the bg and
    // shifting the pivot by half its width — we then scale .x in [0..1] from
    // that left edge so the fill always grows rightward inside the bg.
    hpBarFill.parent = hpBarBg;
    hpBarFill.position.x = -fillWidth / 2;
    hpBarFill.setPivotPoint(new Vector3(fillWidth / 2, 0, 0));
    hpBarFill.position.z = -0.001;
    hpBarFill.renderingGroupId = 1;

    return {
      root,
      hull,
      turretPivot,
      selectionRing,
      hoverRing,
      threatRing,
      marker,
      hpBarPivot,
      hpBarBg,
      hpBarFill,
      hpBarWidth: fillWidth,
      destinationMarker,
      isDestroyed: false,
      type: unit.type,
    };
  }

  update(unit: Unit, isSelected: boolean, isControlled: boolean, target: Unit | null, simTime: number, isHovered = false) {
    const vis = this.ensureVisual(unit);
    vis.root.setEnabled(true);
    vis.destinationMarker.setEnabled(!isControlled);

    vis.root.position.x = unit.position.x;
    vis.root.position.z = unit.position.z;
    vis.root.position.y = unit.isDestroyed ? -0.2 : 0;
    vis.root.rotation.y = unit.rotation;
    if (vis.turretPivot) {
      vis.turretPivot.rotation.y = unit.turretRotation;
    }

    this.orientHealthBarPivot(vis, unit);

    const recentlyHit = unit.lastDamagedAt !== undefined && simTime - unit.lastDamagedAt < 1.2;
    vis.selectionRing.isVisible = isSelected && !unit.isDestroyed && !isControlled;
    vis.hoverRing.isVisible = isHovered && !isSelected && !unit.isDestroyed && !isControlled;
    vis.threatRing.isVisible = recentlyHit && !unit.isDestroyed && !isControlled;

    const destination = unit.currentOrder.destination ?? unit.lastOrderDestination;
    vis.destinationMarker.isVisible = Boolean(isSelected && destination && !unit.isDestroyed);
    if (destination) {
      vis.destinationMarker.position.x = destination.x;
      vis.destinationMarker.position.z = destination.z;
    }

    const hpFrac = Math.max(0, Math.min(1, unit.health / unit.maxHealth));
    // Scale the fill from its left-edge pivot. Scaling is uniform in the bar's
    // local space so the fill always stays visually inside the background bg.
    vis.hpBarFill.scaling.x = hpFrac;
    vis.hpBarFill.material = hpFrac < 0.35 ? this.materials.hpLow : this.materials.hpFill;
    const showBar = !unit.isDestroyed && hpFrac < 0.999 && !isControlled;
    vis.hpBarBg.isVisible = showBar;
    vis.hpBarFill.isVisible = showBar && hpFrac > 0;

    this.updateAttackLine(vis, unit, target, isSelected && !isControlled);

    if (unit.isDestroyed && !vis.isDestroyed) {
      vis.isDestroyed = true;
      vis.hull.material = this.materials.wreck;
      if (vis.turretPivot) {
        vis.turretPivot.rotation.y += 0.4;
      }
      vis.marker.isVisible = false;
      vis.root.rotation.z = unit.type === 'infantry' ? 0 : 0.18;
      vis.destinationMarker.isVisible = false;
      vis.hpBarBg.isVisible = false;
      vis.hpBarFill.isVisible = false;
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

  /** Keep the HP bar facing the tactical camera while counter-rotating hull yaw. */
  private orientHealthBarPivot(vis: UnitVisual, unit: Unit) {
    const cam = this.scene.activeCamera;
    if (!cam) return;
    const dx = cam.position.x - unit.position.x;
    const dz = cam.position.z - unit.position.z;
    const faceYaw = Math.atan2(dx, dz);
    vis.hpBarPivot.rotation.y = faceYaw - unit.rotation;
    vis.hpBarPivot.rotation.x = 0.2;
    vis.hpBarPivot.rotation.z = 0;
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
