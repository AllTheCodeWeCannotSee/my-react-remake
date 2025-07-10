#### 重点 1：从 JSX 到 React Element 树是一次性、同步完成的

- **是的，这个过程是一次性完成的。**
- 当你写下嵌套的 JSX（如 `<div><p/></div>`）时，Babel 会将其编译成嵌套的 `jsx()` 函数调用。
- 根据 JavaScript 的求值规则（函数参数必须先被计算），这些 `jsx()` 函数会**由内而外地、同步地、递归地**执行。
- **最终结果**：在任何组件函数被执行*之前*，一个完整的、由 `ReactElement` 对象构成的嵌套树（UI蓝图）就已经在内存中被完整地创建出来了。

---

#### 重点 2：FiberNode 只存储“直接子节点”的信息，且通过“引用”实现

- **顶层 FiberNode 不会存储更多数据**：一个节点的 `props.children` 只包含它的**直接子节点**，这是一个 **浅层（Shallow）** 结构。
- **不存储无效内容**：在 `A -> B -> C` 的结构中，`FiberNode A` 的 `pendingProps` 只包含了 `ReactElement B`。它对 `C` 的信息一无所知，也无需关心。`C` 的信息被完美封装在 `ReactElement B` 的 `props` 中。
- **一切都是引用（指针），而非拷贝**：整个 `ReactElement` 树是通过 JavaScript 的**引用**来链接的。父节点的 `props.children` 存储的是对子 `ReactElement` 对象的引用（指针），而不是一个深拷贝。

---

#### 重点 3：`FiberNode.pendingProps` vs `ReactElement.props`

- **正确的访问方式**：如果你想通过 `fiberA` 访问到 `ReactElement C`，路径应该是 **`fiberA.pendingProps.children.props.children`**。
