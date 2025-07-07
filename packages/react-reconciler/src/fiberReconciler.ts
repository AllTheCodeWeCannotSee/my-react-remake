import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, FiberRootNode } from './fiber';
import { Container } from './hostConfig';
import { createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue';
import { HostRoot } from './workTags';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLane } from './fiberLanes';
import {
	unstable_ImmediatePriority,
	unstable_runWithPriority
} from 'scheduler';

// ReactDOM.createRoot(root).render(<App/>)
export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const root = new FiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

// ReactDOM.createRoot(root).render(<App/>) 其中的 render
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	// 初始：同步更新
	unstable_runWithPriority(unstable_ImmediatePriority, () => {
		const hostRootFiber = root.current;
		// 获得优先级最高的 lane
		const lane = requestUpdateLane();
		const update = createUpdate(element, lane);
		enqueueUpdate(hostRootFiber.updateQueue, update);
		scheduleUpdateOnFiber(hostRootFiber, lane);
	});

	return element;
}
