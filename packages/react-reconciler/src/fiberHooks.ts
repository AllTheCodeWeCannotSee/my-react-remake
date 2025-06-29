import internals from 'shared/internals';
import { FiberNode } from './fiber';

import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Update } from './fiberFlags';
// ---------------------------------- 数据结构 --------------------------------- //
// 当前在 render 的 fibernode
let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
const { currentDispatcher } = internals;

interface Hook {
	// 此处的 memoizedState 不同于 fiberNode 中的 memoizedState
	// 此处的 memoizedState:
	//		useState: 状态变量的当前值
	// 		useEffect: Effect 对象
	// fiberNode 中的 memoizedState 指向一个链表，链表的元素是Hooks（useState、useEffect...）
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}
// ---------------------------------- 函数 --------------------------------- //
// function Greeting(props: { name: string }) {
//     return <span>你好，{props.name}！</span>;
// }

// function App() {
//     return (
//         <div>
//             <Greeting name="世界" />
//         </div>
//     );
// }
export function renderWithHooks(wip: FiberNode) {
	// ---------------------------------- 处理 Hooks --------------------------------- //
	// 确定调用 hook 的节点
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;
	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// ---------------------------------- 处理 Props --------------------------------- //
	// wip.type: 这个 type 属性对于函数式组件来说，就是那个组件函数本身
	// Component 是 Greeting()
	const Component = wip.type;
	// props = { name: "世界" }
	const props = wip.pendingProps;
	// children = <span>你好，世界！</span>
	const children = Component(props);

	// ---------------------------------- 收尾 --------------------------------- //
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	return children;
}

// ---------------------------------- mount --------------------------------- //
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

// const [count, setCount] = useState(0)
// 输入：0
// 输出：[0, setCount]
function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 1. 创建空 Hook 对象
	const hook = mountWorkInProgresHook();
	// 2. 计算初始 state (存在memoizedState)
	let memoizedState;
	if (initialState instanceof Function) {
		// initialState: () => 1 + 2
		memoizedState = initialState();
	} else {
		// initialState: 1
		memoizedState = initialState;
	}
	hook.memoizedState = memoizedState;
	// 3. hook.updateQueue
	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	// dispatch 相当于 setCount 函数
	// 绑定了当前 FC fiberNode
	// 绑定了当前 hook 的 updateQueue
	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
}

// 把 action 打包成 update, update 入队到 hook.updateQueue, 触发从 root 开始的渲染
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber);
}

// 创建空的 Hook, 并连接到链表 fibernode.memoizedState中
function mountWorkInProgresHook(): Hook {
	// 创建新的 Hook
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};
	if (workInProgressHook === null) {
		// 是 wip 的第一个 Hook
		if (currentlyRenderingFiber === null) {
			// 不在函数组件内被调用
			throw new Error('请在函数组件内调用hook');
		} else {
			// 作为memoizedState的头节点
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// 非 wip 的第一个 Hook
		// memoizedState -> old
		// memoizedState -> old -> new
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}

// ---------------------------------- update --------------------------------- //
const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState
};

/**
 * @description 得到 useState 的返回值（update 阶段）
 */
function updateState<State>(): [State, Dispatch<State>] {
	// 例子：
	// const [count, setCount] = useState(0)
	// setCount(100)
	// 结构：
	// hook.memoizedState = 0
	// hook.updateQueue = {
	// 	shared: {
	// 		pending: {action: 100}
	// 	},
	// 	dispatch: setCount
	// }
	const hook = updateWorkInProgresHook();
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending);
		hook.memoizedState = memoizedState;
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

/**
 * @description 确定 hook 在链表中的位置
 */
function updateWorkInProgresHook(): Hook {
	// 1. 指向上一次成功渲染（current tree）的 Hook 链表中的当前 Hook
	let nextCurrentHook: Hook | null;
	if (currentHook === null) {
		// 是本组件的第一个 Hook
		const current = currentlyRenderingFiber?.alternate;
		nextCurrentHook = current?.memoizedState;
	} else {
		// 非本组件的第一个 Hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// 违规，情况1 (mount/update u1 u2 u3 / update u1 u2 u3 u4):
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		);
	}
	currentHook = nextCurrentHook as Hook;
	// 2. 不修改 currentHook, 而是创建新的
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};
	if (workInProgressHook === null) {
		// 是 wip tree 的第一个 Hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// 非 wip tree 的第一个 Hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}
	return workInProgressHook;
}
