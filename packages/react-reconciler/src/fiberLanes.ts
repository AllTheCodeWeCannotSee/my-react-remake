// ---------------------------------- 数据结构 --------------------------------- //

import { FiberRootNode } from './fiber';

export type Lane = number; // 某次更新的优先级
export type Lanes = number; // lane 的集合

export const SyncLane = 0b0001; // 最高优先级的同步更新
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

// ---------------------------------- 辅助函数 --------------------------------- //

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

// 从一个 Lanes 集合中选出优先级最高的 Lane
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
