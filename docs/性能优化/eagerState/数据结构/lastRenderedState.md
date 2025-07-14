## 作用

记录上次更新后 state 的值

## 实现

```js
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
	lastRenderedState: State; // eager
}
```

## 思路

## 工作流程

更新以下流程，用 lastRenderedState 记录计算出的state

- mountState
- updateState
