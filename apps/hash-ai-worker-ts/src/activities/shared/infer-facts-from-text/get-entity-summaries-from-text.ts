import { generateUuid } from "@local/hash-isomorphic-utils/generate-uuid";
import dedent from "dedent";

import { getFlowContext } from "../get-flow-context";
import { getLlmResponse } from "../get-llm-response";
import { getToolCallsFromLlmAssistantMessage } from "../get-llm-response/llm-message";
import type { LlmToolDefinition } from "../get-llm-response/types";
import { graphApiClient } from "../graph-api-client";

export type EntitySummary = {
  localId: string;
  name: string;
  summary: string;
};

const toolNames = ["registerEntitySummary"] as const;

type ToolName = (typeof toolNames)[number];

const toolDefinitions: Record<ToolName, LlmToolDefinition<ToolName>> = {
  registerEntitySummary: {
    name: "registerEntitySummary",
    description: "Register an entity summary.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the entity.",
        },
        summary: {
          type: "string",
          description: "The summary of the entity.",
        },
      },
      required: ["name", "summary"],
    },
  },
};

const systemPrompt = dedent(`
  You are an entity summary extraction agent.

  The user will provide you with:
    - "text": the text from which you should extract entity summaries.

  You must extract all the relevant entities from the text, providing:
    - "name": the name of the entity, which can be used to identify the entity in the text.
    - "summary": a one sentence description of the entity. This must be entirely based on
      the provided text, and not any other knowledge you may have.
`);

export const getEntitySummariesFromText = async (params: {
  text: string;
}): Promise<{
  entitySummaries: EntitySummary[];
}> => {
  const { text } = params;

  const { userAuthentication, flowEntityId, webId } = await getFlowContext();

  const llmResponse = await getLlmResponse(
    {
      model: "gpt-4-0125-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: dedent(`
                text: ${text}
              `),
            },
          ],
        },
      ],
      systemPrompt,
      tools: Object.values(toolDefinitions),
    },
    {
      userAccountId: userAuthentication.actorId,
      graphApiClient,
      incurredInEntities: [{ entityId: flowEntityId }],
      webId,
    },
  );

  if (llmResponse.status !== "ok") {
    throw new Error(`Failed to get LLM response: ${llmResponse.status}`);
  }

  const toolCalls = getToolCallsFromLlmAssistantMessage({
    message: llmResponse.message,
  });

  const entitySummaries: EntitySummary[] = [];

  for (const toolCall of toolCalls) {
    const { name, summary } = toolCall.input as {
      name: string;
      summary: string;
    };

    const localId = generateUuid();

    entitySummaries.push({ localId, name, summary });
  }

  return { entitySummaries };
};
