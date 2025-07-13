import { Wakeable } from 'shared/ReactTypes';
import { FiberRootNode } from './fiber';
import { Lane, markRootPinged } from './fiberLanes';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';

// 找到此 promise 最近的外层 <suspense>，进行标记
// 用回调函数实现：promise 完成后重新触发整个更新流程：走 <suspense> -> <offscreen> -> <cpn> 流程
export function throwException(root: FiberRootNode, value: any, lane: Lane) {
	// value 是一个 promise
	if (
		value !== null &&
		typeof value === 'object' &&
		typeof value.then === 'function'
	) {
		const wakeable: Wakeable = value;
		// 外层最近的 <suspense>
		const suspenseBoundary = getSuspenseHandler();
		if (suspenseBoundary) {
			// ShouldCapture 的生产
			suspenseBoundary.flags |= ShouldCapture;
		}
		attachPingListener(root, wakeable, lane);
	}
}
// ---------------------------------- 辅助函数 --------------------------------- //

// 1. 在 root 上登记此 promise
// 2. 当 promise 完成后触发整个更新流程
// ...........................................................
// const pingCache = new WeakMap([
// 	[promiseForProduct, new Set([4, 16])],
// 	[promiseForRelated, new Set([4])]
// ]);
// ...........................................................
function attachPingListener(
	root: FiberRootNode,
	wakeable: Wakeable<any>,
	lane: Lane
) {
	let pingCache = root.pingCache;
	let threadIDs: Set<Lane> | undefined;
	// 初始化 pingCache
	if (pingCache === null) {
		// 不存在 pingCache
		threadIDs = new Set<Lane>(); // 对应此 promise 的 lane 集合
		pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
		pingCache.set(wakeable, threadIDs);
	} else {
		// 存在 pingCache
		threadIDs = pingCache.get(wakeable);
		if (threadIDs === undefined) {
			threadIDs = new Set<Lane>();
			pingCache.set(wakeable, threadIDs);
		}
	}
	// 如果此 (promise, lane) 在 pingCache, 说明已经登记过，不需要重复叫醒
	if (!threadIDs.has(lane)) {
		threadIDs.add(lane);
		function ping() {
			if (pingCache !== null) {
				pingCache.delete(wakeable);
			}
			// 将 lane 加到root.pendingLanes
			markRootUpdated(root, lane);
			// 将 lane 加到root.pingedLanes
			markRootPinged(root, lane);
			// 触发更新
			ensureRootIsScheduled(root);
		}
		wakeable.then(ping, ping);
	}
}
