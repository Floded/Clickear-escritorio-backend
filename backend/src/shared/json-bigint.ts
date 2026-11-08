// Serializa BigInt como string para que JSON.stringify no lance TypeError
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
