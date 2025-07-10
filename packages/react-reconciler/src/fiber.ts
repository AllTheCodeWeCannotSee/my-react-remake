import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { Container } from './hostConfig';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	OffscreenComponent,
	SuspenseComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';
import { REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from 'shared/ReactSymbols';

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

// <Suspense> --> <Fragment>/<Offscreen> --> <Fallback>/<children>
// OffscreenProps 是 <Fragment>/<Offscreen> 的 pendingProps
// OffscreenProps.children 是 <Fallback>/<children> 的 pendingProps
export interface OffscreenProps {
	mode: 'visible' | 'hidden';
	children: any;
}

// ---------------------------------- 各种节点类型 --------------------------------- //
export class FiberRootNode {
	container: Container;
	// 缓冲树模型
	current: FiberNode;
	finishedWork: FiberNode | null; // 双缓冲机制中那个已经“绘制”完成，等待被展示的“后台缓冲区”
	// lane 模型
	pendingLanes: Lanes; // 积累的更新
	finishedLane: Lane; // 本次的完成渲染的更新的优先级
	// 处理useEffect
	pendingPassiveEffects: PendingPassiveEffects;
	// 并发
	callbackNode: CallbackNode | null; // 已经提交给 Scheduler 的那个任务
	callbackPriority: Lane; // 当前 callback 的优先级

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
		this.callbackNode = null;
		this.callbackPriority = NoLane;

		hostRootFiber.stateNode = this;
	}
}

export class FiberNode {
	tag: WorkTag;
	// ---------------------------------- 源自ReactElement --------------------------------- //
	// babel编译jsx得到的type
	// <div>: type = "div"
	type: any;
	key: Key | null;
	ref: Ref;
	pendingProps: Props;
	// ---------------------------------- 树形结构 --------------------------------- //
	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	alternate: FiberNode | null;
	// ---------------------------------- 状态 --------------------------------- //
	memoizedProps: Props | null;
	memoizedState: any;
	updateQueue: any;
	// ---------------------------------- 副作用 --------------------------------- //
	flags: Flags;
	subtreeFlags: Flags;
	deletions: FiberNode[] | null;
	// ---------------------------------- DOM --------------------------------- //
	stateNode: any;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		// ---------------------------------- 源自ReactElement --------------------------------- //
		this.type = null;
		this.key = key;
		this.ref = null;
		this.pendingProps = pendingProps;
		// ---------------------------------- 树形结构 --------------------------------- //
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;
		this.alternate = null;
		// ---------------------------------- 状态 --------------------------------- //
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;
		// ---------------------------------- 副作用 --------------------------------- //
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
		// ---------------------------------- DOM --------------------------------- //
		this.stateNode = null;
	}
}

// ---------------------------------- 辅助函数 --------------------------------- //
// mount: 创建一个新的 FiberNode
// update: 复用老节点
export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;
	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps; // 生成双缓冲树时，继承
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	// ---------------------------------- 生成双缓冲树时，继承 --------------------------------- //
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	wip.ref = current.ref;

	return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
	// HostElement: type = 'div', 'p', ...
	// FunctionComponent: type = function本身
	const { type, key, props, ref } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// host
		fiberTag = HostComponent;
	} else if (
		// context.provider
		typeof type === 'object' &&
		type.$$typeof === REACT_PROVIDER_TYPE
	) {
		fiberTag = ContextProvider;
	} else if (type === REACT_SUSPENSE_TYPE) {
		// suspense
		fiberTag = SuspenseComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.ref = ref;
	return fiber;
}

// elements: [
//       jsx("div", {}),
//       jsx("div", {})
//   	]
export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}

export function createFiberFromOffscreen(pendingProps: OffscreenProps) {
	const fiber = new FiberNode(OffscreenComponent, pendingProps, null);
	return fiber;
}
