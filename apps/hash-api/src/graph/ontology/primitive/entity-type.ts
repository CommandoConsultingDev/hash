import type { VersionedUrl } from "@blockprotocol/type-system";
import { ENTITY_TYPE_META_SCHEMA } from "@blockprotocol/type-system";
import { NotFoundError } from "@local/hash-backend-utils/error";
import { publicUserAccountId } from "@local/hash-backend-utils/public-user-account-id";
import type { TemporalClient } from "@local/hash-backend-utils/temporal";
import type {
  ArchiveEntityTypeParams,
  EntityType,
  EntityTypePermission,
  GetEntityTypesRequest,
  GetEntityTypeSubgraphRequest,
  ModifyRelationshipOperation,
  OntologyTemporalMetadata,
  ProvidedOntologyEditionProvenance,
  UnarchiveEntityTypeParams,
  UpdateEntityTypeRequest,
} from "@local/hash-graph-client";
import { currentTimeInstantTemporalAxes } from "@local/hash-isomorphic-utils/graph-queries";
import { generateTypeId } from "@local/hash-isomorphic-utils/ontology-types";
import {
  mapGraphApiEntityTypeToEntityType,
  mapGraphApiSubgraphToSubgraph,
} from "@local/hash-isomorphic-utils/subgraph-mapping";
import type {
  ConstructEntityTypeParams,
  UserPermissionsOnEntityType,
} from "@local/hash-isomorphic-utils/types";
import type {
  BaseUrl,
  EntityTypeAuthorizationRelationship,
  EntityTypeMetadata,
  EntityTypeRelationAndSubject,
  EntityTypeRootType,
  EntityTypeWithMetadata,
  OntologyTypeRecordId,
  OwnedById,
  Subgraph,
} from "@local/hash-subgraph";
import {
  linkEntityTypeUrl,
  ontologyTypeRecordIdToVersionedUrl,
} from "@local/hash-subgraph";

import type { ImpureGraphFunction } from "../../context-types";
import { rewriteSemanticFilter } from "../../shared/rewrite-semantic-filter";
import { getWebShortname, isExternalTypeId } from "./util";

export const getEntityTypeAuthorizationRelationships: ImpureGraphFunction<
  { entityTypeId: VersionedUrl },
  Promise<EntityTypeAuthorizationRelationship[]>
> = async ({ graphApi }, { actorId }, params) =>
  graphApi
    .getEntityTypeAuthorizationRelationships(actorId, params.entityTypeId)
    .then(({ data }) =>
      data.map(
        (relationship) =>
          ({
            resource: { kind: "entityType", resourceId: params.entityTypeId },
            ...relationship,
          }) as EntityTypeAuthorizationRelationship,
      ),
    );

export const modifyEntityTypeAuthorizationRelationships: ImpureGraphFunction<
  {
    operation: ModifyRelationshipOperation;
    relationship: EntityTypeAuthorizationRelationship;
  }[],
  Promise<void>
> = async ({ graphApi }, { actorId }, params) => {
  await graphApi.modifyEntityTypeAuthorizationRelationships(
    actorId,
    params.map(({ operation, relationship }) => ({
      operation,
      resource: relationship.resource.resourceId,
      relationAndSubject: relationship,
    })),
  );
};

export const checkEntityTypePermission: ImpureGraphFunction<
  { entityTypeId: VersionedUrl; permission: EntityTypePermission },
  Promise<boolean>
> = async ({ graphApi }, { actorId }, params) =>
  graphApi
    .checkEntityTypePermission(actorId, params.entityTypeId, params.permission)
    .then(({ data }) => data.has_permission);

export const checkPermissionsOnEntityType: ImpureGraphFunction<
  { entityTypeId: VersionedUrl },
  Promise<UserPermissionsOnEntityType>
> = async (graphContext, { actorId }, params) => {
  const { entityTypeId } = params;

  const isPublicUser = actorId === publicUserAccountId;

  const [canUpdate, canInstantiateEntities] = await Promise.all([
    isPublicUser
      ? false
      : await checkEntityTypePermission(
          graphContext,
          { actorId },
          { entityTypeId, permission: "update" },
        ),
    isPublicUser
      ? false
      : await checkEntityTypePermission(
          graphContext,
          { actorId },
          { entityTypeId, permission: "instantiate" },
        ),
  ]);

  return {
    edit: canUpdate,
    instantiate: canInstantiateEntities,
    view: true,
  };
};

