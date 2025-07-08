tag:
---------------------------------- 源自ReactElement ---------------------------------
type: 来源: ReactElement -> babel，比如 App()
key:
ref: 一个ref对象/回调函数
pendingProps:
---------------------------------- 树形结构 ---------------------------------
return:
sibling:
child:
index: diff 算法会用到，Key 的候补, 值为 nextProps.children 数组的下标
alternate:
---------------------------------- 状态 ---------------------------------
memoizedProps:
memoizedState: 指向一个链表，链表的元素是Hooks（useState、useEffect...）
updateQueue:
---------------------------------- 副作用 ---------------------------------
flags:
subtreeFlags:
deletions: 这个属性是一个数组，它持有那些需要从 DOM 中移除的子 FiberNode 的引用
---------------------------------- DOM ---------------------------------
stateNode:
