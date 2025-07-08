### 示例代码

```jsx
const ThemeContext = createContext('默认主题');

function App() {
	return (
		<ThemeContext.Provider value="暗色">
			<ThemedComponent />
			<ThemeContext.Provider value="亮色">
				<ThemedComponent />
			</ThemeContext.Provider>
			<ThemedComponent />
		</ThemeContext.Provider>
	);
}
```

### 核心机制：一个栈，一个临时变量

- **`prevContextValueStack`**: 把它想象成一个**后进先出**的“保险箱”。每当我们遇到一个更深层的 `Provider`，就把当前 `Provider` 的值存进去。
- **`prevContextValue`**: 这是一个“临时工”变量，它帮助完成值的交换，在 `push` 和 `pop` 操作中临时持有上一个作用域的值。

### Mermaid 图解：变量状态的全程追踪

```mermaid
sequenceDiagram
    participant React as React渲染流程
    participant Stack as prevContextValueStack
    participant TempVar as prevContextValue
    participant ContextValue as ThemeContext._currentValue

    Note over React, ContextValue: **开始渲染**<br/>初始状态
    ContextValue->>ContextValue: '默认主题'
    TempVar->>TempVar: null (初始)
    Stack->>Stack: [] (空)

    React->>React: **进入 外层Provider (value="暗色")**
    Note right of React: 调用 pushProvider(ThemeContext, "暗色")
    React->>Stack: 1. push(prevContextValue)<br/>将 null 存入
    Stack->>Stack: [null]
    React->>TempVar: 2. prevContextValue = _currentValue<br/>保存 '默认主题'
    TempVar->>TempVar: '默认主题'
    React->>ContextValue: 3. _currentValue = "暗色"
    ContextValue->>ContextValue: '暗色'

    React->>React: 渲染第一个 ThemedComponent (读取 '暗色')

    React->>React: **进入 内层Provider (value="亮色")**
    Note right of React: 调用 pushProvider(ThemeContext, "亮色")
    React->>Stack: 1. push(prevContextValue)<br/>将 '默认主题' 存入
    Stack->>Stack: [null, '默认主题']
    React->>TempVar: 2. prevContextValue = _currentValue<br/>保存 '暗色'
    TempVar->>TempVar: '暗色'
    React->>ContextValue: 3. _currentValue = "亮色"
    ContextValue->>ContextValue: '亮色'

    React->>React: 渲染第二个 ThemedComponent (读取 '亮色')

    React->>React: **离开 内层Provider**
    Note right of React: 调用 popProvider(ThemeContext)
    React->>ContextValue: 1. _currentValue = prevContextValue<br/>恢复为 '暗色'
    ContextValue->>ContextValue: '暗色'
    React->>TempVar: 2. prevContextValue = pop()<br/>从栈中弹出 '默认主题'
    Stack->>Stack: [null]
    TempVar->>TempVar: '默认主题'

    React->>React: 渲染第三个 ThemedComponent (读取 '暗色')

    React->>React: **离开 外层Provider**
    Note right of React: 调用 popProvider(ThemeContext)
    React->>ContextValue: 1. _currentValue = prevContextValue<br/>恢复为 '默认主题'
    ContextValue->>ContextValue: '默认主题'
    React->>TempVar: 2. prevContextValue = pop()<br/>从栈中弹出 null
    Stack->>Stack: [] (空)
    TempVar->>TempVar: null

    Note over React, ContextValue: 渲染结束
```
