// Add these definitions at the top of the file
class AbortedPromiseError extends Error {
    constructor(reason) {
        super(reason ? `Promise aborted: ${reason}` : 'Promise aborted');
        this.name = 'AbortedPromiseError';
    }
}

class AbortablePromise extends Promise {
    constructor(executor, onAbort) {
        let _reject;
        super((resolve, reject) => {
            _reject = reject;
            return executor(resolve, reject);
        });
        this._onAbort = onAbort;
        this._reject = _reject;
    }

    abort(reason) {
        if (this._onAbort) {
            this._onAbort(reason);
        }
        this._reject(new AbortedPromiseError(reason));
    }
}

// Use chunked loading instead of direct fetch
const fetchWithProgress = function (path, onProgress, saveChunks = true) {
    const abortController = new AbortController()
    const signal = abortController.signal
    let aborted = false
    const abortHandler = (reason) => {
        abortController.abort(new AbortedPromiseError(reason))
        aborted = true
    }

    return new AbortablePromise((resolve, reject) => {
        fetch(path, { signal })
            .then(async (data) => {
                if (!data.ok) {
                    const errorText = await data.text()
                    reject(new Error(`Fetch failed: ${data.status} ${data.statusText} ${errorText}`))
                    return
                }

                const reader = data.body.getReader()
                let bytesDownloaded = 0
                const _fileSize = data.headers.get('Content-Length')
                const fileSize = _fileSize ? parseInt(_fileSize) : undefined
                const chunks = []

                while (!aborted) {
                    try {
                        const { value: chunk, done } = await reader.read()
                        if (done) {
                            if (onProgress)
                                onProgress(100, '100%', chunk, fileSize)

                            if (saveChunks) {
                                const buffer = new Blob(chunks).arrayBuffer()
                                resolve(buffer)
                            }
                            else {
                                resolve()
                            }
                            break
                        }
                        bytesDownloaded += chunk.length
                        let percent
                        let percentLabel
                        if (fileSize !== undefined) {
                            percent = bytesDownloaded / fileSize * 100
                            percentLabel = `${percent.toFixed(2)}%`
                        }
                        if (saveChunks)
                            chunks.push(chunk)

                        if (onProgress)
                            onProgress(percent, percentLabel, chunk, fileSize)
                    }
                    catch (error) {
                        reject(error)
                        return
                    }
                }
            })
            .catch((error) => {
                reject(error)
            })
    }, abortHandler)
}

export {fetchWithProgress}