/**
 * PLY 文件解析器工具
 * 基于 PlayCanvas 引擎中的 PLY 读取机制简化而来
 */

// PLY 文件魔术字节和结束标记
const magicBytes = new Uint8Array([112, 108, 121, 10]); // ply\n
const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]); // \nend_header\n

// 数据类型映射
const dataTypeMap = new Map([
    ['char', Int8Array],
    ['uchar', Uint8Array],
    ['short', Int16Array],
    ['ushort', Uint16Array],
    ['int', Int32Array],
    ['uint', Uint32Array],
    ['float', Float32Array],
    ['double', Float64Array]
]);

/**
 * 在缓冲区中查找指定序列的首次出现位置
 * @param {Uint8Array} buf - 要搜索的缓冲区
 * @param {Uint8Array} search - 要查找的序列
 * @returns {number} 首次出现的索引，如果未找到则返回 -1
 */
const find = (buf, search) => {
    const endIndex = buf.length - search.length;
    let i, j;
    for (i = 0; i <= endIndex; ++i) {
        for (j = 0; j < search.length; ++j) {
            if (buf[i + j] !== search[j]) {
                break;
            }
        }
        if (j === search.length) {
            return i;
        }
    }
    return -1;
};

/**
 * 检查数组 a 是否以数组 b 的所有元素开头
 * @param {Uint8Array} a - 要检查的数组
 * @param {Uint8Array} b - 要查找的开头元素数组
 * @returns {boolean} 如果 a 以 b 的所有元素开头则返回 true
 */
