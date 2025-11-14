// Primitive Definition DataUrl comes from
// https://github.com/stellar/js-stellar-sdk/blob/master/src/contract/spec.ts#L159-L164
export const getDataUrlError = (value: string, isRequired?: boolean) => {
  if (!value) {
    if (isRequired) {
      return "This field is required.";
    } else {
      return false;
    }
  }
  // Check if value is a string
  if (typeof value !== "string") {
    return "Value must be a string";
  }

  const trimmedValue = value.trim();

  // Allow 32-byte (64 hex chars) hashes such as proof_id (= keccak256(proof_blob))
  const hexPattern = /^0[xX]?[0-9a-fA-F]{64}$/;
  if (hexPattern.test(trimmedValue)) {
    return false;
  }

  // Otherwise validate base64 payload (existing DataUrl behavior)
  const dataUrlPattern =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!dataUrlPattern.test(trimmedValue)) {
    return "Value must be a valid base64 encoded string or 32-byte hex string";
  }

  return false;
};
