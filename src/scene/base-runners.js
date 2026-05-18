import * as THREE from 'three';
import { BASE_DISTANCE } from '../constants.js';

/**
 * BaseRunners — 在 3D 場景裡的壘上跑者小人
 * bases[0]=一壘, bases[1]=二壘, bases[2]=三壘
 */
export class BaseRunners {
  constructor(scene) {
    this._scene = scene;

    // 三個壘的世界座標（對應 stadium.js _buildBases）
    const d = BASE_DISTANCE;
    this._basePositions = [
      new THREE.Vector3( d / Math.SQRT2,  0, -d / Math.SQRT2),  // 一壘
      new THREE.Vector3( 0,               0, -d * Math.SQRT2),   // 二壘
      new THREE.Vector3(-d / Math.SQRT2,  0, -d / Math.SQRT2),  // 三壘
    ];

    // 建立三個跑者（預設隱藏）
    this._runners = this._basePositions.map((pos) => this._buildRunner(scene, pos));
  }

  _buildRunner(scene, pos) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.visible = false;

    const skinMat  = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
    const jerseyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const pantsMat  = new THREE.MeshLambertMaterial({ color: 0x333399 }); // 藍褲

    // 身體
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.3, 4, 6),
      jerseyMat
    );
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    // 頭
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 6),
      skinMat
    );
    head.position.y = 1.42;
    group.add(head);

    // 帽子
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      pantsMat
    );
    cap.position.y = 1.44;
    group.add(cap);

    // 左腿
    const legGeo = new THREE.CapsuleGeometry(0.07, 0.35, 4, 6);
    const lLeg = new THREE.Mesh(legGeo, pantsMat);
    lLeg.position.set(-0.1, 0.38, 0);
    group.add(lLeg);

    // 右腿
    const rLeg = new THREE.Mesh(legGeo, pantsMat);
    rLeg.position.set(0.1, 0.38, 0);
    group.add(rLeg);

    scene.add(group);
    return group;
  }

  /** 根據 score.bases 更新三個壘的小人顯示 */
  update(bases) {
    for (let i = 0; i < 3; i++) {
      this._runners[i].visible = !!bases[i];
    }
  }

  dispose() {
    for (const r of this._runners) {
      this._scene.remove(r);
    }
  }
}
