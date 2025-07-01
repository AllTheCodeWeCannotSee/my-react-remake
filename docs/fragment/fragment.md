git

#### Fragment 的几种情况

1. 单节点：Fragment 包裹其他组件
2. 多节点：Fragment 与其他组件同级
3. 数组形式的Fragment

### 三种情况的直观例子

#### 1. 单节点：Fragment 包裹其他组件

html

```html
<>
  <div></div>
  <div></div>
</>
// 对应DOM
<div></div>
<div></div>
```

jsx

```js
jsxs(Fragment, {
	children: [jsx('div', {}), jsx('div', {})]
});
```

#### 2. 多节点：Fragment 与其他组件同级

```html
<ul>
  <>
    <li>1</li>
    <li>2</li>
  </>
  <li>3</li>
  <li>4</li>
</ul>

// 对应DOM
<ul>
  <li>1</li>
  <li>2</li>
  <li>3</li>
  <li>4</li>
</ul>
```

jsx

```js
jsxs('ul', {
	children: [
		jsxs(Fragment, {
			children: [
				jsx('li', {
					children: '1'
				}),
				jsx('li', {
					children: '2'
				})
			]
		}),
		jsx('li', {
			children: '3'
		}),
		jsx('li', {
			children: '4'
		})
	]
});
```

#### 3. 数组形式的Fragment

html

```html
// arr = [
<li>c</li>
,
<li>d</li>
]

<ul>
	<li>a</li>
	<li>b</li>
	{arr}
</ul>

// 对应DOM
<ul>
	<li>a</li>
	<li>b</li>
	<li>c</li>
	<li>d</li>
</ul>
```

### 三种情况对应的修改

#### 1. 单节点：Fragment 包裹其他组件

type为Fragment的ReactElement，对单一节点的Diff需要考虑Fragment的情况

#### 2. 多节点：Fragment 与其他组件同级

children为数组类型，则进入reconcileChildrenArray方法，数组中的某一项为Fragment，所以需要增加「type为Fragment的ReactElement的判断」，同时beginWork中需要增加Fragment类型的判断。

#### 3. 数组形式的Fragment

type为Fragment的ReactElement，对单一节点的Diff需要考虑Fragment的情况

### 通用的修改

#### completeWork

bubbleProperties()

#### commitWork - Fragment对ChildDeletion的影响

ChildDeletion删除DOM的逻辑：

找到子树的根Host节点
找到子树对应的父级Host节点
从父级Host节点中删除子树根Host节点

#### 对React的影响

React包需要导出Fragment，用于JSX转换引入Fragment类型
