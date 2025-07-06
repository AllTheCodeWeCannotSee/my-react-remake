**确保在一次更新完成后，任何被“遗留”下来的低优先级更新能被重新调度，从而保证渲染任务的连续性。**

### 场景：高优先级任务插队，遗留了低优先级任务

1.  **低优先级更新入队**：

    - 应用触发了一个低优先级的更新（比如，一个数据分析看板在后台刷新）。
    - 这个更新被标记为 `DefaultLane`。
    - `scheduleUpdateOnFiber` -> `ensureRootIsScheduled` 被调用，它向 Scheduler 注册了一个**低优先级的、并发的**回调任务 (`performConcurrentWorkOnRoot`)。

2.  **高优先级更新插队**：

    - 在 Scheduler 执行那个低优先级任务**之前**，用户突然点击了一个按钮。
    - 这触发了一个高优先级的更新 (`setState`)，被标记为 `SyncLane`。
    - `scheduleUpdateOnFiber` -> `ensureRootIsScheduled` 再次被调用。
    - 这次，`ensureRootIsScheduled` 发现 `SyncLane` 的优先级更高。它会**取消**之前那个低优先级的并发回调，转而**立即用微任务调度**一个高优先级的同步任务 (`performSyncWorkOnRoot`)。

3.  **执行高优先级任务**：

    - `performSyncWorkOnRoot` 执行，它只处理 `SyncLane` 的更新。
    - `renderRoot` -> `commitRoot` 顺次执行，只完成了和用户点击相关的UI变更。
    - 在 `commitRoot` 的开始，`markRootFinished` 会把 `SyncLane` 从 `root.pendingLanes` 中移除。

4.  **关键时刻：`commitRoot` 的结尾**：
    - 此时，高优先级的 `SyncLane` 任务已经完成了。但是，在 `root.pendingLanes` 中，**最初那个低优先级的 `DefaultLane` 仍然存在！**
    - 如果没有 `commitRoot` 末尾的 `ensureRootIsScheduled(root)` 调用，整个 React 的工作流程就到此为止了。那个被遗留下来的低优先级更新将永远不会被渲染，除非有其他新的更新进来“唤醒”调度系统。
    - **`ensureRootIsScheduled` 在这里的作用**就是“最后看一眼工作板”。它检查 `root.pendingLanes`，发现：“哦，还有一个 `DefaultLane` 的活儿没干呢！” 于是，它会根据这个被遗留的任务，重新向 Scheduler 安排一次新的（这次是低优先级的）调度。

### 结论

**作为一个安全网，确保在完成一次更新（特别是被高优先级任务“插队”完成的更新）后，不会遗留下任何待处理的低优先级任务。它保证了 React 调度系统的公平性和完整性，确保每一个更新最终都有机会被执行。**
