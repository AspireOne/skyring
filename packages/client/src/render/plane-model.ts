import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';

import { PLANE_ASSETS } from '../assets.js';

import type { PlayerSlot } from '@skyring/shared';

export function loadPlaneModel(
  slot: PlayerSlot,
  onLoad: (model: Group) => void,
  onError: (path: string, error: unknown) => void,
): void {
  const asset = PLANE_ASSETS[slot];
  void import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => {
      new GLTFLoader().load(
        asset.path,
        ({ scene }) => {
          normalizeModel(scene, asset.targetSize, asset.yaw);
          onLoad(scene);
        },
        undefined,
        (error) => onError(asset.path, error),
      );
    })
    .catch((error: unknown) => onError(asset.path, error));
}

export function createFallbackPlane(color: number): Group {
  const material = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.25,
    metalness: 0.2,
    roughness: 0.5,
  });
  const group = new Group();
  const fuselage = new Mesh(new ConeGeometry(3, 18, 12), material);
  fuselage.rotation.x = -Math.PI / 2;
  group.add(fuselage);

  for (const [size, z, y] of [
    [[26, 1, 6], 1, 0],
    [[8, 1, 4], 7, 0],
    [[1, 5, 5], 7, 2],
  ] as const) {
    const part = new Mesh(new BoxGeometry(...size), material);
    part.position.set(0, y, z);
    group.add(part);
  }
  return group;
}

export function disposeGroup(group: Group): void {
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) material.dispose();
  });
}

function normalizeModel(model: Group, targetSize: number, yaw: number): void {
  model.rotation.y = yaw;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const longestSide =
    bounds.getSize(_modelSize).length() > 0
      ? Math.max(_modelSize.x, _modelSize.y, _modelSize.z)
      : 1;
  model.scale.multiplyScalar(targetSize / longestSide);
  model.updateMatrixWorld(true);
  new Box3().setFromObject(model).getCenter(_modelCenter);
  model.position.sub(_modelCenter);
}

const _modelSize = new Vector3();
const _modelCenter = new Vector3();
