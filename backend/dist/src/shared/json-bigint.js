// Serializa BigInt como string para que JSON.stringify no lance TypeError
BigInt.prototype.toJSON = function () {
    return this.toString();
};
export {};
//# sourceMappingURL=json-bigint.js.map