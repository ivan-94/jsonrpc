/**
 * 类型定义
 */
/* tslint:disable:no-any */
export interface JSONRPCRequest<T> {
  jsonrpc: '2.0'
  method: string
  id: string | number
  params?: T
}

export interface JSONRPCError {
  code: number
  message: string
  data?: any
}

export interface JSONRPCResponse<T> {
  jsonrpc: '2.0'
  id: string | number
  error?: JSONRPCError
  result: T
}

export interface RequestError<P, R> {
  message: string
  code: number
  request: JSONRPCRequest<P>
  response?: JSONRPCResponse<R>
}

export type RPCInterceptor = (
  request: JSONRPCRequest<any>,
  xhr: XMLHttpRequest,
  next: () => Promise<JSONRPCResponse<any>>,
) => Promise<JSONRPCResponse<any>>

/**
 * 请求参数
 */
export interface RequestOptions {
  timeout?: number
}
