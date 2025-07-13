用于处理**错误边界 (Error Boundaries)** 和 **Suspense 边界**的“捕获”行为。

### `DidCapture` Flag 的核心意义

一句话总结：**`DidCapture` flag 的作用是，向 `commit` 阶段发出一个信号，表明一个边界组件（Error Boundary 或 Suspense 组件）在渲染过程中已经成功“捕获”了一个来自其子孙组件的错误或挂起信号。**

它就像一个“救援成功”的勋章。当一个边界组件成功处理了一次“险情”后，React 就会给它挂上这个勋章，以便在后续阶段执行相应的“善后”工作（比如调用 `componentDidCatch` 生命周期）。

---

### `DidCapture` 的工作流程

这个 flag 的生命周期同样涉及多个阶段和文件，但核心围绕着**错误/挂起的回溯（unwind）和布局副作用（layout effects）的提交**。

#### 1\. 设置标记 (在 `fiberUnwindWork.ts` 中)

与 `Visibility` 在 `completeWork` 中设置不同，`DidCapture` 是在\*\*回溯（unwind）\*\*阶段，当 React 找到了能够处理错误的“捕手”时被设置的。

这个过程要和我们之前讨论的 `throwAndUnwindWorkLoop` 联系起来：

1.  **中断发生**: 子组件抛出错误或挂起信号。
2.  **回溯启动**: `throwAndUnwindWorkLoop` 开始从中断点向上回溯。
3.  **寻找捕手**: 在回溯的每一步，都会调用 `unwindWork` 函数来检查当前节点。`throwException` 函数已经提前给最近的 Suspense 或 Error Boundary 打上了 `ShouldCapture` 标记。
4.  **找到捕手并设置 `DidCapture`**: 在 `unwindWork` 中，当它检查到一个节点有 `ShouldCapture` 标记时，它就知道找到了捕手。

<!-- end list -->

```typescript
// 文件: packages/react-reconciler/src/fiberUnwindWork.ts

function unwindWork(wip: FiberNode) {
	const flags = wip.flags;

	// 检查这个节点是否被标记为“应该捕获”
	if ((flags & ShouldCapture) !== NoFlags) {
		// 清除“应该捕获”的指令标记
		wip.flags &= ~ShouldCapture;
		// 添加“已经捕获”的报告标记！
		wip.flags |= DidCapture;
		return wip; // 返回这个捕手，中断回溯
	}
	// ... (其他回溯逻辑)
	return null;
}
```

**流程解释**:

- `unwindWork` 在向上回溯时，一旦发现一个组件带有 `ShouldCapture` 指令，就意味着这个组件是本次中断的目标“捕手”。
- 它会立刻移除 `ShouldCapture` 指令（任务已接收），并马上添加上 `DidCapture` 这个报告标记。
- 然后它返回这个捕手节点 (`wip`)，这会终止 `throwAndUnwindWorkLoop` 的回溯循环，并将控制权交给这个捕手，让它开始渲染 `fallback` 或错误UI。

#### 2\. 消费标记 (在 `commitWork.ts` 中)

`commit` 阶段分为多个子阶段。`DidCapture` 主要是在\*\*布局副作用（Layout Effects）\*\*阶段被消费，因为像 `componentDidCatch` 这样的生命周期方法需要在 DOM 更新后、浏览器绘制前同步执行。

`commitLayoutEffects` 函数会遍历所有带有副作用的节点。

```typescript
// 文件: packages/react-reconciler/src/commitWork.ts

function commitLayoutEffects(root: FiberRootNode, lane: Lane) {
	let wip = root.finishedWork;
	// ...
	while (wip !== null) {
		const current = wip.alternate;
		const flags = wip.flags;

		// 检查这个节点是否带有“已经捕获”的报告
		if ((flags & DidCapture) !== NoFlags) {
			commitDidCapture(wip); // 交给专门的函数去处理
		}
		// ...
	}
}
```

#### 3\. 执行操作 (`commitDidCapture` 及生命周期调用)

当 `commitLayoutEffects` 发现一个节点有 `DidCapture` 标记时，它会调用 `commitDidCapture` 函数。

```typescript
// 文件: packages/react-reconciler/src/commitWork.ts (概念简化)

function commitDidCapture(finishedWork: FiberNode) {
	switch (finishedWork.tag) {
		case ClassComponent:
			const instance = finishedWork.stateNode;
			const error = finishedWork.updateQueue.capturedValues[0]; // 获取捕获到的错误
			// 调用 componentDidCatch 生命周期
			instance.componentDidCatch(error.value);
			break;
		case HostRoot:
			// 如果错误一直冒泡到根节点都无人捕获，在这里处理
			break;
		// ... 其他边界类型的处理
	}
}
```

**流程解释**:

- `commitDidCapture` 会检查这个捕手组件的类型。
- 如果是 `ClassComponent`（即一个错误边界），它会从组件的 `updateQueue` 中获取之前捕获到的错误信息。
- 然后，它会调用这个类组件实例的 `componentDidCatch` 方法，并将错误信息作为参数传进去。这允许开发者执行记录错误日志等副作用操作。
- 如果捕手是 `<Suspense>` 组件，虽然它也用 `DidCapture` 标记，但它没有类似 `componentDidCatch` 的生命周期。这个标记主要确保了其 `fallback` UI 的正确提交。

### 总结

`DidCapture` flag 是 React 错误和挂起处理机制中的一个**事后报告**。

- **它是一个报告**: 告诉 `commit` 阶段，某个边界组件在渲染时成功完成了一次“捕获”任务。
- **它连接了渲染与副作用**: 它是在渲染的回溯（unwind）阶段被**设置**的，但在 `commit` 的布局副作用阶段才被**消费**。
- **它触发了生命周期**: 它的最终目的是为了在正确的时间点（DOM 已更新）调用像 `componentDidCatch` 这样的生命周期方法，让开发者有机会对捕获到的错误执行自定义的副作用逻辑。

与 `Visibility` 控制 DOM 表现不同，`DidCapture` 更多地是关于**调用组件代码和执行生命周期**，是 React 实现健壮的声明式错误处理的关键一环。
