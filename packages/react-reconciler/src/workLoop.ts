import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import {
	HostEffectMask,
	MutationMask,
	NoFlags,
	PassiveMask
} from './fiberFlags';
import {
	getHighestPriorityLane,
	getNextLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	markRootSuspended,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import { HookHasEffect, Passive } from './hookEffectTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_cancelCallback,
	unstable_shouldYield
} from 'scheduler';
import { getSuspenseThenable, SuspenseException } from './thenable';
import { resetHooksOnUnwind } from './fiberHooks';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane; // 此时此刻，正在渲染的优先级
let rootDoesHasPassiveEffects: boolean = false; // 锁，具体见《rootDoesHasPassiveEffects的作用.md》

const RootInComplete = 1; // 渲染中断
const RootCompleted = 2; // 渲染完成

// ............ suspense ............
const RootInProgress = 0;
const RootDidNotComplete = 3; // 表示遇到了 use(promise) 被挂起
const NotSuspended = 0; // 未挂起
const SuspendedOnData = 6; // 挂起的原因：请求数据
type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;

// wip 代表的是内部使用了 use(Promise()) 的 <Cpn>
let workInProgressSuspendedReason: SuspendedReason = NotSuspended; // 挂起的原因
let workInProgressThrownValue: any = null; // 导致挂起的 Promise
let workInProgressRootExitStatus: number = RootInProgress;

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateLaneFromFiberToRoot(fiber, lane);
	// 将新 lane 加入到根
	markRootUpdated(root, lane);
	// 开启 schedule
	ensureRootIsScheduled(root);
}

// ---------------------------------- 辅助函数 --------------------------------- //
// 向上遍历，找到 fiberRootNode
// childLanes 的生产：从 fiber 的父节点到根，更新其 childLanes
function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		parent.childLanes = mergeLanes(parent.childLanes, lane);

		// 先把阶段成果保存在 current，以免打断后丢失计算出的数据
		const alternate = parent.alternate;
		if (alternate !== null) {
			alternate.childLanes = mergeLanes(alternate.childLanes, lane);
		}

		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}
// 将 lane 加入到根
export function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// ---------------------------------- schedule 阶段 --------------------------------- //

