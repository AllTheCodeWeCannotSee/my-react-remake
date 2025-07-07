### `callbackNode` (Task 对象) 的概念性数据结构

`callbackNode` 实际上就是 Scheduler 内部创建的一个 Task 对象。这个对象必须包含足够的信息，以便 Scheduler 能够对它进行排序、执行和取消。

一个简化的 Task 对象结构看起来像这样：

```javascript
// 这是一个模拟的、概念上的 Task 对象结构
// 实际的 React 源码实现会更复杂，且属性名可能不同
const Task = {
	// 1. 身份标识
	id: 1, // 一个自增的、唯一的 ID，用于在任务队列中区分不同的任务。

	// 2. 要执行的工作
	callback: performConcurrentWorkOnRoot, // 最重要的属性，指向真正需要被执行的函数。

	// 3. 优先级信息
	priorityLevel: 3, // (NormalPriority)，记录了这个任务的原始调度优先级。

	// 4. 时间信息 (核心)
	startTime: 12345.67, // 任务被创建时的时间戳。
	expirationTime: 12395.67, // 任务的“过期时间”。这是 Scheduler 决定执行顺序的关键。
	// 过期时间 = startTime + timeout。
	// 不同优先级的任务，timeout 不同。
	// (例如: ImmediatePriority 的 timeout 是 -1，意味着立刻过期)

	// 5. 排序信息 (用于在任务队列中排序)
	sortIndex: 12395.67 // 通常就是 expirationTime，Scheduler 内部的任务队列（一个最小堆）会根据这个值来排序，
	// 确保 expirationTime 最小（最紧急）的任务总是在堆顶。
};
```

### 各属性的意义和作用

1.  **`id` (身份标识)**

    - **作用**：作为一个稳定且唯一的标识符。当有多个任务具有完全相同的过期时间时，可以用 `id` 作为第二排序标准，确保调度的稳定性。

2.  **`callback` (回调函数)**

    - **作用**：这是任务的“灵魂”，存储了\*\*“要做什么事”\*\*。在您的代码库中，它就是 `performConcurrentWorkOnRoot` 函数。当 Scheduler 决定执行这个 Task 时，它实际上就是调用这个 `callback` 函数。

3.  **`priorityLevel` (优先级)**

    - **作用**：记录了任务的原始意图（紧急、普通、空闲等）。虽然 `expirationTime` 是主要的排序依据，但这个原始优先级在某些高级场景下（如从一个暂停的任务恢复）可能仍然有用。

4.  **`startTime` 和 `expirationTime` (时间信息)**

    - **作用**：这是并发和时间分片的核心。Scheduler 通过 `performance.now()` 获取当前时间，并根据 `priorityLevel` 计算出一个 `timeout`，然后得出 `expirationTime`。
    - **`expirationTime` 决定一切**：Scheduler 的任务队列是一个**最小堆 (min-heap)**，它始终将 `expirationTime` 最小的任务放在最前面。这意味着：
      - **高优先级插队**：一个 `ImmediatePriority` 的任务，其 `expirationTime` 会被设置得非常小（甚至是过去的时间），所以它一进入队列就会立刻成为堆顶，从而“插队”到所有其他任务之前。
      - **任务饥饿处理**：一个低优先级的任务，虽然初始的 `expirationTime` 很大，但随着时间的流逝，当前时间最终会超过它的 `expirationTime`。这时，Scheduler 在执行 `workLoop` 时会发现这个任务“已超时”，并会同步地将其完成，防止它永远被高优先级任务“饿死”。
