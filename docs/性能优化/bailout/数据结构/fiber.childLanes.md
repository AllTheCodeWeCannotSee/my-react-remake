## 作用

记录子树的更新

## 思路

## 实现

fiber.childLanes

## 对比

和 fiber.subtreeFlags 类似

## 工作流程

### 生产

父节点的 childLanes 由 completeWork 从下向上冒泡得到：bubbleProperties()
每次触发更新，`(fiber, ... , 根]` 这条线路上的节点，更新childLanes：markUpdateLaneFromFiberToRoot()

### 消费
