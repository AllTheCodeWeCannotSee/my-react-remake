### 模拟场景组件

```js
function MyComponent() {
	// Hook 1: useState
	const [count, setCount] = useState(0);

	// Hook 2: useEffect
	useEffect(() => {
		console.log('Component mounted or count changed');
		return () => console.log('Cleanup for count effect');
	}, [count]);

	// Hook 3: useEffect
	useEffect(() => {
		console.log('Component mounted');
	}, []);
}
```

### Mermaid 结构图

代码段

```mermaid
graph TD
    subgraph FiberNode
        direction LR
        FN("FiberNode_For_MyComponent")
    end

    subgraph "Hooks List (Linked via 'next')"
        direction LR
        Hook1["Hook_A (useState)"]
        Hook2["Hook_B (useEffect)"]
        Hook3["Hook_C (useEffect)"]
    end

    subgraph FCUpdateQueue
      FCUQ["FCUpdateQueue"]
    end

    subgraph "Effects Ring (Linked via 'next')"
      direction LR
      Effect1["Effect_1 (count effect)"]
      Effect2["Effect_2 (mount effect)"]
    end

    subgraph "Details for Hook_A"
      Hook1_memoizedState["memoizedState: 0"]
      Hook1_updateQueue["updateQueue: UpdateQueue_For_State_A"]
    end

    subgraph "Details for Hook_B"
        Hook2_memoizedState["memoizedState"]
        Hook2_updateQueue["updateQueue: null"]
    end

    subgraph "Details for Hook_C"
        Hook3_memoizedState["memoizedState"]
        Hook3_updateQueue["updateQueue: null"]
    end

    subgraph "Details for UpdateQueue_For_State_A"
        UQA_Pending["shared: { pending: null }"]
        UQA_Dispatch["dispatch: function"]
    end

    subgraph "Details for Effect_1"
        Effect1_Create["create: () => ..."]
        Effect1_Destroy["destroy: () => ..."]
        Effect1_Deps["deps: [0]"]
    end

    subgraph "Details for Effect_2"
        Effect2_Create["create: () => ..."]
        Effect2_Destroy["destroy: undefined"]
        Effect2_Deps["deps: []"]
    end

    %% Main Connections
    FN -- "memoizedState" --> Hook1
    FN -- "updateQueue" --> FCUQ

    %% Hooks List Connections
    Hook1 -- "next" --> Hook2
    Hook2 -- "next" --> Hook3
    Hook3 -- "next: null" --> X["null"]

    %% FCUpdateQueue Connection
    FCUQ -- "lastEffect" --> Effect2

    %% Effects Ring Connections
    Effect2 -- "next" --> Effect1
    Effect1 -- "next" --> Effect2

    %% Hook Details Connections
    Hook1 --> Hook1_memoizedState
    Hook1 --> Hook1_updateQueue
    Hook1_updateQueue --> UQA_Pending
    Hook1_updateQueue --> UQA_Dispatch

    Hook2 --> Hook2_memoizedState
    Hook2 --> Hook2_updateQueue
    Hook2_memoizedState -- "points to" --> Effect1

    Hook3 --> Hook3_memoizedState
    Hook3 --> Hook3_updateQueue
    Hook3_memoizedState -- "points to" --> Effect2

    %% Effect Details Connections
    Effect1 --> Effect1_Create
    Effect1 --> Effect1_Destroy
    Effect1 --> Effect1_Deps

    Effect2 --> Effect2_Create
    Effect2 --> Effect2_Destroy
    Effect2 --> Effect2_Deps
```

### 图解说明

1. **FiberNode**: 这是我们数据结构的起点，代表 `MyComponent` 组件。
2. **`memoizedState` -> Hooks List**: `FiberNode` 的 `memoizedState` 指针指向一个**线性的单向链表**，这个链表按照 Hooks 的调用顺序（`useState`, `useEffect`, `useEffect`）串联起所有的 `Hook` 对象。
3. **`updateQueue` -> FCUpdateQueue**: `FiberNode` 的 `updateQueue` 指针指向一个**唯一的 `FCUpdateQueue` 对象**。这个对象是该组件所有 `useEffect` 共享的。
4. **FCUpdateQueue -> Effects Ring**: `FCUpdateQueue` 内部通过 `lastEffect` 指针，指向 `useEffect` 们组成的**环形链表**的最后一个节点（这里是 `Effect_2`）。
5. **Hooks 与 Effects 的关联**:

   - `useState` 类型的 `Hook` (`Hook_A`)，它的 `memoizedState` 直接存储状态值 (`0`)，并且它的 `updateQueue` 指向一个独立的、专属于它自己的 `UpdateQueue`。
   - `useEffect` 类型的 `Hook` (`Hook_B`, `Hook_C`)，它的 `memoizedState` 则是一个指针，指向其在 **Effects 环形链表**中对应的那个 `Effect` 对象。
