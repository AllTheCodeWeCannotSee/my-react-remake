import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { FiberNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';

// beginWork的工作是处理wip的子节点
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip);
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
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	// baseState = null | <App />
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	// pending = { action: <App />}
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	// wip.memoizedState = <App />
	wip.memoizedState = memoizedState;
	// nextChildren = <App />
	const nextChildren = wip.memoizedState;
	// 标记 Ref
	markRef(wip.alternate, wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
// reconcileChildren(wip, <p></p>)
// reconcileChildren(wip, 'hello, world')
function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	// nextChildren = <span>你好，世界！</span>
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// const ctxA = createContext('deafult A');

// <ctxA.Provider value={'A1'}>
// 	<Cpn />
// </ctxA.Provider>
function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type; // providerType = ctxA.Provider
	const context = providerType._context; // context = ctxA
	const newProps = wip.pendingProps;

	pushProvider(context, newProps.value);

	const nextChildren = newProps.children;
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
// ---------------------------------- 辅助函数 --------------------------------- //
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;
	// 旧的没有，新的有ref
	// 旧的有，但是ref不一样
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
