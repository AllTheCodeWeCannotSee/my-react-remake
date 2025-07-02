import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import {
	getHighestPriorityLane,
	Lane,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane; // 此时此刻，正在渲染的优先级

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateFromFiberToRoot(fiber);
	// 将新 lane 加入到根
	markRootUpdated(root, lane);
	// 开启 schedule
	ensureRootIsScheduled(root);
}

// ---------------------------------- 辅助函数 --------------------------------- //
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
// 将 lane 加入到根
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// ---------------------------------- schedule 阶段 --------------------------------- //

// schedule阶段入口
// 获取最高优先级的更新，并调度执行
function ensureRootIsScheduled(root: FiberRootNode) {
	// 找到最高优先级的 lane
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	// lane = NoLane, 没有更新, 结束调度
	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// lane = 同步优先级, 用微任务调度
		if (__DEV__) {
			console.log('在微任务中调度，优先级：', updateLane);
		}
		// 将同步 render 任务放入队列
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		// 在微任务中执行同步 render
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// TODO: 其他优先级 用宏任务调度
	}
}

// ---------------------------------- render阶段 --------------------------------- //

// 之前的 renderRoot()
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	// lane: 打算要进行 render 的 ( SyncLane 类型的)
	// nextLane: 此时此刻根上最高优先级的
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	// 如果根上最高优先级不是 SyncLane, 说明误入此函数, 需要返回
	// 什么情况下会发生？ 见《什么情况下performSyncWorkOnRoot会出现nextLane!==SyncLane.md》
	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);
		return;
	}

	if (__DEV__) {
		console.warn('render阶段开始');
	}

	// 生成新的缓冲树，设置当前渲染任务的优先级
	prepareFreshStack(root, lane);
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
	root.finishedLane = lane;
	// 重置当前 render 的 lane
	wipRootRenderLane = NoLane;
	commitRoot(root);
}

// 生成新缓冲树, wip赋值为 hostRootFiber, 设置正在渲染的任务的优先级
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane);
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
	const lane = root.finishedLane;
	// 既然完成 render 工作， root.finishedLane 不可能为 NoLane
	if (lane === NoLane && __DEV__) {
		console.error('commit阶段finishedLane不应该是NoLane');
	}
	// 1. 双缓冲树的游标 finishedWork 重置、finishedLane 重置、标记该次更新的lane已完成
	root.finishedWork = null;
	root.finishedLane = NoLane;
	markRootFinished(root, lane);

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
