import { Key, Props, Ref } from 'shared/ReactTypes';
import { Container } from './hostConfig';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;
	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		// this.finishedWork: 双缓冲机制中那个已经“绘制”完成，等待被展示的“后台缓冲区”
		this.finishedWork = null;

		hostRootFiber.stateNode = this;
	}
}

export class FiberNode {
	tag: WorkTag;
	// ---------------------------------- 源自ReactElement --------------------------------- //
	// babel编译jsx得到的type
	// <div>: type = "div"
	type: any;
	key: Key;
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
	flags: Flags;
	updateQueue: any;
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
		this.flags = NoFlags;
		// ---------------------------------- DOM --------------------------------- //
		this.stateNode = null;
	}
}

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
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags; // why
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue; // why
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps; // why
	wip.memoizedState = current.memoizedState; // why

	return wip;
};
