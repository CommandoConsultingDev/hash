import dedent from "dedent";

import { logger } from "./activity-logger";
import { getFlowContext } from "./get-flow-context";
import { getLlmResponse } from "./get-llm-response";
import { getToolCallsFromLlmAssistantMessage } from "./get-llm-response/llm-message";
import type { LlmToolDefinition } from "./get-llm-response/types";
import { graphApiClient } from "./graph-api-client";
import type { EntitySummary } from "./infer-facts-from-text/get-entity-summaries-from-text";
import { getEntitySummariesFromText } from "./infer-facts-from-text/get-entity-summaries-from-text";
import { stringify } from "./stringify";

type Fact = {
  subjectEntityLocalId: string;
  objectEntityLocalId?: string;
  text: string;
};

const toolNames = ["submitFacts"] as const;

type ToolName = (typeof toolNames)[number];

const toolDefinitions: Record<ToolName, LlmToolDefinition<ToolName>> = {
  submitFacts: {
    name: "submitFacts",
    description: "Submit facts based on the information provided in the text.",
    inputSchema: {
      type: "object",
      properties: {
        facts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text containing the fact.",
              },
              subjectEntityLocalId: {
                type: "string",
                description:
                  "The local ID of the entity that the fact is about.",
              },
              objectEntityLocalId: {
                type: "string",
                description:
                  "The local ID of the entity that the fact is related to. This is optional.",
              },
            },
            required: ["text", "subjectEntityLocalId"],
          },
        },
      },
      required: ["facts"],
    },
  },
};

const systemPrompt = dedent(`
  You are a fact extracting agent.

  The user will provide you with:
    - "text": the text from which you should extract facts.
    - "entities": a list of entities mentioned in the text, which you need to extract facts about.

  Facts must be:
    - must be concise statements that are true based on the information provided in the text
    - must be standalone, and not depend on any contextual information to make sense
    - must follow a consistent sentence structure, with a single subject, a single predicate and a single object
    - must have a corresponding entity as its subject
    - must not contain any pronouns, and refer to all entities by their provided "name"
    - must not be lists or contain multiple pieces of information, each piece of information must be expressed as a standalone fact
`);

export const inferFactsFromText = async (params: {
  text: string;
  existingEntitySummaries?: EntitySummary[];
}): Promise<{
  facts: Fact[];
}> => {
  const { text, existingEntitySummaries } = params;

  const entitySummaries =
    existingEntitySummaries ??
    (await getEntitySummariesFromText({ text })).entitySummaries;

  logger.debug(`Entity summaries: ${stringify(entitySummaries)}`);

  const { userAuthentication, flowEntityId, webId } = await getFlowContext();

  const llmResponse = await getLlmResponse(
    {
      model: "gpt-4-0125-preview",
      tools: Object.values(toolDefinitions),
      systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: dedent(`
                text: ${text}
                entities: ${JSON.stringify(entitySummaries)}
              `),
            },
          ],
        },
      ],
    },
    {
      userAccountId: userAuthentication.actorId,
      graphApiClient,
      incurredInEntities: [{ entityId: flowEntityId }],
      webId,
    },
  );

  if (llmResponse.status !== "ok") {
    throw new Error(`Failed to get response from LLM: ${llmResponse.status}`);
  }

  const facts: Fact[] = [];

  const toolCalls = getToolCallsFromLlmAssistantMessage({
    message: llmResponse.message,
  });

  for (const toolCall of toolCalls) {
    const input = toolCall.input as {
      text: string;
      subjectEntityLocalId: string;
      objectEntityLocalId?: string;
    };

    facts.push(input);
  }
  return { facts };
};
