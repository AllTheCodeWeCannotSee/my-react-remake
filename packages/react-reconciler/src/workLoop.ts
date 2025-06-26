import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

export function scheduleUpdateOnFiber(fiber: FiberNode) {
	const root = markUpdateFromFiberToRoot(fiber);
	renderRoot(root);
}

// 向上遍历，找到 fiberRootNode
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	while (node.return !== null) {
		node = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

// ---------------------------------- render阶段 --------------------------------- //
function renderRoot(root: FiberRootNode) {
	prepareFreshStack(root);
	while (true) {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	}
	// 切换缓冲树
	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;
	commitRoot(root);
}

// 生成新缓冲树, wip赋值为 hostRootFiber
function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
	// pendingProps 存储的是即将应用到组件的新的 props。
	// memoizedProps 存储的是上一次渲染过程中实际应用到组件的 props。
	// 只有当 beginWork 完成后，如果确定需要更新组件，memoizedProps 才会更新为 pendingProps 的值。
	// 在后续的渲染过程中，React 会使用 memoizedProps 来进行各种计算和优化
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	while (node !== null) {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = node;
	}
}

// ---------------------------------- commit阶段 --------------------------------- //
// commit 三个阶段
// 		beforeMutation
// 		mutation
// 		layout
function commitRoot(root: FiberRootNode) {
	// finishedWork: HostFiberNode, 新生成的缓冲树
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	// 1. 双缓冲树的游标 finishedWork 重置
	root.finishedWork = null;
	// 2. 判断是否需要进行三个子阶段
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
	// 3. 处理
	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation
		commitMutationEffects(finishedWork);
		// 4. 切换双缓冲树
		root.current = finishedWork;

		// layout
	} else {
		// 4. 切换双缓冲树
		root.current = finishedWork;
	}
}
