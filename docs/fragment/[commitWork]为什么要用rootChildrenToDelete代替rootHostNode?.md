`rootChildrenToDelete`变量是一个数组，它的核心作用是在`commitDeletion`函数中，收集一个即将被卸载的Fiber节点树中所有需要被直接从DOM中移除的**根级别**宿主节点（HostComponent和HostText）。

### 为什么用 `rootChildrenToDelete` 替代 `rootHostNode`？

根本原因在于之前的`rootHostNode`实现存在缺陷，无法正确处理某些卸载场景，而`rootChildrenToDelete`修复了这个问题。

1.  **旧实现 (`rootHostNode`) 的缺陷**

    `rootHostNode`是一个只能存储单个Fiber节点的变量。在遍历待删除的子树时（`onCommitUnmount`），它只会记录遇到的**第一个**宿主节点（HostComponent或HostText）。

    **问题场景**：想象一个组件返回了多个并列的DOM元素，例如使用Fragment：

    ```jsx
    function MyComponent() {
    	return (
    		<>
    			<div>第一个Div</div>
    			<span>一个Span</span>
    			文本节点
    		</>
    	);
    }
    ```

    当`MyComponent`组件被卸载时，旧的`commitDeletion`逻辑只会将`rootHostNode`设置为第一个`<div>`对应的Fiber节点。因此，在最后执行`removeChild`时，只有第一个`<div>`会被从父DOM节点中移除，而`<span>`和“文本节点”会残留在页面上，导致UI Bug。

2.  **新实现 (`rootChildrenToDelete`) 的优势**

    新的实现通过将`rootChildrenToDelete`定义为一个数组 (`FiberNode[]`)，完美地解决了上述问题。

    - **收集所有节点**：在`commitNestedComponent`遍历待删除的Fiber树时，它会通过`recordHostChildrenToDelete`函数，将所有需要直接移除的、位于根级别的宿主节点都收集到`rootChildrenToDelete`这个数组中。
    - **统一删除**：遍历结束后，代码会检查`rootChildrenToDelete`数组。如果数组不为空，它会遍历这个数组，并对其中的每一个节点调用`removeChild`方法，将其对应的真实DOM节点从父容器中移除。

**总结**

|          | `rootHostNode` (旧)                     | `rootChildrenToDelete` (新)                           |
| :------- | :-------------------------------------- | :---------------------------------------------------- |
| **类型** | 单个`FiberNode`或`null`                 | `FiberNode`数组 (`[]`)                                |
| **作用** | 存储遇到的第一个待删除的宿主节点        | 收集所有根级别的待删除宿主节点                        |
| **行为** | 只能删除一个DOM节点，可能导致部分UI残留 | 确保所有相关的DOM节点都被正确移除，行为更健壮、更正确 |

因此，用`rootChildrenToDelete`数组替代`rootHostNode`变量，是为了**确保当一个组件卸载时，它所渲染的所有并列的DOM元素都能被完整、正确地从页面上移除**，修复了旧逻辑中只能处理单个根DOM节点的缺陷。
