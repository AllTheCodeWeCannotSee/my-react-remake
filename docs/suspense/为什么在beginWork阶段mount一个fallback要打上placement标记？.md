“mount阶段不是对于下面的节点都不用标记Placement，最后直接在commit阶段要整棵树吗”**在标准的、同步的、一次性完成的初次渲染中是基本正确的**。在这种理想情况下，React 可以在内存中构建好整个 DOM 树，然后一次性地把它 `appendChild` 到根容器上。

但是，`mountSuspenseFallbackChildren` 被调用的时机**已经不再是那种“理想情况”了**。

### 核心原因：Fallback 的渲染是一种“修正”行为

当 `mountSuspenseFallbackChildren` 执行时，意味着：

1.  **初次渲染尝试已失败**：React **已经**尝试过去渲染 `<Suspense>` 的主内容（`children`）。
2.  **渲染被中断**：在渲染主内容的过程中，某个子组件“挂起”（Suspended）了，抛出了一个 Promise。
3.  **渲染流程已“倒带”**：渲染流程被中断，并“倒带”回 `<Suspense>` 这个边界。
4.  **父节点可能已存在**：最关键的一点是，此时此刻，包裹着 `<Suspense>` 组件的那个父 DOM 节点**很可能已经被创建出来了**，甚至已经存在于真实的 DOM 中。

现在，React 的任务变成了：“**我需要把这个 Fallback UI（比如 `<p>Loading...</p>`），作为一个全新的部分，插入到那个已经存在的父节点中去。**”

### `Placement` 旗标的作用

`Placement` 旗标就是给 commit 阶段下达这个“插入”命令的指令。

- 它不仅仅是用于“把整棵树挂载到根节点”这一个目的。
- 它的通用含义是：“**请把这个 Fiber 节点对应的 DOM 节点，插入到其父 DOM 节点中去。**”

如果没有 `fallbackChildFragment.flags |= Placement;` 这一步：

1.  在 render 阶段，React 会为 Fallback UI 创建好 Fiber 节点。
2.  在 commit 阶段，React 会遍历到这些新的 Fiber 节点。
3.  但是因为没有 `Placement` 旗标，commit 阶段不知道要对它们执行任何 DOM 操作。它会认为这些节点“一切正常”，于是就什么也不做。
4.  **最终结果**：Fallback 的内容在内存（Fiber 树）中存在，但永远不会被渲染到屏幕上。

## 举例说明

### 完整流程：Suspense Fallback 的渲染揭秘

**场景**: 首次渲染一个包含异步组件的 `<Suspense>` 边界。

```jsx
// 我们的目标组件
<div id="container">
	<Suspense fallback={<p>Loading...</p>}>
		<MyAsyncComponent />
	</Suspense>
</div>
```

---

### 第 I 阶段：Render - 构建 Fiber 树 (内存中进行)

这个阶段的目标是创建或更新 Fiber 树，并标记出需要执行的副作用（DOM 操作）。

1.  **从上到下开始渲染**:

    - React 开始从根节点向下创建 FiberNode。
    - 为 `<div id="container">` 创建 `div_fiber`，并为其标记 `Placement` 副作用。

2.  **首次尝试渲染主内容**:

    - React 进入 `<Suspense>` 组件，并**正常地**尝试渲染其 `children`，也就是 `<MyAsyncComponent />`。
    - 它为 `<MyAsyncComponent />` 创建 `my_async_component_fiber`。

3.  **触发挂起 (Suspend\!)**:

    - React 执行 `<MyAsyncComponent />` 函数。
    - 该组件执行了一个异步操作（如 `React.lazy()` 或数据请求），并抛出了一个 Promise 来通知 React：“我需要暂停，等待数据！”

4.  **异常捕获与“倒带” (Unwind)**:

    - 渲染流程被这个 Promise 中断。
    - React 捕获这个异常，并顺着 Fiber 树向上查找，找到了最近的 `<Suspense>` 边界（也就是我们例子中的这个 `<Suspense>`）。
    - React 将这个 `<Suspense>` 的 FiberNode 标记为 `DidCapture`，表示它捕获到了一个挂起事件。
    - 之前为 `<MyAsyncComponent />` 创建的 Fiber 工作会被丢弃。

5.  **第二次尝试，渲染 Fallback**:

    - 渲染流程“倒带”回 `<Suspense>` 这个节点，并重新开始处理它。
    - 这一次，因为它看到了 `DidCapture` 标记，所以它知道不能再渲染 `children` 了。
    - 它会转而调用 `mountSuspenseFallbackChildren` 函数来处理 `fallback` 属性。

6.  **为 Fallback 创建 Fiber 并标记 `Placement`**:

    - 在 `mountSuspenseFallbackChildren` 内部，React 为 `<p>Loading...</p>` 创建 `p_fiber`。
    - **关键一步**: React 为 `p_fiber` 添加 `Placement` 旗标 (`p_fiber.flags |= Placement`)。这是在明确地告诉下一阶段：“这个 `<p>` 是一个全新的节点，需要被插入到 DOM 中去。”

7.  **Render 阶段结束**:

    - React 完成了整棵 Fiber 树的构建。现在我们得到了一棵这样的 Fiber 树（简化版）：
      - `div_fiber` (有 `Placement` 旗标)
        - `suspense_fiber` (无 DOM，无旗标)
          - `p_fiber` (有 `Placement` 旗标)

---

### 第 II 阶段：Commit - 将变更应用到 DOM (与真实 DOM 交互)

这个阶段会遍历所有带副作用旗标的 Fiber 节点，并执行相应的 DOM 操作。

8.  **Commit 阶段开始**: React 从 Fiber 树的根节点开始，自顶向下**遍历**这棵树，寻找有副作用的节点。

9.  **处理 `div_fiber`**:

    - React 遍历到 `div_fiber`，发现它有 `Placement` 旗标。
    - **它不会立刻操作 DOM**。为了避免不必要的重绘，它会先继续向下遍历，处理完所有子节点的副作用。

10. **处理 `suspense_fiber`**: 它没有 DOM 节点，直接跳过，继续处理其子节点。

11. **处理 `p_fiber` (自底向上组装的开始)**:

    - React 遍历到 `p_fiber`，发现它也有 `Placement` 旗标。
    - 由于 `p_fiber` 是一个叶子节点（没有子节点了），React 现在可以处理它了。
    - **执行 DOM 创建**: React 调用 `document.createElement('p')` 创建出 `p_dom_node`。
    - 此时，它还**不能**把它插入到页面中，因为它还不知道它的父 DOM 节点 (`div_dom_node`) 是否已经准备好。它只是将 `p_dom_node` 准备好。

12. **递归返回，处理 `div_fiber` 的插入**:

    - `p_fiber` 处理完毕后，递归返回到 `div_fiber`。
    - React 知道 `div_fiber` 的所有子孙节点的 DOM 都已准备就绪。
    - **执行 DOM 创建与组装**: React 创建 `div_dom_node`，然后将刚才准备好的 `p_dom_node` **在内存中** `appendChild` 到 `div_dom_node`。现在，`div_dom_node` 已经是一个包含了 `<p>` 的完整 DOM 片段。
    - **执行最终插入**: React 找到 `div_dom_node` 应该被插入的位置（比如 `document.body`），然后**一次性地**执行 `document.body.appendChild(div_dom_node)`。

13. **Commit 阶段结束**: 浏览器收到一个完整的 DOM 结构并将其渲染到屏幕上。用户看到了 “Loading...” 的字样。
