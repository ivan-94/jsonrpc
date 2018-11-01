/**
 * 从JSONrpc结果中抽取出result
 */
import { RPCInterceptor } from '../type'

const extraResult: RPCInterceptor = async (request, xhr, next) => {
  const res = await next()
  if ('result' in res) {
    return res.result
  }
  return res
}

export default extraResult
