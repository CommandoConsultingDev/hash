import "../../../shared/testing-utilities/mock-get-flow-context";

import { expect, test } from "vitest";

import { getEntitySummariesFromText } from "./get-entity-summaries-from-text";

test(
  "Test getEntitySummariesFromText with a simple text",
  async () => {
    const { entitySummaries } = await getEntitySummariesFromText({
      text: "Bob worked at Apple, Microsoft and Google.",
    });

    expect(entitySummaries.length).toBe(4);
  },
  {
    timeout: 30_000,
  },
);