// schedule阶段入口
// 获取最高优先级的更新，并调度执行
export function ensureRootIsScheduled(root: FiberRootNode) {
	// 最高优先级的 lane
	const updateLane = getNextLane(root);
	// 已经提交给 Scheduler 的那个任务
	const existingCallback = root.callbackNode;
	// 1. 没有更新 -> 取消旧任务，返回
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;
	// 2. 新任务的优先级 === 正在处理的任务的优先级: 计划不变，结束 schedule
	if (curPriority === prevPriority) {
		return;
	}

	// 3. 新任务的优先级 !== 正在处理的任务的优先级 -> 计划有变，
	// 3.1 取消旧调度
	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}
	// 3.2 开启新调度
	let newCallbackNode = null;
	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`,
			updateLane
		);
	}
	if (updateLane === SyncLane) {
		// 同步优先级 -> 用微任务调度
		// 将同步任务放入数组
		// [performSyncWorkOnRoot, performSyncWorkOnRoot, performSyncWorkOnRoot]
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		// 在微任务中执行同步任务
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 -> 用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		// 将并发任务放入队列
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

// ---------------------------------- render 阶段 --------------------------------- //

// 同步更新的入口
// 一个渲染整棵树的任务
function performSyncWorkOnRoot(root: FiberRootNode) {
	// nextLane: 此时此刻根上最高优先级的
	const nextLane = getNextLane(root);

	// 如果根上最高优先级不是 SyncLane, 说明误入此函数, 需要返回
	// 什么情况下会发生？ 见《什么情况下performSyncWorkOnRoot会出现nextLane!==SyncLane.md》
	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);
		return;
	}

	// 执行同步的 renderRoot，正常情况下 exitStatus 的结果必是 RootCompleted, 被挂起过就是RootDidNotComplete
	const exitStatus = renderRoot(root, nextLane, false);
	switch (exitStatus) {
		case RootCompleted:
			// render 阶段正常结束
			// 首次给 root.finishedWork 赋值，其为 commitWork 的主角
			const finishedWork = root.current.alternate;
			root.finishedWork = finishedWork;
			root.finishedLane = nextLane;
			// 重置当前 render 的 lane
			wipRootRenderLane = NoLane;
			commitRoot(root);
			break;
		case RootDidNotComplete:
			// render 阶段被挂起
			wipRootRenderLane = NoLane;
			markRootSuspended(root, nextLane);
			ensureRootIsScheduled(root);
			break;
		default:
			if (__DEV__) {
				console.error('还未实现的同步更新结束状态');
			}
			break;
	}
}

// 并发更新的入口
function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean //由 Scheduler 传入，告知任务是否已超时
): any {
	const curCallback = root.callbackNode;
	// 清理 useEffect
	// 这次清理副作用，真的有活干吗？
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		// 真的处理 Effect 了！
		if (root.callbackNode !== curCallback) {
			// Effect 导致更新，更新导致 root.callbackNode 发生变化 -> 抛弃现在的任务
			return null;
		}
	}
	// 本次更新的任务
	const lane = getNextLane(root);
	const curCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return;
	}

	// 兜底同步任务
	// 即便不是同步任务，等待时间久了，当作同步任务
	const needSync = lane === SyncLane || didTimeout;
	// needSync === true -> 同步 render
	// needSync === false -> 并发 render
	const exitStatus = renderRoot(root, lane, !needSync);
	// 干完一件事，抬头看路
	// 1. 看看有没有更高优先级的
	// 2. 看看有没有没打断的
	ensureRootIsScheduled(root);

	// 任务完成 -> commit 阶段
	// 任务中断 -> 继续执行
	if (exitStatus === RootInComplete) {
		// render 被中断过
		if (root.callbackNode !== curCallbackNode) {
			// 优先级不足，返回
			return null;
		}
		// return 的原因：通知 Scheduler 这个任务完成后，下一步的任务
		// 此时，整棵 Fiber 树的协调工作只完成了一部分，workInProgress 指针还指向着下一个需要处理的节点。工作不能就此丢弃。
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	if (exitStatus === RootCompleted) {
		// render 完成
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现的并发更新结束状态');
	}
}

// 根据 shouldTimeSlice 决定是同步还是并发 workLoop
// 同步：完成整个 render，形成一整个 fiber tree
// 并发：建树建到时间片结束，返回 RootInComplete
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
	}
	if (wipRootRenderLane !== lane) {
		// 1. 首次渲染
		// 2. 优先级更高的更新到来 -> 丢弃 wip 树
		// 3. 上一个任务完成
		prepareFreshStack(root, lane);
	}
	// [错误恢复机制]
	// 正常：break退出
	do {
		try {
			// 处理上一次因 Suspense 而中断的任务
			if (
				workInProgressSuspendedReason !== NotSuspended &&
				workInProgress !== null
			) {
				const thrownValue = workInProgressThrownValue;
				// 重置
				workInProgressSuspendedReason = NotSuspended;
				workInProgressThrownValue = null;
				// 处理
				throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
			}

			// 上次没有因 suspense 中断
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			// 捕获 SuspenseException，根据 promise 设置全局状态
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			handleThrow(root, e);
		}
	} while (true);

	// 直到 root 也没找到错误边界，workInProgressRootExitStatus === RootDidNotComplete
	if (workInProgressRootExitStatus !== RootInProgress) {
		return workInProgressRootExitStatus;
	}
	// 如果渲染中断
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}
	// 错误：未中断，任务也没结束
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段结束时wip不应该不是null`);
	}
	// 渲染完成
	return RootCompleted;
}

// 生成新缓冲树, wip赋值为 hostRootFiber, 设置正在渲染的任务的优先级
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	// commit
	root.finishedLane = NoLane;
	root.finishedWork = null;
	// lane 全局
	wipRootRenderLane = lane;
	// suspense 全局
	workInProgressRootExitStatus = RootInProgress;
	workInProgressSuspendedReason = NotSuspended;
	workInProgressThrownValue = null;
	// 本体
	workInProgress = createWorkInProgress(root.current, {});
}

