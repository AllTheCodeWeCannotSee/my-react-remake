好的，我们来详细解释 `FiberRootNode` 上的 `suspendedLanes` 属性。

这个属性定义在 `packages/react-reconciler/src/fiber.ts` 文件中，它是 React Suspense 调度机制中一个至关重要的\*\*“暂停列表”\*\*。

### `suspendedLanes` 的核心意义

一句话总结：**`suspendedLanes` 的作用是一个“车道”的位掩码（bitmask），用来记录在整个应用中，哪些渲染优先级（Lanes）因为子组件触发了 Suspense 而被“挂起”或“暂停”了。**

你可以把它想象成一个调度中心的“暂停施工”公告板。当某个优先级的渲染任务进行到一半，发现有组件在等待数据，React 就会在这个公告板上记下“这个优先级的车道暂时封闭”，以避免重复进入这条无法完成的“死路”。

---

### `suspendedLanes` 在工作流程中的作用

`suspendedLanes` 是连接“挂起”、“等待”和“恢复”这三个状态的关键。它的所有操作都集中在 `packages/react-reconciler/src/fiberLanes.ts` 文件中，并被 `workLoop.ts` 调用。

#### 1\. **标记为“挂起” (在 `markRootSuspended`)**

- **时机**：当一次渲染（比如以 `laneA` 的优先级进行）因为某个组件 `throw promise` 而无法完成时，`renderRoot` 函数会以 `RootDidNotComplete` 状态退出。紧接着，`performSyncWorkOnRoot` 或 `performConcurrentWorkOnRoot` 就会调用 `markRootSuspended`。
- **动作**：`markRootSuspended` 函数会把当前的渲染优先级 `laneA` **添加**到 `root.suspendedLanes` 这个位掩码中。

<!-- end list -->

```typescript
// 文件: packages/react-reconciler/src/fiberLanes.ts
export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
	root.suspendedLanes |= suspendedLane; // 使用“或”运算，将新的挂起车道合并进去
	root.pingedLanes &= ~suspendedLane;
}
```

#### 2\. **在调度中“忽略”挂起的车道 (在 `getNextLane`)**

- **时机**：当 React 的调度器需要决定下一个要执行的任务时，它会调用 `getNextLane` 来获取最高优先级的待处理任务。
- **动作**：`getNextLane` 在计算下一个要渲染的 `lane` 时，会**明确地排除掉**所有记录在 `suspendedLanes` 中的车道。

<!-- end list -->

```typescript
// 文件: packages/react-reconciler/src/fiberLanes.ts
export function getNextLane(root: FiberRootNode): Lane {
	const pendingLanes = root.pendingLanes;
	// ...
	// 关键步骤：从所有待办的车道中，排除掉被挂起的车道
	const suspendedLanes = pendingLanes & ~root.suspendedLanes;
	if (suspendedLanes !== NoLanes) {
		nextLane = getHighestPriorityLane(suspendedLanes);
	} else {
		// ... (处理被 ping 的情况)
	}
	return nextLane;
}
```

这个逻辑至关重要，它防止了 React 陷入一个**死循环**：不断地尝试渲染一个它明知道会因为等待数据而再次挂起的任务。

#### 3\. **从“挂起”中“恢复” (与 `pingedLanes` 联动)**

- **时机**: 当之前导致挂起的 `Promise` 完成后，`attachPingListener` 设置的 `ping` 函数会被调用。
- **动作**: `ping` 函数会调用 `markRootPinged`。`markRootPinged` 会检查导致挂起的那个 `lane` 是否在 `suspendedLanes` 中。如果是，它会将这个 `lane` 从 `suspendedLanes` 的关注范围中移出，并添加到 `pingedLanes` 中。
- **结果**: 当 `getNextLane` 再次运行时，它会发现之前被挂起的 `lane` 已经不在 `suspendedLanes` 的“黑名单”中了，于是就可以选择它作为下一个任务来执行，从而**恢复**之前被中断的渲染。

### 总结

`suspendedLanes` 是 React 调度器的一个**智能备忘录**，它让调度器变得更加高效和鲁棒：

1.  **它是一个“黑名单”**: 记录了所有因数据未就绪而无法完成的渲染优先级。
2.  **它防止了无效工作**: 确保调度器不会浪费资源去重复尝试一个注定会失败的任务。
3.  **它是恢复机制的基础**: 通过与 `pingedLanes` 配合，它构成了 Suspense 从“暂停”到“播放”的完整流程，确保数据到达后，渲染能够从正确的地方继续。
