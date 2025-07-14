## 作用

跳过链表中的某个 update 时，将这个 update 对应的 lane 还给 fibernode.lanes

## 实现

```js
onSkipUpdate = (update) => {
    const skippeLane = update.lane;
    const fiber = currentlyRenderingFiber as FiberNode;
    fiber.lanes = mergeLanes(fiber.lanes, skippeLane);
}
```

### 参数

update：未消费的 update

## 工作流程

### 触发的作用域

（在整个链条中的相对位置）

在 processUpdateQueue 中，如果该 update 的优先级不够，没有被消费，触发 onSkipUpdate

```mermaid
graph TD
    A[开始 processUpdateQueue] --> B{遍历 Update 链表中的每个 update};
    B --> C{当前 renderLane 的优先级是否足够处理此 update?};
    C -- "是 (优先级足够)" --> D[执行 update.action, 计算新 state];
    D --> E{还有下一个 update?};
    C -- "否 (优先级不足)" --> F[跳过此 update];
    F --> G["触发 onSkipUpdate(update)"];
    subgraph "onSkipUpdate 的核心操作"
        G --> H["将 update.lane 重新合并回 fiber.lanes<br/>(确保低优先级更新不会丢失)"];
    end
    H --> E;
    E -- 是 --> B;
    E -- 否 --> I[返回最终计算的 memoizedState 和<br/>被跳过的 update 组成的 baseQueue];
    I --> J[结束];

    style G fill:#f9f,stroke:#333,stroke-width:2px

```

### 执行的作用域

在 updateState 中

（在整个链条中的相对位置）

```mermaid
graph TD
    A[开始 updateState] --> B[获取当前 Hook 对象];
    B --> C["合并新旧 update 队列 (pending + baseQueue)"];
    C --> D{队列是否为空?};
    D -- "是" --> J[直接返回旧 state];
    D -- "否" --> E["定义 onSkipUpdate 回调函数"];
    subgraph "onSkipUpdate 定义"
        E --> F["(update) => {<br/>  fiber.lanes |= update.lane;<br/>}"]
    end
    F --> G["调用 processUpdateQueue(baseState, queue, renderLane, onSkipUpdate)"];

    subgraph "processUpdateQueue 内部"
        G --> H{遍历队列中的每个 update};
        H --> I{当前 renderLane 优先级是否足够?};
        I -- "是" --> K[执行 update, 计算新 state];
        I -- "否 (跳过)" --> L["<b>触发 onSkipUpdate(update)</b>"];
        L --> M["将 update.lane 合并回 fiber.lanes<br/>(保证低优任务不丢失)"];
        M --> N{还有下一个 update?};
        K --> N;
        N -- 是 --> H;
        N -- 否 --> O[返回最终 state 和新的 baseQueue];
    end

    O --> P[更新 Hook 对象的 memoizedState, baseState, baseQueue];
    P --> Q[返回最终 state 和 dispatch 函数];
    J --> Q;
    Q --> R[结束];

    style L fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#cde,stroke:#333,stroke-width:1px

```
