pendingPassiveEffects:

- unmount: 收集所有需要执行清理（destroy）函数的 useEffect
  - 组件即将被卸载
  - useEffect 的依赖项发生了变化，需要先清理上一次的副作用
- update: 收集所有需要执行创建（create）函数的 useEffect
  - 组件首次挂载
  - useEffect 的依赖项发生了变化

---------------------------------- 并发 ---------------------------------

callbackNode: 见《callbackNode的数据结构》
callbackPriority: 当前执行任务的优先级

---------------------------------- suspense ---------------------------------

- suspendedLanes

- pingedLanes
