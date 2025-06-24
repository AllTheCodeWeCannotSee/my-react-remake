import { FiberNode } from './fiber';
import { NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

export const completeWork = (wip: FiberNode) => {
	// const newProps = wip.pendingProps;
	// const current = wip.alternate;
	switch (wip.tag) {
		case HostRoot:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}
