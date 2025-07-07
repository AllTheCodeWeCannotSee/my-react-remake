用来告知 React 当前是否处于一个 "transition" 中

当使用 `useTransition` Hook 返回的 `startTransition` 函数时，`ReactCurrentBatchConfig.transition` 的值会被临时设置为 1

该更新会被赋予一个较低的 TransitionLane 优先级
