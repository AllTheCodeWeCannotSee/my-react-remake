import {
	appendChildToContainer,
	commitUpdate,
	removeChild
} from 'react-dom/src/hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import { Container } from './hostConfig';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

let nextEffect: FiberNode | null = null;
// finishedWork: HostRootFiber 且确定有副作用
// 最后 真实DOM--[root], 会连接上所有的真实DOM节点

// ---------------------------------- commitWork主体 --------------------------------- //
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
	// flags Placement
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	// flags Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
	// flags ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
};

// ---------------------------------- 处理不同的副作用 --------------------------------- //
const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	const hostParent = getHostParent(finishedWork);
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
};

// 删除传入的 FiberNode
function commitDeletion(childToDelete: FiberNode) {
	console.warn('执行Placement操作', childToDelete);
	// rootHostNode 最终指向最接近树顶的 HostNode
	// 也说明了为什么 react 规定 return 必须有一个 HostNode 包裹
	let rootHostNode: FiberNode | null = null;

	const onCommitUnmount = (unmountFiber: FiberNode) => {
		// 作用：除了移除 DOM 节点外，该做的事: useEffect, ref
		// 像是拆除大楼前进行断水断电
		// HostComponent: 设置 rootHostNode 为当前节点
		// HostText: 设置 rootHostNode 为当前节点
		// FunctionComponent: 返回
		switch (unmountFiber.tag) {
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				// TODO 解绑ref
				return;
			case HostText:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			case FunctionComponent:
				// TODO useEffect unmount 、解绑refAdd commentMore actions
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	};
	// 断水断电
	commitNestedComponent(childToDelete, onCommitUnmount);
	// 拆掉大楼
	if (rootHostNode !== null) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent);
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

// ---------------------------------- 辅助函数 --------------------------------- //

// 从给定的 Fiber 节点开始，向上遍历 Fiber 树，直到找到第一个可以直接作为 DOM 的祖先节点
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;

		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}

		if (parentTag === HostRoot) {
			// 如果 parent 是 HostRootFiber，上面的实体 DOM 是 root
			// ReactDOM.createRoot(root).render(<App/>) 中的 root
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.warn('未找到host parent');
	}
	return null;
}

// 将 finishedWork 的真实DOM（存在的话） 或 finishedWork的子节点的真实DOM 连接到 hostParent
function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// 如果 finishedWork 是 Host 类型, 将 finishedWork 的真实 DOM 连接到 hostParent
	// finishedWork 的真实 DOM 在 completeWork 时完成
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}
	// 否则，将 finishedWork 所有子节点中的真实 DOM 连接到 hostParent
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}

// 先序 dfs, 对遍历到的节点进行 onCommitUnmount
function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}
