"use strict";
/**
 * PromptHound Normalized Extraction Contracts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExtractionError = isExtractionError;
function isExtractionError(result) {
    return typeof result === 'object' && result !== null && 'code' in result;
}
