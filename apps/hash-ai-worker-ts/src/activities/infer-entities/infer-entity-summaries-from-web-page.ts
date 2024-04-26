import type { Entity } from "@local/hash-subgraph";
import dedent from "dedent";

import type { PermittedOpenAiModel } from "../shared/openai-client";
import { simplifyEntity } from "../shared/simplify-entity";
import { inferEntitySummaries } from "./infer-entity-summaries";
import type {
  DereferencedEntityTypesByTypeId,
  InferenceState,
  WebPage,
} from "./inference-types";

export const inferEntitySummariesFromWebPage = async (params: {
  webPage: WebPage | string;
  relevantEntitiesPrompt?: string;
  maxTokens?: number | null;
  model: PermittedOpenAiModel;
  temperature?: number;
  inferenceState: InferenceState;
  entityTypes: DereferencedEntityTypesByTypeId;
  existingEntities?: Entity[];
}) => {
  const {
    webPage,
    relevantEntitiesPrompt,
    maxTokens,
    model,
    temperature,
    entityTypes,
    inferenceState,
    existingEntities,
  } = params;

  const summariseEntitiesPrompt = dedent(`
  First, let's get a summary of the entities you can infer from the provided text.
  Please provide a brief description of ${
    relevantEntitiesPrompt ? "each relevant" : "each"
  } entity you can infer.
  It only needs to be long enough to uniquely identify the entity in the text – we'll worry about any more details in a future step.
  ${
    relevantEntitiesPrompt
      ? dedent(`
        The user is asking for entities which are relevant to the following prompt: "${relevantEntitiesPrompt}".
        You must only infer entities which are relevant to this prompt.`)
      : ""
  }
  For entities that link other entities together, the sourceEntityId must correspond to an entityId of an entity you provide, as must the targetEntityId.
  I'm about to provide you with the content of a website${typeof webPage === "string" ? "" : ` hosted at ${webPage.url}, titled ${webPage.title}`}.
  ${
    relevantEntitiesPrompt
      ? ""
      : dedent(`
        Pay particular attention to providing responses for entities which are most prominent in the page,
        and any which are mentioned in the title or URL – but include as many other entities as you can find also.`)
  }
  ${
    existingEntities && existingEntities.length > 0
      ? dedent(`
        The user has provided these existing entities, which do not need to be inferred again: ${JSON.stringify(existingEntities.map(simplifyEntity))}

        Do not provide summaries for entities which are already in this list.
      `)
      : ""
  }
  Here is the website content:
  ${typeof webPage === "string" ? webPage : webPage.textContent}
  ---WEBSITE CONTENT ENDS---

  Your comprehensive list entities of the requested types you are able to infer from the website:
`);

  return await inferEntitySummaries({
    completionPayload: {
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: summariseEntitiesPrompt,
        },
      ],
      model,
      temperature,
    },
    entityTypes,
    inferenceState,
    providedOrRerequestedEntityTypes: new Set(),
    existingEntities,
  });
};