const startsWith = (a, b) => {
    if (a.length < b.length) {
        return false;
    }

    for (let i = 0; i < b.length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
};

/**
 * 解析 PLY 文件头部文本
 * @param {string[]} lines - 头部文本行数组
 * @returns {object} 包含元素、格式和注释的对象
 */
const parseHeader = (lines) => {
    const elements = [];
    const comments = [];
    let format;

    for (let i = 1; i < lines.length; ++i) {
        const words = lines[i].split(' ');

        switch (words[0]) {
            case 'comment':
                comments.push(words.slice(1).join(' '));
                break;
            case 'format':
                format = words[1];
                break;
            case 'element':
                elements.push({
                    name: words[1],
                    count: parseInt(words[2], 10),
                    properties: []
                });
                break;
            case 'property': {
                if (!dataTypeMap.has(words[1])) {
                    throw new Error(`不识别的属性数据类型 '${words[1]}' 在 PLY 头部中`);
                }
                const element = elements[elements.length - 1];
                element.properties.push({
                    type: words[1],
                    name: words[2],
                    storage: null,
                    byteSize: dataTypeMap.get(words[1]).BYTES_PER_ELEMENT
                });
                break;
            }
            default:
                throw new Error(`不识别的头部值 '${words[0]}' 在 PLY 头部中`);
        }
    }

    return { elements, format, comments };
};

/**
 * 检查是否为压缩的 PLY 文件
 * @param {Array} elements - 元素数组
 * @returns {boolean} 如果是压缩 PLY 文件则返回 true
 */
const isCompressedPly = (elements) => {
    const chunkProperties = [
        'min_x', 'min_y', 'min_z',
        'max_x', 'max_y', 'max_z',
        'min_scale_x', 'min_scale_y', 'min_scale_z',
        'max_scale_x', 'max_scale_y', 'max_scale_z',
        'min_r', 'min_g', 'min_b',
        'max_r', 'max_g', 'max_b'
    ];

    const vertexProperties = [
        'packed_position', 'packed_rotation', 'packed_scale', 'packed_color'
    ];

    const shProperties = new Array(45).fill('').map((_, i) => `f_rest_${i}`);

    const hasBaseElements = () => {
        return elements[0].name === 'chunk' &&
               elements[0].properties.every((p, i) => p.name === chunkProperties[i] && p.type === 'float') &&
               elements[1].name === 'vertex' &&
               elements[1].properties.every((p, i) => p.name === vertexProperties[i] && p.type === 'uint');
    };

    const hasSHElements = () => {
        return elements[2].name === 'sh' &&
               [9, 24, 45].indexOf(elements[2].properties.length) !== -1 &&
               elements[2].properties.every((p, i) => p.name === shProperties[i] && p.type === 'uchar');
    };

    return (elements.length === 2 && hasBaseElements()) || (elements.length === 3 && hasBaseElements() && hasSHElements());
};

/**
 * 检查是否为浮点数 PLY 文件
 * @param {Array} elements - 元素数组
 * @returns {boolean} 如果是浮点数 PLY 文件则返回 true
 */
const isFloatPly = (elements) => {
    return elements.length === 1 &&
           elements[0].name === 'vertex' &&
           elements[0].properties.every(p => p.type === 'float');
};

/**
 * 解析二进制 PLY 数据
 * @param {Uint8Array} data - PLY 文件的二进制数据
 * @param {Array} elements - 从头部解析出的元素信息
 * @param {number} dataOffset - 数据部分的起始偏移量
 * @returns {Array} 解析后的元素数据
 */
const parseBinaryData = (data, elements, dataOffset) => {
    const dataView = new DataView(data.buffer);
    let offset = dataOffset;

    // 为每个元素分配存储空间
    elements.forEach((element) => {
        element.properties.forEach((property) => {
            const storageType = dataTypeMap.get(property.type);
            if (storageType) {
                property.storage = new storageType(element.count);
            }
        });
    });

    // 解析每个元素的数据
    elements.forEach((element) => {
        const properties = element.properties;
        const recordSize = properties.reduce((sum, p) => sum + p.byteSize, 0);

        for (let i = 0; i < element.count; i++) {
            properties.forEach((property) => {
                if (property.storage) {
                    switch (property.type) {
                        case 'char':
                            property.storage[i] = dataView.getInt8(offset);
                            break;
                        case 'uchar':
                            property.storage[i] = dataView.getUint8(offset);
                            break;
                        case 'short':
                            property.storage[i] = dataView.getInt16(offset, true);
                            break;
                        case 'ushort':
                            property.storage[i] = dataView.getUint16(offset, true);
                            break;
                        case 'int':
                            property.storage[i] = dataView.getInt32(offset, true);
                            break;
                        case 'uint':
                            property.storage[i] = dataView.getUint32(offset, true);
                            break;
                        case 'float':
                            property.storage[i] = dataView.getFloat32(offset, true);
                            break;
                        case 'double':
                            property.storage[i] = dataView.getFloat64(offset, true);
                            break;
                        default:
                            throw new Error(`不支持的属性数据类型 '${property.type}'`);
                    }
                }
                offset += property.byteSize;
            });
        }
    });

    return elements;
};

/**
 * PLY 文件解析器主函数
 * @param {ArrayBuffer} arrayBuffer - PLY 文件的 ArrayBuffer 数据
 * @param {object} options - 解析选项
 * @param {Function} options.propertyFilter - 属性过滤函数
 * @param {Function} options.progressCallback - 进度回调函数
 * @returns {Promise<object>} 解析结果，包含数据和注释
 */
async function plyParser(arrayBuffer, options = {}) {
    try {
        const { propertyFilter = null, progressCallback = null } = options;
        
        const data = new Uint8Array(arrayBuffer);
        
        // 检查魔术字节
        if (!startsWith(data, magicBytes)) {
            throw new Error('无效的 PLY 文件头');
        }

        // 查找头部结束标记
        const headerLength = find(data, endHeaderBytes);
        if (headerLength === -1) {
            throw new Error('未找到 PLY 头部结束标记');
        }

        // 解码头部文本
        const headerText = new TextDecoder('ascii').decode(data.subarray(0, headerLength));
        const lines = headerText.split('\n');

        // 解析头部
        const { elements, format, comments } = parseHeader(lines);

        // 检查格式支持
        if (format !== 'binary_little_endian') {
            throw new Error(`不支持的 PLY 格式: ${format}`);
        }

        // 计算数据起始偏移量
        const dataOffset = headerLength + endHeaderBytes.length;

        // 报告进度
        if (progressCallback) {
            progressCallback(0.1, '解析头部完成');
        }

        // 解析二进制数据
        const parsedElements = parseBinaryData(data, elements, dataOffset);

        // 报告进度
        if (progressCallback) {
            progressCallback(1.0, '解析完成');
        }

        // 返回结果
        return {
            data: {
                elements: parsedElements,
                isCompressed: isCompressedPly(parsedElements),
                isFloat: isFloatPly(parsedElements),
                numVertices: parsedElements.length > 0 ? parsedElements[0].count : 0
            },
            comments,
            format
        };

    } catch (error) {
        console.error("PLY 文件解析错误:", error);
        throw error;
    }
}

export { plyParser }; 