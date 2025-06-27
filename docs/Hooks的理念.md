感知上下文的能力:

- hooks 不能脱离 FC 的上下文
- 一个 useState 怎么知道 自己是在 useEffect 的回调函数的环境中呢(不能这样)

感知 mount/update:

解决：

不同上下文的环境中，调用的 hooks 其实不是同一个
->
需要用 react-reconciler 感知上下文
->
需要共享数据(react 包与 react-reconciler包)

```mermaid
flowchart LR
    subgraph Reconcier

        subgraph mount时
            direction TB
            useState1[useState]
            useEffect1[useEffect]
            rest1[...]
        end
        subgraph update时
            useState2[useState]
            useEffect2[useEffect]
            rest2[...]
        end
        subgraph hook上下文
            useState3[useState]
            useEffect3[useEffect]
            rest3[...]

        end

    end
    subgraph 内部数据共享层
        data[当前使用的 Hooks 集合]
    end

     mount时 --> data
     update时 --> data
     hook上下文 --> data
     data --> React
     useState1 ~~~ useEffect1 ~~~ rest1
     useState2 ~~~ useEffect2 ~~~ rest2
     useState3 ~~~ useEffect3 ~~~ rest3
```