// 并发 workLoop
function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}
// 同步 workLoop
function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

// 向下 beginWork 一下，或者向上 completeWork 一条线
// 如果 beginWork 阶段: beginWork 一个节点
// 如果 completeWork 阶段: 向上 completeWork 直到父亲有兄弟
// A -> B -> C
// beginWork: performUnitOfWork(A) = beginWork(A)
// completeWork: performUnitOfWork(C) = completeWork(C) & completeWork(B) & completeWork(A)
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

// wip 有兄弟节点: completeWork(wip) -> return -> (接下来会回到 performUnitOfWork 去 beginWork 兄弟节点)
// wip 无兄弟节点: 向上 completeWork 直到父亲有兄弟
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

// ............ unwind.........

// 职责：处理 renderRoot 抛出的错误
// 错误的可能：1. use thenable 2. error
function handleThrow(root: FiberRootNode, thrownValue: any): void {
	if (thrownValue === SuspenseException) {
		// 1. use thenable
		workInProgressSuspendedReason = SuspendedOnData;
		thrownValue = getSuspenseThenable();
	} else {
		// 2. error
	}
	workInProgressThrownValue = thrownValue;
}

// 处理上一次因 Suspense 而中断的任务。throw (处理被抛出的值)，unwind (回溯工作流)
function throwAndUnwindWorkLoop(
	root: FiberRootNode,
	unitOfWork: FiberNode, // 用了 use(Promise()) 的 <Cpn>
	thrownValue: any,
	lane: Lane
) {
	// 重置 FC 全局变量
	resetHooksOnUnwind(unitOfWork);
	// promise 返回后重新触发更新：走 <suspense> -> <offscreen> -> <cpn> 流程
	throwException(root, thrownValue, lane);
	// unwind
	unwindUnitOfWork(unitOfWork);
}
// unwind
// 向上遍历，找到最近的 <suspense>
function unwindUnitOfWork(unitOfWork: FiberNode) {
	let incompleteWork: FiberNode | null = unitOfWork;
	do {
		const next = unwindWork(incompleteWork);
		// 找到了 <suspense> 边界, next = <suspense>
		if (next !== null) {
			next.flags &= HostEffectMask;
			workInProgress = next;
			return;
		}
		// 找到的是<context> 边界，或者没找到边界: 继续向上遍历
		const returnFiber = incompleteWork.return as FiberNode;
		if (returnFiber !== null) {
			returnFiber.deletions = null;
		}
		incompleteWork = returnFiber;
	} while (incompleteWork !== null);
	// 直到 root 也没找到 <suspense>
	workInProgress = null;
	workInProgressRootExitStatus = RootDidNotComplete;
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

	// 2. 异步执行
	// 放在第二步是因为需要的 PassiveMask 会在第三步清除
	// 但其实是在第三步的同步代码执行后，浏览器空闲后（NormalPriority）才执行 flushPassiveEffects
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true; // 上锁
			scheduleCallback(NormalPriority, () => {
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 3. 处理同步的 DOM 变更、推送 Effect 链表的表头到 root.pendingPassiveEffects
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// 1/3 beforeMutation
		// 2/3 mutation
		commitMutationEffects(finishedWork, root);
		// 3. 切换双缓冲树
		root.current = finishedWork;

		// 3/3 layout
		commitLayoutEffects(finishedWork, root);
	} else {
		// 3. 切换双缓冲树
		root.current = finishedWork;
	}
	rootDoesHasPassiveEffects = false; // 解锁
	ensureRootIsScheduled(root); // 处理剩余的渲染任务，比如因为被高优先级打断的低优先级任务
}

// 处理存在 root 上的 Effect
// 是异步执行的，在宏任务内
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	// 干活了吗？
	let didFlushPassiveEffect = false;
	// ............... 处理 unmount ...............
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true; // 真的干了！
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];
	// ............... 处理 update ...............
	// 1. destroy
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true; // 真的干了！
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});
	// 2. create
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true; // 真的干了！
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];

	// ............... 处理在执行 useEffect 的回调函数时，触发的同步更新 ...............
	flushSyncCallbacks();

	return didFlushPassiveEffect; // 没干活!
}
