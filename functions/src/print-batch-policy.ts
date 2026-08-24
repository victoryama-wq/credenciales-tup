export const closablePrintBatchRequestStatuses = [
  "APPROVED_FOR_PRINT",
  "PRINTED",
  "READY_FOR_PICKUP",
  "DELIVERED",
] as const;

const closableStatuses = new Set<string>(closablePrintBatchRequestStatuses);

export function isPrintBatchRequestStatusClosable(status: string): boolean {
  return closableStatuses.has(status);
}

export function shouldAdvancePrintBatchRequest(status: string): boolean {
  return status === "APPROVED_FOR_PRINT";
}

export const readyForPickupBatchRequestStatuses = [
  "PRINTED",
  "READY_FOR_PICKUP",
  "DELIVERED",
] as const;

const readyForPickupStatuses = new Set<string>(readyForPickupBatchRequestStatuses);

export function isPrintBatchRequestStatusReadyForPickupCompatible(
  status: string
): boolean {
  return readyForPickupStatuses.has(status);
}

export function shouldAdvancePrintBatchRequestToReadyForPickup(
  status: string
): boolean {
  return status === "PRINTED";
}

export function shouldBlockIndividualPrintTransition(
  currentStatus: string,
  nextStatus: string,
  batchStatus: string | undefined
): boolean {
  return currentStatus === "APPROVED_FOR_PRINT" &&
    nextStatus === "PRINTED" &&
    batchStatus === "CREATED";
}
