import type { EntityUuid } from "@local/hash-subgraph";

import type {
  InputNameForAction,
  OutputNameForAction,
} from "./action-definitions";
import type { FlowDefinition } from "./types";

export const researchTaskFlowDefinition: FlowDefinition = {
  name: "Research Task",
  flowDefinitionId: "research-task" as EntityUuid,
  trigger: {
    triggerDefinitionId: "userTrigger",
    description:
      "User provides research specification and entity types to discover",
    kind: "trigger",
    outputs: [
      {
        payloadKind: "Text",
        name: "prompt" as const,
        array: false,
        required: true,
      },
      {
        payloadKind: "VersionedUrl",
        name: "entityTypeIds",
        array: true,
        required: true,
      },
      {
        payloadKind: "Text",
        name: "question",
        array: false,
        required: true,
      },
    ],
  },
  steps: [
    {
      stepId: "1",
      kind: "action",
      actionDefinitionId: "researchEntities",
      description:
        "Discover entities according to research specification, using public web sources",
      inputSources: [
        {
          inputName: "prompt" satisfies InputNameForAction<"researchEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "prompt",
        },
        {
          inputName:
            "entityTypeIds" satisfies InputNameForAction<"researchEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "entityTypeIds",
        },
      ],
    },
    {
      stepId: "2",
      kind: "action",
      description: "Save discovered entities and relationships to HASH graph",
      actionDefinitionId: "persistEntities",
      inputSources: [
        {
          inputName:
            "proposedEntities" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "1",
          sourceStepOutputName:
            "proposedEntities" satisfies OutputNameForAction<"researchEntities">,
        },
      ],
    },
    {
      stepId: "3",
      kind: "action",
      actionDefinitionId: "answerQuestion",
      description: "Answer user's question using discovered entities",
      inputSources: [
        {
          inputName: "question" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "question",
        },
        {
          inputName: "entities" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "2",
          sourceStepOutputName:
            "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
        },
      ],
    },
  ],
  outputs: [
    {
      stepId: "2",
      stepOutputName:
        "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
      name: "persistedEntities" as const,
      payloadKind: "PersistedEntities",
      array: false,
      required: true,
    },
    {
      stepId: "3",
      stepOutputName: "answer" satisfies OutputNameForAction<"answerQuestion">,
      payloadKind: "Text",
      name: "answer" as const,
      array: false,
      required: true,
    },
  ],
};

