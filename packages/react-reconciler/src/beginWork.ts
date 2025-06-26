import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { renderWithHooks } from './fiberHooks';

// beginWork的工作是处理wip的子节点
export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}
	return null;
};
// ---------------------------------- 各种类型的 wip 对应的更新函数 --------------------------------- //
// 1. 生成子 ReactElement
// 2. 将 ReactElement 传入 reconcileChildren
// 3. 返回 wip.child

// reconcileChildren(wip, <App />)
function updateHostRoot(wip: FiberNode) {
	// baseState = null | <App />
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// pending = { action: <App />}
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending);
	// wip.memoizedState = <App />
	wip.memoizedState = memoizedState;
	// nextChildren = <App />
	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
// reconcileChildren(wip, <p></p>)
// reconcileChildren(wip, 'hello, world')
function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;

	console.warn('nextChildren', nextChildren);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
function updateFunctionComponent(wip: FiberNode) {
	// nextChildren = <span>你好，世界！</span>
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// ---------------------------------- reconcileChildren --------------------------------- //

// updateHostRoot: reconcileChildren(hostRootFiber, <App />)
//      wip: hostRootFiber, nextChildren: <App />
//      生成 <App />
// updateHostComponent: reconcileChildren(wip, <Child />)
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		// fiber.current === null 全等于 mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
