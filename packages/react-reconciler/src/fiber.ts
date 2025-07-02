import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { Container } from './hostConfig';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';

// ---------------------------------- 各种节点类型 --------------------------------- //
export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;

	// lane 模型
	pendingLanes: Lanes; // 积累的更新
	finishedLane: Lane; // 本次的完成渲染的更新的优先级

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		// this.finishedWork: 双缓冲机制中那个已经“绘制”完成，等待被展示的“后台缓冲区”
		this.finishedWork = null;

		// lane 模型
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;

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

	return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
	// HostElement: type = 'div', 'p', ...
	// FunctionComponent: type = function本身
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
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
