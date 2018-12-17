# JSONRPC 
[![](https://img.shields.io/npm/v/@gdjiami/jsonrpc.svg)](https://www.npmjs.com/package/@gdjiami/jsonrpc)


JSONRPC 客户端

## 安装

```shell
yarn add @gdjiami/jsonrpc
```

## 使用

实例化

```typescript
import RPC from '@gdjiami/jsonrpc'

/**
 * 设置RPC root url
 */

const root = '/jsonrpc'
const rpc = new RPC(root)

/**
 * 设置拦截器(可选)
 */
rpc.addInterceptor(async (request, xhr, next) => {
  const token = authService.getToken()
  if (token) {
    xhr.setRequestHeader(TOKEN_HEADER, token)
  }

  try {
    // 发起请求
    return await next()
  } catch (error) {
    // 捕获错误
    const { code } = error as RequestError<any, any>
    if (code === AUTH_FAILED_CODE) {
      console.warn('会话失效')
      try {
        // refresh token
        await authService.refresh()
        // refresh successful, retry
        return await rpc.retry<any>(request)
      } catch (err) {
        console.warn('刷新token失败', err)
        throw err
      }
    }

    throw error
  }
})

// 可以添加多个拦截器。拦截器的处理原理和`koa`中间件一样
```

调用

```typescript
async function ping(params: PingParams) {
  try {
    // 可以使用泛型变量声明：<响应类型, [请求的参数类型(可选)]>
    const res = await rpc.request<{ content: string }>('utils.ping', params)
    console.log(res.content)
  } catch (err) {
    // 在这里捕获HTTP错误，JSONRPC协议错误(通过error对象返回)
    message.error(`请求失败: ${err.message}`)
  }
}
```

## API

### `constructor(root: string)`: 创建 JSONRPC 客户端

- **root**: RPC 根路径

### `#request<R, P = {}>(method: string, params?: P): Promise<R>`: 发起请求

- **method**: 调用方法
- **params**: 调用参数
- 返回 Promise，resolved 响应结果中的 result 字段数据

如果请求失败，将抛出 RequestError<P, R>类型的错误对象, 可以这样处理错误:

```typescript
import { RequestError } from '@gdjiami/jsonrpc'

async function myRequest() {
  try {
    // 可以使用泛型变量声明：<响应类型, [请求的参数类型(可选)]>
    const res = await rpc.request<{ content: string }>('utils.ping', params)
  } catch (err) {
    const { code, request, response, message } = err as RequestError<any, any>
    // 在这里捕获HTTP错误，JSONRPC协议错误(通过error对象返回)
    message.error(`请求失败: ${err.message}`)
  }
}
```

### `#addInterceptor(i: RPCInterceptor)`: 添加拦截器

- **RPCInterceptor**： 拦截器方法

```typescript
/**
 * 拦截器方法
 */
export type RPCInterceptor = (
  /**
   * JSONRPC 请求对象
   */
  request: JSONRPCRequest<any>,
  /**
   * XMLHttpRequest 对象，可以对ajax请求进行预处理，比如添加Header
   */
  xhr: XMLHttpRequest,
  /**
   * 调用下一个拦截器，如果是最后一个拦截器则发起请求。
   * 返回一个Promise，可以在响应的内容进行操作或后处理
   */
  next: () => Promise<JSONRPCResponse<any>>,
) => Promise<JSONRPCResponse<any>>

/**
 * JSON RPC 请求对象
 */

export interface JSONRPCRequest<T> {
  jsonrpc: '2.0'
  method: string
  id: string | number
  params?: T
}

/**
 * JSON RPC 响应对象
 */

export interface JSONRPCResponse<T> {
  jsonrpc: '2.0'
  id: string | number
  error?: JSONRPCError
  result: T
}

/**
 * JSON RPC 错误对象
 */

export interface JSONRPCError {
  code: number
  message: string
  data?: any
}
```

### `#retry<R, P = {}>(request: JSONRPCRequest<P>): Promise<R>`

重新发起请求， 主要用于拦截器

## 参考

[JSONRPC 协议](https://www.jsonrpc.org/specification)

## License

This project is licensed under the terms of the
[MIT license](LICENSE).
