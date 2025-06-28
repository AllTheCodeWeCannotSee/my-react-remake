React 不会直接修改 current 树上的任何东西，包括它的 Hooks 链表
而是创建一个全新的 wip Hook 对象，并将旧的状态（memoizedState）和更新队列（updateQueue）的引用复制过来。
这样做的好处是，如果本次渲染因为某种原因被中断（例如，更高优先级的更新插队），current 树依然是完整和一致的，可以随时恢复。wip 树作为一个“草稿”，可以直接被丢弃，不会产生副作用。

在update前，指针被重置：

- currentHook: null
- workInProgressHook: null
- wipFiber.memoizedState: null

- currentFiber.memoizedState: -> Hook1(number) -> Hook2(text) (这是我们宝贵的老数据)
