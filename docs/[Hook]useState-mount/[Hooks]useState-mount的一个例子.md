### jsx

```js
function Counter() {
	// 第一次调用 useState
	const [count, setCount] = useState(0);
	// 第二次调用 useState
	const [name, setName] = useState('Counter');

	// ... 返回 JSX
}
```

### 流程图

```mermaid
graph TD
    subgraph "React 核心"
        A["renderWithHooks(counterFiberNode)"]
    end

    subgraph "Counter FiberNode"
        FiberNode("
            counterFiberNode
            type: Counter()
            memoizedState: null
        ")
    end

    subgraph "全局变量"
        CRF[currentlyRenderingFiber]
        WIPH[workInProgressHook]
    end

    A -- "1、 设置全局渲染环境" --> SetGlobals("
        currentlyRenderingFiber = counterFiberNode
        workInProgressHook = null
        Dispatcher = HooksDispatcherOnMount
    ")

    SetGlobals -- "2、 执行组件函数" --> ComponentFunc["调用 Counter() 函数"]

    subgraph "Counter() 函数执行过程"
        ComponentFunc -- "3、 遇到第一个 useState(0)" --> useState1["const [count, setCount] = useState(0)"]
        useState1 -- "4、 执行 mountState(0)" --> mountState1

        useState1 -- "8、 第一个hook执行完毕, 遇到第二个useState('Counter')" --> useState2["const [name, setName] = useState('Counter')"]
        useState2 -- "9、 执行 mountState('Counter')" --> mountState2
    end

    subgraph "Hook 链表与数据结构"
        Hook1("
            Hook 1
            memoizedState: 0
            updateQueue: queue1
            next: --► Hook 2
        ")

        Hook2("
            Hook 2
            memoizedState: 'Counter'
            updateQueue: queue2
            next: null
        ")

        Queue1("
            UpdateQueue 1
            dispatch: setCount
        ")
        Queue2("
            UpdateQueue 2
            dispatch: setName
        ")

        Hook1 --> Queue1
        Hook2 --> Queue2
    end

    mountState1 -- "5、 调用 mountWorkInProgresHook()" --> CreateHook1["
        创建 hook1
        因 workInProgressHook 为 null
        fiberNode.memoizedState = hook1
        workInProgressHook = hook1
    "]

    CreateHook1 -- "6、 hook1 链接到 FiberNode" --> FiberNode

    mountState1 -- "7、 计算初始值并创建更新队列" --> SetHook1Props["
        hook1.memoizedState = 0
        hook1.updateQueue = queue1
        创建 setCount 并绑定 queue1
    "]
    SetHook1Props --> Hook1


    mountState2 -- "10、 调用 mountWorkInProgresHook()" --> CreateHook2["
        创建 hook2
        因 workInProgressHook 不为 null (指向 hook1)
        workInProgressHook.next = hook2
        workInProgressHook 更新为 hook2
    "]
    CreateHook2 -- "11、 将 hook2 链接到 hook1 后面" --> Hook1

    mountState2 -- "12、 计算初始值并创建更新队列" --> SetHook2Props["
        hook2.memoizedState = 'Counter'
        hook2.updateQueue = queue2
        创建 setName 并绑定 queue2
    "]
    SetHook2Props --> Hook2



    ComponentFunc -- "13、 函数执行完毕" --> EndRender["
        最终结果:
        counterFiberNode.memoizedState
        完整地指向了 Hook 链表的头部 (Hook 1)
    "]




    style FiberNode fill:#f9f,stroke:#333,stroke-width:2px
    style Hook1 fill:#bbf,stroke:#333,stroke-width:2px
    style Hook2 fill:#bbf,stroke:#333,stroke-width:2px
```

### 流程解释

1. **准备阶段 (`renderWithHooks`)**:

   - React 调用 `renderWithHooks(counterFiberNode)`。
   - `currentlyRenderingFiber` 被设置为 `counterFiberNode`。
   - 由于是首次挂载 (`wip.alternate` 为 `null`)，`currentDispatcher.current` 被设置为 `HooksDispatcherOnMount`。这意味着接下来在 `Counter` 组件内部调用的 `useState` 实际上会执行 `mountState` 函数。
   - React 开始执行 `Counter()` 函数。

2. **执行第一次 `useState(0)`**:

   - 调用 `mountState(0)`。
   - **`mountWorkInProgresHook()` 被调用**:
     - 创建一个新的 `Hook` 对象 (`hook1`)。
     - 此时 `workInProgressHook` 为 `null`（因为是第一个 Hook），所以 `counterFiberNode.memoizedState` 指向这个新的 `hook1`。
     - 全局的 `workInProgressHook` 也指向 `hook1`，为下一个 Hook 的链接做准备。
   - **计算初始值**: `hook1.memoizedState` 被设置为 `0`。
   - **创建更新队列**: `createUpdateQueue()` 创建一个与 `hook1` 关联的 `updateQueue`，并赋值给 `hook1.updateQueue`。
   - **创建 `dispatch` 函数**: 创建 `setCount` 函数，它内部已经通过 `.bind` 绑定了当前的 `counterFiberNode` 和 `hook1` 的 `updateQueue`。
   - `mountState` 返回 `[0, setCount]`。

3. **执行第二次 `useState('Counter')`**:

   - 调用 `mountState('Counter')`。
   - **`mountWorkInProgresHook()` 再次被调用**:
     - 创建第二个 `Hook` 对象 (`hook2`)。
     - 此时 `workInProgressHook` 不为 `null`（它正指向 `hook1`），所以执行 `else` 分支。
     - **关键一步：** `workInProgressHook.next = hook2`，也就是 `hook1.next = hook2`。**链表就这样形成了！**
     - 全局的 `workInProgressHook` 指针移动到 `hook2`，现在它成为链表的尾部。
   - **计算初始值**: `hook2.memoizedState` 被设置为 `'Counter'`。
   - **创建更新队列**: 为 `hook2` 创建一个全新的、独立的 `updateQueue`。
   - **创建 `dispatch` 函数**: 创建 `setName` 函数，绑定了 `counterFiberNode` 和 `hook2` 的 `updateQueue`。
   - `mountState` 返回 `['Counter', setName]`。

4. **收尾阶段 (`renderWithHooks`)**:

   - `Counter` 函数执行完毕。
   - `currentlyRenderingFiber` 被重置为 `null`。
   - 最终，`counterFiberNode` 的 `memoizedState` 属性牢牢地指向了 `Hook` 链表的头部 (`hook1`)，这个链表记录了组件所有状态的初始信息。
