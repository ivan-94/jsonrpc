/**
 * JSONRPC 2.0 实现
 * TODO: 测试用例
 */
/* tslint:disable:no-any */
import {
  RPCInterceptor,
  JSONRPCResponse,
  JSONRPCRequest,
  RequestError,
} from './type'
import compose from './compose'
import extraResult from './interceptors/extraResult'

export * from './type'
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
  private networkErrorMessage: string = '当前网络不佳，请稍后再试'
  // 拦截器
  private interceptor: RPCInterceptor[] = []
  private preInterceptor: RPCInterceptor[] = [extraResult]
  public constructor(root: string) {
    this.root = root
  }

  public setNetworkErrorMessage(message: string) {
    this.networkErrorMessage = message
  }

  public addInterceptor(i: RPCInterceptor) {
    this.interceptor.push(i)
  }

  public request<R, P = {}>(method: string, params?: P): Promise<R> {
    const id = Date.now()
    const request: JSONRPCRequest<any> = {
      jsonrpc: '2.0',
      method,
      params: params || {},
      id,
    }

    return this.rawRequest(request, true)
  }

  public retry<R, P = {}>(request: JSONRPCRequest<P>): Promise<R> {
    return this.rawRequest(request)
  }

  private rawRequest<R, P = {}>(
    request: JSONRPCRequest<P>,
    shoudlExtraResult: boolean = false,
  ): Promise<R> {
    const req = new XMLHttpRequest()
    req.open('POST', this.root)
    const interceptors = shoudlExtraResult
      ? [...this.preInterceptor, ...this.interceptor]
      : this.interceptor
    const fn = compose(interceptors)

    return fn(request, req, (finalRequest, xhr, next) => {
      return new Promise((resolve, reject) => {
        // 请求
        req.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
        req.onreadystatechange = async () => {
          // 响应处理
          if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
            try {
              const resp = JSON.parse(req.responseText) as JSONRPCResponse<R>
              if (resp.error != null) {
                reject(
                  createError(
                    resp.error.message,
                    resp.error.code,
                    request,
                    resp,
                  ),
                )
              } else if (resp.id !== request.id) {
                reject(
                  createError('id not match', ErrIDNotMatching, request, resp),
                )
              } else {
                resolve(resp)
              }
            } catch (error) {
              reject(createError(error.message, 0, request))
            }
          } else if (req.readyState === XMLHttpRequest.DONE) {
            // 网络异常
            const error = createError(
              req.status === 0 ? this.networkErrorMessage : req.statusText,
              req.status,
              request,
            )
            reject(error)
          }
        }

        xhr.send(JSON.stringify(finalRequest))
      })
    })
  }
}