/**
 * Create an entity type.
 *
 * @param params.ownedById - the id of the account who owns the entity type
 * @param [params.webShortname] – the shortname of the web that owns the entity type, if the web entity does not yet exist.
 *    - Only for seeding purposes. Caller is responsible for ensuring the webShortname is correct for the ownedById.
 * @param params.schema - the `EntityType`
 * @param params.actorId - the id of the account that is creating the entity type
 */
export const createEntityType: ImpureGraphFunction<
  {
    ownedById: OwnedById;
    schema: ConstructEntityTypeParams;
    labelProperty?: BaseUrl;
    icon?: string | null;
    webShortname?: string;
    relationships: EntityTypeRelationAndSubject[];
    provenance?: ProvidedOntologyEditionProvenance;
  },
  Promise<EntityTypeWithMetadata>
> = async (ctx, authentication, params) => {
  const { ownedById, labelProperty, icon, webShortname, provenance } = params;

  const shortname =
    webShortname ??
    (await getWebShortname(ctx, authentication, {
      accountOrAccountGroupId: ownedById,
    }));

  const entityTypeId = generateTypeId({
    kind: "entity-type",
    title: params.schema.title,
    webShortname: shortname,
  });

  const schema = {
    $schema: ENTITY_TYPE_META_SCHEMA,
    kind: "entityType" as const,
    $id: entityTypeId,
    ...params.schema,
  };

  const { graphApi } = ctx;

  const { data: metadata } = await graphApi.createEntityType(
    authentication.actorId,
    {
      ownedById,
      schema,
      labelProperty,
      icon,
      relationships: params.relationships,
      provenance,
    },
  );

  return { schema, metadata: metadata as EntityTypeMetadata };
};

/**
 * Get entity types by a structural query.
 *
 * @param params.query the structural query to filter entity types by.
 */
export const getEntityTypeSubgraph: ImpureGraphFunction<
  Omit<GetEntityTypeSubgraphRequest, "includeDrafts"> & {
    temporalClient?: TemporalClient;
  },
  Promise<Subgraph<EntityTypeRootType>>
> = async ({ graphApi }, { actorId }, { temporalClient, ...request }) => {
  await rewriteSemanticFilter(request.filter, temporalClient);

  return await graphApi
    .getEntityTypeSubgraph(actorId, { includeDrafts: false, ...request })
    .then(({ data: response }) => {
      const subgraph = mapGraphApiSubgraphToSubgraph<EntityTypeRootType>(
        response.subgraph,
        actorId,
      );

      return subgraph;
    });
};

export const getEntityTypes: ImpureGraphFunction<
  Omit<GetEntityTypesRequest, "includeDrafts"> & {
    temporalClient?: TemporalClient;
  },
  Promise<EntityTypeWithMetadata[]>
> = async ({ graphApi }, { actorId }, { temporalClient, ...request }) => {
  await rewriteSemanticFilter(request.filter, temporalClient);

  return await graphApi
    .getEntityTypes(actorId, { includeDrafts: false, ...request })
    .then(({ data: response }) =>
      mapGraphApiEntityTypeToEntityType(response.entityTypes),
    );
};

/**
 * Get an entity type by its versioned URL.
 *
 * @param params.entityTypeId the unique versioned URL for an entity type.
 */
export const getEntityTypeById: ImpureGraphFunction<
  {
    entityTypeId: VersionedUrl;
  },
  Promise<EntityTypeWithMetadata>
> = async (context, authentication, params) => {
  const { entityTypeId } = params;

  const [entityType] = await getEntityTypes(context, authentication, {
    filter: {
      equal: [{ path: ["versionedUrl"] }, { parameter: entityTypeId }],
    },
    temporalAxes: currentTimeInstantTemporalAxes,
  });

  if (!entityType) {
    throw new NotFoundError(
      `Could not find entity type with ID "${entityTypeId}"`,
    );
  }

  return entityType;
};

/**
 * Get an entity type rooted subgraph by its versioned URL.
 *
 * If the type does not already exist within the Graph, and is an externally-hosted type, this will also load the type into the Graph.
 */
export const getEntityTypeSubgraphById: ImpureGraphFunction<
  Omit<GetEntityTypeSubgraphRequest, "filter" | "includeDrafts"> & {
    entityTypeId: VersionedUrl;
  },
  Promise<Subgraph<EntityTypeRootType>>
