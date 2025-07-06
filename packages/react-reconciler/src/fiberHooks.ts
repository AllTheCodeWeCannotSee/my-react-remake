import internals from 'shared/internals';
import { FiberNode } from './fiber';

import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	Update,
	UpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Flags, PassiveEffect } from './fiberFlags';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { HookHasEffect, Passive } from './hookEffectTags';
// ---------------------------------- 数据结构 --------------------------------- //
// 当前在 render 的 fibernode
let currentlyRenderingFiber: FiberNode | null = null;
// 新树上的
let workInProgressHook: Hook | null = null;
// 老树上的
let currentHook: Hook | null = null;
// 当前渲染任务的 lane
let renderLane: Lane = NoLane;

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
	// 并发
	baseState: any;
	baseQueue: Update<any> | null;
}

// effect
type EffectCallback = () => void;
type EffectDeps = any[] | null;
export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}
// ---------------------------------- 主体 --------------------------------- //

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
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// ............... 处理 Hooks  ...............
	// 确定调用 hook 的节点
	currentlyRenderingFiber = wip;

	renderLane = lane;
	wip.memoizedState = null;
	wip.updateQueue = null;
	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	// ............... 处理 Props ...............
	// wip.type: 这个 type 属性对于函数式组件来说，就是那个组件函数本身
	// Component 是 Greeting()
	const Component = wip.type;
	// props = { name: "世界" }
	const props = wip.pendingProps;
	// children = <span>你好，世界！</span>
	const children = Component(props);

	// ............... 收尾 ...............
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}
// ............... mount ...............
// 推给数据层的
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};
// 创建空的 Hook, 并连接到链表 fibernode.memoizedState中
function mountWorkInProgresHook(): Hook {
	// 创建新的 Hook
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
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

// ............... update ...............

// 推给数据层的
const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

// 根据老 Hook 创建新 Hook, 尾插到 fiber.memoizedState
// workInProgressHook, currentHook 分别是是新、老树上的尾指针
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
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	};
	// 3. 连接到 fiber.memoizedState
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

// ---------------------------------- useState --------------------------------- //

// ............... mount ...............

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
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

// ............ update ............

// 得到 useState 的返回值（update 阶段）
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

	const baseState = hook.baseState;
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	const pending = queue.shared.pending;

	queue.shared.pending = null;

	if (pending !== null) {
		if (baseQueue !== null) {
			// baseQueue b2 -> b0 -> b1 -> b2
			// pendingQueue p2 -> p0 -> p1 -> p2
			// b0
			const baseFirst = baseQueue.next;
			// p0
			const pendingFirst = pending.next;
			// b2 -> p0
			baseQueue.next = pendingFirst;
			// p2 -> b0
			pending.next = baseFirst;
			// p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
		}
		baseQueue = pending; // baseQueue = p2
		current.baseQueue = pending;
		queue.shared.pending = null;
		if (baseQueue !== null) {
			const {
				memoizedState,
				baseQueue: newBaseQueue,
				baseState: newBaseState
			} = processUpdateQueue(baseState, baseQueue, renderLane);
			hook.memoizedState = memoizedState;
			hook.baseState = newBaseState;
			hook.baseQueue = newBaseQueue;
		}
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

// ---------------------------------- useEffect --------------------------------- //

// ............... mount ...............
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const nextDeps = deps === undefined ? null : deps;
	// 1. 在链表上创建一个新 Hook
	const hook = mountWorkInProgresHook();
	// 2. 给当前 fibernode 打上标记 PassiveEffect
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
	// 3. 创建 Effect 对象,将其链接到 fibernode.updateQueue.lastEffect, 将其放到 hook.memoizedState
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	// 1. 创建 Effect
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};
	// 2. Effect 链接到 fibernode.updateQueue.lastEffect
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		// fibernode 没有 updateQueue
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect; // 循环链表，自己指向自己
		updateQueue.lastEffect = effect;
	} else {
		// fibernode 有 updateQueue
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			// updateQueue 不存在 Effect
			effect.next = effect; // 循环链表，自己指向自己
			updateQueue.lastEffect = effect;
		} else {
			// updateQueue 存在 Effect
			// ...
			// lastEffect = B -> A -> B
			// lastEffect = C -> B -> A -> C
			// ...

			const firstEffect = lastEffect.next; // firstEffect = A
			// B -> C
			lastEffect.next = effect;
			// C -> A
			effect.next = firstEffect;
			// lastEffect = C
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}
// ............ update ............
// 创建新 Hooks，比较依赖项
function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;
	// 1. 老数据创建新 Hook, 并连接到 fiber.memoizedState 链表上
	const hook = updateWorkInProgresHook();

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				// 依赖项未变：创建一个不带 HookHasEffect 标记的新 Effect
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
		// 依赖项改变（或未提供）
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}

// 浅比较
function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}
