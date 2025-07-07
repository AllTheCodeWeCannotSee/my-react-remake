调用 const [isPending, startTransition] = useTransition(); 时，React 并不是只创建一个 Hook，而是创建了两个。

第一个 Hook (Hook 1) 实际上是一个内部的 useState。

它的 memoizedState 存储了 isPending 的布尔值 (true 或 false)。

它的 updateQueue 包含了更新这个状态的逻辑，即 setPending 函数。

第二个 Hook (Hook 2) 才是 useTransition 自身。

它的 memoizedState 非常特别，直接存储了**startTransition 函数本身**。

这个 Hook 没有自己的更新队列 (updateQueue 为 null)，因为它不直接管理状态，而是通过第一个 useState Hook 来更新 isPending 状态。

### 图

```mermaid
graph TD
    subgraph FiberNode
        A(FiberNode)
        B[memoizedState] -- "指向 Hook 链表头部" --> H1
    end

    subgraph HookLinkedList ["Hook 链表"]
        H1(Hook 1: for useState)
        H2(Hook 2: for useTransition)
        H_Null((null))

        H1 -- "next" --> H2
        H2 -- "next" --> H_Null
    end

    subgraph "Hook 1 (useState) 详情"
        H1_State["memoizedState: isPending (boolean)"]
        H1_Queue["updateQueue: { dispatch: setPending, ... }"]
    end

    subgraph "Hook 2 (useTransition) 详情"
        H2_State["memoizedState: startTransition (function)"]
        H2_Queue["updateQueue: null"]
    end

    H1 -.-> H1_State
    H1 -.-> H1_Queue
    H2 -.-> H2_State
    H2 -.-> H2_Queue


    style FiberNode fill:#daf2,stroke:#333,stroke-width:2px
    style HookLinkedList fill:#e1d5e7,stroke:#333,stroke-width:2px
```
