- lane 作为 update 的优先级, 二进制位
- lanes 作为 lane 的集合, 二进制位

### 1. 数据结构的改造

Q: 如何知道哪些lane被消费，还剩哪些lane没被消费？

A: 改造 FiberRootNode

- 新增字段：本次更新的 lane
- 新增字段：所有未被消费的 lane

### 2. 触发的更新，改造

- ReactDOM.createRoot(root).render(<App/>)

- useState的dispatch方法
