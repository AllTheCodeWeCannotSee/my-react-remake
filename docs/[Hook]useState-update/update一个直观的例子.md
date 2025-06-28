### 前提

```js
function MyComponent() {
	const [number, setNumber] = useState(0); // Hook 1
	const [text, setText] = useState('hello'); // Hook 2
}
```

- 假设它已经完成了首次渲染

初始状态 (Update 前):

current 树存在，其 Fiber 节点的 memoizedState 指向一个包含两个 Hook 对象的链表。现在，我们触发一次更新：调用 setText('world')。

### 直观的流程图

```mermaid
graph TD
    A["<b>初始状态 (Update前)</b><br/><br/><b>currentFiber.memoizedState:</b><br/>[Hook1: state 0] -> [Hook2: state 'hello']<br/><br/><b>全局指针:</b><br/>currentHook: null<br/>workInProgressHook: null"]

    B["<b>步骤1: 处理第一个useState(number)</b><br/><br/><b>动作:</b><br/>- 读取旧Hook1, 创建新的wip Hook1<br/><br/><b>currentHook 指向:</b><br/>[旧Hook1: state 0]<br/><br/><b>wip链表构建为:</b><br/>[新Hook1: state 0]<br/><br/><b>workInProgressHook 指向:</b><br/>[新Hook1: state 0]"]

    C["<b>步骤2: 处理第二个useState(text)</b><br/><br/><b>动作:</b><br/>- 读取旧Hook2, 创建含更新状态的新wip Hook2<br/><br/><b>currentHook 移动到:</b><br/>[旧Hook2: state 'hello']<br/><br/><b>wip链表构建为:</b><br/>[新Hook1] -> [新Hook2: state 'world']<br/><br/><b>workInProgressHook 移动到:</b><br/>[新Hook2: state 'world']"]

    D["<b>最终状态 (Commit后)</b><br/><br/><b>新的currentFiber.memoizedState变为:</b><br/>[Hook1: state 0] -> [Hook2: state 'world']<br/><br/><b>全局指针重置:</b><br/>currentHook: null<br/>workInProgressHook: null"]

    A -->|"调用setText('world'), 触发更新"| B
    B -->|"处理下一个Hook"| C
    C -->|"渲染完成并提交"| D
```

### 流程图解释

#### **A. 初始状态 (Update前)**

- `current` 树的 Fiber 节点上已经有一条由两次 `useState` 调用创建的 Hook 链表。
- 在开始处理 `MyComponent` 的更新渲染之前，两个全局指针 `currentHook` 和 `workInProgressHook` 都被重置为 `null`。

#### **B. 步骤1: 处理第一个 `useState(number)`**

- `updateWorkInProgresHook` 被调用。
- **读取**: 它从 `currentFiber.memoizedState` 拿到旧的 `Hook1`，并让 `currentHook` 指向它。
- **创建**: 基于 `currentHook` 的信息（状态为 `0`），创建一个新的 `wip Hook1`。
- **链接**: 因为这是 `wip` 链表的第一个 Hook，所以 `wipFiber.memoizedState` 和 `workInProgressHook` 都指向这个新创建的 `wip Hook1`。

#### **C. 步骤2: 处理第二个 `useState(text)`**

- `updateWorkInProgresHook` 再次被调用。
- **读取**: `currentHook` 指针向前移动，指向旧的 `Hook2` (`currentHook = currentHook.next`)。
- **创建**: 基于 `currentHook`（状态为 `'hello'`）和 `setText('world')` 这个更新，创建一个新的 `wip Hook2`，其状态被计算为 `'world'`。
- **链接**: `workInProgressHook` 指针将这个新的 `wip Hook2` 连接到 `wip Hook1` 的后面，然后自身也移动到链表的末尾，指向 `wip Hook2`。

#### **D. 最终状态 (Commit后)**

- 组件渲染完成，包含新状态的 `wip` 树在“提交”阶段成为了新的 `current` 树。
- 我们刚刚构建的 `wip` Hooks 链表现在成为了新的 `current` Hooks 链表，持久化了这次更新的结果。
- 两个全局指针再次被重置为 `null`，为下一次可能的更新做好准备。
