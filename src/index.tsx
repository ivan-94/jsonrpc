/**
 * JSONRPC 2.0 实现
 * TODO: 测试用例
 * TODO: 错误类
 */
/* tslint:disable:no-any */
import {
  RPCInterceptor,
  JSONRPCResponse,
  JSONRPCRequest,
  RequestError,
  RequestOptions,
} from './type'
import compose from './compose'
import extraResult from './interceptors/extraResult'

export * from './type'

export const ErrNetwork = 0
export const ErrJsonParse = 1
export const ErrIDNotMatching = 2
export const ErrCancel = 3
export const ErrTimeout = 4

export interface ClientOptions {
  // 忽略协议错误
  ignoreProtocolError?: boolean
}

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

export function isRequestError<P, R>(err: any): err is RequestError<P, R> {
  return (
    err != null && typeof err === 'object' && 'request' in err && 'code' in err
  )
}

const supportCheckOnline = 'onLine' in navigator

export enum ErrorType {
  Unknown,
  Cancel,
  Network,
  Client,
  Server,
}

const defaultOptions: RequestOptions = {}

/**
 * 创建取消信号
 * @param req
 */
export function createCancelError(req: JSONRPCRequest<any>) {
  return createError('cancelled', ErrCancel, req)
}

export function isCancelled(err: any) {
  return err && err.code === ErrCancel
}

export function isNetworkError(err: any) {
  return err && err.code === ErrNetwork
}

/**
 * 我们约定，400 - 500(不包含) 错误码范围的为客户端本身的错误
 * @param err
 */
export function isClientError(err: any) {
  return err && typeof err.code === 'number' && err.code >= 400 && err < 500
}

// 除上述错误类型之外的，都属于服务端错误
export function isServerError(err: any) {
  return !isCancelled(err) && !isNetworkError(err) && !isClientError(err)
}

export function getErrorType(err: any) {
  return isRequestError(err)
    ? isNetworkError(err)
      ? ErrorType.Network
      : isCancelled(err)
        ? ErrorType.Cancel
        : isClientError(err)
          ? ErrorType.Client
          : ErrorType.Server
    : ErrorType.Unknown
}

export default class JSONRPC {
  private root: string
  private networkErrorMessage: string = '当前网络不佳，请稍后再试'
  private timeoutErrorMessage: string = '请求超时，请稍后再试'
  // 拦截器
  private interceptor: RPCInterceptor[] = []
  private preInterceptor: RPCInterceptor[] = [extraResult]
  private option: ClientOptions
  public constructor(root: string, option: ClientOptions = {}) {
    this.option = option
    this.root = root
  }

  public setNetworkErrorMessage(message: string) {
    this.networkErrorMessage = message
  }

  public setTimeoutErrorMessage(mesg: string) {
    this.timeoutErrorMessage = mesg
  }

  public addInterceptor(i: RPCInterceptor) {
    this.interceptor.push(i)
  }

  public request<R, P = {}>(
    method: string,
    params?: P,
    options?: RequestOptions,
  ): Promise<R> {
    const id = Date.now()
    const request: JSONRPCRequest<any> = {
      jsonrpc: '2.0',
      method,
      params: params || {},
      id,
    }

    return this.rawRequest(request, true, options)
  }

  public retry<R, P = {}>(
    request: JSONRPCRequest<P>,
    options?: RequestOptions,
  ): Promise<R> {
    return this.rawRequest(request, undefined, options)
  }

  private rawRequest<R, P = {}>(
    request: JSONRPCRequest<P>,
    shouldExtraResult: boolean = false,
    options: RequestOptions = defaultOptions,
  ): Promise<R> {
    // 拦截检查是否网路错误
    if (supportCheckOnline && !navigator.onLine) {
      return Promise.reject(
        createError(this.networkErrorMessage, ErrNetwork, request),
      )
    }

    const { timeout } = options

    const req = new XMLHttpRequest()
    let url = this.root

    // 可以在控制台直接显示请求的方法
    const query = `_m=${request.method}`

    if (url.indexOf('?') === -1) {
      url += '?' + query
    } else {
      url += '&' + query
    }

    if (timeout != null) {
      req.timeout = timeout
    }

    req.open('POST', url)

    const interceptors = shouldExtraResult
      ? [...this.preInterceptor, ...this.interceptor]
      : this.interceptor
    const fn = compose(interceptors)

    return fn(request, req, (finalRequest, xhr, next) => {
      return new Promise((resolve, reject) => {
        let timeouted = false
        // 请求
        req.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')

        req.ontimeout = () => {
          timeouted = true
          reject(createError(this.timeoutErrorMessage, ErrTimeout, request))
        }

        req.onreadystatechange = async () => {
          if (timeouted) {
            return
          }

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
              } else if (
                !this.option.ignoreProtocolError &&
                resp.id !== request.id
              ) {
                reject(
                  createError(
                    '[jsonrpc] id not match',
                    ErrIDNotMatching,
                    request,
                    resp,
                  ),
                )
              } else {
                resolve(resp)
              }
            } catch (error) {
              reject(createError(error.message, ErrJsonParse, request))
            }
          } else if (req.readyState === XMLHttpRequest.DONE) {
            // 网络异常
            const error = createError(
              // 网络异常时， req.status 为 0
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
