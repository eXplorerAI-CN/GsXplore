/**
 * PLY file parser utility
 * Simplified from PLY reading mechanism in PlayCanvas engine
 */

// PLY file magic bytes and end markers
const magicBytes = new Uint8Array([112, 108, 121, 10]); // ply\n
const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]); // \nend_header\n

// Data type mappings
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
 * Find the first occurrence of a sequence in a buffer
 * @param {Uint8Array} buf - Buffer to search in
 * @param {Uint8Array} search - Sequence to find
 * @returns {number} Index of first occurrence, or -1 if not found
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
 * Check if array a starts with all elements of array b
 * @param {Uint8Array} a - Array to check
 * @param {Uint8Array} b - Array to find at the start of a
 * @returns {boolean} True if a starts with b
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
 * Parse PLY file header text
 * @param {string[]} lines - Array of header text lines
 * @returns {object} Object containing elements, format, and comments
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
                    throw new Error(`Unrecognized attribute data type '${words[1]}' in PLY header`);
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
                throw new Error(`Unrecognized header value '${words[0]}' in PLY header`);
        }
    }

    return { elements, format, comments };
};

/**
 * Check if PLY file is compressed
 * @param {Array} elements - Array of elements
 * @returns {boolean} True if PLY file is compressed
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
 * Check if PLY file is float
 * @param {Array} elements - Array of elements
 * @returns {boolean} True if PLY file is float
 */
const isFloatPly = (elements) => {
    return elements.length === 1 &&
           elements[0].name === 'vertex' &&
           elements[0].properties.every(p => p.type === 'float');
};

/**
 * Parse binary PLY data
 * @param {Uint8Array} data - Binary data of PLY file
 * @param {Array} elements - Element information parsed from header
 * @param {number} dataOffset - Start offset of data section
 * @returns {Array} Parsed element data
 */
const parseBinaryData = (data, elements, dataOffset) => {
    const dataView = new DataView(data.buffer);
    let offset = dataOffset;

    // Allocate storage space for each element
    elements.forEach((element) => {
        element.properties.forEach((property) => {
            const storageType = dataTypeMap.get(property.type);
            if (storageType) {
                property.storage = new storageType(element.count);
            }
        });
    });

    // Parse element data
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
                            throw new Error(`Unsupported attribute data type '${property.type}'`);
                    }
                }
                offset += property.byteSize;
            });
        }
    });

    return elements;
};

/**
 * PLY file parser main function
 * @param {ArrayBuffer} arrayBuffer - ArrayBuffer data of PLY file
 * @param {object} options - Parser options
 * @param {Function} options.propertyFilter - Attribute filter function
 * @param {Function} options.progressCallback - Progress callback function
 * @returns {Promise<object>} Parsing result, containing data and comments
 */
async function plyParser(arrayBuffer, options = {}) {
    try {
        const { propertyFilter = null, progressCallback = null } = options;
        
        const data = new Uint8Array(arrayBuffer);
        
        // Check magic bytes
        if (!startsWith(data, magicBytes)) {
            throw new Error('Invalid PLY file header');
        }

        // Find header end marker
        const headerLength = find(data, endHeaderBytes);
        if (headerLength === -1) {
            throw new Error('Header end marker not found');
        }

        // Decode header text
        const headerText = new TextDecoder('ascii').decode(data.subarray(0, headerLength));
        const lines = headerText.split('\n');

        // Parse header
        const { elements, format, comments } = parseHeader(lines);

        // Check format support
        if (format !== 'binary_little_endian') {
            throw new Error(`Unsupported PLY format: ${format}`);
        }

        // Calculate data start offset
        const dataOffset = headerLength + endHeaderBytes.length;

        // Report progress
        if (progressCallback) {
            progressCallback(0.1, 'Parsing header completed');
        }

        // Parse binary data
        const parsedElements = parseBinaryData(data, elements, dataOffset);

        // Report progress
        if (progressCallback) {
            progressCallback(1.0, 'Parsing completed');
        }

        // Return result
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
        console.error("PLY file parsing error:", error);
        throw error;
    }
}

export { plyParser }; 