import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, FiberRootNode } from './fiber';
import { Container } from './hostConfig';
import { createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue';
import { HostRoot } from './workTags';
import { scheduleUpdateOnFiber } from './workLoop';

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
	console.warn('updateContainer', element);
	const hostRootFiber = root.current;
	const update = createUpdate(element);
	enqueueUpdate(hostRootFiber.updateQueue, update);
	scheduleUpdateOnFiber(hostRootFiber);
	return element;
}
