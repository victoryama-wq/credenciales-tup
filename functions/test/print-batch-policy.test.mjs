import assert from "node:assert/strict";
import {describe, it} from "node:test";

import printBatchPolicy from "../lib/print-batch-policy.js";

const {
  isPrintBatchRequestStatusClosable,
  isPrintBatchRequestStatusReadyForPickupCompatible,
  shouldAdvancePrintBatchRequest,
  shouldAdvancePrintBatchRequestToReadyForPickup,
  shouldBlockIndividualPrintTransition,
} = printBatchPolicy;

describe("print batch reconciliation policy", () => {
  it("accepts pending and downstream delivery statuses", () => {
    for (const status of [
      "APPROVED_FOR_PRINT",
      "PRINTED",
      "READY_FOR_PICKUP",
      "DELIVERED",
    ]) {
      assert.equal(isPrintBatchRequestStatusClosable(status), true);
    }
  });

  it("rejects statuses that have not reached print approval", () => {
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "REJECTED"]) {
      assert.equal(isPrintBatchRequestStatusClosable(status), false);
    }
  });

  it("advances only requests that are still pending print", () => {
    assert.equal(shouldAdvancePrintBatchRequest("APPROVED_FOR_PRINT"), true);
    assert.equal(shouldAdvancePrintBatchRequest("PRINTED"), false);
    assert.equal(shouldAdvancePrintBatchRequest("READY_FOR_PICKUP"), false);
    assert.equal(shouldAdvancePrintBatchRequest("DELIVERED"), false);
  });

  it("blocks individual printing only while the linked batch is active", () => {
    assert.equal(
      shouldBlockIndividualPrintTransition(
        "APPROVED_FOR_PRINT",
        "PRINTED",
        "CREATED"
      ),
      true
    );
    assert.equal(
      shouldBlockIndividualPrintTransition(
        "APPROVED_FOR_PRINT",
        "PRINTED",
        "PRINTED"
      ),
      false
    );
    assert.equal(
      shouldBlockIndividualPrintTransition(
        "PRINTED",
        "READY_FOR_PICKUP",
        "CREATED"
      ),
      false
    );
  });

  it("accepts only printed and downstream statuses for batch pickup readiness", () => {
    for (const status of ["PRINTED", "READY_FOR_PICKUP", "DELIVERED"]) {
      assert.equal(isPrintBatchRequestStatusReadyForPickupCompatible(status), true);
    }

    for (const status of ["SUBMITTED", "UNDER_REVIEW", "REJECTED", "APPROVED_FOR_PRINT"]) {
      assert.equal(isPrintBatchRequestStatusReadyForPickupCompatible(status), false);
    }
  });

  it("advances only printed requests when a batch becomes ready for pickup", () => {
    assert.equal(shouldAdvancePrintBatchRequestToReadyForPickup("PRINTED"), true);
    assert.equal(shouldAdvancePrintBatchRequestToReadyForPickup("READY_FOR_PICKUP"), false);
    assert.equal(shouldAdvancePrintBatchRequestToReadyForPickup("DELIVERED"), false);
  });
});
