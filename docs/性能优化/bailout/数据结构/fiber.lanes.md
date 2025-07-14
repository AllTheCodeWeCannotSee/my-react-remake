## 作用

作用：判断四要素的state时，“存在update，但计算得出的state没变化”的情况

> 四要素
>
> - props不变
> - state不变
>
>   - 不存在update
>   - 存在update，但计算得出的state没变化 <--- 这里
>
> - context不变
> - type不变

## 思路

## 实现

fiber.lanes

## 对比

root.pendingLanes 是所有 fibernode.lanes 的合集

## 工作流程

### 生产

dispatchSetState
enqueueUpdate

### 消费

updateState
processUpdateQueue

### 重置

#### beginWork中：wip.lanes = NoLanes;

fibernode.lanes 存在的意义就是判断本次 render 该节点能否 bailout

得到确定的结果（不能）后重置，以迎接：接下来的要么是setState产生的lane，要么是子树 bubble 上来的 lane
