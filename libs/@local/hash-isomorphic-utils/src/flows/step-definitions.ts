import type {
  ActionDefinition,
  DeepReadOnly,
  TriggerDefinition,
} from "./types";

export const triggerDefinitions = {
  userTrigger: {
    kind: "trigger",
    name: "User Trigger",
  },
  userVisitedWebPageTrigger: {
    kind: "trigger",
    name: "User Visited Web Page Trigger",
    outputs: [
      {
        payloadKind: "Text",
        name: "visitedWebPageUrl" as const,
        array: false,
      },
    ],
  },
} satisfies Record<string, TriggerDefinition>;

export type OutputNameForTrigger<T extends keyof typeof triggerDefinitions> =
  (typeof triggerDefinitions)[T] extends { outputs: { name: string }[] }
    ? (typeof triggerDefinitions)[T]["outputs"][number]["name"]
    : never;

const actionDefinitionIds = [
  "generateWebQuery",
  "webSearch",
  "getWebPageByUrl",
  "inferEntitiesFromContent",
  "persistEntity",
] as const;

export type ActionDefinitionId = (typeof actionDefinitionIds)[number];

const actionDefinitionsAsConst = {
  generateWebQuery: {
    actionDefinitionId: "generateWebQuery",
    name: "Generate Web Query",
    kind: "action",
    inputs: [
      {
        oneOfPayloadKinds: ["Text"],
        name: "prompt",
        required: true,
        array: false,
      },
    ],
    outputs: [
      {
        payloadKind: "Text",
        name: "query",
        array: false,
      },
    ],
  },
  webSearch: {
    actionDefinitionId: "webSearch",
    name: "Web Search",
    kind: "action",
    inputs: [
      {
        oneOfPayloadKinds: ["Text"],
        name: "query",
        required: true,
        array: false,
      },
    ],
    outputs: [
      {
        payloadKind: "WebPage",
        name: "webPage",
        array: true,
      },
    ],
  },
  getWebPageByUrl: {
    actionDefinitionId: "getWebPageByUrl",
    name: "Get Web Page From URL",
    kind: "action",
    inputs: [
      {
        oneOfPayloadKinds: ["Text"],
        name: "url",
        required: true,
        array: false,
      },
    ],
    outputs: [
      {
        payloadKind: "WebPage",
        name: "webPage",
        array: false,
      },
    ],
  },
  inferEntitiesFromContent: {
    actionDefinitionId: "inferEntitiesFromContent",
    name: "Infer Entities From Content",
    kind: "action",
    inputs: [
      {
        oneOfPayloadKinds: ["Text", "WebPage"],
        name: "content",
        required: true,
        array: false,
      },
      {
        oneOfPayloadKinds: ["VersionedUrl"],
        name: "entityTypeIds",
        required: true,
        array: true,
      },
    ],
    outputs: [
      {
        payloadKind: "ProposedEntity",
        name: "proposedEntities",
        array: true,
      },
    ],
  },
  persistEntity: {
    actionDefinitionId: "persistEntity",
    name: "Persist Entity",
    kind: "action",
    inputs: [
      {
        oneOfPayloadKinds: ["ProposedEntity"],
        name: "proposedEntity",
        required: true,
        array: false,
      },
    ],
    outputs: [
      {
        payloadKind: "Entity",
        name: "persistedEntity",
        array: false,
      },
    ],
  },
} as const satisfies Record<ActionDefinitionId, DeepReadOnly<ActionDefinition>>;

export const actionDefinitions = actionDefinitionsAsConst as unknown as Record<
  ActionDefinitionId,
  ActionDefinition
>;

export type InputNameForAction<
  T extends keyof typeof actionDefinitionsAsConst,
> = (typeof actionDefinitionsAsConst)[T]["inputs"][number]["name"];

export type OutputNameForAction<
  T extends keyof typeof actionDefinitionsAsConst,
> = (typeof actionDefinitionsAsConst)[T]["outputs"][number]["name"];