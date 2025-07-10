对于大多数 Fiber 类型（如 `HostComponent`, `FunctionComponent` 等），`beginWork` 的核心职责是调用 `reconcileChildren`。`reconcileChildren` 内部才会根据 `current` Fiber (旧 Fiber) 是否存在，来决定是走 `mountChildFibers` (首次挂载) 还是 `reconcileChildFibers` (更新) 的逻辑。

然而，`updateSuspenseComponent` 打破了这个常规，其**主要原因在于 `<Suspense>` 组件的行为模式与其他组件有本质不同**。其他组件的渲染逻辑是单一的：给定 props，渲染出子节点。但 `<Suspense>` 组件具有**两种截然不同的渲染输出**：

1.  **主内容 (Primary Children)**: 即 `<Suspense>` 的 `children`。
2.  **后备内容 (Fallback)**: 即 `<Suspense>` 的 `fallback` prop。

它需要根据**子树的渲染状态**（是否挂起）而不是自身的 props 来动态决定到底渲染哪一个。这就导致了它不能依赖常规的 `reconcileChildren` 流程。

下面是详细的原因分解：

### 1\. **`reconcileChildren` 的设计是针对“单一内容源”的**

`reconcileChildren` 函数接收的“新子节点”来源是固定的，通常就是 `workInProgress.pendingProps.children`。它只负责拿这一份新的子节点列表去和旧的子节点列表（`current.child`）进行 diff。

但对于 `<Suspense>` 来说，它的“新子节点”可能是 `children`，也可能是 `fallback`。这个决定必须在 `reconcileChildren` **之前**做出。`beginWork` 是做出这个决策的完美时机。

### 2\. **决策依据是 `flags`，而非 `props`**

`updateSuspenseComponent` 判断是显示主内容还是 fallback 的核心依据是 `workInProgress.flags` 上是否存在 `DidCapture` 标志位。

- 这个 `DidCapture` 标志是在子树渲染过程中，如果捕获到了挂起（Promise被抛出），才会被设置的。
- `beginWork` 函数是处理 `workInProgress` Fiber 节点的入口。当轮到 `updateSuspenseComponent` 执行时，它能立刻访问到这个最新的 `flags` 状态。

因此，`updateSuspenseComponent` 内部的逻辑是：

```
// 伪代码
function updateSuspenseComponent(current, workInProgress) {
    const showFallback = (workInProgress.flags & DidCapture) !== NoFlags;

    if (showFallback) {
        // 决策：渲染 Fallback
        // 这里会手动创建代表 fallback 的 Fiber 节点
        updateSuspenseFallbackChildren(current, workInProgress, ...);
    } else {
        // 决策：渲染 Children
        // 这里会手动创建代表 children 的 Fiber 节点
        updateSuspensePrimaryChildren(current, workInProgress, ...);
    }
}
```

### 3\. **需要同时管理两套子树（虽然其中一套是隐藏的）**

这是最关键的一点。当 `<Suspense>` 显示 `fallback` 时，它并**没有丢弃**原来的主内容 (`children`)。相反，它将主内容渲染在一个 `mode="hidden"` 的 `<OffscreenComponent>` 中，保留了其完整的 Fiber 树和组件状态。

这意味着在挂起状态下，`<Suspense>` 组件实际上会创建**两个**子 Fiber 树：

1.  一个隐藏的、包裹着主内容的 `OffscreenComponent`。
2.  一个可见的、渲染着 `fallback` 内容的 Fiber 树。

常规的 `reconcileChildren` 根本无法处理这种需要同时协调两套不同子节点的情况。因此，`updateSuspenseComponent` 必须“亲自动手”，在 `beginWork` 内部就根据 `showFallback` 的布尔值，手动调用不同的、特制的子节点创建函数 (`updateSuspenseFallbackChildren` 或 `updateSuspensePrimaryChildren`) 来构建这种特殊的子树结构。

### 总结

将判断逻辑放在 `updateSuspenseComponent` 内部，而不是委托给 `reconcileChildren`，是 `Suspense` 组件实现其核心功能的必然选择。因为它需要：

- **基于状态（`flags`）而非 props 做出渲染决策。**
- **在两个完全不同的内容源（`children` vs `fallback`）之间切换。**
- **能够创建并管理一个复杂的、包含“隐藏”和“可见”部分并存的子树结构。**

这些需求都超出了标准 `reconcileChildren` 的能力范围，所以必须在 `beginWork` 阶段就进行专门的处理。
