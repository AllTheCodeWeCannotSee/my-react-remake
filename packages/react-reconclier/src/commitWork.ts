import { FiberNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';

let nextEffect: FiberNode | null = null;
// finishedWork: HostRootFiber 且确定有副作用
export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;
	while (nextEffect !== null) {
		// 向下遍历 (向下寻找 effect 的起点)
		const child: FiberNode | null = nextEffect.child;
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上遍历 (处理节点并移动到兄弟节点或父节点)
			// 此时的节点一定有副作用
			up: while (nextEffect !== null) {
				commitMutaitonEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

// 处理有副作用的节点
//      Placement
//      Update
//      ChildDeletion
const commitMutaitonEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		// commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
};
