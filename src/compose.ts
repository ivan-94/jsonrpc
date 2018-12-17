/**
 * 组合拦截器
 */
/* tslint:disable:no-any */
import { RPCInterceptor, JSONRPCRequest } from './type'

export default function compose(middleware: RPCInterceptor[]) {
  if (!Array.isArray(middleware)) {
    throw new TypeError('Middleware stack must be an array!')
  }
  for (let i = 0, l = middleware.length; i < l; i++) {
    if (typeof middleware[i] !== 'function') {
      throw new TypeError('Middleware must be composed of functions!')
    }
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */

  return (
    request: JSONRPCRequest<any>,
    xhr: XMLHttpRequest,
    next: RPCInterceptor,
  ) => {
    // last called middleware #
    let index = -1
    return dispatch(0)
    function dispatch(i: number): Promise<any> {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'))
      }
      index = i
      let fn = middleware[i]
      if (i === middleware.length) {
        fn = next
      }

      if (!fn) {
        return Promise.resolve()
      }

      try {
        return fn(request, xhr, () => {
          return dispatch(i + 1)
        })
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}
