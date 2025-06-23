```mermaid
graph TD
    subgraph "Fiber 树与遍历顺序"
        A["A (div)<br/>begin: 1<br/>complete: 6"] --> B["B (p)<br/>begin: 2<br/>complete: 2"]
        A --> C["C (div)<br/>begin: 4<br/>complete: 5"]
        B --> D["D (span)<br/>begin: 3<br/>complete: 1"]
        C --> E["E (span)<br/>begin: 5<br/>complete: 3"]
        C --> F["F (span)<br/>begin: 6<br/>complete: 4"]
    end
```

```js
function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	while (node !== null) {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = node;
	}
}
```
