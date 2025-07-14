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
