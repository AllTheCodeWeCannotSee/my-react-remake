tag:

- Passive: 实现异步，commit 阶段不会立刻执行，会在渲染后的空闲时间执行
- HookHasEffect: 表示这个 Effect 在本次渲染中需要被触发。如果依赖项没有变化，这个标记就不会被加上，从而跳过副作用的执行

create:

- 传递给 useEffect 的第一个参数，也就是那个副作用函数
- 如果 tag 中包含了 HookHasEffect，React 就会调用这个 create 函数来执行副作用

destroy:

- 是由 create 函数返回的清理函数。在组件卸载前，或者在下一次副作用（create）执行前调用

deps: 依赖数组

next: 指向下一个 Effect，形成环形链表
