// ---------------------------------- 数据结构 --------------------------------- //

import {
	unstable_getCurrentPriorityLevel,
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { FiberRootNode } from './fiber';

export type Lane = number; // 某次更新的优先级
export type Lanes = number; // lane 的集合

export const NoLane = 0b0000; // 必须被执行以保证状态一致性的“追赶”更新
export const NoLanes = 0b0000;
export const SyncLane = 0b0001; // 最高优先级的同步更新
export const InputContinuousLane = 0b0010;
export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;
// ---------------------------------- 辅助函数 --------------------------------- //

// lane 的输入
export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

// 根据上下文（用户事件 -> unstable_runWithPriority -> unstable_getCurrentPriorityLevel），得到对应的 lane
export function requestUpdateLane() {
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}

// 从一个 Lanes 集合中选出优先级最高的 Lane
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}
// 从 root 中移除此优先级
export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}

// 判断此优先级是否存在于集合
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset;
}

// lane -> scheduler
// lanes 中最高的优先级转换为 Scheduler 对应的优先级
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);
	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}
	return unstable_IdlePriority;
}

// scheduler -> lane
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}
	return NoLane;
}
