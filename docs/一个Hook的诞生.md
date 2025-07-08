### jsx -> ReactElement

1. packages/shared/ReactTypes.ts: 如果需要新的<XXXHook></XXXHook>

2. packages/shared/ReactSymbols.ts: 用于标记这类新的 ReactElement

### import { useXXX } from 'react'

3. packages/react/src/currentDispatcher.ts: Dispatcher Type加入这个新hook

4. packages/react/index.ts: 共享数据层，数据的拉取，export const useXXX

### fiber 的修改

5. packages/react-reconciler/src/workTags.ts: 新的 ReactElement，新的 Fiber Tag

6. packages/react-reconciler/src/fiber.ts: 新的 ReactElement，createFiberFromElement 新的分支

### 这个 Hook 的实现

packages/react-reconciler/src/fiberHooks.ts: hook数据产生，推送到数据共享层

### 为他修改整个更新流程: beginWork, completeWork, commitWork
