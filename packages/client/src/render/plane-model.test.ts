import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { consolidateModel, disposeGroup } from './plane-model.js';

describe('consolidateModel', () => {
  it('bakes transforms and reduces meshes to one draw batch per material', () => {
    const source = new Group();
    const cyan = new MeshBasicMaterial({ color: 'cyan' });
    const coral = new MeshBasicMaterial({ color: 'coral' });
    for (let index = 0; index < 5; index += 1) {
      const mesh = new Mesh(
        new BoxGeometry(1, 1, 1),
        index === 4 ? coral : cyan,
      );
      mesh.position.x = index * 2;
      source.add(mesh);
    }

    const consolidated = consolidateModel(source);

    expect(consolidated.children).toHaveLength(2);
    expect(consolidated.children.every((child) => child instanceof Mesh)).toBe(
      true,
    );
    disposeGroup(consolidated);
  });
});
