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

// PLY文件流式解析函数 - 优化版本
const fetchPlyWithStreamParsing = function (path, onProgress, onVertexData, options = {}) {
    const {
        batchSize = 3000, // 批量处理的顶点数量，默认1000个顶点一批
        enableBatching = true, // 是否启用批量处理
        progressUpdateInterval = 10000 // 进度更新间隔（顶点数量）
    } = options;

    const abortController = new AbortController()
    const signal = abortController.signal
    let aborted = false
    const abortHandler = (reason) => {
        abortController.abort(new AbortedPromiseError(reason))
        aborted = true
    }

    return new AbortablePromise((resolve, reject) => {
        // PLY解析状态
        let parseState = 'header' // 'header' | 'data'
        let headerBuffer = new Uint8Array(0)
        let dataBuffer = new Uint8Array(0)
        let headerParsed = false
        let elements = null
        let dataOffset = 0
        let recordSize = 0
        let vertexCount = 0
        let parsedVertexCount = 0
        let storageArrays = {} // 存储各个属性的TypedArray
        let lastProgressUpdate = 0 // 上次进度更新时的顶点数
        
        // 批量处理相关
        let vertexBatch = [] // 当前批次的顶点数据
        let batchStartIndex = 0 // 当前批次的起始索引
        
        // PLY常量
        const magicBytes = new Uint8Array([112, 108, 121, 10]) // ply\n
        const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]) // \nend_header\n
        
        // 数据类型映射 - 优化版本，包含读取函数
        const dataTypeMap = new Map([
            ['char', { TypedArray: Int8Array, bytes: 1, reader: (dv, offset) => dv.getInt8(offset) }],
            ['uchar', { TypedArray: Uint8Array, bytes: 1, reader: (dv, offset) => dv.getUint8(offset) }],
            ['short', { TypedArray: Int16Array, bytes: 2, reader: (dv, offset) => dv.getInt16(offset, true) }],
            ['ushort', { TypedArray: Uint16Array, bytes: 2, reader: (dv, offset) => dv.getUint16(offset, true) }],
            ['int', { TypedArray: Int32Array, bytes: 4, reader: (dv, offset) => dv.getInt32(offset, true) }],
            ['uint', { TypedArray: Uint32Array, bytes: 4, reader: (dv, offset) => dv.getUint32(offset, true) }],
            ['float', { TypedArray: Float32Array, bytes: 4, reader: (dv, offset) => dv.getFloat32(offset, true) }],
            ['double', { TypedArray: Float64Array, bytes: 8, reader: (dv, offset) => dv.getFloat64(offset, true) }]
        ])

        // 查找字节序列
        const findBytes = (buf, search) => {
            const endIndex = buf.length - search.length
            for (let i = 0; i <= endIndex; ++i) {
                let found = true
                for (let j = 0; j < search.length; ++j) {
                    if (buf[i + j] !== search[j]) {
                        found = false
                        break
                    }
                }
                if (found) return i
            }
            return -1
        }

        // 解析PLY头部
        const parseHeader = (headerText) => {
            const lines = headerText.split('\n')
            const elements = []
            let format = null

            for (let i = 1; i < lines.length; ++i) {
                const words = lines[i].trim().split(' ')
                if (words.length === 0) continue

                switch (words[0]) {
                    case 'format':
                        format = words[1]
                        break
                    case 'element':
                        elements.push({
                            name: words[1],
                            count: parseInt(words[2], 10),
                            properties: []
                        })
                        break
                    case 'property':
                        if (elements.length > 0) {
                            const element = elements[elements.length - 1]
                            const type = words[1]
                            const name = words[2]
                            if (dataTypeMap.has(type)) {
                                const typeInfo = dataTypeMap.get(type)
                                element.properties.push({
                                    type: type,
                                    name: name,
                                    byteSize: typeInfo.bytes,
                                    reader: typeInfo.reader // 添加读取函数引用
                                })
                            }
                        }
                        break
                }
            }

            return { elements, format }
        }

        // 批量处理顶点数据的回调
        const flushVertexBatch = () => {
            if (vertexBatch.length > 0 && onVertexData) {
                if (enableBatching) {
                    // 批量回调
                    onVertexData(vertexBatch, batchStartIndex)
                } else {
                    // 逐个回调（兼容模式）
                    vertexBatch.forEach((vertex, index) => {
                        onVertexData(vertex, batchStartIndex + index)
                    })
                }
                vertexBatch = []
                batchStartIndex = parsedVertexCount
            }
        }

        // 处理接收到的数据块
        const processChunk = (chunk) => {
            if (parseState === 'header') {
                // 合并头部数据 - 优化：避免频繁的数组拷贝
                const newHeaderBuffer = new Uint8Array(headerBuffer.length + chunk.length)
                newHeaderBuffer.set(headerBuffer)
                newHeaderBuffer.set(chunk, headerBuffer.length)
                headerBuffer = newHeaderBuffer

                // 检查是否找到头部结束标记
                const headerEndIndex = findBytes(headerBuffer, endHeaderBytes)
                if (headerEndIndex !== -1) {
                    // 解析头部
                    const headerText = new TextDecoder('ascii').decode(headerBuffer.subarray(0, headerEndIndex))
                    const parsed = parseHeader(headerText)
                    elements = parsed.elements
                    
                    if (parsed.format !== 'binary_little_endian') {
                        throw new Error(`不支持的PLY格式: ${parsed.format}`)
                    }

                    // 计算每个顶点记录的字节大小
                    if (elements.length > 0) {
                        const vertexElement = elements.find(e => e.name === 'vertex')
                        if (vertexElement) {
                            recordSize = vertexElement.properties.reduce((sum, p) => sum + p.byteSize, 0)
                            vertexCount = vertexElement.count
                            
                            // 为每个属性预分配TypedArray存储空间
                            vertexElement.properties.forEach(property => {
                                const TypedArrayClass = dataTypeMap.get(property.type).TypedArray
                                storageArrays[property.name] = new TypedArrayClass(vertexCount)
                                property.storage = storageArrays[property.name]
                            })
                        }
                    }

                    headerParsed = true
                    parseState = 'data'
                    
                    // 处理头部后剩余的数据
                    const remainingDataStart = headerEndIndex + endHeaderBytes.length
                    if (remainingDataStart < headerBuffer.length) {
                        dataBuffer = headerBuffer.subarray(remainingDataStart)
                        processVertexData()
                    }
                    
                    if (onProgress) {
                        onProgress(5, '头部解析完成', null, null, { 
                            headerParsed: true, 
                            vertexCount: vertexCount,
                            recordSize: recordSize,
                            batchSize: batchSize
                        })
                    }
                }
            } else if (parseState === 'data') {
                // 合并数据 - 优化：减少内存拷贝
                if (dataBuffer.length === 0) {
                    dataBuffer = chunk
                } else {
                    const newDataBuffer = new Uint8Array(dataBuffer.length + chunk.length)
                    newDataBuffer.set(dataBuffer)
                    newDataBuffer.set(chunk, dataBuffer.length)
                    dataBuffer = newDataBuffer
                }
                
                processVertexData()
            }
        }

        // 处理顶点数据 - 优化版本
        const processVertexData = () => {
            if (!headerParsed || recordSize === 0) return

            // 计算可以解析的完整顶点数量
            const availableVertices = Math.floor(dataBuffer.length / recordSize)
            
            if (availableVertices > 0) {
                const dataView = new DataView(dataBuffer.buffer, dataBuffer.byteOffset)
                const vertexElement = elements.find(e => e.name === 'vertex')
                
                if (vertexElement) {
                    // 批量解析顶点数据
                    for (let i = 0; i < availableVertices && parsedVertexCount < vertexCount; i++) {
                        const vertexData = {}
                        let offset = i * recordSize
                        
                        // 使用优化的读取函数解析当前顶点的所有属性
                        for (const property of vertexElement.properties) {
                            const value = property.reader(dataView, offset)
                            
                            // 存储到对应的TypedArray中
                            if (storageArrays[property.name]) {
                                storageArrays[property.name][parsedVertexCount] = value
                            }
                            
                            vertexData[property.name] = value
                            offset += property.byteSize
                        }
                        
                        // 添加到批次中
                        vertexBatch.push(vertexData)
                        parsedVertexCount++
                        
                        // 检查是否需要处理批次
                        if (vertexBatch.length >= batchSize) {
                            flushVertexBatch()
                        }
                    }
                }
                
                // 移除已处理的数据 - 优化：只在必要时进行拷贝
                const processedBytes = availableVertices * recordSize
                if (processedBytes === dataBuffer.length) {
                    dataBuffer = new Uint8Array(0) // 完全处理完毕
                } else {
                    dataBuffer = dataBuffer.subarray(processedBytes)
                }
                
                // 更新进度 - 优化：减少进度更新频率
                if (onProgress && vertexCount > 0) {
                    const verticesSinceLastUpdate = parsedVertexCount - lastProgressUpdate
                    if (verticesSinceLastUpdate >= progressUpdateInterval || parsedVertexCount === vertexCount) {
                        const progress = Math.min(100, (parsedVertexCount / vertexCount) * 95 + 5) // 5-100%
                        onProgress(progress, `解析顶点: ${parsedVertexCount}/${vertexCount}`, null, null, {
                            parsedVertices: parsedVertexCount,
                            totalVertices: vertexCount,
                            batchSize: batchSize,
                            batchesProcessed: Math.floor(parsedVertexCount / batchSize)
                        })
                        lastProgressUpdate = parsedVertexCount
                    }
                }
            }
        }

        fetch(path, { signal })
            .then(async (response) => {
                if (!response.ok) {
                    const errorText = await response.text()
                    reject(new Error(`获取失败: ${response.status} ${response.statusText} ${errorText}`))
                    return
                }

                const reader = response.body.getReader()
                let bytesDownloaded = 0
                const _fileSize = response.headers.get('Content-Length')
                const fileSize = _fileSize ? parseInt(_fileSize) : undefined

                while (!aborted) {
                    try {
                        const { value: chunk, done } = await reader.read()
                        if (done) {
                            // 处理剩余数据
                            if (dataBuffer.length > 0) {
                                processVertexData()
                            }
                            
                            // 处理剩余的批次数据
                            flushVertexBatch()
                            
                            if (onProgress) {
                                onProgress(100, '解析完成', null, fileSize, {
                                    completed: true,
                                    totalVertices: vertexCount,
                                    parsedVertices: parsedVertexCount,
                                    batchSize: batchSize,
                                    totalBatches: Math.ceil(parsedVertexCount / batchSize)
                                })
                            }
                            
                            resolve({
                                vertexCount: parsedVertexCount,
                                totalVertices: vertexCount,
                                elements: elements,
                                storageArrays: storageArrays, // 返回完整的存储数组
                                data: {
                                    elements: elements,
                                    isCompressed: false,
                                    isFloat: true,
                                    numVertices: parsedVertexCount
                                }
                            })
                            break
                        }

                        bytesDownloaded += chunk.length
                        processChunk(chunk)

                        // 下载进度回调
                        if (onProgress && !headerParsed) {
                            let percent = 0
                            let percentLabel = '下载中...'
                            if (fileSize !== undefined) {
                                percent = Math.min(5, (bytesDownloaded / fileSize) * 5) // 0-5%用于下载进度
                                percentLabel = `下载: ${percent.toFixed(1)}%`
                            }
                            onProgress(percent, percentLabel, chunk, fileSize)
                        }
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

export {fetchWithProgress, fetchPlyWithStreamParsing}
