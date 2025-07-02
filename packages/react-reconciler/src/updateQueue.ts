import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

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
): { memoizedState: State } => {
	// result = { memoizedState: 100}
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		// first 指向 A, 即最旧的更新任务
		const first = pendingUpdate.next;
		// pending 指向 A
		let pending = pendingUpdate.next as Update<any>;
		// 遍历所有的 setNum
		do {
			const updateLane = pending.lane;
			if (updateLane === renderLane) {
				// 执行 (num) => num + 1
				const action = pending.action;
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入updateLane !== renderLane逻辑');
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);
	}
	// result = { memoizedState: 103}
	result.memoizedState = baseState;
	return result;
};
