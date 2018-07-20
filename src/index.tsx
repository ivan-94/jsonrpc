/**
 * JSONRPC 2.0 实现
 * TODO: 测试用例
 */
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
  next: (request: JSONRPCRequest<any>) => Promise<JSONRPCResponse<any>>,
) => Promise<JSONRPCResponse<any>>

export const ErrJsonParse = 0
export const ErrIDNotMatching = 2

function createError<P, R>(
  message: string,
  code: number,
  request: JSONRPCRequest<P>,
  response?: JSONRPCResponse<R>,
): RequestError<P, R> {
  const error = new Error(message) as any
  error.code = code
  error.request = request
  error.response = response
  return error
}

export default class JSONRPC {
  private root: string
  // 拦截器
  private interceptor: RPCInterceptor
  public constructor(root: string, interceptor?: RPCInterceptor) {
    this.root = root
    if (interceptor == null) {
      this.interceptor = async (request, req, next) => {
        return await next(request)
      }
    } else {
      this.interceptor = interceptor
    }
  }

  public setInterceptor(i: RPCInterceptor) {
    this.interceptor = i
  }

  public request<P, R>(method: string, params?: P): Promise<R> {
    const id = Date.now()
    let request: JSONRPCRequest<P> = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }

    return new Promise(async (res, rej) => {
      const req = new XMLHttpRequest()
      req.open('POST', this.root)
      const { request: finalRequest, response } = await this.interceptRequest(
        request,
        req,
      )

      req.onreadystatechange = async () => {
        // 响应处理
        if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
          try {
            let resp = JSON.parse(req.responseText) as JSONRPCResponse<R>
            resp = await response(resp)
            if (resp.error != null) {
              rej(
                createError(resp.error.message, resp.error.code, request, resp),
              )
            } else if (resp.id !== id) {
              rej(createError('id not match', ErrIDNotMatching, request, resp))
            } else {
              res(resp.result)
            }
          } catch (error) {
            rej(createError(error.message, 0, request))
          }
        } else if (req.readyState === XMLHttpRequest.DONE) {
          // 网络异常
          const error = createError(
            req.status === 0 ? '当前网络不佳，请稍后再试' : req.statusText,
            req.status,
            request,
          )
          rej(error)
        }
      }

      // 请求
      req.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
      req.send(JSON.stringify(finalRequest))
    })
  }

  private interceptRequest(
    request: JSONRPCRequest<any>,
    xhr: XMLHttpRequest,
  ): Promise<{
    request: JSONRPCRequest<any>
    response: (res: JSONRPCResponse<any>) => Promise<JSONRPCResponse<any>>
  }> {
    return new Promise((requestResolve, rej) => {
      let responsePromise = new Promise<JSONRPCResponse<any>>(
        responseResolve => {
          this.interceptor(request, xhr, req => {
            return new Promise<JSONRPCResponse<any>>(resolve => {
              requestResolve({
                request: req,
                response: res => {
                  resolve(res)
                  return responsePromise
                },
              })
            })
          }).then(responseResolve)
        },
      )
    })
  }
}
