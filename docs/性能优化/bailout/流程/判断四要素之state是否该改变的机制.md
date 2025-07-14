```mermaid
graph TD
    A[beginWork 开始] --> B{1、 初步检查: <br/> checkScheduledUpdateOrContext};
    B -- "False (无匹配lane)" --> C["✅ **Bailout 阶段一** <br/> (快速跳过)"];

    B -- "True (有匹配lane)" --> D[执行 processUpdateQueue <br/> 计算新 state];
    D --> E{"2、 结果检查: <br/> Object.is(newState, oldState)"};
    E -- "False (值变了)" --> F["❌ **无法 Bailout** <br/> (继续渲染组件)"];
    E -- "True (值没变)" --> G["✅ **Bailout 阶段二** <br/> (最终跳过)"];

    style C fill:#d4edda,stroke:#155724
    style G fill:#d4edda,stroke:#155724
    style F fill:#f8d7da,stroke:#721c24
```

## Bailout 阶段二

update(1) 的情况

- updateHostRoot
- updateFunctionComponent
- updateContextProvider

### updateHostRoot

对比的是 ReactElement 类型的 <App />

### updateFunctionComponent

对比的是前后 state

### updateContextProvider
