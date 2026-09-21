"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseA1111Parameters = parseA1111Parameters;
const a1111_js_1 = require("./parsers/a1111.js");
/**
 * Parses Automatic1111 / WebUI parameter string.
 * Maintained for backwards-compatibility.
 */
function parseA1111Parameters(raw, _imageUrl) {
    return (0, a1111_js_1.parseA1111)(raw);
}