> = async (context, authentication, params) => {
  const { graphResolveDepths, temporalAxes, entityTypeId } = params;

  const request: GetEntityTypeSubgraphRequest = {
    filter: {
      equal: [{ path: ["versionedUrl"] }, { parameter: entityTypeId }],
    },
    graphResolveDepths,
    temporalAxes,
    includeDrafts: false,
  };

  let subgraph = await getEntityTypeSubgraph(context, authentication, request);

  if (subgraph.roots.length === 0 && isExternalTypeId(entityTypeId)) {
    await context.graphApi.loadExternalEntityType(authentication.actorId, {
      entityTypeId,
    });

    subgraph = await getEntityTypeSubgraph(context, authentication, request);
  }

  return subgraph;
};

/**
 * Update an entity type.
 *
 * @param params.entityTypeId - the id of the entity type that's being updated
 * @param params.schema - the updated `EntityType`
 * @param params.actorId - the id of the account that is updating the entity type
 */
export const updateEntityType: ImpureGraphFunction<
  {
    entityTypeId: VersionedUrl;
    schema: ConstructEntityTypeParams;
    labelProperty?: BaseUrl;
    icon?: string | null;
    relationships: EntityTypeRelationAndSubject[];
    provenance?: ProvidedOntologyEditionProvenance;
  },
  Promise<EntityTypeWithMetadata>
> = async (ctx, authentication, params) => {
  const { entityTypeId, schema, labelProperty, icon, provenance } = params;
  const updateArguments: UpdateEntityTypeRequest = {
    typeToUpdate: entityTypeId,
    schema: {
      kind: "entityType",
      $schema: ENTITY_TYPE_META_SCHEMA,
      ...schema,
    },
    labelProperty,
    icon,
    relationships: params.relationships,
    provenance,
  };

  const { data: metadata } = await ctx.graphApi.updateEntityType(
    authentication.actorId,
    updateArguments,
  );

  const newEntityTypeId = ontologyTypeRecordIdToVersionedUrl(
    metadata.recordId as OntologyTypeRecordId,
  );

  return {
    schema: {
      kind: "entityType",
      $schema: ENTITY_TYPE_META_SCHEMA,
      ...schema,
      $id: newEntityTypeId,
    },
    metadata: metadata as EntityTypeMetadata,
  };
};

// Return true if any type in the provided entity type's ancestors is a link entity type
export const isEntityTypeLinkEntityType: ImpureGraphFunction<
  Pick<EntityType, "allOf">,
  Promise<boolean>
> = async (context, authentication, params) => {
  const { allOf } = params;

  if (allOf?.some(({ $ref }) => $ref === linkEntityTypeUrl)) {
    return true;
  }

  const parentTypes = await Promise.all(
    (allOf ?? []).map(async ({ $ref }) =>
      getEntityTypeById(context, authentication, {
        entityTypeId: $ref as VersionedUrl,
      }),
    ),
  );

  return new Promise((resolve) => {
    const promises = parentTypes.map((parent) =>
      isEntityTypeLinkEntityType(context, authentication, parent.schema).then(
        (isLinkType) => {
          if (isLinkType) {
            // Resolve as soon as we have encountered a link type, instead of waiting for all parent types to be checked
            resolve(true);
          }
        },
      ),
    );

    void Promise.all(promises).then(() =>
      // If we haven't resolved yet, then none of the parent types are link types. If we have resolved this is a no-op.
      resolve(false),
    );
  });
};

/**
 * Archives a data type
 *
 * @param params.entityTypeId - the id of the entity type that's being archived
 * @param params.actorId - the id of the account that is archiving the entity type
 */
export const archiveEntityType: ImpureGraphFunction<
  ArchiveEntityTypeParams,
  Promise<OntologyTemporalMetadata>
> = async ({ graphApi }, { actorId }, params) => {
  const { data: temporalMetadata } = await graphApi.archiveEntityType(
    actorId,
    params,
  );

  return temporalMetadata;
};

/**
 * Unarchives a data type
 *
 * @param params.entityTypeId - the id of the entity type that's being unarchived
 * @param params.actorId - the id of the account that is unarchiving the entity type
 */
export const unarchiveEntityType: ImpureGraphFunction<
  UnarchiveEntityTypeParams,
  Promise<OntologyTemporalMetadata>
> = async ({ graphApi }, { actorId }, params) => {
  const { data: temporalMetadata } = await graphApi.unarchiveEntityType(
    actorId,
    params,
  );

  return temporalMetadata;
};
