# JSONRPC

JSONRCP 客户端

## 安装

```shell
yarn add @gdjiami/jsonrpc
```

## 使用

实例化

```typescript
import RPC from '@gdjiami/jsonrpc'

const root = '/jsonrpc'
const rpc = new RPC(root, async (request, xhr, next) => {
  // 设置拦截器
  const infoStr = window.sessionStorage.getItem(AUTH_INFO)
  if (infoStr) {
    const info = JSON.parse(infoStr) as AuthInfo
    // 设置token Header
    xhr.setRequestHeader(TOKEN_HEADER, info.accessToken)
  }

  // 触发请求
  const response = await next(request)
  // 处理响应
  dosomethingWith(response)

  // 返回响应给调用者
  return response
})
```

调用

```typescript
interface PingParams {
  content: string
}

async function ping(params: PingParams) { 
  try {
    // 可以使用泛型变量声明'请求的参数类型'和'响应类型'
    const res = await rpc.request<PingParams, PingParams>(
      'utils.ping',
      params,
    )
    console.log(res.content)
  } catch (err) {
    // 在这里捕获HTTP错误，JSONRPC协议错误(通过error对象返回)
    message.error(`请求失败: ${err.message}`)
  }
}
```

## License

This project is licensed under the terms of the
[MIT license](LICENSE).
