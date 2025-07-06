`ensureRootIsScheduled` 总共被调用了**4次**

---

### 1\. 位置：`scheduleUpdateOnFiber`

- **代码**：
  ```typescript
  export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  	// ...
  	markRootUpdated(root, lane);
  	ensureRootIsScheduled(root); //
  }
  ```
- **作用：发起调度（Initiation）**
  - 这是最直接的入口。当组件调用 `setState` 或 `createRoot().render()` 时，就会触发这个函数。
  - 它的角色是：**“报告新工作”**。它将一个新的更新（`lane`）标记到根节点上，然后调用 `ensureRootIsScheduled` 来告诉调度器：“有新的任务来了，请检查并安排一次渲染。”

### 2\. 位置：`performSyncWorkOnRoot`

- **代码**：

  ```typescript
  function performSyncWorkOnRoot(root: FiberRootNode) {
  	const nextLane = getHighestPriorityLane(root.pendingLanes);

  	if (nextLane !== SyncLane) {
  		ensureRootIsScheduled(root); //
  		return;
  	}
  	// ...
  }
  ```

- **作用：纠正调度（Correction）**
  - 此函数被设计为**只处理**同步任务（`SyncLane`）。
  - 它的角色是：**“验证工作性质”**。在准备执行同步工作前，它会做一次最后的确认。如果发现最高优先级的任务已经不再是同步的（可能因为某些原因被处理或降级了），它就不能继续执行。此时调用 `ensureRootIsScheduled` 是为了根据当前**最新的、正确的**任务优先级（可能是并发的）来重新发起一次调度，确保任务总是在正确的模式下执行。

### 3\. 位置：`performConcurrentWorkOnRoot`

- **代码**：

  ```typescript
  function performConcurrentWorkOnRoot(...) {
      // ...
      const exitStatus = renderRoot(root, lane, !needSync);

      ensureRootIsScheduled(root); //

      // ...
  }
  ```

- **作用：协调与抢占（Coordination & Preemption）**
  - 这是并发模式下的核心协调点。
  - 它的角色是：**“承前启后，处理变化”**。在一个并发渲染任务的时间分片**结束**后（无论任务是完成还是中断），这个调用会立即重新检查调度状态。
    - **如果渲染被中断**：它确保未完成的任务能被重新安排，以便稍后继续。
    - **如果渲染过程中有更高优先级的更新插入**：这个调用能立即发现这个“插队”的任务，并重新调度，从而实现**抢占**。

### 4\. 位置：`commitRoot`

- **代码**：

  ```typescript
  function commitRoot(root: FiberRootNode) {
  	// ... (完成 DOM 更新)

  	ensureRootIsScheduled(root); //
  }
  ```

- **作用：调度连锁更新（Chained Updates）**
  - 这个调用发生在 `commit` 阶段的**末尾**，此时 DOM 更新已完成，但异步的 `useEffect` 回调还未执行。
  - 它的角色是：**“捕获并调度被遗留的任务”**。这主要是为了解决高优先级任务“插队”后，被它打断的低优先级任务需要被重新调度的问题。在一次高优先级更新（如同步更新）完成后，`commitRoot` 末尾的这个调用会检查并确保任何被遗留的低优先级任务能够被重新安排执行，从而防止更新丢失。