export const ftseInvestorsFlowDefinition: FlowDefinition = {
  name: "FTSE350 Investors",
  flowDefinitionId: "ftse-350-investors" as EntityUuid,
  trigger: {
    triggerDefinitionId: "userTrigger",
    description:
      "User chooses the web to output data to, and whether entities should be created as draft",
    kind: "trigger",
    outputs: [
      {
        payloadKind: "WebId",
        name: "webId",
        array: false,
        required: false,
      },
      {
        payloadKind: "Boolean",
        name: "draft",
        array: false,
        required: false,
      },
    ],
  },
  groups: [
    {
      groupId: 1,
      description: "Research FTSE350 constituents",
    },
    {
      groupId: 2,
      description: "Research investments in the FTSE350",
    },
    {
      groupId: 3,
      description: "Calculate top investors",
    },
  ],
  steps: [
    {
      stepId: "1",
      groupId: 1,
      kind: "action",
      actionDefinitionId: "researchEntities",
      description: "Research the constituents of the FTSE350 index",
      inputSources: [
        {
          inputName: "prompt" satisfies InputNameForAction<"researchEntities">,
          kind: "hardcoded",
          payload: {
            kind: "Text",
            value: "Find the constituents in the FTSE350 index",
          },
        },
        {
          inputName:
            "entityTypeIds" satisfies InputNameForAction<"researchEntities">,
          kind: "hardcoded",
          payload: {
            kind: "VersionedUrl",
            value: [
              "https://hash.ai/@ftse/types/entity-type/stock-market-constituent/v/1",
              "https://hash.ai/@ftse/types/entity-type/stock-market-index/v/1",
            ],
          },
        },
      ],
    },
    {
      stepId: "2",
      groupId: 1,
      kind: "action",
      description: "Save discovered members of the FTSE350 to HASH graph",
      actionDefinitionId: "persistEntities",
      inputSources: [
        {
          inputName:
            "proposedEntities" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "1",
          sourceStepOutputName:
            "proposedEntities" satisfies OutputNameForAction<"researchEntities">,
        },
        {
          inputName: "webId" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "webId",
        },
        {
          inputName: "draft" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "draft",
        },
      ],
    },
    {
      stepId: "3",
      groupId: 2,
      kind: "parallel-group",
      description: "Research investors and investments in FTSE350 companies",
      inputSourceToParallelizeOn: {
        inputName: "existingEntities",
        kind: "step-output",
        sourceStepId: "2",
        sourceStepOutputName:
          "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
      },
      steps: [
        {
          stepId: "3.1",
          groupId: 2,
          kind: "action",
          actionDefinitionId: "researchEntities",
          description:
            "Research investors and investments in a FTSE350 company",
          inputSources: [
            {
              inputName:
                "prompt" satisfies InputNameForAction<"researchEntities">,
              kind: "hardcoded",
              payload: {
                kind: "Text",
                value:
                  "Find the investors in the provided FTSE350 constituent, and their investments in that company",
              },
            },
            {
              inputName:
                "entityTypeIds" satisfies InputNameForAction<"researchEntities">,
              kind: "hardcoded",
              payload: {
                kind: "VersionedUrl",
                value: [
                  "https://hash.ai/@ftse/types/entity-type/invested-in/v/1",
                  "https://hash.ai/@ftse/types/entity-type/investment-fund/v/1",
                  "https://hash.ai/@ftse/types/entity-type/company/v/1",
                ],
              },
            },
            {
              inputName:
                "existingEntities" satisfies InputNameForAction<"researchEntities">,
              kind: "parallel-group-input",
            },
          ],
        },
        {
          stepId: "3.2",
          groupId: 2,
          kind: "action",
          description:
            "Save discovered FTSE350 investors and their investments to HASH graph",
          actionDefinitionId: "persistEntities",
          inputSources: [
            {
              inputName:
                "proposedEntities" satisfies InputNameForAction<"persistEntities">,
              kind: "step-output",
              sourceStepId: "3.1",
              sourceStepOutputName:
                "proposedEntities" satisfies OutputNameForAction<"researchEntities">,
            },
            {
              inputName:
                "webId" satisfies InputNameForAction<"persistEntities">,
              kind: "step-output",
              sourceStepId: "trigger",
              sourceStepOutputName: "webId",
            },
            {
              inputName:
                "draft" satisfies InputNameForAction<"persistEntities">,
              kind: "step-output",
              sourceStepId: "trigger",
              sourceStepOutputName: "draft",
            },
          ],
        },
      ],
      aggregateOutput: {
        stepId: "3.2",
        stepOutputName:
          "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
        required: true,
        name: "persistedEntities" as const,
        payloadKind: "Entity",
        array: true,
      },
    },
    {
      stepId: "5",
      groupId: 3,
      kind: "action",
      actionDefinitionId: "answerQuestion",
      description:
        "Calculate the top 10 investors in the FTSE350 by market cap",
      inputSources: [
        {
          inputName: "question" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "question",
        },
        {
          inputName: "entities" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "3",
          sourceStepOutputName:
            "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
        },
      ],
    },
  ],
  outputs: [
    {
      stepId: "3",
      stepOutputName:
        "persistedEntities" satisfies OutputNameForAction<"persistEntities">,
      name: "persistedEntities" as const,
      payloadKind: "PersistedEntities",
      array: false,
      required: true,
    },
    {
      stepId: "5",
      stepOutputName: "answer" satisfies OutputNameForAction<"answerQuestion">,
      payloadKind: "Text",
      name: "answer" as const,
      array: false,
      required: true,
    },
  ],
};

