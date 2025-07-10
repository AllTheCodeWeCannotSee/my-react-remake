### beginWork

- 主要工作：1. 处理wip的子节点 2. 如果wip有状态->处理状态
- 前序dfs
- 由 父节点的 ReactElement 生成子节点 FiberNode
  - ReactElement存放在updateQueue（hostRootFiber）与 父节点的pendingProps中
- 打上 flags （placement）

### completeWork

- 主要工作：生成wip本身的真实dom
- 后序dfs
- 将真实DOM放入wip.statenode
  - 顺便将child-dom 连接到 wip-dom
- 传递副作用

### commitWork

- 将真实DOM从下到上连起来
- 处理 useEffect
