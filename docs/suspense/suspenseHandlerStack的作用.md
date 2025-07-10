`suspenseHandlerStack` 的核心作用是**跟踪和管理当前正在渲染的嵌套 `<Suspense>` 组件边界**。

```jsx
<Suspense fallback={<p>外部加载中...</p>}>
	<ComponentA />
	<Suspense fallback={<p>内部加载中...</p>}>
		<ComponentB />
	</Suspense>
</Suspense>
```

当 `<ComponentB />` 在渲染时需要异步加载数据而“挂起”（suspend）时，React 必须准确地知道应该显示**哪个** `fallback`——是“内部加载中...”而不是“外部加载中...”。`suspenseHandlerStack` 就是实现这一点的机制。