export const inferUserEntitiesFromWebPageFlowDefinition: FlowDefinition = {
  name: "Infer User Entities from Web Page",
  flowDefinitionId: "infer-user-entities-from-web-page" as EntityUuid,
  trigger: {
    kind: "trigger",
    description: "Triggered when user visits a web page",
    triggerDefinitionId: "userTrigger",
    outputs: [
      {
        payloadKind: "Text",
        name: "visitedWebPageUrl",
        array: false,
        required: true,
      },
      {
        payloadKind: "VersionedUrl",
        name: "entityTypeIds",
        array: true,
        required: true,
      },
      {
        payloadKind: "WebId",
        name: "webId",
        array: false,
        required: false,
      },
      {
        payloadKind: "Boolean",
        name: "draft",
        array: false,
        required: true,
      },
    ],
  },
  steps: [
    {
      stepId: "0",
      kind: "action",
      actionDefinitionId: "getWebPageByUrl",
      description: "Retrieve web page content from URL",
      inputSources: [
        {
          inputName: "url" satisfies InputNameForAction<"getWebPageByUrl">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "visitedWebPageUrl",
        },
      ],
    },
    {
      stepId: "1",
      kind: "action",
      actionDefinitionId: "inferEntitiesFromContent",
      description: "Infer entities from web page content",
      inputSources: [
        {
          inputName:
            "content" satisfies InputNameForAction<"inferEntitiesFromContent">,
          kind: "step-output",
          sourceStepId: "0",
          sourceStepOutputName:
            "webPage" satisfies OutputNameForAction<"getWebPageByUrl">,
        },
        {
          inputName:
            "entityTypeIds" satisfies InputNameForAction<"inferEntitiesFromContent">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "entityTypeIds",
        },
      ],
    },
    {
      stepId: "2",
      kind: "action",
      actionDefinitionId: "persistEntities",
      description: "Save proposed entities to database",
      inputSources: [
        {
          inputName:
            "proposedEntities" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "1",
          sourceStepOutputName:
            "proposedEntities" satisfies OutputNameForAction<"inferEntitiesFromContent">,
        },
        {
          inputName: "webId" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "webId",
        },
        {
          inputName: "draft" satisfies InputNameForAction<"persistEntities">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "draft",
        },
      ],
    },
  ],
  outputs: [
    {
      stepId: "2",
      stepOutputName: "persistedEntities",
      name: "persistedEntities" as const,
      payloadKind: "Entity",
      array: true,
      required: true,
    },
  ],
};

export const answerQuestionFlow: FlowDefinition = {
  name: "Answer Question Flow",
  flowDefinitionId: "answer-question-flow" as EntityUuid,
  trigger: {
    kind: "trigger",
    description: "Triggered when user asks a question and provides context",
    triggerDefinitionId: "userTrigger",
    outputs: [
      {
        payloadKind: "Text",
        name: "question",
        array: false,
        required: true,
      },
      {
        payloadKind: "Text",
        name: "context",
        array: false,
        required: true,
      },
    ],
  },
  steps: [
    {
      stepId: "0",
      kind: "action",
      actionDefinitionId: "answerQuestion",
      description: "Answer question on the provided context",
      inputSources: [
        {
          inputName: "question" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "question",
        },
        {
          inputName: "context" satisfies InputNameForAction<"answerQuestion">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "context",
        },
      ],
    },
  ],
  outputs: [
    {
      stepId: "0",
      stepOutputName: "answer",
      name: "answer",
      payloadKind: "Text",
      required: false,
      array: false,
    },
    {
      stepId: "0",
      stepOutputName: "explanation",
      name: "explanation",
      payloadKind: "Text",
      required: true,
      array: false,
    },
    {
      stepId: "0",
      stepOutputName: "code",
      name: "code",
      payloadKind: "Text",
      required: false,
      array: false,
    },
    {
      stepId: "0",
      stepOutputName: "confidence",
      name: "confidence",
      payloadKind: "Number",
      required: false,
      array: false,
    },
  ],
};

export const saveFileFromUrl: FlowDefinition = {
  name: "Save File From Url",
  flowDefinitionId: "saveFileFromUrl" as EntityUuid,
  trigger: {
    triggerDefinitionId: "userTrigger",
    description: "Triggered when user provides a URL to a file",
    kind: "trigger",
    outputs: [
      {
        payloadKind: "Text",
        name: "url" as const,
        array: false,
        required: true,
      },
      {
        payloadKind: "Text",
        name: "description" as const,
        array: false,
        required: true,
      },
      {
        payloadKind: "Text",
        name: "displayName" as const,
        array: false,
        required: true,
      },
    ],
  },
  steps: [
    {
      stepId: "1",
      kind: "action",
      actionDefinitionId: "getFileFromUrl",
      description:
        "Retrieve file from URL, mirror into HASH and create associated entity",
      inputSources: [
        {
          inputName: "url" satisfies InputNameForAction<"getFileFromUrl">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "url",
        },
        {
          inputName:
            "description" satisfies InputNameForAction<"getFileFromUrl">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "description",
        },
        {
          inputName:
            "displayName" satisfies InputNameForAction<"getFileFromUrl">,
          kind: "step-output",
          sourceStepId: "trigger",
          sourceStepOutputName: "displayName",
        },
      ],
    },
  ],
  outputs: [
    {
      stepId: "1",
      stepOutputName: "fileEntity",
      name: "fileEntity",
      payloadKind: "Entity",
      array: false,
      required: true,
    },
  ],
};