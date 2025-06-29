#### beginWork

#### completeWork

#### commitWork

## 0. Mount

### HostRoot

### HostComponent

### HostText

#### beginWork

#### completeWork

- 创建真实dom:
  const instance = createTextInstance(newProps.content);
- 存储到 wip.stateNode
- 冒泡
- 不需要标记 placement

#### commitWork

#### beginWork

#### completeWork

#### commitWork

### FunctonalComponent

## 1. Placement

### HostRoot

### HostComponent

### HostText

### FunctonalComponent

## 2. Update

### HostRoot

### HostComponent

### HostText

#### beginWork

#### completeWork

对比新旧文本内容

- 相同：pass
- 不同：打上 Update 标记

冒泡

#### commitWork

### FunctonalComponent

## 3. ChildDeletion

### HostRoot

### HostComponent

### HostText

#### beginWork

#### completeWork

#### commitWork

### FunctonalComponent

commitWork-ChildDeletion

commitWork-Update-HostText:

commitWork-Delete
