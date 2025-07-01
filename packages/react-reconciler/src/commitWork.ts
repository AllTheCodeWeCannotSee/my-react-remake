import {
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	Instance,
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
	const sibling = getHostSibling(finishedWork);

	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

// 删除传入的 FiberNode
function commitDeletion(childToDelete: FiberNode) {
	console.warn('执行Placement操作', childToDelete);

	// 收集要移除的、最接近 childToDelete  的宿主节点
	const rootChildrenToDelete: FiberNode[] = [];

	const onCommitUnmount = (unmountFiber: FiberNode) => {
		// 作用：除了移除 DOM 节点外，该做的事: useEffect, ref
		// 像是拆除大楼前进行断水断电
		// HostComponent:
		// HostText:
		// FunctionComponent: 返回
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// TODO 解绑ref
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
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
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
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

// 找到 fiber 在当前 subtree 中的兄弟节点的真实 DOM。subtree 的根是 Host 类型的节点
// 例子1：
// A -> B1
//	 -> B2
// B1 会返回 B2 的真实 DOM
// 例子2:
// A -> B: B 因为没有兄弟节点了，就返回 null
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber; // 游标
	findSibling: while (true) {
		// 如果没有兄弟fiber，就向上找，直到祖先节点有另外一个孩子，就结束循环
		while (node.sibling === null) {
			const parent = node.return;
			if (
				// 如果祖先节点 1. HostComponent 2.或是 HostRoot 3.或是 root
				// 意味着当前 subtree 找不到兄弟节点了，结束工作，return 整个 getHostSibling
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}
			node = parent;
		}
		// 运行到此，意味着找到了一个兄弟
		node.sibling.return = node.return;
		node = node.sibling;

		// 向下查找，找到这个兄弟节点的第一个真实 DOM
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// node 是 Host: 要找的就是它！结束循环
			// node 非 Host: 如果 node 1.不稳定 2.或没有子节点了。就执行 findSibling 找到兄弟的兄弟
			// node 非 Host: 如果 node 稳定且有子节点。就继续向下找
			if ((node.flags & Placement) !== NoFlags) {
				// 节点不稳定
				// 优化策略：跳过这整颗子树
				continue findSibling;
			}
			if (node.child === null) {
				// 没有子节点了
				continue findSibling;
			}
			node.child.return = node;
			node = node.child;
		}
		// 运行到此，说明找到了 Host 类型的兄弟节点
		// 父节点稳定不一定确保此时的 node 稳定，一定要进行这个判断
		if ((node.flags & Placement) === NoFlags) {
			// 节点稳定
			return node.stateNode;
		}
	}
}

// 将 finishedWork 的真实DOM（存在的话） 或 finishedWork的子节点的真实DOM 连接到 hostParent
function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	// 如果 finishedWork 是 Host 类型, 将 finishedWork 的真实 DOM 连接到 hostParent
	// finishedWork 的真实 DOM 在 completeWork 时完成
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			// 存在拥有真实 DOM 的 兄弟节点（此时的兄弟指的是真实DOM树中，而不是 fiber 树）
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}
	// 否则，将 finishedWork 所有子节点中的真实 DOM 连接到 hostParent
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
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

// 收集 unmountFiber 这个子树的最上层的 Host 类型的节点
function recordHostChildrenToDelete(
	childToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	const lastOne = childToDelete[childToDelete.length - 1];
	if (!lastOne) {
		// subtree 中第一个 Host 类型的节点
		childToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				// unmountFiber 是最上层的 Host 之一
				childToDelete.push(unmountFiber);
			}
			// 已有 unmountFiber 的父节点入队
			node = node.sibling;
		}
	}
}
