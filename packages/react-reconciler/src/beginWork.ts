import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import {
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress,
	FiberNode,
	OffscreenProps
} from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import {
	ChildDeletion,
	DidCapture,
	NoFlags,
	Placement,
	Ref
} from './fiberFlags';
import { pushProvider } from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';

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
		case SuspenseComponent:
			return updateSuspenseComponent(wip);
		case OffscreenComponent:
			return updateOffscreenComponent(wip);
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
// 职责：根据(current, showFallback) ，从四种路径选一个创建 <Suspense> 与 <child> 的中间层
// wip = {
//     tag: SuspenseComponent,
//     flags: NoFlags,
//     pendingProps: {
//         children: <MyLazyComponent />,
//         fallback: <p>Loading...</p>
//     }
// };
function updateSuspenseComponent(wip: FiberNode) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;

	let showFallback = false;
	const didSuspend = (wip.flags & DidCapture) !== NoFlags;
	if (didSuspend) {
		// 挂起
		showFallback = true;
		wip.flags &= ~DidCapture;
	}
	const nextPrimaryChildren = nextProps.children; // <MyLazyComponent />
	const nextFallbackChildren = nextProps.fallback; // <p>Loading...</p>

	// 确定活跃边界，为了处理嵌套的情况
	pushSuspenseHandler(wip);

	if (current === null) {
		// mount
		if (showFallback) {
			// fallback
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// children
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// fallback
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// children
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

// 	pendingProps: {
// 		mode: 'visible',
// 		children: {<MyLazyComponent />}
// 	}
// 职责：fiber(tag: OffscreenComponent, pendingProps:primaryChildProps) -> fiber(children)
function updateOffscreenComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
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
// ............ ref ............
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

// ............ suspense ............
// const suspenseFiberNode = {
//     tag: SuspenseComponent
//     type: Symbol.for('react.suspense'),
//     pendingProps: {
//         fallback: ReactElement(<p></p>)
//         children: ReactElement(<MyComponent />)
//     }
// };

// mount children
// 职责：fiber(Suspense) ---> fiber(tag: OffscreenComponent, pendingProps:primaryChildProps)
function mountSuspensePrimaryChildren(
	workInProgress: FiberNode, // workInProgress = fiber(<Suspense>...</Suspense>)
	primaryChildren: any // primaryChildren = <MyLazyComponent />
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	// 构建一个子节点：<Suspense> ---> <Offscreen>
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	workInProgress.child = primaryChildFragment;
	primaryChildFragment.return = workInProgress;
	return primaryChildFragment;
}
// mount fallback
function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	// 构建两个子节点
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

	// fallback 加 placement标记 (详见《为什么在beginWork阶段mount一个fallback要打上placement标记？》)
	fallbackChildFragment.flags |= Placement;

	// 连接两个子节点
	primaryChildFragment.return = wip; // <Suspense> ---> <Offscreen>
	fallbackChildFragment.return = wip; // <Suspense> ---> <Fragment>
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}
// update children
function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	// 一些老树上的变量
	const current = wip.alternate as FiberNode; // <Suspense>
	const currentPrimaryChildFragment = current.child as FiberNode; // <Offscreen>
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling; // <Fragment>

	// 新树上的 Offscreen 的 pendingProps
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	// update -> current 存在； PrimaryChildren -> currentPrimaryChildFragment 存在
	// 中间层：<Offscreen>
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	// 连接成树: wip -> 中间层 <Offscreen>
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	// 如果老树的中间层 fallback 存在，删除他
	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}
// update fallback
// fiber(Suspense) ---> fiber(tag: OffscreenComponent, pendingProps:primaryChildProps)
// fiber(Suspense) ---> fiber(tag: Fragment, pendingProps:fallbackChildren)
function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	// 一些老树上的变量
	const current = wip.alternate as FiberNode; // <Suspense>
	const currentPrimaryChildFragment = current.child as FiberNode; // <Offscreen>
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling; // <Fragment>

	// 新树上的 Offscreen 的 pendingProps
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	// 中间层：<Offscreen>
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);

	// 中间层：<Fragment>
	let fallbackChildFragment;
	if (currentFallbackChildFragment !== null) {
		// 上次就渲染的的是 fallback，可复用
		fallbackChildFragment = createWorkInProgress(
			currentFallbackChildFragment,
			fallbackChildren
		);
	} else {
		// 上次渲染的是 children，不可复用
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
		// fallback 加 placement标记 (详见《为什么在beginWork阶段mount一个fallback要打上placement标记？》)
		fallbackChildFragment.flags |= Placement;
	}
	// 连接成树
	fallbackChildFragment.return = wip;
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}
