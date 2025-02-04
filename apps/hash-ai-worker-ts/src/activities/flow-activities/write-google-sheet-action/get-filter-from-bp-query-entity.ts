import type { MultiFilter } from "@blockprotocol/graph";
import { convertBpFilterToGraphFilter } from "@local/hash-backend-utils/convert-bp-filter-to-graph-filter";
import type { GraphApi } from "@local/hash-graph-client";
import { blockProtocolPropertyTypes } from "@local/hash-isomorphic-utils/ontology-type-ids";
import type { QueryProperties } from "@local/hash-isomorphic-utils/system-types/blockprotocol/query";
import type { AccountId, Entity, EntityId } from "@local/hash-subgraph";

import { getLatestEntityById } from "../shared/graph-requests";

export const getFilterFromBlockProtocolQueryEntity = async ({
  authentication,
  graphApiClient,
  queryEntityId,
}: {
  authentication: { actorId: AccountId };
  graphApiClient: GraphApi;
  queryEntityId: EntityId;
}) => {
  let queryEntity: Entity<QueryProperties> | undefined;
  try {
    queryEntity = (await getLatestEntityById({
      graphApiClient,
      authentication,
      entityId: queryEntityId,
    })) as Entity<QueryProperties>;
  } catch {
    throw new Error(`No query entity found with id ${queryEntityId}.`);
  }

  const multiFilter =
    queryEntity.properties[
      blockProtocolPropertyTypes.query.propertyTypeBaseUrl
    ];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- additional check in case another entity is used that has this optional
  if (!multiFilter) {
    throw new Error(
      `No ${blockProtocolPropertyTypes.query.propertyTypeBaseUrl} property found on query entity with id ${queryEntityId}`,
    );
  }

  const filter = convertBpFilterToGraphFilter(multiFilter as MultiFilter);

  return filter;
};
