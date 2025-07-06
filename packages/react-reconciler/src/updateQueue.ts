import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes';

// ---------------------------------- Update --------------------------------- //
// 触发更新的方式1. ReactDOM.createRoot().render
// Update = { action: <App />}
export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};
// ---------------------------------- UpdateQueue --------------------------------- //
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// <ul
//     onClickCapture={() => {
//         setNum((num) => num + 1); // 更新A
//         setNum((num) => num + 1); // 更新B
//         setNum((num) => num + 1); // 更新C
//     }}
// >
//     {num}
// </ul>

// // 这是 `pending` 变量在某一时刻的快照
// const pending = {
//     // === 这是最后一次更新（更新C） ===
//     action: (num) => num + 1,
//     lane: 1, // SyncLane
//     next: { // 指向第一个更新，形成环
//         // === 这是第一次更新（更新A） ===
//         action: (num) => num + 1,
//         lane: 1, // SyncLane
//         next: {
//             // === 这是第二次更新（更新B） ===
//             action: (num) => num + 1,
//             lane: 1, // SyncLane
//             next: null // 在代码中这里会指向第三个更新，也就是它自己
//                       // 为了清晰，我将它展开，实际上它指向最外层的对象
//         }
//     }
// };

// // 为了让结构更清晰，我们把环形链表的关系理顺：
// const updateA = pendingUpdate.next;
// const updateB = updateA.next;
// const updateC = pendingUpdate; // 或者 updateB.next

// // 它们之间的关系是：
// // updateC.next === updateA;
// // updateA.next === updateB;
// // updateB.next === updateC;
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;

	// 循环链表
	if (pending === null) {
		// 第1次：A -> A
		update.next = update;
	} else {
		// 第2次：B -> A
		update.next = pending.next;
		// 第2次：A -> B
		pending.next = update;
	}
	// 第1次：pending -> A
	// 第2次：pending -> B
	updateQueue.shared.pending = update;
};

// <ul
//     onClickCapture={() => {
//         setNum((num) => num + 1); // 更新A
//         setNum((num) => num + 1); // 更新B
//         setNum((num) => num + 1); // 更新C
//     }}
// >
//     {num}
// </ul>

// // 这是 `pendingUpdate` 变量在某一时刻的快照
// const pendingUpdate = {
//     // === 这是最后一次更新（更新C） ===
//     action: (num) => num + 1,
//     lane: 1, // SyncLane
//     next: { // 指向第一个更新，形成环
//         // === 这是第一次更新（更新A） ===
//         action: (num) => num + 1,
//         lane: 1, // SyncLane
//         next: {
//             // === 这是第二次更新（更新B） ===
//             action: (num) => num + 1,
//             lane: 1, // SyncLane
//             next: null // 在代码中这里会指向第三个更新，也就是它自己
//                       // 为了清晰，我将它展开，实际上它指向最外层的对象
//         }
//     }
// };

// // 为了让结构更清晰，我们把环形链表的关系理顺：
// const updateA = pendingUpdate.next;
// const updateB = updateA.next;
// const updateC = pendingUpdate; // 或者 updateB.next

// // 它们之间的关系是：
// // updateC.next === updateA;
// // updateA.next === updateB;
// // updateB.next === updateC;
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	// result = { memoizedState: 100}
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState, // baseState: 最后一个没被跳过的update计算后的结果
		baseQueue: null // baseQueue: 被跳过的update及其后面的所有update
	};
	if (pendingUpdate !== null) {
		// first 指向 A, 即最旧的更新任务
		const first = pendingUpdate.next;
		// pending 指向 A
		let pending = pendingUpdate.next as Update<any>;

		// state 可中断机制
		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		let newState = baseState; // 保证一定是连续的

		// 遍历所有的 setNum
		do {
			// 此 update 对应的优先级
			const updateLane = pending.lane;

			// 如果优先级不够 -> 跳过
			// 如果优先级足够 -> 执行action
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够, 加入 baseQueue
				const clone = createUpdate(pending.action, pending.lane);

				if (newBaseQueueFirst === null) {
					// 是第一个被跳过的
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					newBaseState = newState;
				} else {
					// 不是第一个被跳过
					(newBaseQueueLast as Update<State>).next = clone;
					newBaseQueueLast = clone;
				}
			} else {
				// 优先级足够
				if (newBaseQueueLast !== null) {
					// 存在被跳过的，被跳过的update及其后面的所有update要入队到baseQueue
					const clone = createUpdate(pending.action, NoLane);
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}
				// 优先级足够且不存在被跳过的update, 正常执行

				// 执行 (num) => num + 1
				const action = pending.action;
				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					newState = action;
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 没有被跳过的 udate
			newBaseState = newState;
		} else {
			// 有被跳过的 uodate
			newBaseQueueLast.next = newBaseQueueFirst; // 形成循环链表
		}
		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}
	return result;
};
