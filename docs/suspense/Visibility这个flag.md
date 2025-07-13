### `Visibility` Flag 的核心意义

一句话总结：**`Visibility` flag 的作用是，向 `commit` 阶段发出一个信号，表明一个 `OffscreenComponent` 包裹的内容需要被“隐藏”或“显示”，但不是通过挂载/卸载，而是通过改变其在宿主环境（如浏览器 DOM）中的可见性（例如，修改 CSS `display` 属性）。**

---

### `Visibility` 的工作流程

这个 flag 的整个生命周期涉及三个关键文件：`completeWork.ts` (设置标记)、`commitWork.ts` (消费标记)、和 `hostConfig.ts` (执行操作)。

#### 1\. 设置标记 (在 `completeWork.ts` 中)

`Visibility` flag 是在 `completeWork` 阶段，当 React 完成对一个 `SuspenseComponent` 的工作时被设置的。

```typescript
// 文件: packages/react-reconciler/src/completeWork.ts

// ...
		case SuspenseComponent:
			popSuspenseHandler();

			const offscreenFiber = wip.child as FiberNode;
			const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
			const currentOffscreenFiber = offscreenFiber.alternate;

			if (currentOffscreenFiber !== null) {
				const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';

				if (isHidden !== wasHidden) {
					// 可见性发生了变化！
					offscreenFiber.flags |= Visibility; // 在这里设置 Flag
					bubbleProperties(offscreenFiber);
				}
			}
            // ... (处理首次挂载的情况)
			bubbleProperties(wip);
			return null;
// ...
```

**流程解释**:

1.  React 处理一个 `<Suspense>` 组件时，会检查其内部的 `OffscreenComponent` 子组件。
2.  它会比较这次渲染 `OffscreenComponent` 的 `mode` (新的可见性状态，是 `'hidden'`还是 `'visible'`) 与上一次渲染的 `mode` (旧的可见性状态)。
3.  **如果 `isHidden !== wasHidden`**，即组件的可见性发生了切换（比如从加载 `fallback` 变为显示 `children`，或者反之），React 就会在 `OffscreenComponent` 的 Fiber 节点上用按位或操作（`|=`）添加上 `Visibility` 这个 flag。

#### 2\. 消费标记 (在 `commitWork.ts` 中)

当 `commit` 阶段开始时，`commitMutationEffects` 会遍历 Fiber 树，寻找带有副作用标记的节点。当它遇到一个带有 `Visibility` flag 的 `OffscreenComponent` 时，就会执行相应的逻辑。

```typescript
// 文件: packages/react-reconciler/src/commitWork.ts

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork;
	// ...
	if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
		const isHidden = finishedWork.pendingProps.mode === 'hidden';
		// 根据 isHidden 的值，去隐藏或显示所有子节点
		hideOrUnhideAllChildren(finishedWork, isHidden);
		finishedWork.flags &= ~Visibility; // 处理完毕后，移除flag
	}
};
```

**流程解释**:

1.  在 `commit` 阶段，当遍历到一个 `OffscreenComponent` 并且发现它的 `flags` 中包含 `Visibility` 时。
2.  它会读取该组件最新的 `mode` 属性，判断内容最终应该是隐藏 (`isHidden = true`) 还是显示 (`isHidden = false`)。
3.  然后，它调用 `hideOrUnhideAllChildren` 函数，将这个隐藏/显示的任务交由它来完成。
4.  执行完毕后，它会从 `flags` 中移除 `Visibility` 标记，防止重复操作。

#### 3\. 执行操作 (在 `hostConfig.ts` 中)

`hideOrUnhideAllChildren` 函数（在 `commitWork.ts` 中）会使用 `findHostSubtreeRoot` 找到所有需要被操作的真实 DOM 节点，然后调用 `hostConfig` 中定义的平台相关函数来执行最终的操作。

```typescript
// 文件: packages/react-dom/src/hostConfig.ts

export function hideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.setProperty('display', 'none', 'important'); // 通过设置 CSS 来隐藏
}

export function unhideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.display = ''; // 通过重置 CSS 来显示
}

// ... 还有针对文本节点的 hideTextInstance 和 unhideTextInstance
```

**流程解释**:

- `hideOrUnhideAllChildren` 函数最终会调用 `hideInstance` 或 `unhideInstance`。
- 这两个函数是平台相关的具体实现。在浏览器环境中（`react-dom`），它们通过修改 DOM 元素的 `style.display` 属性为 `'none'` 或 `''` 来实现节点的隐藏和显示。

### 总结

`Visibility` flag 是连接 React 内部状态和真实 UI 表现的桥梁，它专门服务于 `<Suspense>` 组件的 `Offscreen` 模式。

- **它是一个指令**：告诉 `commit` 阶段需要对某个组件的可见性进行操作。
- **它是一种优化**：通过改变可见性而不是卸载组件，React 能够完整地保留被隐藏组件的内部状态（包括 `useState` 的值、DOM 节点等）。当组件需要再次显示时，无需重新创建状态和 DOM，只需改变 CSS 属性，极大地提升了性能和用户体验。
