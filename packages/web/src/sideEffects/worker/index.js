const WebWorkify = require('webworkify')

const callBackToStream = require('../../most-utils/callbackToObservable')

/**
 * Browserify wraps webworkify with module cache in arguments[3..5].
 * Vite/Rollup does not — WebWorkify throws on Object.keys(undefined).
 * Fall back to a same-protocol main-thread shim so rebuild still works (no background thread).
 */
const createMainThreadGeometryWorker = (workerFn) => {
  const api = {
    onmessage: null,
    onerror: null,
    objectURL: null,
    postMessage: null,
    terminate: null
  }

  let innerHandler = null
  const fakeSelf = {}
  Object.defineProperty(fakeSelf, 'onmessage', {
    configurable: true,
    enumerable: true,
    get() {
      return innerHandler
    },
    set(fn) {
      innerHandler = fn
    }
  })
  fakeSelf.postMessage = (data) => {
    if (api.onmessage) api.onmessage({ data })
  }

  workerFn(fakeSelf)

  api.postMessage = (task) => {
    try {
      if (innerHandler) innerHandler({ data: task })
    } catch (err) {
      if (api.onerror) api.onerror(err)
      else console.error(err)
    }
  }
  api.terminate = () => {
    innerHandler = null
  }
  return api
}

const createGeometryWorker = (workerFn) => {
  try {
    return WebWorkify(workerFn, {})
  } catch (e) {
    return createMainThreadGeometryWorker(workerFn)
  }
}

const makeWorkerEffect = (workerPath) => {
  const workerEventsCb = callBackToStream()

  let _worker = createGeometryWorker(workerPath)
  _worker.onerror = (error) => workerEventsCb.callback({ error })
  _worker.onmessage = (message) => workerEventsCb.callback(message)

  const workerSink = (outToWorker$) => {
    // cancel whatever is going on in the worker by terminating it
    outToWorker$.filter(({ cmd }) => cmd === 'cancel')
      .forEach((task) => {
        _worker.terminate()
        _worker = createGeometryWorker(workerPath)
        _worker.onerror = (error) => workerEventsCb.callback({ error })
        _worker.onmessage = (message) => workerEventsCb.callback(message)
      })

    // send other messages to the worker
    outToWorker$
      .filter(({ cmd }) => cmd !== 'cancel')
      .forEach((task) => {
        _worker.postMessage(task)
      })
  }

  const workerSource = function () {
    return workerEventsCb.stream.multicast()
  }
  return {
    sink: workerSink,
    source: workerSource
  }
}

module.exports = makeWorkerEffect
