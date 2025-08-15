fiberNode.updateQueue

fiberNode.memoizedState

### Hook 的数据结构

#### 直观

**内部结构**

```mermaid
---
title: Hooks
---
flowchart LR
    A[
        memoizedState
        updateQueue
        next
    ]
```

**外部联系**

```mermaid
graph LR
    subgraph FC fiberNode
        direction LR
        memoizedState[memoizedState]
    end
    subgraph Hooks
        direction TB
        useState1[useState]
        useEffect[useEffect]
        useState2[useState]
    end

    memoizedState-->useState1
    useState1 --> useEffect
    useEffect --> useState2
    useState1 --> hook数据[hook数据]

```

#### 概念

- `memoizedState`
  - 存储的是**当前这个特定 Hook 实例的核心数据**
  - **对于 `useState` Hook**: `memoizedState` 存储的就是你通过 `useState` 获取到的那个状态变量的**当前值**。例如，如果你写 `const [count, setCount] = useState(0);`，那么这个 `Hook` 对象的 `memoizedState` 就会是 `0` (或者之后通过 `setCount` 更新后的值)。
  - **对于 `useEffect` Hook**: `memoizedState` 存储的是一个 `Effect` 对象。这个 `Effect` 对象包含了副作用的创建函数 (`create`)、销毁函数 (`destroy`)、依赖项 (`deps`) 以及一个指向下一个 `Effect` 对象的指针（因为一个组件可以有多个 `useEffect`，它们也会形成一个链表，但这个链表是挂载在 `FiberNode.updateQueue` 上的，而不是直接在 `Hook.memoizedState` 里形成链表）。
  - 对于 `useTransition` Hook: 是它返回给你的第二个参数，即 startTransition
  - 对于 `useRef` Hook: 存储 `ref`
- `updateQueue`
  - 存储与该 Hook 相关的**更新队列**
  - **对于 `useState` Hook**: `updateQueue` 会指向一个 `UpdateQueue` 对象。这个队列负责管理所有通过 `setState` (或 `dispatch` 函数) 针对这个特定状态发起的更新请求。当组件重新渲染时，React 会处理这个队列中的更新来计算新的 `memoizedState`。
  - **对于 `useEffect` Hook**: 这个属性通常是 `null` 或者不被直接使用来存储更新队列。`useEffect` 的副作用执行逻辑（创建、销毁、依赖比较）更多地依赖于其 `memoizedState` 中存储的 `Effect` 对象以及 FiberNode 上的 `updateQueue` (类型为 `FCUpdateQueue`) 来管理 `Effect` 链表。
- `next`

### updateQueue的结构

#### 直观的例子

```js
const [count, setCount] = useState(0);
setCount(100);
```

结构：

```js
hook.memoizedState = 0;
hook.updateQueue = {
	shared: {
		pending: { action: 100 }
	},
	dispatch: setCount
};
```

#### 概念说明

```ts
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}
```

- **`dispatch`**: 这个属性会存储 `dispatch` 函数本身（也就是 `useState` 返回的第二个参数，如 `setNum`）。这个函数在创建时就已经绑定了当前的 Fiber 节点和这个 `updateQueue` 实例，所以调用它时，React 知道要为哪个组件的哪个状态更新队列添加任务。
- **`shared.pending`**: 这是存放**待处理更新**的地方。当您调用 `setNum(101)` 时，React 内部会创建一个 `Update` 对象，并将其赋值给 `pending` 属性。这里的 `shared` 对象设计是为了在 work-in-progress Fiber 树和 current Fiber 树之间共享同一个更新队列。
