import {
	appendChildToContainer,
	commitUpdate,
	hideInstance,
	hideTextInstance,
	insertChildToContainer,
	Instance,
	removeChild,
	unhideInstance,
	unhideTextInstance
} from 'react-dom/src/hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	LayoutMask,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Ref,
	Update,
	Visibility
} from './fiberFlags';
import { Container } from './hostConfig';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	OffscreenComponent
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;
// finishedWork: HostRootFiber 且确定有副作用
// 最后 真实DOM--[root], 会连接上所有的真实DOM节点

// ---------------------------------- commitWork主体 --------------------------------- //

// 遍历 fiber 树，对有副作用的节点执行 callback
export const commitEffects = (
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork;
		while (nextEffect !== null) {
			// 向下遍历 (向下寻找 effect 的起点)
			const child: FiberNode | null = nextEffect.child;
			if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
				nextEffect = child;
			} else {
				// 向上遍历 (处理节点并移动到兄弟节点或父节点)
				// 此时的节点一定有副作用
				up: while (nextEffect !== null) {
					callback(nextEffect, root);
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
};

// 处理有副作用的节点
//      Placement
//      Update
//      ChildDeletion
//		PassiveEffect
const commitMutaitonEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork;
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
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
	// flags PassiveEffect
	if ((flags & PassiveEffect) !== NoFlags) {
		commitPassiveEffect(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}
	// flags Ref
	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		safelyDetachRef(finishedWork);
	}
	// flags Visibility (suspense 相关)
	if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
		// 非挂起状态的中间层节点
		// finishedWork = {
		// 	tag: OffscreenComponent,
		// 	pendingProps: {
		// 		mode: 'hidden',
		// 		children: {
		// 			/* MyComponent 对应的 ReactElement 对象 */
		// 		}
		// 	}
		// };
		const isHidden = finishedWork.pendingProps.mode === 'hidden';
		hideOrUnhideAllChildren(finishedWork, isHidden);
		finishedWork.flags &= ~Visibility; // 鱼蹬波 消
	}
};

const commitLayoutEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork;
	if ((flags & Ref) !== NoFlags && tag === HostComponent) {
		safelyAttachRef(finishedWork);
		finishedWork.flags &= ~Ref;
	}
};

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveMask,
	commitMutaitonEffectsOnFiber
);
export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
);

// ---------------------------------- 处理常规副作用: Placement, Deletion --------------------------------- //
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
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
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
				// 解绑 Ref
				safelyDetachRef(unmountFiber);

				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// useEffect unmount, 将该 fiber 的 Effect 链表加入 root.pendingPassiveEffects.unmount
				commitPassiveEffect(unmountFiber, root, 'unmount');
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

// ---------------------------------- 处理 useEffect --------------------------------- //

// ............... 对 Effect 的 unmount, destroy, update 操作 ...............
// 遍历 Effect 链表，对每个匹配 flags 的 Effect 执行 callback
function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	// 链表中第一个 Effect
	let effect = lastEffect.next as Effect;
	do {
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
}

// 用于 unmount
// 遍历 Effect 链表，带有 Passive 标记的，执行清理函数
// 取消标记，永远不会再执行
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
		effect.tag &= ~HookHasEffect;
	});
}

// 用于 update
// 遍历 Effect 链表，带有 Passive | HookHasEffect 标记的，执行清理函数
// 但是不会取消标记，即将执行 create
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
	});
}
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create(); // 作用详见《effect.destroy = create()的作用》.md
		}
	});
}

// 如果遇到带有 PassiveEffect 标记或 ChildDeletion 标记的函数组件
// PassiveEffect 标记：update
// ChildDeletion 标记：unmount
// 将该组件的 Effect 链表的表头，推入 root.pendingPassiveEffects 的 unmount 或 update 数组中。
export function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects // ‘update’ / ‘unmount’
) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在effect');
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
}

// ---------------------------------- 处理 useRef --------------------------------- //

// ref 是对象
// const ref = useRef(initialValue)
// ref.current = 123
// ref 是函数
// ref.current = (dom) => console.warn('dom is:', dom)
function safelyDetachRef(current: FiberNode) {
	const ref = current.ref;

	if (ref !== null) {
		if (typeof ref === 'function') {
			// ref 是函数
			ref(null);
		} else {
			// ref 是对象
			ref.current = null;
		}
	}
}

function safelyAttachRef(fiber: FiberNode) {
	const ref = fiber.ref;
	if (ref !== null) {
		const instance = fiber.stateNode;
		if (typeof ref === 'function') {
			// ref 是函数
			ref(instance);
		} else {
			// ref 是对象
			ref.current = instance;
		}
	}
}
// ---------------------------------- 处理 suspense--------------------------------- //

// 职责：根据 (host类型, isHidden) 有四种 commit 路径, 对子树的顶层 host 节点进行隐藏或者展现
// finishedWork = {
// 	tag: OffscreenComponent,
// 	pendingProps: {
// 		mode: 'hidden',
// 		children: {
// 			/* MyComponent 对应的 ReactElement 对象 */
// 		}
// 	}
// };
function hideOrUnhideAllChildren(finishedWork: FiberNode, isHidden: boolean) {
	findHostSubtreeRoot(finishedWork, (hostRoot) => {
		const instance = hostRoot.stateNode;
		if ((hostRoot.tag = HostComponent)) {
			// div
			isHidden ? hideInstance(instance) : unhideInstance(instance);
		} else if ((hostRoot.tag = HostText)) {
			// 'hello world'
			isHidden
				? hideTextInstance(instance)
				: unhideTextInstance(instance, hostRoot.memoizedProps.content); // hostRoot.memoizedProps.content = 'new hello world'
		}
	});
}

// 先下再上，对子树所有顶层 host 节点进行 callback
// 非常类似 commitEffects() , beginWork() + completeWork()
function findHostSubtreeRoot(
	finishedWork: FiberNode,
	callback: (hostSubtreeRoot: FiberNode) => void
) {
	let hostSubtreeRoot = null; // 当前子树的老大
	let node = finishedWork;
	while (true) {
		// 向下遍历
		if (node.tag === HostComponent) {
			if (hostSubtreeRoot === null) {
				hostSubtreeRoot = node;
				callback(node);
			}
		} else if (node.tag === HostText) {
			if (hostSubtreeRoot === null) {
				callback(node);
			}
		} else if (
			node.tag === OffscreenComponent &&
			node.pendingProps.mode === 'hidden' &&
			node !== finishedWork
		) {
			// pass
		} else if (node.child !== null) {
			// 继续向下
			node.child.return = node;
			node = node.child;
			continue;
		}
		// 边界：到顶了
		if (node === finishedWork) {
			return;
		}
		// 向上, 类似 commit 的流程，向上找到有兄弟节点的
		// 到这里说明此时的 node 类型是 host
		while (node.sibling === null) {
			// 边界：到顶了
			if (node.return === null || node.return === finishedWork) {
				return;
			}
			// 向上时遇到 hostSubtreeRoot === node 说明已经要脱离node的统治区，hostSubtreeRoot 有新的值
			if (hostSubtreeRoot === node) {
				hostSubtreeRoot = null;
			}
			node = node.return;
		}
		// 到这里说明 host 类型的 node 有兄弟节点
		if (hostSubtreeRoot === node) {
			hostSubtreeRoot = null;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
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
